import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FadeInText } from "../components/AnimatedText";
import { PrefixStableBlock } from "../components/Diagrams";
import {
  ScreenshotFrame,
  splitSceneStyle,
  splitTextColumnStyle,
} from "../components/ScreenshotFrame";
import { theme } from "../theme";

export const CacheScene: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <AbsoluteFill style={splitSceneStyle}>
      <div style={splitTextColumnStyle}>
        <FadeInText
          text="Prefix-stable RAG"
          size={40}
          color={theme.accent}
          uppercase
          letterSpacing={3}
        />
        <FadeInText
          text="Heavy context stays fixed. Only your question changes."
          size={28}
          weight={500}
          delay={8}
          style={{ lineHeight: 1.35 }}
        />
        <PrefixStableBlock />
        <FadeInText
          text="Ask the same topic twice — watch cache hits climb."
          font="mono"
          size={18}
          weight={400}
          delay={40}
          color={theme.muted}
        />
      </div>
      <ScreenshotFrame
        src="ask-detail.png"
        label="Ask Page"
        caption="btlEconomics receipt on every query"
      />
    </AbsoluteFill>
  </AbsoluteFill>
);
