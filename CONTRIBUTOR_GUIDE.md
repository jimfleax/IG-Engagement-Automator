# Contributor Guide

Welcome to the Instagram Engagement Automator! This guide provides everything you need to know to contribute effectively to the project.

---

## 1. Project Overview

The Instagram Engagement Automator is an open-source, client-side browser extension (Manifest V3) designed to help creators, community managers, and growth marketers automate genuine, human-paced engagement on Instagram.

Unlike traditional headless bots that risk account flags, this extension runs directly in your authenticated browser session and features:
- **Dual Page Navigation:** Operates on infinite-scroll home feed streams (`/`) and profile grid modal carousels (`/@username/`).
- **Human-Paced Kinetic Emulation:** Variable keystroke speeds, thinking pauses after punctuation, and authentic synthetic pointer event dispatching.
- **Self-Healing DOM Discovery:** Multilingual button detection and geometric SVG path matching that survives Instagram UI redesigns.
- **Context-Aware Spintax Comments:** Extracts vision alt-text keywords and interpolates dynamic slot tokens (`{topic}`, `{author}`, `{emoji}`).
- **Local Data Privacy:** Zero external servers or tracking; all logs are saved locally in IndexedDB and exportable to CSV.

---

## 2. Quick Start

Get running in three simple steps:

1. **Install dependencies:** `npm install`
2. **Build extension bundles:** `npm run build`
3. **Load unpacked into Chrome:** Open `chrome://extensions/`, enable *Developer mode*, click *Load unpacked*, and select this repository folder.

For detailed prerequisites and development watch mode, see the complete [Local Setup & Environment Guide](LOCAL_SETUP_ENV.md).

---

## 3. Project Structure Tour

```
ig-engagement-automator/
├── src/
│   ├── content.jsx        # Content script injection & Shadow DOM mounter
│   ├── inject/sniffer.js  # MAIN world GraphQL mutation sniffer
│   ├── popup/             # Extension toolbar popup React interface
│   ├── core/              # State machine, DOM heuristics, timing, and storage
│   └── ui/                # React 19 floating HUD and presentation components
├── test/                  # Test suites (Node.js native test runner)
├── docs/                  # Detailed architectural and API documentation
├── background.js          # Service worker for background keep-alives and shortcuts
└── build.js               # Tailwind compilation and esbuild packaging script
```

For an exhaustive file-by-file index, consult the [Codebase Directory & File Index](docs/CODEBASE_DIRECTORY_AND_FILE_INDEX.md).

---

## 4. Architecture at a Glance

The extension operates across multiple browser execution worlds to balance security and deep DOM access:
- **MAIN World (`src/inject/sniffer.js`):** Intercepts native network calls to harvest modern Instagram GraphQL `doc_id` queries without needing API secrets.
- **ISOLATED World (`src/content.jsx`):** Renders the React 19 floating HUD inside an isolated Shadow DOM container to prevent CSS interference.
- **Workflow State Machine (`src/core/workflow.js`):** Coordinates pre-flight calibration, like/comment steps, cooldown delays, and navigation.

Read the [Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md) for full architectural diagrams and data flow details.

---

## 5. Key Features & Where to Find Them

| Feature | Primary Files | Key Functions / Components |
|---|---|---|
| **Feed Infinite Scroll** | `src/core/scanner.js`<br>`src/core/workflow.js` | `isFeedMode()`, `probeFeedPosts()`, `advanceToNextFeedPost()` |
| **Modal Arrow Navigation** | `src/core/scanner.js`<br>`src/core/workflow.js` | `probeNextNavigation()`, `advanceToNextPost()` |
| **DOM Diagnostics** | `src/core/scanner.js`<br>`src/ui/components/DiagnosticCard.jsx` | `runFullDiagnostics()`, `<DiagnosticCard />` |
| **Human Kinetic Typing** | `src/core/kinetic-engine.js` | `computeKeystrokeDelay()`, `simulateHumanType()` |
| **Direct GraphQL Network** | `src/core/network-engine.js` | `sendLike()`, `sendComment()`, `validateEndpoints()` |
| **Spintax & Vision Tokens** | `src/core/comment-deck.js`<br>`src/core/vision-context.js` | `parseSpintax()`, `extractPostVisionContext()` |
| **Floating HUD Overlay** | `src/ui/App.jsx` | `<App />`, `<Tabs />`, `<Progress />` |
| **IndexedDB CSV Export** | `src/core/db.js` | `exportToCSV()`, `saveEngagementRecord()` |

---

## 6. How to Test Features Manually

### Test 1: Home Feed Infinite Scroll
1. Navigate to `https://www.instagram.com/` (Home feed).
2. Press `Alt + Shift + I` (or click the extension icon) to open the HUD.
3. Observe that the status says: *"Ready — Home Feed detected (infinite scroll active)"*.
4. Click **Start**. The automator will:
   - Identify the first post in view.
   - Like and/or comment according to settings.
   - Smoothly scroll down to the next post below it.
   - Automatically trigger infinite scroll when reaching the bottom of loaded posts.

### Test 2: Profile Grid Modal Engagement
1. Navigate to any creator profile (e.g., `https://www.instagram.com/natgeo/`).
2. Open the HUD and notice the target handle updates to `@natgeo`.
3. Click **Start**. The automator will click the first post thumbnail to open the modal, engage, and navigate using the next post arrow.

### Test 3: DOM Diagnostics Verification
1. Click the **Diagnostics** tab in the HUD.
2. Confirm all 6 anchor cards show **PASS** status with high confidence:
   - Post Container Anchor
   - Action Bar Like/Unlike Trigger
   - Comment Input Engine
   - Comment Submission Trigger
   - Next Post Navigation Trigger (or Feed Scroll Trigger)
   - Active Account Detection

---

## 7. Coding Conventions

- **Module Format:** ES Modules (`import`/`export`) across all source and test files.
- **JSDoc Standards:** Every JavaScript and JSX file must start with a file-level JSDoc header:
  ```javascript
  /**
   * @file filename.jsx
   * @description [What this file does]
   * @architecture [How it fits into the broader system]
   * @agent_note [Important implementation or gotcha note]
   */
  ```
- **Styling:** Use Tailwind CSS utility classes inside Shadow DOM. Avoid inline `style` objects for structural layout.
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(feed): add vertical infinite-scroll navigation support`
  - `fix(dom): resolve comment textarea in feed posts`
  - `docs: update architecture overview and catalog`
  - `test: add unit coverage for feed detection`
- **Testing Before Committing:** Always verify that both build and tests pass cleanly:
  ```bash
  npm test && npm run build
  ```

---

## 8. Where Documentation Lives

All detailed technical documentation is maintained under the [`docs/`](docs/) directory:

- [docs/ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md) — System design & multi-world pattern
- [docs/CODEBASE_DIRECTORY_AND_FILE_INDEX.md](docs/CODEBASE_DIRECTORY_AND_FILE_INDEX.md) — Comprehensive directory tree & file reference
- [docs/VIEWS_AND_COMPONENTS_CATALOG.md](docs/VIEWS_AND_COMPONENTS_CATALOG.md) — Component props, state, and UI catalog
- [docs/ENDPOINT_MAPPING.md](docs/ENDPOINT_MAPPING.md) — Instagram web API & GraphQL mutation specs
- [docs/BACKEND_API_AND_DATA_MODELS.md](docs/BACKEND_API_AND_DATA_MODELS.md) — IndexedDB schemas & Chrome storage stores
- [docs/README.md](docs/README.md) — Documentation index & reading order

---

## 9. Getting Help & Reporting Issues

- **Author & Maintainer:** Reetabrata Bhandari ([@jimfleax](https://github.com/jimfleax))
- **Email:** `reetabrata.bhandari@gmail.com`
- **Website:** [jimfleax.in](https://jimfleax.in)
- **Bug Reports & Feature Requests:** Open an issue on GitHub.
