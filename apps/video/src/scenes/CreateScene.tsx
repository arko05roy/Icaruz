import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FadeInText } from "../components/AnimatedText";
import {
  ScreenshotFrame,
  splitSceneStyle,
  splitTextColumnStyle,
} from "../components/ScreenshotFrame";
import { theme } from "../theme";
import { mono } from "../fonts";

export const CreateScene: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <AbsoluteFill style={splitSceneStyle}>
      <ScreenshotFrame
        src="create.png"
        label="Create Brain"
        caption="Upload files or connect Obsidian · set wallet · earn per query"
      />
      <div style={splitTextColumnStyle}>
        <FadeInText text="Publish your vault" size={40} uppercase letterSpacing={3} />
        <FadeInText
          text="Drag markdown, PDF, or connect Obsidian. Set ~$0.01/query. Earn via x402."
          size={24}
          weight={500}
          delay={10}
          font="mono"
          style={{ lineHeight: 1.5 }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 8,
            fontFamily: mono,
            fontSize: 18,
            color: theme.muted,
          }}
        >
          <span>/ask — query with dual receipts</span>
          <span>/create — publish a brain</span>
          <span>/brains — browse the catalog</span>
          <span>MCP — query_brain_x402 for agents</span>
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
