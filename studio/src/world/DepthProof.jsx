import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame } from 'remotion';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { ThreeWorld } from './ThreeWorld.jsx';
import plan from '../generatedPlan.js';
function ProbeCamera({x}) {
 const {camera}=useThree();useLayoutEffect(()=>{camera.position.set(x,3,12);camera.lookAt(x,3,0);camera.updateProjectionMatrix();},[camera,x]);return null;
}
export function DepthProof() {
 const frame=useCurrentFrame(), x=frame===0?-1:frame===1?1:0, shot=plan.shots[0];
 return <ThreeCanvas width={480} height={320} camera={{position:[x,3,12],fov:45,near:.1,far:400}}>
   <ProbeCamera x={x}/><ambientLight intensity={1}/><group position={[0,-12,0]}><ThreeWorld env={shot.env} palette={shot.palette} frame={frame}/></group>
   <mesh position={[-2,3,0]}><boxGeometry args={[.6,.6,.6]}/><meshBasicMaterial color="#ff0000" toneMapped={false}/></mesh>
   <mesh position={[3,3,-12]}><boxGeometry args={[1.2,1.2,1.2]}/><meshBasicMaterial color="#0000ff" toneMapped={false}/></mesh>
   <mesh position={[0,3,-3]}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#ff00ff" toneMapped={false}/></mesh>
   <mesh position={[0,3,0]}><boxGeometry args={[1.2,1.2,1.2]}/><meshBasicMaterial color="#00ff00" toneMapped={false}/></mesh>
 </ThreeCanvas>;
}
