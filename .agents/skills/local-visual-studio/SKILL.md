---
name: local-visual-studio
description: Build a fully local, visual-only cinematic animated short from a script and deliver a finished SILENT MP4 (no audio, subtitles or captions). Use when the user asks for the LOCAL CINEMATIC VISUAL ANIMATION STUDIO, a comic-ink 2D-character-in-3D-world animation, script-aware colour direction, character reference sheets, a rigged character, local Remotion/Three.js rendering, visual QA, or the 21 studio rules. Never use it for voice, TTS, music, SFX, subtitles or dialogue — those are prohibited by STUDIO_RULES.md.
---

# LOCAL CINEMATIC VISUAL ANIMATION STUDIO — Antigravity entry point

**Binding:** read `../../../STUDIO_RULES.md` first and follow all 21 rules line by line. Machine-readable
copy: `../../../studio/src/core/rules.js`. Verify with `node src/cli/studio.mjs rules --check` from `studio/`.

## Absolute constraints
- **Visual-only output**: the only deliverable is a clean silent H.264 MP4 with **zero audio streams**.
  Never implement or call voice-over, TTS, speech synthesis, dialogue recording, lip-sync with audio,
  transcription, music, SFX, audio mixing/mastering, subtitles, captions, SRT/VTT or dialogue text overlays.
  The user adds audio and subtitles later.
- **Absolute local execution**: characters, image processing, animation, rigging, environments, camera,
  rendering, frame processing and encoding all run on the Mac. No cloud rendering, remote GPU, paid API,
  external image generation, subscriptions or uploads. Works offline. Optional local AI is loopback-only and
  never required.
- Hardware-detect first (`npm run doctor`); never assume GPU acceleration. CPU/software fallback is required.
- Never delete user data. Verify with *real rendered frames*; never mark a feature complete untested.

## Working system (already built)
`../../../studio/` — see `../../../studio/README.md` for the full module map and commands.

```bash
cd ../../../studio
npm install                                        # local packages, no cloud services
npm run doctor                                     # hardware + safe backend
npm run rules -- --check                            # 21-rule visual-only enforcement
npm test                                           # 11 verification tests
npm run qa                                         # 15 real rendered QA scenes
node src/cli/studio.mjs render presets/scripts/bridge.txt --seconds 60 --quality high --backend chrome
```

Backends: `chrome` = Remotion + Three.js + local Chromium + local FFmpeg (after Metal is verified);
`software` = Canvas2D CPU fallback. Both end with `verifySilentMp4()`.

## Delivered evidence (tracked in the repo)
`../../../studio/deliverables/`: `final-silent-short.mp4` (1080×1920, 30 fps, 60.00 s, 1800 frames,
H.264, verified audio=false / subtitle=false), `character-reference-sheet.png`, `color-direction.json`,
`plan.json`, `qa-contact-sheet.png`, `qa-report.json` (15/15), `final-contact-sheet.png` (7 decoded frames).

## Shared local Mac runtime
`../../../AGENTS.md` and `../../../docs/ANTIGRAVITY_LOCAL_AI.md` list the already-installed stack
(Chrome Headless Metal CDP `:9228`, `/opt/homebrew/bin/ffmpeg`, esbuild darwin-arm64, Node v22,
`token-saver`, `sips`, Apple Vision OCR, Obsidian CLI). The stdio MCP server in
`../../../tools/mac_local.py --mcp` also exposes `studio_pipeline`, `studio_rules_check` and
`studio_deliverables`. No Ollama, LM Studio or new LLM server is required.

Invoke explicitly with `/local-visual-studio` if the skill is not picked up automatically.
