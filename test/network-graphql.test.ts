/**
 * @file test/network-graphql.test.ts
 * @description Test suite validating Instagram GraphQL query construction, mutation sniffing, payload verification, and GraphQL error detection.
 * @architecture Test verification layer ensuring modern Polaris GraphQL mutations (like/comment) are properly formatted, harvested, and strictly verified.
 * @agent_note Tests verify that HTTP 200 responses with GraphQL errors are correctly identified as failures rather than false positives.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  InstagramNetworkEngine,
  buildGraphQLBody,
  isServerConfirmationSuccess,
} from "../src/core/network-engine.ts";

/**
 * Test Suite: Instagram GraphQL Engine & Mutation Verification
 * Validates RelayModern GraphQL queries, response parsing, and error discrimination:
 * - buildGraphQLBody serialization with doc_id, friendly name, actorId, and URL encoding
 * - isServerConfirmationSuccess strict payload inspection against embedded GraphQL errors and nulls
 * - isServerConfirmationSuccess affirmative confirmation on Polaris mutation payloads
 * - extractActorId extraction of active account ds_user_id from session cookies
 * - harvestSniffedMutation state persistence for captured docIds and parameters
 * - sendLike dynamic dispatch of GraphQL queries using harvested signatures
 * - Rejection of HTTP 200 responses bearing embedded GraphQL error collections
 */

test("buildGraphQLBody builds valid URL-encoded form data with doc_id and variables", () => {
  const params = buildGraphQLBody({
    docId: "8492048123901",
    friendlyName: "PolarisLikeMediaMutation",
    variables: { media_id: "3991641081239737327" },
    actorId: "123456",
    appId: "936619743392459",
    rolloutHash: "1015000000",
  });

  assert.ok(typeof params === "string");
  const parsed = new URLSearchParams(params);
  assert.strictEqual(parsed.get("doc_id"), "8492048123901");
  assert.strictEqual(parsed.get("fb_api_req_friendly_name"), "PolarisLikeMediaMutation");
  assert.strictEqual(parsed.get("fb_api_caller_class"), "RelayModern");

  const variables = JSON.parse(parsed.get("variables") || "{}");
  assert.strictEqual(variables.media_id, "3991641081239737327");
});

test("isServerConfirmationSuccess rejects GraphQL errors, failure status, and null payloads", () => {
  const okRes = { status: 200, ok: true };

  // 1. GraphQL error array present
  assert.strictEqual(
    isServerConfirmationSuccess(okRes, { data: null, errors: [{ message: "Not logged in" }] }, "like"),
    false
  );

  // 2. Failure status
  assert.strictEqual(
    isServerConfirmationSuccess(okRes, { status: "fail", message: "checkpoint_required" }, "like"),
    false
  );

  // 3. Null mutation payload
  assert.strictEqual(
    isServerConfirmationSuccess(okRes, { data: { xdt_like_media: null } }, "like"),
    false
  );

  // 4. Empty or missing data
  assert.strictEqual(isServerConfirmationSuccess(okRes, null, "like"), false);
  assert.strictEqual(isServerConfirmationSuccess(okRes, {}, "like"), false);
  assert.strictEqual(isServerConfirmationSuccess({ status: 500, ok: false }, { status: "ok" }, "like"), false);
});

test("isServerConfirmationSuccess validates confirmed like and comment payloads", () => {
  const okRes = { status: 200, ok: true };

  // 1. REST status ok
  assert.strictEqual(isServerConfirmationSuccess(okRes, { status: "ok" }, "like"), true);

  // 2. GraphQL xdt_like_media status ok
  assert.strictEqual(
    isServerConfirmationSuccess(okRes, { data: { xdt_like_media: { status: "ok" } } }, "like"),
    true
  );

  // 3. GraphQL viewer_has_liked
  assert.strictEqual(
    isServerConfirmationSuccess(okRes, { data: { like_media: { viewer_has_liked: true } } }, "like"),
    true
  );

  // 4. GraphQL xdt_create_comment with id
  assert.strictEqual(
    isServerConfirmationSuccess(okRes, { data: { xdt_create_comment: { id: "179294829" } } }, "comment"),
    true
  );
});

test("extractActorId retrieves ds_user_id from cookie string", () => {
  const engine = new InstagramNetworkEngine();
  const mockCookie = "csrftoken=abc; ds_user_id=892184912; sessionid=123";
  const actorId = engine.extractActorId(mockCookie);
  assert.strictEqual(actorId, "892184912");

  assert.strictEqual(engine.extractActorId("csrftoken=abc"), "0");
});

test("InstagramNetworkEngine harvests sniffed like and comment mutations", () => {
  const engine = new InstagramNetworkEngine();
  assert.strictEqual(engine.isGraphQLArmed("like"), false);
  assert.strictEqual(engine.isGraphQLArmed("comment"), false);

  // Harvest like mutation
  engine.harvestSniffedMutation({
    docId: "777888999",
    friendlyName: "PolarisLikeMediaMutation",
    appId: "936619743392459",
    actorId: "444555",
  });

  assert.strictEqual(engine.isGraphQLArmed("like"), true);
  assert.strictEqual(engine.capturedMutations.like!.docId, "777888999");
  assert.strictEqual(engine.actorId, "444555");
  assert.strictEqual(engine.isGraphQLArmed("comment"), false);

  // Harvest comment mutation
  engine.harvestSniffedMutation({
    docId: "111222333",
    friendlyName: "PolarisCreateCommentMutation",
    appId: "936619743392459",
  });

  assert.strictEqual(engine.isGraphQLArmed("comment"), true);
  assert.strictEqual(engine.capturedMutations.comment!.docId, "111222333");
});

test("sendLike sends GraphQL request when like mutation is harvested", async () => {
  const engine = new InstagramNetworkEngine();
  engine.csrfToken = "test_csrf";
  engine.actorId = "123456";
  engine.harvestSniffedMutation({
    docId: "888999111",
    friendlyName: "PolarisLikeMediaMutation",
  });

  const originalFetch = globalThis.fetch;
  let interceptedUrl = "";
  let interceptedBody = "";

  (globalThis as any).fetch = async (url: string, options: any) => {
    interceptedUrl = url;
    interceptedBody = options.body;
    return {
      status: 200,
      ok: true,
      json: async () => ({
        data: { xdt_like_media: { status: "ok" } },
        status: "ok",
      }),
    };
  };

  try {
    const res = await engine.sendLike("3991641081239737327");
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.isConfirmedSuccess, true);
    assert.ok(interceptedUrl.includes("/api/graphql") || interceptedUrl.includes("/graphql/query"));
    assert.ok(interceptedBody.includes("888999111"));
    assert.ok(interceptedBody.includes("3991641081239737327"));
    assert.ok(interceptedBody.includes("123456"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendLike and sendComment flag false success when HTTP 200 returns GraphQL error", async () => {
  const engine = new InstagramNetworkEngine();
  engine.csrfToken = "test_csrf";
  engine.harvestSniffedMutation({
    docId: "888999111",
    friendlyName: "PolarisLikeMediaMutation",
  });
  engine.harvestSniffedMutation({
    docId: "222333444",
    friendlyName: "PolarisCreateCommentMutation",
  });

  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      data: null,
      errors: [{ message: "Please log in to continue." }],
    }),
  });

  try {
    const likeRes = await engine.sendLike("3991641081239737327");
    assert.strictEqual(likeRes.ok, false);
    assert.strictEqual(likeRes.isConfirmedSuccess, false);
    assert.match(likeRes.error || "", /Please log in/i);

    const commentRes = await engine.sendComment("3991641081239737327", "Hello");
    assert.strictEqual(commentRes.ok, false);
    assert.strictEqual(commentRes.isConfirmedSuccess, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
