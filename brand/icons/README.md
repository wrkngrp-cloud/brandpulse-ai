# BrandGauge icons — individual SVGs

107 files, twice.

  ink/            stroke #16120E. For Figma, Illustrator, Claude Design, decks.
                  Recolour by swapping the stroke value.
  currentcolor/   stroke="currentColor". For inlining in code, where the icon
                  should inherit --tx, --tx-3 or --flare from its parent.

Every file: 24x24 viewBox, 20px live area, stroke 1.75, butt caps, miter joins.
Filled sub-paths (dots, tick fills) carry their own fill and no stroke.

In the app, prefer brand/icons.svg (the sprite) plus <Icon lucide="X" />. These
individual files are for design tools, which cannot use <use href>.

Do not edit these directly. The sprite is the source; regenerate from it.
