// Real verification, not a checklist: core logic, rig, camera, colour, plan,
// visual-only enforcement, and an actual locally encoded silent MP4.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashString, mulberry32, hsl, clamp } from '../src/core/util.js';
import { analyzeScript } from '../src/core/scriptAnalysis.js';
import { designCharacters, verifyConsistency, EXPRESSION_SET, GESTURE_SET } from '../src/core/characters.js';
import { SceneColorDirector } from '../src/core/colorDirector.js';
import { buildPlan, ASPECTS } from '../src/core/scenePlan.js';
import { RULES, assertVisualOnly, outputContract } from '../src/core/rules.js';
import { SHOT_TYPES, cameraForShot, cameraQualityCheck } from '../src/camera/cameraEngine.js';
import { LIGHTING } from '../src/world/lighting.js';
import { FX_KINDS } from '../src/fx/comicFx.js';
import { poseCharacter, rigQualityCheck, JOINTS } from '../src/rig/characterRig.js';
import { facialQualityCheck } from '../src/rig/facial.js';
import { handQualityCheck } from '../src/rig/hands.js';
import { QUALITY, ffmpegArgs, verifySilentMp4 } from '../src/render/renderSpec.js';
import { renderSoftware } from '../src/render/softwareRenderer.js';
import { runVisualQA } from '../src/qa/visualQA.js';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = (name) => fs.readFileSync(path.join(STUDIO, 'presets', 'scripts', `${name}.txt`), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); fail++; }
}

function build(name = 'bridge', opts = {}) {
  const analysis = analyzeScript(script(name));
  const designs = designCharacters(analysis);
  const director = new SceneColorDirector(analysis);
  const plan = buildPlan(analysis, designs, director, { seconds: 60, fps: 30, aspect: '9:16', quality: 'medium', ...opts });
  return { analysis, designs, director, plan };
}

console.log('LOCAL CINEMATIC VISUAL ANIMATION STUDIO — TEST SUITE');
await test('utilities are deterministic and colour helpers produce hex', () => {
  assert.equal(hashString('bridge'), hashString('bridge'));
  const a = mulberry32(42), b = mulberry32(42);
  assert.equal(a(), b()); assert.equal(a(), b());
  assert.match(hsl(210, 0.5, 0.5), /^#[0-9a-f]{6}$/i);
  assert.equal(clamp(12, 0, 1), 1);
});

await test('script analysis: 3 genres, 3 casts, beats and visual actions', () => {
  const a = analyzeScript(script('bridge')), b = analyzeScript(script('lighthouse')), c = analyzeScript(script('garden'));
  assert.equal(a.genre.primary, 'historical'); assert.equal(b.genre.primary, 'horror'); assert.equal(c.genre.primary, 'romance');
  assert.ok(a.beats.length >= 4); assert.ok(a.actions.length > 0);
  assert.deepEqual(c.characters.map((x) => x.name), ['Elise', 'Tomas']);
  assert.equal(a.characters[0].name, 'Soldier');
});

await test('character design: stable hash, unique traits, fixed costume hue', () => {
  const { designs, plan } = build();
  const again = designCharacters(plan.analysis);
  assert.deepEqual(designs.map((d) => d.consistencyHash), again.map((d) => d.consistencyHash));
  assert.ok(designs[0].face.shape && designs[0].hair.style && designs[0].clothing.type);
  const c = verifyConsistency(designs, plan.scenes);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.ok(EXPRESSION_SET.length >= 11 && GESTURE_SET.length >= 9);
});

await test('SceneColorDirector: distinct story hues + per-scene palettes, no fixed preset', () => {
  const hues = ['bridge', 'lighthouse', 'garden'].map((n) => build(n).director.storyHue);
  assert.equal(new Set(hues).size, 3, `story hues: ${hues}`);
  const { director, plan } = build('lighthouse');
  const p = plan.scenes.map((s) => s.palette);
  assert.ok(new Set(p.map((x) => x.skyTop)).size > 1, 'scene skies must vary');
  for (const x of p) { assert.match(x.ink, /^#[0-9a-f]{6}$/i); assert.ok(x.hue >= 0 && x.hue < 360); }
  assert.ok(director.report().note.includes('soft priors'));
});

await test('plan: silent contract, 60s @30fps, contiguous shots, valid camera types', () => {
  const { plan } = build();
  assert.equal(outputContract(plan), true);
  assert.equal(plan.meta.totalFrames, 1800);
  assert.equal(plan.meta.width, 1080); assert.equal(plan.meta.height, 1920);
  assert.equal(plan.meta.silent, true); assert.equal(plan.meta.audio, false);
  let cursor = 0;
  for (const s of plan.shots) { assert.equal(s.a, cursor, `gap before shot ${s.id}`); assert.ok(s.b > s.a); cursor = s.b; }
  assert.equal(cursor, plan.meta.totalFrames);
  for (const s of plan.shots) assert.ok(SHOT_TYPES.includes(s.camera.type), s.camera.type);
  assert.equal(ASPECTS['16:9'][0], 1920);
  const wide = build('garden', { aspect: '16:9' }).plan;
  assert.equal(wide.meta.width, 1920); assert.equal(wide.meta.height, 1080);
  assert.equal(build('garden', { fps: 60 }).plan.meta.fps, 60);
});

await test('rig: 27 joints, 5 fingers/hand, moving hands, blinking, no broken joints', () => {
  const { designs } = build();
  const d = designs[0];
  assert.ok(JOINTS.length >= 25, `joints: ${JOINTS.length}`);
  const poses = Array.from({ length: 45 }, (_, f) => poseCharacter(d, { frame: f, action: f < 15 ? 'idle' : f < 30 ? 'walk' : 'run', expression: 'curious', gesture: 'wave', gaze: { x: 0.4, y: 0 }, intensity: 0.6 }));
  const rig = rigQualityCheck(poses); assert.equal(rig.ok, true, rig.issues.join('; '));
  const face = facialQualityCheck(poses.map((p) => p.face)); assert.equal(face.ok, true, face.issues.join('; '));
  const hands = handQualityCheck(poses.map((p) => ({ ...p.hands.R, fingers: p.fingers.R, side: 'R' })));
  assert.equal(hands.ok, true, hands.issues.join('; '));
  assert.ok(poses.every((p) => p.fingers.L.length === 5 && p.fingers.R.length === 5));
  assert.ok(new Set(poses.map((p) => p.face.expression)).size >= 1);
});

await test('camera: purposeful moves, smooth framing, quality check passes', () => {
  const { plan } = build();
  const c = cameraQualityCheck(plan.shots); assert.equal(c.ok, true, c.issues.join('; '));
  for (const s of plan.shots.slice(0, 5)) {
    const a = cameraForShot(s, s.a), b = cameraForShot(s, s.b - 1);
    assert.ok(Number.isFinite(a.pos[2]) && Number.isFinite(b.fov));
    assert.ok(a.purpose.length > 5);
  }
});

await test('lighting + VFX + quality presets cover the required sets', () => {
  for (const k of ['daylight', 'sunset', 'sunrise', 'moonlight', 'night', 'candlelight', 'firelight', 'interior', 'spotlights']) assert.ok(LIGHTING[k], k);
  for (const k of ['halftone', 'ink-outline', 'crosshatch', 'speed-lines', 'impact-burst', 'illustrated-smoke', 'dust-particles', 'motion-streaks', 'ink-splash', 'paper-texture', 'comic-transition', 'dramatic-shadows']) assert.ok(FX_KINDS.includes(k), k);
  assert.deepEqual(Object.keys(QUALITY), ['low', 'medium', 'high']);
  assert.ok(ffmpegArgs({ width: 270, height: 480, fps: 30, preset: 'ultrafast', crf: 26, pixelFormat: 'yuv420p' }, 'x.mp4').includes('-an'));
});

await test('visual-only rules: 21 rules, detector catches violations, output contract', () => {
  assert.equal(RULES.length, 21);
  assert.throws(() => assertVisualOnly('const x = new AudioContext();'), /Visual-only violation/);
  assert.equal(assertVisualOnly('const silent = true; // no audio here'), true);
  assert.equal(outputContract({ meta: { silent: true, audio: false, subtitles: false, captions: false } }), true);
  assert.equal(outputContract({ meta: { silent: true, audio: true, subtitles: false, captions: false } }), false);
});

await test('visual QA: 15 rendered test scenes all pass', async () => {
  const { plan } = build('bridge', { seconds: 6 });
  const r = await runVisualQA(plan, { outDir: path.join(STUDIO, 'out', 'test-qa'), width: 135, height: 240 });
  assert.equal(r.total, 15);
  assert.equal(r.passed, 15, JSON.stringify(r.issues));
  assert.ok(fs.existsSync(r.contactSheet));
});

await test('end-to-end: locally encoded 5s silent H.264 MP4', async () => {
  const { plan } = build('bridge', { seconds: 5, quality: 'low' });
  const out = path.join(STUDIO, 'out', 'tests', 'silent-proof.mp4');
  const r = await renderSoftware(plan, { quality: 'low', backend: 'software', out, recoverable: false, hardware: { ramBytes: 16e9, gpu: { verified: false } } });
  assert.equal(r.verification.ok, true, JSON.stringify(r.verification));
  assert.equal(r.verification.audio, false);
  assert.equal(r.verification.subStream, false);
  assert.equal(r.framesRendered, plan.meta.totalFrames);
  assert.ok(fs.statSync(out).size > 10000);
  // Independent re-check with the same local verification tool.
  assert.equal(verifySilentMp4(process.env.FFMPEG_BIN || r.ffmpeg || (await import('../src/render/softwareRenderer.js')).findFfmpeg(), out).ok, true);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
