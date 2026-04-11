"use client";

/**
 * Intelligence terminal design primitives.
 *
 * These are the reusable building blocks for every page of the panel.
 * Goals: dense without being cluttered, subtle motion, tabular numbers,
 * one accent color (violet) with functional state colors.
 */

import {
  ComponentType,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  LucideIcon,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// Section wrapper
// ──────────────────────────────────────────────────────────────────
export function Section({
  title,
  subtitle,
  icon: Icon,
  right,
  children,
  className = "",
  padding = "default",
  tone = "default",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: "default" | "tight" | "none";
  tone?: "default" | "spotlight";
}) {
  const pad =
    padding === "none"
      ? ""
      : padding === "tight"
      ? "p-4"
      : "p-5";
  const extra =
    tone === "spotlight"
      ? "ring-1 ring-violet-500/20 bg-gradient-to-b from-violet-500/5 via-white/[0.015] to-white/[0.005]"
      : "";
  return (
    <section className={`panel-card panel-card-hover ${extra} ${className}`}>
      {(title || right) && (
        <header className={`flex items-start justify-between gap-3 ${pad} pb-3`}>
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                {Icon && <Icon className="h-3.5 w-3.5 text-violet-400" />}
                <span>{title}</span>
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {subtitle}
              </p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={pad + " pt-0"}>{children}</div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Stat card with sparkline + delta
// ──────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  sparkline,
  accent = "violet",
  icon: Icon,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  hint?: ReactNode;
  sparkline?: number[];
  accent?: "violet" | "cyan" | "emerald" | "amber" | "rose" | "blue" | "neutral";
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  mono?: boolean;
}) {
  const accentHex: Record<string, string> = {
    violet: "#a78bfa",
    cyan: "#22d3ee",
    emerald: "#34d399",
    amber: "#fbbf24",
    rose: "#fb7185",
    blue: "#60a5fa",
    neutral: "#a1a1aa",
  };
  const hex = accentHex[accent];

  return (
    <div className="panel-card panel-card-hover group relative overflow-hidden">
      {/* accent top border */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}99, transparent)` }}
      />
      <div className="relative flex items-start justify-between p-4">
        <div className="flex-1 min-w-0">
          <p className="panel-label flex items-center gap-1.5">
            {Icon && <Icon className="h-3 w-3" style={{ color: hex }} />}
            {label}
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tracking-tight text-white panel-value num-tabular count-up ${
              mono ? "font-mono" : ""
            }`}
          >
            {value}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
            {delta !== undefined && delta !== null && (
              <DeltaBadge value={delta} label={deltaLabel} />
            )}
            {hint && <span className="truncate">{hint}</span>}
          </div>
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="h-10 w-full pb-1">
          <Sparkline values={sparkline} color={hex} />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Delta badge
// ──────────────────────────────────────────────────────────────────
export function DeltaBadge({
  value,
  label,
  format = "pct",
}: {
  value: number | null | undefined;
  label?: string;
  format?: "pct" | "abs";
}) {
  if (value === null || value === undefined || Number.isNaN(value))
    return null;
  const formatted =
    format === "pct"
      ? `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`
      : `${value >= 0 ? "+" : ""}${value}`;
  const color =
    value > 0.005
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
      : value < -0.005
      ? "text-rose-300 bg-rose-500/10 border-rose-500/25"
      : "text-zinc-400 bg-white/[0.03] border-white/10";
  const Arrow =
    value > 0.005 ? ArrowUpRight : value < -0.005 ? ArrowDownRight : Minus;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold num-tabular ${color}`}
    >
      <Arrow className="h-2.5 w-2.5" />
      {formatted}
      {label && <span className="ml-1 font-normal text-zinc-500">{label}</span>}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sparkline (inline SVG, dependency-free)
// ──────────────────────────────────────────────────────────────────
export function Sparkline({
  values,
  color = "#a78bfa",
  width = "100%",
  height = 40,
  fill = true,
}: {
  values: number[];
  color?: string;
  width?: string | number;
  height?: number;
  fill?: boolean;
}) {
  if (values.length < 2)
    return <div className="h-full w-full" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / span) * 80 - 10;
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaPath = `${path} L 100 100 L 0 100 Z`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="block"
    >
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#spark-${color})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="1.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
// Mini histogram
// ──────────────────────────────────────────────────────────────────
export function MiniHistogram({
  bins,
  color = "#a78bfa",
  height = 56,
  label,
}: {
  bins: { bin: number; count: number }[];
  color?: string;
  height?: number;
  label?: string;
}) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="w-full">
      {label && (
        <p className="panel-label mb-1.5 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-zinc-600">n={bins.reduce((a, b) => a + b.count, 0)}</span>
        </p>
      )}
      <div className="flex items-end gap-px" style={{ height }}>
        {bins.map((b, i) => {
          const h = (b.count / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-[2px] transition-all duration-500"
              style={{
                height: `${Math.max(2, h)}%`,
                backgroundColor: b.count ? color : "rgba(255,255,255,0.04)",
                opacity: b.count ? 0.55 + (b.count / max) * 0.45 : 0.25,
              }}
              title={`bin ${b.bin} · ${b.count}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Density bar (horizontal share visualization)
// ──────────────────────────────────────────────────────────────────
export function DensityBar({
  value,
  max = 1,
  color = "#a78bfa",
  height = 6,
  glow = true,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  glow?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-white/[0.04]"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: glow ? `0 0 16px -2px ${color}66` : undefined,
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Count-up animated number
// ──────────────────────────────────────────────────────────────────
export function CountUp({
  value,
  format = (n: number) => n.toLocaleString(),
  duration = 700,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    const startedAt = performance.now();
    let raf = 0;
    function frame(now: number) {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(frame);
      else prev.current = end;
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{format(display)}</span>;
}

// ──────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      {Icon && <Icon className="h-6 w-6 text-zinc-600" />}
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {description && (
        <p className="max-w-sm text-[11px] leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Pill group (window switchers, filter tabs)
// ──────────────────────────────────────────────────────────────────
export function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
  renderLabel,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel?: (v: T) => ReactNode;
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 backdrop-blur-sm">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all num-tabular ${
              active
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {renderLabel ? renderLabel(opt) : String(opt)}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Meter (labeled horizontal bar row)
// ──────────────────────────────────────────────────────────────────
export function Meter({
  label,
  value,
  max = 1,
  color = "#a78bfa",
  annotation,
}: {
  label: ReactNode;
  value: number;
  max?: number;
  color?: string;
  annotation?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-zinc-300">{label}</span>
        <span className="shrink-0 text-zinc-500 num-tabular">{annotation}</span>
      </div>
      <DensityBar value={value} max={max} color={color} height={5} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Skeleton loader
// ──────────────────────────────────────────────────────────────────
export function Skeleton({
  className = "",
  height = 60,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`shimmer rounded-xl bg-white/[0.03] ${className}`}
      style={{ height }}
    />
  );
}
