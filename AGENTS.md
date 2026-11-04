# Repository rules (Antigravity, Claude Code, Codex, any SKILL.md agent)

## READ FIRST — visual-only studio rules are binding, line by line

[`STUDIO_RULES.md`](STUDIO_RULES.md) holds the 21 rules for **PROJECT: LOCAL CINEMATIC VISUAL ANIMATION
STUDIO**. Every agent must follow them line by line. Machine-readable mirror: `studio/src/core/rules.js`.
Check compliance with `node studio/src/cli/studio.mjs rules --check` (run from `studio/` as `npm run rules -- --check`).

- **Absolute prohibition:** never implement or invoke voice-over, TTS, speech synthesis, dialogue recording,
  lip-sync with audio, transcription, music, SFX, audio mixing/mastering, subtitles, captions, SRT/VTT or
  dialogue text overlays. The studio's only output is a **clean silent MP4** with zero audio streams. The
  user adds audio and subtitles later. Storytelling is visual: actions, expressions, gestures, camera and
  environment. Any legacy audio rules below apply **only** to the old `templates/` skill, never `studio/`.
- **Absolute requirement:** everything runs locally on the Mac — characters, image processing, animation,
  rigging, environments, cameras, rendering, frame processing, encoding. No cloud, no remote GPU, no paid
  API, no uploads. Works offline. Never assume GPU acceleration without verification; CPU/software fallback
  is mandatory.
- **Build the working system, not plans.** Verify with real rendered frames; never mark a feature complete
  without tests. Never delete user data. Hardware-detect before choosing quality.
- Studio guide: `studio/README.md`. Finished film: `studio/deliverables/final-silent-short.mp4`.
  Verification: `node studio/tests/run_tests.mjs`, `node studio/src/cli/studio.mjs qa`.

---

## Always-on rules (legacy `cartoon-3d-short` skill / `templates/`)

This repo also contains the `cartoon-3d-short` **skill**: it makes 55-70 s vertical 2D-characters-in-a-3D-world
animated shorts with three.js + Remotion. It is not a runnable app by itself; the render happens in a
separate Remotion project. On this setup **everything runs on one Mac** — Antigravity is the AI, and
the local Mac runtime does the rendering. No Ollama, LM Studio or new installs are required.

- Canonical skill instructions: `SKILL.md` (11-step pipeline + look values + gotchas).
  Antigravity entry point: `.agents/skills/cartoon-3d-short/SKILL.md`. Setup guide: `docs/ANTIGRAVITY_LOCAL_AI.md`.
- Start every new short by copying `templates/bridge/` into `src/videos/<name>/` of the Remotion project.
- Story, characters and voice must be original. `references/` frames and sheets are private style study
  material: **never attach them to a cloud conversation**. Feed the agent the numeric text in
  `references/reports/*.md` instead; keep the images on the Mac.
- Before multimodal ingestion, downsample contact sheets with `sips` / `token-saver vision`
  (`prepare_frame_review` MCP tool). Estimated saving from the previous run: ~5,130 tokens (86.2%).
- Legacy template video rules (NOT valid for `studio/`): no captions or labels, English only, one steady
  voice tone, jokes are researched real facts, music +3 dB / SFX -6 dB / voice unchanged, final export
  1440x2560 with `--scale 1.3333`, 30 fps, exact duration. Mux audio with `-map 0:v:0 -map 1:a:0`.
- Save after every step. Lock picture timing before generating sound. After script approval: "just do it".
- Checkpoint session decisions to the Obsidian vault via the local Obsidian CLI skill.
- Every verifier/QA finding must be fixed before delivery.

## Local Mac runtime (already installed — use it, don't reinstall)
| Tool | Path / port | Role |
|---|---|---|
| Chrome Headless + Apple Metal | `/Applications/Google Chrome.app`, CDP `:9228` | frame renderer, `--use-gl=angle --use-angle=metal` |
| ffmpeg / ffprobe | `/opt/homebrew/bin` | `pipe:0` H.264 encode, stream audit, `xstack` sheets |
| Node v22 + esbuild darwin-arm64 | `/opt/homebrew/bin`, `node_modules/@esbuild/darwin-arm64/bin/esbuild` | asset HTTP server, TS bundles, render orchestration |
| token-saver / sips | `~/.local/bin/token-saver`, `/usr/bin/sips` | token-cheap image review |
| Apple Vision OCR + Neural Engine | `vision_ocr` | offline text detection |
| Obsidian CLI skill | `~/.gemini/config/skills/antigravity-obsidian/scripts/obsidian.js` | session logs in `/Volumes/PJ DRIVE/obsidian/itsmepj/03_Sesiones/` |

`.agents/mcp_config.json` registers `tools/mac_local.py --mcp` (stdlib only) so the agent can call
`list_local_servers`, `list_mac_tools`, `check_prereqs`, `list_pipeline`, `prepare_frame_review`.
Run `python3 tools/mac_local.py` for the same lists in the terminal.

## Paths and platform
- Never hardcode Windows paths. Use `CHROME_PATH`, `CHROME_CDP_URL`, `ASSET_SERVER_URL`,
  `REMOTION_TMP`, `REMOTION_PROJECT`, `REMOTION_PUBLIC_DIR`, `BRIDGE_ENTRY`, `BRIDGE_COMPOSITION`
  and `BRIDGE_VIDEO` env vars. `TMPDIR` is honoured on macOS.
- `REMOTION_TMP` must be on a large external drive (`/Volumes/PJ DRIVE/remotion-tmp`): every bundle
  copies `public/` (~1.3 GB), and a 4-round look pass can exceed 100 GB. The base Mac mini's 256 GB
  SSD is too small for that.
- Python helpers need `numpy`, `scipy`, `Pillow`. Rendering needs Node, Remotion, Chrome, ffmpeg/ffprobe.

## Claude-only wording in SKILL.md -> this setup
| `SKILL.md` says | Here |
|---|---|
| `~/.claude/skills/cartoon-3d-short/` | `.agents/skills/cartoon-3d-short/` (or `~/.gemini/config/skills/`) |
| "Opus max verifier" / "deep Opus audit" | Antigravity Gemini multimodal check on a downsampled sheet; `token-saver vision` first |
| `SendUserFile` | present the finished mp4 from the workspace |
| `SendMessage` / sub-agents | Antigravity subagents / parallel agent tasks (same 5 ownership lanes) |
| "update memory" | Obsidian CLI checkpoint + `out/<name>/REPORT.md` |
| Remotion CLI stills | Chrome Metal CDP path is equivalent; keep `bridge-stills.mjs` for Remotion projects |
| Windows `TEMP`/`TMP` | `TMPDIR` on macOS (handled by `bridge-stills.mjs`) |
