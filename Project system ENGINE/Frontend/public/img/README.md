# Responder cutout

One transparent PNG holds all four responders as a single group.

| File | Canvas | Visible content | Stage placement @ 1001×949 |
|---|---|---|---|
| `responders.png` | 518×600 | x 5–514, y 153–521 | x 0–509, feet on y 718 |

The canvas carries built-in transparent padding — 5px left, 79px below the lowest foot — which
is why the slot is offset rather than flush. To nudge the group, edit the slot rule near the
bottom of `style.css`:

```css
.responder--group { left: …; width: …; height: …; }
```

and the shared baseline:

```css
.responder { bottom: …; }
```

Sizes are in `--u` units, where `1u` = 1px at a 1001px-wide viewport, so the whole
composition scales together with the page. Keep the slot at the image's natural 518×600
ratio; `object-fit: contain` then renders it 1:1 with no resampling.

## Anchor rules baked into the current values

- Group left edge → stage **x 0** (clear of the login card, which starts at x 516)
- Lowest foot (firefighter) → stage **y 718**, matching the other stage baseline

The figures are mid-stride, so their feet do **not** share one line in the source art:
doctor 509, police 511, rescue 515, fire 521. The slot anchors the lowest foot, which
leaves the other three slightly higher — intentional, and it matches the mockup.

## Swapping the art

Drop in any transparent PNG. If the new art has different padding, recompute:

- `left` = `0 − contentMinX`
- `bottom` = `949 − 718 − (canvasHeight − contentMaxY)`

If the file is missing the page renders a dashed placeholder box labelled with the
filename, so the layout never breaks.