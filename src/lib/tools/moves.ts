/**
 * The move vocabulary, in a file a client component can import.
 *
 * The engine in competitor-tracker.ts reaches dns and net through
 * fetch-public, and competitor-watch.ts reaches the service client, so neither
 * can be imported from a browser bundle. The labels and the watch ceiling are
 * needed on both sides of that line, so they live here and the server modules
 * re-export them.
 */

export type MoveCategory =
  | 'product_launch' | 'product_change' | 'pricing'
  | 'partnership' | 'expansion' | 'positioning' | 'company'

export const MOVE_LABEL: Record<MoveCategory, string> = {
  product_launch: 'Product launch',
  product_change: 'Product change',
  pricing:        'Pricing or offer',
  partnership:    'Partnership',
  expansion:      'Geographic expansion',
  positioning:    'Positioning change',
  company:        'Company development',
}

export type MoveSourceKind = 'press' | 'announcement' | 'site_page' | 'site_change'

export const MOVE_SOURCE_LABEL: Record<MoveSourceKind, string> = {
  press:        'Press',
  announcement: 'Their announcement',
  site_page:    'Their website',
  site_change:  'Detected website change',
}

/** What a beta workspace may watch. Not a paywall — a cost ceiling on a free
 *  beta, stated plainly in the UI when it is reached. */
export const WATCH_LIMIT = 5
