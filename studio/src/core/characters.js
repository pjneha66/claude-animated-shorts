// Reusable, seeded character design. A design is created ONCE per script and
// reused by every scene/shot, so appearance never changes between shots.
import { hashString, mulberry32, pick, hsl, slug, clamp } from './util.js';

const FACES = ['oval', 'round', 'square-jaw', 'heart', 'long', 'bean'];
const HAIR = ['swept-blond', 'tousled-curls', 'bob', 'spiky', 'braided', 'slicked', 'wavy', 'close-cropped', 'topknot'];
const EYES = ['almond', 'wide', 'narrow', 'drooping', 'sharp'];
const BROWS = ['arched', 'thick', 'thin', 'angled', 'soft'];
const NOSES = ['small', 'straight', 'hooked', 'button', 'long'];
const CLOTHING = ['doublet', 'coat', 'tunic', 'jacket', 'dress', 'armor', 'cape', 'workshirt', 'uniform', 'robe'];
const TEXTURES = ['crosshatch', 'halftone', 'fine-lines', 'weave', 'stipple'];
const ACCESSORIES = ['brooch', 'belt', 'scarf', 'hat', 'gloves', 'medal', 'satchel', 'ribbon', 'boots', 'collar', 'none'];
const PERSONALITY = ['bold', 'shy', 'curious', 'stern', 'playful', 'wary', 'gentle', 'proud', 'restless'];
const MARKS = ['freckles', 'scar', 'beauty-mark', 'round glasses', 'ink-dot beauty spot', 'dimple', 'none'];

export function designCharacters(analysis) {
  const base = mulberry32(analysis.seed);
  const storyHue = analysis.seed % 360;
  return analysis.characters.slice(0, 6).map((mention, i) => {
    const seed = hashString(`${analysis.seed}|${mention.name}|${i}`);
    const rnd = mulberry32(seed);
    const hue = (storyHue + i * 73 + Math.floor(rnd() * 25)) % 360;
    const face = pick(FACES, rnd), hair = pick(HAIR, rnd);
    const clothing = pick(CLOTHING, rnd);
    const design = {
      id: mention.id || slug(mention.name), name: mention.name, role: mention.role, seed,
      face: { shape: face, eyeShape: pick(EYES, rnd), browShape: pick(BROWS, rnd), nose: pick(NOSES, rnd), skinTone: hsl((18 + rnd() * 22) | 0, 0.28 + rnd() * 0.22, 0.72 + rnd() * 0.12) },
      hair: { style: hair, color: hsl((20 + rnd() * 36) | 0, 0.35 + rnd() * 0.35, 0.22 + rnd() * 0.35), highlight: hsl((38 + rnd() * 18) | 0, 0.6, 0.6) },
      proportions: { headHeight: +(0.92 + rnd() * 0.28).toFixed(2), height: +(3.3 + rnd() * 0.7).toFixed(2), shoulder: +(0.9 + rnd() * 0.35).toFixed(2), legRatio: +(0.44 + rnd() * 0.09).toFixed(2), build: pick(['slim', 'average', 'stout'], rnd) },
      clothing: {
        type: clothing, texture: pick(TEXTURES, rnd),
        primaryHue: hue, secondaryHue: (hue + 35 + Math.floor(rnd() * 90)) % 360,
        saturation: +(0.42 + rnd() * 0.32).toFixed(2), lightness: +(0.28 + rnd() * 0.22).toFixed(2),
        details: [pick(['gold trim', 'button row', 'stitched seam', 'embroidered panel', 'contrast collar'], rnd), pick(['cuffs', 'pockets', 'epaulets', 'pleats', 'sash'], rnd)],
      },
      accessories: [...new Set([pick(ACCESSORIES, rnd), pick(ACCESSORIES, rnd)])].filter((a) => a !== 'none'),
      personality: [pick(PERSONALITY, rnd), pick(PERSONALITY, rnd)],
      distinctive: pick(MARKS, rnd),
      colorIdentity: { hue, accentHue: (hue + 150) % 360, ink: '#141018' },
      // Fixed costume colours: SceneColorDirector may modulate lighting, never the hue.
      costume: {
        main: hsl(hue, 0.42 + rnd() * 0.3, 0.28 + rnd() * 0.2),
        trim: hsl((hue + 35 + rnd() * 80) | 0, 0.5, 0.62),
        shadow: hsl(hue, 0.38, 0.16),
      },
    };
    design.consistencyHash = hashString(JSON.stringify([design.face, design.hair, design.proportions, design.clothing, design.accessories, design.costume]));
    return design;
  });
}

export function characterSheetSpec(design) {
  return {
    characterId: design.id, consistencyHash: design.consistencyHash,
    views: ['front', 'three-quarter', 'profile'],
    expressions: ['neutral', 'happy', 'surprised', 'angry', 'fearful'],
    gestures: ['rest', 'open-palm', 'point', 'wave', 'fist'],
    walkCycle: 'contact / pass / high / pass / contact',
    notes: `Face ${design.face.shape}, hair ${design.hair.style}, ${design.clothing.type} with ${design.clothing.texture}, ${design.distinctive}. Fixed costume hue ${design.colorIdentity.hue}°.`,
  };
}

export function verifyConsistency(designs, scenes) {
  const problems = [];
  for (const d of designs) {
    for (const s of scenes) {
      const c = s.characterColors?.[d.id];
      if (c && c.hue !== d.colorIdentity.hue) problems.push(`${d.id}: costume hue changed in scene ${s.id}`);
    }
  }
  return { ok: problems.length === 0, problems, checked: designs.length * scenes.length };
}

export const EXPRESSION_SET = ['happy', 'sad', 'angry', 'surprised', 'confused', 'curious', 'fearful', 'excited', 'disgusted', 'crying', 'laughing', 'neutral'];
export const GESTURE_SET = ['rest', 'point', 'wave', 'open-palm', 'fist', 'counting', 'hold', 'two-hand', 'emotional'];
export const ACTION_SET = ['idle', 'walk', 'run', 'react', 'sit', 'stand', 'point', 'hold', 'look-at', 'interact', 'fall'];
