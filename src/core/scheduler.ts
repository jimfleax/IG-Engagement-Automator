/**
 * @file scheduler.ts
 * @description Provides background execution timing, non-throttled sleep timers, wake locks, exponential backoff, and visibility spoofing.
 * @architecture Serves as the scheduling and timing foundation utilized by WorkflowEngine to pace browser and network interactions.
 * @agent_note Manages background wake locks and overrides document visibility; ensure destroy() is invoked during teardown to avoid memory or timer leaks.
 */

/// <reference types="chrome-types" />

export interface PendingTimerEntry {
  settle: (success: boolean) => void;
}

/**
 * Timing engine managing background delays, wake locks, and tab visibility spoofing.
 */
export class BackgroundScheduler {
  timerSeq: number;
  pendingTimers: Map<number, PendingTimerEntry>;
  releaseWakeLock: (() => void) | null;
  isDestroyed: boolean;
  visibilityHandler: ((e?: Event) => void) | null;

  /**
   * Initializes scheduler state and installs document visibility spoofing.
   */
  constructor() {
    this.timerSeq = 0;
    this.pendingTimers = new Map();
    this.releaseWakeLock = null;
    this.isDestroyed = false;
    this.visibilityHandler = null;

    this.installVisibilityOverride();
  }

  /**
   * Overrides document visibility state to prevent Chrome background tab throttling.
   */
  installVisibilityOverride(): void {
    try {
      if (typeof document !== "undefined") {
        Object.defineProperty(document, "hidden", {
          get: () => false,
          configurable: true,
        });
        Object.defineProperty(document, "visibilityState", {
          get: () => "visible",
          configurable: true,
        });
      }
      this.visibilityHandler = (e?: Event) => {
        if (e && typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
      };
      if (typeof window !== "undefined") {
        window.addEventListener("visibilitychange", this.visibilityHandler, true);
      }
    } catch (_) {}
  }

  /**
   * Executes a cancellable sleep delay, delegating to the extension background script if available.
   * @param ms - Milliseconds to sleep.
   * @returns True if completed normally, false if cancelled or destroyed.
   */
  sleep(ms: number): Promise<boolean> {
    if (this.isDestroyed) return Promise.resolve(false);

    const delayMs = Math.max(0, Number(ms) || 0);
    const timerId = ++this.timerSeq;

    return new Promise((resolve) => {
      let localTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let isSettled = false;

      const settle = (success: boolean) => {
        if (isSettled) return;
        isSettled = true;
        this.pendingTimers.delete(timerId);
        if (localTimeoutId) clearTimeout(localTimeoutId);
        resolve(success);
      };

      this.pendingTimers.set(timerId, { settle });

      let delegatedToBackground = false;
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        try {
          (chrome.runtime.sendMessage as any)(
            { action: "BACKGROUND_SLEEP", ms: delayMs, timerId: String(timerId) },
            (response: any) => {
              if (chrome.runtime.lastError || !response || !response.success) {
                if (!isSettled && !localTimeoutId) {
                  localTimeoutId = setTimeout(() => settle(true), delayMs);
                }
              } else {
                settle(true);
              }
            }
          );
          delegatedToBackground = true;
        } catch (_) {
          delegatedToBackground = false;
        }
      }

      if (!delegatedToBackground) {
        localTimeoutId = setTimeout(() => settle(true), delayMs);
      }
    });
  }

  /**
   * Cancels all currently pending sleep timers and notifies background workers.
   */
  cancelAllTimers(): void {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        (chrome.runtime.sendMessage as any)({ action: "CANCEL_ALL_TIMERS" }, () => {});
      } catch (_) {}
    }

    this.pendingTimers.forEach((entry) => {
      if (entry && typeof entry.settle === "function") {
        entry.settle(false);
      }
    });
    this.pendingTimers.clear();
  }

  /**
   * Calculates exponential retry backoff delay with randomized jitter.
   * @param attempt - Current attempt number (1-based).
   * @param baseMs - Base delay in milliseconds.
   * @returns Backoff delay in milliseconds clamped to 30000ms.
   */
  computeBackoffMs(attempt: number, baseMs: number): number {
    const exp = Math.min(4, Math.max(0, attempt - 1));
    const ceiling = baseMs * Math.pow(2, exp);
    const jitter = Math.floor(Math.random() * baseMs);
    return Math.min(30000, Math.floor(ceiling * 0.75 + jitter));
  }

  /**
   * Computes a natural, human-like delay between minimum and maximum bounds using Bates distribution.
   * @param min - Minimum delay in milliseconds.
   * @param max - Maximum delay in milliseconds.
   * @returns Randomized delay in milliseconds.
   */
  computeHumanDelayMs(min: number, max: number): number {
    if (max <= min) return min;
    const u = (Math.random() + Math.random()) / 2;
    return Math.floor(min + u * (max - min));
  }

  /**
   * Requests a navigator Web Lock to keep background scripts active.
   */
  acquireWakeLock(): void {
    if (typeof navigator !== "undefined" && (navigator as any).locks?.request && !this.releaseWakeLock) {
      try {
        (navigator as any).locks.request("ig_automation_background_lock", () => {
          return new Promise<void>((resolve) => {
            this.releaseWakeLock = resolve;
          });
        });
      } catch (_) {}
    }
  }

  /**
   * Releases any active Web Lock.
   */
  freeWakeLock(): void {
    if (this.releaseWakeLock) {
      try {
        this.releaseWakeLock();
      } catch (_) {}
      this.releaseWakeLock = null;
    }
  }

  /**
   * Cleans up timers, releases wake locks, and removes event listeners.
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cancelAllTimers();
    this.freeWakeLock();
    if (this.visibilityHandler && typeof window !== "undefined") {
      window.removeEventListener("visibilitychange", this.visibilityHandler, true);
      this.visibilityHandler = null;
    }
  }
}
