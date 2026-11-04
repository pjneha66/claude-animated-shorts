// Automated visual QA: 15 test scenes, real rendered frames, pixel inspection.
// A feature is marked complete ONLY when its rendered frames pass the check.
import fs from 'node:fs';
import path from 'node:path';
import { shotKeys } from '../camera/cameraEngine.js';
import { poseCharacter, rigQualityCheck } from '../rig/characterRig.js';
import { facialQualityCheck } from '../rig/facial.js';
import { handQualityCheck } from '../rig/hands.js';
import { cameraQualityCheck } from '../camera/cameraEngine.js';
import { verifyConsistency } from '../core/characters.js';
import { composeFrame } from '../render/softwareRenderer.js';
import { hsl } from '../core/util.js';

// QA must exercise 2- and 3-character scenes even when the sample script has
// only one named character: derive extra, visually distinct ensemble designs.
function qaDesigns(plan, count) {
  const out = plan.designs.slice();
  let i = 1;
  while (out.length < count) {
    const src = plan.designs[(out.length - 1) % plan.designs.length];
    const clone = JSON.parse(JSON.stringify(src));
    const hue = (src.colorIdentity.hue + 70 * i) % 360;
    clone.id = `${src.id}-qa${i}`; clone.name = `${src.name} ${i + 1}`;
    clone.seed = (src.seed + i * 104729) >>> 0;
    clone.colorIdentity = { ...src.colorIdentity, hue, accentHue: (hue + 150) % 360 };
    clone.costume = { main: hsl(hue, 0.5, 0.32), trim: hsl((hue + 50) % 360, 0.55, 0.62), shadow: hsl(hue, 0.4, 0.16) };
    clone.clothing.primaryHue = hue;
    clone.consistencyHash = (src.consistencyHash + i * 7919) >>> 0;
    out.push(clone); i++;
  }
  return out;
}
function meanColor(data, w, h, box) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(box.y0 * h); y < Math.ceil(box.y1 * h); y += 3)
    for (let x = Math.floor(box.x0 * w); x < Math.ceil(box.x1 * w); x += 3) {
      const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

export const TEST_SCENES = [
  { id: 1, name: 'Character idle', action: 'idle', expression: 'neutral', gesture: 'rest', checks: ['breathing', 'blink'] },
  { id: 2, name: 'Character walking', action: 'walk', expression: 'neutral', gesture: 'rest', checks: ['foot-contact', 'arm-swing', 'weight-transfer'] },
  { id: 3, name: 'Character running', action: 'run', expression: 'excited', gesture: 'fist', checks: ['lean', 'bounce', 'arm-swing'] },
  { id: 4, name: 'Character blinking', action: 'idle', expression: 'neutral', gesture: 'rest', checks: ['blink'] },
  { id: 5, name: 'Character looking around', action: 'look-at', expression: 'curious', gesture: 'rest', checks: ['pupils', 'head-turn'] },
  { id: 6, name: 'Facial expressions', action: 'react', expression: 'surprised', gesture: 'open-palm', checks: ['expressions', 'brows', 'mouth'] },
  { id: 7, name: 'Hand gestures', action: 'point', expression: 'curious', gesture: 'point', checks: ['hands', 'finger-articulation'] },
  { id: 8, name: 'Finger articulation', action: 'hold', expression: 'neutral', gesture: 'counting', checks: ['finger-articulation'] },
  { id: 9, name: 'Two-character interactions', action: 'interact', expression: 'happy', gesture: 'two-hand', characters: 2, checks: ['interaction', 'eye-contact'] },
  { id: 10, name: 'Multi-character scenes', action: 'walk', expression: 'curious', gesture: 'wave', characters: 3, checks: ['no-clipping', 'consistency'] },
  { id: 11, name: 'Cinematic camera movements', action: 'walk', expression: 'neutral', gesture: 'rest', camera: 'orbit', checks: ['camera-move', 'smooth'] },
  { id: 12, name: 'Different lighting conditions', action: 'idle', expression: 'neutral', gesture: 'rest', lighting: 'moonlight', checks: ['lighting', 'palette'] },
  { id: 13, name: 'Different colour palettes', action: 'idle', expression: 'neutral', gesture: 'rest', paletteShift: 140, checks: ['palette', 'consistency'] },
  { id: 14, name: 'Comic-book visual effects', action: 'react', expression: 'surprised', gesture: 'open-palm', intensity: 0.95, checks: ['halftone', 'ink', 'fx'] },
  { id: 15, name: 'Complete animated sequence', action: 'walk', expression: 'happy', gesture: 'wave', checks: ['all'] },
];

function regionStats(data, w, h, box) {
  let sum = 0, sum2 = 0, n = 0;
  const x0 = Math.max(0, Math.floor(box.x0 * w)), x1 = Math.min(w, Math.ceil(box.x1 * w));
  const y0 = Math.max(0, Math.floor(box.y0 * h)), y1 = Math.min(h, Math.ceil(box.y1 * h));
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * w + x) * 4, l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += l; sum2 += l * l; n++;
  }
  return { mean: n ? sum / n : 0, variance: n ? sum2 / n - (sum / n) ** 2 : 0 };
}
function frameDiff(a, b) { let s = 0; for (let i = 0; i < a.length; i += 16) s += Math.abs(a[i] - b[i]); return s / Math.max(1, a.length / 16); }

export async function runVisualQA(plan, opts = {}) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const outDir = path.resolve(opts.outDir || 'out/qa');
  fs.mkdirSync(outDir, { recursive: true });
  const W = opts.width || 270, H = opts.height || 480;
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
  const sheet = createCanvas(W * 5, H * 3), sctx = sheet.getContext('2d');
  const report = { generated: new Date().toISOString(), resolution: [W, H], scenes: [], issues: [], fixes: [], passed: 0, total: TEST_SCENES.length };
  const baseShot = plan.shots[0];
  const design = plan.designs[0];

  for (const test of TEST_SCENES) {
    const shot = JSON.parse(JSON.stringify(baseShot));
    shot.a = 0; shot.b = 90;
    shot.camera = { type: test.camera || 'dolly-in', keys: shotKeys(test.camera || 'dolly-in', test.id * 91) };
    const designs = qaDesigns(plan, test.characters || 1);
    shot.characters = designs.slice(0, test.characters || 1).map((d, i) => ({
      id: d.id, x: [-1.5, 0, 1.5][i] ?? 0, action: test.action, expression: test.expression,
      gesture: test.gesture, gaze: { target: i ? 'other' : 'camera', x: i ? 0.5 : 0, y: 0 }, intensity: test.intensity ?? 0.6,
    }));
    for (const d of designs) if (!shot.characterColors[d.id]) shot.characterColors[d.id] = {
      main: d.costume.main, trim: d.costume.trim, shadow: d.costume.shadow,
      skin: d.face.skinTone, hair: d.hair.color, ink: d.colorIdentity.ink,
    };
    if (test.lighting) shot.light = { ...shot.light, condition: test.lighting, color: '#8ea9d8', ambient: 0.2, intensity: 0.6, fogDensity: 0.5 };
    if (test.paletteShift) {
      const shift = (hex, d) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return '#' + [r, g, b].map((v, i) => Math.round(Math.min(255, v + [d, -d / 2, d / 3][i])).toString(16).padStart(2, '0')).join(''); };
      shot.palette = { ...shot.palette, skyTop: shift(shot.palette.skyTop, test.paletteShift), skyHorizon: shift(shot.palette.skyHorizon, test.paletteShift), accent: shift(shot.palette.accent, test.paletteShift) };
    }
    const miniPlan = { ...plan, designs, shots: [shot], meta: { ...plan.meta, totalFrames: 90 } };
    const frames = [], images = [];
    for (const f of [0, 22, 45, 67, 89]) {
      const stats = composeFrame(ctx, miniPlan, f, W, H, { quality: 'low' });
      const data = ctx.getImageData(0, 0, W, H).data;
      frames.push(stats); images.push(new Uint8ClampedArray(data));
    }
    const diffs = images.slice(1).map((im, i) => frameDiff(images[i], im));
    const faceVar = regionStats(images[2], W, H, { x0: 0.25, y0: 0.12, x1: 0.75, y1: 0.48 }).variance;
    const handVar = regionStats(images[2], W, H, { x0: 0.05, y0: 0.42, x1: 0.95, y1: 0.80 }).variance;
    const luma = meanColor(images[2], W, H, { x0: 0, y0: 0, x1: 1, y1: 1 });
    const sky = meanColor(images[2], W, H, { x0: 0, y0: 0.02, x1: 1, y1: 0.22 });
    const meanLuma = 0.299 * luma[0] + 0.587 * luma[1] + 0.114 * luma[2];
    const headPositions = frames.map((s) => s.characters.map((c) => `${c.head.x},${c.head.y}`).join('|'));
    const separations = frames.flatMap((s) => {
      const xs = s.characters.map((c) => c.x).sort((a, b) => a - b);
      return xs.slice(1).map((v, i) => v - xs[i]);
    });
    const charWidth = Math.max(...frames.flatMap((s) => s.characters.map((c) => 62 * c.scale)));
    const eyeOpens = frames.map((s) => s.characters[0]?.eyeOpen ?? 1);
    const fingerSets = new Set(frames.map((s) => (s.characters[0]?.fingers || []).join(',')));
    const poses = Array.from({ length: 180 }, (_, f) => f).map((f) => poseCharacter(design, { frame: f, action: test.action, expression: test.expression, gesture: test.gesture, gaze: { x: 0.3, y: 0 }, intensity: 0.6 }));
    const rig = rigQualityCheck(poses), face = facialQualityCheck(poses.map((p) => p.face)), hands = handQualityCheck(poses.map((p) => ({ ...p.hands.R, fingers: p.fingers.R, side: 'R' })));
    const cam = cameraQualityCheck([shot]);
    const consistency = verifyConsistency(plan.designs, plan.scenes);
    const checks = {
      'frames-change': Math.max(...diffs) > 0.8,
      'character-motion': new Set(headPositions).size > 1,
      'character-count': frames.every((s) => s.characters.length === (test.characters || 1)),
      'face-not-static': Math.max(...eyeOpens) - Math.min(...eyeOpens) > 0.08 || face.ok,
      'hands-not-frozen': fingerSets.size > 1 && hands.ok,
      'joints-ok': rig.ok,
      'camera-ok': cam.ok,
      'palette-ok': /^#[0-9a-f]{6}$/i.test(shot.palette.skyTop) && shot.palette.hue !== undefined,
      'consistency-ok': consistency.ok,
      'no-clipping': frames.every((s) => s.characters.every((c) => c.head.y > 0 && c.head.y < H && c.x > -W && c.x < W * 2)),
      'no-overlap': separations.length === 0 || separations.every((d) => d > charWidth * 0.85),
      'image-has-detail': faceVar > 30 && handVar > 30,
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const entry = { id: test.id, name: test.name, checks, failed, frameDiffs: diffs.map((d) => +d.toFixed(2)),
      meanLuma: +meanLuma.toFixed(2), skyRGB: sky.map((v) => +v.toFixed(1)), characters: test.characters || 1,
      faceVariance: +faceVar.toFixed(1), handVariance: +handVar.toFixed(1),
      rigIssues: rig.issues, faceIssues: face.issues, handIssues: hands.issues, cameraIssues: cam.issues };
    report.scenes.push(entry);
    if (failed.length) { report.issues.push({ scene: test.name, problems: failed, details: entry }); }
    else report.passed++;
    // Contact sheet tile: pick a frame where that test's effect is visible.
    const sheetFrame = test.id === 14 ? 56 : 45;
    composeFrame(ctx, miniPlan, sheetFrame, W, H, { quality: 'low' });
    const col = (test.id - 1) % 5, row = Math.floor((test.id - 1) / 5);
    sctx.drawImage(canvas, col * W, row * H);
    sctx.strokeStyle = '#141018'; sctx.lineWidth = 3; sctx.strokeRect(col * W + 1, row * H + 1, W - 2, H - 2);
  }
  // Cross-scene checks: lighting and palette must be visibly different.
  const byId = (id) => report.scenes.find((s) => s.id === id);
  const rgbDist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const cross = {
    'lighting-varies': Math.abs(byId(12).meanLuma - byId(1).meanLuma) > 8,
    'palette-varies': rgbDist(byId(13).skyRGB, byId(1).skyRGB) > 30,
  };
  for (const [id, key] of [[12, 'lighting-varies'], [13, 'palette-varies']]) {
    const s = byId(id); s.checks[key] = cross[key];
    if (!cross[key] && !s.failed.includes(key)) {
      s.failed.push(key); report.passed -= 1;
      report.issues.push({ scene: s.name, problems: [key], details: s });
    }
  }
  // Suggested fixes for anything still failing (never silently mark as complete).
  const FIX_HINT = {
    'character-motion': 'check body pose phase and joint angles in rig/body.js',
    'character-count': 'generate enough distinct designs in QA',
    'lighting-varies': 'apply scene light tint in art/sceneArt.js paintLighting()',
    'palette-varies': 'check SceneColorDirector scene-specific hue shifts',
    'frames-change': 'increase animation amplitude / check frame timing',
    'face-not-static': 'enable blink schedule and pupil drift in rig/facial.js',
    'hands-not-frozen': 'enable per-finger articulation in rig/hands.js',
    'joints-ok': 'check FK lengths in rig/characterRig.js',
    'camera-ok': 'add purposeful keys in camera/cameraEngine.js',
    'palette-ok': 'check SceneColorDirector colour output',
    'consistency-ok': 'keep costume hue fixed across scenes',
    'no-clipping': 'adjust character x/y or camera framing',
    'no-overlap': 'increase character x spacing in core/scenePlan.js',
    'image-has-detail': 'add crosshatch / halftone texture density',
  };
  report.fixes = report.issues.flatMap((issue) => issue.problems.map((problem) => ({
    scene: issue.scene, problem, fix: FIX_HINT[problem] || 'inspect the rendered frame',
  })));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'contact-sheet.png'), sheet.toBuffer('image/png'));
  return { ...report, contactSheet: path.join(outDir, 'contact-sheet.png'), reportFile: path.join(outDir, 'report.json'), outDir };
}
