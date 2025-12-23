import { loadFFmpeg, convertToCDQuality, isAudioFile, ConversionResult, checkBrowserSupport } from './converter';

// DOM Elements
const dropZone = document.getElementById('dropZone')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileList = document.getElementById('fileList')!;
const fileListItems = document.getElementById('fileListItems')!;
const fileCount = document.getElementById('fileCount')!;
const convertBtn = document.getElementById('convertBtn')!;
const status = document.getElementById('status')!;
const statusText = document.getElementById('statusText')!;
const statusSubtext = document.getElementById('statusSubtext')!;
const progressPercent = document.getElementById('progressPercent')!;
const progressFill = document.getElementById('progressFill')!;
const results = document.getElementById('results')!;
const resultItems = document.getElementById('resultItems')!;

// State
let filesToConvert: File[] = [];
let ffmpegLoaded = false;
let activeBlobUrls: string[] = [];

// Check browser support on load
const support = checkBrowserSupport();
if (!support.supported) {
  dropZone.innerHTML = `
    <div class="text-center py-8">
      <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-white mb-2">Browser Not Supported</h3>
      <p class="text-gray-400 max-w-sm mx-auto">${support.message}</p>
    </div>
  `;
  dropZone.classList.remove('cursor-pointer');
  dropZone.style.pointerEvents = 'none';
}

// Drag and drop handling
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = Array.from(e.dataTransfer?.files || []);
  addFiles(files);
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files || []);
  addFiles(files);
  fileInput.value = '';
});

function addFiles(files: File[]) {
  const audioFiles = files.filter(isAudioFile);

  if (audioFiles.length === 0 && files.length > 0) {
    showToast('Please select audio files (MP3, WAV, FLAC, OGG, M4A)', 'error');
    return;
  }

  let added = 0;
  for (const file of audioFiles) {
    if (!filesToConvert.some(f => f.name === file.name && f.size === file.size)) {
      filesToConvert.push(file);
      added++;
    }
  }

  if (added > 0) {
    showToast(`Added ${added} file${added > 1 ? 's' : ''}`, 'success');
  }

  renderFileList();
}

function renderFileList() {
  if (filesToConvert.length === 0) {
    fileList.classList.add('hidden');
    convertBtn.classList.add('hidden');
    return;
  }

  fileList.classList.remove('hidden');
  convertBtn.classList.remove('hidden');

  fileCount.textContent = `${filesToConvert.length} file${filesToConvert.length > 1 ? 's' : ''}`;
  fileListItems.innerHTML = '';

  filesToConvert.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item glass rounded-xl px-4 py-3 flex items-center justify-between gap-4';
    item.style.animationDelay = `${index * 50}ms`;
    item.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-white truncate">${escapeHtml(file.name)}</p>
          <p class="text-xs text-gray-500">${formatSize(file.size)}</p>
        </div>
      </div>
      <button class="remove-btn w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors group" data-index="${index}">
        <svg class="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    fileListItems.appendChild(item);
  });

  fileListItems.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
      filesToConvert.splice(index, 1);
      renderFileList();
    });
  });
}

convertBtn.addEventListener('click', startConversion);

async function startConversion() {
  if (filesToConvert.length === 0) return;

  // Hide UI elements
  convertBtn.classList.add('hidden');
  fileList.classList.add('hidden');
  dropZone.classList.add('hidden');
  results.classList.add('hidden');

  // Show status
  status.classList.remove('hidden');
  updateProgress(0, 'Initializing FFmpeg...', 'Loading audio processing engine');

  try {
    if (!ffmpegLoaded) {
      await loadFFmpeg((progress, message) => {
        updateProgress(progress * 0.3, message, 'Downloading FFmpeg core (~30MB)');
      });
      ffmpegLoaded = true;
    }

    const convertedFiles: ConversionResult[] = [];
    const totalFiles = filesToConvert.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesToConvert[i];
      const baseProgress = 30 + (i / totalFiles) * 70;

      const fileProgress = (pct: number, msg: string) => {
        const overallProgress = baseProgress + (pct / 100) * (70 / totalFiles);
        updateProgress(
          overallProgress,
          msg,
          `Processing file ${i + 1} of ${totalFiles}`
        );
      };

      const result = await convertToCDQuality(file, fileProgress);
      convertedFiles.push(result);
    }

    // Show results
    status.classList.add('hidden');
    dropZone.classList.remove('hidden');
    showResults(convertedFiles);
    filesToConvert = [];
    renderFileList();

  } catch (error) {
    console.error('Conversion failed:', error);
    updateProgress(
      0,
      'Conversion failed',
      error instanceof Error ? error.message : 'An unknown error occurred'
    );

    // Show error state
    const spinnerEl = status.querySelector('.spinner');
    const pulseRing = status.querySelector('.pulse-ring');
    if (spinnerEl) spinnerEl.classList.add('hidden');
    if (pulseRing) pulseRing.classList.add('hidden');

    setTimeout(() => {
      status.classList.add('hidden');
      dropZone.classList.remove('hidden');
      convertBtn.classList.remove('hidden');
      fileList.classList.remove('hidden');
      // Reset spinner visibility
      if (spinnerEl) spinnerEl.classList.remove('hidden');
      if (pulseRing) pulseRing.classList.remove('hidden');
    }, 4000);
  }
}

function updateProgress(percent: number, text: string, subtext: string) {
  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${Math.round(percent)}%`;
  statusText.textContent = text;
  statusSubtext.textContent = subtext;
}

function showResults(convertedFiles: ConversionResult[]) {
  // Revoke any previously created blob URLs to free memory
  for (const url of activeBlobUrls) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls = [];

  results.classList.remove('hidden');
  resultItems.innerHTML = '';

  // Create blob URLs once and store them
  const fileUrls = convertedFiles.map(file => {
    const url = URL.createObjectURL(file.blob);
    activeBlobUrls.push(url);
    return { file, url };
  });

  fileUrls.forEach(({ file, url }, index) => {
    const item = document.createElement('div');
    item.className = 'result-item glass rounded-xl px-4 py-3 flex items-center justify-between gap-4';
    item.style.animationDelay = `${index * 100}ms`;
    item.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-white truncate">${escapeHtml(file.filename)}</p>
          <p class="text-xs text-gray-500">${formatSize(file.blob.size)} &bull; 44.1kHz &bull; 16-bit</p>
        </div>
      </div>
      <a href="${url}" download="${escapeHtml(file.filename)}" class="btn-success px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Download
      </a>
    `;
    resultItems.appendChild(item);
  });

  if (fileUrls.length > 1) {
    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'result-item w-full mt-4 btn-success py-3 rounded-xl font-semibold flex items-center justify-center gap-2';
    downloadAllBtn.style.animationDelay = `${fileUrls.length * 100}ms`;
    downloadAllBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Download All (${fileUrls.length} files)
    `;
    downloadAllBtn.addEventListener('click', () => {
      fileUrls.forEach(({ file, url }, i) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = url;
          a.download = file.filename;
          a.click();
        }, i * 200); // Stagger downloads
      });
    });
    resultItems.appendChild(downloadAllBtn);
  }

  // Add "Convert More" button
  const convertMoreBtn = document.createElement('button');
  convertMoreBtn.className = 'result-item w-full mt-2 py-3 rounded-xl font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors flex items-center justify-center gap-2';
  convertMoreBtn.style.animationDelay = `${(fileUrls.length + 1) * 100}ms`;
  convertMoreBtn.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
    </svg>
    Convert More Files
  `;
  convertMoreBtn.addEventListener('click', () => {
    results.classList.add('hidden');
    fileInput.click();
  });
  resultItems.appendChild(convertMoreBtn);
}

// Toast notification
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl font-medium text-sm z-50 flex items-center gap-2 ${
    type === 'success'
      ? 'bg-green-500/90 text-white'
      : 'bg-red-500/90 text-white'
  }`;
  toast.style.animation = 'slideIn 0.3s ease-out';

  const icon = type === 'success'
    ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
    : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 20px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
