import { Composition } from 'remotion'
import { Unveil, UNVEIL_DURATION, FPS } from './Unveil'
import { LogoUnveil, LOGO_UNVEIL_DURATION } from './LogoUnveil'
import './style.css'

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Unveil"
        component={Unveil}
        durationInFrames={UNVEIL_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* The logo animation on its own, so it can be dropped into a deck, a
          title card or an ad without re-rendering the film. One component,
          three grounds: the transparent cut is the one to reuse over
          photography or a coloured plane. */}
      <Composition
        id="LogoUnveil"
        component={LogoUnveil}
        defaultProps={{ ground: 'paper' as const }}
        durationInFrames={LOGO_UNVEIL_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="LogoUnveilInk"
        component={LogoUnveil}
        defaultProps={{ ground: 'ink' as const }}
        durationInFrames={LOGO_UNVEIL_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="LogoUnveilAlpha"
        component={LogoUnveil}
        defaultProps={{ ground: 'transparent' as const }}
        durationInFrames={LOGO_UNVEIL_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  )
}
