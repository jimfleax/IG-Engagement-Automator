/**
 * @file build.ts
 * @description Compiles Tailwind CSS, bundles React/TypeScript extension scripts using Vite, and packages production distribution archives.
 * @architecture Build automation pipeline bridging UI source assets (React, TypeScript, Tailwind CSS) to extension bundles (content, popup, background) and release ZIP archives.
 * @agent_note Executes programmatic Vite builds and synchronous shell commands (tailwindcss, zip); requires Node child_process and file system permissions.
 * @author Reetabrata Bhandari (Jim Fleax)
 */
import { build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sanitizes bundle files to ensure strict Chromium UTF-8 compliance without Unicode non-characters.
 * Chromium's extension loader checks `base::IsStringUTF8()` which explicitly rejects code points
 * in the range U+FDD0-U+FDEF and any code point ending in FFFE or FFFF (such as Dexie's maxKey U+FFFF).
 */
function sanitizeExtensionBundle(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  // Replace any Unicode non-characters with standard \uXXXX escape sequences
  const sanitized = content.replace(/[\uFDD0-\uFDEF\uFFFE\uFFFF]/g, (match) => {
    return "\\u" + match.charCodeAt(0).toString(16).padStart(4, "0");
  });
  if (sanitized !== content) {
    fs.writeFileSync(filePath, sanitized, "utf8");
    console.log(`🛡️ Sanitized non-characters in ${filePath}`);
  }
}

/**
 * Orchestrates complete build process: syncs portfolio data, compiles stylesheets, creates Vite bundles, and packages release zip.
 */
async function buildExtension(): Promise<void> {
  console.log("⚡ Building Instagram Engagement Automator (Vite + TypeScript + React + Motion)...");

  // Ensure output directories exist
  if (!fs.existsSync("content")) fs.mkdirSync("content");
  if (!fs.existsSync("popup")) fs.mkdirSync("popup");
  if (!fs.existsSync("src/data")) fs.mkdirSync("src/data");

  // Sync creator portfolio data from ../JimFleax_Portfolio if available
  const portfolioSrc = path.resolve("../JimFleax_Portfolio/packages/frontend/content/content.json");
  const portfolioDest = path.resolve("src/data/portfolio-content.json");
  if (fs.existsSync(portfolioSrc)) {
    fs.copyFileSync(portfolioSrc, portfolioDest);
    console.log("📄 Synced creator portfolio data from ../JimFleax_Portfolio");
  }

  // 1. Compile Tailwind & shadcn Styles
  console.log("🎨 Compiling Tailwind CSS...");
  execSync("npx tailwindcss -i src/ui/tailwind.css -o content/styles.css --minify", { stdio: "inherit" });
  execSync("npx tailwindcss -i src/ui/tailwind.css -o popup/popup.css --minify", { stdio: "inherit" });

  // 2. Bundle Background Script (TypeScript -> background.js)
  console.log("📦 Bundling background.ts with Vite...");
  await viteBuild({
    configFile: false,
    build: {
      outDir: "dist-temp",
      emptyOutDir: true,
      lib: {
        entry: path.resolve(__dirname, "background.ts"),
        name: "background",
        formats: ["iife"],
        fileName: () => "background.js",
      },
      minify: true,
      target: "chrome100",
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });
  fs.copyFileSync("dist-temp/background.js", "background.js");
  fs.rmSync("dist-temp", { recursive: true, force: true });
  sanitizeExtensionBundle("background.js");

  // 3. Bundle Sniffer Script (TypeScript -> content/sniffer.js for MAIN world)
  console.log("📦 Bundling sniffer.ts with Vite...");
  await viteBuild({
    configFile: false,
    build: {
      outDir: "content",
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, "src/inject/sniffer.ts"),
        name: "sniffer",
        formats: ["iife"],
        fileName: () => "sniffer.js",
      },
      minify: true,
      target: "chrome100",
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });
  sanitizeExtensionBundle("content/sniffer.js");

  // 4. Bundle Content Script (React + Framer Motion + DOMScanner + Scoped CSS)
  console.log("📦 Bundling Content Script (content.tsx) with Vite...");
  await viteBuild({
    configFile: false,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: "content",
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, "src/content.tsx"),
        name: "contentScript",
        formats: ["iife"],
        fileName: () => "content.bundle.js",
      },
      minify: true,
      target: "chrome100",
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });
  sanitizeExtensionBundle("content/content.bundle.js");

  // 5. Bundle Popup Script (React + Framer Motion)
  console.log("📦 Bundling Popup Script (popup.tsx) with Vite...");
  await viteBuild({
    configFile: false,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: "popup",
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, "src/popup/popup.tsx"),
        name: "popupScript",
        formats: ["iife"],
        fileName: () => "popup.bundle.js",
      },
      minify: true,
      target: "chrome100",
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });
  sanitizeExtensionBundle("popup/popup.bundle.js");

  // 6. Update ZIP package
  console.log("🗜️ Packaging extension into ig-engagement-automator.zip...");
  if (fs.existsSync("ig-engagement-automator.zip")) fs.unlinkSync("ig-engagement-automator.zip");
  execSync("zip -r ig-engagement-automator.zip manifest.json background.js content popup icons README.md -x '*.DS_Store'", {
    stdio: "inherit",
  });

  console.log("✅ Build and packaging completed successfully with Vite + TypeScript!");
}

buildExtension().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
