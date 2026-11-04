#!/usr/bin/env node
// Local cinematic VISUAL-ONLY animation studio CLI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeScript, enrichWithLocalAI } from '../core/scriptAnalysis.js';
import { designCharacters, characterSheetSpec } from '../core/characters.js';
import { SceneColorDirector } from '../core/colorDirector.js';
import { buildPlan } from '../core/scenePlan.js';
import { RULES, assertVisualOnly, outputContract } from '../core/rules.js';
import { detectHardware, detectLocalModels, doctorReport } from '../hardware/detectMac.js';
import { renderSoftware, renderFramePNG } from '../render/softwareRenderer.js';
import { renderRemotion } from '../render/remotionRenderer.js';
import { runVisualQA, TEST_SCENES } from '../qa/visualQA.js';
import { drawCharacterSheet } from '../art/characterArt.js';
import { slug } from '../core/util.js';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = path.resolve(STUDIO, '..');
const OUT = path.join(STUDIO, 'out');

function parseArgs(rest) {
  const out = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (rest[i + 1] && !rest[i + 1].startsWith('--')) { out[k] = rest[++i]; }
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}
const readScript = (p) => fs.readFileSync(path.resolve(STUDIO, p || 'presets/scripts/bridge.txt'), 'utf8');
const writeJSON = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); return file; };
const log = (o) => console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2));

async function makePlan(args) {
  const text = readScript(args._[0]);
  let analysis = analyzeScript(text, { title: args.title });
  if (args.ai || process.env.LOCAL_AI_URL) analysis = await enrichWithLocalAI(analysis, text);
  const designs = designCharacters(analysis);
  const director = new SceneColorDirector(analysis);
  const plan = buildPlan(analysis, designs, director, {
    seconds: Number(args.seconds) || 60, fps: Number(args.fps) || 30,
    aspect: args.aspect || '9:16', quality: args.quality || 'medium',
    width: Number(args.width) || undefined, height: Number(args.height) || undefined,
  });
  return { analysis, designs, director, plan };
}

function sourceScan() {
  const dirs = ['core', 'art', 'rig', 'camera', 'world', 'fx', 'render', 'qa', 'hardware'];
  const files = [];
  for (const d of dirs) for (const f of fs.readdirSync(path.join(STUDIO, 'src', d))) if (f.endsWith('.js') && f !== 'rules.js') files.push(path.join(STUDIO, 'src', d, f));
  files.push(path.join(STUDIO, 'src', 'ShortFilm.jsx'), path.join(STUDIO, 'src', 'Root.jsx'), path.join(STUDIO, 'src', 'index.js'));
  const problems = [];
  for (const f of files) { try { assertVisualOnly(fs.readFileSync(f, 'utf8'), path.relative(REPO, f)); } catch (e) { problems.push(e.message); } }
  return { scanned: files.length, problems };
}

const HELP = `LOCAL CINEMATIC VISUAL ANIMATION STUDIO (visual-only, silent output)

  node src/cli/studio.mjs doctor                 hardware audit + local model detection
  node src/cli/studio.mjs rules [--check]       the 21 rules / enforce visual-only
  node src/cli/studio.mjs analyze <script>      script analysis JSON
  node src/cli/studio.mjs palette <script>      SceneColorDirector output
  node src/cli/studio.mjs design <script>       character reference sheets (PNG)
  node src/cli/studio.mjs plan <script>         full shot plan (JSON)
  node src/cli/studio.mjs frames <script>       representative stills (PNG)
  node src/cli/studio.mjs qa                   15 visual QA scenes + contact sheet
  node src/cli/studio.mjs render <script>      silent H.264 MP4 (local)
  node src/cli/studio.mjs all                  doctor + sheets + QA + short render

Options: --quality low|medium|high --backend software|chrome --seconds 60
         --aspect 9:16|16:9|1:1 --fps 30|60 --out file.mp4 --ai --resume
         --width 1080 --height 1920 --title "..." --no-recover

No audio, no subtitles, no captions, no text overlays are ever generated.`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  fs.mkdirSync(OUT, { recursive: true });
  switch (cmd) {
    case 'doctor': {
      const hw = detectHardware(); const models = await detectLocalModels();
      log({ ...doctorReport(hw, models), hardware: hw });
      break;
    }
    case 'rules': {
      const scan = sourceScan();
      log({ rules: RULES, visualOnlyScan: scan, outputContractExample: outputContract({ meta: { silent: true, audio: false, subtitles: false, captions: false } }) });
      if (args.check && scan.problems.length) process.exitCode = 1;
      break;
    }
    case 'analyze': {
      const text = readScript(args._[0]);
      let a = analyzeScript(text); if (args.ai) a = await enrichWithLocalAI(a, text);
      writeJSON(path.join(OUT, 'analysis.json'), a); log(a);
      break;
    }
    case 'palette': {
      const { analysis, director, plan } = await makePlan(args);
      const palettes = plan.scenes.map((s) => ({ scene: s.id, emotion: s.emotion, intensity: +s.intensity.toFixed(2), ...s.palette }));
      writeJSON(path.join(OUT, 'palette.json'), { report: director.report(), palettes });
      log({ report: director.report(), sceneCount: palettes.length, storyHue: director.storyHue,
        distinctHues: [...new Set(palettes.map((p) => p.hue))].length, file: 'out/palette.json' });
      break;
    }
    case 'design': {
      const { designs, director, plan } = await makePlan(args);
      const { createCanvas } = await import('@napi-rs/canvas');
      const sheets = [];
      for (const d of designs) {
        const canvas = createCanvas(900, 1200);
        const meta = drawCharacterSheet(canvas.getContext('2d'), d, director.forScene(plan.scenes[0]));
        const file = path.join(OUT, 'sheets', `${d.id}-reference-sheet.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, canvas.toBuffer('image/png'));
        sheets.push({ ...meta, spec: characterSheetSpec(d), file: path.relative(REPO, file) });
      }
      writeJSON(path.join(OUT, 'sheets', 'manifest.json'), sheets); log({ characters: designs.length, sheets });
      break;
    }
    case 'plan': {
      const { plan } = await makePlan(args);
      const file = writeJSON(path.join(OUT, 'plan.json'), plan);
      log({ file: path.relative(REPO, file), meta: plan.meta, scenes: plan.scenes.length, shots: plan.shots.length,
        characters: plan.designs.map((d) => ({ id: d.id, hash: d.consistencyHash })),
        shotTypes: [...new Set(plan.shots.map((s) => s.camera.type))] });
      break;
    }
    case 'frames': {
      const { plan } = await makePlan(args);
      const frames = [0, Math.round(plan.meta.totalFrames * 0.25), Math.round(plan.meta.totalFrames * 0.5), Math.round(plan.meta.totalFrames * 0.75), plan.meta.totalFrames - 1];
      const out = [];
      for (const f of frames) {
        const r = await renderFramePNG(plan, f, path.join(OUT, 'frames', `frame-${String(f).padStart(5, '0')}.png`), { quality: args.quality || 'medium', width: 540, height: 960 });
        out.push({ frame: f, file: path.relative(REPO, r.file), shot: r.stats.shotId, camera: r.stats.camera.framing });
      }
      log({ frames: out });
      break;
    }
    case 'qa': {
      const { plan } = await makePlan({ ...args, seconds: args.seconds || 20 });
      const r = await runVisualQA(plan, { outDir: path.join(OUT, 'qa'), width: 270, height: 480 });
      log({ passed: r.passed, total: r.total, issues: r.issues.map((i) => ({ scene: i.scene, problems: i.problems })),
        fixes: r.fixes, contactSheet: path.relative(REPO, r.contactSheet), report: path.relative(REPO, r.reportFile) });
      if (r.passed !== r.total) process.exitCode = 1;
      break;
    }
    case 'render': {
      const { plan } = await makePlan(args);
      const hw = detectHardware();
      const backend = args.backend || (hw.gpu.verified ? 'chrome' : 'software');
      const opts = { quality: args.quality || 'medium', backend, hardware: hw,
        forceQuality: !!args['force-quality'], seconds: args.seconds, out: args.out,
        resume: !!args.resume, recoverable: args['no-recover'] ? false : true,
        onProgress: (n, total) => { if (n % 300 === 0 || n === total) console.error(`  local frames ${n}/${total}`); } };
      if (backend === 'chrome' && !process.env.FORCE_CHROME) {
        console.error('Note: chrome backend needs Remotion + Three.js + local Chromium. Falling back to software if unavailable.');
        try { const r = await renderRemotion(plan, opts); log({ ...r, meta: plan.meta }); }
        catch (e) { console.error(`Chrome backend unavailable (${e.message.split('\n')[0]}); using local software renderer.`);
          const r = await renderSoftware(plan, { ...opts, backend: 'software' }); log({ ...r, fallback: true, meta: plan.meta }); }
      } else {
        const r = await renderSoftware(plan, { ...opts, backend: 'software' }); log({ ...r, meta: plan.meta });
      }
      break;
    }
    case 'all': {
      const hw = detectHardware(); log({ step: '1/5 doctor', ...doctorReport(hw, await detectLocalModels()) });
      const built = await makePlan({ ...args, seconds: args.seconds || 6 });
      log({ step: '2/5 plan', shots: built.plan.shots.length, scenes: built.plan.scenes.length });
      const { createCanvas } = await import('@napi-rs/canvas');
      const canvas = createCanvas(900, 1200);
      drawCharacterSheet(canvas.getContext('2d'), built.designs[0], built.director.forScene(built.plan.scenes[0]));
      fs.writeFileSync(path.join(OUT, 'sheets', `${built.designs[0].id}-reference-sheet.png`), canvas.toBuffer('image/png'));
      log({ step: '3/5 sheets', characters: built.designs.length });
      const qa = await runVisualQA(built.plan, { outDir: path.join(OUT, 'qa'), width: 270, height: 480 });
      log({ step: '4/5 qa', passed: qa.passed, total: qa.total, contactSheet: path.relative(REPO, qa.contactSheet) });
      const r = await renderSoftware(built.plan, { quality: args.quality || 'low', hardware: hw, backend: 'software',
        out: path.join(OUT, `studio-preview-${slug(built.plan.meta.title)}.mp4`), recoverable: false });
      log({ step: '5/5 render', out: path.relative(REPO, r.outPath), verification: r.verification, spec: r.spec });
      break;
    }
    default: log(HELP);
  }
}

main().catch((e) => { console.error('STUDIO ERROR:', e.stack || e.message); process.exitCode = 1; });
