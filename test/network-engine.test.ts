/**
 * @file test/network-engine.test.ts
 * @description Test suite validating Instagram network engine primitives, shortcode decoding, CSRF extraction, challenge detection, and deprecation fallbacks.
 * @architecture Test verification layer exercising REST API request handling, HTTP error status parsing (429, 404), and seamless failover flag management.
 * @agent_note Stubs globalThis.fetch to simulate Instagram API responses; always restore originalFetch in finally blocks to avoid polluting subsequent tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { InstagramNetworkEngine, shortcodeToMediaId } from "../src/core/network-engine.ts";

/**
 * Test Suite: Instagram Network Engine Core
 * Validates low-level network utilities, credential parsers, and API lifecycle:
 * - shortcodeToMediaId base64 permutation conversion to BigInt media IDs
 * - extractPostInfo pathname decomposition into shortcodes and canonical URLs
 * - extractCsrfToken cookie extraction and regex parsing
 * - checkChallenge HTTP status and body heuristics for 429 rate limits and feedback blocks
 * - validateEndpoints verification of CSRF tokens and Facebook App ID credentials
 * - isEndpointDeprecated and markEndpointDeprecated handling 404 response codes
 * - sendLike and sendComment automatic failover flagging on legacy endpoint deprecation
 */

test("shortcodeToMediaId correctly decodes standard Instagram shortcodes", () => {
  // Known Instagram shortcode decoding pairs
  // e.g. "B_abc" or shortcodes using IG base64 alphabet:
  // "B" -> 1
  // "C" -> 2
  // "D" -> 3
  // Base64 value of "B" is 1. If length 1: id = 1n -> "1"
  assert.strictEqual(shortcodeToMediaId("B"), "1");
  assert.strictEqual(shortcodeToMediaId("C"), "2");
  assert.strictEqual(shortcodeToMediaId("BA"), "64"); // 1 * 64 + 0 = 64
  assert.strictEqual(shortcodeToMediaId("BB"), "65"); // 1 * 64 + 1 = 65

  // Real world shortcode example
  const mediaId = shortcodeToMediaId("CxXYZ123456");
  assert.ok(typeof mediaId === "string");
  assert.match(mediaId, /^\d+$/);
  assert.ok(BigInt(mediaId) > 0n);
});

test("shortcodeToMediaId returns null on invalid or empty shortcodes", () => {
  assert.strictEqual(shortcodeToMediaId(""), null);
  assert.strictEqual(shortcodeToMediaId(null as any), null);
  assert.strictEqual(shortcodeToMediaId("???invalid"), null);
});

test("extractPostInfo resolves post type, shortcode, and numeric mediaId", () => {
  const engine = new InstagramNetworkEngine();
  const info = engine.extractPostInfo("/p/CxXYZ123456/");
  assert.ok(info);
  assert.strictEqual(info.type, "p");
  assert.strictEqual(info.shortcode, "CxXYZ123456");
  assert.ok(typeof info.mediaId === "string");
  assert.strictEqual(info.canonicalPath, "/p/CxXYZ123456/");
});

test("extractCsrfToken extracts csrftoken from cookie string", () => {
  const engine = new InstagramNetworkEngine();
  const mockCookie = "mid=XYZ; csrftoken=abc123token456; ds_user_id=12345";
  const token = engine.extractCsrfToken(mockCookie);
  assert.strictEqual(token, "abc123token456");
});

test("checkChallenge detects 429 rate limit and feedback_required", () => {
  const engine = new InstagramNetworkEngine();

  const rateLimitRes = { status: 429, ok: false, data: null };
  const rlResult = engine.checkChallenge(rateLimitRes as any);
  assert.ok(rlResult);
  assert.match(rlResult, /429|Rate limit/i);

  const blockRes = { status: 400, ok: false, data: { message: "feedback_required", spam: true } };
  const blkResult = engine.checkChallenge(blockRes as any);
  assert.ok(blkResult);
  assert.match(blkResult, /feedback_required|blocked/i);

  const normalRes = { status: 200, ok: true, data: { status: "ok" } };
  assert.strictEqual(engine.checkChallenge(normalRes as any), null);
});

test("validateEndpoints checks readiness of CSRF and App ID", async () => {
  const engine = new InstagramNetworkEngine();
  engine.csrfToken = "test_csrf_token";
  engine.appId = "936619743392459";

  const validation = await engine.validateEndpoints();
  assert.strictEqual(validation.isReady, true);
  assert.strictEqual(validation.hasCsrf, true);
  assert.strictEqual(validation.hasAppId, true);
  assert.strictEqual(validation.isAvailable, true);
});

test("isEndpointDeprecated detects 404 Not Found as deprecated endpoint", () => {
  const engine = new InstagramNetworkEngine();
  const notFoundRes = { status: 404, ok: false, data: null };
  assert.strictEqual(engine.isEndpointDeprecated(notFoundRes as any), true);

  const okRes = { status: 200, ok: true, data: {} };
  assert.strictEqual(engine.isEndpointDeprecated(okRes as any), false);
});

test("markEndpointDeprecated marks isAvailable as false with descriptive reason", () => {
  const engine = new InstagramNetworkEngine();
  assert.strictEqual(engine.isAvailable, true);

  engine.markEndpointDeprecated(404, "Endpoint 404 Not Found");
  assert.strictEqual(engine.isAvailable, false);
  assert.match(engine.unsupportedReason, /404/i);
});

test("sendLike and sendComment mark endpoint as deprecated on 404 response", async () => {
  const engine = new InstagramNetworkEngine();
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async () => ({
    status: 404,
    ok: false,
    json: async () => ({ message: "Not Found", status: "fail" }),
  });

  try {
    const likeRes = await engine.sendLike("1234567890");
    assert.strictEqual(likeRes.status, 404);
    assert.strictEqual(engine.isAvailable, false);
    assert.match(engine.unsupportedReason, /404/i);

    const commentRes = await engine.sendComment("1234567890", "Test comment");
    assert.strictEqual(commentRes.status, 404);
    assert.strictEqual(engine.isAvailable, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
