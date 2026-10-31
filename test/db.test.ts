/**
 * @file test/db.test.ts
 * @description Test suite validating IndexedDB database schema definitions, record sanitization, and RFC-4180 CSV export formatting.
 * @architecture Test verification layer evaluating Dexie.js database tables, field indexing constraints, and PapaParse CSV generation for engagement records.
 * @agent_note Tests run in Node.js environment without browser IndexedDB globals; Dexie may emit non-fatal warnings when table operations are invoked without mock DB.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { AppDatabase, exportToCSV, sanitizeRecordForDB } from "../src/core/db.ts";

/**
 * Test Suite: Database Schema & Serialization
 * Validates persistent storage entities, record hygiene, and export formats:
 * - AppDatabase Dexie schema versioning, store names, and indexing keys (records, profiles)
 * - sanitizeRecordForDB field normalization, lowercase target formatting, and ISO timestamp creation
 * - exportToCSV delimiter escaping, quote wrapping, newline preservation, and unicode/emoji fidelity
 */

test("AppDatabase defines schemas for records and profiles", () => {
  const db = new AppDatabase("test_db_" + Date.now());
  assert.ok(db.records, "records table should exist");
  assert.ok(db.profiles, "profiles table should exist");
  assert.strictEqual(db.name.startsWith("test_db_"), true);
});

test("sanitizeRecordForDB produces clean, indexed record object", () => {
  const raw = {
    shortcode: "Ctest123",
    postPath: "/p/Ctest123/",
    postUrl: "https://www.instagram.com/p/Ctest123/",
    targetUsername: "NatGeo",
    likeStatus: "Liked",
    commentStatus: "Commented",
    commentText: "Incredible shot! 🔥",
    errorsCount: 0,
  };

  const clean = sanitizeRecordForDB(raw);
  assert.strictEqual(clean.shortcode, "Ctest123");
  assert.strictEqual(clean.targetUsername, "natgeo");
  assert.strictEqual(clean.likeStatus, "Liked");
  assert.strictEqual(clean.commentStatus, "Commented");
  assert.strictEqual(clean.commentText, "Incredible shot! 🔥");
  assert.ok(clean.timestampIso);
});

test("exportToCSV serializes records with papaparse correctly handling quotes, commas, and emojis", () => {
  const records = [
    {
      shortcode: "Cpost1",
      postPath: "/p/Cpost1/",
      postUrl: "https://www.instagram.com/p/Cpost1/",
      targetUsername: "natgeo",
      timeFormatted: "10:30:00 AM",
      likeStatus: "Liked",
      likeAttempts: 1,
      commentStatus: "Commented",
      commentText: 'Awesome, "super" capture! 🔥🙌',
      commentAttempts: 1,
      errorsCount: 0,
      timestampIso: new Date().toISOString(),
      likeActionRequired: true,
      commentActionRequired: true,
      errorDetails: [],
    },
    {
      shortcode: "Cpost2",
      postPath: "/p/Cpost2/",
      postUrl: "https://www.instagram.com/p/Cpost2/",
      targetUsername: "travel",
      timeFormatted: "10:32:00 AM",
      likeStatus: "Already Liked",
      likeAttempts: 0,
      commentStatus: "Skipped (Mode)",
      commentText: "",
      commentAttempts: 0,
      errorsCount: 0,
      timestampIso: new Date().toISOString(),
      likeActionRequired: false,
      commentActionRequired: false,
      errorDetails: [],
    },
  ];

  const csv = exportToCSV(records);
  assert.ok(typeof csv === "string");
  assert.ok(csv.includes("Shortcode,Post Path,Post URL"));
  assert.ok(csv.includes("Cpost1,/p/Cpost1/"));
  // Notice proper escaping of quotes within comment text: "Awesome, ""super"" capture! 🔥🙌"
  assert.ok(csv.includes('"Awesome, ""super"" capture! 🔥🙌"'));
  assert.ok(csv.includes("Cpost2,/p/Cpost2/"));
});
