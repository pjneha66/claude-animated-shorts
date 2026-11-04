// Script -> scenes -> shots. Pure data: no renderer, no audio, no text overlays.
import { clamp, mulberry32, hashString } from './util.js';
import { shotKeys, SHOT_TYPES } from '../camera/cameraEngine.js';
import { lightFor } from '../world/lighting.js';
import { environmentFor } from '../world/environments.js';
import { fxForScene } from '../fx/comicFx.js';
import { ACTION_SET, EXPRESSION_SET, GESTURE_SET } from './characters.js';

export const ASPECTS = {
  '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080],
};

export function resolutionFor(aspect = '9:16', width, height) {
  if (width && height) return { width, height };
  const [w, h] = ASPECTS[aspect] || ASPECTS['9:16'];
  return { width: w, height: h };
}

const SHOT_SEQUENCE = [
  ['wide-establishing'], ['dolly-in', 'close-up'], ['tracking', 'reaction-shot'],
  ['pan', 'over-the-shoulder'], ['low-angle', 'push-in'], ['orbit', 'close-up'],
  ['crane', 'dolly-out'], ['dramatic-reveal', 'extreme-close-up'],
];

const EXPRESSION_FOR_EMOTION = {
  joyful: 'happy', fearful: 'fearful', melancholy: 'sad', curious: 'curious',
  angry: 'angry', tense: 'confused', surprised: 'surprised', drama: 'neutral',
};
const ACTION_FOR_WORD = {
  walk: 'walk', walked: 'walk', march: 'walk', run: 'run', ran: 'run', rush: 'run',
  point: 'point', pointed: 'point', look: 'look-at', looked: 'look-at', gaze: 'look-at',
  fall: 'fall', fell: 'fall', break: 'react', broke: 'react', crack: 'react',
  reach: 'hold', reached: 'hold', grab: 'hold', hold: 'hold', held: 'hold',
  stand: 'stand', stood: 'stand', sit: 'sit', wave: 'point', waved: 'point',
  step: 'walk', stepped: 'walk', jump: 'run', leap: 'run', discover: 'react', hide: 'react',
};

export function buildPlan(analysis, designs, director, opts = {}) {
  const fps = [30, 60].includes(Number(opts.fps)) ? Number(opts.fps) : 30;
  const seconds = clamp(Number(opts.seconds) || 60, 5, 300);
  const totalFrames = Math.round(seconds * fps);
  const { width, height } = resolutionFor(opts.aspect || '9:16', opts.width, opts.height);
  const quality = opts.quality || 'medium';
  const beats = analysis.beats.length ? analysis.beats : [{ id: 1, text: analysis.sentences[0] || analysis.title, wordCount: 18, intensity: 0.5, emotion: analysis.tone.primary, actions: [] }];
  const rnd = mulberry32(analysis.seed);

  const weights = beats.map((b) => b.wordCount + 6 + b.intensity * 10);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const sceneFrames = weights.map((w) => Math.max(24, Math.round((totalFrames * w) / wsum)));
  let diff = totalFrames - sceneFrames.reduce((a, b) => a + b, 0);
  sceneFrames[sceneFrames.length - 1] += diff;
  if (sceneFrames[sceneFrames.length - 1] < 24) { diff = 24 - sceneFrames[sceneFrames.length - 1]; sceneFrames[sceneFrames.length - 1] = 24; sceneFrames[0] -= diff; }

  const scenes = [];
  let cursor = 0;
  beats.forEach((beat, i) => {
    const a = cursor, b = Math.min(totalFrames, cursor + sceneFrames[i]);
    cursor = b;
    const scene = {
      id: i + 1, index: i, a, b, text: beat.text, beat: beat.id,
      intensity: beat.intensity, emotion: beat.emotion,
      timeOfDay: analysis.timeOfDay.primary, weather: analysis.weather.primary,
      season: analysis.season.primary, period: analysis.period.primary,
      location: analysis.location.primary, environment: analysis.location.primary,
      seed: hashString(`${analysis.seed}|scene|${i}`),
    };
    scene.palette = director.forScene(scene);
    scene.light = lightFor(scene, scene.palette, analysis);
    scene.env = environmentFor(scene, scene.palette, analysis);
    scene.fx = fxForScene(scene, quality);
    scene.characterColors = director.characterColors(designs, scene);
    scenes.push(scene);
  });

  const shots = [];
  for (const scene of scenes) {
    const seq = SHOT_SEQUENCE[scene.index % SHOT_SEQUENCE.length];
    const count = scene.intensity > 0.72 ? Math.min(3, seq.length + 1) : Math.min(2, seq.length);
    const types = seq.slice(0, count);
    if (scene.intensity > 0.72 && count === 1) types.push('extreme-close-up');
    const len = scene.b - scene.a;
    const parts = types.length;
    let s = scene.a;
    types.forEach((type, j) => {
      const e = j === parts - 1 ? scene.b : s + Math.round(len / parts);
      const shot = {
        id: shots.length + 1, sceneId: scene.id, a: s, b: e,
        composition: { rule: j === 0 ? 'thirds-wide' : 'thirds-close', foreground: j % 2 === 1, depth: true },
        camera: { type, keys: shotKeys(type, scene.seed + j * 31) },
        characters: designs.slice(0, clamp(scene.intensity > 0.6 ? Math.min(3, designs.length) : Math.min(2, designs.length), 1, 3)).map((d, k) => {
          const actionWord = beatActionForScene(analysis, scene.index, k);
          return {
            id: d.id, x: (k - (Math.min(designs.length, scene.intensity > 0.6 ? 3 : 2) - 1) / 2) * 2.6,
            action: actionWord, expression: EXPRESSION_FOR_EMOTION[scene.emotion] || 'curious',
            gesture: gestureFor(actionWord), gaze: designs.length > 1 ? { target: designs[k === 0 ? 1 : 0].id, x: k === 0 ? 0.65 : -0.65, y: 0 } : { target: 'camera', x: 0, y: 0 },
            intensity: scene.intensity,
          };
        }),
        fx: scene.fx, palette: scene.palette, env: scene.env, light: scene.light,
        characterColors: scene.characterColors,
      };
      if (shot.characters.length > 1 && /reach|held|hold|together|help|touch|embrace/i.test(scene.text)) {
        shot.characters.forEach(c => { c.action = 'interact'; c.gesture = 'two-hand'; });
        shot.interaction = { kind: 'mutual-attention', participants: shot.characters.map(c => c.id) };
      }
      shots.push(shot);
      s = e;
    });
  }

  return {
    meta: {
      title: analysis.title, seed: analysis.seed, source: analysis.source, ai: analysis.ai,
      silent: true, audio: false, subtitles: false, captions: false, textOverlays: false,
      fps, seconds, totalFrames, width, height, aspect: opts.aspect || '9:16', quality,
      visualOnly: true, output: 'h264-mp4-no-audio', createdBy: 'local-cinematic-visual-animation-studio',
      styleReference: 'studio/assets/style_reference.jpg',
      styleTechnique: ['thick-black-ink', 'ben-day-halftone', 'crosshatching', 'illustrated-shadows', 'printed-paper'],
      palettePolicy: 'script-aware-dynamic',
    },
    analysis, designs, scenes, shots,
  };
}

function beatActionForScene(analysis, sceneIndex, charIndex) {
  const beat = analysis.beats[sceneIndex] || analysis.beats[0] || { actions: [] };
  const words = beat.actions || [];
  for (const w of words) if (ACTION_FOR_WORD[w]) return ACTION_FOR_WORD[w];
  const fallback = ['idle', 'walk', 'react', 'look-at', 'point', 'run', 'hold', 'interact'];
  return fallback[(sceneIndex * 3 + charIndex) % fallback.length];
}
function gestureFor(action) {
  return ({ point: 'point', hold: 'hold', wave: 'wave', run: 'fist', react: 'open-palm', 'look-at': 'rest', idle: 'rest', walk: 'rest', fall: 'two-hand', sit: 'rest', stand: 'rest', interact: 'two-hand' })[action] || 'rest';
}

export const __planExports = { SHOT_TYPES, ACTION_SET, EXPRESSION_SET, GESTURE_SET };
