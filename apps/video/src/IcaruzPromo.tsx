import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { Background } from './components/Background';
import { IntroScene } from './scenes/IntroScene';
import { ProblemScene } from './scenes/ProblemScene';
import { SolutionScene } from './scenes/SolutionScene';
import { HowItWorksScene } from './scenes/HowItWorksScene';
import { CacheScene } from './scenes/CacheScene';
import { EconomicsScene } from './scenes/EconomicsScene';
import { CreateScene } from './scenes/CreateScene';
import { OutroScene } from './scenes/OutroScene';
import { FPS, HEIGHT, WIDTH } from './theme';

/** 15-frame fades between scenes → total = sum(durations) - 6×15 = 1800 frames (60s) */
const TRANSITION = linearTiming({ durationInFrames: 15 });

export const SCENE_DURATIONS = {
  intro: 150,
  problem: 300,
  solution: 270,
  howItWorks: 270,
  cache: 270,
  economics: 240,
  create: 240,
  outro: 150,
} as const;

export const TOTAL_DURATION =
  Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0) -
  6 * TRANSITION.getDurationInFrames({ fps: FPS });

export const IcaruzPromo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries
      style={{
        translate: '2.1px 1.3px',
      }}
    >
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.intro}>
        <IntroScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.problem}>
        <ProblemScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.solution}>
        <SolutionScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.howItWorks}>
        <HowItWorksScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.cache}>
        <CacheScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.economics}>
        <EconomicsScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.create}>
        <CreateScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.outro}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export const compositionConfig = {
  id: 'IcaruzPromo',
  durationInFrames: TOTAL_DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;
