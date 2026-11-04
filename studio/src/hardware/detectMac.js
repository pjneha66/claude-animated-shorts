// Local environment audit. Never assumes GPU acceleration: Metal is only marked
// verified when macOS actually reports it. Everything here is read-only.
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function run(cmd, args = [], timeout = 4000) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
function which(name) { return run('sh', ['-c', `command -v ${name}`]) || null; }
function moduleVersion(name) { try { return require(`${name}/package.json`).version; } catch { return null; } }

export function detectHardware() {
  const platform = process.platform;
  const isMac = platform === 'darwin';
  const arch = os.arch();
  const cpuCores = os.cpus()?.length || 1;
  const cpuModel = os.cpus()?.[0]?.model || 'unknown';
  const macOSVersion = isMac ? run('sw_vers', ['-productVersion']) : null;
  const appleSilicon = isMac && /arm64|aarch64/i.test(arch + ' ' + (run('uname', ['-m']) || ''));
  const ramBytes = isMac ? Number(run('sysctl', ['-n', 'hw.memsize']) || 0) : os.totalmem();
  let ramAvailableBytes = os.freemem();
  if (isMac) {
    const vm = run('vm_stat') || '';
    const free = /Pages free:\s+(\d+)/.exec(vm), inactive = /Pages inactive:\s+(\d+)/.exec(vm);
    if (free) ramAvailableBytes = (Number(free[1]) + (inactive ? Number(inactive[1]) : 0)) * 16384;
  }
  let diskFreeBytes = 0;
  try { const s = fs.statfsSync(process.cwd()); diskFreeBytes = s.bavail * s.bsize; } catch {}
  let gpu = { verified: false, metal: false, renderer: 'unknown', note: 'GPU not verified; CPU/software fallback available' };
  if (isMac) {
    const sp = run('system_profiler', ['SPDisplaysDataType'], 6000) || '';
    const metal = /(Metal\s*(?:Support|Family|2|3)?\s*:\s*(?:Supported|Metal\s*[23]?))/i.test(sp) || /\bMetal\s*[23]\b/i.test(sp);
    const renderer = /Chipset Model:\s*([^\n]+)/.exec(sp)?.[1] || (appleSilicon ? 'Apple Silicon (integrated)' : 'unknown');
    gpu = { verified: metal, metal, renderer, note: metal ? 'Metal reported by system_profiler' : 'Metal not reported; use CPU/software fallback' };
  }
  const chromeCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ];
  const chromium = process.env.CHROME_PATH || chromeCandidates.find((p) => fs.existsSync(p)) || which('google-chrome') || which('chromium') || null;
  const tools = {
    node: run('node', ['-v']), npm: run('npm', ['-v']), pnpm: run('pnpm', ['-v']),
    python: run('python3', ['--version']) || run('python', ['--version']),
    ffmpeg: which('ffmpeg'), ffprobe: which('ffprobe'), chromium,
    remotion: moduleVersion('remotion'), three: moduleVersion('three'), canvas: moduleVersion('@napi-rs/canvas'),
    ollama: which('ollama'), tokenSaver: which('token-saver') || (fs.existsSync(`${os.homedir()}/.local/bin/token-saver`) ? `${os.homedir()}/.local/bin/token-saver` : null),
    sips: isMac ? '/usr/bin/sips' : null,
  };
  return {
    platform, isMac, macOSVersion, arch, appleSilicon, cpuCores, cpuModel,
    ramBytes, ramAvailableBytes, diskFreeBytes, gpu, tools,
    safeBackend: gpu.verified ? 'chrome' : 'software',
    notes: [
      'Frame generation, rendering and encoding all execute on this machine.',
      'No cloud rendering, remote GPU, paid API or asset upload is performed.',
      gpu.verified ? 'Metal verified.' : 'GPU not verified; CPU/software fallback is used by default.',
    ],
  };
}

// Optional local inference engines. Loopback / .local only; never external.
export async function detectLocalModels() {
  const found = [];
  const candidates = [process.env.LOCAL_AI_URL, 'http://127.0.0.1:11434', 'http://127.0.0.1:1234', 'http://127.0.0.1:8000', 'http://127.0.0.1:8080']
    .filter(Boolean).map((u) => u.replace(/\/$/, ''));
  const seen = new Set();
  for (const base of candidates) {
    const url = base.endsWith('/v1') ? base : `${base}/v1`;
    if (seen.has(url)) continue; seen.add(url);
    try {
      const res = await fetch(`${url}/models`, { signal: AbortSignal.timeout(600) });
      if (!res.ok) continue;
      const data = await res.json();
      const models = (data.data || data.models || []).map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
      if (models.length) found.push({ endpoint: url, models });
    } catch {}
  }
  return found;
}

export function doctorReport(hw, models = []) {
  const missing = Object.entries(hw.tools).filter(([k, v]) => !v && !['pnpm', 'remotion', 'three', 'ollama', 'tokenSaver', 'sips', 'ffprobe', 'canvas'].includes(k)).map(([k]) => k);
  return {
    summary: `${hw.platform} ${hw.arch}${hw.macOSVersion ? ' macOS ' + hw.macOSVersion : ''}, ${hw.cpuCores} cores, ${(hw.ramBytes / 1e9).toFixed(1)} GB RAM, ${(hw.diskFreeBytes / 1e9).toFixed(1)} GB free`,
    gpu: hw.gpu, safeBackend: hw.safeBackend, missingRequired: missing,
    localModels: models.length ? models : 'none detected (studio works without local AI)',
    offlineCapable: true,
  };
}
