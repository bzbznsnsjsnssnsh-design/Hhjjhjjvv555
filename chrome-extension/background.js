/**
 * Pi AI Dubbing - Background Service Worker (Manifest V3)
 * Orchestrates tab audio capture via Offscreen API, maintains persistent WebSocket connection
 * to the Pi.ai backend, and synchronizes dubbed audio playback & subtitles.
 */

let backendWs = null;
let wsConnected = false;
let activeSession = {
  sessionId: null,
  targetTabId: null,
  targetTabUrl: '',
  targetTabTitle: '',
  state: 'idle', // 'idle' | 'capturing' | 'dubbing' | 'paused'
  audioCaptureActive: false,
  muteOriginal: false,
  showSubtitle: true,
  audioDelayMs: 0,
  currentSegment: 0,
  queueCount: 0,
  latencySec: 1.8,
  lastSourceText: '',
  lastArabicText: '',
  piStatus: 'ready',
  sttStatus: 'idle',
  translationStatus: 'idle',
  voiceStatus: 'idle'
};

let BACKEND_WS_URL = 'ws://localhost:3000/ws/dubbing';
let BACKEND_HTTP_URL = 'http://localhost:3000';
let failedConnectCount = 0;

// Check storage for user-configured backend URL or auto-discover from open tabs
if (chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['customBackendUrl', 'lastActiveBackendUrl'], (res) => {
    if (res && res.customBackendUrl) {
      setBackendUrls(res.customBackendUrl);
    } else if (res && res.lastActiveBackendUrl) {
      setBackendUrls(res.lastActiveBackendUrl);
    } else {
      autoDiscoverProjectTab();
    }
  });
} else {
  autoDiscoverProjectTab();
}

function autoDiscoverProjectTab() {
  if (!chrome.tabs || !chrome.tabs.query) return;
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    for (const tab of tabs) {
      const url = tab.url || '';
      if (!url.startsWith('http://') && !url.startsWith('https://')) continue;

      const isCandidate =
        url.includes('.run.app') ||
        url.includes('localhost:') ||
        url.includes('127.0.0.1:') ||
        (tab.title && (tab.title.includes('Pi.ai') || tab.title.includes('Pi AI') || tab.title.includes('Chromium Controller') || tab.title.includes('Dubbing')));

      if (isCandidate) {
        try {
          const parsed = new URL(url);
          console.log('Pi AI Dubbing: Auto-discovered project tab URL:', parsed.origin);
          setBackendUrls(parsed.origin);
          return;
        } catch {}
      }
    }
  });
}

function setBackendUrls(baseUrl) {
  try {
    let cleanUrl = (baseUrl || '').trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const parsed = new URL(cleanUrl);
    const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    BACKEND_WS_URL = `${wsProto}//${parsed.host}/ws/dubbing`;
    BACKEND_HTTP_URL = `${parsed.protocol}//${parsed.host}`;

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        customBackendUrl: cleanUrl,
        lastActiveBackendUrl: cleanUrl
      });
    }

    if (backendWs) {
      try {
        backendWs.onclose = null;
        backendWs.onerror = null;
        backendWs.close();
      } catch {}
      backendWs = null;
    }
    failedConnectCount = 0;
    initWebSocket();
    broadcastStatusToPopup();
  } catch (e) {
    console.warn('Invalid custom backend URL:', baseUrl);
  }
}

// Initialize
initWebSocket();

function initWebSocket() {
  if (backendWs && (backendWs.readyState === WebSocket.OPEN || backendWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    backendWs = new WebSocket(BACKEND_WS_URL);

    backendWs.onopen = () => {
      wsConnected = true;
      failedConnectCount = 0;
      console.log('Pi AI Dubbing: Connected to backend WebSocket at', BACKEND_WS_URL);
      broadcastStatusToPopup();
    };

    backendWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleBackendMessage(msg);
      } catch (e) {
        console.warn('Failed to parse backend message:', e);
      }
    };

    backendWs.onclose = () => {
      wsConnected = false;
      failedConnectCount++;
      console.log(`Pi AI Dubbing: Backend WebSocket disconnected (${failedConnectCount}). Reconnecting in 3s...`);
      broadcastStatusToPopup();
      // If disconnected multiple times on localhost, try discovering open project tabs
      if (failedConnectCount >= 2 && (BACKEND_HTTP_URL.includes('localhost') || BACKEND_HTTP_URL.includes('127.0.0.1'))) {
        autoDiscoverProjectTab();
      }
      setTimeout(initWebSocket, 3000);
    };

    backendWs.onerror = (err) => {
      console.warn('Backend WebSocket notice:', err);
    };
  } catch (err) {
    console.warn('WebSocket init notice:', err);
    failedConnectCount++;
    setTimeout(initWebSocket, 3000);
  }
}

function handleBackendMessage(msg) {
  switch (msg.type) {
    case 'DUBBING_SEGMENT_READY': {
      // Received genuine Pi.ai Arabic translation and voice file!
      const { segmentId, sourceText, translatedText, audioUrl, durationSeconds, latencySec } = msg;

      activeSession.currentSegment++;
      activeSession.lastSourceText = sourceText;
      activeSession.lastArabicText = translatedText;
      activeSession.translationStatus = 'ready';
      activeSession.voiceStatus = 'ready';
      if (latencySec) activeSession.latencySec = latencySec;

      // Construct absolute audio URL
      const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${BACKEND_HTTP_URL}${audioUrl}`;

      // Forward to content script on the target tab
      if (activeSession.targetTabId) {
        chrome.tabs.sendMessage(activeSession.targetTabId, {
          type: 'PLAY_DUBBED_AUDIO',
          payload: {
            segmentId,
            sourceText,
            arabicText: translatedText,
            audioUrl: fullAudioUrl,
            duration: durationSeconds
          }
        }).catch(() => {});
      }

      broadcastStatusToPopup();
      break;
    }

    case 'STATUS_UPDATE':
      if (msg.piStatus) activeSession.piStatus = msg.piStatus;
      if (msg.queueCount !== undefined) activeSession.queueCount = msg.queueCount;
      broadcastStatusToPopup();
      break;

    case 'ERROR':
      console.error('Backend dubbing error:', msg.error);
      break;
  }
}

// Runtime messages from Popup and Offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({
        ...activeSession,
        wsConnected,
        backendHttpUrl: BACKEND_HTTP_URL,
        backendWsUrl: BACKEND_WS_URL
      });
      return true;

    case 'AUTO_DETECT_PROJECT_URL':
      if (message.url) {
        setBackendUrls(message.url);
      }
      sendResponse({
        success: true,
        backendHttpUrl: BACKEND_HTTP_URL,
        backendWsUrl: BACKEND_WS_URL,
        wsConnected
      });
      return true;

    case 'AUTO_DISCOVER_TABS':
      autoDiscoverProjectTab();
      sendResponse({
        success: true,
        backendHttpUrl: BACKEND_HTTP_URL,
        backendWsUrl: BACKEND_WS_URL,
        wsConnected
      });
      return true;

    case 'PING':
      sendResponse({
        pong: true,
        serviceWorker: 'running',
        wsConnected,
        activeSessionState: activeSession.state,
        backendWsUrl: BACKEND_WS_URL,
        backendHttpUrl: BACKEND_HTTP_URL
      });
      return true;

    case 'RECONNECT_BACKEND':
      if (backendWs) {
        try { backendWs.close(); } catch {}
        backendWs = null;
      }
      initWebSocket();
      sendResponse({ initiated: true, wsConnected });
      return true;

    case 'START_DUBBING':
      startDubbing(message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'STOP_DUBBING':
      stopDubbing()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'TOGGLE_PAUSE':
      togglePause();
      sendResponse({ success: true, state: activeSession.state });
      return true;

    case 'SET_MUTE_ORIGINAL':
      activeSession.muteOriginal = message.muted;
      // Send to offscreen and content script
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'SET_MUTE_ORIGINAL',
        muteOriginal: message.muted
      }).catch(() => {});

      if (activeSession.targetTabId) {
        chrome.tabs.sendMessage(activeSession.targetTabId, {
          type: 'SET_MUTE_ORIGINAL',
          muted: message.muted
        }).catch(() => {});
      }
      sendResponse({ success: true, muted: message.muted });
      return true;

    case 'SET_SUBTITLE_VISIBILITY':
      activeSession.showSubtitle = message.visible;
      if (activeSession.targetTabId) {
        chrome.tabs.sendMessage(activeSession.targetTabId, {
          type: 'SET_SUBTITLE_VISIBILITY',
          visible: message.visible
        }).catch(() => {});
      }
      sendResponse({ success: true, visible: message.visible });
      return true;

    case 'SET_AUDIO_DELAY':
      activeSession.audioDelayMs = message.delayMs;
      if (activeSession.targetTabId) {
        chrome.tabs.sendMessage(activeSession.targetTabId, {
          type: 'SET_AUDIO_DELAY',
          delayMs: message.delayMs
        }).catch(() => {});
      }
      sendResponse({ success: true, delayMs: message.delayMs });
      return true;

    case 'SET_BACKEND_URL':
      if (message.url) {
        setBackendUrls(message.url);
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ customBackendUrl: message.url });
        }
      }
      sendResponse({ success: true, backendHttpUrl: BACKEND_HTTP_URL, backendWsUrl: BACKEND_WS_URL });
      return true;

    case 'GET_BACKEND_URL':
      sendResponse({ backendHttpUrl: BACKEND_HTTP_URL, backendWsUrl: BACKEND_WS_URL });
      return true;

    case 'AUDIO_CHUNK_CAPTURED':
      handleAudioChunk(message);
      sendResponse({ received: true });
      return true;

    case 'STT_SEGMENT_DETECTED':
      handleSpeechSegment(message);
      sendResponse({ received: true });
      return true;

    case 'CAPTURE_STATUS_CHANGED':
      activeSession.audioCaptureActive = message.active;
      broadcastStatusToPopup();
      sendResponse({ acknowledged: true });
      return true;
  }
});

async function startDubbing(tabId) {
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) throw new Error('No active tab found');
    tabId = tabs[0].id;
  }

  const tab = await chrome.tabs.get(tabId);
  const tabUrl = tab.url || '';

  if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
    throw new Error('لا يمكن التقاط صوت صفحات النظام أو الإضافات. افتح تبويب يحتوي على فيديو (مثل YouTube) ثم اضغط بدء الدبلجة.');
  }

  activeSession.targetTabId = tabId;
  activeSession.targetTabUrl = tabUrl;
  activeSession.targetTabTitle = tab.title || '';
  activeSession.sessionId = `dub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  activeSession.state = 'dubbing';
  activeSession.currentSegment = 0;

  // Ensure Offscreen document exists
  await ensureOffscreenDocument();

  // Obtain streamId from chrome.tabCapture
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId
  });

  // Start recording in offscreen
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'START_RECORDING',
    streamId,
    muteOriginal: activeSession.muteOriginal,
    chunkIntervalMs: 1200
  });

  // Notify backend
  sendToBackend({
    type: 'START_DUBBING_SESSION',
    sessionId: activeSession.sessionId,
    tabId,
    tabUrl: activeSession.targetTabUrl,
    tabTitle: activeSession.targetTabTitle
  });

  broadcastStatusToPopup();
}

async function stopDubbing() {
  activeSession.state = 'idle';
  activeSession.audioCaptureActive = false;

  // Stop recording in offscreen
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'STOP_RECORDING'
  }).catch(() => {});

  // Notify backend
  sendToBackend({
    type: 'STOP_DUBBING_SESSION',
    sessionId: activeSession.sessionId
  });

  broadcastStatusToPopup();
}

function togglePause() {
  if (activeSession.state === 'dubbing') {
    activeSession.state = 'paused';
  } else if (activeSession.state === 'paused') {
    activeSession.state = 'dubbing';
  }
  broadcastStatusToPopup();
}

function handleAudioChunk(msg) {
  if (activeSession.state !== 'dubbing') return;

  activeSession.sttStatus = 'processing';
  broadcastStatusToPopup();

  sendToBackend({
    type: 'AUDIO_CHUNK',
    sessionId: activeSession.sessionId,
    segmentId: msg.segmentId,
    dataUrl: msg.dataUrl,
    mimeType: msg.mimeType,
    duration: msg.duration,
    timestamp: msg.timestamp
  });
}

function handleSpeechSegment(msg) {
  if (activeSession.state !== 'dubbing') return;

  activeSession.lastSourceText = msg.sourceText;
  activeSession.translationStatus = 'processing';
  activeSession.voiceStatus = 'fetching';
  broadcastStatusToPopup();

  sendToBackend({
    type: 'TRANSLATE_AND_DUB_SPEECH',
    sessionId: activeSession.sessionId,
    segmentId: msg.segmentId,
    sourceText: msg.sourceText,
    timestamp: msg.timestamp
  });
}

function sendToBackend(payload) {
  if (backendWs && backendWs.readyState === WebSocket.OPEN) {
    backendWs.send(JSON.stringify(payload));
  } else {
    // If WS disconnected, queue or retry connect
    initWebSocket();
  }
}

async function ensureOffscreenDocument() {
  if (chrome.offscreen && typeof chrome.offscreen.hasDocument === 'function') {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  } else if (chrome.runtime && typeof chrome.runtime.getContexts === 'function') {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      if (existingContexts && existingContexts.length > 0) return;
    } catch (e) {
      // Fall through to create
    }
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Capturing tab audio for real-time video dubbing pipeline'
    });
  } catch (err) {
    if (err && err.message && (err.message.includes('Only a single offscreen') || err.message.includes('already exists'))) {
      return;
    }
    console.warn('Offscreen document creation notice:', err);
  }
}

function broadcastStatusToPopup() {
  chrome.runtime.sendMessage({
    type: 'POPUP_STATUS_UPDATE',
    status: {
      ...activeSession,
      wsConnected,
      backendHttpUrl: BACKEND_HTTP_URL,
      backendWsUrl: BACKEND_WS_URL
    }
  }).catch(() => {});
}
