# Tell Me — cover-art film

A 3:57 video built from the single's sleeve and the record, and nothing else.
Standalone Remotion project; it shares no code with the BrandGauge app.

**Tell Me** — Dwin, The Stoic x Ṣẹwà. Produced by Nuel Beatz.

## The idea

The camera opens on the whole square sleeve, dives into the painting for the
body of the record, and pulls back out to the sleeve at the end. While we are
inside, the lagoon actually moves: the water is rebuilt from horizontal slices
of the same image, each slid and skewed by a travelling wave, so the flamingo
legs and their reflections swim. Light, grade and camera all follow the
arrangement. Nothing is added that the illustrator did not paint.

## Setup

```
npm install
npm run analyze      # decode the mp3 -> src/audio-analysis.json
npm run dev          # Remotion Studio
npm run render       # full 3:57 render to out/tell-me.mp4
```

`npm run analyze` only needs re-running if the audio changes. Its output is
committed so a render never depends on decoding the track.

## How the film is timed

`scripts/analyze-audio.mjs` decodes the mp3 to PCM, runs an STFT, and derives:

- tempo and a beat grid (77.1 BPM on this track),
- per-frame low / mid / high band energy and an onset curve,
- a smoothed arrangement-energy curve.

It prints an energy map at 4-second resolution, which is what the camera
keyframes in `src/camera.ts` are cut against:

| Time | Section |
| --- | --- |
| 0:00–0:16 | intro, beat enters ~0:04 |
| 0:16–0:32 | first full section |
| 0:32–0:56 | verse, bass drops out |
| 0:56–1:44 | chorus |
| 1:44–2:08 | breakdown |
| 2:08–2:58 | climax, peak at 2:20 |
| 2:58–3:36 | airy outro, bass gone and highs up |
| 3:36–3:57 | tail |

Every camera landmark is snapped to the detected beat grid so moves land with
the track rather than near it.

## Layout

| Path | What |
| --- | --- |
| `src/art.ts` | the only place that describes this specific painting — panel bounds, waterline |
| `src/camera.ts` | the keyframed move, spline interpolation, and the clamp that keeps the border out of shot |
| `src/audio.ts` | typed read layer over the analysis |
| `src/layers/Water.tsx` | the lagoon, made to move |
| `src/layers/Atmosphere.tsx` | bloom, sun shafts, drifting motes |
| `src/layers/Grade.tsx` | colour grade, vignette, grain, top-and-tail fades |
| `scripts/make-grain.mjs` | generates `public/grain.png` |

If the sleeve is ever re-cropped, retune `src/art.ts` and nothing else changes.

## Rendering notes

This environment has no GPU and four cores, so the render is software-rasterised
and takes roughly two hours. Remotion's own Chrome download is blocked by the
network policy, so `remotion.config.ts` points at the Chromium that ships with
the image; override with `REMOTION_BROWSER_EXECUTABLE` elsewhere.

Layers can be switched off to time them individually:

```
npm run render -- --props='{"layers":{"water":false}}'
```

Measured cost per 60 frames: water 25s, atmosphere 14s, grade 13s, picture 6s.
Note that the `backdrop-filter` carrying the grade makes the render *faster*,
not slower — it flattens the stack underneath it for the blend layers above.
