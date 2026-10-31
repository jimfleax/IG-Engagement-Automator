/**
 * @file test/kinetic-engine.test.ts
 * @description Test suite validating kinetic human emulation, natural keystroke latency algorithms, and synthetic pointer event chains.
 * @architecture Test verification layer assessing anti-bot humanization routines, digraph timing variance, and DOM click/type simulation accuracy.
 * @agent_note Simulates asynchronous typing using mock inputs and event loops; test tolerances must accommodate slight timer variances across platforms.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeKeystrokeDelay,
  dispatchHumanClick,
  simulateHumanType,
} from "../src/core/kinetic-engine.ts";

/**
 * Test Suite: Kinetic Engine & Human Emulation
 * Validates non-deterministic timing distributions and synthetic user interaction fidelity:
 * - computeKeystrokeDelay boundary constraints adhering to human motor limits (40ms-350ms)
 * - Cognitive pause injection following terminal punctuation marks (.!?)
 * - Digraph acceleration for frequent adjacent character pairs (e.g., 'th' faster than 'qz')
 * - dispatchHumanClick full DOM pointer event chain order (pointerdown, mousedown, focus, pointerup, mouseup, click)
 * - simulateHumanType character-by-character text population with synchronous input dispatch
 */

test("computeKeystrokeDelay returns delays within organic human limits", () => {
  for (let i = 0; i < 50; i++) {
    const delay = computeKeystrokeDelay("a", "b");
    assert.ok(delay >= 40, `Delay ${delay} is too fast for human typing`);
    assert.ok(delay <= 350, `Delay ${delay} is too slow for normal typing`);
  }
});

test("computeKeystrokeDelay introduces natural thinking pauses after punctuation", () => {
  computeKeystrokeDelay("h", "e");
  const punctuationDelay = computeKeystrokeDelay("!", "H");

  // Punctuation should have an added organic pause
  assert.ok(
    punctuationDelay >= 180,
    `Punctuation delay ${punctuationDelay} should be longer than normal`
  );
});

test("computeKeystrokeDelay speeds up common digraphs", () => {
  let thSum = 0;
  let qzSum = 0;
  const iterations = 50;

  for (let i = 0; i < iterations; i++) {
    thSum += computeKeystrokeDelay("t", "h");
    qzSum += computeKeystrokeDelay("q", "z");
  }

  const thAvg = thSum / iterations;
  const qzAvg = qzSum / iterations;

  assert.ok(
    thAvg < qzAvg,
    `Common digraph 'th' (${thAvg.toFixed(1)}ms) should type faster than 'qz' (${qzAvg.toFixed(1)}ms)`
  );
});

test("dispatchHumanClick dispatches full pointer and mouse event chain", () => {
  const eventsFired: string[] = [];
  const mockElement = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 200,
      width: 80,
      height: 30,
    }),
    dispatchEvent: (evt: Event) => {
      eventsFired.push(evt.type);
      return true;
    },
    focus: () => {
      eventsFired.push("focus");
    },
  };

  dispatchHumanClick(mockElement as any);

  assert.ok(eventsFired.includes("pointerdown"));
  assert.ok(eventsFired.includes("mousedown"));
  assert.ok(eventsFired.includes("focus"));
  assert.ok(eventsFired.includes("pointerup"));
  assert.ok(eventsFired.includes("mouseup"));
  assert.ok(eventsFired.includes("click"));
});

test("simulateHumanType types text character-by-character into input element", async () => {
  let currentValue = "";
  const mockInput = {
    value: "",
    tagName: "TEXTAREA",
    dispatchEvent: (evt: Event) => {
      if (evt.type === "input") {
        currentValue = mockInput.value;
      }
      return true;
    },
    focus: () => {},
  };

  // Run with minimal delay for fast testing
  await simulateHumanType(mockInput as any, "Hello!", { minDelayMs: 2, maxDelayMs: 5 });

  assert.strictEqual(mockInput.value, "Hello!");
  assert.strictEqual(currentValue, "Hello!");
});
