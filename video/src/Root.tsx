import { Composition } from 'remotion'
import { Unveil, UNVEIL_DURATION, FPS } from './Unveil'
import './style.css'

export function RemotionRoot() {
  return (
    <Composition
      id="Unveil"
      component={Unveil}
      durationInFrames={UNVEIL_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  )
}
