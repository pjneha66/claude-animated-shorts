import { DepthProof } from './world/DepthProof.jsx';
import React from 'react';
import { Composition } from 'remotion';
import { ShortFilm } from './ShortFilm.jsx';
import plan from './generatedPlan.js';

export const StudioRoot = () => (
  <>
  <Composition id="DepthProof" component={DepthProof} durationInFrames={3} fps={30} width={480} height={320} />
  <Composition
    id="StudioShort"
    component={ShortFilm}
    durationInFrames={plan.meta.totalFrames}
    fps={plan.meta.fps}
    width={plan.meta.width}
    height={plan.meta.height}
    defaultProps={{ plan }}
  />
  </>
);
