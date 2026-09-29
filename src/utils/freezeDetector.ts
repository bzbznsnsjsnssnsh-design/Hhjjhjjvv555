/**
 * UI Freeze Detector & Navigation Performance Monitor
 * Tracks main thread responsiveness, navigation lag, and resource usage.
 */

export interface FreezeMonitorMetrics {
  navigationState: 'Stable' | 'Navigating';
  uiFreeze: 'NO' | 'YES';
  lastRenderTimeMs: number;
  activeWebSocketCount: number;
  cdpListenerCount: number;
  activeTimersCount: number;
  activeObserversCount: number;
  potentialFreezeCount: number;
  lastLagDetectedMs: number;
}

class FreezeDetectorService {
  private static instance: FreezeDetectorService | null = null;
  private metrics: FreezeMonitorMetrics = {
    navigationState: 'Stable',
    uiFreeze: 'NO',
    lastRenderTimeMs: 8,
    activeWebSocketCount: 1,
    cdpListenerCount: 1,
    activeTimersCount: 2,
    activeObserversCount: 1,
    potentialFreezeCount: 0,
    lastLagDetectedMs: 0
  };

  private listeners = new Set<(m: FreezeMonitorMetrics) => void>();
  private navStartTime: number | null = null;
  private heartbeatInterval: any = null;
  private lastHeartbeat = Date.now();

  private constructor() {
    this.startHeartbeatMonitor();
  }

  public static getInstance(): FreezeDetectorService {
    if (!FreezeDetectorService.instance) {
      FreezeDetectorService.instance = new FreezeDetectorService();
    }
    return FreezeDetectorService.instance;
  }

  public subscribe(cb: (m: FreezeMonitorMetrics) => void) {
    this.listeners.add(cb);
    cb(this.metrics);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb({ ...this.metrics }));
  }

  /**
   * Heartbeat to detect main thread event-loop freezing.
   * If setInterval takes significantly longer than 150ms to fire, main thread is blocked.
   */
  private startHeartbeatMonitor() {
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastHeartbeat;
      this.lastHeartbeat = now;

      // Expecting ~150ms. If delta > 400ms, event loop was paused/frozen
      if (delta > 400) {
        this.metrics.uiFreeze = 'YES';
        this.metrics.potentialFreezeCount++;
        this.metrics.lastLagDetectedMs = delta;
        console.warn(`[Diagnostics] Potential UI freeze detected: main-thread delay ${delta}ms`);
        this.notify();

        // Auto-recover status after 1.5s
        setTimeout(() => {
          this.metrics.uiFreeze = 'NO';
          this.notify();
        }, 1500);
      }
    }, 150);
  }

  public onNavigationStart(targetMenu: string) {
    this.navStartTime = performance.now();
    this.metrics.navigationState = 'Navigating';
    console.log(`[Diagnostics] Navigation started: -> ${targetMenu}`);
    this.notify();
  }

  public onNavigationComplete(targetMenu: string) {
    const elapsed = this.navStartTime ? Math.round(performance.now() - this.navStartTime) : 10;
    this.metrics.lastRenderTimeMs = elapsed;
    this.metrics.navigationState = 'Stable';
    console.log(`[Diagnostics] Navigation completed: ${targetMenu} in ${elapsed}ms (Render time: ${elapsed}ms)`);

    if (elapsed > 250) {
      console.warn(`[Diagnostics] Potential UI freeze detected: navigation took ${elapsed}ms`);
      this.metrics.uiFreeze = 'YES';
      this.metrics.potentialFreezeCount++;
      setTimeout(() => {
        this.metrics.uiFreeze = 'NO';
        this.notify();
      }, 1500);
    } else {
      this.metrics.uiFreeze = 'NO';
    }

    this.notify();
  }

  public updateResourceCounts(counts: {
    activeWebSocketCount?: number;
    cdpListenerCount?: number;
    activeTimersCount?: number;
    activeObserversCount?: number;
  }) {
    if (counts.activeWebSocketCount !== undefined) this.metrics.activeWebSocketCount = counts.activeWebSocketCount;
    if (counts.cdpListenerCount !== undefined) this.metrics.cdpListenerCount = counts.cdpListenerCount;
    if (counts.activeTimersCount !== undefined) this.metrics.activeTimersCount = counts.activeTimersCount;
    if (counts.activeObserversCount !== undefined) this.metrics.activeObserversCount = counts.activeObserversCount;
    this.notify();
  }

  public getMetrics(): FreezeMonitorMetrics {
    return { ...this.metrics };
  }

  public destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }
}

export const freezeDetector = FreezeDetectorService.getInstance();
