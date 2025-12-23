import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type OutputFile = {
  name: string;
  blob: Blob;
  url: string; // object URL for the blob
};

function mustGetEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el as T;
}

const loadBtn = mustGetEl<HTMLButtonElement>('loadBtn');
const loadBar = mustGetEl<HTMLDivElement>('loadBar');
const loadStatus = mustGetEl<HTMLParagraphElement>('loadStatus');

const fileInput = mustGetEl<HTMLInputElement>('fileInput');
const fileCount = mustGetEl<HTMLSpanElement>('fileCount');

const convertBtn = mustGetEl<HTMLButtonElement>('convertBtn');
const clearBtn = mustGetEl<HTMLButtonElement>('clearBtn');

const taskBar = mustGetEl<HTMLDivElement>('taskBar');
const taskStatus = mustGetEl<HTMLParagraphElement>('taskStatus');

const results = mustGetEl<HTMLDivElement>('results');
const downloadZipBtn = mustGetEl<HTMLButtonElement>('downloadZipBtn');

// ---------------------------
// File picker (FilePond)
// ---------------------------

let pond: any | null = null;

function initFilePond() {
  const w = window as any;

  if (!w.FilePond) return; // fallback to plain <input> if CDN fails

  if (w.FilePondPluginFileValidateType) {
    w.FilePond.registerPlugin(w.FilePondPluginFileValidateType);
  }

  pond = w.FilePond.create(fileInput, {
    allowMultiple: true,
    allowReorder: true,
    instantUpload: false,
    credits: false,
    // Only validate types if the plugin loaded; otherwise FilePond will ignore it.
    acceptedFileTypes: [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/vnd.wave',
    ],
    labelIdle:
      'Drag & Drop your Suno files or <span class="filepond--label-action">Browse</span>',
  });

  pond.on('updatefiles', () => {
    refreshFileCount();
    syncButtons();
  });
}

function getSelectedFiles(): File[] {
  if (pond) {
    return pond.getFiles().map((item: any) => item.file as File);
  }
  return Array.from(fileInput.files ?? []);
}

function clearSelectedFiles() {
  if (pond) {
    pond.removeFiles();
  } else {
    fileInput.value = '';
  }
  refreshFileCount();
}

function refreshFileCount() {
  const n = getSelectedFiles().length;
  fileCount.textContent = `${n} selected`;
}

// ---------------------------
// FFmpeg setup
// ---------------------------

const ffmpeg = new FFmpeg();
let ffmpegLoaded = false;
let converting = false;
let outputs: OutputFile[] = [];

function setLoadProgress(ratio: number, label?: string) {
  const pct = Math.max(0, Math.min(1, ratio));
  loadBar.style.width = `${Math.round(pct * 100)}%`;
  if (label) loadStatus.textContent = label;
}

function setTaskProgress(ratio: number, label?: string) {
  const pct = Math.max(0, Math.min(1, ratio));
  taskBar.style.width = `${Math.round(pct * 100)}%`;
  if (label) taskStatus.textContent = label;
}

// Progress events from ffmpeg.exec()
ffmpeg.on('progress', ({ progress }) => {
  if (!converting) return;
  setTaskProgress(progress);
});

// Optional: uncomment to see FFmpeg logs in dev tools.
// ffmpeg.on('log', ({ type, message }) => console.debug(`[ffmpeg:${type}] ${message}`));

async function loadFfmpeg() {
  if (ffmpegLoaded) return;

  loadBtn.disabled = true;
  setLoadProgress(0, 'Downloading FFmpeg core…');

  // Note: For Vite, ffmpeg.wasm docs recommend using the ESM build of @ffmpeg/core.
  // We'll fetch from jsDelivr and convert to Blob URLs to avoid CORS problems.
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

  const bytes = {
    core: { total: 0, received: 0 },
    wasm: { total: 0, received: 0 },
  };

  const updateCombined = () => {
    const total = (bytes.core.total || 0) + (bytes.wasm.total || 0);
    const received = (bytes.core.received || 0) + (bytes.wasm.received || 0);
    const ratio = total > 0 ? received / total : 0;
    setLoadProgress(ratio, `Downloading FFmpeg core… ${Math.round(ratio * 100)}%`);
  };

  const coreURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.js`,
    'text/javascript',
    true,
    (e) => {
      bytes.core.total = e.total;
      bytes.core.received = e.received;
      updateCombined();
    },
  );

  const wasmURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.wasm`,
    'application/wasm',
    true,
    (e) => {
      bytes.wasm.total = e.total;
      bytes.wasm.received = e.received;
      updateCombined();
    },
  );

  setLoadProgress(1, 'Initializing FFmpeg…');

  await ffmpeg.load({
    coreURL,
    wasmURL,
  });

  ffmpegLoaded = true;
  setLoadProgress(1, 'Loaded ✓');
  loadBtn.disabled = true;

  syncButtons();
}

// ---------------------------
// Conversion logic
// ---------------------------

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function replaceExtensionWithWav(filename: string): string {
  // Remove last extension (".mp3", ".wav", ".whatever") and replace with ".wav"
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return `${filename}.wav`;
  return `${filename.slice(0, lastDot)}.wav`;
}

function uniqueName(desired: string, used: Map<string, number>): string {
  const current = used.get(desired) ?? 0;
  if (current === 0) {
    used.set(desired, 1);
    return desired;
  }
  // Insert " (n)" before extension
  const dot = desired.lastIndexOf('.');
  const base = dot >= 0 ? desired.slice(0, dot) : desired;
  const ext = dot >= 0 ? desired.slice(dot) : '';
  const next = `${base} (${current + 1})${ext}`;
  used.set(desired, current + 1);
  return next;
}

function revokeAllOutputUrls() {
  for (const o of outputs) {
    URL.revokeObjectURL(o.url);
  }
}

function clearOutputs() {
  revokeAllOutputUrls();
  outputs = [];
  results.innerHTML = '';
  downloadZipBtn.disabled = true;
}

function addResultCard(originalName: string, out: OutputFile) {
  const card = document.createElement('div');
  card.className =
    'flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between';

  const left = document.createElement('div');
  left.className = 'min-w-0';

  const title = document.createElement('div');
  title.className = 'truncate text-sm font-semibold';
  title.textContent = out.name;

  const meta = document.createElement('div');
  meta.className = 'mt-1 truncate text-xs text-zinc-600';
  meta.textContent = `from ${originalName} • WAV 44.1kHz • 16‑bit • stereo • ${formatBytes(out.blob.size)}`;

  left.appendChild(title);
  left.appendChild(meta);

  const right = document.createElement('div');
  right.className = 'flex shrink-0 items-center gap-2';

  const download = document.createElement('a');
  download.className =
    'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90';
  download.href = out.url;
  download.download = out.name;
  download.textContent = 'Download';

  right.appendChild(download);

  card.appendChild(left);
  card.appendChild(right);

  results.appendChild(card);
}

async function convertAll() {
  const files = getSelectedFiles();
  if (!ffmpegLoaded) {
    alert('Please click "Load converter" first.');
    return;
  }
  if (files.length === 0) return;

  converting = true;
  setTaskProgress(0, 'Starting…');
  syncButtons();

  clearOutputs();

  const usedNames = new Map<string, number>();

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Internal filenames inside FFmpeg's virtual filesystem
      const inputExt = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const inName = `input_${i}${inputExt || ''}`;

      const desiredOutName = replaceExtensionWithWav(file.name);
      const outName = uniqueName(desiredOutName, usedNames);

      setTaskProgress(0, `(${i + 1}/${files.length}) Converting: ${file.name}`);

      // Write input file into FFmpeg FS
      await ffmpeg.writeFile(inName, await fetchFile(file));

      // Convert to CD-quality WAV:
      //  -ar 44100        -> resample to 44.1kHz
      //  -ac 2            -> stereo
      //  -c:a pcm_s16le   -> 16-bit PCM
      const exitCode = await ffmpeg.exec(['-i', inName, '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', outName]);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg failed for "${file.name}" (exit code: ${exitCode}).`);
      }

      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      const blob = new Blob([data.buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      const out: OutputFile = { name: outName, blob, url };
      outputs.push(out);
      addResultCard(file.name, out);

      // Clean up to reduce memory usage
      await ffmpeg.deleteFile(inName);
      await ffmpeg.deleteFile(outName);

      // If only one file, show done at 100%.
      setTaskProgress((i + 1) / files.length);
    }

    setTaskProgress(1, `Done ✓ Converted ${outputs.length} file(s).`);
    downloadZipBtn.disabled = outputs.length === 0;
  } catch (err: any) {
    console.error(err);
    setTaskProgress(0, 'Error — see console.');
    alert(err?.message ?? String(err));
  } finally {
    converting = false;
    syncButtons();
  }
}

async function downloadZip() {
  const w = window as any;
  if (!w.JSZip) {
    alert('JSZip failed to load (CDN).');
    return;
  }
  if (outputs.length === 0) return;

  const zip = new w.JSZip();

  for (const o of outputs) {
    zip.file(o.name, o.blob);
  }

  downloadZipBtn.disabled = true;
  setTaskProgress(0, 'Building zip…');

  const zipBlob: Blob = await zip.generateAsync(
    { type: 'blob' },
    (metadata: any) => {
      // metadata.percent is 0-100
      const pct = typeof metadata?.percent === 'number' ? metadata.percent : 0;
      setTaskProgress(pct / 100, `Building zip… ${Math.round(pct)}%`);
    },
  );

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cd-quality-wavs.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setTaskProgress(1, 'Zip downloaded ✓');
  downloadZipBtn.disabled = outputs.length === 0;
  syncButtons();
}

// ---------------------------
// UI wiring
// ---------------------------

function syncButtons() {
  const files = getSelectedFiles();

  convertBtn.disabled = !ffmpegLoaded || files.length === 0 || converting;
  clearBtn.disabled = (files.length === 0 && outputs.length === 0) || converting;

  downloadZipBtn.disabled = outputs.length === 0 || converting;

  // Disable load button after load; keep enabled before load even if converting.
  loadBtn.disabled = ffmpegLoaded || converting;
}

loadBtn.addEventListener('click', () => {
  loadFfmpeg().catch((err) => {
    console.error(err);
    loadBtn.disabled = false;
    setLoadProgress(0, 'Load failed — see console.');
    alert(err?.message ?? String(err));
  });
});

convertBtn.addEventListener('click', () => {
  convertAll().catch((err) => {
    console.error(err);
    alert(err?.message ?? String(err));
  });
});

clearBtn.addEventListener('click', () => {
  setTaskProgress(0, 'No job running.');
  clearSelectedFiles();
  clearOutputs();
  syncButtons();
});

downloadZipBtn.addEventListener('click', () => {
  downloadZip().catch((err) => {
    console.error(err);
    alert(err?.message ?? String(err));
  });
});

// If FilePond isn't available, listen for changes on the native input.
fileInput.addEventListener('change', () => {
  if (pond) return;
  refreshFileCount();
  syncButtons();
});

initFilePond();
refreshFileCount();
syncButtons();
