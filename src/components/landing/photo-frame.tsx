import Image from 'next/image'

/**
 * A photography slot on the marketing pages.
 *
 * The page is about reading the street, and until now there was no street on
 * it. These frames are where the photography goes. Each one is sized and
 * positioned already, so adding a picture is dropping a file into
 * `public/landing/photos/` and filling in one `src` below — no layout work.
 *
 * Until a slot has a file it draws the tick field instead: the mark's own
 * material, hairlined, with the shot named in a label. That reads as a
 * deliberate panel rather than a broken image, so the page is safe to ship
 * half-filled.
 */

export interface Photo {
  /** Path under /public once the file is added, else null for the placeholder. */
  src: string | null
  /** Two or three words naming the slot. Shown on the placeholder. */
  slot: string
  /** What the shot should be. Doubles as the alt text and the brief. */
  brief: string
  /** Photographer and source, shown small under the frame. Unsplash and Pexels
   *  do not require attribution, but crediting is the decent thing to do. */
  credit?: string
}

/**
 * The shots this page wants, in the order they appear.
 *
 * Keep the briefs specific. "Lagos" is not a brief; "danfo buses in Oshodi
 * traffic at dusk, shot wide" is.
 */
export const HERO_PHOTOS: Record<string, Photo> = {
  street: {
    src: '/landing/photos/lagos-market-crowd.jpg',
    slot: 'The street',
    brief: 'A Lagos market street at rush hour — danfo buses, traders, umbrellas, the crowd the brand is being judged by.',
  },
  aerial: {
    src: '/landing/photos/lagos-market-aerial.jpg',
    slot: 'The market',
    brief: 'A Lagos market from above: stalls, umbrellas and traffic threading between them.',
  },
  billboard: {
    src: '/landing/photos/expressway-billboard.jpg',
    slot: 'The billboard',
    brief: 'A large-format billboard over a Lagos expressway, shot from the bridge.',
  },
  highway: {
    src: '/landing/photos/highway-billboard.jpg',
    slot: 'The expressway',
    brief: 'An expressway billboard against the city skyline.',
  },
  roundabout: {
    src: '/landing/photos/roundabout-billboard.jpg',
    slot: 'The junction',
    brief: 'A roundabout billboard at a busy junction, shot from the air.',
  },
}

export function PhotoFrame({
  photo, className = '', ratio = '4 / 5', priority = false, sizes = '(max-width: 768px) 100vw, 40vw',
}: {
  photo: Photo
  className?: string
  /** CSS aspect-ratio for the frame. The photo is cropped to fill it. */
  ratio?: string
  priority?: boolean
  sizes?: string
}) {
  return (
    <figure className={className}>
      <div
        className="relative w-full overflow-hidden rounded-sm border border-line"
        style={{ aspectRatio: ratio }}
      >
        {photo.src ? (
          <Image
            src={photo.src}
            alt={photo.brief}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-end p-4"
            style={{
              background: 'var(--bg-shell)',
              backgroundImage: 'radial-gradient(var(--tick-1) 1.2px, transparent 1.2px)',
              backgroundSize: '22px 22px',
            }}
          >
            <span className="max-w-[34ch]">
              <span className="bg-label block" style={{ color: 'var(--tx-3)' }}>{photo.slot}</span>
              <span className="mt-1 block text-[11px] leading-snug" style={{ color: 'var(--tx-3)' }}>
                {photo.brief}
              </span>
            </span>
          </div>
        )}
      </div>
      {photo.src && photo.credit && (
        <figcaption className="mt-1.5 text-[10px]" style={{ color: 'var(--lp-mut)' }}>
          {photo.credit}
        </figcaption>
      )}
    </figure>
  )
}
