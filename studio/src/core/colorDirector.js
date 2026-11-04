// SceneColorDirector — script-aware, continuous colour direction.
// The examples in the brief (horror/romance/fantasy/...) are SOFT PRIORS in a
// numeric space, not fixed palettes: every story gets its own hue, saturation,
// contrast and lighting identity, and every scene shifts within that identity.
import { clamp, lerp, hashString, mulberry32, hsl, shade, mixHex, withAlpha } from './util.js';

const GENRE_PRIORS = {
  horror:     { warmth: -0.85, sat: -0.55, contrast:  0.55, bright: -0.55, hue: -28, haze: 0.80 },
  romance:    { warmth:  0.75, sat:  0.10, contrast: -0.25, bright:  0.18, hue:  26, haze: 0.25 },
  fantasy:    { warmth:  0.10, sat:  0.55, contrast:  0.20, bright:  0.05, hue:  58, haze: 0.45 },
  historical: { warmth:  0.30, sat: -0.30, contrast:  0.05, bright:  0.02, hue:  12, haze: 0.30 },
  action:     { warmth:  0.35, sat:  0.45, contrast:  0.70, bright:  0.05, hue: -12, haze: 0.20 },
  mystery:    { warmth: -0.35, sat: -0.42, contrast:  0.35, bright: -0.30, hue: -18, haze: 0.65 },
  comedy:     { warmth:  0.45, sat:  0.50, contrast:  0.15, bright:  0.28, hue:  40, haze: 0.10 },
  drama:      { warmth:  0.05, sat: -0.05, contrast:  0.20, bright: -0.05, hue:   0, haze: 0.35 },
};
const TIME = {
  dawn:    { bright: -0.12, warmth: 0.45, keyHue: 32,  skyHue: 205, haze: 0.45 },
  day:     { bright:  0.22, warmth: 0.10, keyHue: 45,  skyHue: 212, haze: 0.18 },
  sunset:  { bright: -0.05, warmth: 0.85, keyHue: 22,  skyHue: 18,  haze: 0.35 },
  night:   { bright: -0.62, warmth: -0.55, keyHue: 225, skyHue: 235, haze: 0.60 },
};
const WEATHER = {
  clear: { sat: 0.10, bright: 0.06, haze: 0.00 },
  rain:  { sat: -0.22, bright: -0.20, haze: 0.40 },
  fog:   { sat: -0.30, bright: -0.10, haze: 0.75 },
  snow:  { sat: -0.28, bright: 0.12, haze: 0.55 },
  wind:  { sat: 0.00, bright: -0.04, haze: 0.15 },
};
const SEASON = { spring: { hue: 18, sat: 0.12 }, summer: { hue: -6, sat: 0.16 }, autumn: { hue: 32, sat: 0.05 }, winter: { hue: -18, sat: -0.28 } };
const EMOTION = {
  joyful:   { warmth: 0.35, sat: 0.25, bright: 0.14, contrast: -0.10 },
  fearful:  { warmth: -0.45, sat: -0.30, bright: -0.22, contrast: 0.35 },
  melancholy:{ warmth: -0.20, sat: -0.32, bright: -0.20, contrast: 0.05 },
  curious:  { warmth: 0.10, sat: 0.10, bright: 0.06, contrast: 0.00 },
  angry:    { warmth: 0.55, sat: 0.35, bright: -0.05, contrast: 0.45 },
  tense:    { warmth: -0.15, sat: -0.15, bright: -0.12, contrast: 0.30 },
  surprised:{ warmth: 0.15, sat: 0.20, bright: 0.12, contrast: 0.20 },
};
const PERIOD = { ancient: { sat: -0.22, warmth: 0.28 }, medieval: { sat: -0.15, warmth: 0.20 }, victorian: { sat: -0.30, warmth: 0.25 }, modern: { sat: 0.10, warmth: -0.05 }, future: { sat: 0.30, warmth: -0.25 } };
const LOCATION = { city: { hue: 6 }, forest: { hue: 92 }, sea: { hue: 190 }, interior: { hue: 24 }, mountain: { hue: 150 }, battlefield: { hue: 16 } };

function blendPriors(weights) {
  const out = { warmth: 0, sat: 0, contrast: 0, bright: 0, hue: 0, haze: 0 };
  let total = 0;
  for (const [k, w] of Object.entries(weights || {})) {
    const p = GENRE_PRIORS[k]; if (!p || w <= 0) continue;
    for (const key of Object.keys(out)) out[key] += p[key] * w;
    total += w;
  }
  if (total > 0) for (const key of Object.keys(out)) out[key] /= total;
  return out;
}

export class SceneColorDirector {
  constructor(analysis) {
    this.analysis = analysis;
    this.seed = analysis.seed;
    this.rnd = mulberry32(this.seed);
    this.genre = blendPriors(analysis.genre?.weights);
    // Story identity: a unique base hue derived from the script, nudged by genre/location.
    this.storyHue = (this.seed % 360 + this.genre.hue + (LOCATION[analysis.location?.primary]?.hue || 0) + 360) % 360;
    this.time = TIME[analysis.timeOfDay?.primary] || TIME.day;
    this.weather = WEATHER[analysis.weather?.primary] || WEATHER.clear;
    this.season = SEASON[analysis.season?.primary] || SEASON.summer;
    this.period = PERIOD[analysis.period?.primary] || PERIOD.victorian;
    this.emotion = EMOTION[analysis.tone?.primary] || EMOTION.curious;
  }

  _params(scene = {}) {
    const a = this.analysis;
    const idx = scene.index || 0;
    const intensity = clamp(scene.intensity ?? a.sceneIntensity ?? 0.5, 0, 1);
    const atm = a.atmosphere?.primary || 'intimate';
    const atmWarm = atm === 'warm' ? 0.35 : atm === 'ominous' ? -0.35 : atm === 'epic' ? 0.10 : 0;
    const atmBright = atm === 'warm' ? 0.14 : atm === 'ominous' ? -0.22 : atm === 'chaotic' ? -0.05 : 0;
    const rnd = mulberry32(this.seed + idx * 7919);
    const warmth = clamp(this.genre.warmth + this.time.warmth + this.emotion.warmth * 0.5 + atmWarm + (rnd() - 0.5) * 0.18, -1, 1);
    const sat = clamp(0.52 + this.genre.sat * 0.55 + this.weather.sat + this.season.sat + this.period.sat + this.emotion.sat * 0.4 + intensity * 0.10, 0.06, 0.95);
    const contrast = clamp(0.45 + this.genre.contrast * 0.5 + this.emotion.contrast * 0.35 + intensity * 0.28, 0.10, 0.98);
    const bright = clamp(0.55 + this.genre.bright * 0.45 + this.time.bright + this.weather.bright + this.emotion.bright * 0.5 + atmBright + (rnd() - 0.5) * 0.10, 0.08, 0.92);
    const haze = clamp(this.genre.haze * 0.4 + this.time.haze * 0.5 + this.weather.haze + (a.atmosphere?.primary === 'ominous' ? 0.2 : 0), 0, 1);
    const hue = (this.storyHue + this.season.hue + (rnd() - 0.5) * 26 + idx * 5 + 360) % 360;
    return { warmth, sat, contrast, bright, haze, hue, intensity, idx, rnd };
  }

  forScene(scene = {}) {
    const p = this._params(scene);
    const { hue, warm } = { hue: p.hue, warm: p.warmth };
    const warmHue = (hue + (warm >= 0 ? 18 : -22) + 360) % 360;
    const coolHue = (hue + 165 + 360) % 360;
    const skyHue = p.idx > 0 && this.time === TIME.night ? 235 : (this.time.skyHue + (hue - this.storyHue) * 0.35 + 360) % 360;
    const paper = hsl((hue + 38) % 360, 0.14 * p.sat, clamp(0.88 - (1 - p.bright) * 0.22, 0.55, 0.95));
    const ink = shade(hsl(coolHue, 0.16, clamp(0.10 - (p.contrast - 0.5) * 0.05, 0.04, 0.16)), 0);
    const palette = {
      id: `scene-${p.idx + 1}`, hue: Math.round(hue), storyHue: Math.round(this.storyHue),
      warmth: +p.warmth.toFixed(3), saturation: +p.sat.toFixed(3), contrast: +p.contrast.toFixed(3),
      brightness: +p.bright.toFixed(3), haze: +p.haze.toFixed(3), intensity: +p.intensity.toFixed(3),
      ink, paper, inkSoft: withAlpha(ink, 0.55),
      skyTop: hsl(skyHue, clamp(p.sat * 0.65, 0.05, 0.8), clamp(0.30 + p.bright * 0.32, 0.12, 0.72)),
      skyHorizon: hsl((skyHue + 12) % 360, clamp(p.sat * 0.5, 0.05, 0.75), clamp(0.55 + p.bright * 0.30, 0.25, 0.90)),
      fog: hsl((skyHue + 8) % 360, p.sat * 0.32, clamp(0.58 + p.bright * 0.22, 0.2, 0.9)),
      ground: hsl(warmHue, p.sat * 0.42, clamp(0.24 + p.bright * 0.22, 0.08, 0.62)),
      building: [hsl((warmHue + 22) % 360, p.sat * 0.48, clamp(0.32 + p.bright * 0.22, 0.12, 0.7)),
                 hsl((warmHue + 58) % 360, p.sat * 0.40, clamp(0.38 + p.bright * 0.20, 0.12, 0.72)),
                 hsl((coolHue + 25) % 360, p.sat * 0.35, clamp(0.30 + p.bright * 0.18, 0.10, 0.65))],
      key: hsl((this.time.keyHue + hue * 0.12) % 360, 0.35 + p.sat * 0.2, clamp(0.62 + p.bright * 0.22, 0.3, 0.94)),
      fill: hsl(coolHue, p.sat * 0.28, clamp(0.35 + p.bright * 0.18, 0.12, 0.7)),
      rim: hsl((warmHue + 120) % 360, p.sat * 0.5, clamp(0.55 + p.bright * 0.2, 0.2, 0.9)),
      accent: hsl((hue + 150) % 360, clamp(p.sat * 1.1, 0.2, 0.95), clamp(0.42 + p.bright * 0.2, 0.2, 0.8)),
      halftone: withAlpha(ink, 0.32), shadow: hsl(coolHue, p.sat * 0.3, clamp(0.16 + p.bright * 0.08, 0.05, 0.3)),
      crosshatch: withAlpha(ink, 0.42), paperGrain: withAlpha(ink, 0.06),
    };
    return palette;
  }

  // Costume colours are FIXED across scenes; only lighting modulation is allowed.
  characterColors(designs, scene) {
    const p = this._params(scene);
    const out = {};
    for (const d of designs) {
      const light = clamp((p.bright - 0.5) * 0.30 + (p.warmth >= 0 ? 0.04 : -0.04), -0.18, 0.18);
      out[d.id] = {
        hue: d.colorIdentity.hue,
        main: shade(d.costume.main, light),
        trim: shade(d.costume.trim, light * 0.7),
        shadow: shade(d.costume.shadow, light * 0.4),
        skin: shade(d.face.skinTone, light * 0.5),
        hair: d.hair.color,
        ink: d.colorIdentity.ink,
      };
    }
    return out;
  }

  report() {
    return { storyHue: this.storyHue, genrePrior: this.genre, time: this.analysis.timeOfDay?.primary,
      weather: this.analysis.weather?.primary, season: this.analysis.season?.primary,
      period: this.analysis.period?.primary, tone: this.analysis.tone?.primary,
      note: 'Continuous colour identity; example genres act as soft priors, never fixed palettes.' };
  }
}

export const __test__ = { blendPriors, GENRE_PRIORS };
