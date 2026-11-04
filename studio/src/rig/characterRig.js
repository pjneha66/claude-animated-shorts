// Complete hierarchical character rig. HEAD / FACE / BODY / ARMS / HANDS / LEGS.
// Forward kinematics in 2D character space (canvas y grows downward).
import { DEG, clamp } from '../core/util.js';
import { bodyPose } from './body.js';
import { handPose, fingerPolylines } from './hands.js';
import { facialState } from './facial.js';

export const SKELETON = {
  pelvis:     { parent: null, x: 0, y: 0 },
  spine:      { parent: 'pelvis', len: 20, angle: -90 },
  chest:      { parent: 'spine', len: 22, angle: -90 },
  neck:       { parent: 'chest', len: 12, angle: -90 },
  head:       { parent: 'neck', len: 24, angle: -90 },
  shoulderL:  { parent: 'chest', len: 14, angle: 180 },
  shoulderR:  { parent: 'chest', len: 14, angle: 0 },
  elbowL:     { parent: 'shoulderL', len: 26, angle: 105 },
  elbowR:     { parent: 'shoulderR', len: 26, angle: 75 },
  wristL:     { parent: 'elbowL', len: 24, angle: 90 },
  wristR:     { parent: 'elbowR', len: 24, angle: 90 },
  palmL:      { parent: 'wristL', len: 9, angle: 90 },
  palmR:      { parent: 'wristR', len: 9, angle: 90 },
  hipL:       { parent: 'pelvis', len: 9, angle: 180 },
  hipR:       { parent: 'pelvis', len: 9, angle: 0 },
  kneeL:      { parent: 'hipL', len: 34, angle: 90 },
  kneeR:      { parent: 'hipR', len: 34, angle: 90 },
  ankleL:     { parent: 'kneeL', len: 30, angle: 90 },
  ankleR:     { parent: 'kneeR', len: 30, angle: 90 },
  footL:      { parent: 'ankleL', len: 16, angle: 0 },
  footR:      { parent: 'ankleR', len: 16, angle: 0 },
};
// Anatomical segment joints derived from the FK chain. They keep every part
// named in the rig spec (abdomen, upper arms, forearms, thighs, lower legs)
// addressable for animation and QA without changing the solved positions.
export const DERIVED_JOINTS = [
  ['abdomen', 'spine', 'chest'],
  ['upperArmL', 'shoulderL', 'elbowL'], ['upperArmR', 'shoulderR', 'elbowR'],
  ['forearmL', 'elbowL', 'wristL'], ['forearmR', 'elbowR', 'wristR'],
  ['thighL', 'hipL', 'kneeL'], ['thighR', 'hipR', 'kneeR'],
  ['lowerLegL', 'kneeL', 'ankleL'], ['lowerLegR', 'kneeR', 'ankleR'],
];
export const JOINTS = [...Object.keys(SKELETON), ...DERIVED_JOINTS.map((d) => d[0])];
export const RIG_PARTS = {
  head: ['head', 'neck'], face: ['eyes', 'pupils', 'eyelids', 'eyebrows', 'mouth', 'cheeks'],
  body: ['spine', 'chest', 'abdomen', 'pelvis', 'shoulders'],
  arms: ['upperArms', 'elbows', 'forearms', 'wrists', 'palms', 'fingers'],
  legs: ['thighs', 'knees', 'lowerLegs', 'ankles', 'feet'],
};

function solve(angles, root, tilt, proportions) {
  const p = {};
  const ls = clamp((proportions?.height || 3.5) / 3.5, 0.85, 1.2);
  const ss = clamp(proportions?.shoulder || 1, 0.8, 1.3);
  for (const [name, def] of Object.entries(SKELETON)) {
    if (def.parent === null) { p[name] = { x: def.x + root.x, y: def.y + root.y }; continue; }
    const parent = p[def.parent];
    const a = (angles[name] ?? def.angle) * DEG;
    const len = def.len * (name.startsWith('shoulder') ? ss : ls);
    p[name] = { x: parent.x + Math.cos(a) * len, y: parent.y + Math.sin(a) * len };
  }
  for (const [name, a, b] of DERIVED_JOINTS) {
    p[name] = { x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 };
  }
  if (tilt) {
    const t = tilt * DEG, c = Math.cos(t), s = Math.sin(t), o = p.pelvis;
    for (const k of Object.keys(p)) {
      const dx = p[k].x - o.x, dy = p[k].y - o.y;
      p[k] = { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
    }
  }
  return p;
}

export function poseCharacter(design, state = {}) {
  const frame = state.frame ?? 0;
  const action = state.action || 'idle';
  const expression = state.expression || 'neutral';
  const gesture = state.gesture || 'rest';
  const gaze = state.gaze || { target: 'camera', x: 0, y: 0 };
  const body = bodyPose(action, frame, design, state.intensity ?? 0.5);
  const angles = { ...Object.fromEntries(Object.entries(SKELETON).filter(([, d]) => d.angle !== undefined).map(([k, d]) => [k, d.angle])), ...body.angles };
  const points = solve(angles, body.root, body.tilt, design.proportions);
  const scale = clamp((design.proportions?.height || 3.5) / 3.5, 0.85, 1.2);
  const hands = {
    L: handPose(gesture, frame, 'L', design.seed),
    R: handPose(action === 'point' || action === 'wave' ? gesture : gesture, frame + 5, 'R', design.seed + 7),
  };
  const fingers = {
    L: fingerPolylines(points.palmL, angles.wristL, hands.L, scale),
    R: fingerPolylines(points.palmR, angles.wristR, hands.R, scale),
  };
  const face = facialState(expression, frame, gaze, design.seed);
  return { points, angles, body, hands, fingers, face, root: body.root, tilt: body.tilt, frame, action, expression, gesture };
}

export function rigQualityCheck(poses) {
  const issues = [];
  for (const pose of poses) {
    for (const j of ['palmL', 'palmR', 'wristL', 'wristR', 'kneeL', 'kneeR', 'head']) {
      if (!pose.points[j] || !Number.isFinite(pose.points[j].x)) issues.push(`frame ${pose.frame}: broken joint ${j}`);
    }
    const dl = Math.hypot(pose.points.wristL.x - pose.points.elbowL.x, pose.points.wristL.y - pose.points.elbowL.y);
    if (dl < 5 || dl > 60) issues.push(`frame ${pose.frame}: arm segment length ${dl.toFixed(1)}`);
  }
  const handMotion = new Set(poses.map((p) => p.fingers.R.map((f) => f.curl.toFixed(2)).join(',')));
  if (handMotion.size < 2) issues.push('hands frozen across the sequence');
  return { ok: issues.length === 0, issues };
}
