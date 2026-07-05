import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FadeInText } from "../components/AnimatedText";
import { FanOutDiagram } from "../components/Diagrams";
import { theme } from "../theme";

export const HowItWorksScene: React.FC = () => (
  <AbsoluteFill>
    <Background accent />
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 120px",
        gap: 40,
      }}
    >
      <FadeInText text="How it works" size={48} color={theme.accent} uppercase letterSpacing={4} />
      <FadeInText
        text="Ask once. Brains answer in parallel. Moderator synthesizes."
        font="mono"
        size={24}
        weight={400}
        delay={10}
        color={theme.muted}
      />
      <FanOutDiagram />
    </AbsoluteFill>
  </AbsoluteFill>
);
