/**
 * Pi AI Dubbing - Extension Popup Controller
 * Connects directly to background service worker and displays real-time dubbing status,
 * tab target info, latency metrics, and controls.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const elBackendBadge = document.getElementById('connection-badge');
  const elBackendStatusText = document.getElementById('backend-status-text');
  const elValBrowser = document.getElementById('val-browser');
  const elValBackend = document.getElementById('val-backend');
  const elValTarget = document.getElementById('val-target');
  const elValCapture = document.getElementById('val-capture');
  const elValStt = document.getElementById('val-stt');
  const elValTranslation = document.getElementById('val-translation');
  const elValVoice = document.getElementById('val-voice');
  const elValLatency = document.getElementById('val-latency');

  const elSegmentBadge = document.getElementById('segment-badge');
  const elLiveSourceText = document.getElementById('live-source-text');
  const elLiveArabicText = document.getElementById('live-arabic-text');

  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnReconnect = document.getElementById('btn-reconnect');

  const errorBanner = document.getElementById('error-banner');
  const errorBannerText = document.getElementById('error-banner-text');
  const errorBannerClose = document.getElementById('error-banner-close');

  const diagExt = document.getElementById('diag-ext');
  const diagManifest = document.getElementById('diag-manifest');
  const diagSw = document.getElementById('diag-sw');
  const diagPopup = document.getElementById('diag-popup');
  const diagBackend = document.getElementById('diag-backend');
  const diagContent = document.getElementById('diag-content');
  const diagOffscreen = document.getElementById('diag-offscreen');
  const diagCapture = document.getElementById('diag-capture');
  const diagErrors = document.getElementById('diag-errors');
  const diagErrorsBadge = document.getElementById('diag-errors-badge');

  function showError(msg) {
    if (errorBanner && errorBannerText) {
      errorBannerText.textContent = msg;
      errorBanner.style.display = 'flex';
    }
    if (diagErrors) {
      diagErrors.textContent = msg.slice(0, 50);
      diagErrors.className = 'diag-val text-rose';
    }
    if (diagErrorsBadge) {
      diagErrorsBadge.textContent = '1 Error';
      diagErrorsBadge.className = 'badge-err';
    }
  }

  function clearError() {
    if (errorBanner) errorBanner.style.display = 'none';
    if (diagErrors) {
      diagErrors.textContent = '0 (لا توجد أخطاء)';
      diagErrors.className = 'diag-val text-emerald';
    }
    if (diagErrorsBadge) {
      diagErrorsBadge.textContent = '0 Errors';
      diagErrorsBadge.className = 'badge-ok';
    }
  }

  errorBannerClose?.addEventListener('click', clearError);

  if (btnReconnect) {
    btnReconnect.addEventListener('click', () => {
      btnReconnect.textContent = 'Connecting...';
      chrome.runtime.sendMessage({ type: 'RECONNECT_BACKEND' }, () => {
        setTimeout(() => {
          btnReconnect.textContent = '🔄 Reconnect';
          refreshStatus();
          runDiagnostics();
        }, 800);
      });
    });
  }

  const chkMute = document.getElementById('chk-mute');
  const chkSubtitles = document.getElementById('chk-subtitles');

  const elDelayVal = document.getElementById('delay-val');
  const delayButtons = document.querySelectorAll('.btn-delay');

  let currentTabId = null;
  let currentTabUrl = '';
  let currentDelay = 0;

  const connHelperCard = document.getElementById('conn-helper-card');
  const connHelperTitle = document.getElementById('conn-helper-title');
  const connHelperSubtitle = document.getElementById('conn-helper-subtitle');
  const btnQuickPair = document.getElementById('btn-quick-pair');
  const btnOpenSite = document.getElementById('btn-open-site');
  const btnUseCurrentTab = document.getElementById('btn-use-current-tab');
  const btnTestConnection = document.getElementById('btn-test-connection');
  const testResultIndicator = document.getElementById('test-result-indicator');
  const serverUrlBadge = document.getElementById('server-url-badge');

  // 1. Detect current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      currentTabId = tab.id;
      currentTabUrl = tab.url || '';
      const url = currentTabUrl;
      if (url.includes('youtube.com')) {
        elValTarget.textContent = 'YouTube';
        elValTarget.className = 'value text-rose';
      } else if (url.startsWith('http')) {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          elValTarget.textContent = domain.slice(0, 16);
          elValTarget.className = 'value text-sky';
        } catch {
          elValTarget.textContent = 'Other Web';
          elValTarget.className = 'value text-sky';
        }
      } else {
        elValTarget.textContent = 'Internal Tab';
        elValTarget.className = 'value text-slate';
      }
    }
  });

  // 2. Fetch initial status from background
  function refreshStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setBackendStatus(false);
        return;
      }
      applyStatus(res);
    });
  }

  // 3. Listen for status updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'POPUP_STATUS_UPDATE' && message.status) {
      applyStatus(message.status);
    }
  });

  function setBackendStatus(connected, httpUrl) {
    if (connected) {
      elBackendBadge.className = 'badge badge-connected';
      elBackendStatusText.textContent = 'متصل';
      elValBackend.textContent = 'Connected';
      elValBackend.className = 'value text-emerald';

      if (connHelperCard) {
        connHelperCard.className = 'conn-helper-card connected';
      }
      if (connHelperTitle) {
        connHelperTitle.textContent = '✅ متصل بموقع المشروع بنجاح';
      }
      if (connHelperSubtitle) {
        connHelperSubtitle.textContent = `خادم الدبلجة نشط (${httpUrl || 'جاهز للدبلجة'})`;
      }
      if (btnQuickPair) {
        btnQuickPair.style.display = 'none';
      }
      if (serverUrlBadge) {
        serverUrlBadge.textContent = 'Connected';
        serverUrlBadge.style.color = '#34d399';
      }
    } else {
      elBackendBadge.className = 'badge badge-disconnected';
      elBackendStatusText.textContent = 'غير متصل';
      elValBackend.textContent = 'Disconnected';
      elValBackend.className = 'value text-rose';

      if (connHelperCard) {
        connHelperCard.className = 'conn-helper-card disconnected';
      }
      if (connHelperTitle) {
        connHelperTitle.textContent = '⚠️ الإضافة غير متصلة بموقع المشروع';
      }
      if (connHelperSubtitle) {
        connHelperSubtitle.textContent = 'اضغط «ربط تلقائي بالموقع» أو افتح تبويب المشروع للربط الفوري.';
      }
      if (btnQuickPair) {
        btnQuickPair.style.display = 'flex';
      }
      if (serverUrlBadge) {
        serverUrlBadge.textContent = 'Disconnected';
        serverUrlBadge.style.color = '#f87171';
      }
    }
  }

  function applyStatus(s) {
    // Backend connection
    setBackendStatus(s.wsConnected, s.backendHttpUrl);

    // Browser status
    if (s.piStatus === 'ready' || s.state === 'dubbing') {
      elValBrowser.textContent = 'Connected';
      elValBrowser.className = 'value text-emerald';
    } else if (s.piStatus === 'loading') {
      elValBrowser.textContent = 'Loading...';
      elValBrowser.className = 'value text-amber';
    } else {
      elValBrowser.textContent = 'Ready';
      elValBrowser.className = 'value text-emerald';
    }

    // Capture status
    if (s.audioCaptureActive) {
      elValCapture.textContent = 'ON';
      elValCapture.className = 'value text-emerald font-bold';
    } else {
      elValCapture.textContent = 'OFF';
      elValCapture.className = 'value text-slate';
    }

    // STT status
    if (s.sttStatus === 'processing') {
      elValStt.textContent = 'Detecting...';
      elValStt.className = 'value text-amber animate-pulse';
    } else {
      elValStt.textContent = s.sttStatus || 'Idle';
      elValStt.className = 'value text-slate';
    }

    // Translation status
    if (s.translationStatus === 'processing') {
      elValTranslation.textContent = 'Translating...';
      elValTranslation.className = 'value text-amber animate-pulse';
    } else if (s.translationStatus === 'ready') {
      elValTranslation.textContent = 'Active';
      elValTranslation.className = 'value text-emerald';
    } else {
      elValTranslation.textContent = 'Idle';
      elValTranslation.className = 'value text-slate';
    }

    // Pi Voice status
    if (s.voiceStatus === 'fetching') {
      elValVoice.textContent = 'Preparing';
      elValVoice.className = 'value text-amber animate-pulse';
    } else if (s.voiceStatus === 'ready') {
      elValVoice.textContent = 'Ready';
      elValVoice.className = 'value text-emerald';
    } else {
      elValVoice.textContent = 'Idle';
      elValVoice.className = 'value text-slate';
    }

    // Latency
    if (s.latencySec) {
      elValLatency.textContent = `${s.latencySec} sec`;
    }

    // Buttons state
    const isDubbing = s.state === 'dubbing';
    const isPaused = s.state === 'paused';

    btnStart.disabled = isDubbing;
    btnStop.disabled = !isDubbing && !isPaused;
    btnPause.disabled = !isDubbing;
    btnResume.disabled = !isPaused;

    // Live texts
    if (s.currentSegment) {
      elSegmentBadge.textContent = `مقطع #${s.currentSegment}`;
    }
    if (s.lastSourceText) {
      elLiveSourceText.textContent = s.lastSourceText;
    }
    if (s.lastArabicText) {
      elLiveArabicText.textContent = s.lastArabicText;
    }

    // Checkboxes
    if (s.muteOriginal !== undefined) {
      chkMute.checked = Boolean(s.muteOriginal);
    }
    if (s.showSubtitle !== undefined) {
      chkSubtitles.checked = Boolean(s.showSubtitle);
    }

    // Delay
    if (s.audioDelayMs !== undefined) {
      currentDelay = s.audioDelayMs;
      elDelayVal.textContent = `${currentDelay}ms`;
      delayButtons.forEach(btn => {
        const d = Number(btn.getAttribute('data-delay'));
        if (d === currentDelay) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }

  function runDiagnostics() {
    if (diagExt) {
      diagExt.textContent = 'Loaded';
      diagExt.className = 'diag-val text-emerald';
    }
    if (diagManifest) {
      diagManifest.textContent = 'OK (V3)';
      diagManifest.className = 'diag-val text-emerald';
    }
    if (diagPopup) {
      diagPopup.textContent = 'OK';
      diagPopup.className = 'diag-val text-emerald';
    }
    if (diagOffscreen) {
      diagOffscreen.textContent = 'Ready';
      diagOffscreen.className = 'diag-val text-emerald';
    }

    // Ping Service Worker
    chrome.runtime.sendMessage({ type: 'PING' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        if (diagSw) {
          diagSw.textContent = 'Starting...';
          diagSw.className = 'diag-val text-amber';
        }
      } else {
        if (diagSw) {
          diagSw.textContent = 'Running';
          diagSw.className = 'diag-val text-emerald';
        }
      }
    });

    // Check Backend
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (res) {
        if (diagBackend) {
          diagBackend.textContent = res.wsConnected ? 'Connected' : 'Disconnected';
          diagBackend.className = res.wsConnected ? 'diag-val text-emerald' : 'diag-val text-rose';
        }
        if (diagCapture) {
          diagCapture.textContent = res.audioCaptureActive ? 'Active' : 'Ready';
          diagCapture.className = res.audioCaptureActive ? 'diag-val text-emerald font-bold' : 'diag-val text-sky';
        }
      }
    });

    // Ping Content Script
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: 'PING' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          if (diagContent) {
            diagContent.textContent = 'Standby';
            diagContent.className = 'diag-val text-slate';
          }
        } else {
          if (diagContent) {
            diagContent.textContent = res.isYouTube ? 'Loaded (YouTube)' : 'Loaded (Web)';
            diagContent.className = 'diag-val text-emerald';
          }
        }
      });
    }
  }

  // Button actions
  btnStart.addEventListener('click', () => {
    btnStart.disabled = true;
    clearError();
    chrome.runtime.sendMessage({
      type: 'START_DUBBING',
      tabId: currentTabId
    }, (res) => {
      btnStart.disabled = false;
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
      } else if (res && !res.success) {
        showError(res.error || 'فشل بدء الدبلجة');
      }
      refreshStatus();
      runDiagnostics();
    });
  });

  btnStop.addEventListener('click', () => {
    btnStop.disabled = true;
    chrome.runtime.sendMessage({
      type: 'STOP_DUBBING'
    }, (res) => {
      refreshStatus();
    });
  });

  btnPause.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' }, () => {
      refreshStatus();
    });
  });

  btnResume.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' }, () => {
      refreshStatus();
    });
  });

  chkMute.addEventListener('change', (e) => {
    chrome.runtime.sendMessage({
      type: 'SET_MUTE_ORIGINAL',
      muted: e.target.checked
    });
  });

  chkSubtitles.addEventListener('change', (e) => {
    chrome.runtime.sendMessage({
      type: 'SET_SUBTITLE_VISIBILITY',
      visible: e.target.checked
    });
  });

  const inputBackendUrl = document.getElementById('input-backend-url');
  const btnSaveBackendUrl = document.getElementById('btn-save-backend-url');
  const linkDashboard = document.getElementById('link-dashboard');

  // Load configured backend URL
  chrome.runtime.sendMessage({ type: 'GET_BACKEND_URL' }, (res) => {
    if (res && res.backendHttpUrl) {
      if (inputBackendUrl) inputBackendUrl.value = res.backendHttpUrl;
      if (linkDashboard) linkDashboard.href = res.backendHttpUrl;
    }
  });

  if (btnSaveBackendUrl && inputBackendUrl) {
    btnSaveBackendUrl.addEventListener('click', () => {
      const val = inputBackendUrl.value.trim();
      if (!val) return;
      btnSaveBackendUrl.textContent = 'جارٍ الحفظ...';
      chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url: val }, () => {
        btnSaveBackendUrl.textContent = 'تم الحفظ!';
        setTimeout(() => { btnSaveBackendUrl.textContent = 'حفظ وتطبيق'; }, 1500);
        if (linkDashboard) linkDashboard.href = val;
        refreshStatus();
      });
    });
  }

  // 1-Click Quick Auto-Pair
  if (btnQuickPair) {
    btnQuickPair.addEventListener('click', () => {
      btnQuickPair.textContent = 'جارٍ فحص التبويبات...';
      chrome.runtime.sendMessage({ type: 'AUTO_DISCOVER_TABS' }, () => {
        chrome.tabs.query({}, (tabs) => {
          let matchedUrl = null;
          if (tabs) {
            for (const t of tabs) {
              const u = t.url || '';
              if (u.includes('.run.app') || u.includes('localhost:') || (t.title && (t.title.includes('Pi.ai') || t.title.includes('Chromium Controller') || t.title.includes('Dubbing')))) {
                try {
                  matchedUrl = new URL(u).origin;
                  break;
                } catch {}
              }
            }
          }
          if (!matchedUrl && currentTabUrl && currentTabUrl.startsWith('http') && !currentTabUrl.includes('youtube.com')) {
            try { matchedUrl = new URL(currentTabUrl).origin; } catch {}
          }

          if (matchedUrl) {
            if (inputBackendUrl) inputBackendUrl.value = matchedUrl;
            chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url: matchedUrl }, () => {
              btnQuickPair.textContent = '✅ تم الربط بنجاح!';
              setTimeout(() => {
                btnQuickPair.textContent = '⚡ ربط تلقائي بالموقع الحالي';
                refreshStatus();
                runDiagnostics();
              }, 1200);
            });
          } else {
            btnQuickPair.textContent = 'افتح موقع المشروع أولاً';
            setTimeout(() => {
              btnQuickPair.textContent = '⚡ ربط تلقائي بالموقع الحالي';
            }, 2500);
          }
        });
      });
    });
  }

  // Use Current Tab URL Button
  if (btnUseCurrentTab) {
    btnUseCurrentTab.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].url && tabs[0].url.startsWith('http')) {
          try {
            const origin = new URL(tabs[0].url).origin;
            if (inputBackendUrl) inputBackendUrl.value = origin;
            chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url: origin }, () => {
              btnUseCurrentTab.textContent = '✅ تم التطبيق';
              setTimeout(() => { btnUseCurrentTab.textContent = '🎯 استخدام التبويب النشط'; }, 1500);
              refreshStatus();
              runDiagnostics();
            });
          } catch {}
        }
      });
    });
  }

  // Test Connection HTTP Ping Button
  if (btnTestConnection && testResultIndicator) {
    btnTestConnection.addEventListener('click', async () => {
      const url = (inputBackendUrl?.value || '').trim() || 'http://localhost:3000';
      testResultIndicator.style.display = 'block';
      testResultIndicator.className = 'test-result-indicator';
      testResultIndicator.textContent = 'جارٍ فحص استجابة الخادم...';

      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(`${url}/api/state`, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        if (resp.ok) {
          testResultIndicator.className = 'test-result-indicator success';
          testResultIndicator.textContent = `✅ استجابة ناجحة (${latency}ms) - خادم المشروع متصل ونشط!`;
          chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url });
          setTimeout(() => refreshStatus(), 500);
        } else {
          testResultIndicator.className = 'test-result-indicator error';
          testResultIndicator.textContent = `⚠️ الخادم أجاب برمز HTTP ${resp.status}`;
        }
      } catch (err) {
        testResultIndicator.className = 'test-result-indicator error';
        testResultIndicator.textContent = `❌ تعذر الاتصال: تأكد من صحة الرابط وتشغيل الخادم (${err.message || 'Failed'})`;
      }
    });
  }

  // Open Project Site in new tab
  if (btnOpenSite) {
    btnOpenSite.addEventListener('click', () => {
      const url = (inputBackendUrl?.value || '').trim() || 'http://localhost:3000';
      chrome.tabs.create({ url });
    });
  }

  delayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const delay = Number(btn.getAttribute('data-delay'));
      currentDelay = delay;
      elDelayVal.textContent = `${delay}ms`;
      delayButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      chrome.runtime.sendMessage({
        type: 'SET_AUDIO_DELAY',
        delayMs: delay
      });
    });
  });

  // Initial poll and recurring poll every 1.5s
  refreshStatus();
  runDiagnostics();
  setInterval(() => {
    refreshStatus();
    runDiagnostics();
  }, 1500);
});
