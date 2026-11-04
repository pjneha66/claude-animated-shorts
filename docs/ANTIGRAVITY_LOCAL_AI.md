# Antigravity + Mac mini M4 (base) — what we can do, as a list

> **New work in this repo:** the [LOCAL CINEMATIC VISUAL ANIMATION STUDIO](../studio/README.md) is a
> complete, working **visual-only** system whose 21 binding rules live in
> [`../STUDIO_RULES.md`](../STUDIO_RULES.md). It outputs a **silent MP4** — no audio, subtitles or captions.
> This document describes the earlier `cartoon-3d-short` skill and the shared local Mac runtime. Any audio
> steps mentioned below apply to `templates/` only, never to `studio/`.

**Goal:** run this `cartoon-3d-short` skill inside Google Antigravity, using the local Mac runtime
you already have, on one machine, with **no new installs, no Ollama, no extra LLM server**.

- Antigravity (Gemini) = the agent / writer / verifier.
- Your Mac mini M4 base = Chrome Headless Metal rendering, ffmpeg encoding, esbuild/Node bundles,
  token-saver + sips image compression, Apple Vision OCR, Obsidian checkpoints.
- "Other local server" = your local asset HTTP server and the Chrome CDP endpoint (`:9228`).

**The live list:** `python3 tools/mac_local.py` (or `--json`, or the MCP tools). It prints local
endpoints, Mac binaries, prerequisites and the 11 pipeline steps with the tool that runs each one.
This document is the *action* list.

---

## 1. Your local stack → where it plugs into this repo

| Local tool (your Mac) | Path / port | Job in the 11-step pipeline |
|---|---|---|
| Chrome Headless + Apple Metal | `/Applications/Google Chrome.app`, `--headless=new --use-gl=angle --use-angle=metal --remote-debugging-port=9228` | steps 5-10: renders frames on the GPU via CDP (~33 FPS, 2,100 frames) |
| ffmpeg / ffprobe | `/opt/homebrew/bin` | step 10: `pipe:0` → H.264 (`-crf 17 -preset fast -pix_fmt yuv420p -an`), `xstack` sheets, stream audit (30 fps / 70.0 s / no audio / no subtitles) |
| Node v22.23.2 + esbuild darwin-arm64 | `/opt/homebrew/bin/node`, `node_modules/@esbuild/darwin-arm64/bin/esbuild` | steps 4-9: bundle `src/client.ts`, asset HTTP server, `render_studio.mjs`, `generate_reference_sheet.mjs`, `qa_audit.mjs` |
| token-saver | `~/.local/bin/token-saver` (`token-saver vision`) | step 9: downsample sheets before multimodal ingestion (~5,130 tokens / 86.2% saved last run) |
| Apple Vision OCR (`vision_ocr`) + `sips` | Apple Silicon Neural Engine, `/usr/bin/sips` | step 9: offline text detection, pixel inspection, lossless resize |
| Obsidian CLI skill | `~/.gemini/config/skills/antigravity-obsidian/scripts/obsidian.js` | steps 1-11: checkpoints into `/Volumes/PJ DRIVE/obsidian/itsmepj/03_Sesiones/` |
| Antigravity skills / rules / MCP | `.agents/skills/`, `AGENTS.md`, `.agents/mcp_config.json` | agent brain, always-on rules, and the local-tool bridge |

---

## 2. THE LIST (priority order)

1. **Install the skill into Antigravity — DONE in this repo.**
   Workspace skill: `.agents/skills/cartoon-3d-short/SKILL.md` (same `name` + `description`
   frontmatter as Claude skills; Antigravity supports the open `SKILL.md` standard).
   Global alternative: `~/.gemini/config/skills/cartoon-3d-short/SKILL.md`.
   Verify in the Customizations menu, or invoke explicitly with `/cartoon-3d-short`.
   Skills are discovered by progressive disclosure: only name/description loads first, full text on match.

2. **Add always-on project rules — DONE.** Root `AGENTS.md` (no frontmatter, always active).
   Optional extra: `.agents/rules/*.md` with `trigger: model_decision` + `description` for
   narrow guides (e.g. "read this before editing story.ts"). Global rules: `~/.gemini/AGENTS.md`.

3. **Register the local MCP server — DONE.** `.agents/mcp_config.json` spawns
   `python3 tools/mac_local.py --mcp` (stdlib only, no pip install). It exposes 5 tools:
   `list_local_servers`, `list_mac_tools`, `check_prereqs`, `list_pipeline`,
   `prepare_frame_review`. If the server fails to connect, replace `args` with the absolute
   path to `tools/mac_local.py` (the `cwd` field is supported but resolves differently per surface).

4. **Get the list on demand.**
   ```bash
   python3 tools/mac_local.py          # human checklist
   python3 tools/mac_local.py --json  # machine-readable
   ```
   From the agent: ask "call list_pipeline" / "list_mac_tools" / "check_prereqs".

5. **Map `SKILL.md`'s 11 steps onto your local runtime** (the table in §3 below). The repo was
   written for the Remotion CLI; your Chrome-CDP + ffmpeg-pipe path is equivalent for stills and
   final frames. Keep `templates/bridge/` as the source of the look, `story.ts` as the shot plan.

6. **Make the bundled scripts macOS-safe — DONE.** Windows-only Chrome path, `TEMP`/`TMP` only,
   hardcoded composition id, `public/` path, the `your Remotion project` placeholder and the fixed
   `out/bridge/shots.json` are all env-driven now (see §5).

7. **Keep private reference material local.** `references/frames/` and `references/sheets/`
   (18 MB, 1,200 frames) must never be attached to a cloud conversation. Give the agent the
   numbers in `references/reports/*.md` as text instead. Only *our own* rendered stills get reviewed.

8. **Compress before multimodal ingestion.** `prepare_frame_review` runs `sips -Z 960` into
   `out/review/` and can call `token-saver vision`; the agent then attaches only those sheets.
   Manual equivalent: `sips -Z 960 in.jpg --out out/review/in.jpg && token-saver vision out/review/`.

9. **Use Antigravity subagents for the five ownership lanes** (`cam`, `world`, `mat`, `char`, `post`)
   from `SKILL.md`'s look-match loop. "SendMessage" → resume the subagent in the same worktree;
   merge owned files with `templates/scripts/bridge_merge.py`; re-sync sandboxes each round.

10. **Replace "Opus max verifier"** with an Antigravity Gemini multimodal check on the downsampled
    side-by-side sheet (`templates/scripts/sbs_sheet.py`), ≤200 words, scoring colour day/golden,
    lighting, ink, textures, characters, depth, composition out of 10 with a numbered fix list.

11. **Checkpoint to Obsidian** after each step with the local CLI skill, writing technical logs,
    decisions and milestones to `/Volumes/PJ DRIVE/obsidian/itsmepj/03_Sesiones/`.
    This replaces "update memory" in `SKILL.md`.

12. **Set the render environment once per shell** (see §6). Key ones: `REMOTION_TMP` on the
    external drive, `CHROME_PATH`, `CHROME_CDP_URL=http://127.0.0.1:9228`,
    `ASSET_SERVER_URL`, `REMOTION_PROJECT`.

13. **QA before delivery**: `ffprobe` proves 30 fps / exact duration / no stray audio or subtitle
    streams; `templates/scripts/short_qa.py` checks every frame for black, white, frozen and pop
    frames plus loudness; mux with `-map 0:v:0 -map 1:a:0` because Remotion writes a silent track.
    Final: 1440x2560 (`--scale 1.3333`), no captions, English only, music +3 dB / SFX −6 dB.

14. **Optional, only if you ever add a local model server:** the MCP tool `list_local_servers`
    auto-detects any OpenAI-compatible `/v1/models` endpoint on common ports — no Ollama
    assumption, no config change. For a fully offline agent, the Antigravity SDK supports
    `LocalOpenAIAgentConfig(model=..., base_url=...).lightweight()` and `LiteRTAgentConfig`;
    the latter's 26B checkpoint needs ≥24 GB unified memory, so it is **not** for a 16 GB Mac mini.

---

## 3. `SKILL.md` pipeline → your Mac tool for each step

| # | Step | Antigravity role | Local Mac tool |
|---|---|---|---|
| 1 | Topic + facts | research, sources at top of `SCRIPT.md` | Obsidian CLI checkpoint |
| 2 | Script 55-70 s | beat formula, user approval | token-saver for long context |
| 3 | Voice + `words.json` | timing table | ffmpeg / Apple Vision OCR / sips |
| 4 | Shot plan `story.ts` | SHOTS, XFADE, FLASH_AT, CAMS, KICKS, DOF, FOREGROUND | esbuild bundle |
| 5 | World | `world` lane subagent | esbuild + local asset HTTP server |
| 6 | Characters | `char` lane subagent | Chrome Metal CDP |
| 7 | Post (ink/lens/grade) | `post` lane subagent | Chrome Metal CDP |
| 8 | Sound mix | event table | python3 + numpy/scipy → ffmpeg |
| 9 | Stills + look checks | multimodal verdict | Chrome CDP → sips → token-saver → `sbs_sheet.py` |
| 10 | Final render + QA | fix list | frames → ffmpeg `pipe:0` → ffprobe → `qa_audit.mjs` / `short_qa.py` |
| 11 | Deliver | present mp4 | workspace file + Obsidian checkpoint |

Chrome flags from your run: `--headless=new --use-gl=angle --use-angle=metal
--remote-debugging-port=9228`. Encode flags: `-c:v libx264 -crf 17 -preset fast -pix_fmt yuv420p -an`.

---

## 4. Hardware reality check (base Mac mini M4)

10-core CPU/GPU, **16 GB unified memory, 256 GB SSD**, 120 GB/s bandwidth. That is plenty for
Chrome-Metal frame rendering (your 2,100 frames at ~33 FPS) and ffmpeg encoding, but:

- **Disk is the bottleneck.** Every Remotion bundle copies `public/` (~1.3 GB) into the temp
  folder and never deletes it; four look-match rounds filled >100 GB on the original Windows run.
  Put `REMOTION_TMP` on `/Volumes/PJ DRIVE/remotion-tmp`, sweep `remotion-webpack-bundle-*` and
  `puppeteer_dev_chrome_profile-*` when nothing is rendering.
- **Don't run a big local LLM here.** A 26B LiteRT checkpoint alone is ~16.8 GB and Google
  recommends ≥24 GB unified memory. Antigravity's cloud Gemini is the right planner/verifier.
- **`--scale 0.5` stills still render a 1080x1920 buffer** (R3F clamps dpr ≥ 1); pixel-sized post
  parameters must scale with output height / 1920.
- 2K renders run ~4 fps (≈10 min for 67 s) with the Remotion path; your CDP path is faster.

---

## 5. Portability blockers → fixed in this repo

| File | Was | Now |
|---|---|---|
| `templates/scripts/bridge-stills.mjs` | `C:/Program Files/Google/Chrome/Application/chrome.exe` | `CHROME_PATH` or auto-detect macOS Chrome; falls back to Remotion's own browser |
| same | `TEMP`/`TMP` only | also `TMPDIR` (macOS) |
| same | `gl: "angle"` fixed | `REMOTION_GL` (use `angle` + Metal on Mac) |
| same | `public/` and `src/index.ts` hardcoded | `REMOTION_PUBLIC_DIR`, `BRIDGE_ENTRY` |
| same | composition `BridgeShort` hardcoded | `BRIDGE_COMPOSITION` |
| `templates/scripts/bridge_merge.py` | `ROOT = "your Remotion project"` | `REMOTION_PROJECT` env / cwd, `BRIDGE_VIDEO` for the folder name |
| `templates/scripts/bridge_shots.py` | writes only `out/bridge/shots.json` | optional 2nd arg / `SHOTS_JSON` env |
| `README.md` | `~/.claude/skills/` + "In Claude Code, say…" | Antigravity workspace skill + local-AI pointer |
| `SKILL.md` | Claude-only wording (`Opus max`, `SendUserFile`, `SendMessage`) | unchanged canonical file; substitutions live in `AGENTS.md` and the skill wrapper |

---

## 6. Copy-paste setup (zsh, no installs)

```bash
cd ~/path/to/claude-animated-shorts          # or your Remotion project root

# Tell the skill where the render project lives
export REMOTION_PROJECT="$HOME/bridge-short"
export REMOTION_TMP="/Volumes/PJ DRIVE/remotion-tmp"
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export CHROME_CDP_URL="http://127.0.0.1:9228"
export ASSET_SERVER_URL="http://127.0.0.1:3000"
export BRIDGE_ENTRY="src/index.ts" BRIDGE_COMPOSITION="BridgeShort"

# Optional only if you already run some OpenAI-compatible endpoint
# export LOCAL_AI_URL="http://127.0.0.1:1234/v1"

python3 tools/mac_local.py                    # THE LIST
python3 tools/mac_local.py --json | head -40
```

Verification commands:

```bash
python3 -m json.tool .agents/mcp_config.json >/dev/null && echo "MCP config OK"
head -3 .agents/skills/cartoon-3d-short/SKILL.md      # YAML frontmatter: name + description
python3 -m py_compile tools/mac_local.py templates/scripts/bridge_merge.py templates/scripts/bridge_shots.py
node --check templates/scripts/bridge-stills.mjs
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate -of json final.mp4
```

Antigravity checks: open **Customizations → Skills** (skill listed), **MCP Servers**
(`cartoon-short-local` connected), then ask the agent: *"Use the cartoon short skill. Call
list_pipeline and check_prereqs first, then make a short about …"*.

---

## 7. What is already in this branch

- `.agents/skills/cartoon-3d-short/SKILL.md` — Antigravity skill wrapper
- `AGENTS.md` — always-on rules + local tool table + wording substitutions
- `.agents/mcp_config.json` — local stdio MCP server registration
- `tools/mac_local.py` — CLI list + MCP server + `sips`/token-saver review prep
- `docs/ANTIGRAVITY_LOCAL_AI.md` — this document
- macOS-safe `templates/scripts/bridge-stills.mjs`, `bridge_merge.py`, `bridge_shots.py`
- `README.md` — Antigravity install section

## 8. Suggested next three actions

1. Open the repo in Antigravity, confirm the skill + MCP server appear in Customizations.
2. Run `python3 tools/mac_local.py` on the Mac mini and fix anything marked `MISS`/`DOWN`.
3. Ask `/cartoon-3d-short` for a topic list → approve a script → let the subagents run the
   five look lanes using your Chrome-Metal/ffmpeg runtime, checkpointing to Obsidian each round.

---

## Sources

- [Agent skills — Antigravity docs](https://antigravity.google/docs/skills/) (workspace `.agents/skills/`, global `~/.gemini/config/skills/`, progressive disclosure, slash commands)
- [Rules — Antigravity docs](https://antigravity.google/docs/rules/) (`AGENTS.md`, `.agents/rules/*.md`, triggers)
- [MCP — Antigravity docs](https://antigravity.google/docs/mcp/) (`mcpServers`, `command`/`args`/`cwd`/`env`, workspace `.agents/mcp_config.json`)
- [Local models — Antigravity SDK docs](https://antigravity.google/docs/sdk/local-models/) (`LocalOpenAIAgentConfig`, `LiteRTAgentConfig`, ≥24 GB for the 26B checkpoint)
- [Mac mini M4 base specs: 16 GB / 256 GB](https://www.cnet.com/tech/computing/m4-mac-mini-review-apples-littlest-mac-is-big-on-the-inside/)
