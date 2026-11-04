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
