/**
 * @file scanner.ts
 * @description Provides DOM element discovery, selector healing, geometric heuristics, and action block detection for Instagram's web interface.
 * @architecture Serves as the primary DOM discovery and diagnostic engine leveraged by InstagramDOMAdapter and WorkflowEngine.
 * @agent_note When modifying scoring heuristics or SVG path matches, ensure multi-language aria labels and responsive layout variants remain covered.
 */

/**
 * International action labels for multi-lingual action button recognition.
 */
export const MULTILINGUAL_LABELS = {
  LIKE: [
    "like",
    "me gusta",
    "curtir",
    "j’aime",
    "j'aime",
    "gefällt mir",
    "mi piace",
    "нравится",
    "좋아요",
    "いいね！",
    "いいね",
    "赞",
    "讚",
    "suka",
    "beğen",
    "lubię to",
  ],
  UNLIKE: [
    "unlike",
    "ya no me gusta",
    "descurtir",
    "je n’aime plus",
    "je n'aime plus",
    "gefällt mir nicht mehr",
    "non mi piace più",
    "не нравится",
    "좋아요 취소",
    "「いいね！」を取り消す",
    "取消赞",
    "取消讚",
    "batal suka",
    "beğenmekten vazgeç",
    "nie lubię",
  ],
  NEXT: [
    "next",
    "siguiente",
    "avançar",
    "suivant",
    "weiter",
    "avanti",
    "далее",
    "다음",
    "次へ",
    "下一页",
    "下一頁",
    "selanjutnya",
    "sonraki",
    "dalej",
  ],
  POST_SUBMIT: [
    "post",
    "publicar",
    "publier",
    "posten",
    "pubblica",
    "опубликовать",
    "게시",
    "投稿する",
    "发布",
    "發布",
    "kirim",
    "paylaş",
    "opublikuj",
  ],
  COMMENT: [
    "comment",
    "comentar",
    "commenter",
    "kommentieren",
    "commenta",
    "комментировать",
    "댓글 달기",
    "コメント",
    "评论",
    "評論",
  ],
} as const;

/**
 * String patterns used to detect Instagram rate limit, checkpoint, and action block dialogs.
 */
export const ACTION_BLOCK_PHRASES: string[] = [
  "try again later",
  "action blocked",
  "we limit how often",
  "we restrict certain activity",
  "temporarily blocked",
  "help us confirm that you've noticed this",
  "suspicious activity",
  "confirm it's you",
  "feedback_required",
  "checkpoint_required",
  "acción bloqueada",
  "intentar de nuevo más tarde",
  "action bloquée",
  "essayez plus tard",
  "azione bloccata",
  "gesperrt",
];

const POST_PATH_REGEX = /\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;

export interface PostInfo {
  type: string;
  shortcode: string;
  canonicalPath: string;
}

export interface FeedPost {
  element: HTMLElement;
  type: string;
  shortcode: string;
  canonicalPath: string;
  author: string;
}

export interface LikeProbeResult {
  element: HTMLElement;
  svg: SVGElement;
  state: "liked" | "unliked";
  score: number;
  confidence: number;
  strategy: string;
}

export interface CommentProbeInput {
  element: HTMLElement;
  type: "textarea" | "contenteditable";
  strategy: string;
  confidence: number;
}

export interface CommentProbeSubmit {
  element: HTMLElement;
  text: string;
  confidence: number;
  strategy: string;
}

export interface CommentProbeResult {
  input: CommentProbeInput | null;
  submit: CommentProbeSubmit | null;
}

export interface NextProbeResult {
  element: HTMLElement | null;
  isFeedScroll?: boolean;
  feedCount?: number;
  strategy: string;
  confidence: number;
}

export interface UserProbeResult {
  handle: string | null;
  strategy: string;
  confidence: number;
}

export interface GridLink extends PostInfo {
  element: HTMLElement;
}

export interface ActionBlockResult {
  isBlocked: boolean;
  reason: string;
  element: HTMLElement;
  detectedAt: string;
}

export interface DiagnosticAnchor {
  status: "PASS" | "WARN" | "FAIL";
  name: string;
  found: boolean;
  confidence: number;
  strategy?: string;
  tag?: string;
  state?: string;
  type?: string;
  handle?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  timestampFormatted: string;
  overallHealthScore: number;
  status: "PASS" | "WARN" | "FAIL";
  isPostViewOpen: boolean;
  currentPost: PostInfo | null;
  gridCount: number;
  anchors: {
    container: DiagnosticAnchor;
    likeButton: DiagnosticAnchor;
    commentInput: DiagnosticAnchor;
    postSubmit: DiagnosticAnchor;
    nextNavigation: DiagnosticAnchor;
    userAccount: DiagnosticAnchor;
  };
}

/**
 * Self-healing DOM discovery scanner using geometric, semantic, and structural heuristics.
 */
export class DOMScanner {
  cachedStrategies: Record<string, any>;
  lastDiagnosticReport: DiagnosticReport | null;
  isScanning: boolean;
  activeFeedElement: HTMLElement | null;

  /**
   * Initializes scanner cache, diagnostic state, and scan flags.
   */
  constructor() {
    this.cachedStrategies = {
      container: null,
      likeButton: null,
      commentInput: null,
      postSubmit: null,
      nextNavigation: null,
      userAccount: null,
    };
    this.lastDiagnosticReport = null;
    this.isScanning = false;
    this.activeFeedElement = null;
  }

  /**
   * Sets the currently active feed article DOM element.
   * @param element - Active feed container element.
   */
  setActiveFeedElement(element: HTMLElement | null): void {
    this.activeFeedElement = element || null;
  }

  /**
   * Retrieves the currently active feed article DOM element.
   * @returns Active feed container or null.
   */
  getActiveFeedElement(): HTMLElement | null {
    return this.activeFeedElement && (typeof this.activeFeedElement.isConnected === "boolean" ? this.activeFeedElement.isConnected : true)
      ? this.activeFeedElement
      : null;
  }

  /**
   * Determines if the user is currently on an infinite scroll feed page (e.g. Home feed with no profile dialog).
   * @returns True if active view is feed mode.
   */
  isFeedMode(): boolean {
    if (typeof window === "undefined" || !window.location) return false;
    if (typeof document !== "undefined" && document.querySelector('div[role="dialog"]')) {
      return false;
    }

    const path = (window.location.pathname || "").toLowerCase().replace(/^\/+|\/+$/g, "");
    if (!path || path === "" || path === "feed") return true;

    // Check if path is a post permalink or profile
    if (POST_PATH_REGEX.test(window.location.pathname)) return false;

    // If there is an article feed on the page and no profile grid
    if (typeof document !== "undefined") {
      const articles = document.querySelectorAll("main article, article");
      const gridThumbnails = document.querySelectorAll('a[href^="/p/"] img, a[href^="/reel/"] img');
      if (articles.length > 0 && gridThumbnails.length === 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scans and collects all post articles present in the infinite scroll feed.
   * @returns Array of probed feed posts.
   */
  probeFeedPosts(): FeedPost[] {
    if (typeof document === "undefined") return [];
    const articles = Array.from(document.querySelectorAll("main article, article[role='presentation'], article")) as HTMLElement[];
    const results: FeedPost[] = [];
    const seenShortcodes = new Set<string>();

    for (const article of articles) {
      const link = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      if (!link) continue;

      const href = link.getAttribute("href") || "";
      const info = this.extractPostInfo(href);
      if (!info || seenShortcodes.has(info.shortcode)) continue;

      seenShortcodes.add(info.shortcode);
      const authorLink = article.querySelector('header a[href^="/"], div[role="button"] header a[href^="/"]');
      const author = authorLink ? this.normalizeUsername(authorLink.getAttribute("href") || "") : "";

      results.push({
        element: article,
        type: info.type,
        shortcode: info.shortcode,
        canonicalPath: info.canonicalPath,
        author,
      });
    }

    return results;
  }

  /**
   * Normalizes an Instagram username handle.
   * @param name - Raw username string or URL.
   * @returns Lowercase normalized username handle.
   */
  normalizeUsername(name: string): string {
    return String(name || "")
      .replace(/^@|^\/+|\/+$/g, "")
      .trim()
      .toLowerCase();
  }

  /**
   * Extracts post type and shortcode from any URL or path.
   * @param urlOrPath - Post URL or pathname string.
   * @returns Extracted post info.
   */
  extractPostInfo(urlOrPath: string): PostInfo | null {
    const match = String(urlOrPath || "").match(POST_PATH_REGEX);
    if (!match) return null;
    return {
      type: match[1],
      shortcode: match[2],
      canonicalPath: `/${match[1]}/${match[2]}/`,
    };
  }

  /**
   * Returns current active post shortcode/path.
   * @returns Current post info or null.
   */
  getCurrentPostInfo(): PostInfo | null {
    const fromPath = this.extractPostInfo(window.location.pathname);
    if (fromPath) return fromPath;

    const modal = this.resolveContainer();
    if (modal) {
      const link = modal.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      if (link) {
        return this.extractPostInfo(link.getAttribute("href") || "");
      }
    }
    return null;
  }

  /**
   * Resolves the active post container (Dialog modal, active feed article, or Permalinks).
   * @param targetIdentifier - Optional shortcode string or explicit HTMLElement.
   * @returns Post container element or null.
   */
  resolveContainer(targetIdentifier: string | HTMLElement | null = null): HTMLElement | null {
    if (typeof document === "undefined") return null;

    // 1. Explicit HTMLElement passed and connected
    if (targetIdentifier && typeof targetIdentifier === "object" && "nodeType" in targetIdentifier) {
      const el = targetIdentifier as HTMLElement;
      if (typeof el.isConnected === "boolean" ? el.isConnected : true) {
        return el;
      }
    }

    // 2. Specific shortcode passed: match exact post container
    if (typeof targetIdentifier === "string" && targetIdentifier.trim()) {
      const sc = targetIdentifier.trim();
      const link = document.querySelector(`a[href*="/p/${sc}/"], a[href*="/reel/${sc}/"]`);
      if (link) {
        const article =
          (typeof link.closest === "function" && (link.closest("article") || link.closest('div[role="dialog"]'))) ||
          link.parentElement;
        if (article) return article as HTMLElement;
      }
    }

    // 3. Modal dialog takes priority if open
    const modal = (document.querySelector('div[role="dialog"] article') || document.querySelector('div[role="dialog"]')) as HTMLElement | null;
    if (modal) return modal;

    // 4. Active feed element if tracked and connected
    if (this.activeFeedElement) {
      const isConnected = typeof this.activeFeedElement.isConnected === "boolean" ? this.activeFeedElement.isConnected : true;
      if (isConnected) return this.activeFeedElement;
    }

    // 5. In feed mode or infinite scroll, probe feed articles
    if (this.isFeedMode()) {
      const feedPosts = this.probeFeedPosts();
      if (feedPosts.length > 0) {
        // Return article closest to viewport center or first one
        if (typeof window !== "undefined" && window.innerHeight) {
          const centerY = window.innerHeight / 2;
          let closest = feedPosts[0].element;
          let minDistance = Infinity;
          for (const item of feedPosts) {
            if (typeof item.element.getBoundingClientRect === "function") {
              const rect = item.element.getBoundingClientRect();
              const itemCenter = rect.top + rect.height / 2;
              const dist = Math.abs(itemCenter - centerY);
              if (dist < minDistance) {
                minDistance = dist;
                closest = item.element;
              }
            }
          }
          return closest;
        }
        return feedPosts[0].element;
      }
    }

    // 6. Generic candidates fallback
    const candidates = [
      'main article',
      'article[role="presentation"]',
      'article',
    ];

    for (const selector of candidates) {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el && (el.querySelector("svg") || el.querySelector("img, video"))) {
        return el;
      }
    }
    return null;
  }

  /**
   * Determines if the heart SVG path matches Instagram's characteristic heart geometry.
   * @param svg - SVG DOM element to inspect.
   * @returns True if matching heart SVG path geometry.
   */
  matchesHeartPathSignature(svg: SVGElement | null): boolean {
    if (!svg) return false;
    const paths = Array.from(svg.querySelectorAll("path"));
    if (paths.length === 0) return false;

    for (const path of paths) {
      const d = path.getAttribute("d") || "";
      // Instagram heart paths standard signature patterns
      if (
        d.includes("M16.792") ||
        d.includes("M34.6") ||
        d.includes("M12 21.35") ||
        d.includes("M12 4.248") ||
        (d.startsWith("M") && d.includes("C") && (d.includes("Z") || d.includes("z")))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scans for Instagram Action Block, Rate Limit, or Checkpoint modals.
   * Returns details if an active block dialog is present, otherwise null.
   * @param scope - Scope element to inspect.
   * @returns Detected action block details or null.
   */
  probeActionBlock(scope?: HTMLElement | Document | null): ActionBlockResult | null {
    const doc = scope || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;

    try {
      // Check dialog elements first
      const dialogs = Array.from(
        doc.querySelectorAll ? doc.querySelectorAll('div[role="dialog"], div[role="alertdialog"], [aria-modal="true"]') : []
      ) as HTMLElement[];

      for (const dialog of dialogs) {
        const text = (dialog.textContent || "").toLowerCase();
        for (const phrase of ACTION_BLOCK_PHRASES) {
          if (text.includes(phrase)) {
            return {
              isBlocked: true,
              reason: phrase,
              element: dialog,
              detectedAt: new Date().toISOString(),
            };
          }
        }
      }

      // Check general alert or toast if no dialog matched
      const fallbackTarget = (doc.querySelector ? doc.querySelector('div[role="alert"]') : null) as HTMLElement | null;
      if (fallbackTarget) {
        const alertText = (fallbackTarget.textContent || "").toLowerCase();
        for (const phrase of ACTION_BLOCK_PHRASES) {
          if (alertText.includes(phrase)) {
            return {
              isBlocked: true,
              reason: phrase,
              element: fallbackTarget,
              detectedAt: new Date().toISOString(),
            };
          }
        }
      }
    } catch (_) {}

    return null;
  }

  /**
   * Scans and scores candidate Like / Unlike buttons in the container.
   * @param container - Post container element to probe.
   * @returns Best candidate like button or null.
   */
  probeLikeButton(container?: HTMLElement | null): LikeProbeResult | null {
    const root = container || this.resolveContainer() || document;
    const svgs = Array.from(root.querySelectorAll("svg")) as SVGElement[];

    let bestCandidate: LikeProbeResult | null = null;
    let highestScore = -1;

    for (const svg of svgs) {
      // Must not be inside comment lists
      if (svg.closest("ul, li")) continue;

      let score = 0;
      const ariaLabel = (svg.getAttribute("aria-label") || "").trim().toLowerCase();
      const width = Number(svg.getAttribute("width")) || svg.clientWidth || 0;
      const height = Number(svg.getAttribute("height")) || svg.clientHeight || 0;
      const is24 = (width === 24 || height === 24) || (width >= 20 && width <= 28);
      const isActionSection = Boolean(svg.closest("section") || svg.closest('div[role="button"]'));

      const isLikeText = MULTILINGUAL_LABELS.LIKE.some((l) => ariaLabel === l || ariaLabel.includes(l));
      const isUnlikeText = MULTILINGUAL_LABELS.UNLIKE.some((l) => ariaLabel === l || ariaLabel.includes(l));

      if (isLikeText || isUnlikeText) score += 45;
      if (is24) score += 30;
      if (isActionSection) score += 15;
      if (this.matchesHeartPathSignature(svg)) score += 25;

      const interactiveWrapper = (svg.closest('div[role="button"], button') || svg.parentElement) as HTMLElement | null;
      if (interactiveWrapper) score += 10;

      if (score > highestScore && score >= 40) {
        highestScore = score;

        // Determine current state
        const fill = (typeof window !== "undefined" ? window.getComputedStyle(svg).fill : "") || svg.getAttribute("fill") || "";
        const isRed =
          fill.includes("255, 48, 64") ||
          fill.includes("237, 73, 86") ||
          fill.includes("rgb(255") ||
          fill === "#ff3040" ||
          fill === "#ed4956";

        const state: "liked" | "unliked" = (isUnlikeText || isRed) ? "liked" : "unliked";

        bestCandidate = {
          element: interactiveWrapper || (svg as unknown as HTMLElement),
          svg,
          state,
          score,
          confidence: Math.min(100, Math.round((score / 125) * 100)),
          strategy: isLikeText || isUnlikeText ? "aria_label_multilingual" : "svg_geometry_signature",
        };
      }
    }

    return bestCandidate;
  }

  /**
   * Scans and verifies Comment input field and Submit trigger.
   * @param container - Post container element to probe.
   * @returns Probed comment system handles.
   */
  probeCommentSystem(container?: HTMLElement | null): CommentProbeResult {
    const root = container || this.resolveContainer() || document;

    let inputCandidate: CommentProbeInput | null = null;

    // Strategy A: Standard Textarea
    const textarea = root.querySelector(
      'textarea[placeholder*="comment" i], textarea[aria-label*="comment" i], form textarea, textarea'
    ) as HTMLElement | null;
    if (textarea) {
      inputCandidate = {
        element: textarea,
        type: "textarea",
        strategy: "standard_textarea",
        confidence: 98,
      };
    }

    // Strategy B: Lexical / DraftJS ContentEditable
    if (!inputCandidate) {
      const contentEditable = root.querySelector(
        'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][aria-label*="comment" i], div[contenteditable="true"]'
      ) as HTMLElement | null;
      if (contentEditable) {
        inputCandidate = {
          element: contentEditable,
          type: "contenteditable",
          strategy: "lexical_contenteditable",
          confidence: 95,
        };
      }
    }

    // Locate Submit Trigger
    let submitCandidate: CommentProbeSubmit | null = null;
    const form = inputCandidate ? inputCandidate.element.closest("form") || root : root;
    const buttons = Array.from(
      form.querySelectorAll('div[role="button"], button[type="submit"], button')
    ) as HTMLElement[];

    for (const b of buttons) {
      const text = (b.textContent || "").trim().toLowerCase();
      const isSubmitKeyword = MULTILINGUAL_LABELS.POST_SUBMIT.some((k) => text === k || text.includes(k));
      const isSubmitType = b.getAttribute("type") === "submit";

      if (isSubmitKeyword || isSubmitType) {
        submitCandidate = {
          element: b,
          text: (b.textContent || "").trim(),
          confidence: 96,
          strategy: isSubmitType ? "form_submit_button" : "submit_keyword_match",
        };
        break;
      }
    }

    return {
      input: inputCandidate,
      submit: submitCandidate,
    };
  }

  /**
   * Scans for Next Post Navigation Trigger.
   * On modal dialogs, detects arrow navigation buttons.
   * On home feed, detects vertical infinite scroll capability.
   * @returns Probed next navigation trigger.
   */
  probeNextNavigation(): NextProbeResult {
    // Feed Mode: The next post is below the current one on the infinite scroll page
    if (this.isFeedMode()) {
      const feedPosts = this.probeFeedPosts();
      return {
        element: null,
        isFeedScroll: true,
        feedCount: feedPosts.length,
        strategy: "feed_infinite_scroll_down",
        confidence: feedPosts.length > 0 ? 98 : 80,
      };
    }

    const allSvgs = Array.from(document.querySelectorAll("svg")) as SVGElement[];
    const nextSvg = allSvgs.find((svg) => {
      const label = (svg.getAttribute("aria-label") || "").trim().toLowerCase();
      return MULTILINGUAL_LABELS.NEXT.some((l) => label === l || label.includes(l));
    });

    if (nextSvg) {
      const btn = (nextSvg.closest('button, a, div[role="button"]') || nextSvg.parentElement) as HTMLElement | null;
      return {
        element: btn,
        strategy: "svg_next_aria_label",
        confidence: 99,
      };
    }

    const nextBtn = document.querySelector('button[aria-label="Next"], a[aria-label="Next"]') as HTMLElement | null;
    if (nextBtn) {
      return {
        element: nextBtn,
        strategy: "button_aria_next",
        confidence: 95,
      };
    }

    return {
      element: null,
      strategy: "keyboard_arrow_right_fallback",
      confidence: 85,
    };
  }

  /**
   * Resolves the logged-in user handle.
   * @param configuredUsername - Explicitly configured user handle.
   * @returns Probed user handle and confidence.
   */
  probeUserAccount(configuredUsername = ""): UserProbeResult {
    if (configuredUsername && configuredUsername.trim()) {
      return {
        handle: this.normalizeUsername(configuredUsername),
        strategy: "user_configuration",
        confidence: 100,
      };
    }

    // Strategy A: Profile links in navigation
    if (typeof document === "undefined") return { handle: null, strategy: "unresolved", confidence: 0 };
    const reserved = new Set([
      "explore", "reels", "direct", "accounts", "p", "reel",
      "stories", "threads", "settings", "archive", "your_activity",
    ]);

    const navLinks = Array.from(
      document.querySelectorAll('nav a[href^="/"], div[role="navigation"] a[href^="/"], header a[href^="/"]')
    ) as HTMLElement[];

    for (const link of navLinks) {
      const isProfile =
        (link.textContent || "").trim().toLowerCase() === "profile" ||
        Boolean(link.querySelector('img[alt*="profile picture" i], img[alt*="profil" i]'));

      if (isProfile) {
        const handle = this.normalizeUsername(link.getAttribute("href") || "");
        if (handle && !handle.includes("/") && !reserved.has(handle)) {
          return {
            handle,
            strategy: "navigation_profile_link",
            confidence: 98,
          };
        }
      }
    }

    // Strategy B: Embedded scripts viewer tag
    try {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const text = s.textContent || "";
        if (!text.includes("username")) continue;
        const match =
          text.match(/"viewer"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/) ||
          text.match(/"username"\s*:\s*"([a-zA-Z0-9._]{1,30})"\s*,\s*"is_verified"/);
        if (match && match[1]) {
          return {
            handle: this.normalizeUsername(match[1]),
            strategy: "embedded_script_viewer",
            confidence: 92,
          };
        }
      }
    } catch (_) {}

    return {
      handle: "",
      strategy: "unresolved",
      confidence: 0,
    };
  }

  /**
   * Scans page thumbnail links on profile grids and explore feeds.
   * @returns Discovered grid post anchors.
   */
  probeGridLinks(): GridLink[] {
    const scope = (document.querySelector("main") || document.body) as HTMLElement;
    if (!scope) return [];
    const allAnchors = Array.from(scope.querySelectorAll("a[href]")) as HTMLElement[];
    const seen = new Set<string>();
    const valid: GridLink[] = [];

    for (const a of allAnchors) {
      if (a.closest("header") || a.closest('div[role="dialog"]')) continue;
      const info = this.extractPostInfo(a.getAttribute("href") || "");
      if (!info || seen.has(info.shortcode)) continue;
      if (!a.querySelector("img, video, svg, div")) continue;

      seen.add(info.shortcode);
      valid.push({ element: a, ...info });
    }

    return valid;
  }

  /**
   * Runs the complete diagnostic suite and returns a unified Health Report.
   * @param configuredUsername - Configured account username for validation.
   * @returns Comprehensive DOM diagnostic health report.
   */
  async runFullDiagnostics(configuredUsername = ""): Promise<DiagnosticReport> {
    this.isScanning = true;
    const now = new Date();

    const container = this.resolveContainer();
    const likeProbe = this.probeLikeButton(container);
    const commentProbe = this.probeCommentSystem(container);
    const nextProbe = this.probeNextNavigation();
    const userProbe = this.probeUserAccount(configuredUsername);
    const gridLinks = this.probeGridLinks();
    const postInfo = this.getCurrentPostInfo();

    // Compute Overall Health Score
    let scoreSum = 0;
    let totalWeights = 0;

    const addScore = (probe: { confidence?: number } | null | undefined, weight: number) => {
      totalWeights += weight;
      if (probe && probe.confidence) {
        scoreSum += (probe.confidence / 100) * weight;
      }
    };

    addScore(likeProbe, 30);
    addScore(commentProbe.input, 25);
    addScore(commentProbe.submit, 15);
    addScore(nextProbe, 15);
    addScore(userProbe, 15);

    const overallHealthScore = Math.round((scoreSum / totalWeights) * 100);

    const report: DiagnosticReport = {
      timestamp: now.toISOString(),
      timestampFormatted: now.toLocaleTimeString(),
      overallHealthScore,
      status: overallHealthScore >= 75 ? "PASS" : overallHealthScore >= 45 ? "WARN" : "FAIL",
      isPostViewOpen: Boolean(container && likeProbe),
      currentPost: postInfo,
      gridCount: gridLinks.length,
      anchors: {
        container: {
          status: container ? "PASS" : "WARN",
          name: "Post Container Anchor",
          found: Boolean(container),
          tag: container ? container.tagName.toLowerCase() : "none",
          confidence: container ? 100 : 0,
        },
        likeButton: {
          status: likeProbe ? "PASS" : "WARN",
          name: "Action Bar Like/Unlike Trigger",
          found: Boolean(likeProbe),
          state: likeProbe?.state || "unknown",
          confidence: likeProbe?.confidence || 0,
          strategy: likeProbe?.strategy || "not_found",
        },
        commentInput: {
          status: commentProbe.input ? "PASS" : "WARN",
          name: "Comment Input Engine",
          found: Boolean(commentProbe.input),
          type: commentProbe.input?.type || "none",
          confidence: commentProbe.input?.confidence || 0,
          strategy: commentProbe.input?.strategy || "not_found",
        },
        postSubmit: {
          status: commentProbe.submit ? "PASS" : "WARN",
          name: "Comment Submission Trigger",
          found: Boolean(commentProbe.submit),
          confidence: commentProbe.submit?.confidence || 0,
          strategy: commentProbe.submit?.strategy || "not_found",
        },
        nextNavigation: {
          status: (nextProbe.element || nextProbe.isFeedScroll) ? "PASS" : "WARN",
          name: nextProbe.isFeedScroll ? "Feed Infinite Scroll Navigation" : "Next Post Navigation Arrow",
          found: Boolean(nextProbe.element || nextProbe.isFeedScroll),
          confidence: nextProbe.confidence || 0,
          strategy: nextProbe.strategy,
        },
        userAccount: {
          status: userProbe.handle ? "PASS" : "WARN",
          name: "Active Account Detection",
          found: Boolean(userProbe.handle),
          handle: userProbe.handle ? `@${userProbe.handle}` : "Not detected",
          confidence: userProbe.confidence || 0,
          strategy: userProbe.strategy,
        },
      },
    };

    this.lastDiagnosticReport = report;
    this.isScanning = false;
    return report;
  }
}
