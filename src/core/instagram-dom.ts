/**
 * @file instagram-dom.ts
 * @description Provides high-level DOM interactions and state checks for Instagram posts, modals, and input fields.
 * @architecture Acts as an abstraction layer between WorkflowEngine and DOMScanner/KineticEngine for UI manipulation.
 * @agent_note Relies on DOMScanner heuristics; ensure simulated inputs trigger React synthetic event pipelines properly.
 */
import { DOMScanner, type PostInfo, type FeedPost, type LikeProbeResult, type CommentProbeInput, type GridLink } from "./scanner.ts";
import { dispatchHumanClick } from "./kinetic-engine.ts";
import { extractPostVisionContext, type PostVisionContext } from "./vision-context.ts";

export interface CommentInputHandle {
  element: HTMLElement;
  type: "textarea" | "contenteditable";
}

/**
 * High-level DOM adapter bridging automated workflow actions to Instagram's dynamic interface.
 */
export class InstagramDOMAdapter {
  scanner: DOMScanner;

  /**
   * Creates an InstagramDOMAdapter instance with a DOM scanner dependency.
   * @param scanner - Scanner instance used for element probing.
   */
  constructor(scanner?: DOMScanner) {
    this.scanner = scanner || new DOMScanner();
  }

  /**
   * Extracts post type, shortcode, and canonical path from a URL or pathname.
   * @param urlOrPath - Path or full URL of an Instagram post.
   * @returns Extracted post info.
   */
  extractPostInfo(urlOrPath: string): PostInfo | null {
    return this.scanner.extractPostInfo(urlOrPath);
  }

  /**
   * Retrieves post metadata from current window URL or active dialog link.
   * @returns Active post info.
   */
  getCurrentPostInfo(): PostInfo | null {
    return this.scanner.getCurrentPostInfo();
  }

  /**
   * Strips URL prefixes, symbols, and whitespace from a username handle.
   * @param name - Raw username string or link href.
   * @returns Clean lowercase username handle.
   */
  normalizeUsername(name: string): string {
    return this.scanner.normalizeUsername(name);
  }

  /**
   * Injects or updates an overlay badge element on thumbnail anchors.
   * @param anchorEl - Post link thumbnail element.
   * @param text - Text to display in the badge.
   * @param bg - Background color hex or CSS string.
   */
  paintBadge(anchorEl: HTMLElement | null, text: string, bg = "#111827"): void {
    if (!anchorEl || typeof document === "undefined") return;
    try {
      if (window.getComputedStyle(anchorEl).position === "static") {
        anchorEl.style.position = "relative";
      }
      let b = anchorEl.querySelector(".ig-automator-badge") as HTMLElement | null;
      if (!b) {
        b = document.createElement("div");
        b.className = "ig-automator-badge";
        b.style.cssText =
          "position:absolute;top:8px;left:8px;z-index:25;padding:3px 8px;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);pointer-events:none;transition:all 0.2s ease;";
        anchorEl.appendChild(b);
      }
      b.textContent = text;
      b.style.background = bg;
    } catch (_) {}
  }

  /**
   * Resolves the active post modal or presentation article element.
   * @returns Container root element.
   */
  getModalRoot(): HTMLElement | null {
    return this.scanner.resolveContainer();
  }

  /**
   * Determines whether a post detail dialog is currently open in the DOM.
   * @returns True if an active post view is open.
   */
  isPostViewOpen(): boolean {
    const root = this.scanner.resolveContainer();
    if (!root) return false;
    const probe = this.scanner.probeLikeButton(root);
    return Boolean(probe && probe.element);
  }

  /**
   * Scans the current page for grid post thumbnail elements and shortcodes.
   * @returns Grid post links.
   */
  collectGridPostLinks(): GridLink[] {
    return this.scanner.probeGridLinks();
  }

  /**
   * Probes the like button candidate inside a given post container.
   * @param root - Post modal or container element.
   * @returns Probed like button metadata or null.
   */
  resolveLikeButton(root?: HTMLElement | null): LikeProbeResult | null {
    return this.scanner.probeLikeButton(root);
  }

  /**
   * Locates the active comment input element handle within a container.
   * @param root - Post modal or container element.
   * @returns Input handle with element and type.
   */
  resolveCommentInput(root?: HTMLElement | null): CommentProbeInput | null {
    const probe = this.scanner.probeCommentSystem(root);
    return probe.input;
  }

  /**
   * Locates the comment submission trigger button within a container.
   * @param root - Post modal or container element.
   * @returns Submit button element or null.
   */
  resolvePostSubmitButton(root?: HTMLElement | null): HTMLElement | null {
    const probe = this.scanner.probeCommentSystem(root);
    return probe.submit?.element || null;
  }

  /**
   * Determines whether the active view is in infinite scroll feed mode.
   * @returns True if on feed page with no modal dialog.
   */
  isFeedMode(): boolean {
    return this.scanner.isFeedMode();
  }

  /**
   * Scans the page and collects all post articles present in the infinite scroll feed.
   * @returns Feed post elements and metadata.
   */
  collectFeedPosts(): FeedPost[] {
    return this.scanner.probeFeedPosts();
  }

  /**
   * Sets the active feed post article element.
   * @param element - Feed article element.
   */
  setActiveFeedElement(element: HTMLElement | null): void {
    this.scanner.setActiveFeedElement(element);
  }

  /**
   * Retrieves the active feed post article element.
   * @returns Active feed article element or null.
   */
  getActiveFeedElement(): HTMLElement | null {
    return this.scanner.getActiveFeedElement();
  }

  /**
   * Locates the next post navigation button or navigation trigger.
   * In feed mode, returns null because navigation is handled via vertical scrolling.
   * @returns Navigation trigger element or null.
   */
  resolveNextButton(): HTMLElement | null {
    if (this.isFeedMode()) return null;
    const probe = this.scanner.probeNextNavigation();
    return probe.element;
  }

  /**
   * Extracts the post author handle from the modal header.
   * @param root - Post modal or container element.
   * @returns Post author handle or empty string.
   */
  getPostAuthorUsername(root?: HTMLElement | null): string {
    if (!root) return "";
    const headerLink = root.querySelector('header a[href^="/"], div[role="button"] header a[href^="/"]') as HTMLElement | null;
    if (!headerLink) return "";
    return this.normalizeUsername(headerLink.getAttribute("href") || "");
  }

  /**
   * Checks whether comments are disabled or limited on the target post.
   * @param root - Post modal or container element.
   * @returns True if comments are disabled or restricted.
   */
  isCommentsDisabled(root?: HTMLElement | null): boolean {
    if (!root) return false;
    const text = (root.textContent || "").toLowerCase();
    return (
      text.includes("comments on this post have been limited") ||
      text.includes("comments have been limited") ||
      text.includes("comments are off") ||
      text.includes("comments have been turned off") ||
      text.includes("comentarios limitados") ||
      text.includes("kommentare sind deaktiviert")
    );
  }

  /**
   * Inspects comment list to detect if the active user has already commented.
   * @param root - Post modal or container element.
   * @param activeUsername - Logged-in user handle to check.
   * @returns True if existing comment by user is detected.
   */
  hasAlreadyCommented(root: HTMLElement | null, activeUsername: string): boolean {
    if (!root || !activeUsername) return false;
    const normalizedUser = this.normalizeUsername(activeUsername);
    const authorUser = this.getPostAuthorUsername(root);

    const links = Array.from(root.querySelectorAll("a[href]")) as HTMLElement[];
    let authorCaptionEncountered = false;

    for (const link of links) {
      if (link.closest("header") || link.closest("section")) continue;

      const hrefUser = this.normalizeUsername(link.getAttribute("href") || "");
      const textUser = this.normalizeUsername(link.textContent || "");
      const matchesUser = hrefUser === normalizedUser || textUser === normalizedUser;

      if (!matchesUser) continue;

      // Filter out inline @mentions in comment text (someone tagging the user)
      if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
        try {
          const style = window.getComputedStyle(link);
          const isBold = style.fontWeight === "600" || style.fontWeight === "700" || parseInt(style.fontWeight, 10) >= 600;
          const startsWithAt = (link.textContent || "").trim().startsWith("@");
          if (!isBold && startsWithAt) {
            continue; // Inline mention
          }
        } catch (_) {}
      }

      if (normalizedUser === authorUser && !authorCaptionEncountered) {
        authorCaptionEncountered = true;
        continue;
      }

      const parentText = (link.parentElement?.textContent || "").toLowerCase();
      if (parentText.includes("liked by") || parentText.includes("les gusta a")) {
        continue;
      }

      return true;
    }
    return false;
  }

  /**
   * Extracts vision context, detected objects, and primary topic from the active post.
   * @param root - Post modal or container element.
   * @returns Vision metadata.
   */
  getPostVisionContext(root?: HTMLElement | null): PostVisionContext {
    return extractPostVisionContext(root);
  }

  /**
   * Dispatches an authentic human pointer click sequence on a DOM element.
   * @param element - Target element to click.
   */
  triggerClick(element: HTMLElement | null): void {
    if (!element) return;
    dispatchHumanClick(element);
  }

  /**
   * Humanely fills comment text into a textarea or contenteditable element.
   * @param root - Post modal or container element.
   * @param text - Comment text to insert.
   * @returns Input element handle or null on error.
   */
  fillCommentInput(root: HTMLElement | null, text: string): CommentInputHandle | null {
    if (!root) return null;

    let probe = this.scanner.probeCommentSystem(root);
    let inputHandle = probe.input;

    // If input is not immediately visible (e.g. on feed posts), click the comment icon to expand the input box
    if (!inputHandle || !inputHandle.element) {
      const commentBtn =
        (root.querySelector('svg[aria-label*="comment" i], svg[aria-label*="coment" i]')?.closest('div[role="button"], button') ||
        root.querySelector('button[aria-label*="comment" i], button[aria-label*="coment" i]')) as HTMLElement | null;
      if (commentBtn) {
        this.triggerClick(commentBtn);
        probe = this.scanner.probeCommentSystem(root);
        inputHandle = probe.input;
      }
    }

    if (!inputHandle || !inputHandle.element) return null;

    const el = inputHandle.element;

    if (inputHandle.type === "textarea") {
      el.focus();
      const proto = window.HTMLTextAreaElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      const tracker = (el as any)._valueTracker;
      if (tracker) tracker.setValue((el as HTMLTextAreaElement).value);

      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        (el as HTMLTextAreaElement).value = text;
      }

      el.dispatchEvent(
        new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" })
      );
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { element: el, type: "textarea" };
    }

    // Lexical / DraftJS ContentEditable
    el.focus();
    try {
      document.execCommand("selectAll", false, undefined);
      document.execCommand("insertText", false, text);
    } catch (_) {
      el.textContent = text;
    }

    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" })
    );
    return { element: el, type: "contenteditable" };
  }

  /**
   * Determines if the comment input field has been successfully cleared after submission.
   * @param inputHandle - Handle for the comment input.
   * @returns True if the input field is empty.
   */
  isInputCleared(inputHandle: CommentInputHandle | null): boolean {
    if (!inputHandle || !inputHandle.element) return false;
    if (inputHandle.type === "textarea") {
      return (inputHandle.element as HTMLTextAreaElement).value.trim() === "";
    }
    return (inputHandle.element.textContent || "").trim() === "";
  }
}
