/**
 * @file test/vision-context.test.ts
 * @description Test suite validating accessibility alt-text image recognition, keyword extraction, and contextual comment token resolution.
 * @architecture Test verification layer testing computer-vision heuristic parsing from DOM image alt attributes into contextual spintax tokens ({topic}, {category}).
 * @agent_note Tests simulate DOM elements with mock alt text; verifies regex keyword stripping and fallback token handling when vision data is absent.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPostVisionContext,
  resolveContextualTokens,
  cleanAltKeywords,
} from "../src/core/vision-context.ts";

/**
 * Test Suite: Computer Vision Heuristics & Contextual Tokens
 * Validates optical analysis heuristics and contextual comment generation:
 * - cleanAltKeywords parsing of Instagram auto-generated accessibility captions ("May be an image of...")
 * - Filtering of generic words, dates, author names, and stopwords
 * - extractPostVisionContext extraction of high-priority topic keywords from DOM image elements
 * - resolveContextualTokens interpolation of dynamic {topic} and {category} tokens
 * - Graceful fallback substitutions when vision metadata is unavailable
 */

test("cleanAltKeywords parses Instagram auto-generated alt strings", () => {
  const rawAlt =
    "Photo by natgeo on October 31, 2026. May be an image of snow, mountain, nature, and outdoor.";
  const keywords = cleanAltKeywords(rawAlt);

  assert.ok(Array.isArray(keywords));
  assert.ok(keywords.includes("snow"));
  assert.ok(keywords.includes("mountain"));
  assert.ok(keywords.includes("nature"));
  assert.ok(keywords.includes("outdoor"));
  assert.ok(!keywords.includes("and"));
});

test("cleanAltKeywords returns empty array on missing or generic alt text", () => {
  assert.deepStrictEqual(cleanAltKeywords(""), []);
  assert.deepStrictEqual(cleanAltKeywords("No photo description available."), []);
  assert.deepStrictEqual(cleanAltKeywords(null as any), []);
});

test("extractPostVisionContext extracts vision keywords and primary topic from DOM root", () => {
  const mockRoot = {
    querySelectorAll: (sel: string) => {
      if (sel.includes("img")) {
        return [
          {
            getAttribute: (attr: string) =>
              attr === "alt"
                ? "May be an image of sunset, ocean, and beach."
                : null,
          },
        ];
      }
      return [];
    },
    querySelector: () => null,
  };

  const context = extractPostVisionContext(mockRoot as any);
  assert.strictEqual(context.hasVisionData, true);
  assert.strictEqual(context.primaryTopic, "sunset");
  assert.ok(context.keywords.includes("ocean"));
  assert.ok(context.keywords.includes("beach"));
});

test("resolveContextualTokens interpolates {topic} and {category} seamlessly", () => {
  const template = "Stunning {topic} view @{author}! 🔥";
  const context = {
    primaryTopic: "mountain",
    author: "natgeo",
  };

  const resolved = resolveContextualTokens(template, context);
  assert.strictEqual(resolved, "Stunning mountain view @natgeo! 🔥");
});

test("resolveContextualTokens falls back gracefully when vision context is absent", () => {
  const template = "Awesome {topic} @{author}!";
  const context = {
    primaryTopic: "",
    author: "creator",
  };

  const resolved = resolveContextualTokens(template, context);
  assert.strictEqual(resolved, "Awesome shot @creator!");
});
