/**
 * @file sniffer.ts
 * @description Injected into Instagram's MAIN execution world to intercept GraphQL requests and harvest active query IDs and tokens.
 * @architecture Acts as the page-context probe monkey-patching fetch and XHR, forwarding sniffed mutation parameters to the isolated content script via window.postMessage.
 * @agent_note Runs in untrusted MAIN world context without Chrome extension APIs; must not leak errors or disturb native page network calls.
 */

declare global {
  interface Window {
    __igSnifferActive?: boolean;
  }
}

export interface SniffedGraphQLData {
  docId?: string;
  friendlyName?: string;
  actorId?: string;
  appId?: string;
  rolloutHash?: string;
  variables?: string;
  csrfToken?: string;
}

(function initIGAutomatorSniffer(): void {
  if (window.__igSnifferActive) return;
  window.__igSnifferActive = true;

  /**
   * Parses network request payload bodies across FormData, URLSearchParams, JSON, and encoded strings.
   */
  function parseBody(body: any): SniffedGraphQLData | null {
    if (!body) return null;
    try {
      // 1. FormData object
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        const docId = body.get("doc_id");
        return {
          docId: docId ? String(docId) : "",
          friendlyName: String(body.get("fb_api_req_friendly_name") || ""),
          actorId: String(body.get("av") || body.get("__user") || ""),
          appId: String(body.get("app_id") || ""),
          rolloutHash: String(body.get("__hs") || ""),
          variables: String(body.get("variables") || ""),
        };
      }

      // 2. URLSearchParams object
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        const docId = body.get("doc_id");
        return {
          docId: docId ? String(docId) : "",
          friendlyName: String(body.get("fb_api_req_friendly_name") || ""),
          actorId: String(body.get("av") || body.get("__user") || ""),
          appId: String(body.get("app_id") || ""),
          rolloutHash: String(body.get("__hs") || ""),
          variables: String(body.get("variables") || ""),
        };
      }

      // 3. String body (URL-encoded or JSON)
      if (typeof body === "string") {
        if (body.startsWith("{")) {
          const json = JSON.parse(body);
          return {
            docId: json.doc_id ? String(json.doc_id) : "",
            friendlyName: json.fb_api_req_friendly_name || json.friendly_name || "",
            actorId: json.av || json.__user || "",
            appId: json.app_id || "",
            rolloutHash: json.__hs || "",
            variables: typeof json.variables === "object" ? JSON.stringify(json.variables) : json.variables || "",
          };
        }
        const params = new URLSearchParams(body);
        return {
          docId: params.get("doc_id") ? String(params.get("doc_id")) : "",
          friendlyName: params.get("fb_api_req_friendly_name") || "",
          actorId: params.get("av") || params.get("__user") || "",
          appId: params.get("app_id") || "",
          rolloutHash: params.get("__hs") || "",
          variables: params.get("variables") || "",
        };
      }
    } catch (_) {}
    return null;
  }

  /**
   * Posts captured mutation payload to the window object for consumption by the isolated content script.
   */
  function emitSniffed(parsed: SniffedGraphQLData | null): void {
    if (!parsed) return;
    if (!parsed.docId && !parsed.actorId) return;
    try {
      window.postMessage(
        {
          type: "IG_GRAPHQL_SNIFFED",
          source: "ig-automator-sniffer",
          data: parsed,
        },
        "*"
      );
    } catch (_) {}
  }

  // Initial handshake: broadcast active user ID and CSRF token from document.cookie
  try {
    const cookies = document.cookie || "";
    const dsMatch = cookies.match(/(?:^|;\s*)ds_user_id=([^;]+)/);
    const csrfMatch = cookies.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (dsMatch || csrfMatch) {
      emitSniffed({
        actorId: dsMatch ? decodeURIComponent(dsMatch[1]) : "",
        csrfToken: csrfMatch ? decodeURIComponent(csrfMatch[1]) : "",
      });
    }
  } catch (_) {}

  // Intercept window.fetch
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = async function (this: any, ...args: [RequestInfo | URL, RequestInit?]) {
      try {
        const [resource, config] = args;
        const url = typeof resource === "string" ? resource : (resource as any)?.url;

        if (url && (url.includes("/graphql/query") || url.includes("/api/graphql") || url.includes("/api/v1/"))) {
          const parsed = parseBody(config?.body);
          if (parsed && (parsed.docId || parsed.actorId)) {
            emitSniffed(parsed);
          }
        }
      } catch (_) {}

      return origFetch.apply(this, args);
    };
  }

  // Intercept XMLHttpRequest
  if (typeof XMLHttpRequest !== "undefined") {
    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
      try {
        this._igTrackUrl = String(url || "");
      } catch (_) {}
      return origXhrOpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (this: any, body?: Document | XMLHttpRequestBodyInit | null) {
      try {
        if (
          this._igTrackUrl &&
          (this._igTrackUrl.includes("/graphql/query") ||
            this._igTrackUrl.includes("/api/graphql") ||
            this._igTrackUrl.includes("/api/v1/"))
        ) {
          const parsed = parseBody(body);
          if (parsed && (parsed.docId || parsed.actorId)) {
            emitSniffed(parsed);
          }
        }
      } catch (_) {}
      return origXhrSend.apply(this, arguments as any);
    };
  }
})();
