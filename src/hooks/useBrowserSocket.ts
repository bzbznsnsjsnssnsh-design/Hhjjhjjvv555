import { useState, useEffect, useRef, useCallback } from 'react';
import { AppControllerState, ClientAction } from '../types';
import { freezeDetector, FreezeMonitorMetrics } from '../utils/freezeDetector';

type FrameListener = (frame: string) => void;
type StateListener = (state: AppControllerState) => void;

const frameListeners = new Set<FrameListener>();
const stateListeners = new Set<StateListener>();

export const subscribeScreencastFrame = (listener: FrameListener) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};

const defaultDiagnostics = {
  browserLaunched: false,
  chromiumVisibleStreamed: false,
  piAiOpened: false,
  pageLoaded: false,
  loginRequired: false,
  captchaDetected: false,
  inputFound: false,
  manualClickWorking: false,
  manualScrollWorking: false,
  keyboardWorking: false,
  textInserted: false,
  inputEventTriggered: false,
  sendButtonFound: false,
  sendTriggered: false,
  waitingForResponse: false,
  responseDetected: false,
  responseStabilized: false,
  responseExtracted: false,
  lastError: null,
  logs: [],
  browserViewport: { width: 1280, height: 800, devicePixelRatio: 1 },
  screencastDimensions: { width: 1280, height: 800 },
  startupTimings: {
    appStartMs: 0,
    reactMountedMs: null,
    uiVisibleMs: null,
    browserLaunchMs: null,
    cdpConnectedMs: null,
    piAiOpenedMs: null,
    firstScreencastFrameMs: null,
    piAiReadyMs: null
  },
  voiceRequestDetected: 'NO' as const,
  voiceFetchMode: 'Direct Fetch' as const,
  voiceResponseMime: 'audio/mpeg',
  voiceBytesFormatted: '0 KB',
  voiceFileReady: 'Idle' as const,
  playbackInPiAi: 'NO' as const,
  speakerClick: 'NO' as const,
  audioCapture: 'NO' as const,
  microphone: 'OFF' as const,
  audioDuration: 0,
  audioQueueCount: 0,
  lastAudioError: null,
  lastTextIntegrity: null,
  navigationState: 'Stable' as const,
  uiFreeze: 'NO' as const,
  lastRenderTimeMs: 10,
  activeWebSocketCount: 1,
  cdpListenerCount: 1,
  activeTimersCount: 2,
  activeObserversCount: 1,
  errorsCount: 0
};

const defaultState: AppControllerState = {
  browserStatus: 'disconnected',
  piAiStatus: 'unloaded',
  currentUrl: 'about:blank',
  pageTitle: '',
  diagnostics: defaultDiagnostics,
  messages: [],
  audioQueue: [],
  isBusy: false,
  busyAction: null,
  screencastActive: false,
  viewport: { width: 1280, height: 800 }
};

/**
 * Global Singleton WebSocket Connection Manager
 * Ensures that navigating menus NEVER tears down or duplicates the WebSocket or Browser session.
 */
class GlobalSocketManager {
  private static instance: GlobalSocketManager | null = null;
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimer: any = null;
  public currentState: AppControllerState = { ...defaultState };
  public wsConnected = false;
  private listeners = new Set<(connected: boolean, state: AppControllerState) => void>();

  private constructor() {
    this.init();
  }

  public static getInstance(): GlobalSocketManager {
    if (!GlobalSocketManager.instance) {
      GlobalSocketManager.instance = new GlobalSocketManager();
    }
    return GlobalSocketManager.instance;
  }

  public subscribe(cb: (connected: boolean, state: AppControllerState) => void) {
    this.listeners.add(cb);
    cb(this.wsConnected, this.currentState);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.wsConnected, this.currentState));
  }

  private init() {
    if (typeof window === 'undefined') return;
    this.connect();
    // Non-blocking initial fetch
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        if (data && data.browserStatus) {
          this.currentState = {
            ...this.currentState,
            ...data
          };
          this.notify();
        }
      })
      .catch(() => {});
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        this.wsConnected = true;
        freezeDetector.updateResourceCounts({ activeWebSocketCount: 1 });
        this.notify();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state') {
            this.currentState = {
              ...this.currentState,
              ...data.state,
              diagnostics: {
                ...this.currentState.diagnostics,
                ...data.state.diagnostics
              }
            };
            this.notify();
          } else if (data.type === 'screencastFrame') {
            const frameSrc = `data:image/jpeg;base64,${data.data}`;
            frameListeners.forEach(listener => listener(frameSrc));
          }
        } catch (e) {
          console.error('Error handling socket message:', e);
        }
      };

      ws.onclose = () => {
        this.isConnecting = false;
        this.wsConnected = false;
        this.ws = null;
        freezeDetector.updateResourceCounts({ activeWebSocketCount: 0 });
        this.notify();
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        this.isConnecting = false;
        this.wsConnected = false;
        this.notify();
      };
    } catch (e) {
      this.isConnecting = false;
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 3000);
      }
    }
  }

  public sendAction(action: ClientAction) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(action));
    } else {
      // Fallback to HTTP endpoint
      if (action.type === 'launchBrowser') fetch('/api/browser/launch', { method: 'POST' });
      else if (action.type === 'stopBrowser') fetch('/api/browser/stop', { method: 'POST' });
      else if (action.type === 'openPiAi') fetch('/api/browser/open', { method: 'POST' });
      else if (action.type === 'reloadPiAi') fetch('/api/browser/reload', { method: 'POST' });
      else if (action.type === 'sendMessage') {
        fetch('/api/browser/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: action.text })
        });
      } else if (action.type === 'runSelfTest') fetch('/api/browser/test', { method: 'POST' });
      else if (action.type === 'mouseClick') {
        fetch('/api/browser/interact/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });
      } else if (action.type === 'wheel') {
        fetch('/api/browser/interact/wheel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });
      } else if (action.type === 'keyPress') {
        fetch('/api/browser/interact/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: action.key })
        });
      }
    }
  }
}

const socketManager = GlobalSocketManager.getInstance();

export function useBrowserSocket() {
  const [state, setState] = useState<AppControllerState>(() => socketManager.currentState);
  const [wsConnected, setWsConnected] = useState<boolean>(() => socketManager.wsConnected);
  const [freezeMetrics, setFreezeMetrics] = useState<FreezeMonitorMetrics>(() => freezeDetector.getMetrics());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe to state updates without reopening WebSocket
    const unsubSocket = socketManager.subscribe((connected, newState) => {
      if (!isMountedRef.current) return;
      setWsConnected(connected);
      setState(newState);
    });

    // Subscribe to freeze detector updates
    const unsubFreeze = freezeDetector.subscribe((metrics) => {
      if (!isMountedRef.current) return;
      setFreezeMetrics(metrics);
    });

    return () => {
      isMountedRef.current = false;
      unsubSocket();
      unsubFreeze();
    };
  }, []);

  const sendAction = useCallback((action: ClientAction) => {
    socketManager.sendAction(action);
  }, []);

  // Merge freeze metrics into diagnostics for display
  const combinedState: AppControllerState = {
    ...state,
    diagnostics: {
      ...state.diagnostics,
      navigationState: freezeMetrics.navigationState,
      uiFreeze: freezeMetrics.uiFreeze,
      lastRenderTimeMs: freezeMetrics.lastRenderTimeMs,
      activeWebSocketCount: freezeMetrics.activeWebSocketCount,
      cdpListenerCount: freezeMetrics.cdpListenerCount,
      activeTimersCount: freezeMetrics.activeTimersCount,
      activeObserversCount: freezeMetrics.activeObserversCount
    }
  };

  return {
    state: combinedState,
    wsConnected,
    sendAction
  };
}
