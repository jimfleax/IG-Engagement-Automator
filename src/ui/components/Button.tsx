/**
 * @file Button.tsx
 * @description Provides a reusable interactive button component styled with Tailwind CSS and animated via Framer Motion.
 * @architecture Atomic UI primitive consumed across App, PopupApp, and individual tab views for standardized action triggering.
 * @agent_note Wraps Framer Motion's motion.button; ensure disabled states suppress hover/tap animations and pass through HTML button props.
 */
import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "primaryAction";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
}

/**
 * Reusable animated button supporting multiple visual variants and sizes.
 */
export function Button({
  children,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
  onClick,
  type = "button",
  ...props
}: ButtonProps): React.JSX.Element {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  const sizeClasses: Record<string, string> = {
    sm: "h-7 px-2.5 text-xs gap-1.5",
    default: "h-9 px-3.5 py-1.5 text-xs gap-2",
    lg: "h-10 px-5 text-sm gap-2.5",
    icon: "h-8 w-8 p-0 shrink-0",
  };

  const variantClasses: Record<string, string> = {
    default:
      "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-sm shadow-blue-500/20 active:bg-blue-800",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 shadow-xs",
    outline:
      "bg-white text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 hover:border-blue-300 border border-slate-200 shadow-xs",
    ghost:
      "bg-transparent text-slate-600 hover:bg-blue-50/80 hover:text-blue-700",
    destructive:
      "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-xs active:bg-rose-200",
    primaryAction:
      "bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white font-semibold hover:opacity-95 shadow-md shadow-blue-500/25 active:opacity-90",
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? { scale: 1.015, y: -0.5 } : undefined}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.default} ${
        variantClasses[variant] || variantClasses.default
      } ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
