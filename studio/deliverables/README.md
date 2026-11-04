# Delivered output — ensemble revision

The current `final-silent-short.mp4` is newly rendered from
`presets/scripts/bridge-ensemble.txt`: **Mara, Elise and Tomas**, 1080×1920,
30 fps, 1800 frames, 60.00 seconds, H.264/yuv420p, 39,492,678 bytes.
Local **software backend**; this is not a full-film Chrome/Metal render.
FFmpeg stream audit confirms video present, audio/subtitle streams absent.
The previous movie is preserved in Git and locally in ignored `out/previous-delivery/`.

| File | Evidence |
|---|---|
| `final-contact-sheet.png` | Twelve frames decoded from the newly encoded MP4, every five seconds. |
| `plan.json` | The exact plan used by this render, with all three character identities. |
| `timing.json`, `camera-report.md` | Frame ranges / beat map and camera purpose + move report for this film. |
| `{mara,elise,tomas}-reference-sheet.png`, `character-sheets.json` | Current ensemble reference sheets. |
| `qa-report.json`, `qa-contact-sheet.png` | Fifteen standalone QA cases; not exhaustive final-film acceptance. |
| `review-v2/temporal-report.json`, `consecutive-review.png` | 900 consecutive action-test frames, limits, per-frame measurements and review strips. |
| `review-v2/chrome-depth.json`, `chrome-depth.png` | Actual Chromium/SwiftShader parallax (64.02 vs 33 px) and front/rear occlusion proof. Probe world is vertically offset to keep diagnostic markers unobstructed. |
| `review-v2/chrome-interaction.png`, `chrome-interaction.json` | Decoded real Three.js interaction frame and three-frame Chrome encode audit. |
| `review-v2/palette-ab.png` | Original (left) versus print-grade study (right); separate romance sample, not the final film. |
| `review-v2/verification.json` | Explicit verified / limited / unavailable status and movie hash. |

`character-reference-sheet.png` and `color-direction.json` are retained **legacy** evidence
(single-Soldier sheet and the original three-script hue comparison), not current ensemble metadata.

## Limits — do not infer more than the evidence proves

- Chrome depth and short-frame encoding are verified on Linux using software WebGL, **not Apple Metal**.
  Full 60-second Chrome rendering has not been accepted. The sequence-capture mode stalled; the backend
  now defaults to serial `renderStill` capture, which passed a three-frame scene + encode smoke test.
- Temporal checks cover five 180-frame action sequences, rig-space movement, projected body bounds,
  and mean-luma flicker. These are heuristics, not semantic artifact detection, full-body silhouette
  collision detection or frame-by-frame artistic acceptance of all 1800 final-film frames.
- IK reach/contact, vertical support-foot correction, hair/hem lag and expression blending are implemented.
  This is still a procedural rig: vertical ground correction is **not horizontal foot-lock IK**.
- Apple Vision, sips, token-saver and Obsidian integrations require execution on the Mac. Their checks
  were **unavailable**, not passed, in this Linux run. Zero-text OCR is not yet certified on the final film.
- No audio, subtitle, caption or dialogue-overlay generation is implemented.
