'use client'

/**
 * The system has no spinner: nothing here loops for decoration, and loading
 * is a skeleton shaped like the thing that is coming.
 *
 * Inline, in a button or beside a field, there is no shape to skeleton — so
 * work in progress reads as the atom itself, a tick that pulses on the same
 * curve motion.css uses for a loading skeleton. It is the one looping mark
 * the system keeps, because it means "still going", and it stops the moment
 * the work does.
 *
 * Drops in wherever a spinner icon stood, so it takes and ignores the
 * className that used to size and spin one.
 */
export function Working({ className, label = 'Working' }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <i
        aria-hidden="true"
        className="bg-working"
        style={{
          width: 5,
          height: '1em',
          maxHeight: 14,
          borderRadius: 'var(--r-tick)',
          background: 'currentColor',
          display: 'block',
        }}
      />
    </span>
  )
}
