// Deterministic, fully local script analysis. Optional local inference engine is
// a pure enhancement: if it is absent or slow, analysis still completes offline.
import { clamp, hashString, slug } from './util.js';

const LEX = {
  genre: {
    horror: ['ghost', 'haunt', 'dread', 'grave', 'crypt', 'shadow', 'nightmare', 'blood', 'eerie', 'monster'],
    romance: ['love', 'kiss', 'heart', 'embrace', 'promise', 'rose', 'together', 'tender', 'wedding'],
    fantasy: ['dragon', 'magic', 'kingdom', 'spell', 'quest', 'wizard', 'enchanted', 'fairy', 'portal'],
    historical: ['century', 'soldier', 'bridge', 'battle', 'empire', 'victorian', 'ancient', 'king', 'reign', '1831'],
    action: ['chase', 'race', 'explosion', 'fight', 'charge', 'crash', 'sprint', 'leap', 'collapse', 'march'],
    mystery: ['clue', 'secret', 'missing', 'detective', 'hidden', 'mystery', 'locked', 'whisper', 'footprint'],
    comedy: ['laugh', 'joke', 'silly', 'clumsy', 'accident', 'funny', 'oops', 'pratfall', 'mix-up'],
  },
  atmosphere: {
    ominous: ['gloom', 'silent', 'cold', 'fog', 'creak', 'empty', 'loom', 'unsettling', 'ominous'],
    warm: ['warm', 'golden', 'sunny', 'bright', 'gentle', 'soft', 'cozy', 'glow'],
    epic: ['vast', 'grand', 'thunder', 'crowd', 'monument', 'banner', 'triumph'],
    intimate: ['quiet', 'small', 'close', 'whisper', 'alone', 'stillness'],
    chaotic: ['panic', 'sudden', 'splinter', 'shatter', 'stampede', 'tumult'],
  },
  timeOfDay: {
    dawn: ['dawn', 'sunrise', 'first light', 'morning'],
    day: ['noon', 'midday', 'afternoon', 'daylight', 'day'],
    sunset: ['sunset', 'dusk', 'golden hour', 'evening'],
    night: ['night', 'midnight', 'moon', 'dark', 'stars'],
  },
  weather: {
    clear: ['clear', 'bright', 'sunny', 'calm'],
    rain: ['rain', 'storm', 'drizzle', 'wet', 'thunder'],
    fog: ['fog', 'mist', 'haze', 'smog'],
    snow: ['snow', 'frost', 'blizzard', 'ice'],
    wind: ['wind', 'gale', 'gust'],
  },
  season: { spring: ['spring', 'blossom'], summer: ['summer', 'heat'], autumn: ['autumn', 'fall', 'leaves'], winter: ['winter', 'frost', 'snow'] },
  tone: {
    joyful: ['joy', 'delight', 'laugh', 'triumph', 'happy', 'wonder'],
    fearful: ['fear', 'terror', 'dread', 'panic', 'afraid'],
    melancholy: ['sad', 'loss', 'grief', 'lonely', 'sorry'],
    curious: ['curious', 'wonder', 'discover', 'notice', 'question'],
    angry: ['anger', 'fury', 'rage', 'shout'],
    tense: ['tense', 'wait', 'hold', 'tight', 'edge'],
    surprised: ['sudden', 'shock', 'gasp', 'astonish'],
  },
  lightingHint: {
    candlelight: ['candle', 'lantern', 'lamplight'],
    firelight: ['fire', 'flame', 'ember', 'bonfire'],
    moonlight: ['moonlight', 'moon'],
    spotlight: ['spotlight', 'beam', 'stage'],
    interior: ['inside', 'room', 'hall', 'interior', 'window'],
  },
  location: {
    city: ['street', 'city', 'town', 'square', 'market', 'bridge', 'buildings'],
    forest: ['forest', 'wood', 'trees', 'clearing'],
    sea: ['sea', 'river', 'harbour', 'harbor', 'shore', 'boat'],
    interior: ['room', 'hall', 'parlour', 'parlor', 'workshop', 'library'],
    mountain: ['mountain', 'cliff', 'peak', 'valley'],
    battlefield: ['field', 'battle', 'camp', 'trench'],
  },
  period: {
    ancient: ['ancient', 'rome', 'greek', 'pharaoh'],
    medieval: ['medieval', 'castle', 'knight', 'kingdom', 'crown'],
    victorian: ['victorian', '1831', '19th', 'gaslight', 'carriage', 'industrial'],
    modern: ['modern', 'today', 'car', 'phone', 'city'],
    future: ['future', 'space', 'robot', 'starship'],
  },
};

const STOP = new Set(['The', 'And', 'But', 'Then', 'Suddenly', 'Luckily', 'Unluckily', 'In', 'On', 'At', 'A', 'An', 'It', 'He', 'She', 'They', 'This', 'That', 'One', 'When', 'After', 'Before', 'By', 'From', 'With', 'His', 'Her', 'Their', 'Our', 'Not', 'No', 'So', 'Just', 'Still', 'As', 'While', 'For', 'Of', 'To', 'Into', 'Over']);
const ACTION_WORDS = ['walk', 'walked', 'march', 'run', 'ran', 'rush', 'point', 'pointed', 'look', 'looked', 'gaze', 'fall', 'fell', 'crack', 'break', 'broke', 'turn', 'turned', 'reach', 'reached', 'sit', 'stood', 'stand', 'grab', 'hold', 'held', 'wave', 'waved', 'step', 'stepped', 'lean', 'stare', 'raise', 'lift', 'drop', 'open', 'close', 'kneel', 'jump', 'leap', 'discover', 'hide'];

function score(text, words) {
  let n = 0;
  for (const w of words) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    n += (text.match(re) || []).length;
  }
  return n;
}
function best(text, table, fallback) {
  const entries = Object.entries(table).map(([k, words]) => [k, score(text, words)]);
  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0) || 1;
  const weights = Object.fromEntries(entries.map(([k, v]) => [k, +(v / total).toFixed(3)]));
  return { primary: entries[0][1] > 0 ? entries[0][0] : fallback, weights, confidence: +(entries[0][1] / Math.max(1, (text.match(/\S+/g) || []).length / 40)).toFixed(3) };
}

const NON_PERSON_NEXT = new Set(['was', 'were', 'is', 'are', 'be', 'been', 'had', 'has', 'have', 'with', 'of', 'in', 'at', 'on', 'and', 'but', 'the', 'a', 'an', 'to', 'for', 'by', 'from', 'that', 'which', 'it', 'its', 'his', 'her', 'their', 'as', 'while', 'into', 'over']);
const PERSON_VERBS = new Set(['waited', 'arrived', 'climbed', 'looked', 'pointed', 'turned', 'sat', 'laughed', 'smiled', 'reached', 'held', 'walked', 'ran', 'marched', 'waved', 'opened', 'closed', 'gasped', 'stared', 'leaned', 'stepped', 'kneeled', 'nodded', 'noticed', 'discovered', 'said', 'asked', 'stood', 'fell', 'went', 'came', 'saw', 'knew', 'felt', 'took', 'gave', 'made', 'put', 'wrote', 'drifted', 'crossed', 'began', 'folded', 'changed', 'recorded']);

function identifyCharacters(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  // First line is usually a title; exclude its words from character candidates.
  const body = sentences.slice(1).join(' ');
  const titleWords = new Set((sentences[0] || '').match(/\b[A-Za-z]{3,}\b/g)?.map((w) => w.toLowerCase()) || []);
  const found = new Map();
  // A person is a capitalised token followed by a verb-like word ("Mara climbed").
  const re = /\b([A-Z][a-z]{2,})[,;]?\s+([a-z][a-z-]+)/g;
  let m;
  while ((m = re.exec(body))) {
    const name = m[1], next = m[2];
    if (STOP.has(name) || titleWords.has(name.toLowerCase()) || NON_PERSON_NEXT.has(next)) continue;
    if (PERSON_VERBS.has(next) || /(?:ed|ing)$/.test(next)) found.set(name, (found.get(name) || 0) + 1);
  }
  const roles = [];
  for (const [name, count] of [...found.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    roles.push({ name, id: slug(name), role: roles.length === 0 ? 'protagonist' : 'supporting', mentions: count });
  }
  if (!roles.length) {
    // No named people: derive a consistent role from the story's own nouns.
    const role = /(soldiers?|keeper|child|king|queen|sailor|detective|stranger|traveller|traveler|boy|girl|man|woman|worker|guard)/i.exec(text);
    const label = role ? role[1].replace(/s$/, '') : 'Wanderer';
    const name = label[0].toUpperCase() + label.slice(1);
    roles.push({ name, id: slug(name), role: 'protagonist', mentions: 1, inferred: true });
  }
  return roles;
}

export function analyzeScript(scriptText, options = {}) {
  const text = String(scriptText || '').replace(/\r/g, '').trim();
  if (!text) throw new Error('Empty script');
  const lower = text.toLowerCase();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const seed = hashString(text);
  const characters = identifyCharacters(text);
  const picks = (table, fallback) => best(lower, table, fallback);
  const genre = picks(LEX.genre, 'drama');
  const atmosphere = picks(LEX.atmosphere, 'intimate');
  const timeOfDay = picks(LEX.timeOfDay, 'day');
  const weather = picks(LEX.weather, 'clear');
  const season = picks(LEX.season, 'summer');
  const tone = picks(LEX.tone, 'curious');
  const lightingHint = picks(LEX.lightingHint, 'daylight');
  const location = picks(LEX.location, 'city');
  const period = picks(LEX.period, 'victorian');
  const actions = [...new Set(ACTION_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower)))];
  const beats = [];
  const groupSize = Math.max(1, Math.ceil(sentences.length / 8));
  for (let i = 0; i < sentences.length; i += groupSize) {
    const chunk = sentences.slice(i, i + groupSize).join(' ');
    beats.push({
      id: beats.length + 1, text: chunk, wordCount: chunk.split(/\s+/).length,
      intensity: clamp(0.28 + (i / Math.max(1, sentences.length)) * 0.62 + score(chunk.toLowerCase(), ['sudden', 'crash', 'break', 'impact', 'shatter', 'fall']) * 0.08, 0, 1),
      emotion: best(chunk.toLowerCase(), LEX.tone, tone.primary).primary,
      actions: ACTION_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(chunk.toLowerCase())),
    });
  }
  return {
    title: options.title || (sentences[0] || text).slice(0, 64).replace(/[.!?]$/, ''),
    seed, wordCount: words.length, sentences, characters, actions, beats,
    genre, atmosphere, timeOfDay, weather, season, tone, lightingHint, location, period,
    sceneIntensity: clamp(0.35 + words.filter((w) => /[!?]/.test(w)).length / 30, 0, 1),
    source: 'deterministic-local', ai: { used: false, reason: 'not requested' },
  };
}

// Optional local inference engine. Only loopback / .local hosts are ever contacted.
export async function enrichWithLocalAI(analysis, scriptText) {
  const base = process.env.LOCAL_AI_URL;
  if (!base) return { ...analysis, ai: { used: false, reason: 'LOCAL_AI_URL unset' } };
  let host;
  try { host = new URL(base).hostname; } catch { return { ...analysis, ai: { used: false, reason: 'bad URL' } }; }
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  if (!local) return { ...analysis, ai: { used: false, reason: 'non-local host refused' } };
  const model = process.env.LOCAL_AI_MODEL || 'local-model';
  const prompt = `Return ONLY compact JSON with keys genre, atmosphere, timeOfDay, weather, season, tone, location, period, characters (array of names). Script: ${scriptText.slice(0, 3000)}`;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, temperature: 0.2, max_tokens: 400 }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = JSON.parse(raw.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}'));
    const merged = { ...analysis };
    for (const k of ['genre', 'atmosphere', 'timeOfDay', 'weather', 'season', 'tone', 'location', 'period']) {
      if (typeof json[k] === 'string') merged[k] = { ...analysis[k], primary: json[k], aiRefined: true };
    }
    if (Array.isArray(json.characters) && json.characters.length) {
      merged.characters = json.characters.slice(0, 6).map((n, i) => ({ name: String(n), id: slug(String(n)), role: i === 0 ? 'protagonist' : 'supporting', mentions: 1, aiRefined: true }));
    }
    return { ...merged, ai: { used: true, model, host } };
  } catch (e) {
    return { ...analysis, ai: { used: false, reason: String(e.message || e).slice(0, 120) } };
  }
}
