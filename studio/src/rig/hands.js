// Hand + individual finger animation. Every hand is derived from the wrist joint
// so it stays attached to the arm. Finger curls are per-finger, per-segment.
import { clamp, lerp, DEG, easeInOut } from '../core/util.js';

export const GESTURES = ['rest', 'point', 'wave', 'open-palm', 'fist', 'counting', 'hold', 'two-hand', 'emotional'];

const CURLS = {
  rest:       [0.18, 0.26, 0.30, 0.34, 0.40],
  point:      [0.92, 0.10, 0.95, 0.95, 0.92],
  wave:       [0.05, 0.05, 0.05, 0.05, 0.05],
  'open-palm':[0.02, 0.02, 0.02, 0.02, 0.02],
  fist:       [0.95, 0.95, 0.95, 0.95, 0.95],
  counting:   [0.10, 0.10, 0.10, 0.92, 0.92],
  hold:       [0.62, 0.62, 0.62, 0.62, 0.62],
  'two-hand': [0.30, 0.25, 0.22, 0.26, 0.32],
  emotional:  [0.45, 0.38, 0.35, 0.42, 0.50],
};

export function handPose(gesture = 'rest', frame = 0, side = 'R', seed = 1) {
  const base = CURLS[gesture] || CURLS.rest;
  const t = frame;
  let curls = base.slice();
  let spread = 0.32, wrist = 0, palmOpen = gesture === 'open-palm' || gesture === 'wave';
  switch (gesture) {
    case 'wave': wrist = Math.sin(t * 0.28) * 22; spread = 0.45; break;
    case 'point': spread = 0.10; wrist = -8; break;
    case 'counting': curls = curls.map((v, i) => i < (Math.floor(t / 18) % 4) ? 0.06 : v); break;
    case 'hold': wrist = Math.sin(t * 0.05) * 4; break;
    case 'emotional': wrist = Math.sin(t * 0.12) * 10; spread = 0.38; break;
    case 'fist': spread = 0.08; break;
    default: break;
  }
  // Finger articulation: never frozen; subtle independent motion per finger.
  curls = curls.map((v, i) => clamp(v + Math.sin(t * 0.09 + i * 1.3 + seed) * (gesture === 'fist' ? 0.02 : 0.045), 0, 1));
  return { gesture, curls, spread, wrist, palmOpen, side };
}

// Returns polylines (3 segments each) for the 5 fingers, in character space.
export function fingerPolylines(palm, wristAngleDeg, hand, scale = 1) {
  const a = (wristAngleDeg + hand.wrist) * DEG;
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const perp = { x: -dir.y, y: dir.x };
  const seg = [6.2, 5.0, 3.8].map((v) => v * scale);
  const out = [];
  for (let i = 0; i < 5; i++) {
    const offset = (i - 2) * 3.6 * hand.spread * scale;
    const base = { x: palm.x + perp.x * offset, y: palm.y + perp.y * offset };
    const pts = [base];
    let ang = a + (i - 2) * 0.09 + (i === 0 ? -0.5 : 0);
    for (let j = 0; j < 3; j++) {
      const curl = hand.curls[i];
      ang += curl * (j === 0 ? 0.55 : 0.75) * (i === 0 ? -1 : 1);
      const p = pts[pts.length - 1];
      pts.push({ x: p.x + Math.cos(ang) * seg[j], y: p.y + Math.sin(ang) * seg[j] });
    }
    out.push({ name: `finger${i}`, points: pts, curl: hand.curls[i] });
  }
  return out;
}

export function handQualityCheck(poses) {
  const issues = [];
  for (const p of poses) {
    if (!p || !p.fingers || p.fingers.length !== 5) issues.push(`${p.side || '?'}: missing fingers`);
    else if (p.fingers.every((f) => Math.abs(f.curl - (poses[0]?.fingers?.[0]?.curl || 0)) < 1e-9)) issues.push(`${p.side}: frozen fingers`);
  }
  return { ok: issues.length === 0, issues };
}
