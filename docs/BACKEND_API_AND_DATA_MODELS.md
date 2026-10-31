# Data Models & Schemas Reference

Reference guide for all client-side persistent storage schemas, IndexedDB tables, Chrome local storage stores, and data serialization pipelines.

---

## 1. IndexedDB Architecture (`src/core/db.js`)

The extension utilizes [Dexie.js](https://dexie.org) to manage an embedded IndexedDB database named `IGEngagementAutomatorDB` (version 2 schema).

### Table: `records`
Stores historical interaction records for every processed Instagram post.

| Field Name | Type | Key / Index | Description |
|---|---|---|---|
| `id` | `number` | Primary Key (`++id`) | Auto-incrementing unique row identifier |
| `shortcode` | `string` | Indexed (`shortcode`) | Canonical Instagram post shortcode (e.g. `Ctest12345`) |
| `mediaId` | `string` | Indexed (`mediaId`) | Numeric 64-bit Instagram media ID |
| `postPath` | `string` | Indexed (`postPath`) | Canonical URL path (e.g. `/p/Ctest12345/`) |
| `timestampIso` | `string` | Indexed (`timestampIso`)| ISO 8601 creation timestamp |
| `likeStatus` | `string` | Indexed (`likeStatus`) | Outcome (`"Liked"`, `"Already Liked"`, `"Failed"`, `"Skipped (Mode)"`, `"Skipped (Probability)"`) |
| `commentStatus` | `string` | Indexed (`commentStatus`)| Outcome (`"Commented"`, `"Already Commented"`, `"Failed"`, `"Comments Disabled"`, `"Skipped"`) |
| `postUrl` | `string` | Non-indexed | Full HTTPS permalink to the post |
| `timeFormatted` | `string` | Non-indexed | Localized human-readable time string (e.g. `07:32:15 PM`) |
| `likeActionRequired`| `boolean` | Non-indexed | Flag indicating if like was attempted |
| `likeAttempts` | `number` | Non-indexed | Number of retry attempts made for like action |
| `commentActionRequired` | `boolean` | Non-indexed | Flag indicating if comment was attempted |
| `commentText` | `string` | Non-indexed | Final resolved spintax comment text submitted |
| `commentAttempts`| `number` | Non-indexed | Number of retry attempts made for comment action |
| `errorsCount` | `number` | Non-indexed | Count of errors encountered during execution |
| `errorDetails` | `string[]`| Non-indexed | Array of error diagnostic strings and stack traces |

### Table: `profiles`
Tracks historical engagement frequency for individual creator handles.

| Field Name | Type | Key / Index | Description |
|---|---|---|---|
| `username` | `string` | Primary Key (`&username`) | Normalized lowercase handle without `@` |
| `lastEngaged` | `string` | Indexed (`lastEngaged`)| ISO timestamp of most recent engagement |
| `totalEngaged` | `number` | Indexed (`totalEngaged`)| Aggregate count of posts engaged |
| `category` | `string` | Non-indexed | Optional niche or category label |

### Data Sanitization: `sanitizeRecordForDB(record)`
Ensures consistent schema shapes, removes circular DOM references, and generates fallback values prior to IndexedDB insertion.

### Data Export: `exportToCSV(records)`
Serializes database records into RFC-4180 compliant CSV format using PapaParse with automatic comma escaping and full unicode emoji preservation.

---

## 2. Chrome Local Storage Stores (`src/core/storage.js`)

The extension leverages `chrome.storage.local` for reactive synchronization between the HUD React components and background processes.

### Storage Keys (`STORAGE_KEYS`)

| Key Name | Storage Identifier | Managed Content |
|---|---|---|
| `SETTINGS` | `ig_modal_suite_settings_v3` | Automation configuration and execution thresholds |
| `PREFS` | `ig_modal_suite_ui_prefs_v1` | HUD UI visibility, docking, and active tab preferences |
| `HISTORY` | `ig_modal_suite_history_v2` | Session record history buffer (mirrored with IndexedDB) |
| `DECK` | `ig_modal_suite_comment_deck_v1`| Custom comment pool and spintax deck state |
| `DIAGNOSTICS` | `ig_modal_suite_diagnostics_v1`| Latest DOM scanner calibration health report |
| `MUTATIONS` | `ig_harvested_mutations` | Sniffed GraphQL mutation `doc_id` queries and variables |

### Schema: `DEFAULT_SETTINGS`

```javascript
{
  myUsername: "",                  // String: Logged-in handle
  targetUsername: "",              // String: Active creator handle
  engineMode: "hybrid",            // "hybrid" | "api" | "dom"
  engagementMode: "both",          // "both" | "like_only" | "comment_only"
  skipIfAlreadyCommented: true,   // Boolean: Prevent duplicate commenting
  maxPostsToProcess: 50,           // Number: Goal posts per session
  maxRetries: 3,                   // Number: Retry attempts before failure
  retryDelayMs: 2000,              // Number: Base exponential backoff delay
  minActionDelayMs: 1200,          // Number: Min delay between like and comment
  maxActionDelayMs: 2500,          // Number: Max delay between like and comment
  minPostDelayMs: 4500,            // Number: Min cooldown before next post
  maxPostDelayMs: 8500,            // Number: Max cooldown before next post
  maxConsecutiveSkips: 40,         // Number: Stop threshold for already-engaged posts
  likeProbability: 100,            // Number: 0 to 100
  commentProbability: 100,         // Number: 0 to 100
  autoSelfHealDOM: true,           // Boolean: Re-calibrate DOM selectors on error
  commentPool: [                   // String[]: Spintax comment templates
    "🔥🔥",
    "Love this! 🔥",
    "So good! 🙌",
    "Awesome shot 💯",
    "Incredible! ✨"
  ]
}
```

### Schema: `DEFAULT_PREFS`

```javascript
{
  activeTab: "dashboard",  // "dashboard" | "settings" | "diagnostics" | "about"
  isDocked: false,         // Boolean: Docked to viewport corner vs draggable
  isMinimized: false,      // Boolean: Collapsed to small floating badge
  isVisible: false         // Boolean: Hidden by default on page mount
}
```
