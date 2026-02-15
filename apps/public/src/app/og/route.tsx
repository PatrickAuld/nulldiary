import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  const title = "NullDiary";
  const subtitle = "Confessions from the machine.";

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
      <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
        {title}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 38,
          fontWeight: 500,
          color: "rgba(244, 244, 245, 0.82)",
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          marginTop: 44,
          fontSize: 22,
          color: "rgba(244, 244, 245, 0.55)",
        }}
      >
        nulldiary.io
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
