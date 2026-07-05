import { Img, staticFile, useVideoConfig } from "remotion";
import { mono } from "../fonts";
import { theme } from "../theme";

type ScreenshotFrameProps = {
  src: string;
  label: string;
  caption?: string;
  /** Share of composition width; default fits a 50/50 split layout */
  widthRatio?: number;
};

export const ScreenshotFrame: React.FC<ScreenshotFrameProps> = ({
  src,
  label,
  caption,
  widthRatio = 0.42,
}) => {
  const { width, height } = useVideoConfig();
  const frameW = Math.round(width * widthRatio);
  const imageH = Math.round(Math.min(frameW * 0.62, height * 0.62));

  return (
    <div
      style={{
        flexShrink: 0,
        width: frameW,
        border: `1px solid ${theme.fg}`,
        background: theme.panel,
        boxShadow: `6px 6px 0 ${theme.fg}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: `1px solid ${theme.border}`,
          fontFamily: mono,
          fontSize: 12,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        <span>{label}</span>
        <span style={{ color: theme.accent }}>●</span>
      </div>
      <div
        style={{
          width: "100%",
          height: imageH,
          background: theme.bg,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(`screenshots/${src}`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "top center",
          }}
        />
      </div>
      {caption && (
        <div
          style={{
            padding: "12px 14px",
            fontFamily: mono,
            fontSize: 14,
            color: theme.muted,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};

export const splitSceneStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "64px 96px",
  gap: 48,
};

export const splitTextColumnStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  maxWidth: 820,
  display: "flex",
  flexDirection: "column",
  gap: 28,
};
