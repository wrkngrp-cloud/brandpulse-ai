'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

function IgIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.729-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function FbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

export interface ConnectionStatus {
  platform: string
  account_name: string | null
  sync_status: string
  last_synced_at: string | null
}

const PLATFORM_META = {
  instagram: { label: 'Instagram', Icon: IgIcon, colour: 'text-pink-600' },
  facebook: { label: 'Facebook', Icon: FbIcon, colour: 'text-blue-600' },
  twitter: { label: 'X (Twitter)', Icon: XIcon, colour: 'text-sky-500' },
} as const

export function SocialConnectCard({ connections }: { connections: ConnectionStatus[] }) {
  const platforms = ['instagram', 'facebook', 'twitter'] as const

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Social accounts</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Connect to pull posts and metrics</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {connections.filter(c => c.sync_status === 'active').length}/{platforms.length} connected
        </Badge>
      </div>

      <div className="space-y-2">
        {platforms.map(platform => {
          const meta = PLATFORM_META[platform]
          const conn = connections.find(c => c.platform === platform)

          return (
            <div key={platform}
              className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2.5">
                <meta.Icon className={`h-4 w-4 ${meta.colour}`} />
                <div>
                  <p className="text-sm font-medium">{meta.label}</p>
                  {conn && (
                    <p className="text-xs text-muted-foreground">
                      {conn.account_name}
                      {conn.last_synced_at && (
                        <> · synced {new Date(conn.last_synced_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {conn ? (
                  conn.sync_status === 'active' ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {conn.sync_status}
                    </span>
                  )
                ) : (
                  <a
                    href={`/api/social/connect/${platform}`}
                    className="inline-flex items-center justify-center h-7 px-2.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium transition-colors"
                  >
                    Connect
                  </a>
                )}
                {conn?.sync_status === 'error' && (
                  <a
                    href={`/api/social/connect/${platform}`}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
