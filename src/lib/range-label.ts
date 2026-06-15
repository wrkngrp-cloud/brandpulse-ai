// Human-readable labels for date-range filters.
// Used by both server components and client components.

export function rangeLabelShort(days: number): string {
  if (days <= 7)   return '7-Day'
  if (days <= 30)  return '30-Day'
  if (days <= 84)  return '12-Week'
  return '6-Month'
}

export function rangeLabelLong(days: number): string {
  if (days <= 7)   return 'last 7 days'
  if (days <= 30)  return 'last 30 days'
  if (days <= 84)  return 'last 12 weeks'
  return 'last 6 months'
}
