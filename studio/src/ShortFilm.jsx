import { PrintGrade } from './world/PrintGrade.jsx';
// Remotion composition: Three.js 3D environment + comic-book 2D character cards.
// Visual-only. There is no Audio component, no text overlay and no caption layer.
import React, { useMemo, useLayoutEffect, useEffect } from 'react';
import { AbsoluteFill, useCurrentFrame, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import { useThree as useFiberThree } from '@react-three/fiber';
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';
import { cameraForShot } from './camera/cameraEngine.js';
import { shotAt } from './core/shotUtils.js';
import { poseCharacter } from './rig/characterRig.js';
import { drawCharacter } from './art/characterArt.js';
import { ThreeWorld } from './world/ThreeWorld.jsx';
import plan from './generatedPlan.js';

function SettledFrame({ frame }) {
  const { advance } = useFiberThree();
  useLayoutEffect(() => {
    const handle = delayRender('Settle postprocessing passes');
    let cancelled = false;
    const first = setTimeout(() => {
      advance(performance.now());
      setTimeout(() => {
        if (!cancelled) advance(performance.now());
        continueRender(handle);
      });
    });
    return () => { cancelled = true; clearTimeout(first); continueRender(handle); };
  }, [frame, advance]);
  return null;
}

function CameraRig({ view }) {
  const { camera } = useFiberThree();
  useLayoutEffect(() => {
    camera.position.set(...view.pos);
    camera.fov = view.fov;
    camera.up.set(Math.sin(view.roll * Math.PI / 180), Math.cos(view.roll * Math.PI / 180), 0);
    camera.lookAt(...view.look);
    camera.updateProjectionMatrix();
  }, [camera, view]);
  return null;
}

function CharacterCard({ design, ch, shot, frame, palette }) {
  const close = shot.camera.type.includes('close-up');
  const s = (close ? 4.8 : 4.4) * (design.proportions?.height ? 3.5 / design.proportions.height : 1);
  const factor = (shot.interaction ? .65 : 1) * (shot.characters.length > 2 ? .65 : 1);
  const partner = shot.characters.find(c => c.id === ch.gaze?.target);
  const reach = partner && ch.action === 'interact' ? { x: (partner.x-ch.x)*factor*.5/(s*.62/600*3.4), y: -32 } : undefined;
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 1000;
    const ctx = c.getContext('2d');
    const costume = shot.characterColors?.[design.id] || {
      main: design.costume.main, trim: design.costume.trim, shadow: design.costume.shadow,
      skin: design.face.skinTone, hair: design.hair.color, ink: design.colorIdentity.ink,
    };
    const pose = poseCharacter(design, { frame: frame - shot.a, action: ch.action, expression: ch.expression,
      gesture: ch.gesture, gaze: ch.gaze, reach, intensity: ch.intensity || 0.5 });
    drawCharacter(ctx, { design, pose, costume, palette, x: 300, y: 620, scale: 3.4 });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [design, ch, shot, frame, palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[close ? 0 : ch.x * factor, .337 * s, 0]} scale={[s * 0.62, s, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function ComicOverlay({ palette }) {
  // Halftone dots + paper grain as a local CSS overlay (no external assets).
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.16,
      backgroundImage: `radial-gradient(${palette.halftone} 1px, transparent 1.4px)`,
      backgroundSize: '7px 7px' }} />
  );
}

export const ShortFilm = ({ plan: p = plan }) => {
  const frame = useCurrentFrame();
  const shot = shotAt(p, frame);
  const view = cameraForShot(shot, frame);
  const palette = shot.palette;
  const dof = shot.env.dof;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      <ThreeCanvas width={p.meta.width} height={p.meta.height} camera={{ position: view.pos, fov: view.fov, near: 0.1, far: 400 }}>
        <CameraRig view={view} />
        <ambientLight intensity={shot.light.ambient} color={shot.light.fillColor} />
        <directionalLight position={shot.light.dir.map((v) => v * 12)} intensity={shot.light.intensity} color={shot.light.color} castShadow />
        <fog attach="fog" args={[shot.env.fog.color, shot.env.fog.near, shot.env.fog.far]} />
        <ThreeWorld env={shot.env} palette={palette} frame={frame} />
        {(shot.camera.type.includes('close-up') || shot.camera.type === 'reaction-shot' ? shot.characters.slice(0,1) : shot.characters).map((ch) => {
          const design = p.designs.find((d) => d.id === ch.id);
          return design ? <CharacterCard key={ch.id} design={design} ch={ch} shot={shot} frame={frame} palette={palette} /> : null;
        })}
        {(dof.enabled || shot.grade) && <EffectComposer>{dof.enabled && <DepthOfField target={view.look} focalLength={0.012} bokehScale={0.7} />}{shot.grade && <PrintGrade grade={shot.grade} />}</EffectComposer>}
        <SettledFrame frame={frame} />
      </ThreeCanvas>
      <ComicOverlay palette={palette} />
    </AbsoluteFill>
  );
};
