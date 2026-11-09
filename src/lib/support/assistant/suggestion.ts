/**
 * How a suggest-mode draft is stored: an internal assistant note whose body
 * starts with the header, then the reply, then optionally the notes marker and
 * what the assistant would have done (handoff, tags, macro). The Desk's
 * "Use this" button takes only the reply part.
 */
export const SUGGESTION_HEADER = 'Suggested reply'
export const SUGGESTION_NOTES  = '[Assistant notes]'
