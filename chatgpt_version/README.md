# Suno → CD‑Quality WAV (GitHub Pages)

A tiny static web app that converts Suno exports (often 48kHz MP3/WAV) into **CD‑quality WAV**:

- **44,100 Hz** sample rate
- **16‑bit PCM** (`pcm_s16le`)
- **Stereo (2 channels)**

Everything runs **client-side** in your browser using **ffmpeg.wasm**. No uploads.

## Local dev

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

The production build output is in `dist/`.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` will build and deploy.

Notes:

- `vite.config.ts` uses `base: './'` so the built site works under a repo subpath like `https://<user>.github.io/<repo>/`.
- This project uses the **single-threaded** FFmpeg core (`@ffmpeg/core`) because GitHub Pages can't easily set the cross-origin isolation headers required for multi-threading.

## Customize the FFmpeg command

The conversion is done with:

```txt
ffmpeg -i input -ar 44100 -ac 2 -c:a pcm_s16le output.wav
```

If you want to preserve mono inputs (instead of forcing stereo), remove `-ac 2`.
