'use client'

import { useState }   from 'react'
import { toast }      from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Link2, QrCode, ChevronDown, ChevronUp } from 'lucide-react'
import { Button }     from '@/components/ui/button'

interface OohVanityCardProps {
  vanityLink: string
  qrToken:    string | null
  totalVisits: number
  appUrl: string
}

export function OohVanityCard({ vanityLink, qrToken, totalVisits, appUrl }: OohVanityCardProps) {
  const [showQr, setShowQr] = useState(false)

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'))
  }

  const qrLink = qrToken ? `${appUrl}/go/${qrToken}` : null

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Attribution Link</h3>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {totalVisits.toLocaleString()} tracked visits
        </span>
      </div>

      <div className="rounded-lg bg-muted/50 border px-3 py-2.5 flex items-center justify-between gap-3">
        <p className="text-sm font-mono break-all flex-1">{vanityLink}</p>
        <Button
          type="button" variant="ghost" size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => copy(vanityLink)}
        >
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
        </Button>
      </div>

      {qrLink && (
        <div>
          <button
            onClick={() => setShowQr(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" />
            {showQr ? 'Hide QR code' : 'Show QR code'}
            {showQr ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showQr && (
            <div className="mt-3 flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg border">
                <QRCodeSVG value={qrLink} size={120} />
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Right-click the QR code to save as image.</p>
                <p className="font-mono break-all">{qrLink}</p>
                <Button
                  type="button" variant="outline" size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => copy(qrLink)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy QR link
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
