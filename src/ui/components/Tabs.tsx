/**
 * @file Tabs.tsx
 * @description Implements animated segmented tabs with sliding spring indicator animations via Framer Motion.
 * @architecture Navigation primitive structuring the main modal into Controls, Settings, History, Diagnostics, and About views.
 * @agent_note Uses layoutId="reactbits-tab-indicator" for spring transitions; ensure tab values uniquely match across trigger and content.
 */
import React from "react";
import { motion } from "framer-motion";

export interface TabsListProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Container list for tab triggers providing pill background styling.
 */
export function TabsList({ children, className = "" }: TabsListProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/70 mx-4 my-2.5 select-none ${className}`}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  activeTab: string;
  onClick: (value: string) => void;
  children?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

/**
 * Individual tab trigger button with animated spring active indicator.
 */
export function TabsTrigger({
  value,
  activeTab,
  onClick,
  children,
  icon: Icon,
  className = "",
}: TabsTriggerProps): React.JSX.Element {
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onClick(value)}
      className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium cursor-pointer rounded-lg transition-colors outline-none z-10 ${
        isActive ? "text-blue-700 font-semibold" : "text-slate-500 hover:text-slate-800"
      } ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" weight={isActive ? "bold" : "regular"} />}
      <span className="truncate">{children}</span>

      {isActive && (
        <motion.div
          layoutId="reactbits-tab-indicator"
          className="absolute inset-0 bg-white rounded-lg shadow-xs border border-blue-100/80 -z-10"
          transition={{ type: "spring", stiffness: 450, damping: 32 }}
        />
      )}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  activeTab: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Content container rendered conditionally when its tab value matches activeTab.
 */
export function TabsContent({ value, activeTab, children, className = "" }: TabsContentProps): React.JSX.Element | null {
  if (value !== activeTab) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.99 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`px-4 pb-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}
