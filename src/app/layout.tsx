import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { IconSprite } from '@/components/brand/icon-sprite'
import './globals.css'

export const metadata: Metadata = {
  title: 'BrandGauge',
  description: 'Brand intelligence for Nigerian and West African marketers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Nohemi and Disket Mono are self-hosted from /public/fonts.
            Preloaded so the first paint is never a substituted face. */}
        <link
          rel="preload"
          href="/fonts/Nohemi-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/DisketMono-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.css" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* brand/icons.svg, mounted once so <use href="#bg-gauge" /> resolves everywhere */}
        <IconSprite />
        <ThemeProvider
          attribute={['class', 'data-mode']}
          defaultTheme="light"
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
