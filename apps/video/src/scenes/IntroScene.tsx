import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { FadeInText } from "../components/AnimatedText";
import { theme } from "../theme";
import { mono } from "../fonts";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shotIn = spring({
    frame: frame - 20,
    fps,
    config: { damping: 200 },
  });
  const shotOpacity = interpolate(shotIn, [0, 1], [0, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background accent />
      <AbsoluteFill style={{ opacity: shotOpacity }}>
        <Img
          src={staticFile("screenshots/landing.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${theme.bg}ee 0%, ${theme.bg}cc 45%, ${theme.bg}f5 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "0 120px",
        }}
      >
        <FadeInText text="ICARUZ" size={108} delay={0} letterSpacing={12} uppercase />
        <FadeInText
          text="Your question deserves a room full of experts,"
          size={52}
          weight={700}
          delay={12}
          style={{ textAlign: "center", maxWidth: 1200, lineHeight: 1.15 }}
        />
        <FadeInText
          text="not a copy-paste bill."
          size={52}
          weight={700}
          delay={24}
          color={theme.accent}
          style={{ textAlign: "center", maxWidth: 1200, lineHeight: 1.15 }}
        />
        <FadeInText
          text="Pay once for context — pay the people who wrote it."
          font="mono"
          size={26}
          weight={400}
          delay={42}
          color={theme.muted}
          style={{ textAlign: "center", maxWidth: 900, marginTop: 16 }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 120,
          fontFamily: mono,
          fontSize: 14,
          color: theme.muted,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        Compiled human expertise for agents
      </div>
    </AbsoluteFill>
  );
};
