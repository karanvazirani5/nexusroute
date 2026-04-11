"use client";

import { type ComponentType, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

/**
 * Unified page header used on every route.
 * Gives a gradient title, optional badge, subtitle, and right-aligned slot.
 */
export function PageHeader({
  badge,
  badgeColor = "violet",
  title,
  subtitle,
  icon: Icon,
  right,
  children,
}: {
  badge?: string;
  badgeColor?: "violet" | "emerald" | "blue" | "amber" | "cyan" | "rose";
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const badgeColors: Record<string, string> = {
    violet: "border-violet-500/30 bg-violet-500/5 text-violet-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  };

  return (
    <div className="fade-in space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {badge && (
            <span
              className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badgeColors[badgeColor]}`}
            >
              {Icon && <Icon className="h-2.5 w-2.5" />}
              {badge}
            </span>
          )}
          <h1 className="bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-[32px] font-semibold leading-[1.1] tracking-tight text-transparent md:text-[40px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Consistent page shell wrapping. Adds standard spacing around page content.
 */
export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`space-y-8 ${className}`}>{children}</div>;
}

/**
 * Chip-style action button used in page headers.
 */
export function ActionChip({
  children,
  onClick,
  href,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const cls = `panel-chip ${active ? "panel-chip-active" : ""} ${disabled ? "opacity-30 pointer-events-none" : ""}`;

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/**
 * Standard filter bar used across pages.
 * Wraps content in a panel-card with consistent padding.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="panel-card">
      <div className="flex flex-wrap items-center gap-3 p-4">{children}</div>
    </div>
  );
}

/**
 * Styled native select matching the panel design system.
 */
export function PanelSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: {
  value: string | number;
  onChange: (val: string) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 backdrop-blur-sm transition-colors hover:border-white/20 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Section divider with optional label.
 */
export function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="panel-divider" />;
  return (
    <div className="flex items-center gap-4">
      <div className="panel-divider flex-1" />
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </span>
      <div className="panel-divider flex-1" />
    </div>
  );
}

/**
 * Content card matching the panel aesthetic.
 */
export function PanelCard({
  children,
  className = "",
  hover = true,
  spotlight = false,
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  spotlight?: boolean;
  padding?: "default" | "tight" | "none";
}) {
  const pad =
    padding === "none" ? "" : padding === "tight" ? "p-4" : "p-5";
  const extra = spotlight
    ? "ring-1 ring-violet-500/20 bg-gradient-to-b from-violet-500/5 via-white/[0.015] to-white/[0.005]"
    : "";

  return (
    <div
      className={`panel-card ${hover ? "panel-card-hover" : ""} ${extra} ${pad} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Standard info row used across detail pages.
 */
export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-0.5 text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
