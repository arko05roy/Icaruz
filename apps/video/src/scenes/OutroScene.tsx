import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { FadeInText } from "../components/AnimatedText";
import { theme } from "../theme";
import { mono } from "../fonts";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaScale = spring({
    frame: frame - 30,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  return (
    <AbsoluteFill>
      <Background accent />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <FadeInText text="ICARUZ" size={100} letterSpacing={10} uppercase />
        <FadeInText
          text="A panel of specialists. One answer. Fair economics."
          size={36}
          weight={500}
          delay={12}
          style={{ textAlign: "center", maxWidth: 900 }}
        />
        <div
          style={{
            transform: `scale(${interpolate(ctaScale, [0, 1], [0.9, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
            marginTop: 24,
            display: "flex",
            alignItems: "stretch",
            border: `2px solid ${theme.fg}`,
          }}
        >
          <div
            style={{
              width: 56,
              background: theme.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: mono,
              fontSize: 24,
              color: "#fff",
            }}
          >
            →
          </div>
          <div
            style={{
              padding: "18px 40px",
              background: theme.fg,
              color: theme.bg,
              fontFamily: mono,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            github.com/arko05roy/Icaruz
          </div>
        </div>
        <FadeInText
          text="runtime.badtheorylabs.com"
          font="mono"
          size={18}
          weight={400}
          delay={50}
          color={theme.muted}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
