import { AudioItem, AudioStatus } from '../src/types';

interface StoredAudio {
  audioId: string;
  responseId: string;
  buffer: Buffer;
  contentType: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

/**
 * Calculates accurate duration of an MP3 buffer by reading frame headers.
 * Falls back to bit-rate estimation if frames are incomplete.
 */
function calculateMp3Duration(buffer: Buffer): number {
  if (!buffer || buffer.length < 100) return 0;

  let offset = 0;
  // Skip ID3v2 tag if present
  if (buffer.length > 10 && buffer.toString('utf8', 0, 3) === 'ID3') {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    offset = 10 + tagSize;
  }

  const bitratesV1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const sampleRatesV1 = [44100, 48000, 32000, 0];

  let frameCount = 0;
  let totalSamples = 0;
  let detectedSampleRate = 44100;
  let detectedBitrate = 64;

  let scanPos = offset;
  while (scanPos < buffer.length - 4 && frameCount < 2000) {
    if (buffer[scanPos] === 0xff && (buffer[scanPos + 1] & 0xe0) === 0xe0) {
      const header = buffer.readUInt32BE(scanPos);
      const version = (header >> 19) & 3; // 3 = MPEG V1
      const layer = (header >> 17) & 3;   // 1 = Layer 3
      const bitrateIdx = (header >> 12) & 15;
      const srIdx = (header >> 10) & 3;
      const padding = (header >> 9) & 1;

      if (version === 3 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && srIdx < 3) {
        const bitrate = bitratesV1L3[bitrateIdx];
        const sampleRate = sampleRatesV1[srIdx];
        detectedSampleRate = sampleRate;
        detectedBitrate = bitrate;

        const frameLen = Math.floor((144 * bitrate * 1000) / sampleRate) + padding;
        if (frameLen > 0) {
          frameCount++;
          totalSamples += 1152;
          scanPos += frameLen;
          continue;
        }
      }
    }
    scanPos++;
  }

  if (frameCount > 5 && detectedSampleRate > 0) {
    // If we parsed the whole file or enough frames
    const dur = totalSamples / detectedSampleRate;
    if (scanPos >= buffer.length - 200) {
      return Math.round(dur * 10) / 10;
    }
  }

  // Fallback: file length / bitrate
  const kbps = detectedBitrate || 64;
  const estSeconds = (buffer.length * 8) / (kbps * 1000);
  return Math.max(1, Math.round(estSeconds * 10) / 10);
}

export class AudioSessionManager {
  private static instance: AudioSessionManager | null = null;
  // Cache of responseId -> StoredAudio
  private audioByResponseId = new Map<string, StoredAudio>();
  // Store by audioId -> StoredAudio
  private audioStore = new Map<string, StoredAudio>();
  private audioQueue: AudioItem[] = [];

  private onStateChangeCallback: (() => void) | null = null;
  private onLogCallback: ((level: 'info' | 'warn' | 'error' | 'success', msg: string) => void) | null = null;

  private lastCapturedDuration = 0;
  private lastCapturedBytes = 0;
  private lastCapturedMime = 'audio/mpeg';

  private constructor() {}

  public static getInstance(): AudioSessionManager {
    if (!AudioSessionManager.instance) {
      AudioSessionManager.instance = new AudioSessionManager();
    }
    return AudioSessionManager.instance;
  }

  public setCallbacks(callbacks: {
    onStateChange?: () => void;
    onLog?: (level: 'info' | 'warn' | 'error' | 'success', msg: string) => void;
  }) {
    if (callbacks.onStateChange) this.onStateChangeCallback = callbacks.onStateChange;
    if (callbacks.onLog) this.onLogCallback = callbacks.onLog;
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', msg: string) {
    if (this.onLogCallback) {
      this.onLogCallback(level, msg);
    }
  }

  private notify() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  public getAudioQueue(): AudioItem[] {
    return [...this.audioQueue];
  }

  public getStoredAudio(audioId: string): StoredAudio | undefined {
    return this.audioStore.get(audioId);
  }

  public hasAudioForResponse(responseId: string): boolean {
    return this.audioByResponseId.has(responseId);
  }

  public getAudioForResponse(responseId: string): StoredAudio | undefined {
    return this.audioByResponseId.get(responseId);
  }

  public getLastCapturedDuration(): number {
    return this.lastCapturedDuration;
  }

  public getLastCapturedBytes(): number {
    return this.lastCapturedBytes;
  }

  public getLastCapturedMime(): string {
    return this.lastCapturedMime;
  }

  /**
   * Enqueue a new audio session for a genuine Pi.ai response.
   */
  public enqueueResponseAudio(responseId: string, userPrompt: string, responseText: string): AudioItem {
    // If cached, return existing
    const existing = this.audioByResponseId.get(responseId);
    if (existing) {
      const existingItem = this.audioQueue.find(i => i.responseId === responseId);
      if (existingItem) return existingItem;
    }

    const audioId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const audioItem: AudioItem = {
      audioId,
      responseId,
      status: 'idle',
      audioUrl: null,
      durationSeconds: 0,
      fileSizeBytes: 0,
      mimeType: 'audio/mpeg',
      errorReason: null,
      timestamp: new Date().toLocaleTimeString(),
      userPrompt,
      responseText: responseText.slice(0, 100)
    };

    this.audioQueue.push(audioItem);
    this.notify();
    return audioItem;
  }

  /**
   * Update the status of an audio queue item.
   */
  public updateAudioStatus(
    audioId: string,
    status: AudioStatus,
    details?: { duration?: number; sizeBytes?: number; error?: string; audioUrl?: string }
  ) {
    const item = this.audioQueue.find(a => a.audioId === audioId);
    if (!item) return;

    item.status = status;
    if (details?.duration !== undefined) item.durationSeconds = details.duration;
    if (details?.sizeBytes !== undefined) item.fileSizeBytes = details.sizeBytes;
    if (details?.error !== undefined) item.errorReason = details.error;
    if (details?.audioUrl !== undefined) item.audioUrl = details.audioUrl;

    this.notify();
  }

  /**
   * Directly save audio bytes fetched from Pi.ai's real voice endpoint without playback or recording.
   */
  public storeDirectAudio(
    audioId: string,
    responseId: string,
    buffer: Buffer,
    contentType: string = 'audio/mpeg'
  ): StoredAudio {
    const duration = calculateMp3Duration(buffer);
    this.lastCapturedDuration = duration;
    this.lastCapturedBytes = buffer.length;
    this.lastCapturedMime = contentType;

    const audioUrl = `/api/audio/${audioId}`;
    const stored: StoredAudio = {
      audioId,
      responseId,
      buffer,
      contentType,
      durationSeconds: duration,
      fileSizeBytes: buffer.length
    };

    this.audioStore.set(audioId, stored);
    this.audioByResponseId.set(responseId, stored);

    this.updateAudioStatus(audioId, 'ready', {
      duration,
      sizeBytes: buffer.length,
      audioUrl
    });

    const kbSize = (buffer.length / 1024).toFixed(1);
    this.log(
      'success',
      `Direct Pi Voice fetched! Size: ${kbSize} KB (${buffer.length} bytes), Duration: ${duration}s, Format: ${contentType}. File is Ready.`
    );

    return stored;
  }

  /**
   * Handle official Pi.ai audio response stream intercepted directly from network.
   */
  public handleNetworkAudioResponse(url: string, buffer: Buffer, contentType: string = 'audio/mpeg') {
    let item = this.audioQueue.slice().reverse().find(i => i.status === 'fetching' || i.status === 'idle');
    if (!item && this.audioQueue.length > 0) {
      item = this.audioQueue[this.audioQueue.length - 1];
    }

    if (item && item.status !== 'ready') {
      this.storeDirectAudio(item.audioId, item.responseId, buffer, contentType);
      this.log('success', `Direct Pi Voice audio captured from network! Size: ${(buffer.length / 1024).toFixed(1)} KB`);
    }
  }

  public clearQueue() {
    this.audioQueue = [];
    this.audioStore.clear();
    this.audioByResponseId.clear();
    this.notify();
  }
}
