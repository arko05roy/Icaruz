import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { mono } from "../fonts";
import { theme } from "../theme";

const BRAINS = [
  { id: "yudhi", label: "Security", color: "#EA580C" },
  { id: "karpathy", label: "Frameworks", color: "#0A0A0A" },
  { id: "0g-expert", label: "Research", color: "#666666" },
];

export const FanOutDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const questionIn = spring({ frame, fps, config: { damping: 200 } });
  const fanOut = spring({
    frame: frame - 0.6 * fps,
    fps,
    config: { damping: 200 },
  });
  const synthIn = spring({
    frame: frame - 1.4 * fps,
    fps,
    config: { damping: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        width: "100%",
      }}
    >
      <Box
        label="Your question"
        sub="Ask once at /ask"
        opacity={questionIn}
        accent
        width={320}
      />

      <div style={{ display: "flex", gap: 48, alignItems: "center" }}>
        {BRAINS.map((brain, i) => {
          const delay = i * 6;
          const p = spring({
            frame: frame - 0.6 * fps - delay,
            fps,
            config: { damping: 200 },
          });
          const y = interpolate(p, [0, 1], [40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={brain.id}
              style={{
                opacity: fanOut * p,
                transform: `translateY(${y}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 140,
                  height: 100,
                  border: `2px solid ${brain.color}`,
                  background: theme.panel,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: mono,
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {brain.label}
              </div>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  color: theme.muted,
                }}
              >
                {brain.id}
              </span>
            </div>
          );
        })}
      </div>

      <Arrow opacity={fanOut} />

      <Box
        label="One synthesized answer"
        sub="Plus cost receipts"
        opacity={synthIn}
        width={400}
      />
    </div>
  );
};

const Box: React.FC<{
  label: string;
  sub: string;
  opacity: number;
  accent?: boolean;
  width: number;
}> = ({ label, sub, opacity, accent, width }) => (
  <div
    style={{
      opacity,
      width,
      padding: "20px 28px",
      border: `2px solid ${accent ? theme.accent : theme.fg}`,
      background: accent ? theme.accent : theme.fg,
      color: accent ? "#fff" : theme.bg,
      textAlign: "center",
    }}
  >
    <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700 }}>{label}</div>
    <div
      style={{
        fontFamily: mono,
        fontSize: 14,
        marginTop: 6,
        opacity: 0.8,
      }}
    >
      {sub}
    </div>
  </div>
);

const Arrow: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      opacity,
      fontFamily: mono,
      fontSize: 28,
      color: theme.accent,
    }}
  >
    ↓
  </div>
);

export const PrefixStableBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const blocks = [
    { label: "SYSTEM", text: "Specialty + instructions", stable: true },
    { label: "CONTEXT", text: "Compiled wiki articles", stable: true, highlight: true },
    { label: "USER", text: "Your question only", stable: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {blocks.map((block, i) => {
        const p = spring({
          frame: frame - i * 10,
          fps,
          config: { damping: 200 },
        });

        return (
          <div
            key={block.label}
            style={{
              opacity: p,
              display: "flex",
              border: `1px solid ${block.highlight ? theme.accent : theme.border}`,
              background: block.highlight ? "#FFF5EE" : theme.panel,
            }}
          >
            <div
              style={{
                width: 140,
                padding: "16px 20px",
                fontFamily: mono,
                fontSize: 16,
                fontWeight: 700,
                borderRight: `1px solid ${theme.border}`,
                color: block.stable ? theme.accent : theme.muted,
              }}
            >
              {block.label}
              {block.stable && (
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 400 }}>
                  cached
                </div>
              )}
            </div>
            <div
              style={{
                flex: 1,
                padding: "16px 24px",
                fontFamily: mono,
                fontSize: 20,
                color: theme.fg,
              }}
            >
              {block.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ReceiptCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cards = [
    {
      title: "btlEconomics",
      subtitle: "Inference savings",
      lines: ["cacheHits: 2", "totalSaved: $0.000016", "prefix cache tier"],
      delay: 0,
    },
    {
      title: "creatorEconomics",
      subtitle: "Expert payouts",
      lines: ["wallet: 0x…", "priceUsd: $0.01", "x402 on /api/brain"],
      delay: 15,
    },
  ];

  return (
    <div style={{ display: "flex", gap: 32, width: "100%" }}>
      {cards.map((card) => {
        const p = spring({
          frame: frame - card.delay,
          fps,
          config: { damping: 200 },
        });
        const y = interpolate(p, [0, 1], [30, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={card.title}
            style={{
              flex: 1,
              opacity: p,
              transform: `translateY(${y}px)`,
              border: `1px solid ${theme.fg}`,
              background: theme.panel,
              padding: 28,
            }}
          >
            <div
              style={{
                fontFamily: mono,
                fontSize: 14,
                color: theme.accent,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              {card.subtitle}
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 26,
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              {card.title}
            </div>
            {card.lines.map((line) => (
              <div
                key={line}
                style={{
                  fontFamily: mono,
                  fontSize: 18,
                  color: theme.muted,
                  marginBottom: 8,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
