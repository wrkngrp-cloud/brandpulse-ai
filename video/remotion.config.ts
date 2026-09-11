import path from 'path'

const repo = path.resolve(process.cwd(), '..')
import { Config } from '@remotion/cli/config'
import { enableTailwind } from '@remotion/tailwind-v4'

Config.overrideWebpackConfig((c) => {
  const withTailwind = enableTailwind(c)
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...withTailwind.resolve?.alias,
        // the film is the product: it renders the app's own scene components,
        // so it resolves the app's own module alias
        '@': path.join(repo, 'src'),
        '@brand': path.join(repo, 'brand'),
      },
    },
  }
})
Config.setVideoImageFormat('png')
Config.setOverwriteOutput(true)
