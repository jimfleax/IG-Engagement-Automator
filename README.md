# Instagram Engagement Automator (Chrome Extension - Manifest V3)

A modern, high-performance, and resilient Chrome Extension built with **React**, **Framer Motion**, and **shadcn/ui** design patterns by **Reetabrata Bhandari** ([Jim Fleax](https://jimfleax.in)). Features an intelligent **Self-Healing DOM Discovery & Calibration Engine** to guarantee reliability across frequent Instagram layout and class name updates.

---

## ⚡ What's New & Core Capabilities

### 1. Intelligent DOM Discovery & Calibration Engine (`DOMScanner`)
Because Instagram constantly randomizes class names and updates component layouts, hardcoded selectors inevitably break. This extension introduces an **Initialization & Pre-Flight Diagnostic Phase**:
- **Multi-Criteria Selector Scoring**: Discovers post containers, like buttons, comment fields, and navigation triggers using geometric dimensions ($24 \times 24$ action bar hearts vs $12 \times 12$ comment hearts), SVG path vector signatures, computed color states, and international dictionaries (25+ languages).
- **Interactive "DOM Health & Discovery" Tab**: View the real-time health score of your current page (e.g., `98% Confidence`) and inspect individual anchor diagnostics (Post Container, Like Action Trigger, Comment Input Engine, Submit Button, Navigation Arrow, Active Account).
- **Auto Self-Healing Execution**: If Instagram switches between standard `<textarea>` and the modern Lexical/DraftJS `contenteditable` editor, or re-renders the DOM, the engine dynamically self-heals and re-anchors targets in real time.

### 2. React, Motion & shadcn/ui Architecture
- Built with **React 19** and **Framer Motion** for smooth spring physics, sliding tab indicators, and layout transitions.
- Fully isolated inside **Shadow DOM** (`#ig-modal-suite-root`): Extension styles and Instagram's global styles never interfere with each other.
- **Floating Minimized Pill Widget**: Collapse the full suite into a floating status pill in the bottom-right corner with live pulse indicators and target progress.
- Clean **Chrome Toolbar Popup**: Fast glance at DOM health, active account, likes/comments counters, and remote Start/Pause/Stop/Toggle controls.
- Keyboard Shortcut: Press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd> to toggle the suite modal on Instagram.

### 3. Anti-Throttling & Privacy First
- Background Service Worker timer relay (`chrome.runtime.sendMessage`) bypassing Instagram's strict `worker-src` CSP.
- `navigator.locks` wake-lock acquisition to prevent OS/browser suspension during automation runs.
- 100% Client-Side storage (`chrome.storage.local`) with zero external API tracking or telemetry.
- One-click RFC 4180 compliant CSV export with UTF-8 BOM for Microsoft Excel.

---

## 📁 Project Structure

```text
IG Engagement Automator/
├── manifest.json              # Chrome Manifest V3 configuration & permissions
├── background.js              # Background service worker (timers, shortcuts, lifecycle)
├── build.js                   # esbuild build and packaging script
├── package.json               # npm dependencies and scripts
├── src/
│   ├── content.jsx            # Content script entry point (mounts React in Shadow DOM)
│   ├── core/
│   │   ├── scanner.js         # Intelligent DOM Discovery & Calibration Engine
│   │   ├── instagram-dom.js   # High-level DOM adapter with self-healing hooks
│   │   ├── workflow.js        # Sequential execution engine & state broadcaster
│   │   ├── scheduler.js       # Background scheduler, humanized jitter & wake locks
│   │   ├── comment-deck.js    # Fisher-Yates zero-repeat comment shuffle bag
│   │   └── storage.js         # chrome.storage.local service & migration layer
│   ├── ui/
│   │   ├── App.jsx            # Main React in-page suite modal & floating pill
│   │   ├── styles.css         # Scoped styling (shadcn-inspired design system)
│   │   └── components/
│   │       ├── Button.jsx     # shadcn Button with Motion tap animation
│   │       ├── Card.jsx       # shadcn Card, CardHeader, CardTitle, CardContent
│   │       ├── Badge.jsx      # shadcn Badge with status colors
│   │       ├── Tabs.jsx       # Animated tabs with sliding spring indicator
│   │       ├── Progress.jsx   # Animated session progress bar
│   │       └── DiagnosticCard.jsx # DOM anchor health card
│   └── popup/
│       ├── popup.jsx          # Popup entry point
│       ├── PopupApp.jsx       # React popup component for Chrome toolbar
│       ├── popup.html         # Popup HTML markup
│       └── popup.css          # Popup styles
├── content/
│   └── content.bundle.js      # Compiled IIFE content script bundle
├── popup/
│   ├── popup.html             # Loaded by extension action
│   ├── popup.css              # Loaded by popup HTML
│   └── popup.bundle.js        # Compiled popup bundle
├── icons/
│   ├── icon16.png             # 16x16 icon
│   ├── icon32.png             # 32x32 icon
│   ├── icon48.png             # 48x48 icon
│   └── icon128.png            # 128x128 icon
├── README.md                  # Documentation
└── ig-engagement-automator.zip # Packaged ready-to-use distribution archive
```

---

## 🛠️ Loading in Chrome (Developer Mode)

### Step 1: Open Chrome Extensions
1. Launch Google Chrome.
2. In the URL address bar, enter `chrome://extensions` and press Enter.

### Step 2: Enable Developer Mode
1. In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.

### Step 3: Load Unpacked Extension
1. Click **Load unpacked** in the top-left toolbar.
2. Select this project directory:
   ```text
   /run/media/jimfleax/DEV/Projects/IG Engagement Automator
   ```
   *(Or unzip `ig-engagement-automator.zip` and select the extracted folder).*
3. **Instagram Engagement Automator** is now active!

---

## 💻 Developer Commands

To rebuild the extension after making source changes:
```bash
# Compile React & Motion bundles and package zip
npm run build

# Watch mode for rapid local development
npm run watch
```

---

## 👨‍💻 Creator & Author

**Reetabrata Bhandari** (*Jim Fleax*)
- 🌐 **Portfolio & Web Apps**: [jimfleax.in](https://jimfleax.in)
- 🐙 **GitHub**: [@jimfleax](https://github.com/jimfleax)
- 💼 **LinkedIn**: [Reetabrata Bhandari](https://www.linkedin.com/in/jimfleax)
- 🐦 **X (Twitter)**: [@jimfleax](https://x.com/jimfleax)
- 📧 **Email**: [reetabrata.bhandari@gmail.com](mailto:reetabrata.bhandari@gmail.com)
- ✍️ **Substack**: [jimfleax.substack.com](https://jimfleax.substack.com)

*Passionate Full Stack Developer specializing in React, Next.js, TypeScript, Node.js, and Python. Engineered with pixel-perfect frontend aesthetics, robust backend architectures, and humanized automation patterns.*
