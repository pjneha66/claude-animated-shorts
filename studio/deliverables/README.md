# Delivered output — visual-only silent short

These files are **tracked** so they survive workspace snapshots. Generated scratch (`out/`, `node_modules/`)
is intentionally ignored.

| File | What it is |
|---|---|
| `final-silent-short.mp4` | **THE FINAL FILM.** 1080×1920 (9:16), 30 fps, 60.00 s, 1800 frames, H.264, yuv420p, 32,764,868 bytes. Verified: video stream present, **audio stream absent**, **subtitle stream absent**. Locally encoded with FFmpeg. |
| `final-contact-sheet.png` | 7 frames decoded *from the encoded MP4* (frames 0/300/600/900/1200/1500/1799) showing real animated motion, camera sizes and palette changes. |
| `character-reference-sheet.png` | Three views, 11 expressions, 9 gestures for the lead character; consistent red/gold uniform, face, hair and colour identity. |
| `character-sheets.json` | Character identity hashes and sheet specs proving appearance consistency between shots. |
| `color-direction.json` | `SceneColorDirector` output for 3 different scripts (story hues 0° / 346° / 265°) plus every scene's computed palette. Proof that colours are story-derived, not fixed. |
| `plan.json` | Full 60 s shot plan: analysis, characters, environments, lighting, VFX, camera, body/face/hand actions, silent output contract. |
| `qa-contact-sheet.png` | 15 real rendered QA scenes (lighting, palette, joints, hands, faces, overlap, artifacts). |
| `qa-report.json` | 15/15 scenes passed, `issues: []`, `fixes: []`, with numeric pixel checks. |

**No audio, subtitles, captions, SRT/VTT or text overlays exist anywhere in this output.** The user adds
audio and subtitles later. See `../README.md` for how to re-render locally, and `../../STUDIO_RULES.md`
for the 21 binding rules.
