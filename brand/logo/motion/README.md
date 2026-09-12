# BrandGauge logo, in motion

The logo building itself, 3.4 seconds, 1920×1080 at 30fps. Three beats:

1. **The crescendo runs.** Seven ticks light from the cold tail to the hot
   head, 90ms apart, each opening on its own centre.
2. **The needle sweeps and settles.** It winds back to the bottom of the scale
   and rises to the reading it is drawn at. It settles; it does not bounce.
3. **The wordmark unveils** through the same crescendo lying flat, nine
   apertures opening left to right.

Nothing in it is redrawn. The paths are read out of `../brandgauge-lockup-*.svg`
at render time and measured in the browser, and the needle's pivot is a circle
fitted to the seven measured tick centres. That fit returns radius 115.5 and
bearings −163.2° to −2.4°, which is `GEOM.radius` and `GEOM.sweep` in
`brand/engine.js` to the decimal. Change the lockup and this changes with it.

## The files

| File | Use it for |
| --- | --- |
| `brandgauge-logo-unveil.mp4` | Anything on Paper. Decks, web, social. |
| `brandgauge-logo-unveil-ink.mp4` | Anything on Ink. Same animation, ink artwork. |
| `brandgauge-logo-unveil-alpha.webm` | The web, over photography or a colour. VP9 with an alpha channel, so it carries no ground of its own. Safari 16+, Chrome, Firefox. |
| `brandgauge-logo-unveil-alpha.mov` | Premiere, After Effects, Final Cut, Resolve. ProRes 4444 with a real alpha channel. This is the one to hand a video editor. |

The two alpha cuts use the Paper artwork, which is the one drawn for light
grounds. Over a dark plane use the ink MP4, or re-render the alpha cut from
`LogoUnveilInk` (below) if you need ink artwork with transparency.

Do not re-time these by stretching them in an editor. The 90ms tick interval is
the same one the product lights a tick at, and a clip stretched to fit a slot
stops matching the app. Change the beat lengths in the source and render again.

## Re-rendering

From `video/`:

```
npx remotion render LogoUnveil       ../brand/logo/motion/brandgauge-logo-unveil.mp4
npx remotion render LogoUnveilInk    ../brand/logo/motion/brandgauge-logo-unveil-ink.mp4
npx remotion render LogoUnveilAlpha  ../brand/logo/motion/brandgauge-logo-unveil-alpha.mov \
  --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png
```

The WebM is transcoded from the ProRes, because Remotion's own WebM encode
drops the alpha channel:

```
ffmpeg -i brandgauge-logo-unveil-alpha.mov -an \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 -row-mt 1 \
  brandgauge-logo-unveil-alpha.webm
```

`ffprobe` reports that WebM as `yuv420p`. That is a reporting quirk: VP9 keeps
alpha in a second stream, and decoding a frame to RGBA gives 1,998,556
transparent pixels of 2,073,600. It is transparent.

Source: `video/src/LogoUnveil.tsx`. The same component opens the brand film.
