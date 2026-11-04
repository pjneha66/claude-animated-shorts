# Writes shots.json (shot frame ranges, crossfade windows, flash) from story.ts for scripts/short_qa.py.
# Usage: python scripts/bridge_shots.py [story.ts] [shots.json]
# env: SHOTS_JSON = output path (default out/bridge/shots.json)
#      BRIDGE_VIDEO = video folder name used in the default output path
import json, os, re, sys
src_path = sys.argv[1] if len(sys.argv) > 1 else "src/videos/bridge/story.ts"
src = open(src_path, encoding="utf-8").read()
shots = [{"id": int(i), "a": int(a), "b": int(b) if b != "TOTAL" else int(re.search(r"TOTAL = (\d+)", src).group(1))}
         for i, a, b in re.findall(r"\{ id: (\d+), a: (\d+), b: (\w+),", src)]
xf = {int(k): int(v) for k, v in re.findall(r"(\d+): (\d+)", re.search(r"XFADE[^=]*= \{([^}]*)\}", src).group(1))}
flash = int(re.search(r"FLASH_AT = (\d+)", src).group(1))
xfade = [[s["a"] - xf[s["id"]] // 2, s["a"] + xf[s["id"]] // 2] for s in shots if s["id"] in xf]
# planned hard cuts inside shots, and 7-frame flip kicks (SNAP / DROP1 / hammer blows)
cuts = [[int(f), int(f)] for f in re.findall(r"\{ f: (\d+), cut: true", src)]
consts = {k: float(v) for k, v in re.findall(r"(SNAP|DROP0|DROP1) = ([\d.]+)", src)}
kicks = []
m = re.search(r"const KICKS[^=]*= \[(.*?)\];", src)
if m:
    for t0, _ in re.findall(r"\[([\w.]+), ([\d.]+)\]", m.group(1)):
        f0 = round((consts[t0] if t0 in consts else float(t0)) * 30)
        kicks.append([f0, f0 + 8])
out = sys.argv[2] if len(sys.argv) > 2 else os.getenv(
    "SHOTS_JSON", f"out/{os.getenv('BRIDGE_VIDEO', 'bridge')}/shots.json")
os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
json.dump({"shots": shots, "xfade": xfade, "flash": [flash, flash + 4], "planned": cuts + kicks}, open(out, "w"), indent=1)
print(out, len(shots), "shots", xfade, flash, "cuts", [c[0] for c in cuts], "kicks", kicks)
