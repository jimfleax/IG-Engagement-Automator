/**
 * @file AboutTab.tsx
 * @description Displays architectural documentation, feature highlights, privacy notice, and creator profile information within the modal suite.
 * @architecture Embedded as a tab panel in the main App UI, integrating the CreatorCard sub-component and presenting system specifications.
 * @agent_note Keep architectural highlights synchronized with current features and ensure creator profile links open safely in new browser tabs.
 */
import React from "react";
import {
  ShieldCheck,
  Lightning,
  Cpu,
  Sparkle,
  HardDrives,
  CheckCircle,
  Command,
  Info,
} from "@phosphor-icons/react";
import { CreatorCard } from "./CreatorCard.tsx";

/**
 * Tab panel component rendering extension overview, architectural highlights, privacy notice, and author credentials.
 * @author Reetabrata Bhandari
 */
export function AboutTab(): React.JSX.Element {
  return (
    <div className="space-y-4 text-slate-800">
      {/* Extension Hero & Architecture Header */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="ig-gradient-logo text-white font-bold text-xs">IG</div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-2">
                Instagram Engagement Automator
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  v1.0.0
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Humanized Post Engagement Suite with Self-Healing DOM Discovery
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-3">
          Instagram Engagement Automator is an advanced, client-side automation tool designed to safely and authentically boost engagement on Instagram posts. Engineered with React 19, Framer Motion, and a self-healing DOM scanner, it delivers high reliability even when Instagram updates its layout and class names.
        </p>

        {/* System Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
          <span className="text-[10.5px] bg-white text-slate-700 font-medium px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-500" weight="fill" />
            Chrome Manifest V3
          </span>
          <span className="text-[10.5px] bg-white text-slate-700 font-medium px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-blue-500" weight="fill" />
            React 19 & Framer Motion
          </span>
          <span className="text-[10.5px] bg-white text-slate-700 font-medium px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-indigo-500" weight="fill" />
            Shadow DOM Isolated
          </span>
          <span className="text-[10.5px] bg-white text-slate-700 font-medium px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1">
            <Command className="w-3 h-3 text-slate-500" weight="bold" />
            Shortcut: Alt+Shift+I
          </span>
        </div>
      </div>

      {/* Core Engineering Highlights (2x2 Grid) */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
          <Info className="w-3.5 h-3.5 text-blue-600" weight="bold" />
          <span>Core Engineering Highlights</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Feature 1 */}
          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                <ShieldCheck className="w-4 h-4" weight="bold" />
              </div>
              <h4 className="font-semibold text-xs text-slate-900">Self-Healing DOM Discovery</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Discovers elements via geometric bounds, SVG vector paths, and 25+ language dictionaries. Recalibrates instantly when Instagram swaps DOM structures.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
                <Lightning className="w-4 h-4" weight="fill" />
              </div>
              <h4 className="font-semibold text-xs text-slate-900">Hybrid Execution Engine</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Employs direct background GraphQL mutations when armed, seamlessly falling back to humanized DOM simulation if endpoints are throttled.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                <Cpu className="w-4 h-4" weight="bold" />
              </div>
              <h4 className="font-semibold text-xs text-slate-900">Kinetic Physics & Anti-Throttling</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Organic keystroke delays (80–140ms), punctuation thinking pauses, digraph speedups, natural typos, and wake-lock prevention.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                <Sparkle className="w-4 h-4" weight="fill" />
              </div>
              <h4 className="font-semibold text-xs text-slate-900">Vision Context & Spintax</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Inspects image alt-text to interpolate contextual tokens like &#123;topic&#125; and &#123;category&#125; into randomized, non-repeating comments.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2.5 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-emerald-900 text-xs">
        <HardDrives className="w-5 h-5 text-emerald-600 shrink-0" weight="fill" />
        <div className="leading-snug">
          <span className="font-semibold">100% Client-Side Privacy: </span>
          All records, settings, and metrics reside purely in your browser's IndexedDB and local storage. No external servers or telemetry tracking.
        </div>
      </div>

      {/* Creator Profile Section */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
          <span>👨‍💻 Creator & Owner</span>
        </div>
        <CreatorCard />
      </div>
    </div>
  );
}
