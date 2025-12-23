import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loaded = false;
let fileCounter = 0;

export type ProgressCallback = (progress: number, message: string) => void;

export function checkBrowserSupport(): { supported: boolean; message: string } {
  if (typeof SharedArrayBuffer === 'undefined') {
    return {
      supported: false,
      message: 'Your browser does not support SharedArrayBuffer. Please use a modern browser like Chrome, Firefox, or Edge.',
    };
  }
  if (typeof WebAssembly === 'undefined') {
    return {
      supported: false,
      message: 'Your browser does not support WebAssembly. Please use a modern browser.',
    };
  }
  return { supported: true, message: '' };
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

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  loaded = true;
  onProgress?.(100, 'FFmpeg ready');
}

export interface ConversionResult {
  blob: Blob;
  filename: string;
  originalName: string;
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
  const inputName = `input_${uniqueId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const outputName = `output_${uniqueId}.wav`;
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const displayName = `${baseName}.wav`;

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
    onProgress?.(15, 'Converting to 44.1kHz 16-bit WAV...');

    await ffmpeg.exec([
      '-i', inputName,
      '-ar', '44100',
      '-sample_fmt', 's16',
      '-c:a', 'pcm_s16le',
      '-y',
      outputName
    ]);

    onProgress?.(90, 'Reading output...');
    const data = await ffmpeg.readFile(outputName);

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
