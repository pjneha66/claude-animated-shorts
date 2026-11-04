// Full-body animation: walk / run / idle / reactions / interactions.
// Anticipation, follow-through, overlap, ease-in/out, secondary motion and
// weight transfer are computed here from a single deterministic phase.
import { clamp, lerp, smootherstep, easeInOut, DEG } from '../core/util.js';

export function bodyPose(action = 'idle', frame = 0, design = {}, intensity = 0.5) {
  const f = frame;
  const phase = (f / 30) * (action === 'run' ? 2.6 : action === 'walk' ? 2.0 : 1.0);
  const s = Math.sin(phase * Math.PI * 2);
  const s2 = Math.sin(phase * Math.PI * 4);
  const c = Math.cos(phase * Math.PI * 2);
  const A = {}; // angle overrides in degrees
  let root = { x: 0, y: 0 }, tilt = 0, bounce = 0, weight = 0;

  switch (action) {
    case 'walk': {
      // Thigh swing (hip->knee) + shin bend (knee->ankle): reads as a walk, not a sit.
      const thigh = 22 * s, thigh2 = 22 * Math.sin(phase * Math.PI * 2 + Math.PI);
      A.kneeL = 90 + thigh; A.kneeR = 90 + thigh2;
      A.ankleL = 90 + 8 + Math.max(0, -thigh) * 0.55; A.ankleR = 90 + 8 + Math.max(0, -thigh2) * 0.55;
      A.footL = 0 - thigh * 0.20; A.footR = 0 - thigh2 * 0.20;
      A.elbowL = 105 - thigh2 * 0.75; A.elbowR = 75 - thigh * 0.75;
      A.wristL = 90 - thigh2 * 0.45; A.wristR = 90 - thigh * 0.45;
      A.spine = -90 + s2 * 1.2; A.chest = -90 - s2 * 1.6;
      root.y = -Math.abs(s2) * 2.2; weight = s * 1.4; tilt = s * 1.6;
      break;
    }
    case 'run': {
      const thigh = 38 * s, thigh2 = 38 * Math.sin(phase * Math.PI * 2 + Math.PI);
      A.kneeL = 90 + thigh; A.kneeR = 90 + thigh2;
      A.ankleL = 90 + 26 + Math.max(0, -thigh) * 0.7; A.ankleR = 90 + 26 + Math.max(0, -thigh2) * 0.7;
      A.footL = 0 - thigh * 0.24; A.footR = 0 - thigh2 * 0.24;
      A.elbowL = 105 - thigh2 * 0.95; A.elbowR = 75 - thigh * 0.95;
      A.wristL = 90 + 20; A.wristR = 90 + 20;
      A.spine = -90 + 10; A.chest = -90 + 4 + s2 * 2.5;
      root.y = -Math.abs(s2) * 5.0; root.x = 0; tilt = 12 + s2 * 1.5; bounce = Math.abs(s2);
      break;
    }
    case 'idle': {
      const breath = Math.sin(f * 0.075), drift = Math.sin(f * 0.031);
      A.spine = -90 + breath * 0.8; A.chest = -90 - breath * 1.1;
      A.head = -90 + drift * 2.4; A.neck = -90 + drift * 1.2;
      A.elbowL = 105 + breath * 1.4; A.elbowR = 75 - breath * 1.4;
      root.y = breath * 0.7; weight = drift * 1.5; tilt = drift * 0.7;
      break;
    }
    case 'react': {
      // 6-frame anticipation, 10-frame action, decaying follow-through.
      const t = clamp(f / 24, 0, 1);
      const e = smootherstep(t), anti = f < 6 ? -smootherstep(f / 6) * 0.5 : 0;
      A.head = -90 + (10 + anti * 8) * e; A.neck = -90 + 5 * e;
      A.elbowL = 105 - 38 * e; A.elbowR = 75 + 38 * e;
      A.wristL = 90 - 24 * e; A.wristR = 90 + 24 * e;
      A.chest = -90 - 6 * e; root.y = -3 * e; tilt = -4 * e;
      break;
    }
    case 'point': {
      const e = easeInOut(clamp(f / 18, 0, 1));
      A.elbowR = 75 - 62 * e; A.wristR = 90 - 48 * e; A.palmR = 90 - 30 * e;
      A.head = -90 - 6 * e; A.chest = -90 + 3 * e; tilt = 2 * e;
      break;
    }
    case 'hold': case 'interact': {
      const e = easeInOut(clamp(f / 20, 0, 1));
      A.elbowL = 105 - 42 * e; A.elbowR = 75 + 42 * e;
      A.wristL = 90 - 24 * e; A.wristR = 90 + 24 * e;
      A.head = -90 + 5 * e; A.chest = -90 + 2 * e;
      break;
    }
    case 'sit': {
      A.kneeL = 90 - 62; A.kneeR = 90 + 62; A.ankleL = 90 + 10; A.ankleR = 90 - 10;
      A.spine = -90 + 4; root.y = 18; A.head = -90 - 3;
      break;
    }
    case 'fall': {
      const e = smootherstep(clamp(f / 22, 0, 1));
      tilt = 48 * e; A.kneeL = 90 - 30 * e; A.kneeR = 90 + 34 * e;
      A.elbowL = 105 - 52 * e; A.elbowR = 75 + 58 * e;
      root.y = 8 * e;
      break;
    }
    case 'look-at': {
      const drift = Math.sin(f * 0.045);
      A.head = -90 + 9 + drift * 2; A.neck = -90 + 3;
      A.chest = -90 - drift * 1.2; A.spine = -90 + drift * 0.6;
      break;
    }
    default: { // stand
      A.spine = -90 + Math.sin(f * 0.06) * 0.5; A.head = -90 + Math.sin(f * 0.029) * 1.6;
    }
  }
  // Secondary motion on extremities: small overlapping lag.
  const lag = Math.sin((f - 4) * 0.16) * 1.2;
  A.wristL = (A.wristL ?? 90) + lag; A.wristR = (A.wristR ?? 90) - lag;
  return { angles: A, root, tilt, phase, bounce, weight, intensity, hair: Math.sin((f - 5) * 0.16) * (action === 'run' ? 3 : 1.2), cloth: Math.sin((f - 8) * 0.14) * (action === 'run' ? 3 : 1.5) };
}
