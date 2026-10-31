# Codebase Directory and File Index

A complete structural and functional index of all directories and files in the repository.

---

## Directory Overview

```
ig-engagement-automator/
├── background.js
├── build.js
├── manifest.json
├── package.json
├── tailwind.config.js
├── README.md
├── content/               # Compiled bundle distribution directory for content scripts
├── popup/                 # Compiled bundle distribution directory for popup interface
├── icons/                 # Extension toolbar and web store application icons
├── src/                   # Primary extension source code
│   ├── content.jsx        # Content script bootstrap and Shadow DOM mounter
│   ├── core/              # Core automation, scheduling, networking, and DOM engines
│   ├── data/              # Creator metadata and static portfolio definitions
│   ├── inject/            # MAIN-world scripts for network interception
│   ├── popup/             # Extension popup React application
│   └── ui/                # Floating HUD React components and Tailwind stylesheets
│       └── components/    # Modular UI presentation widgets
└── test/                  # Test suites executed with Node.js native test runner
```

---

## Root Files

Configuration, build automation, extension manifest, and background service workers at the project root.

### `background.js`
- **Purpose:** Extension service worker coordinating background keep-alive timers, alarms, context menus, and keyboard shortcuts.
- **Key Exports / Listeners:** Chrome message dispatcher (`BACKGROUND_SLEEP`, `CANCEL_ALL_TIMERS`, `PING`), context menu handler (`setupContextMenu`), command shortcut listener (`toggle-modal`).

### `build.js`
- **Purpose:** Build automation script compiling Tailwind CSS, bundling React/Motion entry points with esbuild, and creating zip packages.
- **Key Exports / Functions:** `build()` orchestrating esbuild IIFE builds for `src/content.jsx` and `src/popup/popup.jsx`.

### `manifest.json`
- **Purpose:** Manifest V3 extension configuration defining permissions, content scripts, background worker, and action popup.
- **Key Permissions:** `storage`, `alarms`, `contextMenus`, `unlimitedStorage`, host permissions on `*://*.instagram.com/*`.

### `package.json`
- **Purpose:** Node package manifest specifying scripts (`build`, `test`, `watch`), dependencies, and metadata.
- **Key Dependencies:** React 19, Framer Motion 12, Tailwind CSS 3, Dexie 4, PapaParse 5, Phosphor Icons, esbuild.

### `tailwind.config.js`
- **Purpose:** Tailwind CSS configuration defining theme tokens, color scales, and content scanning paths.
- **Key Exports:** Configuration object with CSS variable mappings for shadcn-style theming.

---

## `src/` Directory

Primary source directory containing extension logic, UI, and injection handlers.

### `src/content.jsx`
- **Purpose:** Content script entry point creating an isolated Shadow DOM container and mounting the React 19 overlay.
- **Key Exports / Functions:** `init()` bootstrap function attaching `#ig-engagement-automator-root` and rendering `App`.

---

## `src/core/` Directory

Core automation subsystems, timing schedulers, network clients, and DOM adapters.

### `src/core/workflow.js`
- **Purpose:** Central state machine coordinating pre-flight calibration, like/comment steps, cooldowns, and navigation.
- **Key Exports:** `WorkflowEngine` class managing states (`Idle`, `Calibrating`, `Running`, `Paused`, `Stopped`, `Completed`), `advanceToNextPost`, `advanceToNextFeedPost`, `processLikeStep`, `processCommentStep`.

### `src/core/scanner.js`
- **Purpose:** Self-healing DOM discovery scanner using multilingual labels, geometric signatures, and structural heuristics.
- **Key Exports:** `DOMScanner` class, `MULTILINGUAL_LABELS` constant, `ACTION_BLOCK_PHRASES` constant, `probeLikeButton`, `probeCommentSystem`, `probeNextNavigation`, `probeFeedPosts`, `isFeedMode`, `resolveContainer`.

### `src/core/instagram-dom.js`
- **Purpose:** High-level DOM adapter bridging scanner discoveries to humanized click and typing actions.
- **Key Exports:** `InstagramDOMAdapter` class, `resolveNextButton`, `collectFeedPosts`, `isFeedMode`, `fillCommentInput`, `triggerClick`, `paintBadge`.

### `src/core/network-engine.js`
- **Purpose:** Direct Instagram Web GraphQL network client executing server-level likes and comments.
- **Key Exports:** `InstagramNetworkEngine` class, `shortcodeToMediaId()`, `extractPostInfo()`, `sendLike()`, `sendComment()`, `harvestSniffedMutation()`.

### `src/core/kinetic-engine.js`
- **Purpose:** Human emulation engine generating natural keystroke delays, cognitive pauses, and synthetic pointer events.
- **Key Exports:** `computeKeystrokeDelay()`, `simulateHumanType()`, `dispatchHumanClick()`.

### `src/core/scheduler.js`
- **Purpose:** Anti-throttling timing engine acquiring wake locks, overriding document visibility, and delegating sleep timers.
- **Key Exports:** `BackgroundScheduler` class, `sleep()`, `computeHumanDelayMs()`, `computeBackoffMs()`, `acquireWakeLock()`.

### `src/core/comment-deck.js`
- **Purpose:** Spintax comment rotation engine resolving nested permutations and preventing boundary duplicate selections.
- **Key Exports:** `CommentDeck` class, `parseSpintax()`.

### `src/core/vision-context.js`
- **Purpose:** Computer vision heuristic engine parsing Instagram auto-generated alt text into contextual keyword tokens.
- **Key Exports:** `cleanAltKeywords()`, `extractPostVisionContext()`, `resolveContextualTokens()`.

### `src/core/storage.js`
- **Purpose:** Chrome local storage wrapper managing configuration defaults, UI preferences, and profile route matching.
- **Key Exports:** `StorageService` class, `DEFAULT_SETTINGS` constant, `DEFAULT_PREFS` constant, `STORAGE_KEYS` constant.

### `src/core/db.js`
- **Purpose:** IndexedDB persistence layer utilizing Dexie.js with integrated PapaParse CSV export.
- **Key Exports:** `AppDatabase` class, `db` database instance, `sanitizeRecordForDB()`, `exportToCSV()`.

---

## `src/data/` Directory

Static configuration definitions and portfolio metadata.

### `src/data/creatorProfile.js`
- **Purpose:** Creator portfolio definitions and contact links imported into the About tab.
- **Key Exports:** `CREATOR` profile metadata constant.

### `src/data/portfolio-content.json`
- **Purpose:** Static JSON content synced during build containing author background, projects, and contact channels.

---

## `src/inject/` Directory

Scripts injected into the webpage's MAIN world context for deep browser runtime interception.

### `src/inject/sniffer.js`
- **Purpose:** Intercepts native `window.fetch` and `XMLHttpRequest` to capture Instagram GraphQL `doc_id` queries and mutation payloads.
- **Key Exports:** Event-driven MAIN world script dispatching window message payloads with harvested mutations.

---

## `src/popup/` Directory

Browser extension action popup rendered when clicking the extension icon in Chrome's toolbar.

### `src/popup/popup.jsx`
- **Purpose:** Client entry point rendering `PopupApp` into `#root` inside `popup.html`.
- **Key Exports:** Client bootstrap script.

### `src/popup/PopupApp.jsx`
- **Purpose:** Popup monitor component showing live automation status, session stats, and quick-toggle controls.
- **Key Exports:** `PopupApp` React component.

---

## `src/ui/` Directory

React 19 user interface mounted inside the Shadow DOM overlay.

### `src/ui/App.jsx`
- **Purpose:** Central floating HUD dashboard containing header controls, tab routing, action controls, and toast notifications.
- **Key Exports:** `App` React component.

### `src/ui/tailwind.css`
- **Purpose:** Tailwind base, component, and utility definitions imported during build compilation.

### `src/ui/components/AboutTab.jsx`
- **Purpose:** Tab displaying system specifications, build architecture, and author credentials.
- **Key Exports:** `AboutTab` React component.

### `src/ui/components/Button.jsx`
- **Purpose:** Modular animated button with Framer Motion tap scale effects and Tailwind variant styling.
- **Key Exports:** `Button` React component.

### `src/ui/components/Card.jsx`
- **Purpose:** Composable card container with sub-components for headers, titles, descriptions, and content areas.
- **Key Exports:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`.

### `src/ui/components/CreatorCard.jsx`
- **Purpose:** Portfolio card presenting creator contact links, skills, and portfolio website link.
- **Key Exports:** `CreatorCard` React component.

### `src/ui/components/DiagnosticCard.jsx`
- **Purpose:** Health metric card rendering individual DOM anchor status, strategy, and confidence score.
- **Key Exports:** `DiagnosticCard` React component.

### `src/ui/components/ErrorBoundary.jsx`
- **Purpose:** React error boundary isolating rendering failures and offering a recovery retry trigger.
- **Key Exports:** `ErrorBoundary` class component.

### `src/ui/components/Progress.jsx`
- **Purpose:** Animated progress bar displaying session post processing completion.
- **Key Exports:** `Progress` React component.

### `src/ui/components/Tabs.jsx`
- **Purpose:** Framer Motion spring-animated tab switchers and content containers.
- **Key Exports:** `TabsList`, `TabsTrigger`, `TabsContent` React components.

---

## `test/` Directory

Unit and integration test suites executed with Node.js native runner (`node --test`).

### `test/action-block.test.js`
- **Purpose:** Validates action block detection across "Try Again Later", "Action Blocked", and checkpoint modals.

### `test/comment-deck.test.js`
- **Purpose:** Validates spintax expansion, token interpolation (`{author}`, `{emoji}`), and non-repeating deck rotation.

### `test/creator-profile.test.js`
- **Purpose:** Validates author attribution across code constants, manifest files, and package configurations.

### `test/db.test.js`
- **Purpose:** Validates Dexie schema definitions, record sanitization, and PapaParse CSV serialization.

### `test/feed-navigation.test.js`
- **Purpose:** Validates infinite-scroll feed detection, feed article discovery, active container resolution, and downward scrolling.

### `test/kinetic-engine.test.js`
- **Purpose:** Validates keystroke delay boundaries, punctuation pauses, digraph boosts, and synthetic pointer event chains.

### `test/network-engine.test.js`
- **Purpose:** Validates shortcode base64 decoding to media IDs, CSRF extraction, and 404 endpoint deprecation handling.

### `test/network-graphql.test.js`
- **Purpose:** Validates GraphQL form payload construction, mutation harvesting, and HTTP 200 embedded error rejection.

### `test/vision-context.test.js`
- **Purpose:** Validates computer vision alt text parsing, stopword filtering, and contextual token resolution.

### `test/workflow-modes.test.js`
- **Purpose:** Validates workflow state transitions, hybrid failover triggers, headless grid batches, and profile route parsing.
