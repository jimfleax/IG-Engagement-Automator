/**
 * @file network-engine.ts
 * @description Executes direct headless web and GraphQL network requests to Instagram's backend using active session credentials.
 * @architecture Serves as the headless API transport layer used by WorkflowEngine before falling back to DOM simulation.
 * @agent_note Requires valid CSRF tokens and actor IDs; ensure GraphQL response verifications check deep payloads and GraphQL error arrays.
 */

export interface GraphQLBodyOptions {
  docId: string;
  friendlyName?: string;
  variables?: any;
  actorId?: string;
  appId?: string;
  rolloutHash?: string;
}

export interface NetworkApiResponse<T = any> {
  status: number;
  ok: boolean;
  isConfirmedSuccess: boolean;
  data: T;
  error?: string | null;
}

export interface CapturedMutation {
  docId: string;
  friendlyName: string;
  timestamp: number;
}

export interface ExtractedPostInfo {
  type: string;
  shortcode: string;
  mediaId: string | null;
  canonicalPath: string;
  hasLiked: boolean;
  commentsDisabled: boolean;
}

/**
 * 64-character alphabet used by Instagram to encode numeric media IDs into URL shortcodes.
 */
export const IG_BASE64_ALPHABET: string =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Regular expression pattern matching Instagram post, reel, and IGTV canonical paths.
 */
export const POST_PATH_REGEX: RegExp = /\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;

/**
 * Decodes an Instagram alphanumeric shortcode (e.g. "CxXYZ123") into
 * its 64-bit numeric mediaId / pk string.
 *
 * @param shortcode - Instagram post shortcode (up to 11 chars).
 * @returns Numeric media ID string or null if invalid.
 */
export function shortcodeToMediaId(shortcode: string): string | null {
  if (!shortcode || typeof shortcode !== "string") return null;
  const clean = shortcode.trim().slice(0, 11);
  if (!clean) return null;

  let id = 0n;
  for (let i = 0; i < clean.length; i++) {
    const idx = IG_BASE64_ALPHABET.indexOf(clean[i]);
    if (idx === -1) return null;
    id = id * 64n + BigInt(idx);
  }
  return id.toString(10);
}

/**
 * Serializes an authentic GraphQL form-encoded payload for Instagram's Relay gateway.
 *
 * @param opts - Payload options
 * @returns URL-encoded form data string
 */
export function buildGraphQLBody({
  docId,
  friendlyName = "PolarisLikeMediaMutation",
  variables = {},
  actorId = "0",
  appId = "936619743392459",
  rolloutHash = "1015000000",
}: GraphQLBodyOptions): string {
  const params = new URLSearchParams();
  params.set("av", String(actorId || "0"));
  params.set("__d", "www");
  params.set("__user", String(actorId || "0"));
  params.set("__a", "1");
  params.set("__req", "1");
  params.set("__hs", String(rolloutHash || "1015000000"));
  params.set("dpr", "1");
  params.set("app_id", String(appId || "936619743392459"));
  params.set("server_timestamps", "true");
  params.set("doc_id", String(docId));
  params.set(
    "variables",
    typeof variables === "string" ? variables : JSON.stringify(variables)
  );
  params.set("fb_api_req_friendly_name", friendlyName);
  params.set("fb_api_caller_class", "RelayModern");

  return params.toString();
}

/**
 * Evaluates whether an Instagram API or GraphQL response genuinely registered on the server.
 * Never treats generic HTTP 200 or unconfirmed error payloads as successful.
 *
 * @param res - Response metadata
 * @param data - Parsed JSON response body
 * @param action - Action type
 * @returns True ONLY if verified by server response
 */
export function isServerConfirmationSuccess(
  res: { ok: boolean; status: number } | Response | null,
  data: any,
  action: "like" | "comment" = "like"
): boolean {
  if (!res || !res.ok) return false;
  if (!data || typeof data !== "object") return false;

  // Rejection 1: Any GraphQL error items present
  if (Array.isArray(data.errors) && data.errors.length > 0) return false;

  // Rejection 2: Explicit failure status
  if (data.status === "fail") return false;

  // Confirmation 1: Explicit status === "ok" (standard REST and many GraphQL mutations)
  if (data.status === "ok") return true;

  // Confirmation 2: GraphQL mutation payload confirmation
  if (data.data && typeof data.data === "object") {
    if (action === "like") {
      const likePayload = data.data.xdt_like_media || data.data.like_media || data.data.media_like;
      if (likePayload && typeof likePayload === "object") {
        if (likePayload.status === "ok" || likePayload.viewer_has_liked === true || likePayload.id) {
          return true;
        }
      }
      // Check for generic mutation confirmation without null
      const keys = Object.keys(data.data);
      if (keys.length > 0) {
        for (const k of keys) {
          const val = data.data[k];
          if (val && typeof val === "object" && (val.status === "ok" || val.viewer_has_liked === true || val.id)) {
            return true;
          }
        }
      }
    } else if (action === "comment") {
      const commentPayload = data.data.xdt_create_comment || data.data.comment || data.data.create_comment;
      if (commentPayload && typeof commentPayload === "object") {
        if (commentPayload.status === "ok" || commentPayload.id || commentPayload.text) {
          return true;
        }
      }
      const keys = Object.keys(data.data);
      if (keys.length > 0) {
        for (const k of keys) {
          const val = data.data[k];
          if (val && typeof val === "object" && (val.status === "ok" || val.id || val.text)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Direct web and GraphQL API engine interacting with Instagram endpoints.
 */
export class InstagramNetworkEngine {
  appId: string;
  asbdId: string;
  ajaxHash: string;
  csrfToken: string;
  actorId: string;
  mediaMetadataCache: Map<string, any>;
  isCalibrated: boolean;
  isAvailable: boolean;
  unsupportedReason: string | null;
  capturedMutations: {
    like: CapturedMutation | null;
    comment: CapturedMutation | null;
  };

  /**
   * Initializes network engine state with default client identifiers and mutation caches.
   */
  constructor() {
    this.appId = "936619743392459"; // Standard Instagram Web App ID
    this.asbdId = "129477"; // Standard Web ASBD ID
    this.ajaxHash = "1015000000";
    this.csrfToken = "";
    this.actorId = "0";
    this.mediaMetadataCache = new Map();
    this.isCalibrated = false;
    this.isAvailable = true;
    this.unsupportedReason = null;

    // Harvested live GraphQL mutations captured by sniffer
    this.capturedMutations = {
      like: null,
      comment: null,
    };
  }

  /**
   * Harvests live GraphQL mutation metadata intercepted from Instagram's native React client.
   * @param payload - Sniffed mutation metadata.
   */
  harvestSniffedMutation(payload: any = {}): void {
    if (!payload) return;

    if (payload.docId) {
      const fn = String(payload.friendlyName || "").toLowerCase();
      const action: "like" | "comment" = fn.includes("comment") ? "comment" : "like";

      this.capturedMutations[action] = {
        docId: String(payload.docId),
        friendlyName: payload.friendlyName || (action === "comment" ? "PolarisCreateCommentMutation" : "PolarisLikeMediaMutation"),
        timestamp: Date.now(),
      };

      // If we have live doc_id, mark engine available
      this.isAvailable = true;
      this.unsupportedReason = null;
    }

    if (payload.appId) this.appId = String(payload.appId);
    if (payload.actorId && payload.actorId !== "0") this.actorId = String(payload.actorId);
    if (payload.csrfToken) this.csrfToken = String(payload.csrfToken);
    if (payload.rolloutHash) this.ajaxHash = String(payload.rolloutHash);
  }

  /**
   * Checks if the GraphQL engine has harvested active doc_ids for a given action.
   * @param action - Target engagement action type.
   * @returns True if docId is armed for the action.
   */
  isGraphQLArmed(action: "like" | "comment" = "like"): boolean {
    return Boolean(this.capturedMutations[action]?.docId);
  }

  /**
   * Marks direct API endpoint as retired or unsupported.
   * @param status - HTTP status code received.
   * @param reason - Descriptive deprecation message.
   */
  markEndpointDeprecated(status: number = 404, reason: string = "Endpoint deprecated by Instagram"): void {
    this.isAvailable = false;
    this.unsupportedReason = `${reason} (HTTP ${status})`;
  }

  /**
   * Extracts CSRF token from document.cookie or script tags.
   * @param cookieStr - Raw document cookie string.
   * @returns Extracted CSRF token or empty string.
   */
  extractCsrfToken(cookieStr: string = ""): string {
    const cookies = cookieStr || (typeof document !== "undefined" ? document.cookie : "");
    const match = cookies.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }

    if (typeof document !== "undefined") {
      try {
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const s of scripts) {
          const m = (s.textContent || "").match(/"csrf_token"\s*:\s*"([^"]+)"/);
          if (m && m[1]) return m[1];
        }
      } catch (_) {}
    }

    return "";
  }

  /**
   * Extracts actor/viewer user ID from document.cookie (ds_user_id) or embedded scripts.
   * @param cookieStr - Raw document cookie string.
   * @returns Numeric user ID string or "0".
   */
  extractActorId(cookieStr: string = ""): string {
    const cookies = cookieStr || (typeof document !== "undefined" ? document.cookie : "");
    const match = cookies.match(/(?:^|;\s*)ds_user_id=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }

    if (typeof document !== "undefined") {
      try {
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const s of scripts) {
          const text = s.textContent || "";
          const m = text.match(/"(?:viewerId|USER_ID|actor_id)"\s*:\s*"(\d+)"/);
          if (m && m[1]) return m[1];
        }
      } catch (_) {}
    }

    return "0";
  }

  /**
   * Bootstraps tokens from embedded DOM scripts.
   * @param doc - DOM Document instance to inspect.
   */
  bootstrapTokensFromDOM(doc?: Document): void {
    const targetDoc = doc || (typeof document !== "undefined" ? document : null);
    if (!targetDoc) return;

    try {
      const scripts = Array.from(targetDoc.querySelectorAll("script"));
      for (const s of scripts) {
        const text = s.textContent || "";
        if (!text) continue;

        const ajaxMatch = text.match(/"rollout_hash"\s*:\s*"([A-Za-z0-9_-]+)"/);
        if (ajaxMatch && ajaxMatch[1]) {
          this.ajaxHash = String(ajaxMatch[1]);
        }

        const appIdMatch = text.match(/"APP_ID"\s*:\s*"(\d+)"/);
        if (appIdMatch && appIdMatch[1]) {
          this.appId = appIdMatch[1];
        }

        // Check for PolarisLikeMediaMutation doc_id in scripts
        if (!this.capturedMutations.like) {
          const likeDocMatch =
            text.match(/PolarisLikeMediaMutation[^}]*?["']doc_id["']\s*:\s*["'](\d+)["']/i) ||
            text.match(/["']doc_id["']\s*:\s*["'](\d+)["'][^}]*?PolarisLikeMediaMutation/i);
          if (likeDocMatch && likeDocMatch[1]) {
            this.harvestSniffedMutation({
              docId: likeDocMatch[1],
              friendlyName: "PolarisLikeMediaMutation",
            });
          }
        }

        // Check for PolarisCreateCommentMutation doc_id in scripts
        if (!this.capturedMutations.comment) {
          const commentDocMatch =
            text.match(/PolarisCreateCommentMutation[^}]*?["']doc_id["']\s*:\s*["'](\d+)["']/i) ||
            text.match(/["']doc_id["']\s*:\s*["'](\d+)["'][^}]*?PolarisCreateCommentMutation/i);
          if (commentDocMatch && commentDocMatch[1]) {
            this.harvestSniffedMutation({
              docId: commentDocMatch[1],
              friendlyName: "PolarisCreateCommentMutation",
            });
          }
        }
      }
    } catch (_) {}

    this.csrfToken = this.extractCsrfToken();
    if (!this.actorId || this.actorId === "0") {
      this.actorId = this.extractActorId();
    }
  }

  /**
   * Pre-flight calibration: validates endpoint readiness and tokens.
   */
  async validateEndpoints(): Promise<any> {
    if (!this.csrfToken) {
      this.csrfToken = this.extractCsrfToken();
    }
    if (!this.actorId || this.actorId === "0") {
      this.actorId = this.extractActorId();
    }
    if ((!this.csrfToken || this.actorId === "0") && typeof document !== "undefined") {
      this.bootstrapTokensFromDOM();
    }

    const hasCsrf = Boolean(this.csrfToken);
    const hasAppId = Boolean(this.appId);
    const isReady = hasCsrf && hasAppId;

    this.isCalibrated = isReady;

    return {
      isReady,
      hasCsrf,
      hasAppId,
      actorId: this.actorId,
      isAvailable: this.isAvailable,
      unsupportedReason: this.unsupportedReason,
      csrfTokenSnippet: hasCsrf ? `${this.csrfToken.slice(0, 6)}...` : "missing",
      appId: this.appId,
      endpoints: {
        like: "https://www.instagram.com/api/v1/web/likes/{media_id}/like/",
        comment: "https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
      },
    };
  }

  /**
   * Extracts post info and derives numeric mediaId.
   * @param urlOrPath - Post URL or canonical path.
   */
  extractPostInfo(urlOrPath: string): ExtractedPostInfo | null {
    const match = String(urlOrPath || "").match(POST_PATH_REGEX);
    if (!match) return null;
    const type = match[1];
    const shortcode = match[2];

    const cached = this.mediaMetadataCache.get(shortcode);
    const mediaId = cached?.mediaId || shortcodeToMediaId(shortcode);

    return {
      type,
      shortcode,
      mediaId,
      canonicalPath: `/${type}/${shortcode}/`,
      hasLiked: cached?.hasLiked || false,
      commentsDisabled: cached?.commentsDisabled || false,
    };
  }

  /**
   * Builds authenticated request headers for Instagram Web API.
   * @param friendlyName - Optional Facebook API friendly name.
   */
  buildHeaders(friendlyName: string = ""): Record<string, string> {
    const csrf = this.csrfToken || this.extractCsrfToken();
    const headers: Record<string, string> = {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": csrf,
      "X-IG-App-ID": this.appId,
      "X-ASBD-ID": this.asbdId,
      "X-Instagram-AJAX": this.ajaxHash,
      "X-Requested-With": "XMLHttpRequest",
    };
    if (friendlyName) {
      headers["X-FB-Friendly-Name"] = friendlyName;
    }
    return headers;
  }

  /**
   * Sends Direct Like API request
   * @param mediaId - Numeric Instagram post ID
   */
  async sendLike(mediaId: string): Promise<NetworkApiResponse> {
    if (!mediaId) throw new Error("Media ID is required for like API");

    // Ensure session credentials are armed
    if (!this.actorId || this.actorId === "0") {
      this.actorId = this.extractActorId();
    }
    if (!this.csrfToken) {
      this.csrfToken = this.extractCsrfToken();
    }

    // Branch 1: Modern GraphQL Mutation with harvested live doc_id
    if (this.isGraphQLArmed("like")) {
      const mutation = this.capturedMutations.like!;
      const body = buildGraphQLBody({
        docId: mutation.docId,
        friendlyName: mutation.friendlyName,
        variables: { media_id: String(mediaId) },
        actorId: this.actorId,
        appId: this.appId,
        rolloutHash: this.ajaxHash,
      });

      let res: Response;
      try {
        res = await fetch("https://www.instagram.com/api/graphql", {
          method: "POST",
          headers: this.buildHeaders(mutation.friendlyName),
          body,
          credentials: "include",
        });
      } catch (err: any) {
        return { status: 0, ok: false, isConfirmedSuccess: false, data: null, error: err.message };
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {}

      const isSuccess = isServerConfirmationSuccess(res, data, "like");
      const errorMsg = isSuccess
        ? null
        : (data?.message || data?.errors?.[0]?.message || "Instagram server did not confirm like mutation");

      return {
        status: res.status,
        ok: isSuccess,
        isConfirmedSuccess: isSuccess,
        data,
        error: errorMsg,
      };
    }

    // Branch 2: Legacy REST fallback (omitted in browser to avoid polluting console with dead 404s)
    if (typeof window !== "undefined") {
      this.markEndpointDeprecated(404, "Direct Like API endpoint retired / 404 Not Found");
      return {
        status: 404,
        ok: false,
        isConfirmedSuccess: false,
        data: null,
        error: "Direct Like API endpoint retired / 404 Not Found",
      };
    }

    let res: Response;
    try {
      res = await fetch(`https://www.instagram.com/api/v1/web/likes/${mediaId}/like/`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: "",
        credentials: "include",
      });
    } catch (err: any) {
      return { status: 0, ok: false, isConfirmedSuccess: false, data: null, error: err.message };
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch (_) {}

    if (res.status === 404) {
      this.markEndpointDeprecated(404, "Direct Like API endpoint retired / 404 Not Found");
    }

    const isSuccess = isServerConfirmationSuccess(res, data, "like");
    return {
      status: res.status,
      ok: isSuccess,
      isConfirmedSuccess: isSuccess,
      data,
      error: isSuccess ? null : (data?.message || "Like rejected by Instagram"),
    };
  }

  /**
   * Sends Direct Comment API request
   * @param mediaId - Numeric Instagram post ID
   * @param text - Comment string
   */
  async sendComment(mediaId: string, text: string): Promise<NetworkApiResponse> {
    if (!mediaId) throw new Error("Media ID is required for comment API");
    if (!text) throw new Error("Comment text is required");

    // Ensure session credentials are armed
    if (!this.actorId || this.actorId === "0") {
      this.actorId = this.extractActorId();
    }
    if (!this.csrfToken) {
      this.csrfToken = this.extractCsrfToken();
    }

    // Branch 1: Modern GraphQL Mutation with harvested live doc_id
    if (this.isGraphQLArmed("comment")) {
      const mutation = this.capturedMutations.comment!;
      const body = buildGraphQLBody({
        docId: mutation.docId,
        friendlyName: mutation.friendlyName,
        variables: { media_id: String(mediaId), comment_text: text },
        actorId: this.actorId,
        appId: this.appId,
        rolloutHash: this.ajaxHash,
      });

      let res: Response;
      try {
        res = await fetch("https://www.instagram.com/api/graphql", {
          method: "POST",
          headers: this.buildHeaders(mutation.friendlyName),
          body,
          credentials: "include",
        });
      } catch (err: any) {
        return { status: 0, ok: false, isConfirmedSuccess: false, data: null, error: err.message };
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {}

      const isSuccess = isServerConfirmationSuccess(res, data, "comment");
      const errorMsg = isSuccess
        ? null
        : (data?.message || data?.errors?.[0]?.message || "Instagram server did not confirm comment mutation");

      return {
        status: res.status,
        ok: isSuccess,
        isConfirmedSuccess: isSuccess,
        data,
        error: errorMsg,
      };
    }

    // Branch 2: Legacy REST fallback (omitted in browser to avoid polluting console with dead 404s)
    if (typeof window !== "undefined") {
      this.markEndpointDeprecated(404, "Direct Comment API endpoint retired / 404 Not Found");
      return {
        status: 404,
        ok: false,
        isConfirmedSuccess: false,
        data: null,
        error: "Direct Comment API endpoint retired / 404 Not Found",
      };
    }

    const body = new URLSearchParams({ comment_text: text }).toString();

    let res: Response;
    try {
      res = await fetch(`https://www.instagram.com/api/v1/web/comments/${mediaId}/add/`, {
        method: "POST",
        headers: this.buildHeaders(),
        body,
        credentials: "include",
      });
    } catch (err: any) {
      return { status: 0, ok: false, isConfirmedSuccess: false, data: null, error: err.message };
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch (_) {}

    if (res.status === 404) {
      this.markEndpointDeprecated(404, "Direct Comment API endpoint retired / 404 Not Found");
    }

    const isSuccess = isServerConfirmationSuccess(res, data, "comment");
    return {
      status: res.status,
      ok: isSuccess,
      isConfirmedSuccess: isSuccess,
      data,
      error: isSuccess ? null : (data?.message || "Comment rejected by Instagram"),
    };
  }

  /**
   * Checks if the response indicates the direct API endpoint has been retired or moved.
   * @param resObj - Network response object.
   * @returns True if status is 404 or 405.
   */
  isEndpointDeprecated(resObj: { status: number } | Response | null): boolean {
    if (!resObj) return false;
    return resObj.status === 404 || resObj.status === 405;
  }

  /**
   * Checks API response for rate limits or action blocks.
   * @param resObj - API response object.
   * @returns Descriptive challenge reason or null if clean.
   */
  checkChallenge(resObj: { status: number; data?: any } | null): string | null {
    if (!resObj) return null;
    if (resObj.status === 429) {
      return "HTTP 429 Too Many Requests (Rate limit detected)";
    }
    if (
      resObj.data?.spam === true ||
      resObj.data?.message === "feedback_required" ||
      (resObj.data?.status === "fail" && String(resObj.data?.message).includes("checkpoint"))
    ) {
      return `Action blocked by Instagram (${resObj.data?.message || "feedback_required"})`;
    }
    return null;
  }
}
