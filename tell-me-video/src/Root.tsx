import React from 'react'
import { Composition } from 'remotion'
import { FPS, TOTAL_FRAMES } from './audio'
import { TellMe, TellMeProps } from './TellMe'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TellMe"
    component={TellMe}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ layers: {} } as TellMeProps}
  />
)
