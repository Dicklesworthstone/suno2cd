# Suno2CD

Convert [Suno AI](https://suno.com) audio files to CD quality format for distribution platforms like CDBaby, DistroKid, and TuneCore.

**[Launch App](https://dicklesworthstone.github.io/suno2cd/)** | [Report Bug](https://github.com/Dicklesworthstone/suno2cd/issues)

---

## The Problem

Suno AI exports audio at **48kHz**, but music distribution platforms like CDBaby require **CD quality**:
- **44.1kHz** sample rate
- **16-bit** depth
- **WAV** format

Manually converting files with audio software is tedious, especially when you have multiple tracks.

## The Solution

Suno2CD converts your audio files to exact CD specifications **directly in your browser**:

- **No uploads** - All processing happens locally using WebAssembly
- **No installation** - Works in any modern browser
- **No cost** - Completely free, forever
- **Batch processing** - Convert multiple files at once
- **Preserves filenames** - Just changes the extension to `.wav`

## How It Works

1. **Drop your audio files** (MP3, WAV, FLAC, OGG, or M4A)
2. **Click "Convert to CD Quality"**
3. **Download** your CD-ready WAV files

That's it. The conversion uses FFmpeg compiled to WebAssembly, running entirely in your browser.

## Technical Details

### Output Format
| Property | Value |
|----------|-------|
| Sample Rate | 44,100 Hz |
| Bit Depth | 16-bit |
| Channels | Stereo (preserved from source) |
| Format | WAV (PCM signed 16-bit little-endian) |

### Browser Requirements
- Modern browser with WebAssembly support
- SharedArrayBuffer support (Chrome, Firefox, Edge)
- ~30MB download for FFmpeg core (cached after first use)

### Privacy
Your audio files **never leave your device**. All processing is performed locally using FFmpeg.wasm. There are no servers, no uploads, no tracking.

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
git clone https://github.com/Dicklesworthstone/suno2cd.git
cd suno2cd
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Tech Stack
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (via CDN)
- **FFmpeg.wasm** - Audio processing
- **coi-serviceworker** - SharedArrayBuffer headers for static hosts

## Deployment

The app auto-deploys to GitHub Pages on push to `main`. See `.github/workflows/deploy.yml`.

To deploy manually:
```bash
npm run build
# Upload contents of `dist/` to any static host
```

## License

MIT

---

Made for musicians who just want their music distributed without the hassle.
