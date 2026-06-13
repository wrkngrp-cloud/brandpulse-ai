import type { Metadata } from 'next'
import { Manrope, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const manrope  = Manrope({ variable: '--font-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BrandPulse AI',
  description: 'Brand intelligence for Nigerian and West African marketers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  )
}
