import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {analyzeScript} from '../src/core/scriptAnalysis.js';import {designCharacters} from '../src/core/characters.js';import {SceneColorDirector} from '../src/core/colorDirector.js';import {buildPlan} from '../src/core/scenePlan.js';import {renderRemotion} from '../src/render/remotionRenderer.js';
process.chdir(new URL('..',import.meta.url).pathname);
const a=analyzeScript(fs.readFileSync('presets/scripts/romance.txt','utf8'));
const p=buildPlan(a,designCharacters(a),new SceneColorDirector(a),{seconds:5});
const s=p.shots.find(s=>s.interaction)||p.shots[0];s.a=-36;s.b=36;p.shots=[s];p.meta.totalFrames=3;
const file='src/generatedPlan.js',original=fs.readFileSync(file);
try {
 const r=await renderRemotion(p,{quality:'low',forceQuality:true,out:path.resolve('out/chrome-scene-smoke.mp4')});
 assert.equal(r.framesRendered,3);assert(r.verification.ok);assert.equal(r.backend,'chrome');
 fs.writeFileSync('out/chrome-scene-smoke.json',JSON.stringify({...r,scope:'Three consecutive interaction frames, not full-film Chrome acceptance'},null,2));console.log(r);
} finally {fs.writeFileSync(file,original);}
