# LOCAL CINEMATIC VISUAL ANIMATION STUDIO — RULES

**These rules are binding, line by line, for every agent and every run.** They are mirrored in machine-readable form in
`studio/src/core/rules.js` (`RULES`, `PROHIBITED`, `assertVisualOnly`, `outputContract`) and enforced by
`node studio/src/cli/studio.mjs rules --check` plus the visual QA report.

**Mission:** transform this repository into a professional, fully local, **visual-only** animated-short production studio
that generates complete cinematic visuals from a script. **I add audio and subtitles myself later.** The only output is
a silent video file.

---

### 1. ABSOLUTE LOCAL EXECUTION
Everything runs locally on the Mac: local character creation, local image processing, local animation, local rigging,
local environment generation, local camera animation, local rendering, local frame processing, local video encoding.
PROHIBITED: cloud rendering, remote render farms, paid video-generation APIs, external image-generation APIs, paid
subscriptions, remote GPU rendering, uploading assets to external services. Works offline once dependencies/assets are installed.

### 2. VISUAL STYLE REFERENCE
`studio/assets/style_reference.jpg` is the primary **illustration-technique** reference: vintage American comic-book
illustration, hand-drawn 2D characters, thick black ink outlines, detailed cross-hatching, Ben-Day halftone patterns,
illustrated shadows, detailed clothing textures, expressive illustrated faces, vintage printed-paper texture, dramatic
comic-book compositions. **The reference defines technique, NOT the colour palette.** Never lock to blue/yellow/red/cream.
Adapt the visual direction per story. No generic glossy 3D cartoon characters.

### 3. DYNAMIC COLOUR DIRECTION
A script-aware colour-direction engine (`SceneColorDirector`) gives every story its own colour identity. It analyses genre,
story atmosphere, location, historical period, time of day, weather, season, character identity, emotional tone, scene
intensity and lighting conditions, and generates scene-specific palettes. Horror/romance/fantasy/historical/action/mystery/
comedy are **soft numeric priors, not fixed presets**. Character clothing and appearance stay consistent across scenes.

### 4. SCRIPT-TO-VISUAL PIPELINE
SCRIPT → SCRIPT ANALYSIS → CHARACTER IDENTIFICATION → CHARACTER DESIGN → VISUAL STYLE PLANNING → DYNAMIC COLOUR
DIRECTION → ENVIRONMENT DESIGN → SCENE BREAKDOWN → SHOT COMPOSITION → CHARACTER RIGGING → CHARACTER ANIMATION →
FACIAL ANIMATION → HAND ANIMATION → BODY ANIMATION → CAMERA CHOREOGRAPHY → LIGHTING AND VISUAL EFFECTS → LOCAL VIDEO
RENDERING → VISUAL QUALITY ASSURANCE → FINAL SILENT MP4. Visual actions must communicate the story **without audio or text**.

### 5. CHARACTER DESIGN
Reusable, consistent characters. Each has a unique face, hairstyle, body proportions, clothing, accessories, personality,
distinctive characteristics, character-specific colour identity, and an unchanged appearance across scenes. Character
reference sheets are generated before animation. Never randomly change appearance between shots.

### 6. COMPLETE CHARACTER RIGGING
HEAD: rotation, tilt, neck. FACE: eyes, pupils, eyelids, eyebrows, mouth, cheeks. BODY: spine, chest, abdomen, pelvis,
shoulders. ARMS: upper arms, elbows, forearms, wrists, palms, individual fingers. LEGS: thighs, knees, lower legs,
ankles, feet. Skeletal rig + layered sprites + SVG-style artwork + deformable textures.

### 7. ADVANCED FACIAL ANIMATION (mandatory)
EYES: natural blinking, independent pupils, looking around, looking at objects, looking at other characters, eye contact,
squinting, widening. EYEBROWS: raising, lowering, asymmetrical movement, emotion. MOUTH: smile, laugh, frown, surprise,
emotional shapes, natural rest. EXPRESSIONS: happy, sad, angry, surprised, confused, curious, fearful, excited,
disgusted, crying, laughing. **No dialogue lip-sync** — mouth animation serves expressions, reactions and visual storytelling.

### 8. HAND AND FINGER ANIMATION
Pointing, waving, open palms, closed fists, counting, finger articulation, wrist rotation, holding objects, two-hand
gestures, natural rest, emotional gestures. Hands stay connected to arms. Never frozen during important actions.

### 9. FULL BODY ANIMATION
WALKING: natural cycle, foot-ground contact, hip movement, opposing arm swing, weight transfer. RUNNING: dynamic legs,
arm swing, forward lean, bounce. IDLE: breathing, blinking, small head moves, posture, weight shift. REACTIONS and
INTERACTIONS: head turns, eye movement, expressions, gestures, sitting, standing, holding, touching, looking at others,
group interaction. Apply anticipation, follow-through, overlapping action, ease-in/out, secondary motion, weight transfer.

### 10. CINEMATIC CAMERA ENGINE
Dolly in/out, push-in, pull-back, tracking, pan, tilt, crane, orbit, over-the-shoulder, close-up, extreme close-up, wide
establishing, low angle, high angle, character-follow, dramatic reveal, reaction shot. Smooth interpolation, controlled
acceleration, purposeful compositions. Never move the camera randomly.

### 11. 2D CHARACTERS + 3D ENVIRONMENTS
Characters = 2D comic artwork. Environments = Three.js 3D geometry with depth, foreground objects, background layers,
parallax, perspective, shadows, atmospheric effects, lighting and depth of field. Characters must feel integrated.

### 12. DYNAMIC LIGHTING AND ATMOSPHERE
Daylight, sunset, sunrise, moonlight, night, candlelight, firelight, interior, dramatic spotlights, fog, atmospheric haze,
environmental shadows. Lighting complements the scene palette.

### 13. COMIC-BOOK VISUAL EFFECTS
Halftone, ink outlines, cross-hatching, speed lines, impact bursts, illustrated smoke, dust particles, motion streaks,
ink splashes, paper texture, comic transitions, dramatic shadows — adapted per story.

### 14. LOCAL MAC RENDERING ENGINE (mandatory)
Remotion + Three.js + local Chromium + Node.js + FFmpeg. Pipeline: script-based scene composition → frame calculation →
Three.js rendering → local Chromium → Remotion frame rendering → local frame processing → local FFmpeg encoding →
FINAL SILENT MP4. No cloud, no remote servers, no external video services. Default output 1080×1920, 9:16, 30 FPS,
55–70 s, H.264 MP4, **no audio track, no subtitles, no captions**. Also support 16:9, 1:1, custom resolutions and 60 FPS.
LOW / MEDIUM / HIGH quality with automatic safe settings. Verify rendering and encoding actually happen locally; the MP4
must play offline. A Canvas2D CPU/software fallback renderer is provided for machines without verified GPU.

### 15. MAC HARDWARE DETECTION
Inspect macOS version, CPU architecture, Apple Silicon, RAM, available RAM, disk space, GPU capabilities, Metal support,
Node, npm, pnpm, Python, FFmpeg, Chromium, Remotion, Three.js, Ollama. Use hardware efficiently; **never assume GPU
acceleration without verification**; support CPU/software fallback; avoid unnecessary installs and large downloads;
**never delete user data**.

### 16. OPTIONAL LOCAL AI
If Ollama or another local inference engine exists, detect models and optionally use them for script analysis, character
descriptions, scene/shot planning, visual storytelling, animation planning and continuity. The animation and rendering
engine must work independently. **No external AI API calls.**

### 17. VISUAL QUALITY ASSURANCE
Automated test scenes (15): idle, walk, run, blink, look around, expressions, hand gestures, finger articulation,
two-character interaction, multi-character, camera moves, lighting conditions, colour palettes, comic VFX, complete
sequence. Render representative frames, **inspect the actual rendered images**, and fix static faces, broken joints,
frozen hands, unnatural movement, clipping, inconsistent proportions, camera glitches, colour inconsistencies and
artifacts. **Do not mark a feature complete without testing it.**

### 18. LOCAL PERFORMANCE OPTIMIZATION
Reuse geometries/materials/textures, optimize textures, manage memory, control concurrency, optimize frame generation,
avoid unnecessary calculations, use temporary render directories, check disk space, support render recovery.
Provide LOW / MEDIUM / HIGH.

### 19. STRICTLY EXCLUDE AUDIO AND SUBTITLE FEATURES
NEVER build: voice-over, TTS, speech synthesis, dialogue recording, lip-sync with audio, transcription, music, SFX,
audio mixing/mastering, subtitles, automatic captions, SRT/VTT, subtitle rendering, or text overlays for spoken dialogue.
Output = clean visual-only MP4: no music, no sound effects, no voice, no subtitles, no captions, no automatic text
overlays. Story is told through actions, expressions, gestures, camera direction and environments.

### 20. FINAL PRODUCTION OUTPUT
Complete animated scenes, consistent character designs, reference sheets, scene-specific colour direction, cinematic
camera movement, animated 2D characters, 3D environments, comic VFX, final silent MP4 (1080×1920 / 9:16 / 30 FPS /
H.264 / 55–70 s / no audio / no subtitles).

### 21. IMPLEMENTATION EXECUTION PLAN
PHASE 1 inspect repo → 2 audit Mac environment → 3 inspect reference artwork → 4 script-to-visual pipeline → 5 dynamic
colour → 6 character creation/consistency → 7 rigging → 8 facial → 9 hands/fingers → 10 full-body → 11 camera → 12 3D
environments/lighting → 13 comic VFX → 14 local rendering → 15 render test sequences → 16 inspect and fix → 17 produce a
complete silent animated short. **Build the actual working system; do not stop at planning or documentation.**

---

## Enforcement
| Check | Command / module |
|---|---|
| 21 rules loaded by every agent | `AGENTS.md` → this file; `studio/src/core/rules.js` |
| No audio/subtitle code | `studio rules --check` (`assertVisualOnly`) |
| Plan advertises silent output | `outputContract(plan)` |
| MP4 truly has zero audio/subtitle streams | `renderSpec.verifySilentMp4()` via local FFmpeg |
| Features actually tested | `studio qa` → `studio/out/qa/report.json` + `contact-sheet.png` |
| Local-only execution | `hardware/detectMac.js` + `LOCAL_AI_URL` loopback-only guard |
