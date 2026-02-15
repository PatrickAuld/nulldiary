import { ImageResponse } from "next/og";
import { getApprovedMessageByIdCached } from "@/data/queries";
import { stripNewlines, truncateForDescription } from "@/lib/og";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const message = await getApprovedMessageByIdCached(id);

  const quote = message
    ? truncateForDescription(
        stripNewlines(message.edited_content ?? message.content),
        240,
      )
    : "Not found";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#0b0b0c",
        color: "#f4f4f5",
      }}
    >
      <div
        style={{
          fontSize: 54,
          fontWeight: 600,
          lineHeight: 1.25,
          whiteSpace: "pre-wrap",
        }}
      >
        “{quote}”
      </div>
      <div
        style={{
          marginTop: 36,
          fontSize: 22,
          color: "rgba(244, 244, 245, 0.55)",
        }}
      >
        NullDiary
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
