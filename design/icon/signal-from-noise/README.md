# Signal from noise — icon layers

Flat SVG masters for **Liquid Glass / Icon Composer** (macOS 26+). The system applies glass, tint, and lighting — do not bake blur or specular highlights into these files.

**Concept:** irregular bars (SOME paste) above a bold clinical sparkline with two baseline ticks (lab trend / precision).

## Files

| File | Role |
|------|------|
| `layer-1-field.svg` | Accent gradient background (`#4a52e8` → `#3b42c9`) |
| `layer-2-noise.svg` | Three uneven white bars (chaos) |
| `layer-3-signal.svg` | Sparkline + two ticks (signal) |
| `preview.svg` | Default composite for review |
| `layer-1-field-neutral.svg` | Paper-gray field (Settings-style variant) |
| `layer-2-noise-muted.svg` | Muted bars for neutral variant |
| `layer-3-signal-accent.svg` | Accent sparkline for neutral variant |
| `preview-neutral.svg` | Neutral composite |
| `preview-small-32.svg` | Simplified 32px reference (2 bars, 2-point line) |

## Icon Composer import

1. Open **Icon Composer** (Xcode 26+).
2. Create a new `.icon` document at **1024×1024**.
3. Import layers bottom → top:
   - Field → Noise → Signal
4. Preview **Default**, **Dark**, **Clear**, and **Tinted** system renders.
5. Export `.icon` into the Xcode / Electron asset pipeline when wired.

## Electron / raster export (interim)

Until `.icon` is in the release pipeline:

```bash
# Example: composite PNG at 1024 (requires librsvg or Inkscape)
rsvg-convert -w 1024 -h 1024 preview.svg -o /tmp/rplus-icon-1024.png
```

Then generate `AppIcon.icns`, `build/icon.ico`, and `public/icons/*` from the PNG set.

## Small-size rules

| Size | Bars | Sparkline | Ticks |
|------|------|-----------|-------|
| 512+ | 3 | 3 points | 2 |
| 128 | 3 | 3 points | drop |
| 32 | 2 | 2 points | drop |
| 16 | 1 | 1 segment | drop |

See `preview-small-32.svg` for the 32px simplification.

## Tokens

From `public/tokens.css`:

- Accent: `#4a52e8`, deep: `#3b42c9`
- Muted ink: `#5c6778`
- Paper: `#eceef2`
