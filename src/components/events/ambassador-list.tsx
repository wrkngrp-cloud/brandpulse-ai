'use client'

import { useState } from 'react'
import { toast }    from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Copy, QrCode, Plus, Check } from 'lucide-react'
import { addAmbassador } from '@/app/dashboard/events/actions'

interface Ambassador {
  id:            string
  name:          string
  phone:         string | null
  session_token: string
}

interface Props {
  eventId:     string
  ambassadors: Ambassador[]
  appUrl:      string
}

export function AmbassadorList({ eventId, ambassadors, appUrl }: Props) {
  const [qrAmb,       setQrAmb      ] = useState<Ambassador | null>(null)
  const [copied,      setCopied     ] = useState<string | null>(null)
  const [addOpen,     setAddOpen    ] = useState(false)
  const [newName,     setNewName    ] = useState('')
  const [newPhone,    setNewPhone   ] = useState('')
  const [addPending,  setAddPending ] = useState(false)
  const [list,        setList       ] = useState<Ambassador[]>(ambassadors)

  function sessionUrl(token: string) {
    return `${appUrl}/ambassador/${token}`
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(sessionUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setAddPending(true)
    const result = await addAmbassador(eventId, newName.trim(), newPhone.trim() || undefined)
    setAddPending(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success('Ambassador added')
    setAddOpen(false)
    setNewName(''); setNewPhone('')
    // reload to get new token — simpler than passing it back
    window.location.reload()
  }

  const DEMO_AMBASSADORS = [
    { id: 'demo-1', name: 'Chiamaka Obi', role: 'Brand Ambassador', interactions: 45, leads: 12, conversions: 3, status: 'Active' as const },
    { id: 'demo-2', name: 'Seun Adeyemi', role: 'Brand Ambassador', interactions: 23, leads: 8, conversions: 2, status: 'On break' as const },
    { id: 'demo-3', name: 'Babatunde Lawal', role: 'Brand Ambassador', interactions: 67, leads: 19, conversions: 5, status: 'Active' as const },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{list.length} ambassador{list.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      {/* Demo mode when no real ambassadors */}
      {list.length === 0 && (
        <div className="space-y-3">
          <div className="border rounded-xl px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs">
            Demo data — add ambassadors using the + button above
          </div>
          {DEMO_AMBASSADORS.map(amb => (
            <div key={amb.id} className="border rounded-xl p-4 bg-card space-y-3 opacity-80">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{amb.name}</p>
                  <p className="text-xs text-muted-foreground">{amb.role}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  amb.status === 'Active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {amb.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 border-t">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Interactions</p>
                  <p className="text-sm font-semibold">{amb.interactions}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Leads</p>
                  <p className="text-sm font-semibold">{amb.leads}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Conversions</p>
                  <p className="text-sm font-semibold">{amb.conversions}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {list.map(amb => {
        const url = sessionUrl(amb.session_token)
        return (
          <div key={amb.id} className="border rounded-xl p-4 bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{amb.name}</p>
                {amb.phone && <p className="text-xs text-muted-foreground">{amb.phone}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(amb.session_token)}>
                  {copied === amb.session_token ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQrAmb(amb)}>
                  <QrCode className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono break-all">{url}</p>
          </div>
        )
      })}

      {/* QR dialog */}
      <Dialog open={Boolean(qrAmb)} onOpenChange={open => !open && setQrAmb(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>{qrAmb?.name} — session QR</DialogTitle>
          </DialogHeader>
          {qrAmb && (
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG value={sessionUrl(qrAmb.session_token)} size={200} />
              <p className="text-xs text-muted-foreground">Scan to open the ambassador app</p>
              <Button size="sm" variant="outline" onClick={() => copyLink(qrAmb.session_token)}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add ambassador dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add ambassador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-name">Full name *</Label>
              <Input id="new-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ambassador name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Phone</Label>
              <Input id="new-phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+234..." />
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={!newName.trim() || addPending}>
              {addPending ? 'Adding…' : 'Add ambassador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
