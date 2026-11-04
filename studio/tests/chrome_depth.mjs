import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {createCanvas,loadImage} from '@napi-rs/canvas';
process.chdir(new URL('..', import.meta.url).pathname);
const out='out/chrome-depth';fs.mkdirSync(out,{recursive:true});
if(!process.env.CHROME_PATH)throw new Error('Set CHROME_PATH to an installed local Chrome. No download or fallback allowed.');
const frames=[];
for(let f=0;f<3;f++) {
 const file=path.join(out,`${f}.png`);
 const r=spawnSync(process.execPath,['node_modules/@remotion/cli/remotion-cli.js','still','src/index.js','DepthProof',file,`--frame=${f}`,`--browser-executable=${process.env.CHROME_PATH}`,`--gl=${process.env.CHROME_GL||'angle'}`,'--log=error'],{stdio:'inherit'});
 if(r.status!==0)throw new Error(`Chrome frame ${f} failed`);
 const canvas=createCanvas(480,320),ctx=canvas.getContext('2d');ctx.drawImage(await loadImage(file),0,0);const d=ctx.getImageData(0,0,480,320).data;
 const centers={};for(const color of ['red','blue','green','magenta']){
  let count=0,sum=0;for(let i=0;i<d.length;i+=4){const [r,g,b]=d.slice(i,i+3);const hit=color==='red'?r>200&&g<60&&b<60:color==='blue'?b>200&&r<60&&g<60:color==='green'?g>200&&r<60&&b<60:r>200&&b>200&&g<60;if(hit){count++;sum+=(i/4)%480;}}
  centers[color]={count,x:count?sum/count:null};
 }frames.push(centers);
}
const nearShift=Math.abs(frames[1].red.x-frames[0].red.x),farShift=Math.abs(frames[1].blue.x-frames[0].blue.x);
assert(frames.every(f=>f.red.count>30&&f.blue.count>30),'depth markers missing / occluded');
assert(nearShift>farShift*1.5,`No perspective parallax: ${nearShift}/${farShift}`);
assert(frames[2].green.count>500,'foreground marker absent');assert.equal(frames[2].magenta.count,0,'rear object leaked through foreground');
const report={ok:true,backend:'Chromium WebGL',gl:process.env.CHROME_GL||'angle',metalVerified:false,nearShift,farShift,frames,checks:['perspective parallax at two depths','front geometry occludes rear geometry'],scope:'Probe geometry integrated with ThreeWorld; not a Metal or full-film visual acceptance test'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(report);
