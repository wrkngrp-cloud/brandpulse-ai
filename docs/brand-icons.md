# The BrandGauge icon set

107 glyphs, supplied. The product uses nothing else: no icon library appears in
the dependency graph of any screen.

## Where the artwork lives

    brand/icons/currentcolor/   107 files, stroke="currentColor". For inlining.
    brand/icons/ink/            107 files, stroke #16120E. For design tools.
    brand/icons.svg             the sprite, built from currentcolor/.
                                Mounted once in the root layout, so
                                <use href="#bg-gauge"> resolves anywhere.

Every file: 24x24 viewBox, 20px live area, stroke 1.75, butt caps, miter
joins. Filled sub-paths carry their own fill and no stroke.

Do not edit the individual files by hand. The sprite is generated from them,
and `src/components/brand/icon-sprite.tsx` and `src/components/brand/icon.tsx`
are generated from the sprite.

## Using them

```tsx
import { GaugeIcon, PlusIcon, ChevronDownIcon } from '@/components/brand/icon'

<GaugeIcon className="h-4 w-4" />
<Icon name="bg-gauge" size={16} />
<Icon lucide="TrendingUp" />       // the name this icon had here before
```

`LUCIDE_TO_BRAND` in that module records what each of the 166 library icons
this product used to import became, so a call site can still name the glyph in
the old vocabulary.

Direction comes from turning the one glyph: the set draws a single chevron and
a single arrow, and `ChevronUpIcon`, `ChevronLeftIcon`, `ArrowLeftIcon` and the
rest are that same artwork rotated, never a second drawing of the same shape.

Icons are `--tx` or `--tx-3`. An icon is Flare only when it is the single hero
element of a card, and then it is a filled tick rather than a stroke.

## The set

- `bg-alert`
- `bg-arrow-updown`
- `bg-arrow`
- `bg-ask`
- `bg-book`
- `bg-bot`
- `bg-bottle`
- `bg-briefcase`
- `bg-calendar`
- `bg-camera`
- `bg-card`
- `bg-check`
- `bg-chevron`
- `bg-chevrons-updown`
- `bg-circle-dot`
- `bg-clipboard-list`
- `bg-clipboard`
- `bg-clock`
- `bg-code`
- `bg-connect`
- `bg-copy`
- `bg-creative`
- `bg-currency`
- `bg-database`
- `bg-edit`
- `bg-export`
- `bg-external-link`
- `bg-eye`
- `bg-field`
- `bg-file-search`
- `bg-file`
- `bg-film`
- `bg-filter`
- `bg-flag`
- `bg-flask`
- `bg-funnel`
- `bg-gauge`
- `bg-gift`
- `bg-git-branch`
- `bg-git-fork`
- `bg-globe`
- `bg-heart`
- `bg-help`
- `bg-history`
- `bg-image`
- `bg-info`
- `bg-key`
- `bg-layers`
- `bg-layout-grid`
- `bg-lightbulb`
- `bg-link`
- `bg-lock`
- `bg-logout`
- `bg-mail`
- `bg-map`
- `bg-market`
- `bg-mentions`
- `bg-menu`
- `bg-message-question`
- `bg-message-quote`
- `bg-minus`
- `bg-moon`
- `bg-more`
- `bg-mouse-pointer`
- `bg-music`
- `bg-ooh`
- `bg-panel`
- `bg-pause`
- `bg-phone`
- `bg-play`
- `bg-plus`
- `bg-printer`
- `bg-qr`
- `bg-refresh`
- `bg-saas`
- `bg-search-x`
- `bg-search`
- `bg-send`
- `bg-settings`
- `bg-share-nodes`
- `bg-share`
- `bg-shelf`
- `bg-shield-alert`
- `bg-shield-check`
- `bg-shield-x`
- `bg-shield`
- `bg-smartphone`
- `bg-star`
- `bg-sun`
- `bg-survey`
- `bg-tag`
- `bg-thumbs-down`
- `bg-thumbs-up`
- `bg-toggle`
- `bg-trash`
- `bg-trend-down`
- `bg-trend`
- `bg-triangle-alert`
- `bg-truck`
- `bg-unplug`
- `bg-users`
- `bg-venue`
- `bg-wand`
- `bg-wifi-off`
- `bg-wrench`
- `bg-x-circle`
- `bg-x`
