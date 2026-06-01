import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg, #3d2010 0%, #1e0f07 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 112,
            fontFamily: "Georgia, serif",
            color: "#faf7f2",
            lineHeight: 1,
            marginTop: -8,
          }}
        >
          Y
        </span>
      </div>
    ),
    { ...size }
  );
}
