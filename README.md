# Lullbrook — a quiet library of ambient sounds

Lullbrook is a small, fast web app for layering ambient sounds — rain on a tent,
distant thunder, a crackling fire — into a mix you can leave running for hours
while you sleep or work. 65 sounds across 12 categories, no accounts, no build
step, works offline as a PWA.

## Run it

Any static file server pointed at this folder works. Two easy options:

```powershell
# Windows (no dependencies)
powershell -ExecutionPolicy Bypass -File server.ps1 -Port 4173
```

```sh
# with Python or Node available
python -m http.server 4173      # or: npx serve -l 4173
```

Then open <http://localhost:4173>. A server is required (not `file://`)
because the app uses ES modules, `fetch` for audio, and a service worker.

## Using it

- **Tap a card** to add that sound to the mix; tap again to remove it.
  Active cards reveal their own volume slider.
- **Bottom dock**: master play/pause (also **Spacebar**), master volume,
  sleep timer (15m / 30m / 1h / ∞ — the last 45 seconds fade out gently),
  presets, and clear-all.
- **Presets**: three built-ins (Sleep, Focus, Cabin Night) plus your own —
  set up a mix, open Presets, name it, Save. Stored in `localStorage`.
- Your last mix and every per-sound volume you set are remembered between
  visits.
- Install it from the browser menu (PWA). The app shell works offline
  immediately; each sound becomes available offline after the first time
  you play it.

## How it works

Plain HTML/CSS/JS with ES modules — no framework, no bundler. The whole app
is ~1200 lines across four modules:

| file | role |
|---|---|
| `js/data.js` | sound catalog + categories + built-in presets |
| `js/icons.js` | hand-drawn SVG line icons (one per sound) |
| `js/audio.js` | Web Audio engine |
| `js/app.js` | UI, state, presets, timer, viz |

**Seamless loops.** Sounds play as `AudioBufferSourceNode`s with `loop = true`
(sample-accurate, unlike `<audio loop>`). On decode, the last ~1.2 s of every
buffer is crossfaded into its first ~1.2 s with equal-power curves
(`audio.js → makeSeamless`), so even files that weren't cut perfectly loop
without a click or gap. Each sound also starts at a random phase so re-layered
mixes never sound identical.

**Lazy loading.** Nothing is fetched until you first turn a sound on; the
card pulses while it decodes. Toggles ramp gain over 350 ms so nothing pops.

## Add a new sound

1. Drop a well-licensed (CC0 / royalty-free) audio file into
   `sounds/<category>/your-sound.mp3`. Loops don't need to be perfect —
   the engine crossfades the seam — but a clean recording without a hard
   attack at the start works best.
2. Register it in `js/data.js`: `S('your-sound', 'Display Name', 'category')`.
3. Optionally draw it an icon in `js/icons.js` (24×24, stroke only) and use
   its key as the fourth argument of `S`; otherwise a default icon is used.
4. Record its source and license in `ATTRIBUTIONS.md`.

To add a category, add an entry to `CATEGORIES` in `js/data.js` and create the
folder under `sounds/`.

## Sounds & licenses

All 65 recordings come from [Moodist](https://github.com/remvze/moodist)
(MIT), which sources them from Pixabay (Pixabay Content License) and CC0
libraries. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) and
[LICENSE-MOODIST.txt](LICENSE-MOODIST.txt). The display typeface is
[Fraunces](https://github.com/undercasetype/Fraunces) (SIL OFL 1.1),
self-hosted.
