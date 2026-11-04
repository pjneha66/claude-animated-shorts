// Render review stills from a Remotion project. Cross-platform (macOS / Linux / Windows).
// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]
//
// env:
//   BRIDGE_ENTRY         entry point           (default src/index.ts)
//   BRIDGE_COMPOSITION   composition id       (default BridgeShort)
//   REMOTION_PUBLIC_DIR  public/ folder       (default public)
//   REMOTION_TMP         temp folder for bundles - PUT THIS ON A BIG DRIVE
//   CHROME_PATH          Chrome / Chromium executable (auto-detected on macOS otherwise)
//   REMOTION_GL          chromium GL backend  (default angle; Apple Metal on macOS)
//
// On a Mac mini M4 the same look checks can also be done through the local
// Chrome Headless + Apple Metal CDP renderer (:9228); see docs/ANTIGRAVITY_LOCAL_AI.md.
import fs from "node:fs";
// Every bundle copies public/ (~1.3 GB) into the temp dir and never deletes it.
// TMPDIR is what Node/Remotion honours on macOS; TEMP/TMP cover Windows.
if (process.env.REMOTION_TMP) {
  fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP;
}
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
if (!prefix || !frames) {
  console.error("usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]");
  process.exit(1);
}

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
// Undefined lets Remotion use its own bundled Chrome Headless Shell.
const browserExecutable = process.env.CHROME_PATH
  || CHROME_CANDIDATES.find((p) => fs.existsSync(p))
  || undefined;
const chromiumOptions = { gl: process.env.REMOTION_GL || "angle" };
const serveUrl = await bundle({
  entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"),
  publicDir: path.resolve(process.env.REMOTION_PUBLIC_DIR || "public"),
});
const composition = await selectComposition({
  serveUrl,
  id: process.env.BRIDGE_COMPOSITION || "BridgeShort",
  browserExecutable,
  chromiumOptions,
});
const onBrowserLog = (l) => {
  if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300));
};
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`,
    imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
