# Merge the look sandboxes back into the main video folder, by owned files.
# Backs up main first (backup/<video>_<time>/), copies each sandbox's owned files, reports which owned files
# are missing or unchanged. Usage: python scripts/bridge_merge.py [cam,world,char,post]
# env: REMOTION_PROJECT = root of the Remotion project (default: current folder)
#      BRIDGE_VIDEO     = video folder name (default: bridge)
import os, shutil, sys, time, filecmp

ROOT = os.path.abspath(os.path.expanduser(os.getenv("REMOTION_PROJECT") or os.getcwd()))
VIDEO = os.getenv("BRIDGE_VIDEO", "bridge")
MAIN = os.path.join(ROOT, "src/videos", VIDEO)
OWN = {  # ownership lanes from SKILL.md's look-match loop
    "cam": ["story.ts"],
    "world": ["world.ts", "lights.ts", "shade.ts", "grade.ts"],
    "mat": ["paint.ts", "build.ts"],
    "char": ["toon.ts", "cast.ts", "cardshade.ts"],
    "post": ["ink.ts", "Bridge.tsx", "lensblur.ts"],
}
which = sys.argv[1].split(",") if len(sys.argv) > 1 else list(OWN)
bak = os.path.join(ROOT, "backup", time.strftime(f"{VIDEO}_%Y%m%d_%H%M%S"))
shutil.copytree(MAIN, bak)
print("backup ->", bak)
for box in which:
    src = os.path.join(ROOT, f"src/videos/{VIDEO}_{box}")
    for f in OWN[box]:
        a, b = os.path.join(src, f), os.path.join(MAIN, f)
        if not os.path.exists(a):
            print(f"  {box}: {f} not in sandbox (skipped)")
            continue
        if os.path.exists(b) and filecmp.cmp(a, b, shallow=False):
            print(f"  {box}: {f} unchanged")
            continue
        shutil.copy2(a, b)
        print(f"  {box}: {f} -> main")
