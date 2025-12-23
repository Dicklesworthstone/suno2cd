import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loaded = false;
let fileCounter = 0;

export type ProgressCallback = (progress: number, message: string) => void;

export function checkBrowserSupport(): { supported: boolean; message: string } {
  // Only check for WebAssembly - we have fallbacks for everything else
  if (typeof WebAssembly === 'undefined') {
    return {
      supported: false,
      message: 'Your browser does not support WebAssembly. Please use a modern browser.',
    };
  }

  return { supported: true, message: '' };
}

// Check if we can use multi-threaded FFmpeg (faster but requires SharedArrayBuffer)
function canUseMultiThreaded(): boolean {
  // Check for cross-origin isolation (required for SharedArrayBuffer)
  if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
    return true;
  }
  // Some contexts have SharedArrayBuffer without crossOriginIsolated flag
  if (typeof SharedArrayBuffer !== 'undefined') {
    return true;
  }
  return false;
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

  // Use multi-threaded version if SharedArrayBuffer is available (faster)
  // Fall back to single-threaded for iOS and other browsers without SharedArrayBuffer
  const useMultiThreaded = canUseMultiThreaded();
  const corePackage = useMultiThreaded ? '@ffmpeg/core-mt@0.12.6' : '@ffmpeg/core@0.12.6';
  const baseURL = `https://cdn.jsdelivr.net/npm/${corePackage}/dist/esm`;

  const mode = useMultiThreaded ? 'multi-threaded (faster)' : 'single-threaded';
  onProgress?.(0, `Downloading FFmpeg ${mode}...`);

  // Download core JS file
  onProgress?.(10, 'Downloading FFmpeg core...');
  const coreURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.js`,
    'text/javascript'
  );

  // Download WASM file (the large one ~31MB for single-threaded, ~32MB for multi-threaded)
  onProgress?.(30, 'Downloading FFmpeg WASM...');
  const wasmURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.wasm`,
    'application/wasm'
  );

  // Multi-threaded version also needs the worker file
  let workerURL: string | undefined;
  if (useMultiThreaded) {
    onProgress?.(80, 'Downloading FFmpeg worker...');
    workerURL = await toBlobURL(
      `${baseURL}/ffmpeg-core.worker.js`,
      'text/javascript'
    );
  }

  onProgress?.(100, 'Initializing FFmpeg...');

  await ffmpeg.load({
    coreURL,
    wasmURL,
    ...(workerURL && { workerURL }),
  });

  loaded = true;
  const readyMsg = useMultiThreaded ? 'FFmpeg ready (multi-threaded)' : 'FFmpeg ready';
  onProgress?.(100, readyMsg);
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
    // Note: new Uint8Array(data) creates a copy backed by regular ArrayBuffer,
    // which is needed because FFmpeg may use SharedArrayBuffer internally
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

// Supported audio extensions
const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff'];

// Supported video extensions (will extract audio)
const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.wmv'];

export function isAudioFile(file: File): boolean {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return file.type.startsWith('audio/') || audioExtensions.includes(ext);
}

export function isVideoFile(file: File): boolean {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return file.type.startsWith('video/') || videoExtensions.includes(ext);
}

export function isSupportedMediaFile(file: File): boolean {
  return isAudioFile(file) || isVideoFile(file);
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
