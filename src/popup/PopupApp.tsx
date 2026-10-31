/**
 * @file PopupApp.tsx
 * @description Provides the toolbar popup UI for status monitoring, workflow controls, and DOM health diagnostics.
 * @architecture Acts as the standalone extension action popup view, polling tab status and sending control messages to the active Instagram tab content script.
 * @agent_note Relies on chrome.tabs messaging API; verify active tab matches instagram.com before dispatching actions.
 * @author Reetabrata Bhandari (Jim Fleax)
 */
import React, { useState, useEffect } from "react";
import { Play, Pause, Stop, ArrowSquareOut, ShieldCheck, Warning } from "@phosphor-icons/react";
import { Button } from "../ui/components/Button.tsx";

/**
 * Extension popup toolbar component displaying automation status, account metrics, and workflow toggles.
 */
export function PopupApp(): React.JSX.Element {
  const [isOnInstagram, setIsOnInstagram] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const [status, setStatus] = useState("Idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [engineMode, setEngineMode] = useState("hybrid");
  const [engagementMode, setEngagementMode] = useState("both");
  const [detectedUser, setDetectedUser] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [sessionChecked, setSessionChecked] = useState(0);
  const [maxPosts, setMaxPosts] = useState(50);
  const [metrics, setMetrics] = useState({ likesNew: 0, likesAlready: 0, commentsNew: 0, commentsAlready: 0, totalErrors: 0 });
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    async function checkTab() {
      if (typeof chrome === "undefined" || !chrome.tabs) return;
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes("instagram.com")) {
          setIsOnInstagram(true);
          setTabId(tab.id || null);
          if (tab.id) fetchStatus(tab.id);
        } else {
          setIsOnInstagram(false);
        }
      } catch (err) {
        console.error("Tab query failed:", err);
      }
    }

    checkTab();
    const interval = setInterval(() => {
      if (tabId) fetchStatus(tabId);
    }, 1500);

    return () => clearInterval(interval);
  }, [tabId]);

  function fetchStatus(targetTabId: number) {
    if (!targetTabId || typeof chrome === "undefined") return;
    (chrome.tabs.sendMessage as any)(targetTabId, { action: "GET_STATUS" }, (res: any) => {
      if (chrome.runtime.lastError || !res) return;
      setStatus(res.status || "Idle");
      setStatusDetail(res.statusDetail || "");
      setEngineMode(res.engineMode || "hybrid");
      setEngagementMode(res.engagementMode || "both");
      setDetectedUser(res.detectedUsername || "");
      setTargetUser(res.targetUsername || "");
      setSessionChecked(res.sessionChecked || 0);
      setMaxPosts(res.maxPosts || 50);
      setMetrics(res.metrics || {});
      setDiagnostics(res.diagnostics);
      setIsVisible(Boolean(res.isVisible));
    });
  }

  function handleToggleModal() {
    if (!tabId || typeof chrome === "undefined") return;
    (chrome.tabs.sendMessage as any)(tabId, { action: "TOGGLE_MODAL" }, (res: any) => {
      if (!chrome.runtime.lastError && res && res.isVisible !== undefined) {
        setIsVisible(res.isVisible);
      } else {
        fetchStatus(tabId);
      }
    });
  }

  function sendTabAction(action: string) {
    if (!tabId || typeof chrome === "undefined") return;
    (chrome.tabs.sendMessage as any)(tabId, { action }, () => {
      fetchStatus(tabId);
    });
  }

  const getStatusDot = (st: string) => {
    switch (st) {
      case "Running": return "bg-blue-500 animate-pulse";
      case "Calibrating": return "bg-amber-500 animate-pulse";
      case "Paused": return "bg-amber-500";
      case "Stopped": return "bg-rose-500";
      case "Completed": return "bg-sky-400";
      default: return "bg-slate-400";
    }
  };

  const domHealth = diagnostics?.overallHealthScore ?? 95;
  const pct = Math.min(100, Math.round((sessionChecked / maxPosts) * 100));

  if (!isOnInstagram) {
    return (
      <div className="p-4 w-[330px] font-sans text-slate-900 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="ig-gradient-logo">IG</div>
          <div>
            <div className="font-bold text-xs text-slate-900">Instagram Automator</div>
            <div className="text-[10px] text-slate-500">Extension Standby</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center flex flex-col items-center gap-2.5">
          <p className="text-xs text-slate-600 font-medium">Please navigate to Instagram to use the automator.</p>
          <Button
            variant="default"
            size="sm"
            onClick={() => chrome.tabs.create({ url: "https://www.instagram.com/" })}
            className="gap-1.5"
          >
            <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
            <span>Open Instagram.com</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-[330px] font-sans text-slate-900 bg-white select-none">
      {/* Header with clean text status */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="ig-gradient-logo">IG</div>
          <div>
            <div className="font-bold text-xs text-slate-900">IG Automator</div>
            <div className="text-[10px] text-slate-500">Engagement Suite</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className={`w-2 h-2 rounded-full ${getStatusDot(status)}`} />
          <span>{status}</span>
        </div>
      </div>

      {/* Action Block Safety Alert Banner */}
      {statusDetail.includes("Action Block") && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded-xl mb-3 flex items-start gap-2">
          <Warning className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
          <div className="min-w-0">
            <div className="font-bold">Action Block Triggered</div>
            <div className="text-[11px] leading-tight text-rose-600 mt-0.5">
              Instagram rate limited this action. The automator has stopped to safeguard your account.
            </div>
          </div>
        </div>
      )}

      {/* Account & Progress Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Account</span>
          <span className="font-semibold text-slate-900">{detectedUser ? `@${detectedUser}` : "Auto-detect"}</span>
        </div>
        {targetUser && (
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">Target</span>
            <span className="font-semibold text-blue-700">@{targetUser}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Engine</span>
          <span className="font-semibold text-blue-600">
            {engineMode === "api" ? "Direct API (Headless)" : engineMode === "dom" ? "DOM Simulation" : "Hybrid Engine"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Mode</span>
          <span className="font-semibold text-slate-800 capitalize">
            {engagementMode === "both" ? "Like & Comment" : engagementMode.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-500">DOM Health</span>
          <span className="font-semibold text-blue-600 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" weight="bold" />
            {domHealth}% Optimal
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
          <span>Target Progress</span>
          <span>{sessionChecked} / {maxPosts} ({pct}%)</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2">
          <div className="text-sm font-bold text-slate-900">{(metrics.likesNew || 0) + (metrics.likesAlready || 0)}</div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Likes</div>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2">
          <div className="text-sm font-bold text-slate-900">{(metrics.commentsNew || 0) + (metrics.commentsAlready || 0)}</div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Comments</div>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2">
          <div className="text-sm font-bold text-slate-900">{metrics.totalErrors || 0}</div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Retries</div>
        </div>
      </div>

      {/* Modal Visibility Toggle Button */}
      <div className="flex flex-col gap-2">
        <Button
          variant={isVisible ? "outline" : "default"}
          onClick={handleToggleModal}
          className="w-full justify-center font-semibold"
        >
          {isVisible ? "Hide In-Page Suite" : "Show In-Page Suite"}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          {status === "Running" ? (
            <Button variant="outline" onClick={() => sendTabAction("PAUSE_WORKFLOW")} className="gap-1 justify-center">
              <Pause className="w-3.5 h-3.5" weight="fill" />
              <span>Pause</span>
            </Button>
          ) : status === "Paused" ? (
            <Button variant="default" onClick={() => sendTabAction("RESUME_WORKFLOW")} className="gap-1 justify-center">
              <Play className="w-3.5 h-3.5" weight="fill" />
              <span>Continue</span>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => sendTabAction("START_WORKFLOW")} className="gap-1 justify-center">
              <Play className="w-3.5 h-3.5" weight="fill" />
              <span>Start</span>
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={() => sendTabAction("STOP_WORKFLOW")}
            disabled={status !== "Running" && status !== "Paused"}
            className="gap-1 justify-center"
          >
            <Stop className="w-3 h-3" weight="fill" />
            <span>Stop</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <div>
          Shortcut: <kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-mono text-[9px]">Alt+Shift+I</kbd>
        </div>
        <div>
          By{" "}
          <a
            href="https://jimfleax.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 font-semibold hover:underline hover:text-blue-700 transition-colors"
          >
            Reetabrata Bhandari
          </a>
        </div>
      </div>
    </div>
  );
}
