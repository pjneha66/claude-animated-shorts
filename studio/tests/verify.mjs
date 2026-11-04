// Fail fast. All subprocesses are local; no missing stage is treated as success.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { verifySilentMp4 } from '../src/render/renderSpec.js';
import { findFfmpeg } from '../src/render/softwareRenderer.js';
const stages = [['src/cli/studio.mjs', 'doctor'], ['src/cli/studio.mjs', 'rules', '--check'],
  ['tests/run_tests.mjs'], ['tests/review_tests.mjs'], ['tests/polish_tests.mjs'], ['src/cli/studio.mjs','temporal','--script','presets/scripts/romance.txt'], ['src/cli/studio.mjs', 'qa', '--quality', 'low']];
if (process.env.VERIFY_CHROME === '1') {
  if (!process.env.CHROME_PATH) throw new Error('VERIFY_CHROME requires CHROME_PATH');
  stages.push(['tests/chrome_depth.mjs'], ['tests/chrome_smoke.mjs']);
}
if (process.env.VERIFY_MAC === '1') {
  const files = JSON.parse(process.env.MAC_QA_FRAMES || '[]');
  if (!Array.isArray(files) || !files.length || !files.every(f => typeof f === 'string' && fs.existsSync(f))) throw new Error('MAC_QA_FRAMES must name existing original frame PNGs');
  stages.push(['src/review/macQA.mjs', ...files]);
}
for (const args of stages) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) process.exit(r.status || 1);
}
const file = process.env.VERIFY_MP4 || 'deliverables/final-silent-short.mp4';
const audit = verifySilentMp4(findFfmpeg(), file);
console.log({ file, audit });
if (!audit.ok) process.exit(1);
