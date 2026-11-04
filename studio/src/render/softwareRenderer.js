import { gradePixels } from '../core/printGrade.js';
// CPU / software rendering backend: Canvas2D compositing -> raw RGBA frames ->
// local FFmpeg H.264 encode. Fully local, no Chromium required, silent output.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { cameraForShot } from '../camera/cameraEngine.js';
import { poseCharacter } from '../rig/characterRig.js';
import { drawCharacter } from '../art/characterArt.js';
import { paintEnvironment, paintLighting, paintComicFx, paintPaper } from '../art/sceneArt.js';
import { resolveRenderSpec, diskSpaceCheck, ffmpegArgs, verifySilentMp4, readRenderState, writeRenderState, clearRenderState } from './renderSpec.js';
import { clamp, slug } from '../core/util.js';
import { shotAt } from '../core/shotUtils.js';

let canvasLib = null;
async function getCanvas() {
  if (!canvasLib) {
    try { canvasLib = await import('@napi-rs/canvas'); }
    catch (e) { throw new Error('Software backend needs @napi-rs/canvas (npm install in studio/). ' + e.message); }
  }
  return canvasLib;
}

export function findFfmpeg() {
  const fromEnv = process.env.FFMPEG_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  try { const p = execFileSync('sh', ['-c', 'command -v ffmpeg'], { encoding: 'utf8' }).trim(); if (p) return p; } catch {}
  try { const p = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim(); if (p && fs.existsSync(p)) return p; } catch {}
  throw new Error('FFmpeg not found. Install ffmpeg locally or set FFMPEG_BIN.');
}

export { shotAt };

export function composeFrame(ctx, plan, frame, width, height, spec = {}) {
  const shot = shotAt(plan, frame);
  const view = cameraForShot(shot, frame);
  const palette = shot.palette;
  const quality = spec.quality || 'medium';
  ctx.save(); ctx.clearRect(0, 0, width, height);
  paintEnvironment(ctx, shot.env, view, width, height, frame, palette, quality);
  const zoom = clamp(9 / (view.pos[2] || 9), 0.45, 2.2);
  const close = shot.camera.type.includes('close-up') || shot.camera.type === 'reaction-shot';
  const desiredScale = (height * 0.42 / 150) * zoom * (close ? (shot.camera.type === 'extreme-close-up' ? 2.3 : 1.6) : 1);
  const visibleCharacters = close ? shot.characters.slice(0, 1) : shot.characters;
  const baseScale = close ? desiredScale : Math.min(desiredScale, height * .65 / 190, width / (Math.max(2, visibleCharacters.length) * 95));
  const groundY = height * 0.74;
  const localFrame = frame - shot.a;
  const stats = { shotId: shot.id, camera: view, characters: [] };
  for (const ch of visibleCharacters) {
    const design = plan.designs.find((d) => d.id === ch.id);
    if (!design) continue;
    const costume = shot.characterColors?.[design.id] || {
      main: design.costume.main, trim: design.costume.trim, shadow: design.costume.shadow,
      skin: design.face.skinTone, hair: design.hair.color, ink: design.colorIdentity.ink,
    };
    const scale = baseScale * (design.proportions?.height ? 3.5 / design.proportions.height : 1);
    const factor = (shot.interaction ? 0.78 : 1) * (visibleCharacters.length > 2 ? .58 : 1);
    const x = width * 0.5 + (close ? 0 : ch.x) * factor * width * 0.22 - (view.pos[0] || 0) * width * 0.025;
    let y = groundY - 70 * scale - (close ? height * 0.10 : 0);
    const partner = shot.characters.find(c => c.id === ch.gaze?.target);
    const midpoint = partner ? width * .5 + (ch.x+partner.x)*factor*.11*width - (view.pos[0]||0)*width*.025 : x;
    const reach = partner && ch.action === 'interact' ? { x: (midpoint-x)/scale, y: -32 * baseScale/scale } : undefined;
    const pose = poseCharacter(design, { frame: localFrame, action: ch.action, expression: ch.expression,
      gesture: ch.gesture, gaze: ch.gaze, reach, intensity: ch.intensity || 0.5 });
    if (close) y = height * .42 - pose.points.head.y * scale;
    drawCharacter(ctx, { design, pose, costume, palette, x, y, scale });
    stats.characters.push({ id: design.id, x: +x.toFixed(1), y: +y.toFixed(1), scale: +scale.toFixed(3),
      action: ch.action, expression: ch.expression, gesture: ch.gesture,
      bodyBounds: { x0: x + (Math.min(pose.points.shoulderL.x, pose.points.head.x - 22)) * scale,
        x1: x + (Math.max(pose.points.shoulderR.x, pose.points.head.x + 22)) * scale,
        y0: y + (pose.points.head.y - 38) * scale, y1: y + Math.max(pose.points.ankleL.y, pose.points.ankleR.y) * scale },
      intentionalCrop: close,
      head: { x: +(x + pose.points.head.x * scale).toFixed(1), y: +(y + pose.points.head.y * scale).toFixed(1) },
      fingers: pose.fingers.R.map((f) => +f.curl.toFixed(3)), eyeOpen: +pose.face.eyeOpenL.toFixed(3) });
  }
  paintLighting(ctx, shot.light, palette, width, height);
  paintComicFx(ctx, shot.fx, frame, shot, palette, width, height, quality);
  paintPaper(ctx, width, height, palette, quality);
  if (shot.grade) {
    const image = ctx.getImageData(0, 0, width, height);
    ctx.putImageData(gradePixels(image, shot.grade), 0, 0);
  }
  ctx.restore();
  return stats;
}

export async function renderFramePNG(plan, frame, outFile, spec = { quality: 'medium', width: 540, height: 960 }) {
  const { createCanvas } = await getCanvas();
  const canvas = createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext('2d');
  const stats = composeFrame(ctx, plan, frame, spec.width, spec.height, spec);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, canvas.toBuffer('image/png'));
  return { file: outFile, stats };
}

export async function renderSoftware(plan, opts = {}) {
  const { createCanvas } = await getCanvas();
  const spec = resolveRenderSpec(plan, { ...opts, backend: 'software' }, opts.hardware || {});
  const outPath = path.resolve(opts.out || path.join('out', `${slug(plan.meta.title)}-${spec.quality}-${spec.width}x${spec.height}.mp4`));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const disk = diskSpaceCheck(path.dirname(outPath));
  if (!disk.ok) throw new Error(`Not enough local disk space: ${disk.freeGB ?? 0} GB free (${disk.error || ''})`);
  const ffmpeg = findFfmpeg();
  const frameBytes = spec.width * spec.height * 4;
  const estimated = frameBytes * spec.totalFrames;
  const recoverable = opts.recoverable !== false && disk.freeBytes > estimated * 1.3;
  const rawFile = `${outPath}.rgba`;
  const state = opts.resume ? readRenderState(outPath) : null;
  const start = state?.nextFrame && state.nextFrame < spec.totalFrames ? state.nextFrame : 0;
  if (start > 0 && !recoverable) throw new Error('Resume requires the raw frame cache (disk too small).');

  const canvas = createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext('2d');
  let fd = null;
  if (recoverable) fd = fs.openSync(rawFile, start > 0 ? 'r+' : 'w+');
  const partialPath = path.join(path.dirname(outPath), `.${path.basename(outPath, '.mp4')}-partial.mp4`);
  const args = ffmpegArgs(spec, partialPath);
  const encodeAfter = fd !== null; // recoverable raw cache: encode once all frames exist
  if (encodeAfter) args[args.indexOf('pipe:0')] = rawFile;
  let stderr = '';
  let proc = null;
  const attach = (p) => { p.stderr.on('data', (d) => { stderr += d.toString(); }); return p; };
  if (!encodeAfter) proc = attach(spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] }));

  for (let f = start; f < spec.totalFrames; f++) {
    composeFrame(ctx, plan, f, spec.width, spec.height, spec);
    const data = ctx.getImageData(0, 0, spec.width, spec.height).data;
    const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (fd !== null) fs.writeSync(fd, buf, 0, frameBytes, f * frameBytes);
    else if (!proc.stdin.write(buf)) await once(proc.stdin, 'drain');
    if (f % 30 === 0) { writeRenderState(outPath, f + 1); if (opts.onProgress) opts.onProgress(f + 1, spec.totalFrames); }
  }
  if (fd !== null) { fs.closeSync(fd); proc = attach(spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })); }
  else proc.stdin.end();
  const [code] = await once(proc, 'close');
  if (code !== 0) throw new Error(`Local ffmpeg failed (${code}): ${stderr.slice(-600)}`);
  const verification = verifySilentMp4(ffmpeg, partialPath);
  if (!verification.ok) throw new Error(`Output is not a silent H.264 MP4: ${JSON.stringify(verification)}`);
  fs.renameSync(partialPath, outPath);
  clearRenderState(outPath);
  if (recoverable && !process.env.KEEP_RAW) { try { fs.unlinkSync(rawFile); } catch {} }
  return { outPath, spec, verification, framesRendered: spec.totalFrames - start, recoverable, local: true, backend: 'software' };
}
