// Review metadata only: frame intervals are half-open [in, out).
import { cameraForShot } from '../camera/cameraEngine.js';

export function timingExport(plan) {
  return { version: 1, fps: plan.meta.fps, totalFrames: plan.meta.totalFrames,
    intervalConvention: '[in,out)', beats: plan.scenes.map(s => ({ id: s.beat, in: s.a, out: s.b, emotion: s.emotion })),
    shots: plan.shots.map(s => {
      const start = cameraForShot(s, s.a), end = cameraForShot(s, s.b - 1);
      return { id: s.id, scene: s.sceneId, in: s.a, out: s.b,
        seconds: [s.a / plan.meta.fps, s.b / plan.meta.fps], characters: s.characters.map(c => c.id),
        camera: { type: s.camera.type, purpose: start.purpose, from: start.pos, to: end.pos,
          lookFrom: start.look, lookTo: end.look, fov: [start.fov, end.fov],
          lensMm: [start.fov, end.fov].map(f => +(18 / Math.tan(f * Math.PI / 360)).toFixed(1)) } };
    }) };
}
export function cameraReport(plan) {
  return '# Camera purpose + move\n\n' + timingExport(plan).shots.map(s =>
    `## Shot ${s.id} · frames ${s.in}–${s.out - 1} · ${s.camera.type}\n` +
    `Purpose: ${s.camera.purpose}.\nMove: ${s.camera.from.join(', ')} → ${s.camera.to.join(', ')}. ` +
    `Look: ${s.camera.lookFrom.join(', ')} → ${s.camera.lookTo.join(', ')}.\n` +
    `Horizontal 36 mm lens equivalent: ${s.camera.lensMm.join(' → ')} mm.\n`).join('\n');
}
export function applyColorOverrides(plan, overrides = {}) {
  const allowed = new Set(Object.keys(plan.scenes[0].palette));
  const patch = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Palette override must be an object');
    for (const [k, v] of Object.entries(value)) {
      if (!allowed.has(k)) throw new Error(`Unknown palette key: ${k}`);
      if (typeof plan.scenes[0].palette[k] === 'number' ? !Number.isFinite(v) : !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`Invalid palette value: ${k}`);
    }
    return value;
  };
  const global = patch(overrides.palette || {});
  const perShot = overrides.shots || {};
  for (const [id, p] of Object.entries(perShot)) {
    if (!plan.shots.some(s => String(s.id) === id)) throw new Error(`Unknown shot: ${id}`);
    patch(p);
  }
  for (const s of plan.scenes) s.palette = { ...s.palette, ...global };
  for (const s of plan.shots) s.palette = { ...s.palette, ...global, ...(perShot[s.id] || {}) };
  return plan;
}
export function dataDiff(a, b, prefix = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => dataDiff(a[k], b[k], prefix ? `${prefix}.${k}` : k));
  return [{ path: prefix, before: a ?? null, after: b ?? null }];
}
