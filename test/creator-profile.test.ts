/**
 * @file test/creator-profile.test.ts
 * @description Test suite verifying creator portfolio metadata integrity, attribution consistency, and manifest author specifications.
 * @architecture Test verification layer ensuring synchronized developer credentials and external portfolio links across package, manifest, and popup views.
 * @agent_note Reads manifest.json, package.json, and popup.html from disk; changes to author details or repository paths will require updating these assertions.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CREATOR } from "../src/data/creatorProfile.ts";

/**
 * Test Suite: Creator Profile & Author Attribution
 * Validates brand identity synchronization and developer metadata consistency:
 * - CREATOR profile constants (name, alias, portfolio URL, email, social links, technology stack)
 * - Manifest V3 author attribution fields
 * - package.json author field correspondence
 * - Popup HTML meta author tag compliance
 */

test("CREATOR profile exports author details imported from JimFleax_Portfolio", () => {
  assert.strictEqual(CREATOR.name, "Reetabrata Bhandari");
  assert.strictEqual(CREATOR.alias, "Jim Fleax");
  assert.strictEqual(CREATOR.siteUrl, "https://jimfleax.in");
  assert.strictEqual(CREATOR.email, "reetabrata.bhandari@gmail.com");

  assert.ok(CREATOR.socials.github.includes("github.com/jimfleax"));
  assert.ok(CREATOR.socials.linkedin.includes("linkedin.com/in/jimfleax"));
  assert.ok(CREATOR.socials.x.includes("x.com/jimfleax"));

  assert.ok(Array.isArray(CREATOR.technologies));
  assert.ok(CREATOR.technologies.some((t: string) => t.includes("React")));

  assert.ok(Array.isArray(CREATOR.projects));
  assert.ok(CREATOR.projects.length > 0);
  assert.ok(CREATOR.projects[0].title);
  assert.ok(CREATOR.projects[0].description);
});

test("Manifest and package metadata indicate Reetabrata Bhandari as creator/author", () => {
  const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf-8"));
  assert.strictEqual(manifest.author, "Reetabrata Bhandari");

  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
  assert.ok(pkg.author.includes("Reetabrata Bhandari"));

  const popupHtml = fs.readFileSync("./popup/popup.html", "utf-8");
  assert.ok(popupHtml.includes('name="author" content="Reetabrata Bhandari"'));
});
