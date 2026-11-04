// Comic-book VFX specifications. Drawing lives in art/sceneArt.js; Three.js
// shaders read the same params so both renderers share the visual language.
import { mulberry32, clamp } from '../core/util.js';

export const FX_KINDS = [
  'halftone', 'ink-outline', 'crosshatch', 'speed-lines', 'impact-burst',
  'illustrated-smoke', 'dust-particles', 'motion-streaks', 'ink-splash',
  'paper-texture', 'comic-transition', 'dramatic-shadows',
];

export function fxForScene(scene, quality = 'medium') {
  const idx = scene.index || 0;
  const rnd = mulberry32((scene.seed || 1) + idx * 313);
  const intensity = clamp(scene.intensity ?? 0.5, 0, 1);
  const fx = [
    { kind: 'halftone', density: quality === 'low' ? 12 : quality === 'medium' ? 8 : 5, intensity: 0.34 + intensity * 0.2, seed: Math.floor(rnd() * 1e6) },
    { kind: 'ink-outline', width: 4 + intensity * 2.5, intensity: 1, seed: idx },
    { kind: 'crosshatch', spacing: quality === 'low' ? 14 : 8, intensity: 0.3 + intensity * 0.25, seed: Math.floor(rnd() * 1e6) },
    { kind: 'paper-texture', intensity: 0.45, seed: idx },
    { kind: 'dramatic-shadows', intensity: 0.4 + scene.light?.shadowSoftness * 0.4, seed: idx },
  ];
  if (intensity > 0.55) fx.push({ kind: 'speed-lines', count: Math.round(12 + intensity * 26), intensity: intensity * 0.5, seed: Math.floor(rnd() * 1e6) });
  if (intensity > 0.72) fx.push({ kind: 'impact-burst', at: 0.62, intensity, seed: Math.floor(rnd() * 1e6) });
  if (intensity > 0.80) fx.push({ kind: 'ink-splash', count: 8, intensity: 0.5, seed: Math.floor(rnd() * 1e6) });
  if (scene.light?.fogDensity > 0.3) fx.push({ kind: 'illustrated-smoke', intensity: scene.light.fogDensity, seed: Math.floor(rnd() * 1e6) });
  fx.push({ kind: 'dust-particles', count: Math.round(14 + (quality === 'low' ? 0 : 26)), intensity: 0.5, seed: Math.floor(rnd() * 1e6) });
  fx.push({ kind: 'motion-streaks', count: Math.round(6 + intensity * 14), intensity: intensity * 0.35, seed: Math.floor(rnd() * 1e6) });
  if (idx > 0) fx.push({ kind: 'comic-transition', at: 0, intensity: 0.6, seed: idx });
  return fx;
}

// Shared shader fragment for the Three.js post overlay (halftone + paper + ink).
export const COMIC_POST_FRAGMENT = `
uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float uDot; uniform float uPaper; uniform vec3 uInk;
varying vec2 vUv;
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = luma(c);
  vec2 grid = fract(vUv * resolution / uDot);
  float dotMask = smoothstep(0.42, 0.36, length(grid - 0.5));
  float shadow = (1.0 - l) * dotMask * 0.35;
  c = mix(c, uInk, shadow);
  float grain = fract(sin(dot(vUv * resolution, vec2(12.9898,78.233))) * 43758.5453);
  c += (grain - 0.5) * uPaper * 0.06;
  gl_FragColor = vec4(c, 1.0);
}`;
