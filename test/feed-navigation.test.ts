/**
 * @file test/feed-navigation.test.ts
 * @description Test suite validating infinite-scroll feed page detection, post article discovery, and vertical navigation.
 * @architecture Test verification layer testing DOMScanner feed heuristics, active container resolution, and WorkflowEngine feed navigation.
 * @agent_note Tests mock window.location, document.querySelectorAll, and scroll methods; ensures global cleanup in try/finally blocks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DOMScanner } from "../src/core/scanner.ts";
import { InstagramDOMAdapter } from "../src/core/instagram-dom.ts";
import { WorkflowEngine } from "../src/core/workflow.ts";

/**
 * Test Suite: Infinite Scroll Feed Navigation & Post Resolution
 * Validates:
 * - isFeedMode() accuracy across Home Feed, Profiles, Permalinks, and Active Modal Dialogs
 * - probeFeedPosts() scanning and deduplication of post articles, shortcodes, and author handles
 * - resolveContainer() active feed element tracking, shortcode targeted lookup, and center-viewport heuristics
 * - probeNextNavigation() auto-detection of feed_infinite_scroll_down strategy in feed mode
 * - WorkflowEngine.ensureFirstPostOpened() initializing feed mode without modal requirements
 * - WorkflowEngine.advanceToNextPost() scrolling to subsequent unvisited posts below current one
 * - WorkflowEngine.advanceToNextFeedPost() triggering window.scrollBy when rendered articles are exhausted
 */

test("DOMScanner.isFeedMode detects Home Feed vs profile vs dialog modal", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  const scanner = new DOMScanner();

  // Case 1: Home Feed URL "/" with no dialog modal
  (globalThis as any).window = { location: { pathname: "/" } };
  (globalThis as any).document = {
    querySelector: (sel: string) => (sel.includes("dialog") ? null : null),
    querySelectorAll: (sel: string) => (sel.includes("article") ? [{}] : []),
  };
  assert.strictEqual(scanner.isFeedMode(), true);

  // Case 2: Dialog modal is open (even on "/") -> Not in raw feed mode
  (globalThis as any).document.querySelector = (sel: string) => (sel.includes("dialog") ? {} : null);
  assert.strictEqual(scanner.isFeedMode(), false);

  // Case 3: Post permalink "/p/Cabc123/"
  (globalThis as any).window.location.pathname = "/p/Cabc123/";
  (globalThis as any).document.querySelector = () => null;
  assert.strictEqual(scanner.isFeedMode(), false);

  // Case 4: Profile URL "/travel_photography/" with no feed articles
  (globalThis as any).window.location.pathname = "/travel_photography/";
  (globalThis as any).document.querySelectorAll = (sel: string) => (sel.includes("article") ? [] : []);
  assert.strictEqual(scanner.isFeedMode(), false);

  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
});

test("DOMScanner.probeFeedPosts scans post articles and extracts shortcodes and authors", () => {
  const originalDocument = globalThis.document;

  const mockArticle1 = {
    querySelector: (sel: string) => {
      if (sel.includes("/p/")) {
        return { getAttribute: (attr: string) => (attr === "href" ? "/p/Cpost001/" : null) };
      }
      if (sel.includes("header")) {
        return { getAttribute: (attr: string) => (attr === "href" ? "/photographer_one/" : null) };
      }
      return null;
    },
  };

  const mockArticle2 = {
    querySelector: (sel: string) => {
      if (sel.includes("/p/")) {
        return { getAttribute: (attr: string) => (attr === "href" ? "/reel/Creel002/" : null) };
      }
      if (sel.includes("header")) {
        return { getAttribute: (attr: string) => (attr === "href" ? "/creator_two/" : null) };
      }
      return null;
    },
  };

  (globalThis as any).document = {
    querySelectorAll: (sel: string) => (sel.includes("article") ? [mockArticle1, mockArticle2] : []),
  };

  try {
    const scanner = new DOMScanner();
    const posts = scanner.probeFeedPosts();

    assert.strictEqual(posts.length, 2);
    assert.strictEqual(posts[0].shortcode, "Cpost001");
    assert.strictEqual(posts[0].type, "p");
    assert.strictEqual(posts[0].author, "photographer_one");
    assert.strictEqual(posts[0].element, mockArticle1);

    assert.strictEqual(posts[1].shortcode, "Creel002");
    assert.strictEqual(posts[1].type, "reel");
    assert.strictEqual(posts[1].author, "creator_two");
    assert.strictEqual(posts[1].element, mockArticle2);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("DOMScanner.resolveContainer respects active feed element and shortcode targeting", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  const mockArticle1 = { id: "art1", isConnected: true, querySelector: () => ({}) };
  const mockArticle2 = { id: "art2", isConnected: true, querySelector: () => ({}) };

  (globalThis as any).window = { location: { pathname: "/" }, innerHeight: 900 };
  (globalThis as any).document = {
    querySelector: (sel: string) => {
      if (sel.includes("CtargetShortcode")) {
        return {
          closest: (s: string) => (s.includes("article") ? mockArticle2 : null),
        };
      }
      return null;
    },
    querySelectorAll: () => [mockArticle1, mockArticle2],
  };

  try {
    const scanner = new DOMScanner();

    // 1. Explicit shortcode lookup
    const resolvedByShortcode = scanner.resolveContainer("CtargetShortcode");
    assert.strictEqual(resolvedByShortcode, mockArticle2);

    // 2. Tracked active feed element
    scanner.setActiveFeedElement(mockArticle1 as any);
    const resolvedByActive = scanner.resolveContainer();
    assert.strictEqual(resolvedByActive, mockArticle1);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("DOMScanner.probeNextNavigation returns feed_infinite_scroll_down in feed mode", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  (globalThis as any).window = { location: { pathname: "/" } };
  (globalThis as any).document = {
    querySelector: () => null,
    querySelectorAll: (sel: string) => {
      if (sel.includes("article")) {
        return [
          {
            querySelector: (s: string) => (s.includes("/p/") ? { getAttribute: () => "/p/Cfeed1/" } : null),
          },
        ];
      }
      return [];
    },
  };

  try {
    const scanner = new DOMScanner();
    const probe = scanner.probeNextNavigation();

    assert.strictEqual(probe.isFeedScroll, true);
    assert.strictEqual(probe.strategy, "feed_infinite_scroll_down");
    assert.strictEqual(probe.confidence, 98);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("WorkflowEngine.ensureFirstPostOpened centers on first unvisited post in feed mode", async () => {
  const wf = new WorkflowEngine();

  let scrolledIntoView = false;
  const mockArticle = {
    id: "feed-post-1",
    isConnected: true,
    scrollIntoView: () => {
      scrolledIntoView = true;
    },
    querySelector: () => ({}),
  };

  wf.dom.isFeedMode = () => true;
  wf.dom.collectFeedPosts = () => [
    {
      element: mockArticle as any,
      type: "p",
      shortcode: "CfeedPost1",
      canonicalPath: "/p/CfeedPost1/",
      author: "creator1",
    },
  ];

  const opened = await wf.ensureFirstPostOpened();

  assert.strictEqual(opened, true);
  assert.strictEqual(scrolledIntoView, true);
  assert.strictEqual(wf.dom.getActiveFeedElement(), mockArticle);
});

test("WorkflowEngine.advanceToNextFeedPost scrolls to next unvisited post below current one", async () => {
  const wf = new WorkflowEngine();
  wf.dom.isFeedMode = () => true;

  let scrolledElement = null;
  const mockArticle1 = {
    id: "post-1",
    isConnected: true,
    scrollIntoView: () => {
      scrolledElement = "post-1";
    },
  };
  const mockArticle2 = {
    id: "post-2",
    isConnected: true,
    scrollIntoView: () => {
      scrolledElement = "post-2";
    },
  };

  const feedPosts = [
    { element: mockArticle1 as any, type: "p", shortcode: "Cpost1", canonicalPath: "/p/Cpost1/", author: "a1" },
    { element: mockArticle2 as any, type: "p", shortcode: "Cpost2", canonicalPath: "/p/Cpost2/", author: "a2" },
  ];

  wf.dom.collectFeedPosts = () => feedPosts;
  wf.state.visitedShortcodes.add("Cpost1");

  // Mock post info changing after navigation
  let activeCode = "Cpost1";
  wf.dom.getCurrentPostInfo = () => ({
    type: "p",
    shortcode: activeCode,
    canonicalPath: `/p/${activeCode}/`,
  });

  wf.dom.setActiveFeedElement = (el) => {
    if (el === (mockArticle2 as any)) {
      activeCode = "Cpost2";
    }
  };

  const moved = await wf.advanceToNextFeedPost("Cpost1");

  assert.strictEqual(moved, true);
  assert.strictEqual(scrolledElement, "post-2");
  assert.strictEqual(activeCode, "Cpost2");
});

test("WorkflowEngine.advanceToNextFeedPost triggers window.scrollBy when rendered articles are exhausted", async () => {
  const originalWindow = globalThis.window;

  let windowScrolled = false;
  (globalThis as any).window = {
    innerHeight: 800,
    scrollBy: ({ top }: { top: number }) => {
      if (top > 0) windowScrolled = true;
    },
  };

  try {
    const wf = new WorkflowEngine();
    wf.dom.isFeedMode = () => true;

    const mockArticleNew = {
      id: "post-infinite",
      isConnected: true,
      scrollIntoView: () => {},
    };

    let callCount = 0;
    wf.dom.collectFeedPosts = () => {
      callCount++;
      // First call: only exhausted post1
      if (callCount <= 1) {
        return [{ element: {} as any, type: "p", shortcode: "Cexhausted1", canonicalPath: "/p/Cexhausted1/", author: "a" }];
      }
      // After scrollBy: Instagram loads post-infinite
      return [
        { element: {} as any, type: "p", shortcode: "Cexhausted1", canonicalPath: "/p/Cexhausted1/", author: "a" },
        { element: mockArticleNew as any, type: "p", shortcode: "CfreshAfterScroll", canonicalPath: "/p/CfreshAfterScroll/", author: "b" },
      ];
    };

    wf.state.visitedShortcodes.add("Cexhausted1");

    let activeCode = "Cexhausted1";
    wf.dom.getCurrentPostInfo = () => ({
      type: "p",
      shortcode: activeCode,
      canonicalPath: `/p/${activeCode}/`,
    });

    wf.dom.setActiveFeedElement = (el) => {
      if (el === (mockArticleNew as any)) {
        activeCode = "CfreshAfterScroll";
      }
    };

    const moved = await wf.advanceToNextFeedPost("Cexhausted1");

    assert.strictEqual(windowScrolled, true);
    assert.strictEqual(moved, true);
    assert.strictEqual(activeCode, "CfreshAfterScroll");
  } finally {
    globalThis.window = originalWindow;
  }
});
