'use client'

import { useState } from 'react'
import { toast }    from 'sonner'
import { Copy, Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface FsoTeam {
  id:         string
  name:       string
  token:      string
  active:     boolean
  notes:      string | null
  created_at: string
}

export function FieldTeamsClient({ initialTeams }: { initialTeams: FsoTeam[] }) {
  const [teams, setTeams]     = useState<FsoTeam[]>(initialTeams)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName]       = useState('')
  const [notes, setNotes]     = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  async function createTeam() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/settings/field-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), notes: notes.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to create team')
      const { team } = await res.json() as { team: FsoTeam }
      setTeams(prev => [team, ...prev])
      setName('')
      setNotes('')
      setShowForm(false)
      toast.success('Field team created')
    } catch {
      toast.error('Could not create team')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(team: FsoTeam) {
    setToggling(team.id)
    try {
      const res = await fetch(`/api/settings/field-teams?id=${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !team.active }),
      })
      if (!res.ok) throw new Error()
      setTeams(prev => prev.map(t => t.id === team.id ? { ...t, active: !t.active } : t))
      toast.success(team.active ? 'Team deactivated' : 'Team activated')
    } catch {
      toast.error('Could not update team')
    } finally {
      setToggling(null)
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/fso/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))
  }

  function maskToken(token: string) {
    return token.slice(0, 8) + '...'
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      {showForm ? (
        <div className="border rounded-xl p-4 space-y-3 bg-card">
          <p className="text-sm font-semibold">New field team</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team name</label>
            <input
              type="text"
              placeholder="e.g. Lagos North FSOs"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Covers Ikeja, Oshodi, Mushin"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createTeam}
              disabled={creating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create team
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create team
        </button>
      )}

      {/* Teams list */}
      {teams.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No field teams yet. Create one to get a shareable link for your FSOs.</p>
        </div>
      )}

      {teams.map((team) => (
        <div key={team.id} className="border rounded-xl p-4 bg-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{team.name}</p>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${team.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  {team.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {team.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{team.notes}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                Created {new Date(team.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => toggleActive(team)}
              disabled={toggling === team.id}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title={team.active ? 'Deactivate' : 'Activate'}
            >
              {team.active
                ? <ToggleRight className="h-5 w-5 text-primary" />
                : <ToggleLeft className="h-5 w-5" />
              }
            </button>
          </div>

          <div className="flex items-center gap-3 pt-1 border-t border-border/50">
            <code className="text-xs text-muted-foreground font-mono">/fso/{maskToken(team.token)}</code>
            <button
              onClick={() => copyLink(team.token)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Share this link with your field officers. No login required.</p>
        </div>
      ))}
    </div>
  )
}
