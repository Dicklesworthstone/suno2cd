# Changelog

All notable changes to [Suno2CD](https://github.com/Dicklesworthstone/suno2cd) are documented here.

This project has no tagged releases. Changes are organized chronologically by commit, grouped into logical phases. Every entry links to its commit on GitHub.

Live app: <https://dicklesworthstone.github.io/suno2cd/>

---

## Unreleased (HEAD)

Latest commit: [`0fa3744`](https://github.com/Dicklesworthstone/suno2cd/commit/0fa3744e365f2f54c0606426fadeb93748b0b9de) -- 2026-02-22

No tagged releases exist yet. All changes below represent the full project history on `main`.

---

## 2026-02-22 -- License and metadata updates

### Documentation

- Update README license references to reflect MIT + OpenAI/Anthropic Rider ([`0fa3744`](https://github.com/Dicklesworthstone/suno2cd/commit/0fa3744e365f2f54c0606426fadeb93748b0b9de))

### License

- Replace plain MIT license with MIT + OpenAI/Anthropic Rider restricting use by OpenAI, Anthropic, and their affiliates without express written permission from Jeffrey Emanuel ([`dcbad4d`](https://github.com/Dicklesworthstone/suno2cd/commit/dcbad4dc2790656ccaaadaefb98e9d8b301368f3))

---

## 2026-02-21 -- Social preview

### Chores

- Add GitHub social preview image (1280x640 PNG) for consistent link previews ([`f53be5a`](https://github.com/Dicklesworthstone/suno2cd/commit/f53be5ae5b5174347085d851f8d524986b1e60d7))

---

## 2026-01-21 -- Initial license

### License

- Add MIT License, copyright Jeffrey Emanuel ([`a0e7cdf`](https://github.com/Dicklesworthstone/suno2cd/commit/a0e7cdf5273cdf352e77c04396d4211874452a1e))

---

## 2026-01-18 -- Dependency maintenance

### Dependencies

- Update Node.js dependencies to latest stable versions: `typescript`, `vite`, `@ffmpeg/ffmpeg`, `@ffmpeg/util` ([`297471e`](https://github.com/Dicklesworthstone/suno2cd/commit/297471eb1e1b1115370ba27d54ba0110656a0edd))

---

## 2026-01-09 -- Extended format support

### Features

- Add support for additional audio/video formats: AAC, WMA, AIFF, M4V, WMV ([`b64e52b`](https://github.com/Dicklesworthstone/suno2cd/commit/b64e52b1f94e721e66a009f9a4ce655117cb5a89))

---

## 2025-12-22 -- Initial development

Everything below was developed in a single session on 2025-12-22. Commits are listed newest-first within each category.

### Features

- **Video file support**: Accept MP4, MKV, MOV, AVI, WebM video files and automatically extract their audio tracks; show video icon and "extracting audio" label in the UI ([`825c8dd`](https://github.com/Dicklesworthstone/suno2cd/commit/825c8ddd0f776df3c43c70b4826374afc23d1bc6))
- **iOS support via hybrid FFmpeg**: Use multi-threaded FFmpeg when SharedArrayBuffer is available (desktop Chrome/Firefox/Edge); fall back to single-threaded FFmpeg on iOS and other browsers without SharedArrayBuffer; show which mode is active in progress messages ([`df1a961`](https://github.com/Dicklesworthstone/suno2cd/commit/df1a961f05b9f1615a711e97d3699dd9bcac0ba2))
- **ZIP download with progress**: Add "Download All as ZIP" via JSZip with percentage progress indicator during ZIP creation ([`3c99f21`](https://github.com/Dicklesworthstone/suno2cd/commit/3c99f21fade002d33fce4b589aed581c0a37af35), [`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a))
- **Real FFmpeg download progress**: Show actual MB downloaded during FFmpeg WASM core fetch; switch to jsDelivr CDN for faster/more reliable delivery ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a))
- **Duplicate filename handling**: Automatically add `(2)`, `(3)` suffixes for files with the same name ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a))
- **Explicit stereo output**: Add `-ac 2` flag for consistent stereo output across all conversions ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a))
- **Exit code checking**: Properly catch FFmpeg conversion failures via exit code inspection ([`35eaef1`](https://github.com/Dicklesworthstone/suno2cd/commit/35eaef14c1c1c563d26b8dc976b66e96c358a92a))
- **Major UI/UX overhaul**: Mobile-first redesign with Stripe-level visual polish, glassmorphism effects, animated gradient orbs, Inter variable font, swipe-to-delete with haptic feedback, safe area support for notched phones, smooth animations, toast notifications, accessibility improvements (focus states, ARIA), reduced motion support ([`8f6b16c`](https://github.com/Dicklesworthstone/suno2cd/commit/8f6b16cf601fb9e45b56c689b31a2e37656d0b8a))
- **Initial release**: Browser-based Suno AI audio converter using FFmpeg.wasm; 48kHz to 44.1kHz/16-bit WAV conversion; drag-and-drop file upload; batch processing with progress tracking; automatic GitHub Pages deployment ([`63a62b9`](https://github.com/Dicklesworthstone/suno2cd/commit/63a62b93d3cffc98af84a7debfb9bb891877f058))

### Bug Fixes

- Fix deprecated `apple-mobile-web-app-capable` meta tag, replaced with `mobile-web-app-capable` ([`dd577f0`](https://github.com/Dicklesworthstone/suno2cd/commit/dd577f0230c45e345e80ed7ef1fdc5c50fad7577))
- Fix race condition in file removal: splice array immediately to avoid stale indices when rapidly deleting multiple files; add comment explaining Uint8Array copy needed for SharedArrayBuffer ([`06a3ba3`](https://github.com/Dicklesworthstone/suno2cd/commit/06a3ba337855cc22ec77c43befd95899e241c837))
- Fix infinite reload loop on iOS: detect iOS devices, show clear "not supported" message (before hybrid FFmpeg landed), track reload attempts in sessionStorage with max-2 cap ([`6e584a9`](https://github.com/Dicklesworthstone/suno2cd/commit/6e584a96855b6f693ef3e99c3d1143ec5a619cf7))
- Fix FFmpeg download error: remove `toBlobURL` progress callback that caused "body stream already read" error ([`7a71e13`](https://github.com/Dicklesworthstone/suno2cd/commit/7a71e13f55155323b9539cbde2be6436035ea76b))
- Fix progress bar jumping from 100% back to 30% by scaling FFmpeg download progress to 0-30% range; fix haptic feedback triggering multiple times during swipe by adding `hapticTriggered` flag; host `coi-serviceworker.js` locally to fix cross-origin registration error ([`3367faf`](https://github.com/Dicklesworthstone/suno2cd/commit/3367faf418abfd921f271a6ca1eae5ca04f70f72))
- Fix SharedArrayBuffer detection: check `crossOriginIsolated` first; show loading state during service worker initialization; auto-refresh after 2 seconds with manual refresh fallback ([`56a00d6`](https://github.com/Dicklesworthstone/suno2cd/commit/56a00d6401ec24bf27bf5b331be65c5597759c56))
- Fix iOS visual glitch: hide body until CSS is ready with opacity transition; add fallback SVG sizing; use double `requestAnimationFrame` to ensure Tailwind has processed ([`825c8dd`](https://github.com/Dicklesworthstone/suno2cd/commit/825c8ddd0f776df3c43c70b4826374afc23d1bc6))

### CI/CD

- Fix GitHub Actions deployment: switch workflow from npm to bun using `oven-sh/setup-bun@v2` action ([`561a52a`](https://github.com/Dicklesworthstone/suno2cd/commit/561a52a1583e6ce9e0584016cd7cf2fc79db37ec))

### Documentation

- Update README: switch npm commands to bun, document iOS Safari support with single-threaded fallback, note multi-threaded mode for desktop browsers; remove `chatgpt_version/` directory ([`073604e`](https://github.com/Dicklesworthstone/suno2cd/commit/073604e242baec3cc89b1655b8d4b9bd5742f965))

---

## Architecture and tech stack

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

### Output format

44,100 Hz sample rate, 16-bit depth, stereo, WAV (PCM signed 16-bit little-endian).

### Supported input formats

**Audio**: MP3, WAV, FLAC, OGG, AAC, WMA, AIFF, M4A
**Video** (audio extraction): MP4, MKV, MOV, AVI, WebM, M4V, WMV

### Key design decisions

- **No server**: All processing runs client-side via WebAssembly. Files never leave the device.
- **Hybrid threading**: Multi-threaded FFmpeg on desktop (requires SharedArrayBuffer via coi-serviceworker); single-threaded fallback on iOS and browsers without SharedArrayBuffer support.
- **Batch workflow**: Multiple files can be dropped, converted, and downloaded individually or as a single ZIP.
