#!/usr/bin/env python3
"""List the local macOS tools, servers and pipeline steps used by this skill.

Nothing is installed and no LLM server (Ollama/LM Studio/...) is required.
Antigravity is the agent; this script only reports what already exists on this
Mac and exposes the same lists to Antigravity over stdio MCP.

    python3 tools/mac_local.py             human-readable checklist (THE LIST)
    python3 tools/mac_local.py --json      machine-readable list
    python3 tools/mac_local.py --mcp       stdio MCP server for Antigravity

Detected stack (all paths overridable by env vars):

    Chrome Headless + Apple Metal via CDP       CHROME_CDP_URL      (9228)
    local asset HTTP server (esbuild bundles)   ASSET_SERVER_URL    (3000/5173/8080)
    ffmpeg / ffprobe                            /opt/homebrew/bin
    Node + esbuild (darwin-arm64)               /opt/homebrew/bin, node_modules
    token-saver vision, sips                    ~/.local/bin, /usr/bin
    Obsidian CLI skill + vault                  ~/.gemini/config/skills/..., /Volumes/PJ DRIVE
    optional OpenAI-compatible endpoint        LOCAL_AI_URL         (auto-probed, never required)

Environment:
    CHROME_PATH, CHROME_CDP_URL, ASSET_SERVER_URL, LOCAL_AI_URL,
    EXTRA_LOCAL_URLS (comma separated), REMOTION_TMP, REMOTION_PROJECT,
    REVIEW_DIR, TOKEN_SAVER_CMD, OBSIDIAN_VAULT, LOCAL_PROBE_TIMEOUT
"""

from __future__ import annotations

import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

TIMEOUT = float(os.getenv("LOCAL_PROBE_TIMEOUT", "0.4"))
HOME = os.path.expanduser("~")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _get(url: str, timeout: float = TIMEOUT):
    req = urllib.request.Request(url, headers={"Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        body = res.read().decode("utf-8", "replace")
        try:
            return res.status, json.loads(body)
        except json.JSONDecodeError:
            return res.status, body[:120]


def _probe(url: str, timeout: float = TIMEOUT) -> dict:
    try:
        status, payload = _get(url, timeout)
        return {"up": True, "status": status,
                "detail": _describe(payload)}
    except urllib.error.HTTPError as e:
        # An HTTP response of any kind means the server is alive; the probe path
        # may simply be wrong (e.g. an asset server with no "/" route).
        return {"up": True, "status": e.code, "detail": f"HTTP {e.code} (endpoint responded)"}
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        return {"up": False, "status": None, "detail": type(e).__name__}


def _describe(payload) -> str:
    if isinstance(payload, dict):
        if isinstance(payload.get("models"), list):
            return f"{len(payload['models'])} models"
        if isinstance(payload.get("data"), list):
            return f"{len(payload['data'])} models"
        for key in ("Browser", "Protocol-Version", "name", "status"):
            if key in payload:
                return f"{key}={payload[key]}"
    return "responding"


# --------------------------------------------------------------------------- #
# 1. Local endpoints (only what actually exists / is explicitly configured)
# --------------------------------------------------------------------------- #

def list_local_servers() -> list[dict]:
    rows = []

    def add(name, url, probe, role, required=False):
        if any(r["url"] == url and r["probe"] == url + probe for r in rows):
            return
        info = _probe(url + probe)
        rows.append({"name": name, "url": url, "probe": url + probe, "role": role,
                     "required": required, **info})

    cdp = os.getenv("CHROME_CDP_URL", "http://127.0.0.1:9228").rstrip("/")
    add("chrome_cdp", cdp, "/json/version", "Chrome Headless (Apple Metal) frame renderer via CDP", True)

    asset = os.getenv("ASSET_SERVER_URL")
    if asset:
        add("asset_server", asset.rstrip("/"), "/", "local HTTP server for esbuild bundles", True)
    else:
        # A local asset server is part of the flow; show whichever port answers.
        hits = []
        for port in (3000, 5173, 8080, 8081, 8000):
            url = f"http://127.0.0.1:{port}"
            if _probe(url + "/", 0.25)["up"]:
                hits.append(url)
        for url in hits:
            add("asset_server", url, "/", "local HTTP server for esbuild bundles", True)
        if not hits:
            rows.append({"name": "asset_server", "url": "http://127.0.0.1:3000",
                         "probe": "http://127.0.0.1:3000/", "role": "local asset server (not running yet)",
                         "required": True, "up": False, "status": None, "detail": "start it from your render project"})

    if os.getenv("LOCAL_AI_URL"):
        base = os.getenv("LOCAL_AI_URL").rstrip("/")
        add("local_ai", base, "/v1/models", "optional OpenAI-compatible endpoint you already run", False)

    # Quietly detect any OpenAI-compatible endpoint already on the machine.
    # No Ollama/LM Studio assumption: only a real /v1/models JSON response counts,
    # so a plain HTTP server that answers 404 is not misreported as a model server.
    for port in (11434, 1234, 8080, 8000, 5001, 5000, 8081):
        base = f"http://127.0.0.1:{port}"
        if any(r["url"] == base for r in rows):
            continue
        try:
            _, payload = _get(base + "/v1/models", 0.25)
            if isinstance(payload, dict) and isinstance(payload.get("data", payload.get("models")), list):
                add("openai_compatible", base, "/v1/models", "detected local model endpoint (optional)", False)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, TimeoutError, ValueError):
            pass

    for extra in filter(None, os.getenv("EXTRA_LOCAL_URLS", "").split(",")):
        url = extra.strip().rstrip("/")
        add("custom", url, "/", "custom local server", False)

    return rows


# --------------------------------------------------------------------------- #
# 2. Local macOS binaries + skills
# --------------------------------------------------------------------------- #

BINARIES = [
    ("google_chrome", "CHROME_PATH", ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
     "Headless Chrome on Apple Metal (--use-gl=angle --use-angle=metal)"),
    ("ffmpeg", None, ["/opt/homebrew/bin/ffmpeg"], "H.264 encoder via pipe:0 + xstack contact sheets"),
    ("ffprobe", None, ["/opt/homebrew/bin/ffprobe"], "stream audit (fps, duration, no audio/subtitles)"),
    ("node", None, ["/opt/homebrew/bin/node"], "asset server + render orchestrator (v22)"),
    ("npm", None, ["/opt/homebrew/bin/npm"], "Remotion / three.js project"),
    ("npx", None, ["/opt/homebrew/bin/npx"], "Remotion CLI"),
    ("esbuild", None, [os.path.join(ROOT, "node_modules/@esbuild/darwin-arm64/bin/esbuild"),
                       os.path.join(os.getenv("REMOTION_PROJECT", ROOT), "node_modules/@esbuild/darwin-arm64/bin/esbuild")],
     "native ARM64 TS bundle (~30-50 ms)"),
    ("token-saver", "TOKEN_SAVER_BIN", [os.path.join(HOME, ".local/bin/token-saver")],
     "`token-saver vision` downsampling before multimodal ingestion"),
    ("sips", None, ["/usr/bin/sips"], "lossless image resize + pixel inspection"),
    ("python3", None, [], "audio synthesis + QA helpers"),
    ("brew", None, ["/opt/homebrew/bin/brew"], "Homebrew (already installed)"),
]

SKILL_FILES = [
    ("obsidian_cli", os.path.join(HOME, ".gemini/config/skills/antigravity-obsidian/scripts/obsidian.js"),
     "session checkpointing into the Obsidian vault"),
]


def list_mac_tools() -> list[dict]:
    rows = []
    for name, env_key, candidates, role in BINARIES:
        override = os.getenv(env_key) if env_key else None
        path = override or next((p for p in candidates if os.path.exists(p)), None) or shutil.which(name)
        rows.append({"name": name, "path": path, "ok": bool(path), "role": role,
                     "kind": "binary", "env": env_key})
    for name, path, role in SKILL_FILES:
        rows.append({"name": name, "path": path, "ok": os.path.exists(path), "role": role,
                     "kind": "local skill", "env": None})
    vault = os.getenv("OBSIDIAN_VAULT", "/Volumes/PJ DRIVE/obsidian/itsmepj/03_Sesiones")
    rows.append({"name": "obsidian_vault", "path": vault, "ok": os.path.isdir(vault),
                 "role": "session logs / milestone checkpoints", "kind": "storage", "env": "OBSIDIAN_VAULT"})
    return rows


def check_prereqs() -> list[dict]:
    rows = [{"name": "OS", "ok": platform.system() == "Darwin",
             "detail": f"{platform.system()} {platform.machine()} / Python {platform.python_version()}"}]
    for module in ("numpy", "scipy", "PIL"):
        rows.append({"name": f"python: {module}", "ok": importlib.util.find_spec(module) is not None,
                     "detail": "used by templates/audio/*.py and templates/scripts/short_qa.py"})
    tmp = os.getenv("REMOTION_TMP", "/Volumes/PJ DRIVE/remotion-tmp")
    target = tmp if os.path.isdir(tmp) else ROOT
    try:
        free_gb = round(shutil.disk_usage(target).free / 1e9, 1)
        rows.append({"name": "bundle temp space", "ok": free_gb >= 20,
                     "detail": f"{target}: {free_gb} GB free; each Remotion bundle copies public/ (~1.3 GB). "
                               "On a 256 GB Mac mini keep this on an external drive."})
    except OSError as e:
        rows.append({"name": "bundle temp space", "ok": False, "detail": str(e)})
    rows.append({"name": "reference images", "ok": os.path.isdir(os.path.join(ROOT, "references")),
                 "detail": "keep references/ local; feed the numeric reports/*.md to the agent instead of uploading sheets"})
    return rows


# --------------------------------------------------------------------------- #
# 3. Pipeline -> the exact local tool that runs each step
# --------------------------------------------------------------------------- #

PIPELINE = [
    {"step": 1, "name": "Topic and facts", "agent": "Antigravity (Gemini) + web", "mac_tool": "Obsidian CLI checkpoint", "needs": "sources at top of SCRIPT.md"},
    {"step": 2, "name": "Script (55-70 s, ~3.7 words/s)", "agent": "Antigravity", "mac_tool": "token-saver for long context", "needs": "beat formula; user approval"},
    {"step": 3, "name": "Voice + words.json", "agent": "Antigravity", "mac_tool": "ffmpeg / Apple Vision OCR / sips", "needs": "voice.wav + hand-fixed word timings"},
    {"step": 4, "name": "Shot plan (story.ts)", "agent": "Antigravity subagents", "mac_tool": "esbuild", "needs": "SHOTS, XFADE, FLASH_AT, CAMS, KICKS, DOF, FOREGROUND"},
    {"step": 5, "name": "World (lights/build/paint/world)", "agent": "Antigravity subagent (world lane)", "mac_tool": "esbuild + local asset server", "needs": "templates/bridge/"},
    {"step": 6, "name": "Characters (toon/cast/cardshade)", "agent": "Antigravity subagent (char lane)", "mac_tool": "esbuild + Chrome Metal", "needs": "templates/bridge/"},
    {"step": 7, "name": "Post (ink/lens/grade)", "agent": "Antigravity subagent (post lane)", "mac_tool": "Chrome Metal", "needs": "templates/bridge/"},
    {"step": 8, "name": "Sound mix", "agent": "Antigravity", "mac_tool": "python3 + numpy/scipy -> ffmpeg", "needs": "lock picture timing first; music +3 dB / SFX -6 dB"},
    {"step": 9, "name": "Stills + look checks", "agent": "Antigravity (multimodal)", "mac_tool": "Chrome CDP (Metal) + sips + token-saver vision + sbs_sheet.py", "needs": "downsample contact sheets before ingestion; numeric reports as context"},
    {"step": 10, "name": "Final 2K render + QA", "agent": "Antigravity", "mac_tool": "Chrome CDP frames -> ffmpeg pipe:0 -> ffprobe -> qa_audit.mjs", "needs": "30 fps, 70 s, 1440x2560, no captions; mux with -map 0:v:0 -map 1:a:0"},
    {"step": 11, "name": "Deliver", "agent": "Antigravity", "mac_tool": "workspace file + Obsidian CLI checkpoint", "needs": "final mp4, notes, REPORT.md"},
]


def list_pipeline() -> list[dict]:
    return PIPELINE


# --------------------------------------------------------------------------- #
# 4. Prepare a token-cheap frame review sheet using local macOS tools
# --------------------------------------------------------------------------- #

def prepare_frame_review(paths: list[str], max_px: int = 960,
                         use_token_saver: bool = False) -> dict:
    out_dir = os.getenv("REVIEW_DIR", os.path.join(ROOT, "out", "review"))
    os.makedirs(out_dir, exist_ok=True)
    sips = next((p for p in ("/usr/bin/sips", shutil.which("sips")) if p and os.path.exists(p)), None)
    made = []
    for src in paths:
        if not os.path.isfile(src):
            made.append({"source": src, "error": "not found"})
            continue
        dst = os.path.join(out_dir, f"review_{len(made):02d}_{os.path.basename(src)}")
        if not dst.lower().endswith((".jpg", ".jpeg", ".png")):
            dst += ".jpg"
        if sips:
            r = subprocess.run([sips, "-Z", str(max_px), src, "--out", dst],
                               capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                shutil.copy2(src, dst)
                note = "sips failed, copied original"
            else:
                note = f"sips -Z {max_px}"
        else:
            shutil.copy2(src, dst)
            note = "sips unavailable, copied original"
        made.append({"source": src, "output": dst, "note": note})
    ts_out = None
    token_saver = os.getenv("TOKEN_SAVER_BIN", os.path.join(HOME, ".local/bin/token-saver"))
    if use_token_saver and os.path.exists(token_saver):
        cmd = os.getenv("TOKEN_SAVER_CMD", "token-saver vision").split() + [out_dir]
        r = subprocess.run([token_saver if cmd[0] == "token-saver" else cmd[0]] + cmd[1:],
                           capture_output=True, text=True, timeout=120)
        ts_out = (r.stdout or r.stderr).strip()[:500]
    return {"outputs": made,
            "hint": "Attach only these downsampled images. Keep references/sheets off the cloud; "
                    "use references/reports/*.md as text context.",
            "token_saver": ts_out}


# --------------------------------------------------------------------------- #
# 4b. Visual-only studio (STUDIO_RULES.md) — local tools, silent output
# --------------------------------------------------------------------------- #

STUDIO_PIPELINE = [
    {"phase": 1, "name": "Hardware detection before implementation", "local": "studio/src/hardware/detectMac.js -> npm run doctor"},
    {"phase": 2, "name": "Mac mini M4 base + local stack audit", "local": "doctor: CPU/RAM/disk/Metal/ffmpeg/Chrome/Node"},
    {"phase": 3, "name": "21 rules enforcement", "local": "studio/src/core/rules.js -> npm run rules -- --check"},
    {"phase": 4, "name": "Script analysis", "local": "studio/src/core/scriptAnalysis.js (optional loopback-only local AI)"},
    {"phase": 5, "name": "Character identification / design / consistency", "local": "characters.js + art/characterArt.js -> reference sheets"},
    {"phase": 6, "name": "Style from uploaded vintage comic (technique only)", "local": "studio/assets/style_reference.jpg + paintCharacter()"},
    {"phase": 7, "name": "Script-aware scene colour direction", "local": "colorDirector.js -> per-scene palettes"},
    {"phase": 8, "name": "3D environment / depth / parallax / DOF", "local": "world/environments.js, ThreeWorld.jsx"},
    {"phase": 9, "name": "Scene breakdown + shot composition", "local": "core/scenePlan.js (18 shot types)"},
    {"phase": 10, "name": "Full-body rig + body/facial/hand animation", "local": "rig/characterRig.js, body.js, hands.js, facial.js"},
    {"phase": 11, "name": "Cinematic camera choreography", "local": "camera/cameraEngine.js"},
    {"phase": 12, "name": "Lighting + comic VFX", "local": "world/lighting.js, fx/comicFx.js, art/sceneArt.js"},
    {"phase": 13, "name": "Local render (Remotion/Three.js/Chromium + CPU fallback)", "local": "render/remotionRenderer.js, softwareRenderer.js"},
    {"phase": 14, "name": "Local FFmpeg H.264 encode, no audio/subtitles", "local": "renderSpec.js verifySilentMp4()"},
    {"phase": 15, "name": "15-scene visual QA on real rendered frames", "local": "qa/visualQA.js -> deliverables/qa-report.json"},
    {"phase": 16, "name": "Fix defects, re-test, do not claim untested features", "local": "npm test (11 tests) + encoded frame inspection"},
    {"phase": 17, "name": "Deliver final silent MP4", "local": "studio/deliverables/final-silent-short.mp4"},
]


def list_studio_pipeline() -> list[dict]:
    return STUDIO_PIPELINE


def studio_rules_check() -> dict:
    studio = os.path.join(ROOT, "studio")
    cli = os.path.join(studio, "src", "cli", "studio.mjs")
    if not os.path.isfile(cli):
        return {"ok": False, "error": "studio/ source not found"}
    try:
        r = subprocess.run(["node", cli, "rules", "--check"], cwd=studio,
                           capture_output=True, text=True, timeout=90)
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return {"ok": False, "error": str(e)}
    try:
        parsed = json.loads(r.stdout)
    except json.JSONDecodeError:
        parsed = None
    return {"ok": r.returncode == 0 and bool(parsed) and not parsed.get("problems"),
            "exitCode": r.returncode, "report": parsed,
            "stderr": (r.stderr or "").strip()[:400],
            "note": "Visual-only studio: audio/TTS/music/SFX/subtitles/captions are prohibited."}


def studio_deliverables() -> dict:
    d = os.path.join(ROOT, "studio", "deliverables")
    files = []
    if os.path.isdir(d):
        for name in sorted(os.listdir(d)):
            p = os.path.join(d, name)
            if os.path.isfile(p):
                files.append({"file": name, "bytes": os.path.getsize(p)})
    summary = None
    report = os.path.join(d, "qa-report.json")
    if os.path.isfile(report):
        try:
            with open(report, encoding="utf-8") as fh:
                qa = json.load(fh)
            summary = {"passed": qa.get("passed"), "total": qa.get("total"),
                       "issues": qa.get("issues", []), "fixes": qa.get("fixes", [])}
        except (OSError, json.JSONDecodeError):
            pass
    return {"directory": d, "files": files, "qa": summary,
            "outputContract": {"audio": False, "subtitles": False, "captions": False,
                               "textOverlays": False, "format": "H.264 MP4"}}


# --------------------------------------------------------------------------- #
# 5. CLI
# --------------------------------------------------------------------------- #

def _snapshot() -> dict:
    return {"os": f"{platform.system()} {platform.machine()}",
            "local_servers": list_local_servers(), "mac_tools": list_mac_tools(),
            "prerequisites": check_prereqs(), "pipeline": list_pipeline(),
            "studio": {"pipeline": list_studio_pipeline(),
                       "deliverables": studio_deliverables()}}


def _print_human() -> None:
    s = _snapshot()
    print("LOCAL ENDPOINTS  (only what exists / is configured; no LLM server required)")
    for r in s["local_servers"]:
        print(f"  [{'UP  ' if r['up'] else 'DOWN'}] {r['name']:<18} {r['url']:<30} {r['detail'] or ''}")
    print("\nMAC LOCAL TOOLS")
    for r in s["mac_tools"]:
        print(f"  [{'OK  ' if r['ok'] else 'MISS'}] {r['name']:<18} {r['path'] or '(not found)'}")
    print("\nPREREQUISITES")
    for r in s["prerequisites"]:
        print(f"  [{'OK  ' if r['ok'] else 'MISS'}] {r['name']:<22} {r['detail']}")
    print("\nPIPELINE  (SKILL.md steps -> the Mac tool that runs each one)")
    for p in s["pipeline"]:
        print(f"  {p['step']:>2}. {p['name']:<36} {p['mac_tool']}")


# --------------------------------------------------------------------------- #
# 6. Minimal stdio MCP server (standard library only)
# --------------------------------------------------------------------------- #

TOOLS = [
    {"name": "list_local_servers", "description": "List the local Mac endpoints (Chrome CDP Metal renderer, asset server, any detected model endpoint) and whether each is up.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_mac_tools", "description": "List the local macOS binaries and skills (Chrome, ffmpeg, esbuild, Node, token-saver, sips, Obsidian CLI) with their resolved paths.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "check_prereqs", "description": "List Python modules, disk space and privacy prerequisites for the cartoon-short pipeline on this Mac.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_pipeline", "description": "List the 11 legacy SKILL.md pipeline steps (templates/ only — its audio steps do NOT apply to studio/).",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "studio_pipeline", "description": "List the 17 visual-only LOCAL CINEMATIC VISUAL ANIMATION STUDIO phases and the local module/tool running each one. Silent MP4 only; no audio, subtitles or captions.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "studio_rules_check", "description": "Run the studio's 21-rule visual-only source scanner and output contract locally; returns problems (must be empty).",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "studio_deliverables", "description": "List the finished silent MP4, reference sheets, QA report and encoded-frame contact sheet in studio/deliverables/ with sizes and QA summary.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "prepare_frame_review", "description": "Downsample rendered stills with sips (optionally token-saver vision) into out/review/ for a token-cheap multimodal look check.",
     "inputSchema": {"type": "object", "properties": {
         "paths": {"type": "array", "items": {"type": "string"}, "description": "Paths to still images"},
         "max_px": {"type": "integer", "description": "Longest edge in pixels (default 960)"},
         "use_token_saver": {"type": "boolean"}}, "required": ["paths"]}},
]


def _result(payload) -> dict:
    text = payload if isinstance(payload, str) else json.dumps(payload, indent=2, ensure_ascii=False)
    return {"content": [{"type": "text", "text": text}], "isError": False}


def _call_tool(name: str, args: dict) -> dict:
    try:
        if name == "list_local_servers":
            return _result(list_local_servers())
        if name == "list_mac_tools":
            return _result(list_mac_tools())
        if name == "check_prereqs":
            return _result(check_prereqs())
        if name == "list_pipeline":
            return _result({"note": "Legacy SKILL.md / templates/ pipeline only. Audio steps do NOT apply to studio/.",
                            "steps": list_pipeline()})
        if name == "studio_pipeline":
            return _result(list_studio_pipeline())
        if name == "studio_rules_check":
            return _result(studio_rules_check())
        if name == "studio_deliverables":
            return _result(studio_deliverables())
        if name == "prepare_frame_review":
            return _result(prepare_frame_review(args.get("paths", []),
                                                int(args.get("max_px", 960)),
                                                bool(args.get("use_token_saver", False))))
        return {"content": [{"type": "text", "text": f"unknown tool: {name}"}], "isError": True}
    except Exception as e:
        return {"content": [{"type": "text", "text": f"ERROR: {type(e).__name__}: {e}"}], "isError": True}


def _reply(msg_id, result=None, error=None) -> None:
    body = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        body["error"] = error
    else:
        body["result"] = result
    sys.stdout.write(json.dumps(body) + "\n")
    sys.stdout.flush()


def serve_mcp() -> None:
    print("cartoon-short-local MCP server ready", file=sys.stderr, flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        method, msg_id = msg.get("method"), msg.get("id")
        if msg_id is None:
            continue
        if method == "initialize":
            _reply(msg_id, {"protocolVersion": msg.get("params", {}).get("protocolVersion", "2025-06-18"),
                            "capabilities": {"tools": {}},
                            "serverInfo": {"name": "cartoon-short-local", "version": "0.3.0"}})
        elif method == "ping":
            _reply(msg_id, {})
        elif method == "tools/list":
            _reply(msg_id, {"tools": TOOLS})
        elif method == "tools/call":
            params = msg.get("params", {})
            _reply(msg_id, _call_tool(params.get("name", ""), params.get("arguments", {})))
        elif method in ("resources/list", "prompts/list"):
            _reply(msg_id, {"resources": [], "prompts": []})
        else:
            _reply(msg_id, error={"code": -32601, "message": f"Method not found: {method}"})


def main() -> None:
    args = sys.argv[1:]
    if "--mcp" in args:
        serve_mcp()
    elif "--json" in args:
        print(json.dumps(_snapshot(), indent=2))
    else:
        _print_human()


if __name__ == "__main__":
    main()
