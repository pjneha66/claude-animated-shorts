// Machine-readable form of the 21 studio rules. The full line-by-line text is STUDIO_RULES.md.
// This module is what the CLI and QA actually enforce.

export const VISUAL_ONLY = Object.freeze({
  audio: false, subtitles: false, captions: false, textOverlays: false,
  voiceOver: false, tts: false, music: false, sfx: false, lipSync: false,
});

export const RULES = [
  '1. Absolute local execution: characters, image processing, animation, rigging, environments, cameras, rendering, frame processing and encoding all run on the Mac. No cloud, no remote GPU, no paid APIs, no uploads. Works offline after setup.',
  '2. Visual style reference: vintage American comic-book illustration — thick black ink outlines, cross-hatching, Ben-Day halftone, illustrated shadows, detailed clothing, expressive faces, printed-paper texture, dramatic compositions. Technique only; never lock the palette.',
  '3. Dynamic colour direction: SceneColorDirector analyses genre, atmosphere, location, period, time of day, weather, season, character identity, emotion, intensity and lighting; palettes are computed per scene, not fixed presets.',
  '4. Script-to-visual pipeline: script → analysis → characters → design → style → colour → environment → breakdown → composition → rigging → body/facial/hand animation → camera → lighting/FX → local render → visual QA → silent MP4.',
  '5. Character design: unique face, hair, proportions, clothing, accessories, personality, marks and colour identity; reference sheets first; appearance never changes between shots.',
  '6. Complete rig: head rotation/tilt/neck; eyes/pupils/lids/brows/mouth/cheeks; spine/chest/abdomen/pelvis/shoulders; upper arms/elbows/forearms/wrists/palms/individual fingers; thighs/knees/shins/ankles/feet.',
  '7. Advanced facial animation: blinking, independent pupils, looking around/at objects/at characters, eye contact, squint, widen, asymmetric brows, 11 expressions, emotional mouth shapes, natural rest. No dialogue lip-sync.',
  '8. Hand/finger animation: point, wave, open palm, fist, counting, finger articulation, wrist rotation, holding, two-hand gestures, rest and emotional gestures; hands always connected to arms, never frozen in important actions.',
  '9. Full body animation: walk, run, idle, reactions, interactions with anticipation, follow-through, overlap, ease-in/out, secondary motion, weight transfer, foot-ground contact.',
  '10. Cinematic camera engine: dolly, push-in, pull-back, tracking, pan, tilt, crane, orbit, over-the-shoulder, close-up, extreme close-up, wide, low/high angle, follow, reveal, reaction — smooth, purposeful interpolation only.',
  '11. Hybrid: 2D comic characters + Three.js 3D environments with depth, foreground/background layers, parallax, perspective, shadows, atmosphere, lighting and depth of field.',
  '12. Dynamic lighting: daylight, sunset, sunrise, moonlight, night, candlelight, firelight, interior, spotlights, fog, haze and environmental shadows, adapted to the scene palette.',
  '13. Comic VFX: halftone, ink outlines, cross-hatching, speed lines, impact bursts, illustrated smoke, dust, motion streaks, ink splashes, paper texture, comic transitions, dramatic shadows.',
  '14. Local Mac render engine: script composition → frame calculation → Three.js → local Chromium → Remotion frames → local frame processing → local FFmpeg → silent MP4. No cloud.',
  '15. Hardware detection: macOS version, arch, Apple Silicon, RAM/available RAM, disk, GPU, Metal, Node, npm, pnpm, Python, FFmpeg, Chromium, Remotion, Three.js, Ollama. Verify GPU, never assume it; CPU fallback.',
  '16. Optional local AI: detect local inference engines/models, optionally use them for planning. The renderer works with AI unavailable. No external AI API calls.',
  '17. Visual QA: 15 automated test scenes; render representative frames; inspect real images; fix static faces, broken joints, frozen hands, clipping, proportions, camera glitches, colour inconsistencies, artifacts. No feature is done untested.',
  '18. Local performance: reuse geometries/materials/textures, manage memory and concurrency, temp render dirs, disk checks, render recovery, LOW/MEDIUM/HIGH quality.',
  '19. Strictly exclude audio and subtitle features of any kind. Output is a clean visual-only MP4 with no audio track, no subtitles, no captions, no dialogue text overlays.',
  '20. Final output: complete scenes, consistent characters, reference sheets, scene colour direction, camera moves, 2D characters, 3D environments, comic VFX and the final silent MP4.',
  '21. Implementation is working code, verified by tests; never stop at planning or documentation.',
];

// Patterns that must never appear in studio source. Used by `studio rules --check` and QA.
export const PROHIBITED = [
  /\btextToSpeech\b/i, /\bspeechSynthesis\b/i, /\bSpeechSynthesisUtterance\b/i,
  /\bAudioContext\b/i, /\bnew Audio\(/i, /\bcreateBufferSource\b/i,
  /\bvoiceOver\b/i, /\bvoice_over\b/i, /\blipSync\b/i, /\blip[- ]sync\b/i,
  /\bbackgroundMusic\b/i, /\bgenerateMusic\b/i, /\bsoundEffect\b/i, /\bsfxGen\b/i,
  /\bsubtitle\b/i, /\b\.srt\b/i, /\b\.vtt\b/i, /\bcaption\b/i,
  /\btranscri(be|ption)\b/i, /\bwhisper\b/i, /\bmix\.wav\b/i, /\bvoice\.wav\b/i,
];

// Strip comments and string literals so prose that *describes* the prohibition
// is not mistaken for code that *implements* it.
function stripNonCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ');
}

export function assertVisualOnly(sourceText, where = 'source') {
  const code = stripNonCode(sourceText);
  const hits = PROHIBITED.filter((re) => re.test(code)).map((re) => String(re));
  if (hits.length) throw new Error(`Visual-only violation in ${where}: ${hits.join(', ')}`);
  return true;
}

export function outputContract(planOrMeta) {
  if (!planOrMeta) return false;
  const m = planOrMeta.meta || planOrMeta;
  return m.silent === true && m.audio === false && m.subtitles === false && m.captions === false;
}
