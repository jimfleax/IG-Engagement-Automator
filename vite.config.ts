/**
 * @file vite.config.ts
 * @description Vite configuration for Instagram Engagement Automator.
 * @architecture Defines React plugins, path aliases, and build settings for extension assets.
 * @agent_note Used by Vite dev server and build.ts programmatic bundler.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "chrome100",
    minify: true,
  },
});
