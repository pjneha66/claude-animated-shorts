---
name: cartoon-3d-short
description: Make a 55-70 s vertical cartoon story short (2D bean-head characters with ink outlines in a colourful 3D world, lens blur, gliding cameras, narration, synthesized SFX + march music) rendered with three.js inside Remotion. Use when the user asks for another short "like the bridge video", a history/science cartoon short in that style, wants the cartoon-short pipeline, or asks for stills, look checks, shot plans, sound mix or the final 2K render for a short. LEGACY templates/ skill only — for a visual-only silent short use the local-visual-studio skill and STUDIO_RULES.md instead.
---

# Cartoon 3D story short — Antigravity entry point

This repository **is** the skill. The canonical instructions are in the repo root, not copied here.
It runs entirely on one Mac: Antigravity is the agent, and the local macOS runtime does the work.
No local LLM server and no new installs are needed.

> **Legacy skill only.** The steps below (voice, sound mix, audio muxing) belong to `templates/` and
> `SKILL.md`. They are **prohibited** in the new visual-only studio. For a silent MP4 with no audio /
> subtitles / captions, read `../../../STUDIO_RULES.md` and `../../../studio/README.md`, or use the
> `local-visual-studio` skill.

1. Read `../../../SKILL.md` (relative to this file) and follow its 11-step pipeline in order.
2. Style reference: `../../../references/`. Feed `reports/*.md` (numbers, text) to the agent;
   keep `frames/` and `sheets/` local — they are private study images, never attach them to a cloud chat.
3. Source templates: `../../../templates/bridge/` (world, characters, post, camera),
   `../../../templates/audio/` (sound), `../../../templates/scripts/` (stills, merge, QA).
4. Platform rules and the exact local Mac tool list: `../../../AGENTS.md`.
5. Full setup + priority checklist: `../../../docs/ANTIGRAVITY_LOCAL_AI.md`.

## Before the first step
- Run `python3 tools/mac_local.py` from the repo root, or call the MCP tool `list_local_servers` /
  `list_mac_tools` / `list_pipeline`. That is the live list of local endpoints, Mac binaries,
  prerequisites and which local tool runs each pipeline step.
- Use the local Chrome Headless + Apple Metal CDP renderer (`:9228`), esbuild bundles, the local
  asset HTTP server and ffmpeg `pipe:0`, as in the proven 2,100-frame / 30 fps / 70 s run.
- Downsample every review sheet with `sips` + `token-saver vision` before multimodal ingestion
  (`prepare_frame_review`). Use the numeric reports as text context instead of uploading images.
- Set `REMOTION_TMP` on the external drive, `CHROME_PATH` if Chrome is not auto-detected, and
  `REMOTION_PROJECT` to the root of your Remotion project.
- Checkpoint decisions with the local Obsidian CLI skill (`~/.gemini/config/skills/antigravity-obsidian/`).

## Tool substitutions (SKILL.md was written for Claude Code)
| `SKILL.md` wording | In Antigravity / on this Mac |
|---|---|
| "Opus max verifier", "deep Opus audit" | Antigravity Gemini multimodal verdict on a downsampled sheet; ≤200 words, score each look area /10 |
| "SendUserFile the final mp4" | present the finished mp4 from the workspace |
| "SendMessage" to resume an owner agent | resume the subagent / start a follow-up task in the same worktree |
| "update memory" | Obsidian CLI checkpoint + `out/<name>/REPORT.md` |
| Claude Code agents and sandboxes | Antigravity subagents; the five ownership lanes (`cam`, `world`, `mat`, `char`, `post`) still apply |
| Windows-only paths / Chrome exe | env vars documented in `AGENTS.md`; `/Applications/Google Chrome.app` |
| Remotion CLI stills / render | equivalent Chrome Metal CDP + ffmpeg pipe path; keep `bridge-stills.mjs` for Remotion projects |

Invoke explicitly with `/cartoon-3d-short` if the agent does not pick the skill up automatically.
