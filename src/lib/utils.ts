import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Turns a raw lowercase/snake_case enum value ('in_progress', 'at_risk') into
// sentence case ('In progress', 'At risk') for display. Only touches the
// first character — doesn't force-lowercase the rest, so values with
// meaningful internal capitals (acronyms, brand names) survive untouched.
export function toSentenceCase(value: string | null | undefined): string {
  if (!value) return ''
  const cleaned = value.replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

// Social platform key ('instagram', 'tiktok') to display label ('Instagram',
// 'TikTok'). Brand names with internal capitals are special-cased since plain
// sentence-case would render them wrong ('Tiktok', 'Youtube').
export function formatPlatformLabel(platform: string | null | undefined): string {
  if (!platform) return ''
  if (platform === 'tiktok')  return 'TikTok'
  if (platform === 'youtube') return 'YouTube'
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export function formatNGN(amount: number): string {
  if (amount >= 1_000_000_000) {
    const v = amount / 1_000_000_000
    return `₦${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}bn`
  }
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000
    return `₦${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}m`
  }
  if (amount >= 1_000) {
    const v = amount / 1_000
    return `₦${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`
  }
  return `₦${amount}`
}
