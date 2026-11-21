import { ImageResponse } from "next/og";

export const alt = "Orebit · daily space mining";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLORS = ["#8b8f9c", "#d9784a", "#6b97ff", "#f4c44f", "#6ff3e6", "#ff6fd8"];

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "linear-gradient(160deg, #0d0b1a 0%, #1b1030 100%)",
          color: "#f3eefc",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -140,
            bottom: -220,
            width: 640,
            height: 640,
            borderRadius: 320,
            background: "radial-gradient(circle at 35% 35%, #5a4a63, #241b2d 70%)",
          }}
        />
        <div style={{ fontSize: 34, letterSpacing: 10, color: "#ffb547", fontWeight: 700 }}>OREBIT</div>
        <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.02, marginTop: 20, display: "flex", flexDirection: "column" }}>
          <span>Five asteroids.</span>
          <span style={{ color: "#ffb547" }}>45 seconds each.</span>
        </div>
        <div style={{ fontSize: 32, color: "#b9b0cc", marginTop: 28 }}>Name what you know. Rare answers dig deeper.</div>
        <div style={{ display: "flex", gap: 18, marginTop: 40 }}>
          {TIER_COLORS.map((c) => (
            <div key={c} style={{ width: 30, height: 30, background: c, transform: "rotate(45deg)", borderRadius: 4 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
