import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FadeInText } from "../components/AnimatedText";
import { ReceiptCards } from "../components/Diagrams";
import { theme } from "../theme";

export const EconomicsScene: React.FC = () => (
  <AbsoluteFill>
    <Background accent />
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 120px",
        gap: 40,
      }}
    >
      <FadeInText
        text="Two layers of money"
        size={52}
        color={theme.accent}
        uppercase
        letterSpacing={4}
      />
      <FadeInText
        text="BTL makes reading cheap. x402 makes expertise payable."
        size={32}
        weight={500}
        delay={10}
      />
      <ReceiptCards />
    </AbsoluteFill>
  </AbsoluteFill>
);
