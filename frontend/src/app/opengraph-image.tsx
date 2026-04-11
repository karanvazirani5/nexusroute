import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NexusRoute — AI Model Intelligence Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(145deg, #0a0a1a 0%, #0d0d2b 40%, #1a0a2e 70%, #0a0a1a 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow orbs */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-100px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #8b5cf6, #22d3ee, #8b5cf6, transparent)",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "88px",
            height: "88px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(34,211,238,0.15) 100%)",
            border: "1px solid rgba(139,92,246,0.3)",
            marginBottom: "32px",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
          >
            {/* Abstract routing icon — three paths converging */}
            <path
              d="M8 12L24 24L40 12"
              stroke="#8b5cf6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 24L24 36L40 24"
              stroke="#22d3ee"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
            <path
              d="M24 8V40"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.5"
            />
            <circle cx="24" cy="24" r="4" fill="#8b5cf6" />
            <circle cx="8" cy="12" r="3" fill="#22d3ee" opacity="0.8" />
            <circle cx="40" cy="12" r="3" fill="#22d3ee" opacity="0.8" />
            <circle cx="8" cy="24" r="2.5" fill="#8b5cf6" opacity="0.6" />
            <circle cx="40" cy="24" r="2.5" fill="#8b5cf6" opacity="0.6" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "56px",
            fontWeight: 700,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #94a3b8 100%)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1.1,
          }}
        >
          NexusRoute
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            fontWeight: 500,
            color: "#a1a1aa",
            marginTop: "16px",
            letterSpacing: "-0.5px",
          }}
        >
          AI Model Intelligence Platform
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: "16px",
            color: "#71717a",
            marginTop: "24px",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#8b5cf6" }}>●</span> Route any prompt
          </span>
          <span style={{ color: "#3f3f46" }}>|</span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#22d3ee" }}>●</span> 24+ Models
          </span>
          <span style={{ color: "#3f3f46" }}>|</span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#4ade80" }}>●</span> Free &amp; Private
          </span>
        </div>

        {/* Bottom domain */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            display: "flex",
            fontSize: "14px",
            fontWeight: 500,
            color: "#52525b",
            letterSpacing: "1px",
          }}
        >
          nexusrouteai.com
        </div>
      </div>
    ),
    { ...size },
  );
}
