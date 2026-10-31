/**
 * @file test/action-block.test.ts
 * @description Unit test suite validating DOMScanner detection of Instagram action blocks, rate-limit dialogs, and security checkpoints.
 * @architecture Test verification layer assessing DOMScanner resilience against anti-automation modal popups across various Instagram DOM states.
 * @agent_note Tests rely on mocked DOM document fixtures with querySelector/querySelectorAll; ensure simulated dialog text accurately matches IG blocks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DOMScanner } from "../src/core/scanner.ts";

/**
 * Test Suite: Action Block & Checkpoint Detection
 * Validates DOMScanner heuristics against Instagram anti-automation indicators:
 * - Clean page verification (returns null when no blocking modals exist)
 * - "Try Again Later" rate limit and temporary block dialog detection
 * - "Action Blocked" restriction modal detection
 * - Account checkpoint and suspicious activity verification challenge detection
 */

test("probeActionBlock returns null when page is clean", () => {
  const scanner = new DOMScanner();
  const mockDoc = {
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const result = scanner.probeActionBlock(mockDoc as any);
  assert.strictEqual(result, null);
});

test("probeActionBlock detects 'Try Again Later' block modal", () => {
  const scanner = new DOMScanner();
  const modalEl = {
    textContent: "Try Again Later. We limit how often you can do certain things on Instagram to protect our community.",
    getAttribute: (attr: string) => (attr === "role" ? "dialog" : null),
  };
  const mockDoc = {
    querySelectorAll: (sel: string) => (sel.includes("dialog") ? [modalEl] : []),
    querySelector: () => modalEl,
  };

  const result = scanner.probeActionBlock(mockDoc as any);
  assert.ok(result);
  assert.strictEqual(result.isBlocked, true);
  assert.match(result.reason, /Try Again Later/i);
});

test("probeActionBlock detects 'Action Blocked' dialog", () => {
  const scanner = new DOMScanner();
  const modalEl = {
    textContent: "Action Blocked: This action was blocked on your account.",
    getAttribute: (attr: string) => (attr === "role" ? "dialog" : null),
  };
  const mockDoc = {
    querySelectorAll: (sel: string) => (sel.includes("dialog") ? [modalEl] : []),
    querySelector: () => modalEl,
  };

  const result = scanner.probeActionBlock(mockDoc as any);
  assert.ok(result);
  assert.strictEqual(result.isBlocked, true);
  assert.match(result.reason, /Action Blocked/i);
});

test("probeActionBlock detects checkpoint / suspicious activity dialog", () => {
  const scanner = new DOMScanner();
  const modalEl = {
    textContent: "We detected suspicious activity on your account. Please confirm it's you.",
    getAttribute: (attr: string) => (attr === "role" ? "dialog" : null),
  };
  const mockDoc = {
    querySelectorAll: (sel: string) => (sel.includes("dialog") ? [modalEl] : []),
    querySelector: () => modalEl,
  };

  const result = scanner.probeActionBlock(mockDoc as any);
  assert.ok(result);
  assert.strictEqual(result.isBlocked, true);
  assert.match(result.reason, /suspicious/i);
});
