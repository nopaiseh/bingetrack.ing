import { ImageResponse } from "next/og";

export const alt = "bingetrack.ing 个人媒体记录平台";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "88px",
        color: "white",
        background: "radial-gradient(circle at 70% 30%, #5f1018 0%, #140405 42%, #050202 78%)",
      }}
    >
      <div style={{ color: "#f87171", fontSize: 30, letterSpacing: 8 }}>MEDIA JOURNAL</div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 78, fontWeight: 700 }}>bingetrack.ing</div>
      <div style={{ display: "flex", marginTop: 24, maxWidth: 850, color: "#d4d4d8", fontSize: 34 }}>
        记录、检索并回顾电影与电视剧观看历程
      </div>
    </div>,
    size,
  );
}
