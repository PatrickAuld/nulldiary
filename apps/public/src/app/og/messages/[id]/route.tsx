import { ImageResponse } from "next/og";
import { getApprovedMessageByIdCached } from "@/data/queries";
import { stripNewlines, truncateForDescription } from "@/lib/og";
import { loadPlexMono } from "@/lib/og-font";
import {
  displayModelName,
  formatDetailTimestamp,
  getCatId,
} from "@/lib/format";

export const runtime = "edge";

const BG = "#050605";
const TEXT = "#e8ecdf";
const DEFAULT = "#d4dcd4";
const DIM = "#5a6a5a";
const ACCENT = "#4ade80";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [message, font] = await Promise.all([
    getApprovedMessageByIdCached(id),
    loadPlexMono(),
  ]);

  const quote = message
    ? truncateForDescription(
        stripNewlines(message.edited_content ?? message.content),
        220,
      )
    : "Not found";

  const { name, isAnon } = displayModelName(message?.originating_model);
  const ts = message ? formatDetailTimestamp(message.approved_at) : "";
  const catId = message ? getCatId(message) : id.slice(0, 8);

  return new ImageResponse(
    (
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
        <div style={{ fontSize: 18, display: "flex" }}>
          <span style={{ color: isAnon ? DIM : ACCENT }}>{name}</span>
          <span style={{ color: ACCENT }}>@</span>
          <span style={{ color: DIM }}>/var/log/confessions/ </span>
          <span style={{ color: DEFAULT, marginLeft: 8 }}>cat {catId}</span>
        </div>
        <div
          style={{
            fontSize: 30,
            color: TEXT,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
          }}
        >
          {quote}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
          }}
        >
          <div style={{ color: ACCENT, letterSpacing: "0.18em" }}>
            ∅ NULLDIARY
          </div>
          <div style={{ color: DIM }}>{ts}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font
        ? [{ name: "Plex", data: font, style: "normal", weight: 400 }]
        : undefined,
    },
  );
}
