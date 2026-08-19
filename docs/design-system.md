# Design System — Nuestra Medicina Personal

Source of truth for the visual language used across the frontend. This
document tracks what's actually implemented in
`frontend/src/design-system/tokens.css`; it is **not** a spec written
ahead of the code — it grows one page at a time, as each mockup gets
implemented. See [`frontend-plan.md`](frontend-plan.md) for what's built.

Background: [`architecture.md` §1.2](architecture.md) sets the art
direction (warm, contemplative, editorial — sunrise/sky blues, cream,
sand, soft gold; never clinical/SaaS-generic) and §31 asks for
centralized tokens instead of scattered hardcoded values. This is that
system.

## Why OKLCH

The mockups (Claude Design handoff, `*.dc.html`) specify every color in
`oklch()`. We kept that instead of converting to hex: OKLCH is
perceptually uniform (lightness actually looks like lightness across
hues), which is why the mockup can express "same lightness, warmer hue"
relationships cleanly. Keep new colors in `oklch()` for consistency —
don't mix in hex/rgb.

## Token categories

All tokens live in `frontend/src/design-system/tokens.css` as CSS custom
properties on `:root`. Never hardcode a raw `oklch(...)` value in a
component's CSS Module — add or reuse a token instead.

### Implemented so far (public site, light theme)

Extracted from `Login.dc.html`, confirmed reused verbatim in the other
public-store mockups:

| Token | Value | Use |
|---|---|---|
| `--color-bg-gradient-start/mid/end` | `oklch(98% 0.015 75)` / `oklch(96% 0.022 82)` / `oklch(97% 0.018 78)` | Page background wash (cream → warm sand) |
| `--color-ink` | `oklch(24% 0.03 255)` | Primary text |
| `--color-ink-muted` | `oklch(46% 0.025 255)` | Secondary text |
| `--color-ink-subtle` | `oklch(58% 0.02 255)` | Tertiary/legal text |
| `--color-accent-gold` | `oklch(64% 0.1 38)` | Eyebrow labels, small accents |
| `--color-accent-amber` | `oklch(74% 0.12 55)` | Gradient bar, glows |
| `--color-accent-amber-soft` | `oklch(82% 0.11 55)` | Background glow |
| `--color-accent-amber-light` / `-deep` | `oklch(88% 0.1 55)` / `oklch(62% 0.12 40)` | Brand mark radial gradient |
| `--color-deep-blue` | `oklch(32% 0.07 254)` | Links, primary CTA accents, brand blue |
| `--color-surface` | `oklch(99% 0.006 80)` | Card/panel background |
| `--color-surface-border` / `-strong` | `oklch(88% 0.02 75)` / `oklch(80% 0.02 75)` | Card and input borders |
| `--color-surface-hover` | `oklch(96% 0.01 75)` | Hover background for bordered buttons |
| `--font-serif` | `'Newsreader'` | Headings — editorial serif |
| `--font-sans` | `'Public Sans'` | Body/UI text |
| `--radius-sm` / `--radius-md` | `6px` / `10px` | Buttons/inputs vs. cards |
| `--shadow-card` | `0 24px 48px oklch(24% 0.03 255 / 0.08)` | Elevated cards |
| `--space-section-x` | `clamp(20px, 5vw, 64px)` | Horizontal page padding |

### Known but not yet formalized

A broader survey of the mockup bundle (`grep -o 'oklch([^)]*)'` across all
`*.dc.html` files) shows additional color families that recur across
specific page groups but haven't been touched by implemented pages yet.
Don't guess their exact values ahead of need — pull them from the actual
mockup file when you implement the page that uses them, and add them to
`tokens.css` + this table at that point:

- **Sky blue** (hue ~230–240, e.g. `oklch(90% 0.035 230)`) — shows up
  repeatedly outside the Login page; likely a secondary accent for
  catalog/book pages.
- **Warm neutral gray** (hue ~90, e.g. `oklch(88% 0.01 90)` through
  `oklch(30% 0.02 90)`) — a full gray ramp, likely the admin backoffice's
  UI chrome (tables, borders, muted admin text) rather than the public
  site's blue-tinted ink scale.
- **Deep near-black blue** (hue ~254–258, e.g. `oklch(15% 0.04 258)`) —
  likely an admin dark-surface (sidebar?) background.
- **Green** (hue ~145, e.g. `oklch(35% 0.1 145)`) — likely a
  success/positive-state color (paid order, published status).

When one of these gets formalized, name it by *role* (e.g.
`--color-admin-sidebar-bg`), not by hue, unless it's a generic accent
reused across unrelated contexts.

## Typography

- **Newsreader** (serif, weights 400/500/600, italic 400/500) — headings,
  editorial moments (quotes, eyebrow labels on some pages).
- **Public Sans** (sans, weights 400/500/600/700) — everything else.
- Loaded via Google Fonts `<link>` in `index.html` with `preconnect`, not
  `@import` in CSS (avoids a render-blocking round trip).

## Component conventions

- One folder per component: `ComponentName/ComponentName.tsx` +
  `ComponentName.module.css`. No global class soup, no styled-components.
- Pages under `src/public-store/pages/<PageName>/` or
  `src/admin/pages/<PageName>/`; reusable pieces under
  `src/shared/components/`.
- Decorative elements (brand mark, gradient glows, icon squares that
  duplicate visible text) get `aria-hidden="true"`.
- Interactive elements get a visible focus ring (`global.css` sets this
  once for `a`/`button` — don't suppress it per-component).
- Translate the mockup's inline `style="..."` attributes into the
  component's CSS Module using tokens; don't carry inline styles into
  React code except for genuinely per-instance dynamic values.
- The mockup's own runtime scaffolding (`x-dc`, `dc-import`, `support.js`,
  `sc-*` classes) is Claude Design's canvas tooling — it is **not** part
  of the design and must not be copied into app code.

## Responsive rules

Mockups use `clamp()` for fluid spacing/type instead of discrete
breakpoints in most places — keep that pattern where the source does.
Where a mockup defines an explicit breakpoint behavior (e.g. N columns →
1 column on mobile), preserve it with a plain `@media` query in the CSS
Module; don't introduce a breakpoint system/library for this project's
scope (architecture.md §62 wants *predictable*, not *configurable*,
responsive behavior).

## Accessibility baseline

Per architecture.md §61: semantic HTML first, visible focus, `alt` text
on every meaningful image, labels on every input, ARIA only when
semantic HTML can't express the relationship. Every page implemented so
far uses `<header>` / `<main>` / `<footer>` landmarks and a real `<h1>`.
