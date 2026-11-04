# LOCAL CINEMATIC VISUAL ANIMATION STUDIO

**Visual-only.** Generates complete cinematic 2D-comic-in-3D-world animation from a script and exports a
**silent H.264 MP4**. No audio, no subtitles, no captions, no text overlays are ever produced — audio and
subtitles are added by you later. Everything runs locally on the Mac and works offline after setup.

The binding rules are [`../STUDIO_RULES.md`](../STUDIO_RULES.md) (21 rules, line by line) and their
machine-readable form `src/core/rules.js`.

---

## Quick start (macOS)

```bash
cd studio
npm install                       # local packages only: Remotion, Three.js, React, @napi-rs/canvas
brew install ffmpeg                # or use an existing /opt/homebrew/bin/ffmpeg

node src/cli/studio.mjs doctor                       # phase 2: hardware audit (Metal verified, never assumed)
node src/cli/studio.mjs rules --check               # enforce visual-only source + output contract
node src/cli/studio.mjs qa                          # phase 15-16: 15 real rendered test scenes
node src/cli/studio.mjs design presets/scripts/bridge.txt   # character reference sheets
node src/cli/studio.mjs palette presets/scripts/lighthouse.txt
node src/cli/studio.mjs render presets/scripts/bridge.txt --seconds 60 --quality high --backend chrome
node tests/run_tests.mjs                             # 11 verification tests
```

Default output: `1080×1920`, `9:16`, `30 fps`, `55–70 s`, H.264, **no audio stream**.
Other options: `--aspect 16:9|1:1|9:16`, `--width/--height`, `--fps 30|60`, `--quality low|medium|high`,
`--backend chrome|software`, `--seconds`, `--out`, `--ai`, `--resume`, `--force-quality`.

### Two local backends

| Backend | Stack | When |
|---|---|---|
| `chrome` (primary) | Remotion → Three.js → local Chromium → PNG frames → local FFmpeg | Metal verified by `doctor`; final production renders |
| `software` (fallback) | Canvas2D CPU compositing → raw RGBA frames → local FFmpeg | No verified GPU, quick previews, CI, offline proof |

`doctor` reports `safeBackend`; the renderer never assumes GPU acceleration. Both backends call
`verifySilentMp4()` (local FFmpeg stream inspection) before reporting success.

---

## What is implemented

| Area | Module |
|---|---|
| Script analysis (genre, atmosphere, location, period, time, weather, season, tone, intensity, lighting) | `src/core/scriptAnalysis.js` — deterministic; optional local inference engine (loopback-only) |
| Character identification / design / consistency + reference sheets | `src/core/characters.js`, `src/art/characterArt.js` |
| **SceneColorDirector** — continuous, script-aware per-scene palettes; example genres are soft priors, not presets | `src/core/colorDirector.js` |
| Scene breakdown → shots, composition, actions, expressions, gestures | `src/core/scenePlan.js` |
| Full rig: head/neck/face, spine/chest/abdomen/pelvis/shoulders, upper arms/elbows/forearms/wrists/palms/5 fingers, thighs/knees/lower legs/ankles/feet | `src/rig/characterRig.js` (+ `body.js`, `hands.js`, `facial.js`) |
| 11 expressions, blinking, independent pupils, gaze, asymmetric brows, mouth shapes, tears | `src/rig/facial.js` |
| 9 gestures with per-finger articulation, wrist rotation, two-hand poses | `src/rig/hands.js` |
| Walk / run / idle / reactions / interactions: anticipation, follow-through, overlap, ease, weight transfer | `src/rig/body.js` |
| 18 shot types with smootherstep interpolation and a purpose for every move | `src/camera/cameraEngine.js` |
| 3D env layers, parallax, fog, DOF, ink edges, Three.js geometry | `src/world/environments.js`, `lighting.js`, `ThreeWorld.jsx` |
| 9 lighting conditions adapted to the scene palette | `src/world/lighting.js` |
| 12 comic VFX kinds + shared post shader | `src/fx/comicFx.js`, `src/art/sceneArt.js` |
| Canvas2D comic character painting (thick ink, Ben-Day dots, crosshatch, clothing detail, paper) | `src/art/characterArt.js` |
| Remotion composition (2D cards inside a 3D world) | `src/ShortFilm.jsx`, `src/Root.jsx`, `src/index.js` |
| Mac hardware detection + safe quality + CPU fallback + local model detection | `src/hardware/detectMac.js`, `src/render/renderSpec.js` |
| Local rendering, disk checks, render recovery, silent-output proof | `src/render/softwareRenderer.js`, `remotionRenderer.js`, `renderSpec.js` |
| 15 automated visual QA scenes with **real rendered frames** and pixel inspection | `src/qa/visualQA.js` |
| Rule enforcement and output contract | `src/core/rules.js`, `studio rules --check` |

Style technique comes from `assets/style_reference.jpg` (thick black ink, Ben-Day halftone, crosshatching,
illustrated shadows, printed paper, expressive faces, dramatic composition). **Its colours are never used as a
palette** — `SceneColorDirector` computes a different identity per script and per scene.

---

## Verified results in this workspace

| Check | Result |
|---|---|
| `node tests/run_tests.mjs` | **11 / 11 passed** (analysis, design, colour, plan, rig, camera, lighting/VFX, rules, QA, end-to-end encode) |
| `node src/cli/studio.mjs qa` | **15 / 15 scenes passed**; `deliverables/qa-report.json`, `qa-contact-sheet.png` |
| `studio rules --check` | 23 source files scanned, **0 visual-only violations** |
| Final film | `deliverables/final-silent-short.mp4` — 1080×1920, 30 fps, 60.00 s, 1800 frames, H.264, 32 MB, **audio=false, subtitle=false** |
| Encoded-frame inspection | `deliverables/final-contact-sheet.png` (7 decoded frames) |
| Remotion entry | `npx esbuild src/index.js --bundle …` resolves cleanly (105 KB bundle) |

### Deliverables (tracked, offline-playable)

```
deliverables/final-silent-short.mp4      # final silent animated short
deliverables/character-reference-sheet.png
deliverables/character-sheets.json       # consistency hashes + sheet specs
deliverables/color-direction.json        # 3 scripts -> distinct story hues + per-scene palettes
deliverables/plan.json                   # full 60 s shot plan
deliverables/qa-contact-sheet.png
deliverables/qa-report.json
deliverables/final-contact-sheet.png
```

---

## Offline / privacy guarantees

- No cloud rendering, no remote GPU, no paid API, no external image/video generation, no asset upload.
- `LOCAL_AI_URL` is optional and **only** accepts `localhost`, `127.0.0.1`, `::1` or `*.local` hosts;
  everything works with AI unavailable.
- All frame generation, processing and encoding happen on this machine; `findFfmpeg()` uses a local binary.
- `references/` study images stay local in the outer repo; this studio never sends them anywhere.

## Troubleshooting

| Problem | Fix |
|---|---|
| `FFmpeg not found` | install locally (`brew install ffmpeg`) or set `FFMPEG_BIN=/path/to/ffmpeg` |
| Chrome backend fails | run `npm install` in `studio/`; set `CHROME_PATH`; the CLI falls back to `software` automatically |
| Low RAM/disk | `doctor` shows safe settings; the renderer auto-downgrades quality, use `--force-quality` only on a large external drive |
| Resume a long render | default uses a raw frame cache + `.render-state-*.json`; rerun with `--resume` |
| Disk full | set `REMOTION_TMP=/Volumes/PJ DRIVE/remotion-tmp`; never delete user data manually |

## Richer-film review tools

Run from `studio/` (paths are resolved relative to this directory):

```sh
node src/cli/studio.mjs plan --script presets/scripts/romance.txt
# out/plan.json, out/timing.json, out/camera-report.md
node src/cli/studio.mjs analyze --script presets/scripts/horror.txt --diff presets/scripts/mystery.txt
node src/cli/studio.mjs palette --script presets/scripts/romance.txt --diff presets/scripts/action.txt
node src/cli/studio.mjs plan --script my-story.txt --color my-colors.json
npm run test:review
npm run preview:low -- --script presets/scripts/action.txt
npm run remotion:studio
npm run verify
```

Additional samples: `horror`, `romance`, `fantasy`, `action`, `mystery`.
Palette overrides accept a global `palette` object and `shots` keyed by shot ID:

```json
{"palette":{"paper":"#d8c8b0"},"shots":{"2":{"accent":"#be4878"}}}
```

Unknown palette keys, unknown shot IDs and invalid values fail before rendering.
Overrides change palette fields, not character identity, geometry, lights or numeric colour
parameters derived earlier. They are **not** LUTs or a complete re-direction of lighting.
`palette` exports effective per-shot overrides as well as scene palettes; `--diff` writes
`out/palette-diff.json`. Analysis diffs write changed paths with before/after values.

Timing export uses half-open frame ranges `[in,out)` at the plan's FPS, includes the beat map,
shot boundaries, cast, camera endpoints, look targets, FOV and a 36 mm horizontal lens equivalent.
These are visual edit metadata only. The camera Markdown report explains each shot's purpose and move.

Explicit `--backend chrome` now fails if Chrome/Remotion fails: it never relabels a software render
as Chrome evidence. The Remotion CLI is now a declared development dependency. A LOW software
preview is available independently of GPU support. CDP streaming is available through `npm run preview:cdp` (details below).

`verify` runs doctor → rule scan → existing tests → review tests → 15-scene QA → stream audit.
It stops at a failing stage. Set `VERIFY_MP4` to audit another file; default is the existing
`deliverables/final-silent-short.mp4`. Auditing that existing file does **not** prove it was rebuilt
with current changes. Doctor is informational hardware discovery, not proof of Metal acceleration.

### Current verification scope

The ensemble revision is now rendered. See [`deliverables/README.md`](deliverables/README.md)
for file provenance and precise limits; older single-Soldier reference/hue artifacts are retained as legacy evidence.

- Existing suite: **11/11**; review samples: **5/5**; standalone QA: **15/15**.
- Temporal suite: **900 consecutive rendered frames**, five actions, no detected pose/jitter/luma or
  projected body-bound violations at the recorded limits. Frame traces are in `out/temporal/frame-trace.json`.
- Real Chrome/SwiftShader: perspective parallax and occlusion assertions passed; three interaction
  frames rendered and encoded to a verified silent H.264 clip. This is not Apple Metal verification.
- Final film: newly software-rendered at **1080×1920 / 30 fps / 60 seconds** with Mara, Elise and Tomas.
  `npm run verify` passed after the final encode, including its actual stream audit.
- CDP frame streaming tested against local Chrome `:9228` and the running Remotion Studio page.
- Apple Vision/sips/token-saver/Obsidian: integration code provided; execution remains Mac-only/unverified.

### Temporal review, print controls and local streaming

```sh
npm run qa:temporal
# Optional previous sheet: node src/cli/studio.mjs temporal --script presets/scripts/romance.txt --baseline before.png
node src/cli/studio.mjs compare --script presets/scripts/romance.txt --grade presets/print-grade.json
node src/cli/studio.mjs render --script presets/scripts/romance.txt --grade presets/print-grade.json --backend software --quality low
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run qa:chrome-depth
# Real scene + encoding smoke: node tests/chrome_smoke.mjs (same CHROME_PATH)
npm run preview:cdp
```

`--grade` accepts `{ "global": { ... }, "shots": { "2": { ... } } }`. Controls are contrast/saturation
(0–3), inkLimit (0–1), paperTint (three offsets, −0.5…0.5), and an optional `.cube` LUT path relative
to the JSON file. Cubes must be 2–65 points per axis with a unit input domain. RGB interpolation is
trilinear. Canvas applies the grade to final pixels; Chrome uses a postprocessing effect. Those
pipelines have different lighting/colour-space treatment, so pixel equivalence is not claimed.
`presets/print-grade.json` demonstrates a per-shot LUT. `compare` produces a four-row A/B sheet.
These are print-inspired controls, not a calibrated ICC/CMYK press simulator.

New choreography uses analytic arm IK, shared screen-space hand targets, eased curved reaches,
vertical support-foot contact correction, delayed hair/hem deformation and numeric facial transitions.
Non-close shots have bounded scale and ensemble spacing; close shots focus one face intentionally.
Temporal tests distinguish cuts from within-shot discontinuities and exclude intentional face crops.
The before/after output is a comparison sheet, not an automatic perceptual-regression verdict.

Chrome requires an already installed browser: **no automatic browser download** and no silent
software fallback. `CHROME_GL=swangle` selects CPU WebGL for a non-Mac check. Default Chrome capture
uses bundled `renderStill` frames with a reused browser before FFmpeg encoding. `CHROME_CAPTURE_MODE=sequence`
opts into faster sequence capture; that mode stalled in this sandbox and is not accepted here.
Both encoders publish a verified temporary MP4 atomically, so the verification gate cannot audit a
partially written final file. Keep the default serial Chrome mode until local sequence capture is proven.

For streaming, start local Chrome with `--remote-debugging-port=9228`, open Remotion Studio, then
`npm run preview:cdp`. `CHROME_CDP_URL` must be loopback; `CDP_PAGE_MATCH` optionally selects the page.
The review server listens on `0.0.0.0:3334` and exposes `/stream` (MJPEG) and `/frame.jpg` using
same-origin URLs. This streams the Studio page, including its UI, not clean export frames. Do not
expose the debugging port publicly. Final exports do not contain Studio UI.

### Mac QA and stricter gate

```sh
npm run qa:mac -- out/frames/frame-00000.png out/frames/frame-00450.png
VERIFY_CHROME=1 CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify
# JSON arrays: original frame paths and the installed checkpoint CLI's documented argv
VERIFY_MAC=1 MAC_QA_FRAMES='["out/frames/frame-00000.png"]' \
  OBSIDIAN_CHECKPOINT_ARGV='["node","/path/to/installed/obsidian.js","documented-command"]' npm run verify
```

Configure `OBSIDIAN_CHECKPOINT_ARGV` using the installed local skill's documented command, not the
illustrative placeholder above. No shell interpolation is used. Missing tools/configuration fail the
Mac QA report instead of passing. Apple Vision runs on every **supplied original frame**, before
sips downsampling and token-saver review; text candidates with confidence ≥0.3 fail zero-text QA.
Supply all decoded final frames for full-film OCR coverage; a few supplied frames certify only those
samples. These commands do not claim to have run successfully on macOS from this Linux sandbox.
