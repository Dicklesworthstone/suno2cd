# Changelog

All notable changes to [Suno2CD](https://github.com/Dicklesworthstone/suno2cd) are documented here.

This project has no tagged releases or GitHub Releases. The entire history lives on `main` as individual commits. Entries below are organized by capability, not by diff order.

Live app: <https://dicklesworthstone.github.io/suno2cd/>

---

## Unreleased

Latest commit: [`0fa3744`](https://github.com/Dicklesworthstone/suno2cd/commit/0fa3744e365f2f54c0606426fadeb93748b0b9de) -- 2026-02-22

---

## Core conversion engine

The fundamental audio pipeline -- FFmpeg.wasm running entirely in the browser, converting any supported input to 44.1 kHz / 16-bit / stereo WAV (PCM s16le).

- **Initial implementation** -- drag-and-drop file upload, batch processing, progress tracking, 48 kHz to 44.1 kHz conversion via FFmpeg.wasm ([`63a62b9`](https://github.com/Dicklesworthstone/suno2cd/commit/63a62b93d3cffc98af84a7debfb9bb891877f058) -- 2025-12-22)
- **Explicit stereo output** -- add `-ac 2` flag so every conversion produces consistent stereo regardless of source channel layout ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a) -- 2025-12-22)
- **Exit-code checking** -- properly catch FFmpeg conversion failures instead of silently producing empty output ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a) -- 2025-12-22)
- **Version-matched FFmpeg core** -- pin `@ffmpeg/core@0.12.10` and switch CDN to jsDelivr for faster, more reliable delivery ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a) -- 2025-12-22)

---

## Format support

All formats FFmpeg can decode are accepted. These commits explicitly wired new MIME types and extensions into the drop zone.

- **Audio**: MP3, WAV, FLAC, OGG, M4A (initial commit [`63a62b9`](https://github.com/Dicklesworthstone/suno2cd/commit/63a62b93d3cffc98af84a7debfb9bb891877f058) -- 2025-12-22)
- **Video (audio extraction)**: MP4, MKV, MOV, AVI, WebM -- automatically extract audio track, show video icon and "extracting audio" label ([`825c8dd`](https://github.com/Dicklesworthstone/suno2cd/commit/825c8ddd0f776df3c43c70b4826374afc23d1bc6) -- 2025-12-22)
- **Extended formats**: AAC, WMA, AIFF, M4V, WMV ([`b64e52b`](https://github.com/Dicklesworthstone/suno2cd/commit/b64e52b1f94e721e66a009f9a4ce655117cb5a89) -- 2026-01-09)

---

## iOS and cross-browser compatibility

Getting FFmpeg.wasm to run on iOS Safari required a multi-step journey through SharedArrayBuffer constraints.

- **SharedArrayBuffer detection** -- check `crossOriginIsolated` first; show loading state during service-worker initialization; auto-refresh after 2 seconds with manual-refresh fallback ([`56a00d6`](https://github.com/Dicklesworthstone/suno2cd/commit/56a00d6401ec24bf27bf5b331be65c5597759c56) -- 2025-12-22)
- **Local coi-serviceworker** -- host `coi-serviceworker.js` in `public/` to fix cross-origin registration error ([`3367faf`](https://github.com/Dicklesworthstone/suno2cd/commit/3367faf418abfd921f271a6ca1eae5ca04f70f72) -- 2025-12-22)
- **iOS infinite-reload guard** -- detect iOS, show clear "not supported" message, cap reload attempts at 2 via `sessionStorage` ([`6e584a9`](https://github.com/Dicklesworthstone/suno2cd/commit/6e584a96855b6f693ef3e99c3d1143ec5a619cf7) -- 2025-12-22)
- **Hybrid multi/single-threaded FFmpeg** -- use multi-threaded FFmpeg when SharedArrayBuffer is available (desktop Chrome/Firefox/Edge); fall back to single-threaded FFmpeg on iOS and other browsers; show which mode is active in progress messages. This removed all iOS blocking -- the app now works on every device with WebAssembly ([`df1a961`](https://github.com/Dicklesworthstone/suno2cd/commit/df1a961f05b9f1615a711e97d3699dd9bcac0ba2) -- 2025-12-22)
- **Deprecated meta tag** -- replace `apple-mobile-web-app-capable` with `mobile-web-app-capable` ([`dd577f0`](https://github.com/Dicklesworthstone/suno2cd/commit/dd577f0230c45e345e80ed7ef1fdc5c50fad7577) -- 2025-12-22)
- **iOS visual-glitch fix** -- hide body until CSS is ready (`opacity: 0` to `1` transition); add fallback SVG sizing; use double `requestAnimationFrame` to ensure Tailwind has processed ([`825c8dd`](https://github.com/Dicklesworthstone/suno2cd/commit/825c8ddd0f776df3c43c70b4826374afc23d1bc6) -- 2025-12-22)

---

## UI/UX and visual design

The interface went from a bare functional page to a polished mobile-first design in the initial development session.

- **Major UI/UX overhaul** -- mobile-first Stripe-level visual polish: glassmorphism effects, animated gradient orbs, Inter variable font, responsive typography, swipe-to-delete with haptic feedback, safe-area support for notched phones, smooth animations, toast notifications, accessibility improvements (focus states, ARIA), `prefers-reduced-motion` support ([`8f6b16c`](https://github.com/Dicklesworthstone/suno2cd/commit/8f6b16cf601fb9e45b56c689b31a2e37656d0b8a) -- 2025-12-22)
- **Haptic deduplication** -- add `hapticTriggered` flag so haptic feedback fires only once when the swipe threshold is crossed, not continuously ([`3367faf`](https://github.com/Dicklesworthstone/suno2cd/commit/3367faf418abfd921f271a6ca1eae5ca04f70f72) -- 2025-12-22)

---

## Progress and download UX

- **Real FFmpeg download progress** -- show actual MB downloaded during FFmpeg WASM core fetch ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a) -- 2025-12-22)
- **Progress-bar scaling fix** -- scale FFmpeg download progress to 0--30% range so it does not jump from 100% back to 30% when per-file conversion begins ([`3367faf`](https://github.com/Dicklesworthstone/suno2cd/commit/3367faf418abfd921f271a6ca1eae5ca04f70f72) -- 2025-12-22)
- **Download progress callback removed** -- the `toBlobURL` progress callback caused a "body stream already read" error; simplified to basic `toBlobURL` without progress tracking ([`7a71e13`](https://github.com/Dicklesworthstone/suno2cd/commit/7a71e13f55155323b9539cbde2be6436035ea76b) -- 2025-12-22)
- **ZIP download** -- "Download All as ZIP" via JSZip with percentage progress indicator during ZIP creation ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a), [`3c99f21`](https://github.com/Dicklesworthstone/suno2cd/commit/3c99f21fade002d33fce4b589aed581c0a37af35) -- 2025-12-22)
- **Duplicate filename handling** -- automatically append `(2)`, `(3)`, etc. when multiple files share the same name ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a) -- 2025-12-22)

---

## Bug fixes (file handling)

- **Race condition in file removal** -- splice array immediately instead of waiting for the animation callback, preventing wrong files from being removed when the user deletes rapidly; add comment explaining why `Uint8Array` copy is needed for SharedArrayBuffer data ([`06a3ba3`](https://github.com/Dicklesworthstone/suno2cd/commit/06a3ba337855cc22ec77c43befd95899e241c837) -- 2025-12-22)

---

## CI/CD and deployment

- **GitHub Pages workflow** -- initial `deploy.yml` using npm ([`63a62b9`](https://github.com/Dicklesworthstone/suno2cd/commit/63a62b93d3cffc98af84a7debfb9bb891877f058) -- 2025-12-22)
- **Switch workflow to Bun** -- workflow was failing because it used npm but the repo has `bun.lockb`; updated to `oven-sh/setup-bun@v2` ([`561a52a`](https://github.com/Dicklesworthstone/suno2cd/commit/561a52a1583e6ce9e0584016cd7cf2fc79db37ec) -- 2025-12-22)

---

## Dependencies

- **Routine dependency update** -- bump `typescript`, `vite`, `@ffmpeg/ffmpeg`, `@ffmpeg/util` to latest stable versions ([`297471e`](https://github.com/Dicklesworthstone/suno2cd/commit/297471eb1e1b1115370ba27d54ba0110656a0edd) -- 2026-01-18)

---

## Documentation

- **README: Bun and iOS** -- switch npm commands to bun, document iOS Safari support with single-threaded fallback, note multi-threaded mode for desktop browsers; remove leftover `chatgpt_version/` directory ([`073604e`](https://github.com/Dicklesworthstone/suno2cd/commit/073604e242baec3cc89b1655b8d4b9bd5742f965) -- 2025-12-22)
- **README: license references** -- update license line to reflect MIT + OpenAI/Anthropic Rider ([`0fa3744`](https://github.com/Dicklesworthstone/suno2cd/commit/0fa3744e365f2f54c0606426fadeb93748b0b9de) -- 2026-02-22)

---

## License

- **Add MIT License** -- copyright Jeffrey Emanuel ([`a0e7cdf`](https://github.com/Dicklesworthstone/suno2cd/commit/a0e7cdf5273cdf352e77c04396d4211874452a1e) -- 2026-01-21)
- **MIT with OpenAI/Anthropic Rider** -- replace plain MIT with a rider restricting use by OpenAI, Anthropic, and their affiliates without express written permission ([`dcbad4d`](https://github.com/Dicklesworthstone/suno2cd/commit/dcbad4dc2790656ccaaadaefb98e9d8b301368f3) -- 2026-02-21)

---

## Repository metadata

- **Social preview** -- add 1280x640 PNG for consistent social-media link previews ([`f53be5a`](https://github.com/Dicklesworthstone/suno2cd/commit/f53be5ae5b5174347085d851f8d524986b1e60d7) -- 2026-02-21)

---

## Architecture reference

| Component | Technology |
|-----------|------------|
| Build tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS (CDN) |
| Audio processing | FFmpeg.wasm (`@ffmpeg/ffmpeg` + `@ffmpeg/core`) |
| Cross-origin isolation | coi-serviceworker (local copy) |
| ZIP creation | JSZip (CDN) |
| Deployment | GitHub Pages (auto-deploy on push to `main`) |
| Package manager | Bun |

**Output format**: 44,100 Hz, 16-bit, stereo, WAV (PCM signed 16-bit little-endian).

**Supported inputs**: MP3, WAV, FLAC, OGG, AAC, WMA, AIFF, M4A | MP4, MKV, MOV, AVI, WebM, M4V, WMV (video -- audio extracted automatically).
