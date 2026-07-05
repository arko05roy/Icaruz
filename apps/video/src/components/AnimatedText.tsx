import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { display, mono } from "../fonts";
import { theme } from "../theme";

type FadeInTextProps = {
  text: string;
  size?: number;
  weight?: number;
  font?: "display" | "mono";
  color?: string;
  delay?: number;
  uppercase?: boolean;
  letterSpacing?: number;
  style?: React.CSSProperties;
};

export const FadeInText: React.FC<FadeInTextProps> = ({
  text,
  size = 64,
  weight = 700,
  font = "display",
  color = theme.fg,
  delay = 0,
  uppercase = false,
  letterSpacing = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(progress, [0, 1], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily: font === "display" ? display : mono,
        fontSize: size,
        fontWeight: weight,
        color,
        opacity,
        transform: `translateY(${translateY}px)`,
        textTransform: uppercase ? "uppercase" : undefined,
        letterSpacing,
        lineHeight: 1.1,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

type StaggerListProps = {
  items: string[];
  startDelay?: number;
  stagger?: number;
  size?: number;
};

export const StaggerList: React.FC<StaggerListProps> = ({
  items,
  startDelay = 15,
  stagger = 12,
  size = 36,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {items.map((item, i) => {
        const progress = spring({
          frame: frame - startDelay - i * stagger,
          fps,
          config: { damping: 200 },
        });
        const opacity = interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = interpolate(progress, [0, 1], [-30, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 20,
              opacity,
              transform: `translateX(${x}px)`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                marginTop: 14,
                background: theme.accent,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: mono,
                fontSize: size,
                color: theme.fg,
                lineHeight: 1.4,
              }}
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};
