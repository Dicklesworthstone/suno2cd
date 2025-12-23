import { loadFFmpeg, convertToCDQuality, isAudioFile, ConversionResult, checkBrowserSupport, resetFilenameTracking, formatBytes } from './converter';

// Declare JSZip on window (loaded from CDN)
declare global {
  interface Window {
    JSZip?: any;
  }
}

// DOM Elements
const dropZone = document.getElementById('dropZone')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileList = document.getElementById('fileList')!;
const fileListItems = document.getElementById('fileListItems')!;
const fileCount = document.getElementById('fileCount')!;
const convertBtnWrapper = document.getElementById('convertBtnWrapper')!;
const convertBtn = document.getElementById('convertBtn')!;
const status = document.getElementById('status')!;
const statusText = document.getElementById('statusText')!;
const statusSubtext = document.getElementById('statusSubtext')!;
const progressPercent = document.getElementById('progressPercent')!;
const progressFill = document.getElementById('progressFill')!;
const results = document.getElementById('results')!;
const resultItems = document.getElementById('resultItems')!;
const toastContainer = document.getElementById('toastContainer')!;

// State
let filesToConvert: File[] = [];
let ffmpegLoaded = false;
let activeBlobUrls: string[] = [];

// Touch state for swipe gestures
interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  element: HTMLElement | null;
  index: number;
  hapticTriggered: boolean;
}
let touchState: TouchState = { startX: 0, startY: 0, currentX: 0, element: null, index: -1, hapticTriggered: false };

// Haptic feedback utility
function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  if (!('vibrate' in navigator)) return;

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 20],
    error: [30, 50, 30, 50, 30],
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch {
    // Vibration not supported or blocked
  }
}

// Check browser support on load
const support = checkBrowserSupport();

// Detect iOS Safari (doesn't support SharedArrayBuffer via service worker)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (!support.supported) {
  // Track reload attempts to prevent infinite loops
  const reloadKey = 'suno2cd_reload_attempts';
  const reloadAttempts = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
  const maxReloads = 2;

  if (isIOS) {
    // iOS Safari doesn't support SharedArrayBuffer via service worker
    dropZone.innerHTML = `
      <div class="text-center py-8">
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">iOS Not Supported</h3>
        <p class="text-sm sm:text-base text-gray-400 max-w-sm mx-auto leading-relaxed">
          iOS Safari doesn't support the required features for in-browser audio conversion.
          Please use a desktop browser (Chrome, Firefox, or Edge).
        </p>
      </div>
    `;
    dropZone.classList.remove('cursor-pointer');
    dropZone.style.pointerEvents = 'none';
  } else if (support.needsReload && reloadAttempts < maxReloads) {
    // Service worker is loading - show loading state and auto-reload (limited attempts)
    sessionStorage.setItem(reloadKey, String(reloadAttempts + 1));
    dropZone.innerHTML = `
      <div class="text-center py-8">
        <div class="spinner mx-auto mb-4" style="width: 48px; height: 48px;"></div>
        <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">Preparing...</h3>
        <p class="text-sm sm:text-base text-gray-400 max-w-sm mx-auto leading-relaxed">${support.message}</p>
      </div>
    `;
    dropZone.classList.remove('cursor-pointer');
    // Let coi-serviceworker handle the reload, but fallback after delay
    setTimeout(() => {
      const recheck = checkBrowserSupport();
      if (!recheck.supported) {
        location.reload();
      }
    }, 3000);
  } else {
    // Max reloads reached or not a reload scenario - show error
    sessionStorage.removeItem(reloadKey);
    dropZone.innerHTML = `
      <div class="text-center py-8">
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 sm:w-8 sm:h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">Browser Not Supported</h3>
        <p class="text-sm sm:text-base text-gray-400 max-w-sm mx-auto leading-relaxed">
          ${support.message || 'This browser does not support the required features. Please use Chrome, Firefox, or Edge on desktop.'}
        </p>
        <button onclick="sessionStorage.clear(); location.reload()" class="mt-4 px-4 py-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">
          Try again
        </button>
      </div>
    `;
    dropZone.classList.remove('cursor-pointer');
    dropZone.style.pointerEvents = 'none';
  }
} else {
  // Supported - clear any reload tracking
  sessionStorage.removeItem('suno2cd_reload_attempts');
}

// Drop zone interactions
dropZone.addEventListener('click', () => {
  haptic('light');
  fileInput.click();
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  if (!dropZone.contains(e.relatedTarget as Node)) {
    dropZone.classList.remove('dragover');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  haptic('medium');
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
    haptic('error');
    showToast('Please select audio files', 'error');
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
    haptic('success');
    showToast(`Added ${added} file${added > 1 ? 's' : ''}`);
  }

  renderFileList();
}

function renderFileList() {
  if (filesToConvert.length === 0) {
    fileList.classList.add('hidden');
    convertBtnWrapper.classList.add('hidden');
    return;
  }

  fileList.classList.remove('hidden');
  convertBtnWrapper.classList.remove('hidden');

  fileCount.textContent = `${filesToConvert.length} file${filesToConvert.length > 1 ? 's' : ''}`;
  fileListItems.innerHTML = '';

  filesToConvert.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item glass rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4';
    item.style.animationDelay = `${index * 50}ms`;
    item.dataset.index = String(index);
    item.innerHTML = `
      <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 sm:w-6 sm:h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm sm:text-base font-medium text-white truncate">${escapeHtml(file.name)}</p>
        <p class="text-xs sm:text-sm text-gray-500 mt-0.5">${formatBytes(file.size)}</p>
      </div>
      <button class="remove-btn w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-red-500/20 active:bg-red-500/30 flex items-center justify-center transition-colors group flex-shrink-0 focus-ring" data-index="${index}" aria-label="Remove file">
        <svg class="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Touch swipe handling
    item.addEventListener('touchstart', handleTouchStart, { passive: true });
    item.addEventListener('touchmove', handleTouchMove, { passive: false });
    item.addEventListener('touchend', handleTouchEnd);

    fileListItems.appendChild(item);
  });

  // Remove button click handlers
  fileListItems.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
      removeFile(index);
    });
  });
}

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  const target = (e.currentTarget as HTMLElement);
  touchState = {
    startX: touch.clientX,
    startY: touch.clientY,
    currentX: touch.clientX,
    element: target,
    index: parseInt(target.dataset.index || '-1', 10),
    hapticTriggered: false,
  };
}

function handleTouchMove(e: TouchEvent) {
  if (!touchState.element) return;

  const touch = e.touches[0];
  const deltaX = touch.clientX - touchState.startX;
  const deltaY = Math.abs(touch.clientY - touchState.startY);

  // If scrolling vertically, don't interfere
  if (deltaY > Math.abs(deltaX) * 0.5) {
    return;
  }

  // Only allow swiping left (to delete)
  if (deltaX < 0) {
    e.preventDefault();
    touchState.currentX = touch.clientX;
    touchState.element.classList.add('swiping');

    const offset = Math.max(deltaX, -100);
    touchState.element.style.transform = `translateX(${offset}px)`;
    touchState.element.style.opacity = String(1 + offset / 200);

    // Only trigger haptic once when threshold is crossed
    if (offset < -60 && !touchState.hapticTriggered) {
      touchState.hapticTriggered = true;
      haptic('light');
    }
  }
}

function handleTouchEnd() {
  if (!touchState.element) return;

  const deltaX = touchState.currentX - touchState.startX;

  touchState.element.classList.remove('swiping');

  if (deltaX < -80) {
    // Swipe threshold reached - delete
    haptic('medium');
    removeFile(touchState.index, touchState.element);
  } else {
    // Reset position
    touchState.element.style.transform = '';
    touchState.element.style.opacity = '';
  }

  touchState = { startX: 0, startY: 0, currentX: 0, element: null, index: -1, hapticTriggered: false };
}

function removeFile(index: number, element?: HTMLElement) {
  haptic('light');

  // Remove from array immediately to avoid race condition with rapid deletes
  // (indices become stale if we wait for animation)
  filesToConvert.splice(index, 1);

  const el = element || fileListItems.querySelector(`[data-index="${index}"]`) as HTMLElement;
  if (el) {
    // Quick fade-out animation
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    el.style.transition = 'all 0.15s ease-out';
    setTimeout(() => renderFileList(), 150);
  } else {
    renderFileList();
  }
}

convertBtn.addEventListener('click', () => {
  haptic('medium');
  startConversion();
});

async function startConversion() {
  if (filesToConvert.length === 0) return;

  // Hide UI elements
  convertBtnWrapper.classList.add('hidden');
  fileList.classList.add('hidden');
  dropZone.classList.add('hidden');
  results.classList.add('hidden');

  // Show status
  status.classList.remove('hidden');
  updateProgress(0, 'Initializing FFmpeg...', 'Loading audio processing engine');

  // Reset filename tracking for this batch
  resetFilenameTracking();

  try {
    if (!ffmpegLoaded) {
      await loadFFmpeg((progress, message) => {
        // Scale FFmpeg download progress to 0-30% of overall progress
        updateProgress(progress * 0.3, message, 'First-time download (~31 MB)');
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
        updateProgress(overallProgress, msg, `File ${i + 1} of ${totalFiles}`);
      };

      const result = await convertToCDQuality(file, fileProgress);
      convertedFiles.push(result);
      haptic('light');
    }

    haptic('success');

    // Show results
    status.classList.add('hidden');
    dropZone.classList.remove('hidden');
    showResults(convertedFiles);
    filesToConvert = [];
    renderFileList();

  } catch (error) {
    console.error('Conversion failed:', error);
    haptic('error');
    updateProgress(0, 'Conversion failed', error instanceof Error ? error.message : 'Unknown error');

    const spinnerEl = status.querySelector('.spinner') as HTMLElement;
    if (spinnerEl) {
      spinnerEl.style.borderTopColor = '#f87171';
      spinnerEl.style.animationPlayState = 'paused';
    }

    setTimeout(() => {
      status.classList.add('hidden');
      dropZone.classList.remove('hidden');
      convertBtnWrapper.classList.remove('hidden');
      fileList.classList.remove('hidden');
      if (spinnerEl) {
        spinnerEl.style.borderTopColor = '';
        spinnerEl.style.animationPlayState = '';
      }
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
  // Revoke any previously created blob URLs
  for (const url of activeBlobUrls) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls = [];

  results.classList.remove('hidden');
  resultItems.innerHTML = '';

  const fileUrls = convertedFiles.map(file => {
    const url = URL.createObjectURL(file.blob);
    activeBlobUrls.push(url);
    return { file, url };
  });

  fileUrls.forEach(({ file, url }, index) => {
    const item = document.createElement('div');
    item.className = 'result-item glass rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4';
    item.style.animationDelay = `${index * 80}ms`;
    item.innerHTML = `
      <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm sm:text-base font-medium text-white truncate">${escapeHtml(file.filename)}</p>
        <p class="text-xs sm:text-sm text-gray-500 mt-0.5">${formatBytes(file.blob.size)} &bull; 44.1kHz &bull; 16-bit</p>
      </div>
      <a href="${url}" download="${escapeHtml(file.filename)}" class="btn-success px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 flex-shrink-0 focus-ring" onclick="this.blur()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        <span class="hidden xs:inline">Download</span>
      </a>
    `;

    // Add haptic on download click
    item.querySelector('a')?.addEventListener('click', () => haptic('medium'));

    resultItems.appendChild(item);
  });

  // Download All as ZIP button (only if multiple files)
  if (fileUrls.length > 1) {
    const downloadZipBtn = document.createElement('button');
    downloadZipBtn.className = 'result-item w-full mt-3 sm:mt-4 btn-success py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 focus-ring';
    downloadZipBtn.style.animationDelay = `${fileUrls.length * 80}ms`;
    downloadZipBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Download All as ZIP (${fileUrls.length} files)
    `;
    downloadZipBtn.addEventListener('click', async () => {
      haptic('medium');

      if (!window.JSZip) {
        showToast('ZIP library not loaded', 'error');
        // Fallback to individual downloads
        fileUrls.forEach(({ file, url }, i) => {
          setTimeout(() => {
            const a = document.createElement('a');
            a.href = url;
            a.download = file.filename;
            a.click();
          }, i * 150);
        });
        return;
      }

      // Disable button while creating ZIP
      downloadZipBtn.disabled = true;
      const originalText = downloadZipBtn.innerHTML;
      downloadZipBtn.innerHTML = `
        <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
        <span>Creating ZIP...</span>
      `;

      try {
        const zip = new window.JSZip();

        for (const { file } of fileUrls) {
          zip.file(file.filename, file.blob);
        }

        // Generate ZIP with progress tracking
        const zipBlob = await zip.generateAsync(
          { type: 'blob' },
          (metadata: { percent: number }) => {
            const pct = Math.round(metadata.percent);
            downloadZipBtn.innerHTML = `
              <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
              <span>Creating ZIP... ${pct}%</span>
            `;
          }
        );
        const zipUrl = URL.createObjectURL(zipBlob);

        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = 'cd-quality-wavs.zip';
        a.click();

        URL.revokeObjectURL(zipUrl);
        haptic('success');
        showToast('ZIP downloaded!');
      } catch (err) {
        console.error('ZIP creation failed:', err);
        showToast('ZIP creation failed', 'error');
      } finally {
        downloadZipBtn.disabled = false;
        downloadZipBtn.innerHTML = originalText;
      }
    });
    resultItems.appendChild(downloadZipBtn);
  }

  // Convert More button
  const convertMoreBtn = document.createElement('button');
  convertMoreBtn.className = 'result-item w-full mt-2 sm:mt-3 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base text-gray-400 hover:text-white border border-white/10 hover:border-white/20 active:bg-white/5 transition-all flex items-center justify-center gap-2 focus-ring';
  convertMoreBtn.style.animationDelay = `${(fileUrls.length + 1) * 80}ms`;
  convertMoreBtn.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
    </svg>
    Convert More Files
  `;
  convertMoreBtn.addEventListener('click', () => {
    haptic('light');
    results.classList.add('hidden');
    fileInput.click();
  });
  resultItems.appendChild(convertMoreBtn);
}

// Toast notification
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast glass-elevated rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 font-medium text-sm sm:text-base flex items-center gap-2.5 pointer-events-auto ${
    type === 'success' ? 'text-emerald-300' : 'text-red-300'
  }`;

  const iconColor = type === 'success' ? 'text-emerald-400' : 'text-red-400';
  const icon = type === 'success'
    ? `<svg class="w-4 h-4 sm:w-5 sm:h-5 ${iconColor} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
    : `<svg class="w-4 h-4 sm:w-5 sm:h-5 ${iconColor} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  // Auto dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Use formatBytes from converter.ts (imported at top)
