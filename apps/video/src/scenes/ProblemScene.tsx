import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FadeInText, StaggerList } from "../components/AnimatedText";
import { theme } from "../theme";

export const ProblemScene: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 120px",
        gap: 36,
      }}
    >
      <FadeInText text="The problem" size={56} color={theme.accent} uppercase letterSpacing={4} />
      <StaggerList
        startDelay={14}
        stagger={18}
        size={28}
        items={[
          "You did the work. Years in Obsidian. Whitepapers you read. Notes nobody else has. The internet treats it like free copy-paste.",
          "Agents charge you twice. One question, five specialists, your whole vault in every call. Same context. Billed again and again.",
          "The curator gets $0. Your notes power the answer. Their brain does the thinking. The model takes the credit — and the receipt.",
        ]}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);
