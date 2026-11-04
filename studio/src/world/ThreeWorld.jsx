// Three.js environment geometry: real depth, layered parallax, foreground props,
// ink edges, atmospheric dust, ground shadows. Palette comes from SceneColorDirector.
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';

export function ThreeWorld({ env, palette, frame }) {
  const blocks = useMemo(() => {
    const out = [];
    for (const layer of env.layers) {
      const rnd = mulberry32(layer.seed);
      for (let i = 0; i < layer.count; i++) {
        const z = -(layer.zRange[0] + (layer.zRange[1] - layer.zRange[0]) * rnd());
        const w = 2 + rnd() * (layer.name === 'far' ? 5 : 3.2);
        const h = 3 + rnd() * (layer.name === 'far' ? 9 : 6);
        const d = layer.name === 'foreground' ? .8 : 2 + rnd() * 3;
        let x = (i - layer.count / 2) * (layer.name === 'far' ? 7 : 4.6) + (rnd() - 0.5) * 2;
        // Keep the acting corridor clear; foreground occluders frame the sides.
        if (layer.name === 'foreground') x = Math.sign(x || 1) * (6 + Math.abs(x));
        out.push({ key: `${layer.name}-${i}`, x, y: h / 2, z, w, h, d,
          color: layer.name === 'far' ? palette.building[2] : layer.name === 'mid' ? palette.building[i % 3] : layer.color,
          ink: layer.name !== 'far', parallax: layer.parallax });
      }
    }
    return out;
  }, [env, palette]);

  const dust = useMemo(() => {
    const rnd = mulberry32(env.seed);
    const arr = new Float32Array(env.atmospheric.particles * 3);
    for (let i = 0; i < env.atmospheric.particles; i++) {
      arr[i * 3] = (rnd() - 0.5) * 40; arr[i * 3 + 1] = rnd() * 12; arr[i * 3 + 2] = -rnd() * 30;
    }
    return arr;
  }, [env]);

  return (
    <group>
      <color attach="background" args={[palette.skyTop]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      {blocks.map((b) => (
        <group key={b.key} position={[b.x, b.y, b.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} roughness={0.95} flatShading />
          </mesh>
          {b.ink && (
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(b.w, b.h, b.d)]} />
              <lineBasicMaterial color={palette.ink} linewidth={2} />
            </lineSegments>
          )}
        </group>
      ))}
      {env.atmospheric.dust > 0.25 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dust, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.08} color={palette.paper} transparent opacity={0.45} depthWrite={false} />
        </points>
      )}
    </group>
  );
}
