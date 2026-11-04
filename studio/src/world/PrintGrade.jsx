import React, { useMemo, useEffect } from 'react';
import { Effect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
const shader = `
uniform sampler2D printLut;
uniform float cubeSize;
uniform float hasLut;
uniform float printContrast;
uniform float printSaturation;
uniform float inkLimit;
uniform vec3 paperTint;
vec3 lookupPrint(vec3 p) {
  float x = p.x + cubeSize * p.y;
  return texture2D(printLut, vec2((x + 0.5)/(cubeSize*cubeSize), (p.z+0.5)/cubeSize)).rgb;
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = clamp(inputColor.rgb,0.0,1.0);
  if(hasLut > 0.5) {
    vec3 p=c*(cubeSize-1.0), a=floor(p), b=min(a+1.0,vec3(cubeSize-1.0)), t=fract(p);
    vec3 c00=mix(lookupPrint(vec3(a.x,a.y,a.z)),lookupPrint(vec3(b.x,a.y,a.z)),t.x);
    vec3 c10=mix(lookupPrint(vec3(a.x,b.y,a.z)),lookupPrint(vec3(b.x,b.y,a.z)),t.x);
    vec3 c01=mix(lookupPrint(vec3(a.x,a.y,b.z)),lookupPrint(vec3(b.x,a.y,b.z)),t.x);
    vec3 c11=mix(lookupPrint(vec3(a.x,b.y,b.z)),lookupPrint(vec3(b.x,b.y,b.z)),t.x);
    c=mix(mix(c00,c10,t.y),mix(c01,c11,t.y),t.z);
  }
  float l=dot(c,vec3(.299,.587,.114));
  c=clamp((mix(vec3(l),c,printSaturation)-.5)*printContrast+.5+paperTint,0.0,1.0);
  float total=3.0-c.r-c.g-c.b;
  if(total>inkLimit*3.0)c=1.0-(1.0-c)*(inkLimit*3.0)/total;
  outputColor=vec4(c,inputColor.a);
}`;
export function PrintGrade({ grade }) {
  const effect=useMemo(()=>{
    const lut=grade.lut, size=lut?.size||2;
    const data=new Uint8Array(size**3*4);
    for(let i=0;i<size**3;i++) {const c=lut?.data[i]||[0,0,0];c.forEach((v,j)=>data[i*4+j]=Math.round(Math.max(0,Math.min(1,v))*255));data[i*4+3]=255;}
    const texture=new THREE.DataTexture(data,size*size,size,THREE.RGBAFormat);
    texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
    const e=new Effect('PrintGrade',shader,{blendFunction: BlendFunction.NORMAL, uniforms:new Map([
      ['printLut',new THREE.Uniform(texture)],['cubeSize',new THREE.Uniform(size)],['hasLut',new THREE.Uniform(lut?1:0)],
      ['printContrast',new THREE.Uniform(grade.contrast??1)],['printSaturation',new THREE.Uniform(grade.saturation??1)],
      ['inkLimit',new THREE.Uniform(grade.inkLimit??1)],['paperTint',new THREE.Uniform(new THREE.Vector3(...(grade.paperTint||[0,0,0])))],
    ])});e.printTexture=texture;return e;
  },[grade]);
  useEffect(()=>()=>{effect.printTexture.dispose();effect.dispose();},[effect]);
  return <primitive object={effect} dispose={null} />;
}
