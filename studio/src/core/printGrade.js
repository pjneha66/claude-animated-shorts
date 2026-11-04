// Small, validated .cube LUT reader; trilinear RGB interpolation.
export function parseCube(text) {
  let size=0;const data=[];
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.replace(/#.*/, '').trim();if(!line)continue;
    if(line.startsWith('LUT_3D_SIZE')) {size=Number(line.split(/\s+/)[1]);continue;}
    if(/^(TITLE|DOMAIN_MIN|DOMAIN_MAX)/.test(line)) {
      if(line.startsWith('DOMAIN_') && !/DOMAIN_MIN\s+0\s+0\s+0$|DOMAIN_MAX\s+1\s+1\s+1$/.test(line)) throw new Error('Only unit-domain LUTs supported');
      continue;
    }
    const values=line.split(/\s+/).map(Number);if(values.length!==3||values.some(v=>!Number.isFinite(v)))throw new Error('Invalid cube row');data.push(values);
  }
  if(!Number.isInteger(size)||size<2||size>65||data.length!==size**3)throw new Error('Invalid LUT size/data');
  return {size,data};
}
export function lutRGB(rgb,lut) {
  const pos=rgb.map(v=>Math.max(0,Math.min(1,v))*(lut.size-1)), lo=pos.map(Math.floor), hi=lo.map(v=>Math.min(lut.size-1,v+1));
  const result=[0,0,0];
  for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++) {
    const flags=[r,g,b], index=flags.map((v,i)=>v?hi[i]:lo[i]);
    const weight=flags.reduce((a,v,i)=>a*(v?pos[i]-lo[i]:1-pos[i]+lo[i]),1);
    const c=lut.data[index[0]+lut.size*index[1]+lut.size**2*index[2]];
    c.forEach((v,i)=>result[i]+=v*weight);
  }
  return result;
}
export function gradePixels(image, grade={}) {
  const {data}=image, contrast=grade.contrast??1, saturation=grade.saturation??1, ink=grade.inkLimit??1;
  for(let i=0;i<data.length;i+=4) {
    let c=[data[i],data[i+1],data[i+2]].map(v=>v/255);
    if(grade.lut)c=lutRGB(c,grade.lut);
    const l=c[0]*.299+c[1]*.587+c[2]*.114;
    c=c.map((v,j)=>Math.max(0,Math.min(1,((l+(v-l)*saturation)-.5)*contrast+.5+(grade.paperTint?.[j]??0))));
    const total=c.reduce((a,v)=>a+1-v,0), limit=ink*3;
    if(total>limit)c=c.map(v=>1-(1-v)*limit/total);
    c.forEach((v,j)=>data[i+j]=Math.round(v*255));
  }
  return image;
}
export function validateGrade(grade) {
  const allowed=new Set(['contrast','saturation','inkLimit','paperTint','lut']);
  for(const key of Object.keys(grade))if(!allowed.has(key))throw new Error(`Unknown grade key: ${key}`);
  for(const [k,min,max] of [['contrast',0,3],['saturation',0,3],['inkLimit',0,1]])
    if(grade[k]!==undefined&&(!Number.isFinite(grade[k])||grade[k]<min||grade[k]>max))throw new Error(`Invalid grade ${k}`);
  if(grade.paperTint!==undefined&&(!Array.isArray(grade.paperTint)||grade.paperTint.length!==3||grade.paperTint.some(v=>!Number.isFinite(v)||Math.abs(v)>.5)))throw new Error('Invalid paperTint');
  if(grade.lut!==undefined&&(typeof grade.lut!=='object'||!grade.lut.size||grade.lut.data?.length!==grade.lut.size**3))throw new Error('Invalid parsed LUT');
  return grade;
}
