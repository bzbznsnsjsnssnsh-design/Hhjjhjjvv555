/**
 * Pi AI Dubbing - Content Script
 * Injected into target tab (YouTube, etc.). Manages real-time Arabic subtitle overlay,
 * dubbed audio playback from genuine Pi.ai voice, and original video synchronization.
 */

let overlayElement = null;
let dubbedAudioPlayer = null;
let subtitleVisible = true;
let fontSize = 19;
let audioDelayMs = 0;
let isOriginalMuted = false;

// Audio Queue for playback
const audioQueue = [];
let isPlayingQueue = false;

// Initialize
initOverlay();
setupVideoSync();
detectAndBridgeProjectSite();

// Bridge and detect Pi AI Dubbing project dashboard
function detectAndBridgeProjectSite() {
  const check = () => {
    const isProjectSite =
      document.querySelector('meta[name="pi-ai-dubbing-app"]') !== null ||
      document.querySelector('meta[name="application-name"][content="Pi AI Dubbing Studio"]') !== null ||
      document.title.includes('Pi.ai Chromium Real Controller') ||
      document.title.includes('Pi AI Dubbing');

    if (isProjectSite) {
      const origin = window.location.origin;
      try {
        chrome.runtime.sendMessage({
          type: 'AUTO_DETECT_PROJECT_URL',
          url: origin
        });
      } catch {}

      window.postMessage({
        type: 'PI_DUBBING_EXTENSION_CONNECTED',
        version: '1.0.0',
        origin: origin
      }, '*');
    }
  };

  check();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  }
  // Check again slightly later after React hydrates
  setTimeout(check, 1000);
}

// Listen for messages from web application
window.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'PI_DUBBING_WEB_PING' || event.data.type === 'PI_DUBBING_SYNC_URL') {
    const targetUrl = event.data.url || window.location.origin;
    try {
      chrome.runtime.sendMessage({
        type: 'AUTO_DETECT_PROJECT_URL',
        url: targetUrl
      }, (res) => {
        window.postMessage({
          type: 'PI_DUBBING_EXTENSION_PONG',
          connected: true,
          version: '1.0.0',
          url: targetUrl,
          response: res
        }, '*');
      });
    } catch (e) {
      console.warn('Pi Dubbing Content Script communication note:', e);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PLAY_DUBBED_AUDIO':
      handlePlayDubbedAudio(message.payload);
      sendResponse({ received: true });
      break;

    case 'UPDATE_SUBTITLE':
      updateSubtitle(message.arabicText, message.sourceText);
      sendResponse({ received: true });
      break;

    case 'SET_SUBTITLE_VISIBILITY':
      subtitleVisible = message.visible;
      if (overlayElement) {
        overlayElement.style.display = subtitleVisible ? 'block' : 'none';
      }
      sendResponse({ success: true, visible: subtitleVisible });
      break;

    case 'SET_AUDIO_DELAY':
      audioDelayMs = Number(message.delayMs || 0);
      sendResponse({ success: true, delayMs: audioDelayMs });
      break;

    case 'SET_MUTE_ORIGINAL':
      isOriginalMuted = Boolean(message.muted);
      applyVideoMuting(isOriginalMuted);
      sendResponse({ success: true, muted: isOriginalMuted });
      break;

    case 'PING':
      sendResponse({ pong: true, isYouTube: window.location.hostname.includes('youtube.com') });
      break;
  }
  return true;
});

function initOverlay() {
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', initOverlay, { once: true });
    return;
  }
  if (document.getElementById('pi-ai-dubbing-overlay')) return;

  overlayElement = document.createElement('div');
  overlayElement.id = 'pi-ai-dubbing-overlay';
  overlayElement.innerHTML = `
    <div class="pi-dub-card">
      <div class="pi-dub-header">
        <div class="pi-dub-badge">
          <span class="pi-dub-dot"></span>
          <span>Pi AI Dubbing • دبلجة فورية</span>
        </div>
        <div class="pi-dub-controls-mini">
          <button id="pi-dub-btn-size-down" class="pi-dub-btn-icon" title="تصغير الخط">A-</button>
          <button id="pi-dub-btn-size-up" class="pi-dub-btn-icon" title="تكبير الخط">A+</button>
          <button id="pi-dub-btn-close" class="pi-dub-btn-icon" title="إخفاء">✕</button>
        </div>
      </div>
      <div id="pi-dub-text-arabic" class="pi-dub-arabic-text" dir="auto">
        جاهز للدبلجة الفورية...
      </div>
      <div id="pi-dub-text-source" class="pi-dub-source-text">
        Ready for live video audio capture
      </div>
    </div>
  `;

  document.body.appendChild(overlayElement);

  // Button listeners
  document.getElementById('pi-dub-btn-close')?.addEventListener('click', () => {
    if (overlayElement) overlayElement.style.display = 'none';
    subtitleVisible = false;
  });

  document.getElementById('pi-dub-btn-size-up')?.addEventListener('click', () => {
    fontSize = Math.min(32, fontSize + 2);
    const textEl = document.getElementById('pi-dub-text-arabic');
    if (textEl) textEl.style.fontSize = `${fontSize}px`;
  });

  document.getElementById('pi-dub-btn-size-down')?.addEventListener('click', () => {
    fontSize = Math.max(14, fontSize - 2);
    const textEl = document.getElementById('pi-dub-text-arabic');
    if (textEl) textEl.style.fontSize = `${fontSize}px`;
  });
}

function updateSubtitle(arabicText, sourceText) {
  if (!overlayElement) initOverlay();
  if (overlayElement && subtitleVisible) {
    overlayElement.style.display = 'block';
  }

  const arEl = document.getElementById('pi-dub-text-arabic');
  const srcEl = document.getElementById('pi-dub-text-source');

  if (arEl && arabicText) {
    // Apply clean Unicode normalized text
    arEl.textContent = arabicText.normalize('NFC');
  }

  if (srcEl && sourceText) {
    srcEl.textContent = sourceText;
  }
}

function handlePlayDubbedAudio(payload) {
  const { audioUrl, arabicText, sourceText, duration } = payload;

  if (arabicText) {
    updateSubtitle(arabicText, sourceText);
  }

  if (!audioUrl) return;

  // Add to playback queue
  audioQueue.push({
    audioUrl,
    duration,
    arabicText
  });

  processAudioQueue();
}

async function processAudioQueue() {
  if (isPlayingQueue || audioQueue.length === 0) return;

  isPlayingQueue = true;
  const currentItem = audioQueue.shift();

  try {
    if (audioDelayMs > 0) {
      await new Promise(r => setTimeout(r, audioDelayMs));
    }

    if (!dubbedAudioPlayer) {
      dubbedAudioPlayer = new Audio();
    }

    dubbedAudioPlayer.src = currentItem.audioUrl;
    dubbedAudioPlayer.volume = 1.0;

    await new Promise((resolve) => {
      dubbedAudioPlayer.onended = () => resolve();
      dubbedAudioPlayer.onerror = (err) => {
        console.warn('Dubbed audio player error:', err);
        resolve();
      };

      dubbedAudioPlayer.play().catch(e => {
        console.warn('Audio play notice (user interaction may be needed):', e);
        resolve();
      });
    });

  } catch (err) {
    console.error('Audio queue processing error:', err);
  } finally {
    isPlayingQueue = false;
    if (audioQueue.length > 0) {
      processAudioQueue();
    }
  }
}

function applyVideoMuting(mute) {
  const mediaElements = document.querySelectorAll('video, audio');
  mediaElements.forEach(el => {
    // Do not mute our dubbed audio player!
    if (el !== dubbedAudioPlayer) {
      el.muted = mute;
    }
  });
}

function setupVideoSync() {
  const target = document.body || document.documentElement;
  if (!target) {
    window.addEventListener('DOMContentLoaded', setupVideoSync, { once: true });
    return;
  }

  // Observe DOM for newly added video elements (e.g. YouTube dynamic player)
  const observer = new MutationObserver(() => {
    if (isOriginalMuted) {
      applyVideoMuting(true);
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true
  });
}
