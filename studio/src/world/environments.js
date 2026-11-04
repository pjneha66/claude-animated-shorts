// 3D environment specification, consumed by ThreeWorld.jsx (Three.js) and by
// the Canvas2D software fallback. Layers have real depths for parallax / DOF.
import { mulberry32, clamp, mixHex, hsl } from '../core/util.js';

export const ENV_KINDS = ['city', 'forest', 'sea', 'interior', 'mountain', 'battlefield'];

export function environmentFor(scene, palette, analysis) {
  const kind = scene.environment || analysis.location?.primary || 'city';
  const idx = scene.index || 0;
  const rnd = mulberry32((analysis.seed || 1) + idx * 1013);
  const layers = [];
  const depthSets = { far: [42, 70], mid: [16, 32], near: [5, 12], foreground: [1.2, 3.5] };
  const counts = { far: 14, mid: 10, near: 6, foreground: 3 };
  for (const [name, [z0, z1]] of Object.entries(depthSets)) {
    layers.push({
      name, zRange: [z0, z1], count: counts[name],
      color: name === 'far' ? mixHex(palette.skyHorizon, palette.building[2], 0.5)
        : name === 'mid' ? palette.building[0]
          : name === 'near' ? palette.building[1] : palette.ground,
      parallax: name === 'far' ? 0.06 : name === 'mid' ? 0.22 : name === 'near' ? 0.55 : 1.05,
      shapes: name === 'foreground' ? ['prop'] : name === 'far' ? ['silhouette'] : ['block', 'column', 'arch'],
      seed: Math.floor(rnd() * 1e6),
    });
  }
  const propKinds = {
    city: ['lamp', 'crate', 'sign', 'railing', 'window'],
    forest: ['trunk', 'bush', 'rock', 'branch'],
    sea: ['post', 'barrel', 'rope', 'boat'],
    interior: ['chair', 'table', 'candle', 'door'],
    mountain: ['rock', 'pine', 'ledge'],
    battlefield: ['banner', 'cart', 'fence', 'drum'],
  };
  return {
    kind, seed: Math.floor(rnd() * 1e6),
    sky: { top: palette.skyTop, horizon: palette.skyHorizon, fog: palette.fog },
    ground: { color: palette.ground, y: 0, texture: 'crosshatch' },
    layers,
    props: propKinds[kind] || propKinds.city,
    fog: { color: palette.fog, near: 18 + palette.haze * 6, far: 60 + (1 - palette.haze) * 80, density: palette.haze },
    dof: { enabled: palette.haze > 0.25 || scene.intensity > 0.65, focusZ: 8, cInf: 10 + palette.haze * 6 },
    lighting: scene.light,
    atmospheric: { dust: clamp(palette.haze * 0.8, 0, 1), haze: palette.haze, particles: Math.round(18 + palette.haze * 40) },
    parallax: true, perspective: true, shadows: true,
    paletteRef: palette.id,
  };
}
