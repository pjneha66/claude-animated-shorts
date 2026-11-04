// Canvas2D environment, comic VFX and printed-paper painting. Shared by the
// software fallback; ThreeWorld.jsx mirrors these specs in actual 3D geometry.
import { mulberry32, clamp, withAlpha, mixHex } from '../core/util.js';

const INK = '#141018';

export function paintEnvironment(ctx, env, view, w, h, frame, palette, quality = 'medium') {
  const zoom = clamp(10 / (view.pos?.[2] || 9), 0.5, 1.8);
  const camX = (view.pos?.[0] || 0) * 18;
  const camY = (view.pos?.[1] || 2) * 6;
  const horizon = h * 0.58 + camY * 0.4;
  // Sky gradient + fog band (palette-driven, never a fixed blue/yellow/red).
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 60);
  sky.addColorStop(0, palette.skyTop); sky.addColorStop(0.72, palette.skyHorizon); sky.addColorStop(1, palette.fog);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // Ben-Day halftone field in the sky (the reference's dotted background).
  const dense = quality === 'low' ? 18 : 10;
  ctx.save(); ctx.fillStyle = palette.halftone;
  for (let y = 0; y < horizon; y += dense) for (let x = (y / dense) % 2 * dense * 0.5; x < w; x += dense) {
    ctx.beginPath(); ctx.arc(x, y, dense * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Layers: far silhouettes -> mid architecture -> near props -> foreground.
  for (const layer of env.layers) {
    const shift = -camX * layer.parallax;
    const rnd = mulberry32(layer.seed);
    const [z0, z1] = layer.zRange;
    for (let i = 0; i < layer.count; i++) {
      const t = (i + rnd()) / layer.count;
      const x = ((t * w * 1.6) - w * 0.3 + shift) % (w * 1.7);
      const xx = x < -100 ? x + w * 1.7 : x;
      const depth = (z0 + (z1 - z0) * rnd()) / 70;
      const height = (layer.name === 'far' ? h * 0.30 : layer.name === 'mid' ? h * 0.38 : h * 0.30) * (0.5 + rnd() * 0.7) * zoom;
      const width = (layer.name === 'far' ? w * 0.10 : w * 0.085) * (0.6 + rnd() * 0.8);
      const y = horizon - height * (layer.name === 'far' ? 0.55 : 0.9) + depth * 40;
      const col = layer.name === 'far' ? mixHex(layer.color, palette.fog, 0.55)
        : layer.name === 'mid' ? palette.building[i % palette.building.length] : layer.color;
      ctx.save();
      ctx.fillStyle = col; ctx.strokeStyle = palette.ink; ctx.lineWidth = layer.name === 'far' ? 1.6 : 3.2;
      if (layer.name === 'foreground' || layer.name === 'near') {
        ctx.beginPath(); ctx.moveTo(xx - width / 2, y + height); ctx.lineTo(xx - width / 2, y); ctx.lineTo(xx, y - height * 0.18); ctx.lineTo(xx + width / 2, y); ctx.lineTo(xx + width / 2, y + height); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // crosshatched illustrated shadow on one face
        ctx.save(); ctx.clip(); ctx.strokeStyle = palette.crosshatch; ctx.lineWidth = 1.2;
        for (let d = -height; d < width + height; d += 9) { ctx.beginPath(); ctx.moveTo(xx + d, y); ctx.lineTo(xx + d - height, y + height); ctx.stroke(); }
        ctx.restore();
      } else {
        ctx.fillRect(xx - width / 2, y, width, height); ctx.strokeRect(xx - width / 2, y, width, height);
        if (layer.name === 'mid' && quality !== 'low') {
          ctx.fillStyle = withAlpha(palette.ink, 0.45);
          for (let k = 0; k < 3; k++) ctx.fillRect(xx - width * 0.3 + k * width * 0.25, y + height * (0.2 + k * 0.22), width * 0.12, height * 0.12);
        }
      }
      ctx.restore();
    }
  }
  // Ground plane with crosshatch texture + horizon fog.
  ctx.fillStyle = palette.ground; ctx.fillRect(0, horizon + h * 0.16, w, h);
  ctx.save(); ctx.strokeStyle = palette.crosshatch; ctx.lineWidth = 1.3;
  for (let d = -h; d < w + h; d += 12) { ctx.beginPath(); ctx.moveTo(d, horizon + h * 0.16); ctx.lineTo(d + h * 0.4, h); ctx.stroke(); }
  ctx.restore();
  const fog = ctx.createLinearGradient(0, horizon - 40, 0, horizon + h * 0.3);
  fog.addColorStop(0, withAlpha(palette.fog, 0)); fog.addColorStop(1, withAlpha(palette.fog, clamp(env.fog.density, 0, 0.8)));
  ctx.fillStyle = fog; ctx.fillRect(0, horizon - 40, w, h * 0.34);
  return { horizon, zoom };
}

// Scene lighting is applied to the whole frame (characters included) so the
// lighting condition is visibly different, not just a number in the plan.
export function paintLighting(ctx, light, palette, w, h) {
  const condition = light?.condition || 'daylight';
  const table = {
    daylight: [palette.key, 0.03], sunset: [palette.key, 0.30], sunrise: [palette.key, 0.22],
    moonlight: [palette.shadow, 0.62], night: [palette.shadow, 0.78],
    candlelight: [palette.shadow, 0.40], firelight: [palette.shadow, 0.34],
    interior: [palette.shadow, 0.18], spotlights: [palette.shadow, 0.52],
  };
  const [color, alpha] = table[condition] || table.daylight;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
  if ((light?.shadowSoftness ?? 0) > 0.6) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, withAlpha(palette.shadow, 0.42)); g.addColorStop(0.45, withAlpha(palette.shadow, 0));
    g.addColorStop(1, withAlpha(palette.shadow, 0.40));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}

export function paintComicFx(ctx, fxList, frame, shot, palette, w, h, quality = 'medium') {
  const t = clamp((frame - shot.a) / Math.max(1, shot.b - shot.a), 0, 1);
  for (const fx of fxList) {
    const rnd = mulberry32(fx.seed || 1);
    switch (fx.kind) {
      case 'registration-offset': {
        ctx.save(); ctx.globalAlpha = fx.intensity * 0.4;
        for (const [color, offset] of [[palette.accent, -2], [palette.key, 2]]) {
          ctx.fillStyle = color;
          for (let y = h * 0.65; y < h; y += 17) for (let x = 0; x < w; x += 17) {
            ctx.beginPath(); ctx.arc(x + offset, y, 2.2, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore(); break;
      }
      case 'panel-shutter': {
        if (t > 0.12) break;
        ctx.save(); ctx.fillStyle = palette.ink;
        for (let i = 0; i < 6; i++) ctx.fillRect(i * w / 6, 0, w / 6 * (1 - t / 0.12), h);
        ctx.restore(); break;
      }
      case 'radial-iris': {
        if (t > 0.12) break;
        ctx.save(); ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.rect(0, 0, w, h);
        ctx.arc(w / 2, h / 2, Math.hypot(w, h) * t / 0.24, 0, Math.PI * 2, true);
        ctx.fill('evenodd'); ctx.restore(); break;
      }
      case 'dry-brush': {
        ctx.save(); ctx.strokeStyle = palette.ink; ctx.globalAlpha = fx.intensity;
        for (let i = 0; i < 24; i++) {
          const y = rnd() * h, x = rnd() < 0.5 ? 0 : w;
          ctx.lineWidth = 1 + rnd() * 3; ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + (x ? -1 : 1) * (12 + rnd() * 34), y - 9); ctx.stroke();
        }
        ctx.restore(); break;
      }
      case 'halftone': {
        const s = quality === 'low' ? 22 : fx.density * 2;
        ctx.save(); ctx.fillStyle = palette.halftone; ctx.globalAlpha = fx.intensity * 0.7;
        for (let y = h * 0.62; y < h; y += s) for (let x = 0; x < w; x += s) { ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); break;
      }
      case 'speed-lines': {
        ctx.save(); ctx.strokeStyle = withAlpha(palette.ink, 0.25 * fx.intensity); ctx.lineWidth = 1.6;
        for (let i = 0; i < fx.count; i++) { const a = (i / fx.count) * Math.PI * 2 + rnd() * 0.2; const l = w * (0.25 + rnd() * 0.5); ctx.beginPath(); ctx.moveTo(w * 0.5 + Math.cos(a) * w * 0.2, h * 0.5 + Math.sin(a) * w * 0.2); ctx.lineTo(w * 0.5 + Math.cos(a) * l, h * 0.5 + Math.sin(a) * l); ctx.stroke(); }
        ctx.restore(); break;
      }
      case 'impact-burst': {
        if (Math.abs(t - fx.at) > 0.09) break;
        ctx.save(); ctx.fillStyle = withAlpha(palette.accent, 0.85); ctx.strokeStyle = palette.ink; ctx.lineWidth = 3;
        ctx.beginPath(); const cx = w * 0.5, cy = h * 0.44, spikes = 14;
        for (let i = 0; i < spikes * 2; i++) { const r = (i % 2 ? 0.18 : 0.38) * w * (0.6 + rnd() * 0.5); const a = (i / (spikes * 2)) * Math.PI * 2; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); break;
      }
      case 'ink-splash': {
        ctx.save(); ctx.fillStyle = withAlpha(palette.ink, 0.55);
        for (let i = 0; i < fx.count; i++) { const x = w * (0.1 + rnd() * 0.8), y = h * (0.2 + rnd() * 0.6), r = 2 + rnd() * 9; ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + rnd()), rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); break;
      }
      case 'dust-particles': {
        ctx.save(); ctx.fillStyle = withAlpha(palette.paper, 0.35);
        for (let i = 0; i < fx.count; i++) { const x = (rnd() * w + Math.sin(frame * 0.02 + i) * 12 + w) % w; const y = (rnd() * h + frame * 0.35 + i * 9) % h; ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 2.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); break;
      }
      case 'motion-streaks': {
        ctx.save(); ctx.strokeStyle = withAlpha(palette.ink, 0.18 * fx.intensity * 2); ctx.lineWidth = 2;
        for (let i = 0; i < fx.count; i++) { const y = rnd() * h, len = 30 + rnd() * 110; ctx.beginPath(); ctx.moveTo(rnd() * w, y); ctx.lineTo(rnd() * w + len, y - 6); ctx.stroke(); }
        ctx.restore(); break;
      }
      case 'illustrated-smoke': {
        ctx.save(); ctx.fillStyle = withAlpha(palette.fog, 0.28 * fx.intensity);
        for (let i = 0; i < 7; i++) { const x = w * (0.15 + rnd() * 0.7) + Math.sin(frame * 0.01 + i) * 14; const y = h * (0.3 + rnd() * 0.5); ctx.beginPath(); ctx.ellipse(x, y, 40 + rnd() * 70, 22 + rnd() * 30, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); break;
      }
      case 'comic-transition': {
        if (t > 0.08) break;
        const sweep = 1 - t / 0.08; ctx.save(); ctx.fillStyle = palette.ink;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * sweep, 0); ctx.lineTo(w * sweep * 0.82, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill(); ctx.restore(); break;
      }
      case 'dramatic-shadows': {
        const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, withAlpha(palette.shadow, 0.32 * fx.intensity)); g.addColorStop(0.5, withAlpha(palette.shadow, 0)); g.addColorStop(1, withAlpha(palette.shadow, 0.28 * fx.intensity));
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); break;
      }
      default: break;
    }
  }
}

export function paintPaper(ctx, w, h, palette, quality = 'medium') {
  // Fixed, deterministic speckle: a bounded number of dots (not a full-frame
  // nested loop), so high-resolution renders stay fast and the grain never flickers.
  const rnd = mulberry32(20261104);
  const count = quality === 'low' ? 900 : Math.min(4000, Math.round((w * h) / 260));
  ctx.save(); ctx.globalAlpha = 0.11;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rnd() > 0.5 ? palette.ink : palette.paper;
    ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = Math.max(4, w * 0.006); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth); ctx.restore();
}
