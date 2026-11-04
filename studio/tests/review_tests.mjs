import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeScript } from '../src/core/scriptAnalysis.js';
import { designCharacters } from '../src/core/characters.js';
import { SceneColorDirector } from '../src/core/colorDirector.js';
import { buildPlan } from '../src/core/scenePlan.js';
import { timingExport, cameraReport, applyColorOverrides, dataDiff } from '../src/core/reviewExports.js';
import { renderFramePNG } from '../src/render/softwareRenderer.js';
for (const genre of ['horror', 'romance', 'fantasy', 'action', 'mystery']) {
  const a = analyzeScript(fs.readFileSync(`presets/scripts/${genre}.txt`, 'utf8'));
  const p = buildPlan(a, designCharacters(a), new SceneColorDirector(a), { seconds: 20 });
  const timing = timingExport(p);
  assert(p.designs.length >= 2, genre);
  assert.equal(timing.shots[0].in, 0);
  assert.equal(timing.shots.at(-1).out, p.meta.totalFrames);
  timing.shots.forEach((s, i) => { assert(s.out > s.in); if (i) assert.equal(s.in, timing.shots[i-1].out); });
  for (const s of p.shots) {
    assert.equal(s.characters[0].gaze.target, s.characters[1].id);
    assert.equal(s.characters[1].gaze.target, s.characters[0].id);
    assert(s.characters[1].x - s.characters[0].x >= 2.6);
  }
  assert.match(cameraReport(p), /Purpose:/);
  assert.throws(() => applyColorOverrides(p, { palette: { typo: '#ffffff' } }));
  assert.throws(() => applyColorOverrides(p, { shots: { 99999: {} } }));
  const before = structuredClone(p.shots[0].palette);
  applyColorOverrides(p, { shots: { 1: { paper: '#aabbcc' } } });
  assert.equal(p.shots[0].palette.paper, '#aabbcc');
  assert.equal(dataDiff(before, p.shots[0].palette).length, 1);
  const shot = p.shots.find(s => s.interaction) || p.shots[0];
  for (const f of [shot.a + 1, Math.floor((shot.a + shot.b) / 2), shot.b - 1])
    await renderFramePNG(p, f, `out/review/${genre}-${f}.png`, { width: 270, height: 480, quality: 'low' });
  console.log(`PASS ${genre}: timing, reciprocal gaze, layout, overrides, rendered review frames`);
}
