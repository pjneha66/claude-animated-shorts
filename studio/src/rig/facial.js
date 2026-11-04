// Advanced facial animation: blinking, independent pupils, gaze, asymmetric
// brows, emotional mouth shapes, squint / widen / tears. No dialogue lip-sync.
import { clamp, mulberry32, smootherstep } from '../core/util.js';

export const EXPRESSIONS = ['happy', 'sad', 'angry', 'surprised', 'confused', 'curious', 'fearful', 'excited', 'disgusted', 'crying', 'laughing', 'neutral'];

const MOUTH = {
  neutral: { shape: 'line', open: 0.06, smile: 0.0, width: 0.42 },
  happy: { shape: 'smile', open: 0.16, smile: 0.75, width: 0.52 },
  sad: { shape: 'frown', open: 0.08, smile: -0.65, width: 0.40 },
  angry: { shape: 'flat', open: 0.06, smile: -0.35, width: 0.46 },
  surprised: { shape: 'o', open: 0.62, smile: 0.0, width: 0.30 },
  confused: { shape: 'wave', open: 0.10, smile: -0.15, width: 0.44 },
  curious: { shape: 'line', open: 0.08, smile: 0.18, width: 0.40 },
  fearful: { shape: 'tremble', open: 0.34, smile: -0.2, width: 0.36 },
  excited: { shape: 'smile', open: 0.42, smile: 0.9, width: 0.56 },
  disgusted: { shape: 'curl', open: 0.10, smile: -0.45, width: 0.42 },
  crying: { shape: 'frown', open: 0.28, smile: -0.7, width: 0.46 },
  laughing: { shape: 'smile', open: 0.70, smile: 1.0, width: 0.58 },
};

export function facialState(expression = 'neutral', frame = 0, gaze = { target: 'camera', x: 0, y: 0 }, seed = 1) {
  const rnd = mulberry32(seed);
  const blinkInterval = 15 + Math.floor(rnd() * 54); // 0.5 - 2.3 s at 30 fps
  const blinkStart = Math.floor(rnd() * blinkInterval);
  const inBlink = (frame + blinkStart) % blinkInterval;
  const blink = inBlink < 4 ? 1 - Math.abs(inBlink - 1.5) / 2 : 0; // 4-frame blink
  const expr = MOUTH[expression] || MOUTH.neutral;
  const drift = Math.sin(frame * 0.037 + seed) * 0.10;
  const targetX = clamp((gaze.x || 0) + drift, -1, 1), targetY = clamp((gaze.y || 0) + Math.cos(frame * 0.029) * 0.05, -1, 1);
  const independent = Math.sin(frame * 0.061 + seed * 0.7) * 0.045;
  const widen = ['surprised', 'fearful', 'excited'].includes(expression) ? 0.35 : 0;
  const squint = ['angry', 'disgusted', 'confused'].includes(expression) ? 0.35 : 0;
  const eyeOpen = clamp(1 - blink * 0.96 + widen - squint, 0.04, 1.25);
  const browLift = ({ happy: 0.25, surprised: 0.75, fearful: 0.55, angry: -0.6, sad: -0.2, crying: -0.35, confused: 0.2, curious: 0.3, excited: 0.6, disgusted: -0.4, laughing: 0.4 })[expression] || 0;
  const asym = expression === 'confused' || expression === 'curious' ? 0.28 : Math.sin(frame * 0.021) * 0.04;
  return {
    expression, blink, eyeOpenL: clamp(eyeOpen + independent, 0.03, 1.3), eyeOpenR: clamp(eyeOpen - independent, 0.03, 1.3),
    pupils: {
      L: { x: clamp(targetX + independent, -1, 1), y: targetY },
      R: { x: clamp(targetX - independent, -1, 1), y: targetY },
      independent: Math.abs(independent) > 0.001,
    },
    gazeTarget: gaze.target || 'camera',
    brows: { L: browLift + asym, R: browLift - asym, angleL: -8 * browLift, angleR: 8 * browLift, asym: Math.abs(asym) > 0.1 },
    mouth: { ...expr, tremble: expression === 'fearful' ? Math.sin(frame * 0.5) * 0.06 : 0, open: clamp(expr.open + Math.sin(frame * 0.045) * 0.012, 0, 1) },
    cheeks: expression === 'happy' || expression === 'laughing' ? 0.35 : 0,
    tears: expression === 'crying' ? 0.8 : expression === 'sad' ? 0.25 : 0,
    squint, widen, rest: expression === 'neutral' && blink === 0,
  };
}

export function facialQualityCheck(states) {
  const issues = [];
  const opens = states.map((s) => s.eyeOpenL);
  if (Math.max(...opens) - Math.min(...opens) < 0.1) issues.push('static eyelids / no blinking');
  const pupils = states.map((s) => s.pupils.L.x);
  if (Math.max(...pupils) - Math.min(...pupils) < 0.05) issues.push('pupils never move');
  const mouths = new Set(states.map((s) => `${s.mouth.shape}:${s.mouth.open.toFixed(2)}`));
  if (mouths.size < 2) issues.push('mouth frozen');
  return { ok: issues.length === 0, issues };
}
