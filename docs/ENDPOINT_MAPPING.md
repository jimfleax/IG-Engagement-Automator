# Endpoint Mapping Reference

Mapping of Instagram internal web endpoints, GraphQL mutations, and browser message interfaces consumed by the automator.

---

## Direct Instagram Web Endpoints

### 1. GraphQL Like Mutation (`POST /api/graphql`)
- **Engine Handler:** `InstagramNetworkEngine.sendLike(mediaId)` in `src/core/network-engine.js`
- **Purpose:** Direct server-side like action on an Instagram media item using modern Relay GraphQL mutations.
- **Request Format:** `application/x-www-form-urlencoded`
- **Request Headers:**
  - `x-csrftoken`: Active session CSRF token extracted from `document.cookie`.
  - `x-ig-app-id`: Standard Instagram Web App ID (`936619743392459`).
  - `x-asbd-id`: Instagram ASBD signature (`129477`).
  - `x-fb-friendly-name`: Sniffed mutation name (e.g., `usePolarisLikeMediaLikeMutation`).
- **Form Payload:**
  - `doc_id` (`string`): Sniffed query hash ID dynamically harvested by `src/inject/sniffer.js`.
  - `variables` (`JSON string`):
    ```json
    {
      "media_id": "3582910481234567890"
    }
    ```
- **Response Structure:**
  - **Success (HTTP 200):**
    ```json
    {
      "data": {
        "xdt_like_media": {
          "status": "ok"
        }
      }
    }
    ```
  - **Failure / Challenge (HTTP 200 or 400 with errors):**
    ```json
    {
      "errors": [
        {
          "message": "feedback_required",
          "severity": "CRITICAL"
        }
      ],
      "status": "fail"
    }
    ```
- **Auth Requirement:** Active authenticated Instagram web session cookies (`sessionid`, `csrftoken`, `ds_user_id`).
- **Consumer:** `WorkflowEngine.processLikeStep(record)` in `src/core/workflow.js`.
- **Data Store Written:** `records` store in IndexedDB (`src/core/db.js`).

---

### 2. GraphQL Comment Mutation (`POST /api/graphql`)
- **Engine Handler:** `InstagramNetworkEngine.sendComment(mediaId, commentText)` in `src/core/network-engine.js`
- **Purpose:** Direct server-side comment posting using modern Relay GraphQL mutations.
- **Request Format:** `application/x-www-form-urlencoded`
- **Form Payload:**
  - `doc_id` (`string`): Sniffed query hash ID dynamically harvested by `src/inject/sniffer.js`.
  - `variables` (`JSON string`):
    ```json
    {
      "media_id": "3582910481234567890",
      "comment_text": "Awesome capture! 🔥"
    }
    ```
- **Response Structure:**
  - **Success (HTTP 200):**
    ```json
    {
      "data": {
        "xdt_write_comment": {
          "comment": {
            "id": "18012345678901234",
            "text": "Awesome capture! 🔥",
            "created_at": 1730386200
          },
          "status": "ok"
        }
      }
    }
    ```
- **Auth Requirement:** Active authenticated Instagram web session.
- **Consumer:** `WorkflowEngine.processCommentStep(record)` in `src/core/workflow.js`.
- **Data Store Written:** `records` store in IndexedDB (`src/core/db.js`).

---

### 3. REST Like Endpoint (`POST /api/v1/web/likes/{mediaId}/like/`)
- **Engine Handler:** `InstagramNetworkEngine.sendLike(mediaId)` (Fallback when GraphQL mutation is not yet armed).
- **Purpose:** Legacy REST like endpoint.
- **Payload:** Empty POST body with CSRF header.
- **Deprecation Handling:** If Instagram returns HTTP 404 Not Found, `network.markEndpointDeprecated(404)` marks the endpoint as retired and automatically transitions the workflow into synthetic DOM click mode.

---

### 4. REST Comment Endpoint (`POST /api/v1/web/comments/{mediaId}/add/`)
- **Engine Handler:** `InstagramNetworkEngine.sendComment(mediaId, commentText)` (Fallback).
- **Purpose:** Legacy REST comment endpoint.
- **Payload:** `comment_text=...` form encoded.
- **Deprecation Handling:** Automatically falls back to synthetic character-by-character typing when unconfirmed.

---

## Internal Runtime Message Interfaces

Messages exchanged between Extension Content Script, Background Worker, and Action Popup.

### 1. `BACKGROUND_SLEEP`
- **Direction:** Content Script (`src/core/scheduler.js`) → Background Worker (`background.js`)
- **Payload:** `{ action: "BACKGROUND_SLEEP", ms: 4500, timerId: 102 }`
- **Response:** `{ success: true, timerId: 102 }`
- **Purpose:** Delegates timeouts to the background worker to prevent Chrome tab freeze/throttling when user switches tabs.

### 2. `CANCEL_ALL_TIMERS`
- **Direction:** Content Script → Background Worker
- **Payload:** `{ action: "CANCEL_ALL_TIMERS" }`
- **Response:** `{ success: true }`
- **Purpose:** Cancels all pending background alarms and timeouts when workflow is stopped or destroyed.

### 3. `TOGGLE_MODAL`
- **Direction:** Background Worker / Popup → Content Script (`src/content.jsx`)
- **Payload:** `{ action: "TOGGLE_MODAL" }`
- **Response:** `{ isVisible: true }`
- **Purpose:** Toggles in-page floating HUD overlay visibility.

### 4. `GET_STATUS`
- **Direction:** Popup (`src/popup/PopupApp.jsx`) → Content Script (`src/content.jsx`)
- **Payload:** `{ action: "GET_STATUS" }`
- **Response:** `{ status: "Running", metrics: { likesNew: 12, ... }, detectedUsername: "my_user" }`
- **Purpose:** Synchronizes live status and session stats into the toolbar popup.
