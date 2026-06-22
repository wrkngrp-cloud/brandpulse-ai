'use client'

import { NIGERIA_STATES } from '@/lib/nigeria-geo'

interface Props {
  state:          string
  lga:            string
  onStateChange:  (s: string) => void
  onLgaChange:    (l: string) => void
  required?:      boolean
}

export function NigeriaLocationSelect({ state, lga, onStateChange, onLgaChange, required }: Props) {
  const stateEntry = NIGERIA_STATES.find(s => s.state === state)
  const lgaOptions = stateEntry?.lgas ?? []

  function handleStateChange(newState: string) {
    onStateChange(newState)
    onLgaChange('')
  }

  return (
    <>
      <select
        value={state}
        onChange={e => handleStateChange(e.target.value)}
        required={required}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Select state…</option>
        {NIGERIA_STATES.map(s => (
          <option key={s.state} value={s.state}>{s.state}</option>
        ))}
      </select>

      <select
        value={lga}
        onChange={e => onLgaChange(e.target.value)}
        disabled={lgaOptions.length === 0}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <option value="">{state ? 'Select LGA…' : 'Select state first'}</option>
        {lgaOptions.map(l => (
          <option key={l} value={l}>{l}</option>
        ))}
        {state && <option value="Other">Other</option>}
      </select>
    </>
  )
}
