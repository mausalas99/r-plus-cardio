# Cardio pulse cross — R+ Cardio icon

Cloned from the **shipping R+ `AppIcon.icns`** plus (not the outdated `single-glass-cross` SVG, which lacked the bottom arm).

## Geometry (1024 canvas)

R+ AppIcon plus scaled **×1.12** about `(512, 484)`:

| Part | x | y | w | h |
|------|---|---|---|---|
| Vertical stem | 440 | 250 | 144 | 468 |
| Horizontal bar | 278 | 412 | 468 | 144 |
| ECG | ~322–702 | ~880 | — | stroke 26 |

## Palette

- Field: `#e53935` → `#c62828`
- Plus: `#ffffff`
- ECG: white @ 55% (same role as R+ pale base lines)

## Regenerate

```bash
npm run render:cardio-icons
```
