/**
 * @file workflow.ts
 * @description Coordinates automated engagement lifecycles, orchestrating DOM scanning, API networking, kinetic actions, and UI state synchronization.
 * @architecture Serves as the central state machine and coordinator uniting storage, networking, DOM adapters, scheduling, and React view components.
 * @agent_note Central hub for execution flow; ensure error propagation properly updates metrics and halts on detection of Instagram action blocks.
 */
import { DOMScanner, type DiagnosticReport, type FeedPost } from "./scanner.ts";
import { InstagramDOMAdapter } from "./instagram-dom.ts";
import { BackgroundScheduler } from "./scheduler.ts";
import { CommentDeck } from "./comment-deck.ts";
import { InstagramNetworkEngine, shortcodeToMediaId } from "./network-engine.ts";
import { StorageService, DEFAULT_SETTINGS, DEFAULT_PREFS, type AutomationSettings, type UiPreferences } from "./storage.ts";
import { db, type EngagementRecord } from "./db.ts";

export type WorkflowStatus = "Idle" | "Calibrating" | "Running" | "Paused" | "Stopped" | "Completed";

export interface WorkflowMetrics {
  likesNew: number;
  likesAlready: number;
  likesFailed: number;
  commentsNew: number;
  commentsAlready: number;
  commentsFailed: number;
  totalErrors: number;
}

export interface WorkflowState {
  status: WorkflowStatus;
  statusDetail: string;
  detectedUsername: string;
  targetUsername: string;
  sessionChecked: number;
  consecutiveSkips: number;
  visitedShortcodes: Set<string>;
  records: EngagementRecord[];
  diagnostics: DiagnosticReport | null;
  metrics: WorkflowMetrics;
}

export interface WorkflowSnapshot {
  state: WorkflowState;
  config: AutomationSettings;
  prefs: UiPreferences;
}

/**
 * Central automation workflow state machine orchestrating navigation, like/comment operations, retries, and broadcasts.
 */
export class WorkflowEngine {
  scanner: DOMScanner;
  dom: InstagramDOMAdapter;
  scheduler: BackgroundScheduler;
  network: InstagramNetworkEngine;
  commentDeck: CommentDeck;
  config: AutomationSettings;
  prefs: UiPreferences;
  storage: typeof StorageService;
  listeners: Set<(snapshot: WorkflowSnapshot) => void>;
  isExecuting: boolean;
  state: WorkflowState;

  /**
   * Initializes engines, configuration defaults, state trackers, metrics, and subscriber sets.
   */
  constructor() {
    this.scanner = new DOMScanner();
    this.dom = new InstagramDOMAdapter(this.scanner);
    this.scheduler = new BackgroundScheduler();
    this.network = new InstagramNetworkEngine();
    this.commentDeck = new CommentDeck(() => this.config.commentPool);

    this.config = StorageService.clone(DEFAULT_SETTINGS);
    this.prefs = StorageService.clone(DEFAULT_PREFS);
    this.storage = StorageService;

    this.listeners = new Set();
    this.isExecuting = false;

    this.state = {
      status: "Idle",
      statusDetail: "Ready — open any profile grid, feed, or post and click Start",
      detectedUsername: "",
      targetUsername: "",
      sessionChecked: 0,
      consecutiveSkips: 0,
      visitedShortcodes: new Set<string>(),
      records: [],
      diagnostics: null,
      metrics: {
        likesNew: 0,
        likesAlready: 0,
        likesFailed: 0,
        commentsNew: 0,
        commentsAlready: 0,
        commentsFailed: 0,
        totalErrors: 0,
      },
    };
  }

  get isStopped(): boolean {
    return (this.state.status as string) === "Stopped";
  }

  get isPaused(): boolean {
    return (this.state.status as string) === "Paused";
  }

  /**
   * Asynchronously restores configuration, preferences, deck state, history records, and validates endpoints.
   */
  async init(): Promise<void> {
    this.config = await StorageService.loadSettings();
    this.prefs = await StorageService.loadPrefs();
    await this.commentDeck.init();

    // Auto-populate from session if not configured manually
    const sessionProfile = StorageService.resolveSessionProfile();
    if (!this.config.myUsername && sessionProfile.myUsername) {
      this.config.myUsername = sessionProfile.myUsername;
    }
    if (!this.config.targetUsername && sessionProfile.targetUsername) {
      this.config.targetUsername = sessionProfile.targetUsername;
    }

    const initialRecords = await StorageService.loadHistory<EngagementRecord[]>();
    this.state.records = initialRecords;
    this.state.visitedShortcodes = new Set<string>(
      initialRecords
        .map((r) => r.shortcode || this.dom.extractPostInfo(r.postPath)?.shortcode)
        .filter((sc): sc is string => Boolean(sc))
    );

    this.syncDetectedUsername();
    this.recomputeMetrics();

    // Restore cached GraphQL mutations from storage
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        const cached = await chrome.storage.local.get(["ig_harvested_mutations"]);
        if (cached?.ig_harvested_mutations) {
          if (cached.ig_harvested_mutations.like) {
            this.network.harvestSniffedMutation(cached.ig_harvested_mutations.like);
          }
          if (cached.ig_harvested_mutations.comment) {
            this.network.harvestSniffedMutation(cached.ig_harvested_mutations.comment);
          }
        }
      } catch (_) {}
    }

    // Initialize Network Engine
    await this.network.validateEndpoints();

    // Initial passive diagnostic scan
    this.state.diagnostics = await this.scanner.runFullDiagnostics(this.config.myUsername);
    this.broadcast();
  }

  /**
   * Subscribes a listener function to real-time state and configuration snapshot broadcasts.
   * @param listener - Callback receiving updated snapshot.
   * @returns Unsubscribe cleanup function.
   */
  subscribe(listener: (snapshot: WorkflowSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStateSnapshot());
    return () => this.listeners.delete(listener);
  }

  /**
   * Emits the current state snapshot to all registered listener callbacks.
   * @param detail - Optional status detail message.
   */
  broadcast(detail?: string): void {
    if (detail) this.state.statusDetail = detail;
    const snapshot = this.getStateSnapshot();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error("[IG Workflow Listener Error]", err);
      }
    });
  }

  /**
   * Returns an isolated snapshot of the current engine state, configuration, and UI preferences.
   * @returns Complete state snapshot.
   */
  getStateSnapshot(): WorkflowSnapshot {
    return {
      state: { ...this.state },
      config: { ...this.config },
      prefs: { ...this.prefs },
    };
  }

  /**
   * Toggles UI modal visibility between open and hidden states.
   * @returns Resulting visibility state.
   */
  async toggleVisibility(): Promise<boolean> {
    if (!this.prefs) this.prefs = { ...DEFAULT_PREFS };
    this.prefs.isVisible = !this.prefs.isVisible;
    if (this.prefs.isVisible) {
      this.prefs.isMinimized = false;
      await this.refreshPageContext();
    }
    StorageService.savePrefs(this.prefs);
    this.broadcast();
    return this.prefs.isVisible;
  }

  /**
   * Opens the UI modal and refreshes active page context.
   * @returns Always true when opened.
   */
  async showModal(): Promise<boolean> {
    if (!this.prefs) this.prefs = { ...DEFAULT_PREFS };
    this.prefs.isVisible = true;
    this.prefs.isMinimized = false;
    await this.refreshPageContext();
    StorageService.savePrefs(this.prefs);
    this.broadcast();
    return true;
  }

  /**
   * Hides the UI modal.
   * @returns Always false when closed.
   */
  hideModal(): boolean {
    if (!this.prefs) this.prefs = { ...DEFAULT_PREFS };
    this.prefs.isVisible = false;
    StorageService.savePrefs(this.prefs);
    this.broadcast();
    return false;
  }

  /**
   * Switches the active view tab in UI preferences.
   * @param tabKey - Target tab identifier.
   */
  setTab(tabKey: string): void {
    if (!this.prefs) this.prefs = { ...DEFAULT_PREFS };
    this.prefs.activeTab = tabKey;
    StorageService.savePrefs(this.prefs);
    this.broadcast();
  }

  /**
   * Refreshes active page context: auto-detects profile from URL/DOM,
   * updates target handle, resets stale session metrics on target change,
   * and refreshes DOM diagnostics.
   *
   * @param force - Force reset target if no profile detected.
   * @returns Refreshed context data.
   */
  async refreshPageContext(force = false): Promise<{ targetUsername: string; myUsername: string; diagnostics: DiagnosticReport | null }> {
    const session = StorageService.resolveSessionProfile();
    const currentTarget = (this.state.targetUsername || this.config.targetUsername || "").toLowerCase();
    const detectedTarget = (session.targetUsername || "").toLowerCase();

    // 1. Synchronize Logged-in Account
    if (session.myUsername) {
      this.state.detectedUsername = session.myUsername;
      if (!this.config.myUsername) {
        this.config.myUsername = session.myUsername;
      }
    } else {
      this.syncDetectedUsername();
    }

    // 2. Synchronize Target Profile
    let targetChanged = false;
    if (detectedTarget) {
      if (currentTarget !== detectedTarget) {
        targetChanged = true;
        this.state.targetUsername = detectedTarget;
        this.config.targetUsername = detectedTarget;
      }
    } else if (force) {
      this.state.targetUsername = "";
      this.config.targetUsername = "";
    }

    // 3. Clear Stale Session Counters if Target Changed
    if (targetChanged || (force && (this.state.status === "Completed" || this.state.status === "Stopped"))) {
      if (this.state.status === "Completed" || this.state.status === "Stopped") {
        this.state.status = "Idle";
        this.state.statusDetail = detectedTarget
          ? `Switched to @${detectedTarget} — ready to start`
          : this.dom.isFeedMode()
          ? "Ready — Home Feed detected (infinite scroll active)"
          : "Ready — open any profile grid, feed, or post and click Start";
        this.state.sessionChecked = 0;
        this.state.consecutiveSkips = 0;
      }
    }

    // 4. Live Passive DOM Diagnostics
    try {
      this.state.diagnostics = await this.scanner.runFullDiagnostics(this.config.myUsername);
    } catch (_) {}

    // 5. Broadcast fresh snapshot
    this.broadcast();
    return {
      targetUsername: this.state.targetUsername,
      myUsername: this.state.detectedUsername,
      diagnostics: this.state.diagnostics,
    };
  }

  /**
   * Synchronizes the detected user handle from DOM scanner into state.
   */
  syncDetectedUsername(): void {
    const probe = this.scanner.probeUserAccount(this.config.myUsername);
    this.state.detectedUsername = probe.handle || "";
  }

  /**
   * Recalculates aggregated like, comment, and error metrics from recorded history.
   */
  recomputeMetrics(): void {
    const records = this.state.records;
    this.state.metrics = {
      likesNew: records.filter((r) => r.likeStatus === "Liked").length,
      likesAlready: records.filter((r) => r.likeStatus === "Already Liked").length,
      likesFailed: records.filter((r) => r.likeStatus === "Failed").length,
      commentsNew: records.filter((r) => r.commentStatus === "Commented").length,
      commentsAlready: records.filter((r) => r.commentStatus === "Already Commented").length,
      commentsFailed: records.filter((r) => r.commentStatus === "Failed").length,
      totalErrors: records.reduce((acc, r) => acc + (Number(r.errorsCount) || 0), 0),
    };
  }

  /**
   * Clears session records, visited shortcode cache, and database entries.
   */
  clearHistory(): void {
    this.state.records = [];
    this.state.visitedShortcodes.clear();
    this.state.sessionChecked = 0;
    this.recomputeMetrics();
    db.clearAll();
    this.broadcast("Action history cleared");
  }

  /**
   * Executes pre-flight DOM discovery and network API diagnostics.
   * @returns Diagnostics health report.
   */
  async runCalibration(): Promise<DiagnosticReport> {
    this.broadcast("Running page discovery & API diagnostics...");
    const report = await this.scanner.runFullDiagnostics(this.config.myUsername);
    const apiValidation = await this.network.validateEndpoints();
    (report as any).apiValidation = apiValidation;
    this.state.diagnostics = report;
    this.syncDetectedUsername();
    this.broadcast(
      `Diagnostics: ${report.overallHealthScore}% DOM health • API ${apiValidation.isReady ? "Armed" : "Standby"}`
    );
    return report;
  }

  /**
   * Sleeps for a duration in cancellable chunks while checking pause and stop states.
   * @param ms - Milliseconds to sleep.
   * @returns True if waited successfully without stop.
   */
  async waitWithPauseCheck(ms: number): Promise<boolean> {
    let elapsed = 0;
    const step = 250;
    while (elapsed < ms) {
      if (this.isStopped) return false;
      while (this.isPaused) {
        const ok = await this.scheduler.sleep(250);
        if (!ok || this.isStopped) return false;
      }
      const chunk = Math.min(step, ms - elapsed);
      const ok = await this.scheduler.sleep(chunk);
      if (!ok) return false;
      elapsed += chunk;
    }
    return !this.isStopped;
  }

  /**
   * Polls a predicate function periodically until it returns truthy or times out.
   * @param predicateFn - Function to test repeatedly.
   * @param timeoutMs - Maximum duration in milliseconds to poll.
   * @param pollMs - Polling interval in milliseconds.
   * @returns Predicate result or false on timeout/stop.
   */
  async waitForCondition<T>(predicateFn: () => T, timeoutMs = 5000, pollMs = 200): Promise<T | false> {
    let elapsed = 0;
    while (elapsed < timeoutMs) {
      if (this.isStopped) return false;
      try {
        const res = predicateFn();
        if (res) return res;
      } catch (_) {}
      if (!(await this.waitWithPauseCheck(pollMs))) return false;
      elapsed += pollMs;
    }
    return false;
  }

  /**
   * Runs a pause-aware, randomized human delay with real-time UI countdown broadcasts.
   * @param min - Minimum delay in milliseconds.
   * @param max - Maximum delay in milliseconds.
   * @param label - Action description for status broadcasts.
   * @returns True if delay elapsed without stop.
   */
  async humanizedCooldown(min: number, max: number, label: string): Promise<boolean> {
    const total = this.scheduler.computeHumanDelayMs(min, max);
    let remaining = total;
    const step = 500;

    while (remaining > 0) {
      if (this.isStopped) return false;
      while (this.isPaused) {
        this.broadcast("Paused — click Continue to resume");
        const ok = await this.scheduler.sleep(250);
        if (!ok || this.isStopped) return false;
      }

      this.broadcast(`${label} (${(remaining / 1000).toFixed(1)}s)...`);
      const chunk = Math.min(step, remaining);
      const ok = await this.scheduler.sleep(chunk);
      if (!ok) return false;
      remaining -= chunk;
    }
    return !this.isStopped;
  }

  /**
   * Verifies or navigates to open the first post thumbnail modal from the current page.
   * In feed mode, locates and smoothly centers on the first unvisited feed post article.
   * @returns True if post view is confirmed open.
   */
  async ensureFirstPostOpened(): Promise<boolean> {
    // 1. Feed Mode: No modal needs to be opened; locate first unvisited feed post article
    if (this.dom.isFeedMode()) {
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        if (this.state.status === "Stopped") return false;

        this.broadcast(`Scanning feed for posts (Attempt ${attempt}/${this.config.maxRetries})...`);
        let feedPosts = this.dom.collectFeedPosts();

        if (feedPosts.length === 0) {
          if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
            window.scrollBy({ top: 500, behavior: "smooth" });
          }
          if (!(await this.waitWithPauseCheck(1200))) return false;
          feedPosts = this.dom.collectFeedPosts();
        }

        const unvisited =
          feedPosts.find((p) => !this.state.visitedShortcodes.has(p.shortcode)) || feedPosts[0];

        if (unvisited) {
          this.dom.setActiveFeedElement(unvisited.element);
          try {
            if (typeof unvisited.element.scrollIntoView === "function") {
              unvisited.element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch (_) {}
          await this.waitWithPauseCheck(700);
          return true;
        }

        const backoff = this.scheduler.computeBackoffMs(attempt, this.config.retryDelayMs);
        if (!(await this.waitWithPauseCheck(backoff))) return false;
      }

      this.broadcast("Error: Could not locate any posts in the feed.");
      return false;
    }

    // 2. Modal / Grid Mode
    if (this.dom.isPostViewOpen()) return true;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      if (this.state.status === "Stopped") return false;

      this.broadcast(`Scanning page for post thumbnails (Attempt ${attempt}/${this.config.maxRetries})...`);
      let gridLinks = this.dom.collectGridPostLinks();

      if (gridLinks.length === 0) {
        if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
          window.scrollBy({ top: 450, behavior: "smooth" });
        }
        if (!(await this.waitWithPauseCheck(1200))) return false;
        gridLinks = this.dom.collectGridPostLinks();
      }

      if (gridLinks.length > 0) {
        const target =
          gridLinks.find((item) => !this.state.visitedShortcodes.has(item.shortcode)) ||
          gridLinks[0];

        this.broadcast(`Opening post ${target.canonicalPath}...`);
        this.dom.triggerClick((target as any).element);

        const opened = await this.waitForCondition(() => this.dom.isPostViewOpen(), 4500, 250);
        if (opened) {
          await this.waitWithPauseCheck(700);
          return true;
        }
      }

      this.state.metrics.totalErrors++;
      const backoff = this.scheduler.computeBackoffMs(attempt, this.config.retryDelayMs);
      this.broadcast(`Post modal did not open on try ${attempt}, retrying...`);
      if (!(await this.waitWithPauseCheck(backoff))) return false;
    }

    this.broadcast("Error: Could not locate or open any post from current view.");
    return false;
  }

  /**
   * Executes the like step on a post record via Direct API or verified DOM interaction.
   * @param record - Current post engagement record.
   */
  async processLikeStep(record: EngagementRecord): Promise<void> {
    // Mode Gate
    if (this.config.engagementMode === "comment_only") {
      record.likeActionRequired = false;
      record.likeStatus = "Skipped (Mode)";
      return;
    }

    // Probability Gate
    if (this.config.likeProbability < 100) {
      const roll = Math.random() * 100;
      if (roll >= this.config.likeProbability) {
        record.likeActionRequired = false;
        record.likeStatus = "Skipped (Probability)";
        this.broadcast(`Skipped like on ${record.postPath} (Probability gate: ${this.config.likeProbability}%)`);
        return;
      }
    }

    // Branch 1: Direct Web API Engine (Headless or Hybrid primary)
    if ((this.config.engineMode === "api" || this.config.engineMode === "hybrid") && this.network.isAvailable) {
      const mediaId = record.mediaId || shortcodeToMediaId(record.shortcode);
      if (mediaId) {
        record.mediaId = mediaId;
        this.broadcast(`Liking ${record.postPath} (Direct API)...`);
        try {
          const res = await this.network.sendLike(mediaId);
          const challenge = this.network.checkChallenge(res);
          if (challenge) {
            this.state.status = "Stopped";
            this.broadcast(`🚨 Action Block: ${challenge}. Halted for account safety.`);
            return;
          }

          if (this.network.isEndpointDeprecated(res)) {
            this.network.markEndpointDeprecated(res.status, "Direct Like API endpoint retired / 404 Not Found");
            this.broadcast(`Direct API like endpoint 404 (deprecated by Instagram) — switching to DOM Simulation...`);
            // Seamlessly fall through to DOM simulation below
          } else if (res.ok && res.isConfirmedSuccess) {
            record.likeActionRequired = true;
            record.likeStatus = "Liked";
            this.state.metrics.likesNew++;
            this.broadcast();
            return;
          } else if (this.config.engineMode === "api") {
            if (this.dom.isPostViewOpen()) {
              this.broadcast(`Direct API like unconfirmed (${res.error || "no server confirmation"}), verifying via DOM...`);
              // Post modal is open, seamlessly fall through to DOM simulation below
            } else {
              record.likeStatus = "Failed";
              record.errorsCount++;
              record.errorDetails.push(`API Like error (status ${res.status}): ${res.error || res.data?.message || "unconfirmed by server"}`);
              this.state.metrics.likesFailed++;
              this.state.metrics.totalErrors++;
              this.broadcast();
              return;
            }
          }
        } catch (apiErr: any) {
          if (this.config.engineMode === "api") {
            if (this.dom.isPostViewOpen()) {
              this.broadcast(`API network exception (${apiErr.message}), verifying via DOM...`);
            } else {
              record.likeStatus = "Failed";
              record.errorsCount++;
              record.errorDetails.push(`API network exception: ${apiErr.message}`);
              this.state.metrics.likesFailed++;
              this.state.metrics.totalErrors++;
              this.broadcast();
              return;
            }
          }
          this.broadcast(`Direct API like unreachable, falling back to DOM simulation for ${record.postPath}...`);
        }
      }
    }

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      if (this.state.status === "Stopped") return;
      record.likeAttempts = attempt;

      try {
        // Pre-check for Action Block
        const blockProbe = this.scanner.probeActionBlock();
        if (blockProbe && blockProbe.isBlocked) {
          this.state.status = "Stopped";
          this.broadcast(`🚨 Action Block Detected: "${blockProbe.reason}". Automation halted for safety.`);
          return;
        }

        const root = this.dom.getModalRoot();
        if (!root) throw new Error("Post container missing");

        const likeProbe = this.dom.resolveLikeButton(root);
        if (!likeProbe) throw new Error("Action bar like button could not be identified");

        if (likeProbe.state === "liked") {
          if (attempt === 1) {
            record.likeActionRequired = false;
            record.likeStatus = "Already Liked";
            this.state.metrics.likesAlready++;
          } else {
            record.likeActionRequired = true;
            record.likeStatus = "Liked";
            this.state.metrics.likesNew++;
          }
          this.broadcast();
          return;
        }

        record.likeActionRequired = true;
        this.broadcast(`Liking ${record.postPath} (Try ${attempt}/${this.config.maxRetries})...`);

        this.dom.triggerClick(likeProbe.element);

        const verified = await this.waitForCondition(() => {
          const updatedRoot = this.dom.getModalRoot();
          if (!updatedRoot) return false;
          const updatedProbe = this.dom.resolveLikeButton(updatedRoot);
          return Boolean(updatedProbe && updatedProbe.state === "liked");
        }, 3500, 200);

        if (verified) {
          record.likeStatus = "Liked";
          this.state.metrics.likesNew++;
          this.broadcast();
          return;
        }

        throw new Error("Like state change could not be verified");
      } catch (err: any) {
        record.errorsCount++;
        record.errorDetails.push(`Like try ${attempt}: ${err.message}`);
        this.state.metrics.totalErrors++;

        // Self-heal calibration on failure
        if (this.config.autoSelfHealDOM) {
          await this.scanner.runFullDiagnostics(this.config.myUsername);
        }

        const backoff = this.scheduler.computeBackoffMs(attempt, this.config.retryDelayMs);
        this.broadcast(`Like retry ${attempt}/${this.config.maxRetries} on ${record.postPath}...`);
        if (!(await this.waitWithPauseCheck(backoff))) return;
      }
    }

    record.likeStatus = "Failed";
    this.state.metrics.likesFailed++;
    this.broadcast();
  }

  /**
   * Executes the comment step on a post record via Direct API or verified DOM interaction.
   * @param record - Current post engagement record.
   */
  async processCommentStep(record: EngagementRecord): Promise<void> {
    // Mode Gate
    if (this.config.engagementMode === "like_only") {
      record.commentActionRequired = false;
      record.commentStatus = "Skipped (Mode)";
      return;
    }

    // Probability Gate
    if (this.config.commentProbability < 100) {
      const roll = Math.random() * 100;
      if (roll >= this.config.commentProbability) {
        record.commentActionRequired = false;
        record.commentStatus = "Skipped (Probability)";
        this.broadcast(`Skipped comment on ${record.postPath} (Probability gate: ${this.config.commentProbability}%)`);
        return;
      }
    }

    const initialRoot = this.dom.getModalRoot();

    // Check if comments are disabled or limited
    if (this.dom.isCommentsDisabled(initialRoot)) {
      record.commentActionRequired = false;
      record.commentStatus = "Comments Disabled";
      record.commentText = "";
      this.broadcast(`Comments disabled on ${record.postPath}, skipping...`);
      return;
    }

    if (
      this.config.skipIfAlreadyCommented &&
      this.state.detectedUsername &&
      this.dom.hasAlreadyCommented(initialRoot, this.state.detectedUsername)
    ) {
      record.commentActionRequired = false;
      record.commentStatus = "Already Commented";
      record.commentText = "";
      record.commentAttempts = 0;
      this.state.metrics.commentsAlready++;
      this.broadcast(`Skipped comment (${record.postPath} already commented)`);
      return;
    }

    record.commentActionRequired = true;
    const author = this.dom.getPostAuthorUsername(initialRoot);
    const vision = this.dom.getPostVisionContext(initialRoot);
    const chosenComment = this.commentDeck.next({
      author,
      primaryTopic: vision.primaryTopic,
      topic: vision.primaryTopic,
    });
    record.commentText = chosenComment;

    // Branch 1: Direct Web API Engine (Headless or Hybrid primary)
    if ((this.config.engineMode === "api" || this.config.engineMode === "hybrid") && this.network.isAvailable) {
      const mediaId = record.mediaId || shortcodeToMediaId(record.shortcode);
      if (mediaId) {
        record.mediaId = mediaId;
        this.broadcast(`Commenting "${chosenComment}" on ${record.postPath} (Direct API)...`);
        try {
          const res = await this.network.sendComment(mediaId, chosenComment);
          const challenge = this.network.checkChallenge(res);
          if (challenge) {
            this.state.status = "Stopped";
            this.broadcast(`🚨 Action Block: ${challenge}. Halted for account safety.`);
            return;
          }

          if (this.network.isEndpointDeprecated(res)) {
            this.network.markEndpointDeprecated(res.status, "Direct Comment API endpoint retired / 404 Not Found");
            this.broadcast(`Direct API comment endpoint 404 (deprecated by Instagram) — switching to DOM Simulation...`);
            // Seamlessly fall through to DOM simulation below
          } else if (res.ok && res.isConfirmedSuccess) {
            record.commentActionRequired = true;
            record.commentStatus = "Commented";
            this.state.metrics.commentsNew++;
            this.broadcast();
            return;
          } else if (this.config.engineMode === "api") {
            if (this.dom.isPostViewOpen()) {
              this.broadcast(`Direct API comment unconfirmed (${res.error || "no server confirmation"}), verifying via DOM...`);
              // Post modal is open, seamlessly fall through to DOM simulation below
            } else {
              record.commentStatus = "Failed";
              record.errorsCount++;
              record.errorDetails.push(`API Comment error (status ${res.status}): ${res.error || res.data?.message || "unconfirmed by server"}`);
              this.state.metrics.commentsFailed++;
              this.state.metrics.totalErrors++;
              this.broadcast();
              return;
            }
          }
        } catch (apiErr: any) {
          if (this.config.engineMode === "api") {
            if (this.dom.isPostViewOpen()) {
              this.broadcast(`API network exception (${apiErr.message}), verifying via DOM...`);
            } else {
              record.commentStatus = "Failed";
              record.errorsCount++;
              record.errorDetails.push(`API network exception: ${apiErr.message}`);
              this.state.metrics.commentsFailed++;
              this.state.metrics.totalErrors++;
              this.broadcast();
              return;
            }
          }
          this.broadcast(`Direct API comment unreachable, falling back to DOM simulation for ${record.postPath}...`);
        }
      }
    }

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      if (this.state.status === "Stopped") return;
      record.commentAttempts = attempt;

      try {
        // Pre-check for Action Block
        const blockProbe = this.scanner.probeActionBlock();
        if (blockProbe && blockProbe.isBlocked) {
          this.state.status = "Stopped";
          this.broadcast(`🚨 Action Block Detected: "${blockProbe.reason}". Automation halted for safety.`);
          return;
        }
        this.broadcast(`Commenting "${chosenComment}" (Try ${attempt}/${this.config.maxRetries})...`);
        const root = this.dom.getModalRoot();
        if (!root) throw new Error("Post container missing");

        const inputHandle = this.dom.fillCommentInput(root, chosenComment);
        if (!inputHandle) throw new Error("Comment input element not accessible");

        if (!(await this.waitWithPauseCheck(700))) return;

        const postButton = this.dom.resolvePostSubmitButton(root);
        if (!postButton) throw new Error("Post submit button not active");

        this.dom.triggerClick(postButton);

        const verified = await this.waitForCondition(() => {
          const updatedRoot = this.dom.getModalRoot();
          const cleared = this.dom.isInputCleared(inputHandle);
          const inThread =
            this.state.detectedUsername &&
            this.dom.hasAlreadyCommented(updatedRoot, this.state.detectedUsername);
          return cleared || inThread;
        }, 5000, 250);

        if (verified) {
          record.commentStatus = "Commented";
          this.state.metrics.commentsNew++;
          this.broadcast();
          return;
        }

        throw new Error("Comment submission unconfirmed");
      } catch (err: any) {
        record.errorsCount++;
        record.errorDetails.push(`Comment try ${attempt}: ${err.message}`);
        this.state.metrics.totalErrors++;

        if (this.config.autoSelfHealDOM) {
          await this.scanner.runFullDiagnostics(this.config.myUsername);
        }

        const backoff = this.scheduler.computeBackoffMs(attempt, this.config.retryDelayMs);
        this.broadcast(`Comment retry ${attempt}/${this.config.maxRetries} on ${record.postPath}...`);
        if (!(await this.waitWithPauseCheck(backoff))) return;
      }
    }

    record.commentStatus = "Failed";
    this.state.metrics.commentsFailed++;
    this.broadcast();
  }

  /**
   * Navigates to the next sequential post modal using next button, keyboard right arrow, or grid link.
   * Automatically delegates to vertical infinite-scroll navigation on feed pages.
   * @param currentShortcode - Shortcode of the currently active post.
   * @returns True if navigated to a new post shortcode.
   */
  async advanceToNextPost(currentShortcode: string): Promise<boolean> {
    if (this.dom.isFeedMode()) {
      return await this.advanceToNextFeedPost(currentShortcode);
    }

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      if (this.state.status === "Stopped") return false;

      this.broadcast(`Advancing to next post (Try ${attempt}/${this.config.maxRetries})...`);

      const nextBtn = this.dom.resolveNextButton();
      if (nextBtn) {
        this.dom.triggerClick(nextBtn);
      } else {
        const target = (document.querySelector('div[role="dialog"]') || document) as HTMLElement;
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowRight",
            code: "ArrowRight",
            keyCode: 39,
            which: 39,
            bubbles: true,
          })
        );
      }

      const navigated = await this.waitForCondition(() => {
        const info = this.dom.getCurrentPostInfo();
        return info && info.shortcode !== currentShortcode;
      }, 3500, 200);

      if (navigated) {
        await this.waitWithPauseCheck(700);
        return true;
      }

      // Grid Link Fallback
      const gridLinks = this.dom.collectGridPostLinks();
      const nextGridItem = gridLinks.find(
        (item) => item.shortcode !== currentShortcode && !this.state.visitedShortcodes.has(item.shortcode)
      );

      if (nextGridItem) {
        this.dom.triggerClick((nextGridItem as any).element);
        const gridNavigated = await this.waitForCondition(() => {
          const info = this.dom.getCurrentPostInfo();
          return info && info.shortcode !== currentShortcode;
        }, 3500, 200);

        if (gridNavigated) {
          await this.waitWithPauseCheck(700);
          return true;
        }
      } else if (!nextBtn) {
        this.broadcast("Reached the final post in this grid.");
        return false;
      }

      this.state.metrics.totalErrors++;
      const backoff = this.scheduler.computeBackoffMs(attempt, this.config.retryDelayMs);
      this.broadcast();
      if (!(await this.waitWithPauseCheck(backoff))) return false;
    }

    this.broadcast("Stopped: Unable to advance to next post after retries.");
    return false;
  }

  /**
   * Navigates to the next post below the current one on an infinite scroll feed page.
   * Smoothly scrolls existing DOM articles into view or triggers window scroll to load more.
   * @param currentShortcode - Shortcode of the post currently being engaged.
   * @returns True if successfully advanced to a new feed post.
   */
  async advanceToNextFeedPost(currentShortcode: string): Promise<boolean> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      if (this.state.status === "Stopped") return false;

      this.broadcast(`Scrolling to next feed post (Try ${attempt}/${this.config.maxRetries})...`);

      let feedPosts = this.dom.collectFeedPosts();
      const currentIndex = feedPosts.findIndex((p) => p.shortcode === currentShortcode);

      // 1. Look for unvisited post below current in DOM
      let candidate: FeedPost | undefined = undefined;
      if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < feedPosts.length; i++) {
          if (!this.state.visitedShortcodes.has(feedPosts[i].shortcode)) {
            candidate = feedPosts[i];
            break;
          }
        }
      } else {
        candidate = feedPosts.find(
          (p) => p.shortcode !== currentShortcode && !this.state.visitedShortcodes.has(p.shortcode)
        );
      }

      // 2. If candidate is already in the DOM, scroll it into view
      if (candidate && candidate.element) {
        this.dom.setActiveFeedElement(candidate.element);
        try {
          if (typeof candidate.element.scrollIntoView === "function") {
            candidate.element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } catch (_) {}

        const navigated = await this.waitForCondition(() => {
          const info = this.dom.getCurrentPostInfo();
          return info && info.shortcode !== currentShortcode;
        }, 3500, 200);

        if (navigated) {
          await this.waitWithPauseCheck(800);
          return true;
        }
      }

      // 3. Reached bottom of rendered articles: trigger infinite scroll
      this.broadcast(`Loading more posts via infinite scroll (Try ${attempt}/${this.config.maxRetries})...`);
      const viewportHeight = (typeof window !== "undefined" && window.innerHeight) || 800;
      const scrollStep = Math.floor(viewportHeight * 0.85 + Math.random() * 150);

      if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
        window.scrollBy({ top: scrollStep, behavior: "smooth" });
      }

      const loaded = await this.waitForCondition(() => {
        const freshPosts = this.dom.collectFeedPosts();
        return freshPosts.some(
          (p) => p.shortcode !== currentShortcode && !this.state.visitedShortcodes.has(p.shortcode)
        );
      }, 5000, 300);

      if (loaded) {
        feedPosts = this.dom.collectFeedPosts();
        const nextTarget = feedPosts.find(
          (p) => p.shortcode !== currentShortcode && !this.state.visitedShortcodes.has(p.shortcode)
        );
        if (nextTarget && nextTarget.element) {
          this.dom.setActiveFeedElement(nextTarget.element);
          try {
            if (typeof nextTarget.element.scrollIntoView === "function") {
              nextTarget.element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch (_) {}
          await this.waitWithPauseCheck(800);
          return true;
        }
      }

      this.state.metrics.totalErrors++;
      const backoff = this.scheduler.computeBackoffMs(attempt, this.config.retryDelayMs);
      this.broadcast();
      if (!(await this.waitWithPauseCheck(backoff))) return false;
    }

    this.broadcast("Stopped: Unable to locate next post in feed after retries.");
    return false;
  }

  async closePostModal(): Promise<void> {
    if (this.dom.isFeedMode()) return;
    try {
      const closeBtn = (document.querySelector(
        'svg[aria-label="Close"], svg[aria-label="Cerrar"], svg[aria-label="Fermer"], svg[aria-label="Schließen"]'
      )?.closest('div[role="button"], button')) as HTMLElement | null;
      if (closeBtn) {
        this.dom.triggerClick(closeBtn);
      } else if (typeof document !== "undefined") {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true })
        );
      }
    } catch (_) {}
    await this.waitWithPauseCheck(800);
  }

  async engagePostViaVerifiedDOM(target: any, record: EngagementRecord): Promise<boolean> {
    if (!target || !target.element) return false;
    this.broadcast(`Direct API unconfirmed for ${record.postPath} — opening post for verified engagement...`);
    try {
      this.dom.triggerClick(target.element);
      const opened = await this.waitForCondition(() => this.dom.isPostViewOpen(), 4500, 250);
      if (!opened) {
        this.broadcast(`Could not open modal for ${record.postPath}`);
        return false;
      }
      await this.waitWithPauseCheck(600);

      // Perform verified DOM like if needed
      if (record.likeActionRequired && record.likeStatus !== "Liked") {
        await this.processLikeStep(record);
      }

      // Perform verified DOM comment if needed
      if (record.commentActionRequired && record.commentStatus !== "Commented") {
        await this.humanizedCooldown(
          this.config.minActionDelayMs,
          this.config.maxActionDelayMs,
          "Waiting before verified comment"
        );
        await this.processCommentStep(record);
      }

      await this.closePostModal();

      // If a mutation was captured during verified interaction, update network engine availability
      if (this.network.isGraphQLArmed("like") || this.network.isGraphQLArmed("comment")) {
        this.network.isAvailable = true;
      }
      return true;
    } catch (err: any) {
      this.broadcast(`Verified DOM fallback error: ${err.message}`);
      return false;
    }
  }

  async runHeadlessGridBatch(): Promise<void> {
    // Hybrid Kickstart: If no live doc_id is armed yet, engage post 1 via DOM to harvest live mutation
    const needsKickstart =
      (!this.network.isGraphQLArmed("like") && this.config.engagementMode !== "comment_only") ||
      (!this.network.isGraphQLArmed("comment") && this.config.engagementMode !== "like_only");

    if (needsKickstart) {
      this.broadcast("Calibrating live GraphQL engine on Post #1 to harvest session doc_id...");
      const opened = await this.ensureFirstPostOpened();
      if (opened) {
        const postInfo = this.dom.getCurrentPostInfo();
        if (postInfo) {
          const { shortcode, canonicalPath } = postInfo;
          this.state.visitedShortcodes.add(shortcode);
          this.state.sessionChecked++;
          const now = new Date();
          const kickstartRecord: EngagementRecord = {
            shortcode,
            mediaId: shortcodeToMediaId(shortcode),
            postPath: canonicalPath,
            postUrl: (typeof window !== "undefined" && window.location ? window.location.origin : "https://www.instagram.com") + canonicalPath,
            targetUsername: this.state.targetUsername || "",
            timestampIso: now.toISOString(),
            timeFormatted: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            likeActionRequired: true,
            likeStatus: "Pending",
            likeAttempts: 0,
            commentActionRequired: true,
            commentStatus: "Pending",
            commentText: "",
            commentAttempts: 0,
            errorsCount: 0,
            errorDetails: [],
          };
          this.state.records.push(kickstartRecord);
          await this.processLikeStep(kickstartRecord);
          await this.processCommentStep(kickstartRecord);
          if (this.network.isGraphQLArmed("like") || this.network.isGraphQLArmed("comment")) {
            this.network.isAvailable = true;
          }
          await StorageService.saveHistory(this.state.records);
          db.saveEngagementRecord(kickstartRecord);
          this.broadcast();

          // Close modal and return to grid for headless batch of remaining posts
          await this.closePostModal();
          await this.waitWithPauseCheck(600);
        }
      }
    }

    this.broadcast("Running Headless Direct API Batch on grid posts...");
    let consecutiveEmptyScans = 0;

    while (
      !this.isStopped &&
      this.state.sessionChecked < this.config.maxPostsToProcess
    ) {
      if (!(await this.waitWithPauseCheck(100))) break;

      let gridItems = this.dom.collectGridPostLinks();
      let candidates = gridItems.filter((item) => !this.state.visitedShortcodes.has(item.shortcode));

      if (candidates.length === 0) {
        if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
          window.scrollBy({ top: 600, behavior: "smooth" });
        }
        if (!(await this.waitWithPauseCheck(1500))) break;
        gridItems = this.dom.collectGridPostLinks();
        candidates = gridItems.filter((item) => !this.state.visitedShortcodes.has(item.shortcode));

        if (candidates.length === 0) {
          consecutiveEmptyScans++;
          if (consecutiveEmptyScans >= 3) {
            this.broadcast("No more unvisited posts discovered on page.");
            break;
          }
          continue;
        }
      }

      consecutiveEmptyScans = 0;
      const target = candidates[0];
      const { shortcode, canonicalPath, element } = target;

      this.state.visitedShortcodes.add(shortcode);
      this.state.sessionChecked++;

      // Paint pending badge on grid thumbnail
      this.dom.paintBadge(element, "⏳ API...", "#d97706");

      const now = new Date();
      const mediaId = shortcodeToMediaId(shortcode);
      const record: EngagementRecord = {
        shortcode,
        mediaId,
        postPath: canonicalPath,
        postUrl: (typeof window !== "undefined" && window.location ? window.location.origin : "https://www.instagram.com") + canonicalPath,
        targetUsername: this.state.targetUsername || "",
        timestampIso: now.toISOString(),
        timeFormatted: now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        likeActionRequired: true,
        likeStatus: "Pending",
        likeAttempts: 0,
        commentActionRequired: true,
        commentStatus: "Pending",
        commentText: "",
        commentAttempts: 0,
        errorsCount: 0,
        errorDetails: [],
      };

      this.state.records.push(record);
      await StorageService.saveHistory(this.state.records);
      this.broadcast(`Checking post ${canonicalPath} (API)...`);

      // 1. Direct Like Step
      await this.processLikeStep(record);
      await StorageService.saveHistory(this.state.records);
      this.broadcast();
      if (this.isStopped) break;

      // 2. Direct Comment Step (if enabled)
      if (this.config.engagementMode !== "like_only") {
        if (
          !(await this.humanizedCooldown(
            this.config.minActionDelayMs,
            this.config.maxActionDelayMs,
            "Waiting before comment"
          ))
        ) {
          break;
        }

        await this.processCommentStep(record);
        await StorageService.saveHistory(this.state.records);
        this.broadcast();
        if (this.isStopped) break;
      }

      // 3. Fail-Safe Verified DOM Fallback: If API was unconfirmed on this post, verify via DOM
      const needsLikeDOM = record.likeActionRequired && record.likeStatus !== "Liked";
      const needsCommentDOM = record.commentActionRequired && record.commentStatus !== "Commented";

      if ((needsLikeDOM || needsCommentDOM) && target.element && typeof window !== "undefined") {
        await this.engagePostViaVerifiedDOM(target, record);
        await StorageService.saveHistory(this.state.records);
        this.broadcast();
        if (this.isStopped) break;
      }

      // 4. Update thumbnail badge on grid
      let badgeText = "✔ Checked";
      let badgeColor = "#059669";

      if (record.likeStatus === "Liked" && record.commentStatus === "Commented") {
        badgeText = "♥ 💬";
        badgeColor = "#059669";
      } else if (record.likeStatus === "Liked") {
        badgeText = "♥ Liked";
        badgeColor = "#059669";
      } else if (record.commentStatus === "Commented") {
        badgeText = "💬 Commented";
        badgeColor = "#059669";
      } else if (record.likeStatus === "Failed" || record.commentStatus === "Failed") {
        badgeText = "✖ Unconfirmed";
        badgeColor = "#ef4444";
      } else {
        badgeText = "✔ Checked";
        badgeColor = "#6b7280";
      }
      this.dom.paintBadge(element, badgeText, badgeColor);

      // Inter-post cooldown
      if (this.state.sessionChecked < this.config.maxPostsToProcess) {
        if (
          !(await this.humanizedCooldown(
            this.config.minPostDelayMs,
            this.config.maxPostDelayMs,
            "Cooldown before next post"
          ))
        ) {
          break;
        }
      }
    }
  }

  async start(): Promise<void> {
    if (this.isExecuting) return;
    this.isExecuting = true;

    // Phase 1: Pre-flight Initialization & Diagnostic Calibration
    this.state.status = "Calibrating";
    this.broadcast("Executing pre-flight DOM discovery calibration...");

    // Check for active Action Block
    const initialBlock = this.scanner.probeActionBlock();
    if (initialBlock && initialBlock.isBlocked) {
      this.state.status = "Stopped";
      this.isExecuting = false;
      this.broadcast(`🚨 Action Block Detected: "${initialBlock.reason}". Automation stopped to protect your account.`);
      return;
    }

    const report = await this.scanner.runFullDiagnostics(this.config.myUsername);
    const apiValidation = await this.network.validateEndpoints();
    (report as any).apiValidation = apiValidation;
    this.state.diagnostics = report;
    this.syncDetectedUsername();

    if (report.overallHealthScore < 30 && !report.isPostViewOpen && report.gridCount === 0) {
      this.state.status = "Stopped";
      this.isExecuting = false;
      this.broadcast("Calibration failed: Please navigate to an Instagram profile grid or open a post first.");
      return;
    }

    // Phase 2: Automation Execution
    this.state.status = "Running";
    this.scheduler.acquireWakeLock();
    this.state.sessionChecked = 0;
    this.state.consecutiveSkips = 0;
    this.broadcast("Initializing workflow...");

    try {
      // Branch A: Headless Direct API Loop on Grid (if configured for pure API mode)
      if (this.config.engineMode === "api" && !this.dom.isPostViewOpen()) {
        await this.runHeadlessGridBatch();
        if (this.isStopped) {
          this.stop();
          return;
        }
        this.state.status = "Completed";
        this.broadcast("Headless grid batch completed!");
        return;
      }

      // Check if execution was stopped or completed
      if (this.isStopped) {
        this.stop();
        return;
      }
      if (this.state.sessionChecked >= this.config.maxPostsToProcess) {
        this.state.status = "Completed";
        this.broadcast("Engagement run successfully completed!");
        return;
      }

      // Branch B: Modal-based loop (runs for DOM mode, Hybrid mode, or if Direct API fell back)
      const opened = await this.ensureFirstPostOpened();
      if (!opened) {
        this.stop();
        return;
      }

      while (
        !this.isStopped &&
        this.state.sessionChecked < this.config.maxPostsToProcess
      ) {
        if (!(await this.waitWithPauseCheck(100))) break;

        if (!this.dom.isPostViewOpen()) {
          const reopened = await this.ensureFirstPostOpened();
          if (!reopened) break;
        }

        const postInfo = this.dom.getCurrentPostInfo();
        if (!postInfo) {
          this.broadcast("Stopped: Current view does not match a valid post URL.");
          break;
        }

        const { shortcode, canonicalPath } = postInfo;

        if (!this.state.visitedShortcodes.has(shortcode)) {
          this.state.visitedShortcodes.add(shortcode);
          this.state.sessionChecked++;
          this.state.consecutiveSkips = 0;

          const now = new Date();
          const mediaId = shortcodeToMediaId(shortcode);
          const record: EngagementRecord = {
            shortcode,
            mediaId,
            postPath: canonicalPath,
            postUrl: (typeof window !== "undefined" && window.location ? window.location.origin : "https://www.instagram.com") + canonicalPath,
            targetUsername: this.state.targetUsername || "",
            timestampIso: now.toISOString(),
            timeFormatted: now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            likeActionRequired: true,
            likeStatus: "Pending",
            likeAttempts: 0,
            commentActionRequired: true,
            commentStatus: "Pending",
            commentText: "",
            commentAttempts: 0,
            errorsCount: 0,
            errorDetails: [],
          };

          this.state.records.push(record);
          await StorageService.saveHistory(this.state.records);
          this.broadcast(`Checking post ${canonicalPath}...`);

          // Like Action Step
          await this.processLikeStep(record);
          await StorageService.saveHistory(this.state.records);
          this.broadcast();
          if (this.isStopped) break;

          // Natural human cooldown between like and comment
          if (
            !(await this.humanizedCooldown(
              this.config.minActionDelayMs,
              this.config.maxActionDelayMs,
              "Waiting before comment"
            ))
          ) {
            break;
          }

          // Comment Action Step
          await this.processCommentStep(record);
          await StorageService.saveHistory(this.state.records);
          db.saveEngagementRecord(record);
          this.broadcast();
          if (this.isStopped) break;

          // Inter-post cooldown
          if (this.state.sessionChecked < this.config.maxPostsToProcess) {
            if (
              !(await this.humanizedCooldown(
                this.config.minPostDelayMs,
                this.config.maxPostDelayMs,
                "Cooldown before next post"
              ))
            ) {
              break;
            }
          }
        } else {
          this.state.consecutiveSkips++;
          if (this.state.consecutiveSkips > this.config.maxConsecutiveSkips) {
            this.broadcast(`Stopped: Skipped ${this.config.maxConsecutiveSkips} visited posts in a row.`);
            break;
          }
          this.broadcast(`Skipping previously processed post ${canonicalPath}...`);
          if (!(await this.waitWithPauseCheck(450))) break;
        }

        if (
          this.isStopped ||
          this.state.sessionChecked >= this.config.maxPostsToProcess
        ) {
          break;
        }

        const movedNext = await this.advanceToNextPost(shortcode);
        if (!movedNext) break;
      }
    } catch (err: any) {
      console.error("[IG Workflow Run Error]", err);
      this.broadcast(`Error encountered: ${err.message}`);
    } finally {
      this.scheduler.freeWakeLock();
      this.isExecuting = false;

      if (!this.isStopped) {
        this.state.status = "Completed";
        this.broadcast(`Completed! Processed ${this.state.sessionChecked} posts.`);
      } else {
        this.broadcast("Workflow stopped by user.");
      }
    }
  }

  pause(): void {
    if (this.state.status === "Running") {
      this.state.status = "Paused";
      this.broadcast("Paused — click Continue to resume");
    }
  }

  resume(): void {
    if (this.state.status === "Paused") {
      this.state.status = "Running";
      this.broadcast("Resuming workflow...");
    }
  }

  stop(): void {
    this.state.status = "Stopped";
    this.scheduler.cancelAllTimers();
    this.scheduler.freeWakeLock();
    this.broadcast("Workflow stopped by user.");
  }

  destroy(): void {
    this.stop();
    this.scheduler.destroy();
  }
}
