# The BrandGauge icon set

113 glyphs. The product uses nothing else: no icon library appears in
the dependency graph of any screen.

## Where the artwork lives

    brand/icons/currentcolor/   113 files, stroke="currentColor". For inlining.
    brand/icons/ink/            113 files, stroke #16120E. For design tools.
    brand/icons.svg             the sprite, built from currentcolor/.
                                Mounted once in the root layout, so
                                <use href="#bg-gauge"> resolves anywhere.

Every file: 24x24 viewBox, 20px live area, stroke 1.75, butt caps, miter
joins. Filled sub-paths carry their own fill and no stroke.

`brand/icons/currentcolor` is the artwork. Everything else is derived from it:

    npm run icons          redraw ink/, icons.svg and icon-sprite.tsx
    npm run icons:check    check only, writes nothing

Run the check before shipping. It fails when the product asks for an id nobody
drew, which is how three onboarding cards came to render a label with an empty
space above it: `bg-broadcast`, `bg-shop` and `bg-people` were referenced in
`industry-config.ts` and never existed. A `<use>` pointing at a missing symbol
draws nothing, silently, and reads as a spacing bug rather than a missing icon.

To add a glyph: draw it on the construction grid in section 7 of the design
system, save it into `brand/icons/currentcolor`, run `npm run icons`, then add
its name to the `BrandIconName` union and a `named()` export in
`src/components/brand/icon.tsx`.

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
- `bg-arrow`
- `bg-arrow-updown`
- `bg-ask`
- `bg-book`
- `bg-bot`
- `bg-bottle`
- `bg-briefcase`
- `bg-building`
- `bg-calendar`
- `bg-camera`
- `bg-card`
- `bg-check`
- `bg-chevron`
- `bg-chevrons-updown`
- `bg-circle-dot`
- `bg-clipboard`
- `bg-clipboard-list`
- `bg-clock`
- `bg-code`
- `bg-connect`
- `bg-copy`
- `bg-creative`
- `bg-currency`
- `bg-database`
- `bg-draft`
- `bg-edit`
- `bg-export`
- `bg-external-link`
- `bg-eye`
- `bg-field`
- `bg-file`
- `bg-file-search`
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
- `bg-hanger`
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
- `bg-mast`
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
- `bg-pill`
- `bg-play`
- `bg-plus`
- `bg-pre-post`
- `bg-printer`
- `bg-qr`
- `bg-refresh`
- `bg-saas`
- `bg-search`
- `bg-search-x`
- `bg-send`
- `bg-settings`
- `bg-share`
- `bg-share-nodes`
- `bg-shelf`
- `bg-shield`
- `bg-shield-alert`
- `bg-shield-check`
- `bg-shield-x`
- `bg-smartphone`
- `bg-star`
- `bg-sun`
- `bg-survey`
- `bg-tag`
- `bg-thumbs-down`
- `bg-thumbs-up`
- `bg-toggle`
- `bg-trash`
- `bg-trend`
- `bg-trend-down`
- `bg-triangle-alert`
- `bg-truck`
- `bg-unplug`
- `bg-users`
- `bg-venue`
- `bg-wand`
- `bg-wifi-off`
- `bg-wrench`
- `bg-x`
- `bg-x-circle`
