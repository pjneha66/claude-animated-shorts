import assert from 'node:assert/strict';
import {parseCube,lutRGB,gradePixels} from '../src/core/printGrade.js';
import {solveArm} from '../src/rig/interaction.js';
import {temporalMetrics} from '../src/qa/temporalQA.js';
const rows=[];for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++)rows.push(`${r} ${g} ${b}`);
const lut=parseCube('LUT_3D_SIZE 2\n'+rows.join('\n'));
for(const rgb of [[0,0,0],[1,1,1],[.2,.7,.4]])lutRGB(rgb,lut).forEach((v,i)=>assert(Math.abs(v-rgb[i])<1e-8));
assert.throws(()=>parseCube('LUT_3D_SIZE 2\n0 0 0'));
const pixel={data:new Uint8ClampedArray([40,100,180,255])};gradePixels(pixel,{lut});assert.deepEqual([...pixel.data],[40,100,180,255]);
for(const target of [{x:30,y:20},{x:100,y:-10},{x:0,y:0}]){
 const p=solveArm({x:0,y:0},target);assert(Math.abs(Math.hypot(p.elbow.x,p.elbow.y)-26)<1e-6);
 assert(Math.abs(Math.hypot(p.wrist.x-p.elbow.x,p.wrist.y-p.elbow.y)-24)<1e-6);
}
const sequence=Array.from({length:10},(_,f)=>({frame:f,shot:1,joints:[{x:f,y:0}],luma:100}));
assert(temporalMetrics(sequence).ok);const glitch=structuredClone(sequence);glitch[5].joints[0].x+=100;glitch[5].luma=255;
const clipped=structuredClone(sequence);clipped[3].clipped=true;clipped[4].overlap=50;assert(temporalMetrics(clipped).issues.some(i=>i.kind==='body-clipping'));assert(temporalMetrics(clipped).issues.some(i=>i.kind==='body-overlap'));
const result=temporalMetrics(glitch);assert(result.issues.some(i=>i.kind==='flicker'));assert(result.issues.some(i=>i.kind==='jitter'));assert(result.issues.some(i=>i.kind==='pose-discontinuity'));
console.log('PASS identity LUT, malformed LUT, pixel grade, IK lengths, temporal injected failures');
