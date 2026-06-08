# README capture — optional hero GIF

The README ships with real device **stills** (see `docs/screenshots/`). This doc is only for the
optional step of turning the existing screen recording into a motion **hero GIF**.

Source recording: `~/Desktop/amatta_screen_shots/ScreenRecording_06-08-2026 16-02-37_1.MP4`.

## 1. Install tooling (not currently installed)

```bash
brew install ffmpeg gifsicle
```

## 2. Pick a segment + convert (two-pass palette = best quality, small size)

```bash
SRC=~/Desktop/amatta_screen_shots/"ScreenRecording_06-08-2026 16-02-37_1.MP4"
OUT=docs/screenshots/01-daily-grid.gif

# trim to a clean ~5s window showing the daily grid + a day-swipe (adjust -ss start / -t length)
ffmpeg -ss 00:00:02 -t 5 -i "$SRC" \
  -vf "fps=14,scale=360:-1:flags=lanczos,palettegen=stats_mode=diff" -y /tmp/pal.png
ffmpeg -ss 00:00:02 -t 5 -i "$SRC" -i /tmp/pal.png \
  -lavfi "fps=14,scale=360:-1:flags=lanczos,paletteuse=dither=bayer:bayer_scale=3" -y "$OUT"

gifsicle -O3 --lossy=80 "$OUT" -o "$OUT"
ls -lh "$OUT"      # confirm ≤ 2 MB
```

## 3. Wire into the README

In `README.md`, change the hero image from
`docs/screenshots/01-daily-grid.png` → `docs/screenshots/01-daily-grid.gif`.

## Budget / rules
- GIF ≤ 2 MB, 320–400px wide, 12–15 fps, ≤ 6 s. Git keeps blobs forever — stay under budget.
- Keep alt text descriptive.
