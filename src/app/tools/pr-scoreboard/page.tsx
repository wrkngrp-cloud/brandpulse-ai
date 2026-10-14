import { permanentRedirect } from 'next/navigation'

/**
 * The PR Scoreboard shipped at /scoreboard and external links point there, so
 * that stays the real route. This exists only so the directory's URL shape is
 * predictable: someone who guesses /tools/pr-scoreboard from the other four
 * lands in the right place rather than on a 404.
 */
export default function PrScoreboardAlias() {
  permanentRedirect('/scoreboard')
}
