// Scene lighting: condition + palette-adapted colour, direction, fog, shadows.
import { clamp, mixHex, hsl } from '../core/util.js';

export const LIGHTING = {
  daylight:   { dir: [0.6, 0.8, 0.4], intensity: 1.25, ambient: 0.42, fog: 0.12, shadow: 0.45, warm: 0.15 },
  sunset:     { dir: [-0.8, 0.18, 0.4], intensity: 1.05, ambient: 0.34, fog: 0.28, shadow: 0.70, warm: 0.90 },
  sunrise:    { dir: [0.8, 0.22, 0.4], intensity: 0.95, ambient: 0.38, fog: 0.34, shadow: 0.62, warm: 0.65 },
  moonlight:  { dir: [-0.4, 0.75, -0.3], intensity: 0.55, ambient: 0.22, fog: 0.42, shadow: 0.80, warm: -0.70 },
  night:      { dir: [0.0, 0.9, 0.2], intensity: 0.38, ambient: 0.16, fog: 0.52, shadow: 0.85, warm: -0.55 },
  candlelight:{ dir: [0.5, 0.35, 0.6], intensity: 0.85, ambient: 0.20, fog: 0.22, shadow: 0.75, warm: 0.95 },
  firelight:  { dir: [-0.5, 0.30, 0.6], intensity: 1.00, ambient: 0.24, fog: 0.30, shadow: 0.72, warm: 1.00 },
  interior:   { dir: [0.7, 0.6, 0.2], intensity: 0.80, ambient: 0.44, fog: 0.10, shadow: 0.40, warm: 0.25 },
  spotlights: { dir: [0.0, 1.0, 0.1], intensity: 1.35, ambient: 0.14, fog: 0.18, shadow: 0.90, warm: -0.10 },
};

export function lightFor(scene, palette, analysis) {
  let condition = scene.lighting?.condition;
  if (!condition) {
    const hint = analysis.lightingHint?.primary;
    const time = analysis.timeOfDay?.primary;
    condition = hint === 'candlelight' ? 'candlelight' : hint === 'firelight' ? 'firelight'
      : hint === 'moonlight' ? 'moonlight' : hint === 'spotlight' ? 'spotlights'
        : hint === 'interior' ? 'interior' : time === 'sunset' ? 'sunset'
          : time === 'dawn' ? 'sunrise' : time === 'night' ? 'night' : 'daylight';
  }
  const base = LIGHTING[condition] || LIGHTING.daylight;
  const keyWarm = clamp(base.warm + palette.warmth * 0.35, -1, 1);
  const keyColor = mixHex(palette.key, keyWarm >= 0 ? hsl(32, 0.7, 0.65) : hsl(220, 0.5, 0.65), Math.abs(keyWarm) * 0.55);
  return {
    condition, dir: base.dir, color: keyColor,
    intensity: +(base.intensity * (0.75 + palette.brightness * 0.5)).toFixed(3),
    ambient: +(base.ambient * (0.7 + palette.brightness * 0.6)).toFixed(3),
    fillColor: palette.fill, rimColor: palette.rim,
    fogDensity: +clamp(base.fog + palette.haze * 0.28, 0, 0.95).toFixed(3),
    fogColor: palette.fog, shadowSoftness: base.shadow,
    shadowColor: palette.shadow, contrast: palette.contrast,
  };
}
