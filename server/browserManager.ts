import puppeteer, { Browser, Page, CDPSession } from 'puppeteer';
import { AudioSessionManager } from './audioSessionManager';

export class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cdpSession: CDPSession | null = null;
  private isLaunching = false;
  private isStopping = false;

  private onFrameCallback: ((base64Image: string) => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onLogCallback: ((level: 'info' | 'warn' | 'error' | 'success', msg: string) => void) | null = null;

  private lastFrameTime = 0;
  private frameThrottleMs = 70; // ~14 fps max to prevent flooding the client main thread
  private cdpListenersCount = 0;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public setCallbacks(callbacks: {
    onFrame?: (base64Image: string) => void;
    onDisconnect?: () => void;
    onLog?: (level: 'info' | 'warn' | 'error' | 'success', msg: string) => void;
  }) {
    if (callbacks.onFrame) this.onFrameCallback = callbacks.onFrame;
    if (callbacks.onDisconnect) this.onDisconnectCallback = callbacks.onDisconnect;
    if (callbacks.onLog) this.onLogCallback = callbacks.onLog;
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', msg: string) {
    if (this.onLogCallback) {
      this.onLogCallback(level, msg);
    }
  }

  public isConnected(): boolean {
    return !!(this.browser && this.browser.connected && this.page);
  }

  public getBrowser(): Browser | null {
    return this.browser;
  }

  public getPage(): Page | null {
    return this.page;
  }

  public getCDPSession(): CDPSession | null {
    return this.cdpSession;
  }

  public getCDPListenersCount(): number {
    return this.cdpListenersCount;
  }

  public async launch(viewport = { width: 1280, height: 800 }): Promise<{ success: boolean; launchTimeMs: number; error?: string }> {
    if (this.isConnected()) {
      this.log('info', 'Chromium is already connected and running.');
      return { success: true, launchTimeMs: 0 };
    }

    if (this.isLaunching) {
      this.log('info', 'Chromium launch already in progress...');
      return { success: false, launchTimeMs: 0, error: 'Launch already in progress' };
    }

    this.isLaunching = true;
    const startTime = Date.now();

    try {
      this.log('info', 'Launching real Chromium with genuine audio playback & CDP support...');

      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security=false',
          '--window-size=1280,800',
          // Audio and media flags for real Pi.ai speaker playback
          '--autoplay-policy=no-user-gesture-required',
          '--use-fake-ui-for-media-stream',
          '--disable-features=AudioServiceOutOfProcess'
        ]
      });

      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

      await this.page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      await this.page.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      );

      // Pre-inject audio tracker hooks into the window context
      await this.page.evaluateOnNewDocument(`
        (function() {
          window.__pi_audio_events = [];
          window.__pi_audio_active = false;
          window.__pi_audio_started_at = null;
          window.__pi_audio_ended_at = null;

          // Hook HTMLMediaElement: silence in-page audio so Playback in Pi.ai is ZERO
          const origPlay = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function() {
            try {
              this.muted = true;
              this.volume = 0;
            } catch {}
            window.__pi_audio_active = true;
            window.__pi_audio_started_at = Date.now();
            window.__pi_last_media_element = this;
            
            const handlePlaying = () => {
              window.__pi_audio_events.push({ type: 'playing', time: Date.now(), src: this.src || this.currentSrc, duration: this.duration });
            };
            const handleEnded = () => {
              window.__pi_audio_active = false;
              window.__pi_audio_ended_at = Date.now();
              window.__pi_audio_events.push({ type: 'ended', time: Date.now(), src: this.src || this.currentSrc, duration: this.duration });
            };
            const handlePause = () => {
              window.__pi_audio_active = false;
              window.__pi_audio_events.push({ type: 'pause', time: Date.now(), src: this.src || this.currentSrc, duration: this.duration });
            };

            this.addEventListener('playing', handlePlaying, { once: true });
            this.addEventListener('ended', handleEnded, { once: true });
            this.addEventListener('pause', handlePause, { once: true });

            return origPlay.apply(this, arguments);
          };
        })();
      `);

      // Network listener to intercept real Pi.ai audio streams directly from network
      this.page.on('response', async (response) => {
        try {
          const url = response.url();
          if (url.includes('/api/chat/voice') || (url.includes('/voice') && url.includes('pi.ai'))) {
            const status = response.status();
            const ct = response.headers()['content-type'] || '';
            if (status === 200 && (ct.includes('audio') || ct.includes('mpeg') || ct.includes('octet-stream'))) {
              const buffer = await response.buffer();
              if (buffer && buffer.length > 500) {
                AudioSessionManager.getInstance().handleNetworkAudioResponse(url, buffer, ct);
              }
            }
          }
        } catch {}
      });

      // Initialize CDP Screencast
      await this.initScreencast();

      // Handle unexpected disconnects
      this.browser.on('disconnected', () => {
        this.cdpSession = null;
        this.page = null;
        this.browser = null;
        this.log('warn', 'Chromium disconnected.');
        if (this.onDisconnectCallback) this.onDisconnectCallback();
      });

      const launchTimeMs = Date.now() - startTime;
      this.log('success', `Chromium launched successfully in ${launchTimeMs}ms!`);
      return { success: true, launchTimeMs };
    } catch (err: any) {
      this.log('error', `Failed to launch Chromium: ${err.message}`);
      return { success: false, launchTimeMs: Date.now() - startTime, error: err.message };
    } finally {
      this.isLaunching = false;
    }
  }

  private async initScreencast() {
    if (!this.page) return;
    try {
      this.cdpSession = await this.page.target().createCDPSession();
      this.cdpListenersCount = 1;

      this.cdpSession.on('Page.screencastFrame', async ({ data, sessionId }) => {
        try {
          await this.cdpSession?.send('Page.screencastFrameAck', { sessionId });
        } catch {}

        // Throttle frame delivery to prevent freezing React UI during rapid renders
        const now = Date.now();
        if (now - this.lastFrameTime >= this.frameThrottleMs) {
          this.lastFrameTime = now;
          if (this.onFrameCallback) {
            this.onFrameCallback(data);
          }
        }
      });

      await this.cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 60,
        maxWidth: 1280,
        maxHeight: 800,
        everyNthFrame: 1
      });

      this.log('info', 'Live Chromium CDP Screencast started (1280x800).');
    } catch (err: any) {
      this.log('warn', `CDP screencast notice: ${err.message}`);
    }
  }

  public async stop(): Promise<boolean> {
    if (this.isStopping) return true;
    this.isStopping = true;

    try {
      if (this.cdpSession) {
        try {
          await this.cdpSession.send('Page.stopScreencast');
          await this.cdpSession.detach();
        } catch {}
        this.cdpSession = null;
        this.cdpListenersCount = 0;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }

      this.log('info', 'Chromium stopped cleanly.');
      return true;
    } catch (err: any) {
      this.log('error', `Error stopping Chromium: ${err.message}`);
      return false;
    } finally {
      this.isStopping = false;
    }
  }

  public async dispatchClick(
    browserX: number,
    browserY: number,
    button: 'left' | 'right' | 'middle' = 'left',
    clickCount: number = 1
  ): Promise<void> {
    if (!this.page) return;
    const clampedX = Math.max(0, Math.min(1280, Math.round(browserX)));
    const clampedY = Math.max(0, Math.min(800, Math.round(browserY)));

    if (this.cdpSession) {
      await this.cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: clampedX,
        y: clampedY
      });
      await this.cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: clampedX,
        y: clampedY,
        button,
        clickCount
      });
      await new Promise(r => setTimeout(r, 20));
      await this.cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: clampedX,
        y: clampedY,
        button,
        clickCount
      });
    } else {
      await this.page.mouse.click(clampedX, clampedY, { button, count: clickCount });
    }
  }

  public async dispatchWheel(browserX: number, browserY: number, deltaX: number, deltaY: number): Promise<void> {
    if (!this.page) return;
    const clampedX = Math.max(0, Math.min(1280, Math.round(browserX)));
    const clampedY = Math.max(0, Math.min(800, Math.round(browserY)));

    if (this.cdpSession) {
      await this.cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: clampedX,
        y: clampedY,
        deltaX,
        deltaY
      });
    } else {
      await this.page.mouse.wheel({ deltaX, deltaY });
    }
  }

  public async dispatchKey(key: string): Promise<void> {
    if (!this.page) return;
    await this.page.keyboard.press(key as any);
  }

  public async dispatchTypeText(text: string): Promise<void> {
    if (!this.page) return;
    await this.page.keyboard.type(text, { delay: 20 });
  }
}
