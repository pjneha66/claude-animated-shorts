// Canvas2D vintage comic-book character renderer. Works with both a browser
// canvas (Remotion/Three.js texture) and @napi-rs/canvas (software fallback).
// Technique from studio/assets/style_reference.jpg: heavy black contour ink,
// Ben-Day dots, cross-hatching, illustrated shadows, detailed clothing, paper.
import { clamp, withAlpha } from '../core/util.js';
import { poseCharacter } from '../rig/characterRig.js';
import { facialState } from '../rig/facial.js';

const INK = '#141018';

function stroke(ctx, color, width) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function path(ctx, pts, close = false) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); if (close) ctx.closePath(); }
function poly(ctx, pts, fill, ink, lw = 4) { path(ctx, pts, true); ctx.fillStyle = fill; ctx.fill(); stroke(ctx, ink, lw); ctx.stroke(); }
function outlinedLine(ctx, a, b, width, fill, ink, lw = 4) {
  const seg = [a, b];
  path(ctx, seg); stroke(ctx, ink, width + lw); ctx.stroke();
  path(ctx, seg); stroke(ctx, fill, width); ctx.stroke();
}
function capsule(ctx, a, b, width, fill, ink, lw = 4) { outlinedLine(ctx, a, b, width, fill, ink, lw); }

function halftoneRegion(ctx, bbox, color, spacing, radius, clipFn) {
  ctx.save(); ctx.beginPath(); clipFn(ctx); ctx.clip();
  ctx.fillStyle = color;
  for (let y = bbox.y0; y < bbox.y1; y += spacing) {
    for (let x = bbox.x0; x < bbox.x1; x += spacing) {
      ctx.beginPath(); ctx.arc(x + ((y / spacing) % 2) * spacing * 0.5, y, radius, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
function crosshatchRegion(ctx, bbox, color, spacing, clipFn) {
  ctx.save(); ctx.beginPath(); clipFn(ctx); ctx.clip();
  stroke(ctx, color, 1.1);
  for (let d = -bbox.y1; d < bbox.x1 + bbox.y1; d += spacing) {
    ctx.beginPath(); ctx.moveTo(bbox.x0 + d, bbox.y0); ctx.lineTo(bbox.x0 + d + (bbox.y1 - bbox.y0), bbox.y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bbox.x0 + d, bbox.y1); ctx.lineTo(bbox.x0 + d + (bbox.y1 - bbox.y0), bbox.y0); ctx.stroke();
  }
  ctx.restore();
}

function headOutline(ctx, cx, cy, rx, ry, shape) {
  ctx.beginPath();
  if (shape === 'square-jaw') {
    ctx.moveTo(cx - rx, cy - ry * 0.55); ctx.bezierCurveTo(cx - rx, cy - ry * 1.15, cx + rx, cy - ry * 1.15, cx + rx, cy - ry * 0.55);
    ctx.lineTo(cx + rx * 0.88, cy + ry * 0.72); ctx.lineTo(cx + rx * 0.45, cy + ry); ctx.lineTo(cx - rx * 0.45, cy + ry); ctx.lineTo(cx - rx * 0.88, cy + ry * 0.72); ctx.closePath();
  } else if (shape === 'heart' || shape === 'bean') {
    ctx.moveTo(cx, cy - ry); ctx.bezierCurveTo(cx + rx * 1.15, cy - ry * 1.05, cx + rx * 1.05, cy + ry * 0.45, cx + rx * 0.42, cy + ry);
    ctx.bezierCurveTo(cx - rx * 0.15, cy + ry * 1.12, cx - rx * 1.05, cy + ry * 0.55, cx - rx, cy - ry * 0.1);
    ctx.bezierCurveTo(cx - rx * 1.05, cy - ry * 0.85, cx - rx * 0.4, cy - ry * 1.05, cx, cy - ry); ctx.closePath();
  } else if (shape === 'long') { ctx.ellipse(cx, cy, rx * 0.82, ry * 1.12, 0, 0, Math.PI * 2); }
  else { ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }
}

function drawHair(ctx, cx, cy, rx, ry, hair, ink) {
  ctx.save();
  ctx.fillStyle = hair.color; stroke(ctx, ink, 4.2);
  ctx.beginPath();
  switch (hair.style) {
    case 'swept-blond':
    case 'slicked': ctx.moveTo(cx - rx, cy - ry * 0.15); ctx.bezierCurveTo(cx - rx * 1.1, cy - ry * 1.35, cx + rx * 1.1, cy - ry * 1.45, cx + rx, cy - ry * 0.2);
      ctx.bezierCurveTo(cx + rx * 0.6, cy - ry * 0.85, cx - rx * 0.2, cy - ry * 0.6, cx - rx, cy - ry * 0.15); break;
    case 'tousled-curls':
    case 'wavy': ctx.moveTo(cx - rx, cy - ry * 0.1);
      for (let i = 0; i <= 8; i++) { const t = i / 8; ctx.quadraticCurveTo(cx - rx + (2 * rx) * t, cy - ry * (1.1 + Math.sin(i * 2.1) * 0.18), cx - rx + (2 * rx) * (t + 0.06), cy - ry * 0.55); }
      ctx.lineTo(cx + rx, cy - ry * 0.1); break;
    case 'bob': ctx.moveTo(cx - rx * 1.05, cy + ry * 0.25); ctx.lineTo(cx - rx * 1.05, cy - ry * 0.95);
      ctx.bezierCurveTo(cx - rx * 0.8, cy - ry * 1.4, cx + rx * 0.8, cy - ry * 1.4, cx + rx * 1.05, cy - ry * 0.95);
      ctx.lineTo(cx + rx * 1.05, cy + ry * 0.25); ctx.bezierCurveTo(cx + rx * 0.6, cy - ry * 0.2, cx - rx * 0.6, cy - ry * 0.2, cx - rx * 1.05, cy + ry * 0.25); break;
    case 'spiky': ctx.moveTo(cx - rx, cy - ry * 0.3);
      for (let i = 0; i < 7; i++) { const t = i / 6; ctx.lineTo(cx - rx + 2 * rx * t, cy - ry * (0.95 + (i % 2) * 0.45)); ctx.lineTo(cx - rx + 2 * rx * (t + 0.07), cy - ry * 0.55); }
      ctx.lineTo(cx + rx, cy - ry * 0.3); break;
    case 'braided': ctx.ellipse(cx, cy - ry * 0.55, rx * 1.02, ry * 0.62, 0, Math.PI, 0); break;
    case 'topknot': ctx.ellipse(cx, cy - ry * 0.5, rx * 0.98, ry * 0.58, 0, Math.PI, 0);
      ctx.beginPath(); ctx.ellipse(cx, cy - ry * 1.28, rx * 0.32, ry * 0.34, 0, 0, Math.PI * 2); break;
    default: ctx.ellipse(cx, cy - ry * 0.45, rx * 1.0, ry * 0.6, 0, Math.PI, 0);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  stroke(ctx, hair.highlight, 1.4);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - rx * 0.7 + i * rx * 0.32, cy - ry * 0.85); ctx.quadraticCurveTo(cx - rx * 0.5 + i * rx * 0.32, cy - ry * 0.5, cx - rx * 0.35 + i * rx * 0.32, cy - ry * 0.25); ctx.stroke(); }
  ctx.restore();
}

function drawFace(ctx, head, design, face, costume, ink, rx, ry) {
  const cx = head.x, cy = head.y;
  const eyeY = cy - ry * 0.08, eyeDX = rx * 0.40, eyeW = rx * 0.23, eyeH = ry * 0.17;
  for (const side of ['L', 'R']) {
    const ex = cx + (side === 'L' ? -eyeDX : eyeDX);
    const open = clamp(side === 'L' ? face.eyeOpenL : face.eyeOpenR, 0.03, 1.25);
    ctx.save(); ctx.beginPath(); ctx.rect(ex - eyeW - 1, eyeY - eyeH * 2, eyeW * 2 + 2, eyeH * 2 + 2); ctx.clip();
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeW, eyeH * open, 0, 0, Math.PI * 2); ctx.fillStyle = '#fbf6e9'; ctx.fill(); stroke(ctx, ink, 2.6); ctx.stroke();
    const pupil = face.pupils[side];
    ctx.beginPath(); ctx.arc(ex + pupil.x * eyeW * 0.55, eyeY + pupil.y * eyeH * 0.45, eyeW * 0.38, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + pupil.x * eyeW * 0.55 - 0.8, eyeY + pupil.y * eyeH * 0.45 - 1, eyeW * 0.11, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    // eyelid line
    stroke(ctx, ink, 3); ctx.beginPath(); ctx.moveTo(ex - eyeW, eyeY - eyeH * open * 0.9); ctx.quadraticCurveTo(ex, eyeY - eyeH * open * 1.25, ex + eyeW, eyeY - eyeH * open * 0.9); ctx.stroke();
    // eyebrow
    const brow = side === 'L' ? face.brows.L : face.brows.R;
    const by = eyeY - eyeH * 1.9 - brow * ry * 0.16;
    stroke(ctx, ink, design.face.browShape === 'thick' ? 4.5 : 3);
    ctx.beginPath(); ctx.moveTo(ex - eyeW * 0.95, by + (side === 'L' ? face.brows.angleL : face.brows.angleR) * 0.12);
    ctx.quadraticCurveTo(ex, by - brow * 4, ex + eyeW * 0.95, by - (side === 'L' ? face.brows.angleL : face.brows.angleR) * 0.12); ctx.stroke();
    if (face.tears > 0.3) { ctx.beginPath(); ctx.moveTo(ex, eyeY + eyeH); ctx.lineTo(ex + 1, eyeY + eyeH + 12 * face.tears); stroke(ctx, withAlpha('#6d9ac4', 0.85), 2); ctx.stroke(); }
  }
  // nose
  stroke(ctx, ink, 2.2); ctx.beginPath(); ctx.moveTo(cx + rx * 0.03, cy + ry * 0.02); ctx.quadraticCurveTo(cx + rx * 0.14, cy + ry * 0.28, cx - rx * 0.02, cy + ry * 0.30); ctx.stroke();
  // mouth
  const m = face.mouth, mw = rx * m.width * 2, my = cy + ry * 0.55;
  stroke(ctx, ink, 3.2); ctx.beginPath();
  if (m.shape === 'o') { ctx.ellipse(cx, my + m.open * 4, mw * 0.24, ry * 0.16 * m.open + 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#5a2030'; ctx.fill(); }
  else if (m.shape === 'smile' || m.shape === 'frown' || m.shape === 'line' || m.shape === 'flat') {
    ctx.moveTo(cx - mw / 2, my + m.smile * -3 + m.tremble);
    ctx.quadraticCurveTo(cx, my + m.smile * 12 + m.open * 10 + m.tremble, cx + mw / 2, my + m.smile * -3 + m.tremble);
    if (m.open > 0.2) { ctx.quadraticCurveTo(cx, my - m.smile * 2 + m.open * 3, cx - mw / 2, my + m.smile * -3); ctx.fillStyle = '#7a2a38'; ctx.fill(); }
  } else if (m.shape === 'wave') { ctx.moveTo(cx - mw / 2, my); ctx.quadraticCurveTo(cx - mw * 0.2, my - 5, cx, my + 2); ctx.quadraticCurveTo(cx + mw * 0.25, my + 6, cx + mw / 2, my - 2); }
  else { ctx.moveTo(cx - mw / 2, my + 2); ctx.quadraticCurveTo(cx, my - 3 - m.open * 6, cx + mw / 2, my + 3); }
  ctx.stroke();
  // cheeks / stipple
  if (face.cheeks > 0.1) halftoneRegion(ctx, { x0: cx - rx, y0: cy, x1: cx + rx, y1: cy + ry }, withAlpha('#b6555b', 0.22 * face.cheeks), 5, 1.0,
    (c) => { c.beginPath(); c.ellipse(cx - rx * 0.62, cy + ry * 0.35, rx * 0.28, ry * 0.18, 0, 0, Math.PI * 2); c.ellipse(cx + rx * 0.62, cy + ry * 0.35, rx * 0.28, ry * 0.18, 0, 0, Math.PI * 2); });
  if (design.distinctive === 'freckles') { ctx.fillStyle = withAlpha(ink, 0.5); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(cx - rx * 0.55 + (i % 4) * 6, cy + ry * 0.22 + Math.floor(i / 4) * 5, 1.2, 0, Math.PI * 2); ctx.fill(); } }
  if (design.distinctive === 'round glasses') { stroke(ctx, ink, 2.6); for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * eyeDX, eyeY, eyeW * 1.25, 0, Math.PI * 2); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(cx - eyeDX + eyeW * 1.25, eyeY); ctx.lineTo(cx + eyeDX - eyeW * 1.25, eyeY); ctx.stroke(); }
  if (design.distinctive === 'scar' || design.distinctive === 'dimple') { stroke(ctx, ink, 1.8); ctx.beginPath(); ctx.moveTo(cx + rx * 0.55, cy - ry * 0.3); ctx.lineTo(cx + rx * 0.72, cy + ry * 0.1); ctx.stroke(); }
}

function drawLeg(ctx, pose, side, costume, ink, palette) {
  const hip = pose.points[`hip${side}`], knee = pose.points[`knee${side}`], ankle = pose.points[`ankle${side}`], foot = pose.points[`foot${side}`];
  capsule(ctx, hip, knee, 15, costume.main, ink, 4);
  capsule(ctx, knee, ankle, 12, costume.main, ink, 4);
  // boot / shoe
  poly(ctx, [{ x: ankle.x - 6, y: ankle.y - 2 }, { x: foot.x + 8, y: foot.y - 3 }, { x: foot.x + 9, y: foot.y + 7 }, { x: ankle.x - 7, y: ankle.y + 8 }], costume.shadow, ink, 4);
  // crosshatched illustrated shadow on one side of the leg
  crosshatchRegion(ctx, { x0: Math.min(hip.x, ankle.x) - 20, y0: Math.min(hip.y, ankle.y) - 20, x1: Math.max(hip.x, ankle.x) + 20, y1: Math.max(hip.y, ankle.y) + 20 },
    withAlpha(ink, 0.35), 7, (c) => { c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(knee.x, knee.y); c.lineTo(ankle.x, ankle.y); c.lineTo(ankle.x - 7, ankle.y); c.lineTo(knee.x - 7, knee.y); c.lineTo(hip.x - 7, hip.y); c.closePath(); });
}

function drawArm(ctx, pose, side, costume, ink) {
  const sh = pose.points[`shoulder${side}`], el = pose.points[`elbow${side}`], wr = pose.points[`wrist${side}`], pl = pose.points[`palm${side}`];
  capsule(ctx, sh, el, 13, costume.main, ink, 4);
  capsule(ctx, el, wr, 11, costume.main, ink, 4);
  // cuff
  outlinedLine(ctx, { x: wr.x - (wr.x - el.x) * 0.16, y: wr.y - (wr.y - el.y) * 0.16 }, wr, 13, costume.trim, ink, 2.5);
  // palm
  ctx.save(); ctx.beginPath(); ctx.ellipse(pl.x, pl.y, 7.5, 9, (pose.angles[`wrist${side}`] - 90) * Math.PI / 180, 0, Math.PI * 2);
  ctx.fillStyle = costume.skin; ctx.fill(); stroke(ctx, ink, 3); ctx.stroke(); ctx.restore();
  // individual fingers
  for (const f of pose.fingers[side]) {
    for (let i = 0; i < f.points.length - 1; i++) outlinedLine(ctx, f.points[i], f.points[i + 1], 4.4 - i * 0.6, costume.skin, ink, 2.2);
    ctx.beginPath(); ctx.arc(f.points[3].x, f.points[3].y, 1.6, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  }
}

function drawTorso(ctx, pose, costume, ink, design, palette) {
  const { chest, spine, pelvis, shoulderL, shoulderR } = pose.points;
  const w = Math.abs(shoulderR.x - shoulderL.x) * 0.62 + 9;
  const pts = [
    { x: shoulderL.x - 3, y: shoulderL.y - 3 }, { x: shoulderR.x + 3, y: shoulderR.y - 3 },
    { x: pelvis.x + w * 0.9, y: pelvis.y + 6 }, { x: pelvis.x + w * 0.45, y: pelvis.y + 12 },
    { x: pelvis.x - w * 0.45, y: pelvis.y + 12 }, { x: pelvis.x - w * 0.9, y: pelvis.y + 6 },
  ];
  poly(ctx, pts, costume.main, ink, 5);
  // illustrated shadow + halftone / crosshatch on one flank
  const bbox = { x0: Math.min(...pts.map((p) => p.x)) - 6, y0: Math.min(...pts.map((p) => p.y)) - 6, x1: Math.max(...pts.map((p) => p.x)) + 6, y1: Math.max(...pts.map((p) => p.y)) + 6 };
  const clip = (c) => { c.beginPath(); c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[1].x, pts[1].y); c.lineTo(pts[2].x, pts[2].y); c.lineTo(pts[3].x, pts[3].y); c.lineTo(pts[4].x, pts[4].y); c.lineTo(pts[5].x, pts[5].y); c.closePath(); };
  if (design.clothing.texture === 'crosshatch' || design.clothing.texture === 'fine-lines') crosshatchRegion(ctx, bbox, palette?.crosshatch || withAlpha(ink, 0.4), 7, (c) => { clip(c); });
  halftoneRegion(ctx, bbox, palette?.halftone || withAlpha(ink, 0.25), 6, 1.35, (c) => { c.beginPath(); c.moveTo(pelvis.x + w * 0.15, chest.y); c.lineTo(pelvis.x + w * 0.95, pelvis.y + 12); c.lineTo(pelvis.x + w * 0.45, pelvis.y + 12); c.closePath(); });
  // collar + button row + trim (detailed clothing)
  stroke(ctx, costume.trim, 3.2); ctx.beginPath(); ctx.moveTo(shoulderL.x + 6, shoulderL.y + 2); ctx.lineTo(chest.x, chest.y + 12); ctx.lineTo(shoulderR.x - 6, shoulderR.y + 2); ctx.stroke();
  stroke(ctx, ink, 2.2); ctx.beginPath(); ctx.moveTo(chest.x, chest.y + 8); ctx.lineTo(pelvis.x, pelvis.y + 6); ctx.stroke();
  ctx.fillStyle = costume.trim;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(chest.x + 1.5, chest.y + 16 + i * 10, 2.1, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ink, 1); ctx.stroke(); }
  // belt / sash
  outlinedLine(ctx, { x: pelvis.x - w * 0.8, y: pelvis.y + 3 }, { x: pelvis.x + w * 0.8, y: pelvis.y + 3 }, 4, costume.trim, ink, 2);
}

function drawHead(ctx, pose, design, costume, ink, palette) {
  const head = pose.points.head, neck = pose.points.neck;
  const rx = 19 * (design.proportions?.headHeight || 1), ry = 22 * (design.proportions?.headHeight || 1);
  capsule(ctx, neck, { x: head.x, y: head.y + ry * 0.7 }, 9, costume.skin, ink, 3);
  ctx.save(); headOutline(ctx, head.x, head.y, rx, ry, design.face.shape);
  ctx.fillStyle = costume.skin; ctx.fill(); stroke(ctx, ink, 5); ctx.stroke(); ctx.restore();
  halftoneRegion(ctx, { x0: head.x - rx, y0: head.y - ry, x1: head.x + rx, y1: head.y + ry }, withAlpha(ink, 0.20), 5, 1.0,
    (c) => { c.beginPath(); c.moveTo(head.x + rx * 0.25, head.y - ry); c.lineTo(head.x + rx, head.y - ry * 0.2); c.lineTo(head.x + rx * 0.7, head.y + ry); c.lineTo(head.x + rx * 0.2, head.y + ry); c.closePath(); });
  drawFace(ctx, head, design, pose.face, costume, ink, rx, ry);
  drawHair(ctx, head.x, head.y, rx, ry, { ...design.hair, highlight: costume.hair }, ink);
  // accessories on head
  if (design.accessories.includes('hat')) { poly(ctx, [{ x: head.x - rx * 1.2, y: head.y - ry * 0.9 }, { x: head.x + rx * 1.2, y: head.y - ry * 0.9 }, { x: head.x + rx * 0.8, y: head.y - ry * 1.6 }, { x: head.x - rx * 0.8, y: head.y - ry * 1.6 }], costume.trim, ink, 4); }
}

export function drawCharacter(ctx, opts) {
  const { design, pose, costume, palette, x = 0, y = 0, scale = 1 } = opts;
  const ink = costume?.ink || palette?.ink || INK;
  const c = costume || {
    main: design.costume.main, trim: design.costume.trim, shadow: design.costume.shadow,
    skin: design.face.skinTone, hair: design.hair.color, ink,
  };
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  // contact shadow (illustrated, not soft photo blur)
  ctx.save(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(0, 70, 38, 8, 0, 0, Math.PI * 2); ctx.fillStyle = palette?.shadow || '#2a2230'; ctx.fill(); ctx.restore();
  drawLeg(ctx, pose, 'L', c, ink, palette);
  drawLeg(ctx, pose, 'R', c, ink, palette);
  drawTorso(ctx, pose, c, ink, design, palette);
  drawArm(ctx, pose, 'L', c, ink);
  drawHead(ctx, pose, design, c, ink, palette);
  drawArm(ctx, pose, 'R', c, ink);
  ctx.restore();
}

// Character reference sheet: 3 views, 5 expressions, 5 gestures, colour swatches.
export function drawCharacterSheet(ctx, design, palette, opts = {}) {
  const { width = 900, height = 1200 } = opts;
  const ink = palette.ink || INK;
  ctx.save(); ctx.fillStyle = palette.paper || '#f4ecd8'; ctx.fillRect(0, 0, width, height);
  const costume = { main: design.costume.main, trim: design.costume.trim, shadow: design.costume.shadow,
    skin: design.face.skinTone, hair: design.hair.color, ink };
  const views = [
    { action: 'idle', expression: 'neutral', gesture: 'rest', frame: 0 },
    { action: 'walk', expression: 'curious', gesture: 'open-palm', frame: 12 },
    { action: 'react', expression: 'surprised', gesture: 'point', frame: 22 },
  ];
  views.forEach((v, i) => {
    const pose = poseCharacter(design, { ...v, gaze: { target: i === 2 ? 'other' : 'camera', x: i === 2 ? 0.5 : 0, y: 0 }, intensity: 0.5 });
    drawCharacter(ctx, { design, pose, costume, palette, x: 180 + i * 270, y: 330, scale: 2.0 });
  });
  const expressions = ['happy', 'angry', 'surprised', 'fearful', 'laughing'];
  expressions.forEach((e, i) => {
    const pose = poseCharacter(design, { frame: i * 7, action: 'idle', expression: e, gesture: 'rest', gaze: { x: 0, y: 0 }, intensity: 0.5 });
    drawCharacter(ctx, { design, pose, costume, palette, x: 110 + i * 175, y: 690, scale: 0.92 });
  });
  const gestures = ['rest', 'point', 'wave', 'fist', 'open-palm'];
  gestures.forEach((g, i) => {
    const pose = poseCharacter(design, { frame: 10 + i * 5, action: g === 'point' ? 'point' : 'idle', expression: 'neutral', gesture: g, gaze: { x: 0, y: 0 }, intensity: 0.5 });
    drawCharacter(ctx, { design, pose, costume, palette, x: 110 + i * 175, y: 940, scale: 0.92 });
  });
  [costume.main, costume.trim, costume.shadow, design.face.skinTone, design.hair.color, palette.accent].forEach((col, i) => {
    ctx.fillStyle = col; ctx.fillRect(110 + i * 110, 1120, 96, 48); stroke(ctx, ink, 2); ctx.strokeRect(110 + i * 110, 1120, 96, 48);
  });
  stroke(ctx, ink, 3); ctx.strokeRect(16, 16, width - 32, height - 32);
  ctx.restore();
  return { characterId: design.id, consistencyHash: design.consistencyHash, views: views.length, expressions: expressions.length, gestures: gestures.length };
}
