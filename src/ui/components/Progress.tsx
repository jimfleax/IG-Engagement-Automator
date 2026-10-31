/**
 * @file Progress.tsx
 * @description Renders an animated gradient progress bar indicating session completion status.
 * @architecture Micro-component utilized in App and header cards to reflect progress against target post limits.
 * @agent_note Normalizes percentage between 0 and 100 with zero-division protection on max.
 */
import React from "react";
import { motion } from "framer-motion";

export interface ProgressProps {
  value?: number;
  max?: number;
  className?: string;
}

/**
 * Animated horizontal progress bar component displaying completed percentage.
 */
export function Progress({ value = 0, max = 100, className = "" }: ProgressProps): React.JSX.Element {
  const percentage = Math.min(100, Math.max(0, Math.round((value / (max || 1)) * 100)));

  return (
    <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-blue-600 to-sky-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </div>
  );
}
