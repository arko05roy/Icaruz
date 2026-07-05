import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FadeInText, StaggerList } from "../components/AnimatedText";
import {
  ScreenshotFrame,
  splitSceneStyle,
  splitTextColumnStyle,
} from "../components/ScreenshotFrame";
import { theme } from "../theme";

export const SolutionScene: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <AbsoluteFill style={splitSceneStyle}>
      <div style={splitTextColumnStyle}>
        <FadeInText text="The fix" size={48} color={theme.accent} uppercase letterSpacing={4} />
        <FadeInText
          text="Specialist brains. One mixture. Two receipts."
          size={34}
          weight={500}
          delay={8}
          style={{ lineHeight: 1.3 }}
        />
        <StaggerList
          startDelay={18}
          stagger={10}
          size={26}
          items={[
            "Brains — curated article graphs from Obsidian, PDF, Word",
            "Mixture — route, fan-out in parallel, synthesize one answer",
            "Prefix-stable RAG — BTL caches the wiki, not your question",
          ]}
        />
      </div>
      <ScreenshotFrame
        src="brains.png"
        label="Brains Catalog"
        caption="Security · Frameworks · Research · Your vault"
      />
    </AbsoluteFill>
  </AbsoluteFill>
);
