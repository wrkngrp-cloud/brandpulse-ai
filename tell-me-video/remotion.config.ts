import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setCodec('h264')
// The picture is flat illustration and gradients, which encode cleanly; 20 is
// visually transparent here and keeps a 4-minute 1080p master a sane size.
Config.setCrf(20)
Config.setConcurrency(4)

// Software GL: there is no GPU here, and the film leans on blur and blend modes.
Config.setChromiumOpenGlRenderer('swangle')

// Remotion's own Chrome download is blocked by the network policy, so use the
// Chromium that ships with this environment.
const CHROME =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
Config.setBrowserExecutable(CHROME)
