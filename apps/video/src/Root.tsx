import { Composition } from "remotion";
import { compositionConfig, IcaruzPromo } from "./IcaruzPromo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id={compositionConfig.id}
    component={IcaruzPromo}
    durationInFrames={compositionConfig.durationInFrames}
    fps={compositionConfig.fps}
    width={compositionConfig.width}
    height={compositionConfig.height}
  />
);
