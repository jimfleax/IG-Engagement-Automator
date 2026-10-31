/**
 * @file storage.ts
 * @description Provides cross-storage persistence with chrome.storage.local, localStorage fallback, and automatic schema migration.
 * @architecture Serves as the configuration and preferences state layer accessed by WorkflowEngine, CommentDeck, and React components.
 * @agent_note When modifying default settings or schema keys, ensure migration hooks and sanitization clamps protect against malformed payloads.
 */

/**
 * Namespaced keys used for chrome.storage.local and localStorage persistence.
 */
export const STORAGE_KEYS = {
  SETTINGS: "ig_modal_suite_settings_v3",
  PREFS: "ig_modal_suite_ui_prefs_v1",
  HISTORY: "ig_modal_suite_history_v2",
  DECK: "ig_modal_suite_comment_deck_v1",
  DIAGNOSTICS: "ig_modal_suite_diagnostics_v1",
} as const;

/**
 * Instagram URL path segments reserved for internal features, navigation, and settings.
 */
export const RESERVED_PATHS: Set<string> = new Set([
  "explore",
  "reels",
  "direct",
  "accounts",
  "p",
  "reel",
  "tv",
  "stories",
  "threads",
  "settings",
  "archive",
  "challenge",
]);

export interface AutomationSettings {
  myUsername: string;
  targetUsername: string;
  engineMode: "hybrid" | "api" | "dom";
  engagementMode: "both" | "like_only" | "comment_only";
  skipIfAlreadyCommented: boolean;
  maxPostsToProcess: number;
  maxRetries: number;
  retryDelayMs: number;
  minActionDelayMs: number;
  maxActionDelayMs: number;
  minPostDelayMs: number;
  maxPostDelayMs: number;
  maxConsecutiveSkips: number;
  likeProbability: number;
  commentProbability: number;
  autoSelfHealDOM: boolean;
  commentPool: string[];
}

export interface UiPreferences {
  activeTab: string;
  isDocked: boolean;
  isMinimized: boolean;
  isVisible: boolean;
}

export interface DeckState {
  queue: string[];
  lastDrawn: string | null;
  poolHash: string;
}

/**
 * Default automation configuration settings including delays, limits, and comment pool.
 */
export const DEFAULT_SETTINGS: AutomationSettings = {
  myUsername: "",
  targetUsername: "",
  engineMode: "hybrid",
  engagementMode: "both",
  skipIfAlreadyCommented: true,
  maxPostsToProcess: 50,
  maxRetries: 3,
  retryDelayMs: 2000,
  minActionDelayMs: 1200,
  maxActionDelayMs: 2500,
  minPostDelayMs: 4500,
  maxPostDelayMs: 8500,
  maxConsecutiveSkips: 40,
  likeProbability: 100,
  commentProbability: 100,
  autoSelfHealDOM: true,
  commentPool: [
    "🔥🔥",
    "🔥🔥🔥",
    "Love this! 🔥",
    "So good! 🙌",
    "Awesome shot 💯",
    "Incredible! ✨",
    "🙌🔥",
    "👏👏🔥",
    "This is great! 💯",
    "Pure fire 🔥🙌",
  ],
};

/**
 * Default UI presentation preferences for modal positioning, active tab, and docking.
 */
export const DEFAULT_PREFS: UiPreferences = {
  activeTab: "dashboard",
  isDocked: false,
  isMinimized: false,
  isVisible: false,
};

/**
 * Static storage manager facilitating hybrid persistence across chrome.storage.local and localStorage.
 */
export class StorageService {
  /**
   * Deep-clones an object or array via structuredClone with JSON fallback.
   * @param data - Data to clone.
   * @returns Deep-cloned copy.
   */
  static clone<T>(data: T): T {
    try {
      return structuredClone(data);
    } catch (_) {
      return JSON.parse(JSON.stringify(data));
    }
  }

  /**
   * Reads data from chrome.storage.local with automatic localStorage fallback and schema migration.
   * @param key - Storage key name.
   * @param fallback - Default fallback value if not found.
   * @returns Stored or fallback data.
   */
  static async read<T>(key: string, fallback: T): Promise<T> {
    const defaultValue = this.clone(fallback);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        const result = await chrome.storage.local.get([key]);
        if (result && result[key] !== undefined) {
          const val = result[key];
          if (Array.isArray(defaultValue)) {
            return (Array.isArray(val) ? val : defaultValue) as T;
          }
          if (typeof defaultValue === "object" && defaultValue !== null) {
            return { ...defaultValue, ...val };
          }
          return val as T;
        }
      } catch (err) {
        console.warn("[IG Storage] chrome.storage.local error:", err);
      }
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = Array.isArray(defaultValue)
          ? ((Array.isArray(parsed) ? parsed : defaultValue) as T)
          : ({ ...defaultValue, ...parsed } as T);
        this.write(key, migrated);
        return migrated;
      }
    } catch (_) {}

    return defaultValue;
  }

  /**
   * Persists key-value data to both chrome.storage.local and localStorage.
   * @param key - Storage key name.
   * @param value - Value to store.
   * @returns True if successfully written.
   */
  static async write<T>(key: string, value: T): Promise<boolean> {
    let saved = false;
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [key]: value });
        saved = true;
      } catch (err) {
        console.warn("[IG Storage] chrome.storage.local write failed:", err);
      }
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
      saved = true;
    } catch (_) {}

    return saved;
  }

  /**
   * Loads application settings, migrates legacy schemas, and sanitizes boundaries.
   * @returns Sanitized automation configuration object.
   */
  static async loadSettings(): Promise<AutomationSettings> {
    try {
      const legacy = localStorage.getItem("ig_modal_suite_settings_v2");
      if (legacy && !localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, legacy);
      }
    } catch (_) {}

    const loaded = await this.read<AutomationSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

    loaded.commentPool =
      Array.isArray(loaded.commentPool) && loaded.commentPool.length > 0
        ? loaded.commentPool.map((s) => String(s).trim()).filter(Boolean)
        : [...DEFAULT_SETTINGS.commentPool];

    loaded.maxPostsToProcess = Math.max(1, Number(loaded.maxPostsToProcess) || 50);
    loaded.maxRetries = Math.min(10, Math.max(1, Number(loaded.maxRetries) || 3));
    loaded.retryDelayMs = Math.max(500, Number(loaded.retryDelayMs) || 2000);
    loaded.minPostDelayMs = Math.max(1000, Number(loaded.minPostDelayMs) || 4500);
    loaded.maxPostDelayMs = Math.max(loaded.minPostDelayMs, Number(loaded.maxPostDelayMs) || 8500);
    loaded.maxConsecutiveSkips = Math.max(5, Number(loaded.maxConsecutiveSkips) || 40);

    // Sanitize Engine Mode
    const validEngines: AutomationSettings["engineMode"][] = ["hybrid", "api", "dom"];
    loaded.engineMode = validEngines.includes(loaded.engineMode) ? loaded.engineMode : "hybrid";

    // Sanitize Target Username
    loaded.targetUsername = String(loaded.targetUsername || "")
      .trim()
      .toLowerCase()
      .replace(/^@|^\/+|\/+$/g, "")
      .trim();

    // Sanitize Action Delays
    loaded.minActionDelayMs = Math.max(500, Number(loaded.minActionDelayMs) || 1200);
    loaded.maxActionDelayMs = Math.max(loaded.minActionDelayMs, Number(loaded.maxActionDelayMs) || 2500);

    // Sanitize Engagement Mode
    const validModes: AutomationSettings["engagementMode"][] = ["both", "like_only", "comment_only"];
    loaded.engagementMode = validModes.includes(loaded.engagementMode) ? loaded.engagementMode : "both";

    // Sanitize Probabilities (0 to 100)
    loaded.likeProbability = Math.min(100, Math.max(0, Number(loaded.likeProbability) ?? 100));
    loaded.commentProbability = Math.min(100, Math.max(0, Number(loaded.commentProbability) ?? 100));

    return loaded;
  }

  /**
   * Extracts profile handle from a URL path if not a reserved Instagram path.
   * @param pathname - URL pathname to evaluate.
   * @returns Target profile handle or empty string.
   */
  static extractTargetProfileFromPath(pathname = ""): string {
    const clean = String(pathname || "")
      .replace(/^\/+|\/+$/g, "")
      .trim();
    if (!clean) return "";
    const segments = clean.split("/").filter(Boolean);
    if (segments.length === 0) return "";

    const first = segments[0].toLowerCase();
    if (RESERVED_PATHS.has(first)) return "";

    // /username/
    if (segments.length === 1) return first;

    // /username/reels/ or /username/tagged/ or /username/channel/
    if (segments.length === 2 && ["reels", "tagged", "channel"].includes(segments[1].toLowerCase())) {
      return first;
    }

    return "";
  }

  /**
   * Resolves session user profile data from cookies, scripts, DOM, and URL.
   * @returns Resolved user handles.
   */
  static resolveSessionProfile(): { myUsername: string; targetUsername: string } {
    let myUsername = "";
    let targetUsername = "";

    if (typeof window !== "undefined") {
      targetUsername = this.extractTargetProfileFromPath(window.location.pathname);

      // Strategy 1: Embedded script tag viewer / username
      try {
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const s of scripts) {
          const t = s.textContent || "";
          const m =
            t.match(/"viewer"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/) ||
            t.match(/"username"\s*:\s*"([a-zA-Z0-9._]{1,30})"\s*,\s*"is_verified"/);
          if (m && m[1]) {
            myUsername = m[1].toLowerCase();
            break;
          }
        }
      } catch (_) {}

      // Strategy 2: DOM Navigation links (Fallback for logged-in user)
      if (!myUsername && typeof document !== "undefined") {
        try {
          const navLinks = Array.from(
            document.querySelectorAll(
              'nav a[href^="/"], div[role="navigation"] a[href^="/"], aside a[href^="/"], a[href^="/"][role="link"]'
            )
          );
          for (const link of navLinks) {
            const text = (link.textContent || "").trim().toLowerCase();
            const hasAvatar = Boolean(
              link.querySelector('img[alt*="profile" i], svg[aria-label*="Profile" i]')
            );
            if (text === "profile" || hasAvatar) {
              const rawHref = link.getAttribute("href") || "";
              const candidate = rawHref.replace(/^\/+|\/+$/g, "").toLowerCase();
              if (candidate && !candidate.includes("/") && !RESERVED_PATHS.has(candidate)) {
                myUsername = candidate;
                break;
              }
            }
          }
        } catch (_) {}
      }

      // Strategy 3: Target post author from open post modal/article if on /p/ or /reel/
      if (!targetUsername && typeof document !== "undefined") {
        try {
          const authorEl = document.querySelector(
            'header a[role="link"], article header a, div[role="dialog"] header a'
          );
          if (authorEl) {
            const raw =
              authorEl.getAttribute("href")?.replace(/^\/+|\/+$/g, "") ||
              authorEl.textContent?.trim();
            const candidate = String(raw || "").toLowerCase().replace(/^@/, "");
            if (candidate && !candidate.includes("/") && !RESERVED_PATHS.has(candidate)) {
              targetUsername = candidate;
            }
          }
        } catch (_) {}
      }

      // Strategy 4: Profile handle from page header / H2 / H1
      if (!targetUsername && typeof document !== "undefined") {
        try {
          const headerHandle = document.querySelector('header h2, header h1, section h2, main header h2');
          if (headerHandle) {
            const candidate = (headerHandle.textContent || "").trim().toLowerCase().replace(/^@/, "");
            if (candidate && !candidate.includes(" ") && !candidate.includes("/") && !RESERVED_PATHS.has(candidate)) {
              targetUsername = candidate;
            }
          }
        } catch (_) {}
      }
    }

    return { myUsername, targetUsername };
  }

  /**
   * Saves sanitized settings into storage.
   * @param settings - Settings object to persist.
   * @returns True if successfully saved.
   */
  static async saveSettings(settings: AutomationSettings): Promise<boolean> {
    return await this.write(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Loads UI preferences with modal visibility reset to false by default.
   * @returns UI preferences object.
   */
  static async loadPrefs(): Promise<UiPreferences> {
    const prefs = await this.read<UiPreferences>(STORAGE_KEYS.PREFS, DEFAULT_PREFS);
    // By default the modal is hidden on page load; only shown when opened via popup/shortcut
    prefs.isVisible = false;
    return prefs;
  }

  /**
   * Persists UI preferences into storage.
   * @param prefs - UI preferences object to save.
   * @returns True if successfully saved.
   */
  static async savePrefs(prefs: UiPreferences): Promise<boolean> {
    return await this.write(STORAGE_KEYS.PREFS, prefs);
  }

  /**
   * Loads post engagement history records.
   * @returns History engagement records.
   */
  static async loadHistory<T = any[]>(): Promise<T> {
    try {
      const legacy = localStorage.getItem("ig_modal_suite_history_v1");
      if (legacy && !localStorage.getItem(STORAGE_KEYS.HISTORY)) {
        localStorage.setItem(STORAGE_KEYS.HISTORY, legacy);
      }
    } catch (_) {}
    return await this.read<T>(STORAGE_KEYS.HISTORY, [] as unknown as T);
  }

  /**
   * Saves post engagement history records capped to 2000 entries.
   * @param records - History records to persist.
   * @returns True if successfully saved.
   */
  static async saveHistory<T = any[]>(records: T[]): Promise<boolean> {
    const trimmed = records.length > 2000 ? records.slice(-2000) : records;
    return await this.write(STORAGE_KEYS.HISTORY, trimmed);
  }

  /**
   * Clears history records across chrome.storage.local and localStorage.
   */
  static async clearHistory(): Promise<void> {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        await chrome.storage.local.remove([STORAGE_KEYS.HISTORY]);
      } catch (_) {}
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem("ig_modal_suite_history_v1");
    } catch (_) {}
  }

  /**
   * Loads saved comment deck queue and shuffle state.
   * @returns Deck state.
   */
  static async loadDeck(): Promise<DeckState> {
    return await this.read<DeckState>(STORAGE_KEYS.DECK, {
      queue: [],
      lastDrawn: null,
      poolHash: "",
    });
  }

  /**
   * Saves comment deck queue and state.
   * @param deckData - Deck queue, lastDrawn, and poolHash state.
   * @returns True if successfully saved.
   */
  static async saveDeck(deckData: DeckState): Promise<boolean> {
    return await this.write(STORAGE_KEYS.DECK, deckData);
  }

  /**
   * Registers a reactive listener for chrome.storage.local changes.
   * @param callback - Change notification callback.
   * @returns Unsubscribe cleanup function.
   */
  static listen(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): () => void {
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      const handler = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName === "local") {
          callback(changes);
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
    return () => {};
  }
}
