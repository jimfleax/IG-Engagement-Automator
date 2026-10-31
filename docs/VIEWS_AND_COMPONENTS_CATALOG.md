# Views and Components Catalog

Comprehensive catalog of all user interface views and reusable React components in the extension.

---

## 1. Top-Level Views

### `App` (`src/ui/App.jsx`)
- **Purpose:** The primary floating HUD (Heads-Up Display) overlay mounted directly into Instagram pages within an isolated Shadow DOM container. Provides real-time execution feedback, session metrics, configuration forms, diagnostic inspection, and action controls.
- **Render Context:** Renders on all matching Instagram pages (`https://www.instagram.com/*`) when enabled or toggled visible.
- **Props:**
  - `workflow` (`WorkflowEngine`, required): Instance of the central state machine and orchestrator.
- **State:**
  - `snapshot` (`Object`): Reactive copy of workflow state, user configuration, and UI preferences updated via `workflow.subscribe()`.
  - `formSettings` (`Object`): Local form draft state synchronized with `snapshot.config`.
  - `toastMessage` (`string|null`): Temporary notification message displayed at the bottom of the HUD.
  - `showResetConfirm` (`boolean`): Dialog state confirming whether to wipe session action history.
- **Child Components:** `Card`, `Button`, `TabsList`, `TabsTrigger`, `TabsContent`, `Progress`, `DiagnosticCard`, `CreatorCard`, `AboutTab`.
- **Keyboard / Interaction Triggers:**
  - `Alt + Shift + I` (or configured browser shortcut) toggles visibility.
  - Draggable header bar allows moving the HUD across the viewport.
  - Minimize button collapses HUD to a compact pill badge.

---

### `PopupApp` (`src/popup/PopupApp.jsx`)
- **Purpose:** Standalone popup view displayed when clicking the extension icon in Chrome's browser toolbar (`popup.html`). Allows quick status checking, starting/pausing workflows on the active Instagram tab, and opening settings.
- **Render Context:** Browser action toolbar popup (Chrome Extension popup window).
- **Props:** None (root component).
- **State:**
  - `tabStatus` (`Object|null`): Current status retrieved from active Instagram tab (`status`, `metrics`, `detectedUsername`).
  - `hasActiveTab` (`boolean`): True if active browser tab is on Instagram.
  - `loading` (`boolean`): Indicates ongoing message dispatch to tab.
- **Browser APIs Consumed:**
  - `chrome.tabs.query({ active: true, currentWindow: true })`
  - `chrome.tabs.sendMessage(tabId, { action: "GET_STATUS" })`
  - `chrome.tabs.sendMessage(tabId, { action: "TOGGLE_MODAL" })`
- **Child Components:** `Button`, status badge icons from Phosphor Icons.

---

## 2. Tab Views inside HUD

### `DashboardTab` (Inline in `src/ui/App.jsx`)
- **Purpose:** Main operational view displaying the current status banner, real-time metrics grid (Likes New, Already Liked, Comments New, Already Commented, Errors), progress bar, and primary control buttons (Start, Pause, Resume, Stop).
- **Render Condition:** Rendered inside `<TabsContent value="dashboard">`.
- **Key Interactions:**
  - **Start / Resume:** Triggers `workflow.start()` or `workflow.resume()`.
  - **Pause:** Triggers `workflow.pause()`.
  - **Stop:** Triggers `workflow.stop()`.
  - **Clear:** Triggers history wipe via `workflow.clearHistory()`.

### `SettingsTab` (Inline in `src/ui/App.jsx`)
- **Purpose:** Configuration panel allowing the user to customize operational parameters before or during engagement runs.
- **Render Condition:** Rendered inside `<TabsContent value="settings">`.
- **Configurable Settings:**
  - `myUsername`: Logged-in Instagram handle (auto-detected or manual).
  - `targetUsername`: Target profile handle (auto-detected from URL/page or manual).
  - `engineMode`: Dropdown selecting `hybrid` (Direct API + DOM fallback), `api` (Direct GraphQL), or `dom` (Pure synthetic click/typing).
  - `engagementMode`: Dropdown selecting `both` (Like + Comment), `like_only`, or `comment_only`.
  - `likeProbability`: Slider / number input (0% – 100%).
  - `commentProbability`: Slider / number input (0% – 100%).
  - `maxPostsToProcess`: Maximum posts to engage in one session.
  - `minActionDelayMs` / `maxActionDelayMs`: Random delay bounds between like and comment.
  - `minPostDelayMs` / `maxPostDelayMs`: Random cooldown bounds before advancing to next post.
  - `commentPool`: Multi-line textarea of comment templates with spintax support.

### `DiagnosticsTab` (Inline in `src/ui/App.jsx`)
- **Purpose:** Real-time DOM health inspection dashboard displaying individual anchor confidence scores, self-healing status, and active strategy names.
- **Render Condition:** Rendered inside `<TabsContent value="diagnostics">`.
- **Rendered Cards:**
  - Post Container Anchor (`DiagnosticCard`)
  - Like/Unlike Button Trigger (`DiagnosticCard`)
  - Comment Input Engine (`DiagnosticCard`)
  - Comment Submission Button (`DiagnosticCard`)
  - Next Navigation Trigger / Feed Scroll (`DiagnosticCard`)
  - Active Account Detection (`DiagnosticCard`)
- **Re-calibration Action:** "Run Calibration" button invokes `workflow.runCalibration()`.

### `AboutTab` (`src/ui/components/AboutTab.jsx`)
- **Purpose:** Technical specification and author credential showcase displaying the extension version, architectural layers, active runtime permissions, and creator portfolio card.
- **Render Condition:** Rendered inside `<TabsContent value="about">`.
- **Props:** None.
- **Child Components:** `CreatorCard`, `Card`.

---

## 3. Reusable Presentation Components

### `DiagnosticCard` (`src/ui/components/DiagnosticCard.jsx`)
- **Purpose:** Renders health confidence score, detection strategy, and resolved state for an anchor or engine diagnostic.
- **Props:**
  - `anchorKey` (`string`, required): Identifier for the diagnostic anchor (e.g., `"likeButton"`, `"nextNavigation"`).
  - `data` (`Object`, required): Diagnostic payload containing:
    - `name` (`string`): Human-readable title.
    - `confidence` (`number`): Resolution confidence percentage (0–100).
    - `status` (`"PASS"|"WARN"|"FAIL"`): Status indicator level.
    - `strategy` (`string`): Heuristic strategy used to resolve anchor.
    - `state` (`string`, optional): State if applicable (`"liked"|"unliked"`).
    - `handle` (`string`, optional): Resolved username handle if applicable.
- **Visual Styling:** Color-coded border and icons (Blue for PASS, Amber for WARN, Rose for FAIL).

### `CreatorCard` (`src/ui/components/CreatorCard.jsx`)
- **Purpose:** Author profile card presenting creator background, bio, skills, and links to GitHub, LinkedIn, and personal portfolio.
- **Props:** None (consumes static data from `src/data/creatorProfile.js`).
- **Data Attributes Rendered:** Author name, title, bio, core tech stack badges, verified external social links.

### `Progress` (`src/ui/components/Progress.jsx`)
- **Purpose:** Visual percentage progress bar with smooth Framer Motion spring fill animation.
- **Props:**
  - `value` (`number`, required): Percentage value (0 to 100).
  - `className` (`string`, optional): Additional CSS classes for container.

### `Button` (`src/ui/components/Button.jsx`)
- **Purpose:** Modular interactive button with micro-interactions, loading spinners, and styled variants.
- **Props:**
  - `variant` (`"default"|"secondary"|"outline"|"destructive"|"ghost"|"success"`): Visual style variant.
  - `size` (`"default"|"sm"|"lg"|"icon"`): Padding and font dimension.
  - `disabled` (`boolean`): Disables click events and reduces opacity.
  - `onClick` (`Function`): Click callback handler.
  - `children` (`ReactNode`): Button content.

### `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` (`src/ui/components/Card.jsx`)
- **Purpose:** Composable container components modeling standard shadcn-style card hierarchies.
- **Props:** Standard HTML `div` props plus `className` overrides.

### `TabsList`, `TabsTrigger`, `TabsContent` (`src/ui/components/Tabs.jsx`)
- **Purpose:** Accessible animated tab navigation system with sliding background pill animations on active selection.
- **Props:**
  - `TabsList`: Container wrapping tab trigger buttons.
  - `TabsTrigger` (`value`, `active`, `onClick`): Individual tab toggle button.
  - `TabsContent` (`value`, `activeValue`, `children`): Container conditionally visible when active value matches.

### `ErrorBoundary` (`src/ui/components/ErrorBoundary.jsx`)
- **Purpose:** React error boundary wrapping HUD components to catch render exceptions without crashing the host Instagram page.
- **State:** `hasError` (`boolean`), `error` (`Error|null`).
- **Fallback UI:** Displays error summary and a "Reset Automator" button.
