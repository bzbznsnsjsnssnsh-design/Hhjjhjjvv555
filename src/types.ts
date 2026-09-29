/**
 * Types shared across Frontend and Backend
 */

export type BrowserStatus = 'connected' | 'disconnected' | 'launching' | 'stopping';

export type PiAiStatus = 'ready' | 'waiting_captcha_login' | 'loading' | 'unloaded' | 'error';

export type AudioStatus = 'idle' | 'preparing' | 'fetching' | 'ready' | 'error';

export type NavigationTab = 'split' | 'chat' | 'viewport' | 'audio' | 'diagnostics';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface StartupTimings {
  appStartMs: number;
  reactMountedMs: number | null;
  uiVisibleMs: number | null;
  browserLaunchMs: number | null;
  cdpConnectedMs: number | null;
  piAiOpenedMs: number | null;
  firstScreencastFrameMs: number | null;
  piAiReadyMs: number | null;
}

export interface TextIntegrityInfo {
  rawText: string;
  normalizedText: string;
  finalText: string;
  rawLength: number;
  normalizedLength: number;
  unicodeLength: number;
  arabicCharacterCount: number;
  rawSample?: string;
  normalizedSample?: string;
}

export interface AudioItem {
  audioId: string;
  responseId: string;
  status: AudioStatus;
  audioUrl?: string | null;
  durationSeconds?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  errorReason?: string | null;
  timestamp: string;
  userPrompt?: string;
  responseText?: string;
}

export interface DiagnosticsState {
  browserLaunched: boolean;
  chromiumVisibleStreamed: boolean;
  piAiOpened: boolean;
  pageLoaded: boolean;
  loginRequired: boolean;
  captchaDetected: boolean;
  inputFound: boolean;
  manualClickWorking: boolean;
  manualScrollWorking: boolean;
  keyboardWorking: boolean;
  textInserted: boolean;
  inputEventTriggered: boolean;
  sendButtonFound: boolean;
  sendTriggered: boolean;
  waitingForResponse: boolean;
  responseDetected: boolean;
  responseStabilized: boolean;
  responseExtracted: boolean;
  lastError: string | null;
  logs: LogEntry[];
  browserViewport: { width: number; height: number; devicePixelRatio: number };
  screencastDimensions: { width: number; height: number };
  startupTimings: StartupTimings;

  // Direct Pi Voice Fetch Diagnostics (Strictly No Speaker Click, No Recording)
  voiceRequestDetected: 'YES' | 'NO';
  voiceFetchMode: 'Direct Fetch';
  voiceResponseMime: string;
  voiceBytesFormatted: string;
  voiceFileReady: 'Ready' | 'Fetching...' | 'Unavailable' | 'Idle';
  playbackInPiAi: 'NO';
  speakerClick: 'NO';
  audioCapture: 'NO';
  microphone: 'OFF';

  audioDuration: number;
  audioQueueCount: number;
  lastAudioError: string | null;

  // Arabic Text Integrity
  lastTextIntegrity: TextIntegrityInfo | null;

  // UI Freeze & Navigation stability diagnostics
  navigationState: 'Stable' | 'Navigating';
  uiFreeze: 'NO' | 'YES';
  lastRenderTimeMs: number;
  activeWebSocketCount: number;
  cdpListenerCount: number;
  activeTimersCount: number;
  activeObserversCount: number;
  errorsCount: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'pi' | 'system';
  text: string;
  timestamp: string;
  audioId?: string;
  audioStatus?: AudioStatus;
  audioUrl?: string | null;
  audioDuration?: number;
  audioSizeKb?: number;
  audioError?: string | null;
  textIntegrity?: TextIntegrityInfo;
}

export interface AppControllerState {
  browserStatus: BrowserStatus;
  piAiStatus: PiAiStatus;
  currentUrl: string;
  pageTitle: string;
  diagnostics: DiagnosticsState;
  messages: ChatMessage[];
  audioQueue: AudioItem[];
  isBusy: boolean;
  busyAction: string | null;
  screencastActive: boolean;
  viewport: { width: number; height: number };
}

export type ClientAction =
  | { type: 'launchBrowser' }
  | { type: 'stopBrowser' }
  | { type: 'openPiAi' }
  | { type: 'reloadPiAi' }
  | { type: 'testConnection' }
  | { type: 'runSelfTest' }
  | { type: 'sendMessage'; text: string; requestId?: string }
  | { type: 'triggerAudio'; responseId: string }
  | { 
      type: 'mouseClick'; 
      displayX?: number; 
      displayY?: number; 
      browserX: number; 
      browserY: number; 
      button?: 'left' | 'right' | 'middle'; 
      clickCount?: number;
    }
  | { type: 'mouseDown'; browserX: number; browserY: number; button?: 'left' | 'right' | 'middle' }
  | { type: 'mouseUp'; browserX: number; browserY: number; button?: 'left' | 'right' | 'middle' }
  | { type: 'mouseMove'; browserX: number; browserY: number }
  | { type: 'wheel'; browserX: number; browserY: number; deltaX: number; deltaY: number }
  | { type: 'keyPress'; key: string }
  | { type: 'typeText'; text: string }
  | { type: 'clearLogs' };
