# PhD Simulator: event art style

*Retired 2026-10-18: every slot now uses Arthur's AI-generated pictures (`art-prompts.md`, imported with `tools/phd-sim/import-art.py`). The flat SVGs this guide describes are in git history.*

Every random event shows a small picture for its category: 2–3 pictures per category, and the game picks one per event by hashing the event id, so the same event always shows the same picture. Files live in `assets/phd-sim/art/<category>-<n>.svg` (n starts at 1). The reference is `research-1.svg`; match its look.

## Format
- Plain SVG: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128" width="320" height="128">`.
- Under 4 KB each. No `<style>`, `<script>`, `<text>`, filters, gradients, masks, external references, comments or metadata. Must be well-formed XML.
- Full-bleed background `<rect width="320" height="128" fill="…"/>` first, then the scene. The picture sits at the top of the event card, about 320 × 128 on screen, so keep the subject large and centered with some breathing room at the edges.

## Look
- Flat, friendly and a little cute, like the rounded game font. Simple shapes, no fine detail.
- Main objects get an ink outline: `stroke="#283454" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"` (wrap them in one `<g>` with those attributes, as the reference does). Small accents (stars, dots, sparkles) can go without outline.
- **Only these colors:**
  - ink `#283454`, paper `#f6efe0`, cream `#fffdf7`, sand `#e4d9c3`, brown `#8a6a4f`
  - coral `#e0663f`, light coral `#f4a988`, yellow `#f4bd2a`, purple `#9b7bf2`, red `#ef6461`
  - green `#2f8a55`, light green `#a8d5b5`, blue `#3b6fd8`, light blue `#a9c1f0`
  - skin tones `#f1c7a3`, `#c98e65`, `#8d5b3c` (vary them across pictures)
- Background: one soft color per picture (light blue, light green, light coral, sand, paper, purple for night scenes), often with a floor or ground band.
- **People:** circle head (r ≈ 13–16), a hair shape in ink or brown, two dot eyes, a small smile or expression arc, body as a rounded shape; no hands detail needed. Vary hair, skin and clothes colors. Keep everyone gender-neutral and friendly. A "professor" can have glasses (two small circles) or gray-ish hair (sand).
- **No words, letters, digits, logos, brands or real people.** Writing on screens, papers and signs is drawn as lines; scores are dots or stars.
- No serious topics: nothing scary, medical emergencies, conflict or sadness beyond mild comedy (a sigh, a messy desk).
