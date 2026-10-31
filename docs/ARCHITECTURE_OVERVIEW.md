# Architecture Overview

## System Purpose
The Instagram Engagement Automator is a Chrome Extension (Manifest V3) that automates likes and context-aware comments on Instagram posts with organic human emulation. It operates across two primary page contexts: profile modal carousels and infinite-scroll home feed streams.

## Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| Platform | Chrome Extension (Manifest V3) | Modern browser extension runtime (`manifest.json`) |
| UI Framework | React 19 (`react`, `react-dom`) | Declarative floating HUD and browser action popup |
| Animations | Framer Motion 12 (`framer-motion`) | Smooth springs, draggable HUD, tab transitions |
| Styling | Tailwind CSS 3 + PostCSS | Utility-first styling scoped inside Shadow DOM |
| Local Database | Dexie.js 4 (`dexie`) | IndexedDB wrapper for action history and profiles (`src/core/db.js`) |
| Export Engine | PapaParse 5 (`papaparse`) | RFC-4180 compliant CSV export with unicode emoji handling |
| Icons | Phosphor Icons React (`@phosphor-icons/react`) | Consistent iconography across HUD tabs and diagnostics |
| Bundler | esbuild 0.25 | Fast bundling for Content Script and Popup (`build.js`) |
| Test Runner | Node.js native test runner (`node:test`) | Fast, dependency-free test execution (`test/**/*.test.js`) |

## Architecture Pattern & Execution Worlds

The extension adheres to an isolated multi-world architecture required by Manifest V3 to execute DOM manipulation, network interception, and background tasks safely:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          INSTAGRAM WEB PAGE                            │
│                                                                        │
│  ┌──────────────────────┐              ┌────────────────────────────┐  │
│  │      MAIN World      │  postMessage │       ISOLATED World       │  │
│  │ src/inject/sniffer.js│ ───────────> │      src/content.jsx       │  │
│  │ Intercepts fetch/XHR │              │ Shadow DOM Host Container  │  │
│  └──────────────────────┘              └─────────────┬──────────────┘  │
│                                                      │                 │
│                                                React 19 Tree           │
│                                                src/ui/App.jsx          │
│                                                      │                 │
│                                        ┌─────────────▼──────────────┐  │
│                                        │       WorkflowEngine       │  │
│                                        │    src/core/workflow.js    │  │
│                                        └─────────────┬──────────────┘  │
└──────────────────────────────────────────────────────┼─────────────────┘
                                                       │ chrome.runtime
                                         ┌─────────────▼──────────────┐
                                         │ Background Service Worker  │
                                         │      background.js         │
                                         │  Active Timers & Alarms    │
                                         └────────────────────────────┘
```

1. **MAIN World (`src/inject/sniffer.js`):** Injected directly into the host page context via `manifest.json` `world: "MAIN"`. Intercepts native `window.fetch` and `XMLHttpRequest` to harvest Instagram's active GraphQL `doc_id` queries and mutation parameters (`xdt_like_media`, `xdt_write_comment`), transmitting them to the content script via `window.postMessage`.
2. **ISOLATED World (`src/content.jsx`):** Bootstraps the extension within the page's isolated extension world. Creates an isolated Shadow DOM container (`#ig-engagement-automator-root`) to completely insulate Tailwind styles and React DOM trees from Instagram's CSS.
3. **Core Workflow Layer (`src/core/`):** Contains the headless state machine, DOM adapters, scheduling engines, network clients, and database stores.
4. **Presentation Layer (`src/ui/`):** React 19 components mounted into the Shadow DOM root.
5. **Background Service Worker (`background.js`):** Manages keep-alive timers via `BACKGROUND_SLEEP` messages to prevent browser tab throttling during automated delays.
6. **Popup Interface (`src/popup/`):** Standalone extension toolbar popup rendering `src/popup/PopupApp.jsx`.

## Layer Map & Data Flow

### 1. State & Lifecycle Flow
- **Orchestration:** `WorkflowEngine` in `src/core/workflow.js` drives the state machine across six states: `Idle` → `Calibrating` → `Running` → `Paused` → `Stopped` → `Completed`.
- **Subscription Model:** Components subscribe to `workflow.subscribe(listener)`, receiving immutable state snapshots (`getStateSnapshot`) whenever execution status, metrics, or diagnostics change.

### 2. Dual Navigation Architecture
The engine dynamically detects and branches between two distinct post navigation strategies:

```
                      WorkflowEngine.start()
                                │
                     dom.isFeedMode() check
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
        [Feed Mode]                         [Modal Mode]
     (Home Feed Page "/")             (Profile / Post Permalinks)
              │                                   │
   ensureFirstPostOpened()             ensureFirstPostOpened()
   Centers 1st feed article            Clicks thumbnail in grid
              │                                   │
   advanceToNextFeedPost()               advanceToNextPost()
   Scrolls down to next article        Clicks Next arrow / ArrowRight
   or window.scrollBy for infinite     or clicks next grid item
```

- **Feed Navigation (`advanceToNextFeedPost`):**
  - Scans DOM for `<article>` feed elements (`probeFeedPosts`).
  - Finds the active post element and scans down for the next unvisited article in document order.
  - Smoothly scrolls the candidate into center view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`).
  - When rendered DOM articles are exhausted, performs humanized window scrolling (`window.scrollBy`) to trigger Instagram's infinite scroll loader.
- **Modal Navigation (`advanceToNextPost`):**
  - Probes for the Next navigation button (`probeNextNavigation`).
  - Dispatches click or synthetic `ArrowRight` keyboard event.
  - Falls back to opening unvisited thumbnail elements directly from the profile grid (`collectGridPostLinks`).

### 3. Action Execution Modes
`WorkflowEngine` supports three selectable execution modes (`engineMode`):
- **Hybrid (Default):** Attempts direct GraphQL mutation via `InstagramNetworkEngine`. If the endpoint returns 404 or fails server confirmation, seamlessly falls back to synthetic DOM interactions (`InstagramDOMAdapter`).
- **DOM:** Executes all actions purely through simulated human clicks (`dispatchHumanClick`), character-by-character typing (`simulateHumanType`), and textarea value tracking.
- **API:** Pure headless GraphQL requests. If endpoints are unconfirmed, verifies outcomes via DOM.

## Key Design Decisions

1. **Shadow DOM Encapsulation (`src/content.jsx`):**
   Instagram's stylesheet includes global CSS rules that can interfere with standard UI libraries. All automator components are rendered inside a closed `shadowRoot` with pre-compiled Tailwind styles injected into a `<style>` block.
2. **Mutation Sniffing without Secret Keys (`src/inject/sniffer.js`):**
   Instagram regularly rotates internal GraphQL `doc_id` parameters. Rather than hardcoding transient query IDs, the extension passively listens to legitimate user actions or Instagram page requests, harvesting valid IDs into `chrome.storage.local`.
3. **Kinetic Human Emulation (`src/core/kinetic-engine.js`):**
   - Keystroke timing calculates delay curves with cognitive pauses after punctuation (`.`, `,`, `!`).
   - Faster transitions are computed for common English digraphs (`th`, `he`, `in`).
   - Click events generate a complete browser event sequence (`pointerover` → `pointerenter` → `pointerdown` → `mousedown` → `focus` → `pointerup` → `mouseup` → `click`).
4. **Action Block Protection (`src/core/scanner.js`):**
   Prior to every like or comment attempt, the DOM is scanned for multilingual block phrases (`ACTION_BLOCK_PHRASES`). If a restriction dialog is detected, automation halts immediately to protect the account.
5. **Contextual Token Interpolation (`src/core/vision-context.js`):**
   Extracts Instagram's automated accessibility alt text (e.g., *"May be an image of mountain, nature, outdoors"*) and resolves spintax tokens (`{topic}`, `{author}`, `{emoji}`) into authentic contextual comments.

## Cross-Cutting Concerns

- **Error Recovery:** Exponential backoff with random jitter is applied on failed interactions (`scheduler.computeBackoffMs`).
- **Data Persistence:** Action history and target profile tracking are persisted to both IndexedDB (`src/core/db.js`) and `chrome.storage.local` (`src/core/storage.js`).
- **Anti-Throttling:** Background keep-alive messaging (`BACKGROUND_SLEEP`) and `navigator.locks` wake locks maintain timer accuracy when browser tabs lose active focus.
