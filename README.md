# Claude Animated Shorts

The free skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It makes 55-70 s vertical animated story shorts: 2D characters in a colourful 3D world, with ink outlines, a painted town, lens blur, gliding cameras, a march score and sound effects. Everything is rendered with three.js inside Remotion on your own PC, with no AI video generator.

Proven on **The Bridge That Fell for a Song**, a 67 s short about the 1831 Broughton bridge.

## Visual-only local animation studio (new)

`studio/` is a complete, working **visual-only** production system: script → analysis → characters → dynamic
colour direction → environments → shots → rigging → body/face/hand animation → camera → lighting → comic VFX →
local render → visual QA → **silent MP4**. It follows the uploaded vintage comic-book reference for *technique*
(ink, Ben-Day dots, crosshatching, paper) but never locks its palette. Everything runs locally on the Mac with
Remotion + Three.js + Chromium + FFmpeg, plus a CPU software fallback. **No audio, subtitles, captions or text
overlays are generated.**

```bash
cd studio && npm install
node src/cli/studio.mjs doctor
node src/cli/studio.mjs qa
node src/cli/studio.mjs render presets/scripts/bridge.txt --seconds 60 --quality high --backend chrome
node tests/run_tests.mjs
```

- Rules (binding, line by line): [`STUDIO_RULES.md`](STUDIO_RULES.md)
- Full guide: [`studio/README.md`](studio/README.md)
- Finished film: [`studio/deliverables/final-silent-short.mp4`](studio/deliverables/final-silent-short.mp4)
  (1080×1920, 30 fps, 60 s, H.264, verified zero audio/subtitle streams)

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the full pipeline, every rule, every fix, and the final look values |
| `.agents/skills/cartoon-3d-short/` | Antigravity workspace skill (same `SKILL.md` standard) |
| `AGENTS.md` | Always-on rules for any SKILL.md agent, plus the local Mac tool table |
| `.agents/mcp_config.json` | Registers the local stdio MCP server (no pip install) |
| `tools/mac_local.py` | Prints the live list of local endpoints / Mac tools / prerequisites / pipeline; also an MCP server |
| `docs/ANTIGRAVITY_LOCAL_AI.md` | Antigravity + Mac mini M4 (base) setup checklist and architecture |
| `templates/bridge/` | The full source of the bridge short: world, characters, ink, lens blur, grade, story/camera |
| `templates/audio/` | The synthesized sound: SFX, march music, the mix with ducking and loudness |
| `templates/scripts/` | Stills, side-by-side sheets, shot merge and frame-by-frame QA helpers |
| `references/STYLE_BIBLE.md` | The script and visual formula measured from 20 reference shorts |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |
| `references/frames/` | 38 full-size reference frames (540x960) to compare your frames against |
| `references/sheets/` | 20 contact sheets, one per reference short, 60 frames each (1,200 frames) |

## Install
1. **Antigravity:** just open this repo as a workspace — `.agents/skills/cartoon-3d-short/SKILL.md` is already discovered. Or copy the folder to `~/.gemini/config/skills/cartoon-3d-short/` for all projects. **Claude Code:** copy it to `~/.claude/skills/cartoon-3d-short/`.
2. You need [Remotion](https://www.remotion.dev/) with `@remotion/three`, plus Node, Python 3, numpy/scipy/Pillow and ffmpeg.
3. In Antigravity (or Claude Code), say: *"Use the cartoon short skill and make a short about …"*, or type `/cartoon-3d-short`.

The agent then follows `SKILL.md`: topic and facts, script, voice, shot plan in `story.ts`, stills, look checks, final 2K render and sound mix.

## Antigravity + local Mac AI (no new installs)
The skill runs entirely on one Mac: Antigravity is the agent, and the local macOS runtime (Chrome Headless + Apple Metal via CDP, ffmpeg, esbuild/Node, token-saver, sips, Apple Vision OCR, Obsidian CLI) does the rendering. No Ollama or local LLM server is required.

```bash
python3 tools/mac_local.py          # THE LIST: endpoints, Mac tools, prerequisites, 11 pipeline steps
python3 tools/mac_local.py --json   # same, machine-readable
```

The MCP server (`tools/mac_local.py --mcp`) gives the agent `list_local_servers`, `list_mac_tools`, `check_prereqs`, `list_pipeline` and `prepare_frame_review`. See `docs/ANTIGRAVITY_LOCAL_AI.md` for the full checklist, env vars and the mapping of each pipeline step to your Mac tools.

## Notes
- Set `REMOTION_TMP` to a folder on a big external drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder; on macOS `TMPDIR` is honoured by `bridge-stills.mjs`.
- `CHROME_PATH`, `BRIDGE_ENTRY`, `BRIDGE_COMPOSITION`, `REMOTION_PUBLIC_DIR` and `REMOTION_PROJECT` make the bundled scripts portable across macOS, Linux and Windows.
- Story, characters and voice should always be your own. Use the references for the look, not the content — and keep `references/` frames/sheets local; feed the numeric `references/reports/*.md` to the agent instead.
- On a 16 GB / 256 GB Mac mini M4, keep bundle temp and the final render on an external drive; a local 26B model checkpoint will not fit.

## License
The code and docs are MIT (see `LICENSE`). The reference frames are included for style study only.
