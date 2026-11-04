import fs from 'node:fs';
import path from 'node:path';
import { poseCharacter } from '../rig/characterRig.js';
import { composeFrame } from '../render/softwareRenderer.js';

export function temporalMetrics(samples, limits = {}) {
  const { maxJointStep = 18, maxLumaJump = 45, maxAcceleration = 18 } = limits;
  const issues = [], trace = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i-1], b = samples[i];
    if (a.shot !== b.shot) continue; // cuts are intentional discontinuities
    const step = Math.max(...b.joints.map((p,j) => Math.hypot(p.x-a.joints[j].x, p.y-a.joints[j].y)));
    trace.push({ frame: b.frame, shot: b.shot, maxJointStep: step, lumaJump: Math.abs(b.luma-a.luma) });
    if (!Number.isFinite(step) || step > maxJointStep) issues.push({ frame: b.frame, kind: 'pose-discontinuity', value: step });
    if (Math.abs(b.luma-a.luma) > maxLumaJump) issues.push({ frame: b.frame, kind: 'flicker', value: Math.abs(b.luma-a.luma) });
    if (i > 1 && samples[i-2].shot === b.shot) {
      const prev = samples[i-2];
      const acceleration = Math.max(...b.joints.map((p,j) => Math.hypot(p.x - 2*a.joints[j].x + prev.joints[j].x, p.y - 2*a.joints[j].y + prev.joints[j].y)));
      trace[trace.length-1].acceleration = acceleration;
      if (acceleration > maxAcceleration) issues.push({ frame: b.frame, kind: 'jitter', value: acceleration });
    }
    if (b.clipped) issues.push({ frame: b.frame, kind: 'body-clipping' });
    if (b.overlap) issues.push({ frame: b.frame, kind: 'body-overlap', value: b.overlap });
    if (b.invalidPixels) issues.push({ frame: b.frame, kind: 'invalid-pixels' });
  }
  return { ok: !issues.length, issues, trace, frames: samples.length, limits: { maxJointStep, maxLumaJump, maxAcceleration } };
}
export async function runTemporalQA(plan, { outDir = 'out/temporal', baseline } = {}) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  fs.mkdirSync(outDir, { recursive: true });
  const w=180, h=320, canvas=createCanvas(w,h), ctx=canvas.getContext('2d');
  const actions=['idle','walk','run','interact','react'];
  const sheet=createCanvas(w*8,h*actions.length), sc=sheet.getContext('2d');
  const samples=[], rows=[];
  for (let row=0; row<actions.length; row++) {
    const action=actions[row], shot=structuredClone(plan.shots.find(s=>s.characters.length>1) || plan.shots[0]);
    shot.a=0;shot.b=180;shot.fx=shot.fx.filter(f=>!['comic-transition','panel-shutter','radial-iris','impact-burst'].includes(f.kind));
    shot.characters.forEach((c,i)=>{c.action=action;c.gesture=action==='interact'?'two-hand':'rest'; c.gaze={x:i?-0.65:0.65,y:0};});
    const mini={...plan,shots:[shot]};
    const rowSamples=[];
    for(let f=0;f<180;f++) {
      const stats = composeFrame(ctx,mini,f,w,h,{quality:'low'});
      const rgba=ctx.getImageData(0,0,w,h).data;
      let luma=0;for(let i=0;i<rgba.length;i+=16) luma+=(rgba[i]+rgba[i+1]+rgba[i+2])/3;
      luma/=rgba.length/16;
      const joints=shot.characters.flatMap(c=>Object.values(poseCharacter(plan.designs.find(d=>d.id===c.id),{...c,frame:f}).points));
      const bounds=stats.characters.filter(c=>!c.intentionalCrop).map(c=>c.bodyBounds);
      const clipped=bounds.some(b=>b.x0<0||b.x1>w||b.y0<0||b.y1>h);
      let overlap=0;for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++) {
        const a=bounds[i],b=bounds[j];overlap+=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
      }
      const sample={frame:f,shot:action,joints,luma,clipped,overlap};rowSamples.push(sample);samples.push(sample);
      if(f%24===0) sc.drawImage(canvas,(f/24)*w,row*h);
    }
    rows.push({action,...temporalMetrics(rowSamples)});
  }
  const file=path.join(outDir,'consecutive-review.png');fs.writeFileSync(file,sheet.toBuffer('image/png'));
  let regression={status:'not-requested'};
  if(baseline) {
    const before=await loadImage(baseline), combined=createCanvas(sheet.width*2,sheet.height), cc=combined.getContext('2d');
    cc.drawImage(before,0,0,sheet.width,sheet.height);cc.drawImage(sheet,sheet.width,0);
    fs.writeFileSync(path.join(outDir,'before-after.png'),combined.toBuffer('image/png'));
    regression={status:'sheet-created',baseline};
  }
  const report={...temporalMetrics(samples),rows,regression,scope:'180 consecutive frames per action; rig-space jitter and pose plus rendered mean-luma flicker. Includes projected torso/head clipping and box overlap (hands excluded). Not semantic artifact detection or silhouette intersection proof.'};
  fs.writeFileSync(path.join(outDir,'frame-trace.json'),JSON.stringify(report.trace,null,2));
  fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
  return report;
}
