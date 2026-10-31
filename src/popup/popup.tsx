/**
 * @file popup.tsx
 * @description Mounts the extension toolbar popup interface into the extension action window.
 * @architecture Serves as the browser action popup entrypoint, instantiating the React root and rendering PopupApp into popup.html.
 * @agent_note Relies on the #root DOM element in popup.html; ensure bundling handles JSX properly without introducing external CSS leaks.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { PopupApp } from "./PopupApp.tsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<PopupApp />);
}
