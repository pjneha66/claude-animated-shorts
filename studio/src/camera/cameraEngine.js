// Purposeful cinematic camera choreography. Every move has a storytelling role;
// there is no random drift. All interpolation is smootherstep (controlled accel).
import { clamp, lerp, smootherstep, mulberry32 } from '../core/util.js';

export const SHOT_TYPES = [
  'dolly-in', 'dolly-out', 'push-in', 'pull-back', 'tracking', 'pan', 'tilt',
  'crane', 'orbit', 'over-the-shoulder', 'close-up', 'extreme-close-up',
  'wide-establishing', 'low-angle', 'high-angle', 'character-follow', 'dramatic-reveal', 'reaction-shot',
];

const FRAMING = {
  'wide-establishing': { z: 20, y: 4.2, fov: 52, lookY: 1.6, purpose: 'establish place and scale' },
  'dramatic-reveal': { z: 15, y: 3.0, fov: 46, lookY: 1.8, purpose: 'reveal the subject with a move' },
  'dolly-in': { z: 12, y: 2.2, fov: 44, lookY: 1.7, purpose: 'draw attention to a reaction' },
  'push-in': { z: 10, y: 2.0, fov: 40, lookY: 1.8, purpose: 'increase emotional intensity' },
  'dolly-out': { z: 9, y: 2.0, fov: 42, lookY: 1.7, purpose: 'release tension / show context' },
  'pull-back': { z: 8, y: 2.0, fov: 44, lookY: 1.7, purpose: 'end a beat by widening' },
  tracking: { z: 9, y: 2.0, fov: 46, lookY: 1.6, purpose: 'follow an action laterally' },
  pan: { z: 11, y: 2.4, fov: 46, lookY: 1.7, purpose: 'scan a space or reveal' },
  tilt: { z: 11, y: 2.0, fov: 44, lookY: 1.7, purpose: 'reveal vertical scale' },
  crane: { z: 12, y: 2.0, fov: 46, lookY: 1.6, purpose: 'rise above the scene' },
  orbit: { z: 9, y: 2.2, fov: 44, lookY: 1.7, purpose: 'circle a character for emphasis' },
  'over-the-shoulder': { z: 6.5, y: 2.1, fov: 40, lookY: 1.8, purpose: 'show a relationship / point of view' },
  'close-up': { z: 5.5, y: 1.9, fov: 38, lookY: 1.9, purpose: 'facial expression' },
  'extreme-close-up': { z: 3.6, y: 1.9, fov: 34, lookY: 1.9, purpose: 'eyes / detail' },
  'low-angle': { z: 8, y: 0.5, fov: 48, lookY: 2.4, purpose: 'power or looming threat' },
  'high-angle': { z: 9, y: 6.0, fov: 48, lookY: 1.2, purpose: 'vulnerability or overview' },
  'character-follow': { z: 8, y: 2.0, fov: 44, lookY: 1.7, purpose: 'stay with the moving character' },
  'reaction-shot': { z: 5.2, y: 1.9, fov: 38, lookY: 1.9, purpose: 'show the emotional response' },
};

export function shotKeys(type, seed = 1) {
  const rnd = mulberry32(seed);
  const f = FRAMING[type] || FRAMING['close-up'];
  const dir = rnd() > 0.5 ? 1 : -1;
  const x0 = dir * (0.4 + rnd() * 0.8);
  const base = (over = {}) => ({ pos: [x0, f.y, f.z], look: [0, f.lookY, 0], fov: f.fov, roll: 0, ...over });
  const start = base(), end = base();
  switch (type) {
    case 'dolly-in': case 'push-in': end.pos[2] = f.z * 0.62; end.fov = f.fov - 3; break;
    case 'dolly-out': case 'pull-back': start.pos[2] = f.z * 0.66; end.pos[2] = f.z * 1.18; break;
    case 'tracking': case 'character-follow': start.pos[0] = -2.6; end.pos[0] = 2.6; end.look[0] = 1.2; break;
    case 'pan': start.look[0] = -3.2; end.look[0] = 3.2; break;
    case 'tilt': start.look[1] = 0.4; end.look[1] = 3.4; break;
    case 'crane': start.pos[1] = 1.4; end.pos[1] = 6.2; end.look[1] = 1.2; break;
    case 'orbit': start.pos[0] = -4.2; start.pos[2] = f.z * 0.8; end.pos[0] = 4.2; end.pos[2] = f.z * 0.8; break;
    case 'low-angle': start.pos[1] = 0.35; end.pos[1] = 0.8; end.look[1] = 2.7; break;
    case 'high-angle': start.pos[1] = 5.2; end.pos[1] = 6.4; break;
    case 'dramatic-reveal': start.look[0] = -3.6; start.pos[2] = f.z * 1.15; end.look[0] = 0; end.pos[2] = f.z * 0.78; break;
    case 'wide-establishing': end.pos[2] = f.z * 0.88; end.pos[1] = f.y + 0.4; break;
    case 'over-the-shoulder': start.pos[0] = -1.5; end.pos[0] = -1.0; end.look[0] = 0.7; break;
    case 'extreme-close-up': end.pos[2] = f.z * 0.86; break;
    case 'reaction-shot': end.pos[2] = f.z * 0.92; break;
    default: end.pos[2] = f.z * 0.94;
  }
  // A subtle 4° dramatic roll only where it supports composition.
  if (['low-angle', 'dramatic-reveal', 'orbit'].includes(type)) { start.roll = dir * 1.2; end.roll = dir * 4.0; }
  return [{ t: 0, ...start }, { t: 1, ...end }];
}

export function cameraForShot(shot, frame) {
  const keys = shot.camera?.keys || shotKeys(shot.camera?.type || 'close-up', shot.id * 977);
  const t = clamp((frame - shot.a) / Math.max(1, shot.b - shot.a - 1), 0, 1);
  let k0 = keys[0], k1 = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { k0 = keys[i]; k1 = keys[i + 1]; break; }
  const local = clamp((t - k0.t) / Math.max(1e-6, k1.t - k0.t), 0, 1);
  const e = smootherstep(local);
  const v3 = (a, b) => a.map((v, i) => lerp(v, b[i], e));
  return {
    pos: v3(k0.pos, k1.pos), look: v3(k0.look, k1.look),
    fov: lerp(k0.fov, k1.fov, e), roll: lerp(k0.roll || 0, k1.roll || 0, e),
    t, purpose: (FRAMING[shot.camera?.type] || {}).purpose || 'story beat',
    framing: shot.camera?.type || 'close-up',
  };
}

export function cameraQualityCheck(shots) {
  const issues = [];
  for (const s of shots) {
    const a = cameraForShot(s, s.a), b = cameraForShot(s, s.b - 1);
    // Pan/tilt moves the look target rather than the body: count both.
    const moved = Math.hypot(...a.pos.map((v, i) => v - b.pos[i]))
      + Math.abs(a.fov - b.fov)
      + 0.5 * Math.hypot(...a.look.map((v, i) => v - b.look[i]));
    if (moved < 0.02 && s.camera?.type !== 'close-up' && s.camera?.type !== 'reaction-shot')
      issues.push(`shot ${s.id}: static camera with no storytelling purpose`);
    if ((Math.abs(a.roll) + Math.abs(b.roll)) / 2 > 6) issues.push(`shot ${s.id}: excessive roll`);
  }
  return { ok: issues.length === 0, issues };
}
