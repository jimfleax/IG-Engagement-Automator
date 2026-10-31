/**
 * @file background.ts
 * @description Manages extension lifecycle, contextual menus, keyboard shortcut commands, and background sleep timers.
 * @architecture Service worker layer in Chrome Extension Manifest V3 communicating with content scripts and popup via Chrome messaging APIs.
 * @agent_note Relies on chrome.runtime, chrome.contextMenus, and chrome.commands APIs; keep activeTimers cleanup robust to prevent background memory leaks.
 * @author Reetabrata Bhandari (Jim Fleax)
 */
/// <reference types="chrome-types" />

export interface BackgroundSleepMessage {
  action: "BACKGROUND_SLEEP";
  ms?: number;
  timerId?: string;
  cancel?: boolean;
}

export interface CancelAllTimersMessage {
  action: "CANCEL_ALL_TIMERS";
}

export interface PingMessage {
  action: "PING";
}

export type ExtensionMessage = BackgroundSleepMessage | CancelAllTimersMessage | PingMessage | { action: string; [key: string]: any };

/**
 * Keep-alive tracker mapping unique timer IDs to active browser setTimeout IDs.
 */
const activeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

/**
 * Registers context menu entry on Instagram pages to open the engagement automator modal.
 */
function setupContextMenu(): void {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: "open-ig-automator",
        title: "Open IG Engagement Automator",
        contexts: ["page", "link", "image"],
        documentUrlPatterns: ["https://*.instagram.com/*"],
      },
      () => {
        if (chrome.runtime.lastError) {
          // Suppress duplicate or registration warnings during reloads
        }
      }
    );
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[IG Automator] Extension successfully installed.");
  } else if (details.reason === "update") {
    console.log("[IG Automator] Extension updated to version " + chrome.runtime.getManifest().version);
  }
  setupContextMenu();
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    setupContextMenu();
  });
}

/**
 * Dispatches modal display request when the context menu item is clicked on an Instagram tab.
 */
if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "open-ig-automator") {
      if (tab && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "SHOW_MODAL" });
        } catch (err: any) {
          console.warn("[IG Automator] Could not dispatch SHOW_MODAL via context menu:", err?.message);
        }
      }
    }
  });
}

/**
 * Dispatches modal toggle command to active Instagram tab on registered keyboard shortcut.
 */
chrome.commands.onCommand.addListener(async (command: string) => {
  if (command === "toggle-modal") {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.url && tab.url.includes("instagram.com")) {
        await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_MODAL" });
      }
    } catch (err: any) {
      console.warn("[IG Automator] Could not dispatch toggle command to active tab:", err?.message);
    }
  }
});

/**
 * Handles extension messaging for background sleep timers and diagnostic pings.
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean => {
    if (!message || !message.action) return false;

    switch (message.action) {
      case "BACKGROUND_SLEEP": {
        const sleepMsg = message as BackgroundSleepMessage;
        const ms = Math.max(0, Number(sleepMsg.ms) || 0);
        const timerId = sleepMsg.timerId || Math.random().toString(36).slice(2);

        // Cancel previous timer with same ID if requested
        if (sleepMsg.cancel) {
          if (activeTimers.has(timerId)) {
            clearTimeout(activeTimers.get(timerId)!);
            activeTimers.delete(timerId);
          }
          sendResponse({ success: true, cancelled: true });
          return false;
        }

        const timeoutId = setTimeout(() => {
          activeTimers.delete(timerId);
          try {
            sendResponse({ success: true, timerId });
          } catch (_) {
            // Channel may have closed if tab was closed
          }
        }, ms);

        activeTimers.set(timerId, timeoutId);
        return true; // Keep message channel open for async response
      }

      case "CANCEL_ALL_TIMERS": {
        activeTimers.forEach((tid) => clearTimeout(tid));
        activeTimers.clear();
        sendResponse({ success: true });
        return false;
      }

      case "PING": {
        sendResponse({ status: "ok", timestamp: Date.now() });
        return false;
      }

      default:
        return false;
    }
  }
);
