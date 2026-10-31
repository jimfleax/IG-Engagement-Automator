# Local Setup & Environment Guide

This guide walks through cloning, installing dependencies, building the extension bundles, and loading the unpacked extension into Google Chrome for local development and testing.

---

## 1. Prerequisites

Before setting up the project, ensure you have the following software installed:

- **Node.js:** v18.0.0 or higher (v20+ recommended). Check via `node -v`.
- **npm:** v9.0.0 or higher. Check via `npm -v`.
- **Google Chrome / Brave / Chromium:** Any modern Chromium-based browser supporting Manifest V3.
- **Git:** Version control client for cloning the repository.
- **zip utility:** Command-line `zip` tool (pre-installed on Linux/macOS) used by `build.js` for packaging.

---

## 2. Clone & Install

Clone the repository and install project dependencies:

```bash
# 1. Clone the repository
git clone https://github.com/jimfleax/ig-engagement-automator.git

# 2. Enter directory
cd "ig-engagement-automator"

# 3. Install npm dependencies
npm install
```

---

## 3. Environment Variables & Credentials

> [!NOTE]
> **No Credentials Required:** This project is a client-side Chrome Extension that operates entirely within your active browser session on Instagram. It requires **no API keys, database credentials, or `.env` configuration files**. Authentication is derived directly from your browser's existing Instagram login session cookies.

---

## 4. Building the Extension

Run the build script to compile the Tailwind styles, bundle the React entry points with esbuild, and package the distribution zip:

```bash
npm run build
```

The build script will execute the following steps:
1. Ensure `content/`, `popup/`, and `src/data/` directories exist.
2. Compile and minify Tailwind CSS into `content/styles.css` and `popup/popup.css`.
3. Copy `src/inject/sniffer.js` to `content/sniffer.js` for MAIN world injection.
4. Bundle `src/content.jsx` into `content/content.bundle.js` with esbuild.
5. Bundle `src/popup/popup.jsx` into `popup/popup.bundle.js` with esbuild.
6. Package the extension assets into `ig-engagement-automator.zip`.

---

## 5. Loading into Google Chrome

To run and test the extension in Google Chrome:

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle in the upper right-hand corner.
3. Click the **Load unpacked** button in the top left.
4. Select the project root folder (`IG Engagement Automator`).
5. Confirm that **Instagram Engagement Automator** appears in your extension cards list with version `1.0.0`.

---

## 6. Development Workflow & Live Watching

### Running Tests
Execute the unit and integration test suite:

```bash
npm test
```

### Active File Watcher
To automatically rebuild bundles when editing source files:

```bash
npm run watch
```

Whenever you modify extension code:
1. Run `npm run build` (or have `npm run watch` running).
2. Visit `chrome://extensions/` and click the **Reload (↻)** icon on the extension card.
3. Refresh your Instagram tab to mount the updated content script.

---

## 7. Common Pitfalls & Troubleshooting

### Problem: "Could not load manifest" error when loading unpacked
- **Cause:** You selected the `content/` or `popup/` subdirectory instead of the project root.
- **Fix:** Choose the root directory containing `manifest.json`.

### Problem: Changes to React components or styles not showing
- **Cause:** Content scripts are cached by the browser until the extension is reloaded and the page is refreshed.
- **Fix:** Run `npm run build`, click the reload icon on `chrome://extensions/`, and hard refresh Instagram (`Ctrl+F5` or `Cmd+Shift+R`).

### Problem: Tailwind CSS classes missing from HUD
- **Cause:** New Tailwind utility classes were added without recompiling CSS.
- **Fix:** Run `npm run build` to re-run the Tailwind CLI compiler across all JSX files.
