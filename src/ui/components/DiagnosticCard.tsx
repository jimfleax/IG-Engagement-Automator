/**
 * @file DiagnosticCard.tsx
 * @description Displays health scores, detection strategy, and resolved states for individual DOM elements and network endpoints.
 * @architecture Consumed by App and diagnostic views to visualize live DOMScanner calibration results and engine integrity.
 * @agent_note Gracefully handles null/undefined data props; color-codes status indicators according to PASS/WARN/FAIL thresholds.
 */
import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react";

export interface DiagnosticCardProps {
  anchorKey: string;
  data: {
    status?: "PASS" | "WARN" | "FAIL";
    name?: string;
    confidence?: number;
    strategy?: string;
    state?: string;
    type?: string;
    handle?: string;
    [key: string]: any;
  } | null;
}

/**
 * Diagnostic card showing resolution confidence, detection strategy, and status icon for a target anchor.
 */
export function DiagnosticCard({ anchorKey, data }: DiagnosticCardProps): React.JSX.Element | null {
  if (!data) return null;

  const isPass = data.status === "PASS";
  const isWarn = data.status === "WARN";

  const StatusIcon = isPass ? CheckCircle : isWarn ? Warning : XCircle;
  const iconColor = isPass ? "text-blue-600" : isWarn ? "text-amber-500" : "text-rose-500";
  const scoreColor = isPass ? "text-blue-700" : isWarn ? "text-amber-700" : "text-rose-700";

  return (
    <motion.div
      whileHover={{ y: -1.5, transition: { duration: 0.15 } }}
      className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-colors hover:border-blue-300"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 shrink-0 ${iconColor}`} weight="fill" />
          <span className="text-xs font-semibold text-slate-900 leading-tight">
            {data.name || anchorKey}
          </span>
        </div>
        <span className={`text-xs font-bold ${scoreColor}`}>
          {data.confidence}%
        </span>
      </div>

      <div className="flex flex-col gap-1 text-[11px] text-slate-600 border-t border-slate-200/60 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Strategy:</span>
          <span className="font-mono text-[10px] text-slate-800 font-medium">
            {data.strategy || "auto-detected"}
          </span>
        </div>

        {data.state && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">State:</span>
            <span className="font-medium text-slate-800 capitalize">{data.state}</span>
          </div>
        )}

        {data.type && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Engine:</span>
            <span className="font-medium text-slate-800">{data.type}</span>
          </div>
        )}

        {data.handle && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Account:</span>
            <span className="font-semibold text-blue-700">@{data.handle.replace(/^@/, '')}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
