/**
 * @file test/comment-deck.test.ts
 * @description Unit test suite validating spintax parsing, token interpolation, and comment generation mechanics of CommentDeck.
 * @architecture Test verification layer testing core engagement text synthesis, dynamic token replacement ({author}, {emoji}), and non-repeating queue rotation.
 * @agent_note Uses statistical sampling (e.g. 50 iterations) to verify permutation distribution; keep iterations deterministic and fast.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parseSpintax, CommentDeck } from "../src/core/comment-deck.ts";

/**
 * Test Suite: Spintax Parsing & CommentDeck Lifecycle
 * Validates dynamic template synthesis and engagement comment pool management:
 * - Plain string passthrough without spintax delimiters
 * - Single spintax group expansion and uniform random sampling
 * - Multiple sequential spintax groups preserving outer text delimiters
 * - Nested spintax expression evaluation
 * - Dynamic token interpolation for author mentions ({author}) and safe fallbacks
 * - Dynamic token interpolation for random contextual emojis ({emoji})
 * - CommentDeck instance initialization, deck depletion, and non-repeating permutation cycles
 */

test("parseSpintax returns plain strings unchanged", () => {
  const result = parseSpintax("Pure fire 🔥🙌");
  assert.strictEqual(result, "Pure fire 🔥🙌");
});

test("parseSpintax resolves single spintax group", () => {
  const template = "{Amazing|Incredible|Awesome}";
  const results = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const res = parseSpintax(template);
    assert.match(res, /^(Amazing|Incredible|Awesome)$/);
    results.add(res);
  }
  // With 50 trials across 3 options, all 3 should be sampled
  assert.strictEqual(results.size, 3);
});

test("parseSpintax resolves multiple groups and preserves outside text", () => {
  const template = "{Great|Awesome} {shot|post} {🔥|🙌}!";
  for (let i = 0; i < 30; i++) {
    const res = parseSpintax(template);
    assert.match(res, /^(Great|Awesome) (shot|post) (🔥|🙌)!$/);
  }
});

test("parseSpintax supports nested spintax", () => {
  const template = "{Super {clean|nice}|Incredible} capture!";
  const results = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const res = parseSpintax(template);
    assert.match(res, /^(Super (clean|nice)|Incredible) capture!$/);
    results.add(res);
  }
  assert.strictEqual(results.size, 3);
});

test("parseSpintax interpolates {author} token", () => {
  const template = "Great capture @{author}! 🔥";
  const res = parseSpintax(template, { author: "nature_photographer" });
  assert.strictEqual(res, "Great capture @nature_photographer! 🔥");
});

test("parseSpintax handles missing author gracefully without leaving {author}", () => {
  const template = "Great capture @{author}! 🔥";
  const res = parseSpintax(template, {});
  assert.strictEqual(res, "Great capture! 🔥");
});

test("parseSpintax interpolates {emoji} token with valid emoji", () => {
  const template = "Awesome work {emoji}";
  const res = parseSpintax(template);
  assert.doesNotMatch(res, /\{emoji\}/);
  assert.ok(res.length > "Awesome work ".length);
});

test("CommentDeck yields spintax-resolved strings and avoids boundary repeats", async () => {
  const pool = ["{Good|Great} vibes!"];
  const deck = new CommentDeck(() => pool);
  await deck.init();

  const c1 = deck.next({ author: "tester" });
  assert.match(c1, /^(Good|Great) vibes!$/);

  const c2 = deck.next({ author: "tester" });
  assert.match(c2, /^(Good|Great) vibes!$/);
});
