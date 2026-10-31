/**
 * @file Card.tsx
 * @description Implements modular container card components inspired by shadcn/ui with animated hover states.
 * @architecture Atomic UI building blocks used to segment settings, diagnostics, metrics, and content sections throughout the application.
 * @agent_note Contains composite exports (Card, CardHeader, CardTitle, CardDescription, CardContent); preserve child layout structure when refactoring.
 */
import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export interface CardProps extends HTMLMotionProps<"div"> {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Animated container card with rounded borders and subtle hover elevation.
 */
export function Card({ children, className = "", ...props }: CardProps): React.JSX.Element {
  return (
    <motion.div
      whileHover={{ y: -1.5, transition: { duration: 0.15 } }}
      className={`bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-blue-200 hover:shadow-sm ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Header section for Card component with bottom border separator.
 */
export function CardHeader({ children, className = "", ...props }: CardSectionProps): React.JSX.Element {
  return (
    <div className={`p-4 border-b border-slate-100 flex flex-col gap-1 ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Title text heading for Card headers.
 */
export function CardTitle({ children, className = "", ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={`text-xs font-semibold text-slate-900 tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

/**
 * Subtitle or descriptive caption for Card headers.
 */
export function CardDescription({ children, className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p className={`text-[11px] text-slate-500 ${className}`} {...props}>
      {children}
    </p>
  );
}

/**
 * Main content body section for Card components.
 */
export function CardContent({ children, className = "", ...props }: CardSectionProps): React.JSX.Element {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
