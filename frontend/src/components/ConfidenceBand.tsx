"use client";

import { useEffect, useState } from "react";
import { Shield, TrendingUp, Scale, AlertTriangle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Band {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  advice: string;
}

const BANDS: Band[] = [
  {
    label: "High confidence",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: Shield,
    advice: "Users usually accept this recommendation for similar tasks.",
  },
  {
    label: "Good bet",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: TrendingUp,
    advice: "Strong match for your requirements.",
  },
  {
    label: "Close call",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: Scale,
    advice: "Compare the top two if nuance matters.",
  },
  {
    label: "Needs comparison",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
    advice: "Consider comparing alternatives before deciding.",
  },
];

function getBand(calibrated: number): Band {
  if (calibrated >= 0.85) return BANDS[0];
  if (calibrated >= 0.65) return BANDS[1];
  if (calibrated >= 0.45) return BANDS[2];
  return BANDS[3];
}

// Cache calibration curve in sessionStorage
let cachedCurve: Array<{ midpoint: number; empirical: number }> | null = null;

async function fetchCalibrationCurve(): Promise<typeof cachedCurve> {
  if (cachedCurve) return cachedCurve;

  const stored = typeof window !== "undefined" ? sessionStorage.getItem("nr_calibration_curve") : null;
  if (stored) {
    try {
      cachedCurve = JSON.parse(stored);
      return cachedCurve;
    } catch {}
  }

  try {
    const res = await fetch(`${API}/panel/quality/calibration/curve`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.has_calibration || !data.curve?.length) return null;
    cachedCurve = data.curve;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nr_calibration_curve", JSON.stringify(data.curve));
    }
    return cachedCurve;
  } catch {
    return null;
  }
}

function interpolate(raw: number, curve: Array<{ midpoint: number; empirical: number }>): number {
  if (curve.length === 0) return raw;
  if (raw <= curve[0].midpoint) return curve[0].empirical;
  if (raw >= curve[curve.length - 1].midpoint) return curve[curve.length - 1].empirical;

  for (let i = 0; i < curve.length - 1; i++) {
    if (curve[i].midpoint <= raw && raw <= curve[i + 1].midpoint) {
      const t = (raw - curve[i].midpoint) / (curve[i + 1].midpoint - curve[i].midpoint);
      return curve[i].empirical + t * (curve[i + 1].empirical - curve[i].empirical);
    }
  }
  return raw;
}

interface ConfidenceBandProps {
  rawConfidence: number; // 0-100 scale from analyzer
  showAdvice?: boolean;
  compact?: boolean;
}

export default function ConfidenceBand({ rawConfidence, showAdvice = true, compact = false }: ConfidenceBandProps) {
  const raw01 = Math.max(0, Math.min(1, rawConfidence / 100));
  const [calibrated, setCalibrated] = useState(raw01);
  const [hasCalibration, setHasCalibration] = useState(false);

  useEffect(() => {
    fetchCalibrationCurve().then((curve) => {
      if (curve && curve.length > 0) {
        setCalibrated(interpolate(raw01, curve));
        setHasCalibration(true);
      }
    });
  }, [raw01]);

  const band = getBand(calibrated);
  const Icon = band.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${band.bgColor} ${band.color} border ${band.borderColor}`}>
        <Icon className="h-3 w-3" />
        {band.label}
        <span className="text-zinc-500 ml-1">{Math.round(calibrated * 100)}%</span>
      </span>
    );
  }

  return (
    <div className={`rounded-xl border ${band.borderColor} ${band.bgColor} p-3 space-y-1`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${band.color}`} />
        <span className={`text-sm font-bold ${band.color}`}>{band.label}</span>
        <span className="text-xs text-zinc-500 ml-auto font-mono">
          {Math.round(calibrated * 100)}%
          {hasCalibration && calibrated !== raw01 && (
            <span className="text-zinc-600 ml-1">(raw {Math.round(raw01 * 100)}%)</span>
          )}
        </span>
      </div>
      {showAdvice && (
        <p className="text-[11px] text-zinc-400">{band.advice}</p>
      )}
    </div>
  );
}
