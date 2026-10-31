/**
 * @file App.tsx
 * @description Renders the primary floating automation overlay suite, configuration panels, history viewer, and diagnostic monitors.
 * @architecture Serves as the central React interface embedded in the content script Shadow DOM, subscribing directly to WorkflowEngine state snapshots.
 * @agent_note Complex state synchronization occurs via workflow.subscribe; avoid local state mutations that desynchronize from engine storage.
 * @author Reetabrata Bhandari (Jim Fleax)
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ChatCircle,
  Play,
  Pause,
  Stop,
  Pulse,
  SlidersHorizontal,
  ClockCounterClockwise,
  FileCsv,
  ArrowsIn,
  ArrowsOut,
  X,
  MagnifyingGlass,
  ShieldCheck,
  ArrowsClockwise,
  Warning,
  UploadSimple,
  DownloadSimple,
  Sparkle,
  Info,
} from "@phosphor-icons/react";

import { Button } from "./components/Button.tsx";
import { Card, CardContent } from "./components/Card.tsx";
import { TabsList, TabsTrigger, TabsContent } from "./components/Tabs.tsx";
import { Progress } from "./components/Progress.tsx";
import { DiagnosticCard } from "./components/DiagnosticCard.tsx";
import { AboutTab } from "./components/AboutTab.tsx";
import { parseSpintax } from "../core/comment-deck.ts";
import { exportToCSV } from "../core/db.ts";
import { StorageService, DEFAULT_SETTINGS } from "../core/storage.ts";
import { WorkflowEngine } from "../core/workflow.ts";
import confetti from "canvas-confetti";

export interface AppProps {
  workflow: WorkflowEngine;
}

/**
 * Main application overlay component providing tabs for control, configuration, activity history, diagnostics, and about metadata.
 */
export function App({ workflow }: AppProps): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState(() => workflow.getStateSnapshot());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [spintaxPreview, setSpintaxPreview] = useState("");

  // Form local state for settings
  const [formSettings, setFormSettings] = useState(() => ({
    commentPool: workflow.config.commentPool.join("\n"),
    myUsername: workflow.config.myUsername || "",
    targetUsername: workflow.config.targetUsername || "",
    engineMode: workflow.config.engineMode || "hybrid",
    engagementMode: workflow.config.engagementMode || "both",
    likeProbability: workflow.config.likeProbability ?? 100,
    commentProbability: workflow.config.commentProbability ?? 100,
    maxPostsToProcess: workflow.config.maxPostsToProcess,
    minActionDelayMs: workflow.config.minActionDelayMs || 1200,
    maxActionDelayMs: workflow.config.maxActionDelayMs || 2500,
    minPostDelayMs: workflow.config.minPostDelayMs,
    maxPostDelayMs: workflow.config.maxPostDelayMs,
    maxRetries: workflow.config.maxRetries,
    retryDelayMs: workflow.config.retryDelayMs,
    skipIfAlreadyCommented: workflow.config.skipIfAlreadyCommented,
    autoSelfHealDOM: workflow.config.autoSelfHealDOM ?? true,
  }));

  // Subscribe to workflow state updates
  useEffect(() => {
    return workflow.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });
  }, [workflow]);

  // Celebratory Milestone Confetti on Goal Completion
  useEffect(() => {
    if (snapshot.state.status === "Completed" && snapshot.state.sessionChecked > 0) {
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.65 } });
      } catch (_) {}
    }
  }, [snapshot.state.status, snapshot.state.sessionChecked]);

  // Auto-refresh page context whenever modal becomes visible
  useEffect(() => {
    if (snapshot.prefs.isVisible && workflow?.refreshPageContext) {
      workflow.refreshPageContext();
    }
  }, [snapshot.prefs.isVisible, workflow]);

  // Synchronize formSettings with updated target or detected user on page/context changes
  useEffect(() => {
    const target = snapshot.state.targetUsername || snapshot.config.targetUsername || "";
    if (target && target !== formSettings.targetUsername) {
      setFormSettings((prev) => ({
        ...prev,
        targetUsername: target,
      }));
    }
    const detected = snapshot.state.detectedUsername || snapshot.config.myUsername || "";
    if (detected && !formSettings.myUsername) {
      setFormSettings((prev) => ({
        ...prev,
        myUsername: detected,
      }));
    }
  }, [snapshot.state.targetUsername, snapshot.config.targetUsername, snapshot.state.detectedUsername]);

  const { state, config, prefs } = snapshot;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleTabChange = (tabKey: string) => {
    workflow.setTab(tabKey);
  };

  const toggleMinimize = () => {
    if (!workflow) return;
    if (!workflow.prefs) workflow.prefs = { isMinimized: false, isVisible: true, activeTab: "dashboard", isDocked: false };
    workflow.prefs.isMinimized = !workflow.prefs.isMinimized;
    StorageService.savePrefs(workflow.prefs);
    workflow.broadcast();
  };

  const closeModal = () => {
    if (workflow && typeof workflow.hideModal === "function") {
      workflow.hideModal();
    } else if (workflow && workflow.prefs) {
      workflow.prefs.isVisible = false;
      StorageService.savePrefs(workflow.prefs);
      workflow.broadcast();
    }
  };

  const handleSaveSettings = async () => {
    const pool = formSettings.commentPool
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated = {
      ...workflow.config,
      commentPool: pool.length > 0 ? pool : ["🔥🔥"],
      myUsername: formSettings.myUsername.trim(),
      targetUsername: formSettings.targetUsername.trim().toLowerCase().replace(/^@|^\/+|\/+$/g, ""),
      engineMode: formSettings.engineMode || "hybrid",
      engagementMode: formSettings.engagementMode || "both",
      likeProbability: Math.min(100, Math.max(0, parseInt(String(formSettings.likeProbability), 10) ?? 100)),
      commentProbability: Math.min(100, Math.max(0, parseInt(String(formSettings.commentProbability), 10) ?? 100)),
      maxPostsToProcess: Math.max(1, parseInt(String(formSettings.maxPostsToProcess), 10) || 50),
      minActionDelayMs: Math.max(500, parseInt(String(formSettings.minActionDelayMs), 10) || 1200),
      maxActionDelayMs: Math.max(
        parseInt(String(formSettings.minActionDelayMs), 10) || 1200,
        parseInt(String(formSettings.maxActionDelayMs), 10) || 2500
      ),
      minPostDelayMs: Math.max(1000, parseInt(String(formSettings.minPostDelayMs), 10) || 4500),
      maxPostDelayMs: Math.max(
        parseInt(String(formSettings.minPostDelayMs), 10) || 4500,
        parseInt(String(formSettings.maxPostDelayMs), 10) || 8500
      ),
      maxRetries: Math.min(10, Math.max(1, parseInt(String(formSettings.maxRetries), 10) || 3)),
      retryDelayMs: Math.max(500, parseInt(String(formSettings.retryDelayMs), 10) || 2000),
      skipIfAlreadyCommented: formSettings.skipIfAlreadyCommented,
      autoSelfHealDOM: formSettings.autoSelfHealDOM,
    };

    workflow.config = updated;
    await workflow.storage.saveSettings(updated);
    workflow.syncDetectedUsername();
    workflow.broadcast("Settings saved successfully");
    showToast("Settings saved!");
  };

  const handleResetDefaults = async () => {
    const defaults = StorageService.clone(DEFAULT_SETTINGS);
    workflow.config = defaults;
    await workflow.storage.saveSettings(workflow.config);
    setFormSettings({
      commentPool: defaults.commentPool.join("\n"),
      myUsername: defaults.myUsername,
      targetUsername: defaults.targetUsername,
      engineMode: defaults.engineMode,
      engagementMode: defaults.engagementMode,
      likeProbability: defaults.likeProbability,
      commentProbability: defaults.commentProbability,
      maxPostsToProcess: defaults.maxPostsToProcess,
      minActionDelayMs: defaults.minActionDelayMs,
      maxActionDelayMs: defaults.maxActionDelayMs,
      minPostDelayMs: defaults.minPostDelayMs,
      maxPostDelayMs: defaults.maxPostDelayMs,
      maxRetries: defaults.maxRetries,
      retryDelayMs: defaults.retryDelayMs,
      skipIfAlreadyCommented: defaults.skipIfAlreadyCommented,
      autoSelfHealDOM: defaults.autoSelfHealDOM,
    });
    setSpintaxPreview("");
    workflow.syncDetectedUsername();
    workflow.broadcast("Settings reset to defaults");
    showToast("Defaults restored!");
  };

  const handlePreviewSpintax = () => {
    const pool = formSettings.commentPool
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (pool.length === 0) {
      setSpintaxPreview("🔥🔥");
      return;
    }
    const template = pool[Math.floor(Math.random() * pool.length)];
    const author = formSettings.targetUsername || state.detectedUsername || "creator";
    const resolved = parseSpintax(template, { author });
    setSpintaxPreview(resolved);
  };

  const handleAutoDetectSession = () => {
    const session = StorageService.resolveSessionProfile();
    const updatedTarget = session.targetUsername || formSettings.targetUsername;
    const updatedMy = session.myUsername || formSettings.myUsername;

    setFormSettings((prev) => ({
      ...prev,
      targetUsername: updatedTarget,
      myUsername: updatedMy,
    }));

    if (session.targetUsername || session.myUsername) {
      const parts = [
        session.targetUsername ? `Target: @${session.targetUsername}` : null,
        session.myUsername ? `You: @${session.myUsername}` : null,
      ].filter(Boolean);
      showToast(`Detected: ${parts.join(" • ")}`);
    } else {
      showToast("No profile handle found on current page");
    }
  };

  const handleExportSettingsJSON = () => {
    const data = JSON.stringify(workflow.config, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ig-automator-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Settings exported to JSON!");
  };

  const handleImportSettingsJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed && typeof parsed === "object") {
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          workflow.config = merged;
          await workflow.storage.saveSettings(merged);
          setFormSettings({
            commentPool: Array.isArray(merged.commentPool) ? merged.commentPool.join("\n") : "🔥🔥",
            myUsername: merged.myUsername || "",
            targetUsername: merged.targetUsername || "",
            engineMode: merged.engineMode || "hybrid",
            engagementMode: merged.engagementMode || "both",
            likeProbability: merged.likeProbability ?? 100,
            commentProbability: merged.commentProbability ?? 100,
            maxPostsToProcess: merged.maxPostsToProcess || 50,
            minActionDelayMs: merged.minActionDelayMs || 1200,
            maxActionDelayMs: merged.maxActionDelayMs || 2500,
            minPostDelayMs: merged.minPostDelayMs || 4500,
            maxPostDelayMs: merged.maxPostDelayMs || 8500,
            maxRetries: merged.maxRetries || 3,
            retryDelayMs: merged.retryDelayMs || 2000,
            skipIfAlreadyCommented: Boolean(merged.skipIfAlreadyCommented),
            autoSelfHealDOM: Boolean(merged.autoSelfHealDOM),
          });
          workflow.syncDetectedUsername();
          workflow.broadcast("Settings imported from JSON");
          showToast("Settings imported successfully!");
        }
      } catch (err) {
        showToast("Invalid JSON settings file");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset file input
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your local engagement history?")) {
      workflow.clearHistory();
      showToast("History cleared!");
    }
  };

  const handleTriggerCalibration = async () => {
    setIsCalibrating(true);
    await workflow.runCalibration();
    setIsCalibrating(false);
    showToast("DOM Diagnostics complete!");
  };

  const handleExportCSV = () => {
    const csvContent = "\uFEFF" + exportToCSV(state.records);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `instagram-automation-report-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV report downloaded!");
  };

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

  // Filtered action records
  const filteredRecords = useMemo(() => {
    let list = state.records;
    if (historyFilter === "liked") list = list.filter((r) => r.likeStatus === "Liked");
    if (historyFilter === "commented") list = list.filter((r) => r.commentStatus === "Commented");
    if (historyFilter === "skips") list = list.filter((r) => r.likeStatus.includes("Already") || r.commentStatus.includes("Already"));
    if (historyFilter === "errors") list = list.filter((r) => r.errorsCount > 0);

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter((r) => (r.postPath || "").toLowerCase().includes(q) || (r.commentText || "").toLowerCase().includes(q));
    }
    return list.slice(-80).reverse();
  }, [state.records, historyFilter, historySearch]);

  const totalOps = state.records.length * 2;
  const failedOps = state.metrics.likesFailed + state.metrics.commentsFailed;
  const successRate = totalOps > 0 ? Math.max(0, Math.round(((totalOps - failedOps) / totalOps) * 100)) : 100;
  const domHealth = state.diagnostics?.overallHealthScore ?? 95;

  // IMPORTANT: Keep hidden by default; only mount if isVisible is true
  if (!prefs.isVisible) return null;

  return (
    <div className={`suite-backdrop ${prefs.isMinimized ? "minimized" : ""}`}>
      <AnimatePresence mode="wait">
        {/* Minimized Floating Pill Indicator */}
        {prefs.isMinimized ? (
          <motion.div
            key="floating-pill"
            className="floating-pill"
            onClick={toggleMinimize}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          >
            <span className={`pulse-dot ${state.status}`} />
            <span>
              {state.status} • {state.sessionChecked}/{config.maxPostsToProcess} Posts
            </span>
            <ArrowsOut className="w-3.5 h-3.5 ml-1 opacity-70" weight="bold" />
          </motion.div>
        ) : (
          /* Expanded Main Modal */
          <motion.div
            key="suite-modal"
            className="suite-modal"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {/* Header with clean typography & blue accents */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="ig-gradient-logo">IG</div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-slate-900">Instagram Engagement Automator</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${getStatusDot(state.status)}`} />
                      <span>{state.status}</span>
                    </div>
                  </div>
                  {(state.targetUsername || config.targetUsername) && (
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>Target: <strong className="text-blue-700 font-semibold">@{state.targetUsername || config.targetUsername}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    const res = await workflow.refreshPageContext(true);
                    showToast(res.targetUsername ? `Synced: @${res.targetUsername}` : "Refreshed page context");
                  }}
                  title="Sync with active page profile"
                >
                  <ArrowsClockwise className="w-4 h-4 text-slate-600 hover:text-blue-600 transition-colors" weight="bold" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleMinimize} title="Minimize to floating pill">
                  <ArrowsIn className="w-4 h-4 text-slate-600 hover:text-blue-600 transition-colors" weight="bold" />
                </Button>
                <Button variant="ghost" size="icon" onClick={closeModal} title="Hide Suite">
                  <X className="w-4 h-4 text-slate-600 hover:text-rose-600 transition-colors" weight="bold" />
                </Button>
              </div>
            </div>

          {/* Segmented Tab Strip */}
          <TabsList>
            <TabsTrigger
              value="dashboard"
              activeTab={prefs.activeTab}
              onClick={handleTabChange}
              icon={Pulse}
            >
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="diagnostics"
              activeTab={prefs.activeTab}
              onClick={handleTabChange}
              icon={ShieldCheck}
            >
              DOM Discovery
            </TabsTrigger>
            <TabsTrigger
              value="history"
              activeTab={prefs.activeTab}
              onClick={handleTabChange}
              icon={ClockCounterClockwise}
            >
              History
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              activeTab={prefs.activeTab}
              onClick={handleTabChange}
              icon={SlidersHorizontal}
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="about"
              activeTab={prefs.activeTab}
              onClick={handleTabChange}
              icon={Info}
            >
              About
            </TabsTrigger>
          </TabsList>

          {/* Body Content Area */}
          <div className="max-h-[58vh] overflow-y-auto">
            {/* TAB 1: DASHBOARD */}
            <TabsContent value="dashboard" activeTab={prefs.activeTab}>
              {/* Status Message Banner with clean typography */}
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/70 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-xs text-slate-700 font-medium truncate">{state.statusDetail}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium shrink-0">
                  <span className="text-blue-700 font-semibold bg-blue-100/70 px-2 py-0.5 rounded-md">{domHealth}% System Health</span>
                </div>
              </div>

              {/* Progress Section */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Session Target</span>
                  <span>
                    {state.sessionChecked} / {config.maxPostsToProcess} Posts (
                    {Math.min(100, Math.round((state.sessionChecked / config.maxPostsToProcess) * 100))}%)
                  </span>
                </div>
                <Progress value={state.sessionChecked} max={config.maxPostsToProcess} />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Checked</span>
                    <div className="text-xl font-bold text-slate-900 mt-1">{state.sessionChecked}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Goal: {config.maxPostsToProcess} posts</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Likes</span>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {state.metrics.likesNew + state.metrics.likesAlready}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      <span className="text-blue-600 font-semibold">+{state.metrics.likesNew} new</span> • {state.metrics.likesAlready} skipped
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Comments</span>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {state.metrics.commentsNew + state.metrics.commentsAlready}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      <span className="text-blue-600 font-semibold">+{state.metrics.commentsNew} new</span> • {state.metrics.commentsAlready} skipped
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reliability</span>
                    <div className="text-xl font-bold text-slate-900 mt-1">{successRate}%</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {state.metrics.totalErrors} retries logged
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 2: DIAGNOSTICS & DOM HEALTH */}
            <TabsContent value="diagnostics" activeTab={prefs.activeTab}>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">Self-Healing DOM Discovery</span>
                  <span className="text-xs font-semibold text-blue-600">({domHealth}% Confidence)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTriggerCalibration}
                  disabled={isCalibrating}
                  className="gap-1.5"
                >
                  <ArrowsClockwise className={`w-3.5 h-3.5 ${isCalibrating ? "animate-spin" : ""}`} weight="bold" />
                  <span>{isCalibrating ? "Scanning..." : "Run Diagnostics"}</span>
                </Button>
              </div>

              {/* Anchors Grid */}
              <div className="grid grid-cols-2 gap-3">
                {state.diagnostics?.anchors &&
                  Object.entries(state.diagnostics.anchors).map(([key, data]) => (
                    <DiagnosticCard key={key} anchorKey={key} data={data} />
                  ))}
              </div>

              {(state.diagnostics as any)?.apiValidation && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-700 bg-white border border-slate-200/80 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        workflow.network.isGraphQLArmed("like")
                          ? "bg-blue-500"
                          : (state.diagnostics as any).apiValidation.isAvailable === false
                          ? "bg-amber-500"
                          : (state.diagnostics as any).apiValidation.isReady
                          ? "bg-sky-500"
                          : "bg-slate-400"
                      }`}
                    />
                    <span className="font-semibold text-slate-900">Headless GraphQL Gateway:</span>
                    <span className="font-mono text-[10px] text-slate-600">
                      {workflow.network.isGraphQLArmed("like")
                        ? `doc_id: ${workflow.network.capturedMutations.like!.docId.slice(0, 8)}...`
                        : `CSRF ${(state.diagnostics as any).apiValidation.csrfTokenSnippet}`}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${
                      workflow.network.isGraphQLArmed("like")
                        ? "text-blue-600"
                        : "text-amber-600 font-medium"
                    }`}
                  >
                    {workflow.network.isGraphQLArmed("like")
                      ? "GraphQL Active (Sniffed)"
                      : "Hybrid Kickstart Ready (DOM Post 1)"}
                  </span>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: ACTION HISTORY */}
            <TabsContent value="history" activeTab={prefs.activeTab}>
              <div className="flex items-center justify-between gap-2 mb-3">
                {/* Segmented Filter */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70">
                  {[
                    { key: "all", label: "All" },
                    { key: "liked", label: "Likes" },
                    { key: "commented", label: "Comments" },
                    { key: "skips", label: "Skips" },
                    { key: "errors", label: "Errors" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setHistoryFilter(tab.key)}
                      className={`px-3 py-1 text-xs rounded-md cursor-pointer font-medium transition-colors ${
                        historyFilter === tab.key
                           ? "bg-white text-blue-700 font-semibold shadow-xs border border-blue-100/80"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleClearHistory}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
                    <FileCsv className="w-3.5 h-3.5" weight="bold" />
                    <span>CSV</span>
                  </Button>
                </div>
              </div>

              {/* History Search */}
              <div className="mb-3 relative">
                <input
                  type="text"
                  placeholder="Filter history by post path or comment text..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="suite-input pl-8 text-xs"
                />
                <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" weight="bold" />
              </div>

              {/* History List */}
              <div className="flex flex-col gap-2 max-h-[34vh] overflow-y-auto pr-1">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">No records matching query.</div>
                ) : (
                  filteredRecords.map((r, i) => (
                    <motion.div
                      key={r.postPath || i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="history-item"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <a
                          href={r.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-xs text-slate-900 hover:text-blue-600 transition-colors truncate"
                        >
                          {r.postPath}
                        </a>
                        <span className="text-[10px] text-slate-400">{r.timeFormatted}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs text-slate-700">
                        {/* Like Indicator */}
                        <span className="flex items-center gap-1 font-medium">
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              r.likeStatus === "Liked"
                                ? "text-rose-500"
                                : r.likeStatus.includes("Already")
                                ? "text-blue-500"
                                : "text-slate-400"
                            }`}
                            weight={r.likeStatus === "Liked" ? "fill" : "regular"}
                          />
                          <span>{r.likeStatus}</span>
                        </span>

                        {/* Comment Indicator */}
                        <span className="flex items-center gap-1 font-medium max-w-[210px] truncate">
                          <ChatCircle
                            className={`w-3.5 h-3.5 shrink-0 ${
                              r.commentStatus === "Commented"
                                ? "text-blue-600"
                                : r.commentStatus.includes("Already")
                                ? "text-blue-500"
                                : "text-slate-400"
                            }`}
                            weight={r.commentStatus === "Commented" ? "fill" : "regular"}
                          />
                          <span className="truncate">
                            {r.commentStatus === "Commented" ? `"${r.commentText}"` : r.commentStatus}
                          </span>
                        </span>

                        {r.errorsCount > 0 && (
                          <span className="flex items-center gap-0.5 text-rose-600 font-semibold">
                            <Warning className="w-3.5 h-3.5" weight="fill" />
                            <span>{r.errorsCount}</span>
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TAB 4: SETTINGS */}
            <TabsContent value="settings" activeTab={prefs.activeTab}>
              <div className="flex flex-col gap-3.5">
                {/* Execution Engine Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Execution Engine
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                    {[
                      { key: "hybrid", label: "⚡ Hybrid Engine" },
                      { key: "api", label: "🚀 Direct API" },
                      { key: "dom", label: "🖱️ DOM Simulation" },
                    ].map((eng) => (
                      <button
                        key={eng.key}
                        type="button"
                        onClick={() => setFormSettings({ ...formSettings, engineMode: eng.key as any })}
                        className={`py-1.5 px-2 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                          formSettings.engineMode === eng.key
                            ? "bg-white text-blue-700 font-semibold shadow-xs border border-blue-100"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {eng.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Engagement Mode Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Engagement Mode
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                    {[
                      { key: "both", label: "Like & Comment" },
                      { key: "like_only", label: "Like Only" },
                      { key: "comment_only", label: "Comment Only" },
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setFormSettings({ ...formSettings, engagementMode: mode.key as any })}
                        className={`py-1.5 px-2 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                          formSettings.engagementMode === mode.key
                            ? "bg-white text-blue-700 font-semibold shadow-xs border border-blue-100"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Probability Sliders */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>Like Probability</span>
                      <span className="font-bold text-slate-900">{formSettings.likeProbability}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formSettings.likeProbability}
                      disabled={formSettings.engagementMode === "comment_only"}
                      onChange={(e) => setFormSettings({ ...formSettings, likeProbability: parseInt(e.target.value, 10) })}
                      className="w-full cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>Comment Probability</span>
                      <span className="font-bold text-slate-900">{formSettings.commentProbability}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formSettings.commentProbability}
                      disabled={formSettings.engagementMode === "like_only"}
                      onChange={(e) => setFormSettings({ ...formSettings, commentProbability: parseInt(e.target.value, 10) })}
                      className="w-full cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* Comment Pool with Spintax & Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-800">
                      Comment Pool & Spintax Templates
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Supports {"{A|B}"}, {"{author}"}, {"{emoji}"}
                    </span>
                  </div>
                  <textarea
                    value={formSettings.commentPool}
                    onChange={(e) => setFormSettings({ ...formSettings, commentPool: e.target.value })}
                    className="suite-textarea"
                    placeholder="Enter one template per line, e.g. {Love|Awesome} this shot @{author}! {emoji}"
                  />

                  {/* Spintax Live Tester */}
                  <div className="mt-1.5 flex items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkle className="w-3.5 h-3.5 text-blue-500 shrink-0" weight="fill" />
                      <span className="text-[11px] text-slate-600 truncate">
                        {spintaxPreview ? `Preview: "${spintaxPreview}"` : "Click to test sample comment output"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePreviewSpintax}
                      className="px-2 py-1 bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 text-[11px] font-semibold rounded border border-slate-200 cursor-pointer shrink-0 transition-colors"
                    >
                      Sample Output
                    </button>
                  </div>
                </div>

                {/* Account Profiles */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      Account Profiles & Session Sync
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoDetectSession}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1 transition-colors"
                      title="Auto-detect current page profile and logged-in account from session"
                    >
                      <ArrowsClockwise className="w-3 h-3" weight="bold" />
                      <span>Auto-Detect from Page</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Target Profile (@)</label>
                      <input
                        type="text"
                        placeholder="e.g. natgeo"
                        value={formSettings.targetUsername}
                        onChange={(e) => setFormSettings({ ...formSettings, targetUsername: e.target.value })}
                        className="suite-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Your Account (@)</label>
                      <input
                        type="text"
                        placeholder="Leave blank to auto-detect"
                        value={formSettings.myUsername}
                        onChange={(e) => setFormSettings({ ...formSettings, myUsername: e.target.value })}
                        className="suite-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Session Limits */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Posts per Session</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={formSettings.maxPostsToProcess}
                      onChange={(e) => setFormSettings({ ...formSettings, maxPostsToProcess: parseInt(e.target.value, 10) || 50 })}
                      className="suite-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Inter-Action Delay (ms)</label>
                    <input
                      type="number"
                      min="500"
                      step="250"
                      value={formSettings.minActionDelayMs}
                      onChange={(e) => setFormSettings({ ...formSettings, minActionDelayMs: parseInt(e.target.value, 10) || 1200 })}
                      className="suite-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Min Delay (ms)</label>
                    <input
                      type="number"
                      min="1000"
                      step="500"
                      value={formSettings.minPostDelayMs}
                      onChange={(e) => setFormSettings({ ...formSettings, minPostDelayMs: parseInt(e.target.value, 10) || 4500 })}
                      className="suite-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Delay (ms)</label>
                    <input
                      type="number"
                      min="1500"
                      step="500"
                      value={formSettings.maxPostDelayMs}
                      onChange={(e) => setFormSettings({ ...formSettings, maxPostDelayMs: parseInt(e.target.value, 10) || 8500 })}
                      className="suite-input"
                    />
                  </div>
                </div>

                {/* Safety Toggles */}
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="checkbox"
                    id="skipExisting"
                    checked={formSettings.skipIfAlreadyCommented}
                    onChange={(e) => setFormSettings({ ...formSettings, skipIfAlreadyCommented: e.target.checked })}
                    className="cursor-pointer accent-blue-600"
                  />
                  <label htmlFor="skipExisting" className="text-xs text-slate-700 cursor-pointer">
                    Skip posts already commented by you
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="selfHeal"
                    checked={formSettings.autoSelfHealDOM}
                    onChange={(e) => setFormSettings({ ...formSettings, autoSelfHealDOM: e.target.checked })}
                    className="cursor-pointer accent-blue-600"
                  />
                  <label htmlFor="selfHeal" className="text-xs text-slate-700 cursor-pointer">
                    Auto-heal selectors on Instagram DOM changes
                  </label>
                </div>

                {/* Actions & Backup Toolbar */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    <Button variant="default" onClick={handleSaveSettings}>
                      Save Settings
                    </Button>
                    <Button variant="secondary" onClick={handleResetDefaults}>
                      Reset Defaults
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportSettingsJSON}
                      title="Export Settings & Comment Pool to JSON file"
                      className="gap-1.5"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" weight="bold" />
                      <span>Export</span>
                    </Button>

                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportSettingsJSON}
                        className="hidden"
                      />
                      <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 hover:text-blue-700 transition-colors cursor-pointer">
                        <UploadSimple className="w-3.5 h-3.5" weight="bold" />
                        <span>Import</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: ABOUT & CREATOR */}
            <TabsContent value="about" activeTab={prefs.activeTab}>
              <AboutTab />
            </TabsContent>
          </div>

          {/* Footer Toolbar */}
          <div className="flex items-center justify-between p-3.5 border-t border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              {state.status === "Running" ? (
                <Button variant="outline" onClick={() => workflow.pause()} className="gap-1.5">
                  <Pause className="w-3.5 h-3.5" weight="fill" />
                  <span>Pause</span>
                </Button>
              ) : state.status === "Paused" ? (
                <Button variant="default" onClick={() => workflow.resume()} className="gap-1.5">
                  <Play className="w-3.5 h-3.5" weight="fill" />
                  <span>Continue</span>
                </Button>
              ) : (
                <Button
                  variant="primaryAction"
                  onClick={() => {
                    if (state.status === "Completed") {
                      workflow.state.sessionChecked = 0;
                    }
                    workflow.start();
                  }}
                  disabled={state.status === "Calibrating"}
                  className="gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" weight="fill" />
                  <span>{state.status === "Completed" ? "Run New Batch" : "Start Automation"}</span>
                </Button>
              )}

              <Button
                variant="destructive"
                onClick={() => workflow.stop()}
                disabled={state.status !== "Running" && state.status !== "Paused"}
                className="gap-1.5"
              >
                <Stop className="w-3 h-3" weight="fill" />
                <span>Stop</span>
              </Button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                By{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("about")}
                  className="text-blue-600 hover:text-blue-700 hover:underline font-semibold cursor-pointer transition-colors"
                  title="View Creator Details & About Extension"
                >
                  Reetabrata Bhandari
                </button>
              </span>
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
                <FileCsv className="w-3.5 h-3.5" weight="bold" />
                <span>Export Report</span>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Floating Spring Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="fixed bottom-6 right-6 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-blue-500/30 pointer-events-auto backdrop-blur-md"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
