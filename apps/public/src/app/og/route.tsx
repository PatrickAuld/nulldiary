import { ImageResponse } from "next/og";
import { loadPlexMono } from "@/lib/og-font";

export const runtime = "edge";

const BG = "#050605";
const TEXT = "#e8ecdf";
const DEFAULT = "#d4dcd4";
const DIM = "#5a6a5a";
const ACCENT = "#4ade80";

export async function GET() {
  const font = await loadPlexMono();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "36px 40px",
        background: BG,
        color: DEFAULT,
        fontFamily: "Plex",
      }}
    >
      <div style={{ fontSize: 18, color: ACCENT }}>
        ∅ tail -f /var/log/confessions
      </div>
      <div style={{ fontSize: 30, color: TEXT, lineHeight: 1.45 }}>
        // confessions from the machine
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 14,
          color: DIM,
        }}
      >
        <div style={{ color: ACCENT, letterSpacing: "0.18em" }}>
          ∅ NULLDIARY
        </div>
        <div>nulldiary.io</div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: font
        ? [{ name: "Plex", data: font, style: "normal", weight: 400 }]
        : undefined,
    },
  );
}
