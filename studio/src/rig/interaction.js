import { clamp, smootherstep } from '../core/util.js';
// Analytic two-bone IK. Fixed lengths, deterministic elbow branch; unreachable
// targets are clamped rather than stretching limbs.
export function solveArm(shoulder, target, upper = 26, lower = 24, bend = 1) {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
  const distance = Math.hypot(dx, dy);
  const d = clamp(distance, Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
  const theta = Math.atan2(dy, dx);
  const alpha = Math.acos(clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
  const elbow = { x: shoulder.x + upper * Math.cos(theta + bend * alpha), y: shoulder.y + upper * Math.sin(theta + bend * alpha) };
  const wrist = { x: shoulder.x + Math.cos(theta) * d, y: shoulder.y + Math.sin(theta) * d };
  return { elbow, wrist, residual: Math.max(0, distance - d) };
}
export function reachPose(points, angles, direction, frame, scale, reach) {
  // Anticipation -> curved reach -> settle; no modulo resets inside a shot.
  const t = smootherstep(clamp((frame - 6) / 30, 0, 1));
  for (const side of ['L', 'R']) {
    const shoulder = points[`shoulder${side}`], rest = points[`wrist${side}`];
    const goal = { x: reach?.x ?? direction * 52 * scale, y: (reach?.y ?? -32 * scale) + (side === 'L' ? -7 : 7) * scale };
    const target = { x: rest.x + (goal.x - rest.x) * t, y: rest.y + (goal.y - rest.y) * t - Math.sin(t * Math.PI) * 8 };
    const result = solveArm(shoulder, target, 26 * scale, 33 * scale, direction);
    points[`elbow${side}`] = result.elbow;
    const palm = result.wrist;
    points[`wrist${side}`] = { x: result.elbow.x + (palm.x-result.elbow.x)*24/33, y: result.elbow.y + (palm.y-result.elbow.y)*24/33 };
    const a = Math.atan2(result.wrist.y - result.elbow.y, result.wrist.x - result.elbow.x);
    angles[`wrist${side}`] = a * 180 / Math.PI;
    points[`palm${side}`] = palm;
  }
}
