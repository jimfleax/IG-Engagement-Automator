/**
 * @file content.tsx
 * @description Injects and bootstraps the React-based engagement automator overlay into Instagram web pages using Shadow DOM isolation.
 * @architecture Serves as the primary content script entrypoint, initializing WorkflowEngine, mounting App inside Shadow DOM, and bridging Chrome runtime / window messages.
 * @agent_note Maintain Shadow DOM isolation to avoid CSS leaks, and ensure all runtime and popstate event listeners are torn down in destroy().
 * @author Reetabrata Bhandari (Jim Fleax)
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App.tsx";
import { ErrorBoundary } from "./ui/components/ErrorBoundary.tsx";
import { WorkflowEngine } from "./core/workflow.ts";
import styles from "../content/styles.css?inline";

declare global {
  interface Window {
    __igAutomationSuiteInstance?: {
      workflow: WorkflowEngine;
      destroy: () => void;
    };
  }
}

const HOST_ID = "ig-modal-suite-root";

if (window.__igAutomationSuiteInstance?.destroy) {
  window.__igAutomationSuiteInstance.destroy();
}

/**
 * Initializes the extension overlay by creating the Shadow DOM host, setting up listeners, and rendering the React app.
 */
async function init(): Promise<void> {
  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject Compiled Tailwind & shadcn Styles into Shadow DOM
  const styleEl = document.createElement("style");
  styleEl.textContent = typeof styles === "string" ? styles : "";
  shadow.appendChild(styleEl);

  const rootContainer = document.createElement("div");
  shadow.appendChild(rootContainer);

  const workflow = new WorkflowEngine();
  await workflow.init();

  // Network Sniffer message listener (harvests authentic mutations sniffed in MAIN world)
  const snifferMessageHandler = (evt: MessageEvent) => {
    if (evt.data?.type === "IG_GRAPHQL_SNIFFED" && evt.data?.data) {
      workflow.network.harvestSniffedMutation(evt.data.data);
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({
          ig_harvested_mutations: workflow.network.capturedMutations,
        });
      }
    }
  };
  window.addEventListener("message", snifferMessageHandler);

  const reactRoot = ReactDOM.createRoot(rootContainer);
  reactRoot.render(
    <ErrorBoundary onReset={() => workflow.broadcast()}>
      <App workflow={workflow} />
    </ErrorBoundary>
  );

  // Chrome Runtime Messaging Listener
  const messageHandler = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean => {
    if (!message || !message.action) return false;

    switch (message.action) {
      case "GET_STATUS": {
        const snap = workflow.getStateSnapshot();
        sendResponse({
          status: snap.state.status,
          statusDetail: snap.state.statusDetail,
          sessionChecked: snap.state.sessionChecked,
          maxPosts: snap.config.maxPostsToProcess,
          metrics: snap.state.metrics,
          detectedUsername: snap.state.detectedUsername,
          targetUsername: snap.config.targetUsername || "",
          diagnostics: snap.state.diagnostics,
          isVisible: snap.prefs.isVisible,
          isMinimized: snap.prefs.isMinimized,
          engineMode: snap.config.engineMode || "hybrid",
          engagementMode: snap.config.engagementMode || "both",
          likeProbability: snap.config.likeProbability ?? 100,
          commentProbability: snap.config.commentProbability ?? 100,
        });
        return false;
      }

      case "TOGGLE_MODAL": {
        workflow.toggleVisibility().then((isVisible) => {
          sendResponse({ isVisible });
        });
        return true;
      }

      case "SHOW_MODAL": {
        workflow.showModal().then(() => {
          sendResponse({ isVisible: true });
        });
        return true;
      }

      case "HIDE_MODAL": {
        workflow.hideModal();
        sendResponse({ isVisible: false });
        return false;
      }

      case "START_WORKFLOW": {
        workflow.start();
        sendResponse({ success: true, status: workflow.state.status });
        return false;
      }

      case "PAUSE_WORKFLOW": {
        workflow.pause();
        sendResponse({ success: true, status: workflow.state.status });
        return false;
      }

      case "RESUME_WORKFLOW": {
        workflow.resume();
        sendResponse({ success: true, status: workflow.state.status });
        return false;
      }

      case "STOP_WORKFLOW": {
        workflow.stop();
        sendResponse({ success: true, status: workflow.state.status });
        return false;
      }

      default:
        return false;
    }
  };

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(messageHandler);
  }

  // SPA Navigation Watcher: detect URL path changes on Instagram and auto-refresh context
  let lastKnownPath = typeof window !== "undefined" ? window.location.pathname : "";
  const checkUrlNavigation = () => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== lastKnownPath) {
      lastKnownPath = window.location.pathname;
      workflow.refreshPageContext();
    }
  };
  window.addEventListener("popstate", checkUrlNavigation);
  const navIntervalId = setInterval(checkUrlNavigation, 750);

  function destroy(): void {
    clearInterval(navIntervalId);
    window.removeEventListener("popstate", checkUrlNavigation);
    window.removeEventListener("message", snifferMessageHandler);
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(messageHandler);
    }
    workflow.destroy();
    reactRoot.unmount();
    host.remove();
    if (window.__igAutomationSuiteInstance?.destroy === destroy) {
      delete window.__igAutomationSuiteInstance;
    }
  }

  window.__igAutomationSuiteInstance = { workflow, destroy };
  window.addEventListener("beforeunload", destroy, { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
