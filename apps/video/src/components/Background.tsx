import { AbsoluteFill } from "remotion";
import { theme } from "../theme";

export const Background: React.FC<{ accent?: boolean }> = ({ accent }) => (
  <AbsoluteFill
    style={{
      background: accent
        ? `linear-gradient(135deg, ${theme.bg} 0%, ${theme.panel} 100%)`
        : theme.bg,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 48,
        border: `1px solid ${theme.border}`,
        opacity: 0.5,
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 6,
        height: "100%",
        background: theme.accent,
      }}
    />
  </AbsoluteFill>
);
