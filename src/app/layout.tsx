import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// Clash Grotesk (body) + Clash Display (headings/metrics) — loaded via fontshare CDN
// Geist Mono for code blocks only
const geistMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BrandPulse AI',
  description: 'Brand intelligence for Nigerian and West African marketers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Clash Grotesk + Clash Display — Indian Type Foundry via fontshare */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600,700&f[]=clash-display@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
