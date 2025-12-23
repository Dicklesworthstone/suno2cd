import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loaded = false;
let fileCounter = 0;

export type ProgressCallback = (progress: number, message: string) => void;

export function checkBrowserSupport(): { supported: boolean; message: string; needsReload?: boolean } {
  if (typeof WebAssembly === 'undefined') {
    return {
      supported: false,
      message: 'Your browser does not support WebAssembly. Please use a modern browser.',
    };
  }

  // Check if we're cross-origin isolated (required for SharedArrayBuffer)
  if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
    return { supported: true, message: '' };
  }

  // Check if SharedArrayBuffer is available directly (some contexts)
  if (typeof SharedArrayBuffer !== 'undefined') {
    return { supported: true, message: '' };
  }

  // Service worker may be loading - will auto-reload when ready
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isFile = location.protocol === 'file:';

  if (isLocalhost || isFile) {
    return {
      supported: false,
      message: 'SharedArrayBuffer requires specific server headers. Try running with: bunx vite --host',
    };
  }

  // coi-serviceworker should auto-reload - give it a moment
  return {
    supported: false,
    needsReload: true,
    message: 'Preparing secure context... If this persists, please refresh the page.',
  };
}

export async function loadFFmpeg(onProgress?: ProgressCallback): Promise<void> {
  if (loaded) return;

  const support = checkBrowserSupport();
  if (!support.supported) {
    throw new Error(support.message);
  }

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  onProgress?.(0, 'Downloading FFmpeg core...');

  // Use jsDelivr (faster/more reliable than unpkg) with version matching @ffmpeg/ffmpeg
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

  // Track download progress for both files
  const downloadState = {
    core: { received: 0, total: 0 },
    wasm: { received: 0, total: 0 },
  };

  const updateProgress = () => {
    const totalBytes = downloadState.core.total + downloadState.wasm.total;
    const receivedBytes = downloadState.core.received + downloadState.wasm.received;

    if (totalBytes > 0) {
      const percent = (receivedBytes / totalBytes) * 100;
      const receivedMB = (receivedBytes / 1024 / 1024).toFixed(1);
      const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
      onProgress?.(percent, `Downloading: ${receivedMB} / ${totalMB} MB`);
    }
  };

  // Download both files with progress tracking
  const coreURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.js`,
    'text/javascript',
    true,
    (event) => {
      downloadState.core.received = event.received;
      downloadState.core.total = event.total;
      updateProgress();
    }
  );

  const wasmURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.wasm`,
    'application/wasm',
    true,
    (event) => {
      downloadState.wasm.received = event.received;
      downloadState.wasm.total = event.total;
      updateProgress();
    }
  );

  onProgress?.(100, 'Initializing FFmpeg...');

  await ffmpeg.load({
    coreURL,
    wasmURL,
  });

  loaded = true;
  onProgress?.(100, 'FFmpeg ready');
}

export interface ConversionResult {
  blob: Blob;
  filename: string;
  originalName: string;
}

// Track used names to handle duplicates
const usedOutputNames = new Map<string, number>();

function getUniqueFilename(desiredName: string): string {
  const count = usedOutputNames.get(desiredName) ?? 0;

  if (count === 0) {
    usedOutputNames.set(desiredName, 1);
    return desiredName;
  }

  // Insert " (n)" before extension
  const lastDot = desiredName.lastIndexOf('.');
  const base = lastDot >= 0 ? desiredName.slice(0, lastDot) : desiredName;
  const ext = lastDot >= 0 ? desiredName.slice(lastDot) : '';

  usedOutputNames.set(desiredName, count + 1);
  return `${base} (${count + 1})${ext}`;
}

export function resetFilenameTracking(): void {
  usedOutputNames.clear();
}

export async function convertToCDQuality(
  file: File,
  onProgress?: ProgressCallback
): Promise<ConversionResult> {
  if (!ffmpeg || !loaded) {
    throw new Error('FFmpeg not loaded. Call loadFFmpeg() first.');
  }

  // Use unique counter to prevent filename collisions in ffmpeg's virtual filesystem
  const uniqueId = ++fileCounter;
  const inputExt = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const inputName = `input_${uniqueId}${inputExt}`;
  const outputName = `output_${uniqueId}.wav`;

  // Generate unique display filename
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const desiredDisplayName = `${baseName}.wav`;
  const displayName = getUniqueFilename(desiredDisplayName);

  onProgress?.(10, `Loading ${file.name}...`);
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  let lastProgress = 10;
  const progressHandler = ({ progress }: { progress: number }) => {
    const pct = 10 + Math.round(progress * 80);
    if (pct > lastProgress) {
      lastProgress = pct;
      onProgress?.(pct, `Converting: ${Math.round(progress * 100)}%`);
    }
  };

  ffmpeg.on('progress', progressHandler);

  try {
    onProgress?.(15, 'Converting to 44.1kHz 16-bit stereo WAV...');

    // Convert to CD-quality WAV:
    //  -ar 44100      -> resample to 44.1kHz
    //  -ac 2          -> force stereo output
    //  -sample_fmt s16 -> 16-bit samples
    //  -c:a pcm_s16le -> 16-bit PCM little-endian
    const exitCode = await ffmpeg.exec([
      '-i', inputName,
      '-ar', '44100',
      '-ac', '2',
      '-sample_fmt', 's16',
      '-c:a', 'pcm_s16le',
      '-y',
      outputName
    ]);

    // Check exit code (0 = success)
    if (exitCode !== 0) {
      throw new Error(`FFmpeg failed for "${file.name}" (exit code: ${exitCode})`);
    }

    onProgress?.(90, 'Reading output...');
    const data = await ffmpeg.readFile(outputName);

    // Clean up to reduce memory usage
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    onProgress?.(100, 'Done');

    // Handle both Uint8Array and string (should always be Uint8Array for binary files)
    const blobData = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
    const blob = new Blob([blobData], { type: 'audio/wav' });

    return {
      blob,
      filename: displayName,
      originalName: file.name,
    };
  } finally {
    ffmpeg.off('progress', progressHandler);
  }
}

export function isAudioFile(file: File): boolean {
  const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return file.type.startsWith('audio/') || audioExtensions.includes(ext);
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
