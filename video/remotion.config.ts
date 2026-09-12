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
/* The film serves the app's own public folder rather than a second copy of
   the logo, the fonts and the maps. The duplicate under video/public had
   already started to drift, and the photography the film now uses lives with
   the site. One folder, one source of truth. */
Config.setPublicDir(path.join(repo, 'public'))
Config.setVideoImageFormat('png')
Config.setOverwriteOutput(true)
