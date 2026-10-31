/**
 * @file test/workflow-modes.test.ts
 * @description Test suite validating workflow execution modes (DOM, API, Hybrid), storage settings sanitization, profile extraction, and error handling.
 * @architecture Test verification layer evaluating end-to-end workflow lifecycle, state machine transitions, hybrid failover triggers, and headless grid batches.
 * @agent_note Tests mock WorkflowEngine internals, globalThis.window, and globalThis.document; always clean up global mocks to prevent cross-test leakage.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { StorageService, DEFAULT_SETTINGS } from "../src/core/storage.ts";

/**
 * Test Suite: Workflow Engine Modes & Storage Orchestration
 * Validates automation workflows, execution modes, profile identification, and failover pathways:
 * - DEFAULT_SETTINGS configuration integrity (engineMode, engagementMode, action delays)
 * - StorageService.loadSettings sanitization and boundary clamping (probabilities, usernames, modes)
 * - StorageService.resolveSessionProfile and extractTargetProfileFromPath route matching and reserved path exclusion
 * - WorkflowEngine hybrid failover from 404 API deprecation to synthetic DOM interactions
 * - Automatic engine mode downgrading from API to DOM on persistent network failures
 * - DOM-based user identity and target creator resolution from page header/nav landmarks
 * - Headless grid batch execution and Hybrid Kickstart mutation acquisition on initial posts
 * - Headless batch mode bypassing modal loop fallthrough
 * - Profile subroute path parsing (/reels/, /tagged/, /channel/)
 * - Dynamic session reset and target updating upon navigation to a different creator profile
 * - Strict rejection and failure accounting for HTTP 200 responses bearing embedded GraphQL error payloads
 */

test("DEFAULT_SETTINGS contains engineMode, targetUsername, and action delays", () => {
  assert.ok("engagementMode" in DEFAULT_SETTINGS);
  assert.strictEqual(DEFAULT_SETTINGS.engagementMode, "both");
  assert.ok("engineMode" in DEFAULT_SETTINGS);
  assert.strictEqual(DEFAULT_SETTINGS.engineMode, "hybrid");
  assert.ok("targetUsername" in DEFAULT_SETTINGS);
  assert.strictEqual(DEFAULT_SETTINGS.targetUsername, "");
  assert.strictEqual(DEFAULT_SETTINGS.minActionDelayMs, 1200);
  assert.strictEqual(DEFAULT_SETTINGS.maxActionDelayMs, 2500);
});

test("StorageService.loadSettings sanitizes engineMode, engagementMode, and probabilities", async () => {
  const originalGetItem = (globalThis as any).localStorage?.getItem;
  (globalThis as any).localStorage = {
    getItem: (key: string) => {
      if (key === "ig_modal_suite_settings_v3") {
        return JSON.stringify({
          engineMode: "unsupported_mode",
          engagementMode: "invalid_mode",
          likeProbability: 150,
          commentProbability: -10,
          targetUsername: " @Nature_Photos/ ",
        });
      }
      return null;
    },
    setItem: () => {},
    removeItem: () => {},
  };

  const loaded = await StorageService.loadSettings();
  assert.strictEqual(loaded.engineMode, "hybrid"); // fallback
  assert.strictEqual(loaded.engagementMode, "both");
  assert.strictEqual(loaded.likeProbability, 100);
  assert.strictEqual(loaded.commentProbability, 0);
  assert.strictEqual(loaded.targetUsername, "nature_photos"); // cleaned

  if (originalGetItem) {
    (globalThis as any).localStorage.getItem = originalGetItem;
  }
});

test("StorageService.resolveSessionProfile detects target profile from path and ignores reserved routes", () => {
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/natgeo/"), "natgeo");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/explore/"), "");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/reels/"), "");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/p/C-XYZ123/"), "");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/direct/inbox/"), "");
});

test("WorkflowEngine falls back from 404 API response to DOM simulation seamlessly in hybrid mode", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.engineMode = "hybrid";
  wf.config.likeProbability = 100;
  wf.network.isAvailable = true;

  // Mock API returning 404 Not Found
  wf.network.sendLike = async () => {
    wf.network.markEndpointDeprecated(404, "Endpoint 404 Not Found");
    return { status: 404, ok: false, data: null, isConfirmedSuccess: false };
  };

  // Mock DOM simulation resolving like button
  let liked = false;
  wf.dom.getModalRoot = () => ({} as any);
  wf.dom.resolveLikeButton = () => ({
    element: {} as any,
    svg: {} as any,
    score: 100,
    confidence: 100,
    strategy: "test",
    state: (liked ? "liked" : "unliked") as "liked" | "unliked",
  });
  wf.dom.triggerClick = () => {
    liked = true;
  };

  const record: any = {
    shortcode: "Ctest12345",
    mediaId: "12345678",
    postPath: "/p/Ctest12345/",
    likeActionRequired: true,
    likeStatus: "Pending",
    likeAttempts: 0,
    errorsCount: 0,
    errorDetails: [],
  };

  await wf.processLikeStep(record);

  assert.strictEqual(wf.network.isAvailable, false);
  assert.strictEqual(record.likeStatus, "Liked");
});

test("WorkflowEngine in API mode auto-switches to DOM simulation on 404 endpoint deprecation", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.engineMode = "api";
  wf.config.likeProbability = 100;
  wf.network.isAvailable = true;

  // Mock API returning 404 Not Found
  wf.network.sendLike = async () => {
    wf.network.markEndpointDeprecated(404, "Endpoint 404 Not Found");
    return { status: 404, ok: false, data: null, isConfirmedSuccess: false };
  };

  // Mock DOM simulation resolving like button
  let liked = false;
  wf.dom.getModalRoot = () => ({} as any);
  wf.dom.resolveLikeButton = () => ({
    element: {} as any,
    svg: {} as any,
    score: 100,
    confidence: 100,
    strategy: "test",
    state: (liked ? "liked" : "unliked") as "liked" | "unliked",
  });
  wf.dom.triggerClick = () => {
    liked = true;
  };

  const record: any = {
    shortcode: "Ctest12345",
    mediaId: "12345678",
    postPath: "/p/Ctest12345/",
    likeActionRequired: true,
    likeStatus: "Pending",
    likeAttempts: 0,
    errorsCount: 0,
    errorDetails: [],
  };

  await wf.processLikeStep(record);

  assert.strictEqual(wf.network.isAvailable, false);
  assert.strictEqual(record.likeStatus, "Liked");
});

test("StorageService.resolveSessionProfile resolves myUsername and targetUsername from DOM elements", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  (globalThis as any).window = {
    location: { pathname: "/p/Cxyz12345/" },
  };

  (globalThis as any).document = {
    querySelectorAll: (sel: string) => {
      if (sel.includes("script")) return [];
      if (sel.includes("nav") || sel.includes("navigation") || sel.includes("aside") || sel.includes("link")) {
        return [
          {
            getAttribute: (attr: string) => (attr === "href" ? "/my_actual_user/" : null),
            textContent: "Profile",
            querySelector: (s: string) => (s.includes("img") ? { getAttribute: () => "profile" } : null),
          },
        ];
      }
      return [];
    },
    querySelector: (sel: string) => {
      if (sel.includes("header") || sel.includes("author") || sel.includes("role") || sel.includes("article")) {
        return {
          getAttribute: (attr: string) => (attr === "href" ? "/target_creator/" : null),
          textContent: "target_creator",
        };
      }
      return null;
    },
  };

  try {
    const profile = StorageService.resolveSessionProfile();
    assert.strictEqual(profile.myUsername, "my_actual_user");
    assert.strictEqual(profile.targetUsername, "target_creator");
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("runHeadlessGridBatch triggers Hybrid Kickstart on first post when GraphQL is unarmed", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.engineMode = "api";
  wf.config.maxPostsToProcess = 1;

  let modalOpened = false;
  wf.ensureFirstPostOpened = async () => {
    modalOpened = true;
    return true;
  };

  wf.dom.getCurrentPostInfo = () => ({
    type: "p",
    shortcode: "Ckickstart1",
    canonicalPath: "/p/Ckickstart1/",
  });

  wf.processLikeStep = async (record: any) => {
    record.likeStatus = "Liked";
  };
  wf.processCommentStep = async (record: any) => {
    record.commentStatus = "Commented";
  };

  await wf.runHeadlessGridBatch();

  assert.strictEqual(modalOpened, true);
  assert.strictEqual(wf.state.sessionChecked, 1);
  assert.strictEqual(wf.state.records[0].shortcode, "Ckickstart1");
});

test("WorkflowEngine.start in API mode does not fall through to Branch B modal loop", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.engineMode = "api";
  wf.config.maxPostsToProcess = 5;

  let branchBModalOpened = false;
  let headlessBatchRan = false;

  wf.scanner.runFullDiagnostics = async () => ({ overallHealthScore: 100, isPostViewOpen: false, gridCount: 12 } as any);
  wf.network.validateEndpoints = async () => ({ isReady: true, hasCsrf: true, hasAppId: true, isAvailable: true, csrfTokenSnippet: "" });
  wf.scanner.probeActionBlock = () => null;

  wf.runHeadlessGridBatch = async () => {
    headlessBatchRan = true;
    wf.state.sessionChecked = 5;
  };

  wf.ensureFirstPostOpened = async () => {
    branchBModalOpened = true;
    return true;
  };

  await wf.start();

  assert.strictEqual(headlessBatchRan, true);
  assert.strictEqual(branchBModalOpened, false, "Must not open post modals when in Headless API mode");
  assert.strictEqual(wf.state.status, "Completed");
});

test("StorageService.extractTargetProfileFromPath handles profile subroutes", () => {
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/theuniquescommunity/"), "theuniquescommunity");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/theuniquescommunity/reels/"), "theuniquescommunity");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/theuniquescommunity/tagged/"), "theuniquescommunity");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/theuniquescommunity/channel/"), "theuniquescommunity");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/explore/"), "");
  assert.strictEqual(StorageService.extractTargetProfileFromPath("/p/Ctest123/"), "");
});

test("WorkflowEngine.refreshPageContext updates target and resets completed session on profile change", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.targetUsername = "creator_old";
  wf.state.targetUsername = "creator_old";
  wf.state.status = "Completed";
  wf.state.sessionChecked = 50;

  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  (globalThis as any).window = {
    location: { pathname: "/theuniquescommunity/" },
  };

  (globalThis as any).document = {
    querySelectorAll: () => [],
    querySelector: (sel: string) => {
      if (sel.includes("header h2") || sel.includes("h1")) {
        return { textContent: "theuniquescommunity" };
      }
      return null;
    },
  };

  try {
    await wf.refreshPageContext();

    assert.strictEqual(wf.state.targetUsername, "theuniquescommunity");
    assert.strictEqual(wf.config.targetUsername, "theuniquescommunity");
    assert.strictEqual(wf.state.status, "Idle");
    assert.strictEqual(wf.state.sessionChecked, 0);
    assert.match(wf.state.statusDetail, /theuniquescommunity/);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("WorkflowEngine.processLikeStep rejects HTTP 200 GraphQL error and marks as Failed in API mode", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.engineMode = "api";
  wf.config.likeProbability = 100;
  wf.network.isAvailable = true;
  wf.dom.isPostViewOpen = () => false;

  // Mock API returning HTTP 200 with GraphQL error
  wf.network.sendLike = async () => ({
    status: 200,
    ok: false,
    isConfirmedSuccess: false,
    data: { data: null, errors: [{ message: "Feedback required" }] },
    error: "Feedback required",
  });

  const record: any = {
    shortcode: "Cerror123",
    mediaId: "12345678",
    postPath: "/p/Cerror123/",
    likeActionRequired: true,
    likeStatus: "Pending",
    likeAttempts: 0,
    errorsCount: 0,
    errorDetails: [],
  };

  await wf.processLikeStep(record);

  assert.strictEqual(record.likeStatus, "Failed");
  assert.strictEqual(wf.state.metrics.likesNew, 0);
  assert.strictEqual(wf.state.metrics.likesFailed, 1);
  assert.match(record.errorDetails[0], /Feedback required/i);
});

test("WorkflowEngine.processCommentStep rejects HTTP 200 GraphQL error and marks as Failed in API mode", async () => {
  const { WorkflowEngine } = await import("../src/core/workflow.ts");
  const wf = new WorkflowEngine();
  wf.config.engineMode = "api";
  wf.config.commentProbability = 100;
  wf.network.isAvailable = true;
  wf.dom.isPostViewOpen = () => false;

  // Mock API returning HTTP 200 with GraphQL error
  wf.network.sendComment = async () => ({
    status: 200,
    ok: false,
    isConfirmedSuccess: false,
    data: { data: null, errors: [{ message: "Rate limited" }] },
    error: "Rate limited",
  });

  const record: any = {
    shortcode: "Cerror123",
    mediaId: "12345678",
    postPath: "/p/Cerror123/",
    commentActionRequired: true,
    commentStatus: "Pending",
    commentAttempts: 0,
    errorsCount: 0,
    errorDetails: [],
  };

  await wf.processCommentStep(record);

  assert.strictEqual(record.commentStatus, "Failed");
  assert.strictEqual(wf.state.metrics.commentsNew, 0);
  assert.strictEqual(wf.state.metrics.commentsFailed, 1);
});
