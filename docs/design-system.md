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

Added while implementing `Inicio.dc.html` (Home):

| Token | Value | Use |
|---|---|---|
| `--color-placeholder-base` | `oklch(95% 0.02 75)` | Neutral stripe in photo placeholders |
| `--color-accent-gold-dark` | `oklch(45% 0.1 38)` | Text on a gold badge |
| `--color-sky` | `oklch(70% 0.08 230)` | Meditaciones eyebrow/underline accent |
| `--color-sky-pale` | `oklch(88% 0.045 230)` | "Nature" photo placeholder stripe |
| `--color-sky-soft` | `oklch(90% 0.035 230)` | Footer link/body text on the dark footer |
| `--color-manifesto-gradient-start/end` | `oklch(91% 0.035 232)` / `oklch(87% 0.05 250)` | Manifesto section wash |
| `--color-tools-gradient-start/end` | `oklch(94% 0.022 75)` / `oklch(89% 0.045 45)` | Herramientas section wash |
| `--color-footer-bg-start/end` | `oklch(22% 0.05 254)` / `oklch(15% 0.04 258)` | Footer background |
| `--color-newsletter-bg-start/end` | `oklch(38% 0.08 250)` / `oklch(20% 0.055 258)` | Newsletter section background |

Translucent variants (badges, footer text opacity, etc.) use
`color-mix(in oklch, var(--token) X%, transparent)` at the point of use
rather than dedicated alpha tokens — keeps the token list from
multiplying for every opacity a mockup happens to use.

New shared components from Home: `GradientTopBar`, `SiteHeader` (full nav,
sticky, mobile menu), `SiteFooter`, `Eyebrow`, `SectionIntro`,
`ImagePlaceholder` (+ `stripedPlaceholder()` helper in `shared/utils`).
`ImagePlaceholder` only sets `aspect-ratio`/`border-radius` inline when
passed explicitly — if you use it inside a grid/flex layout that sizes
the tile via CSS instead, give that CSS class its own `aspect-ratio` (a
placeholder with no sizing from either source collapses to 0 height; hit
this once already, in the About section's photo).

Added while implementing the Catálogo and book landing pages: no new
color tokens (both reused the Home palette almost entirely — see
`bookLandings.ts` for the one genuine one-off, `oklch(40% 0.07 235)` for
the second book's tagline). New shared components: `BackLink`,
`BookHero`, `Synopsis`, `QuoteBanner`, `BookDetailsGrid`, `RelatedBooks`,
`FinalCta`, `ImageTextSection`, `FeatureGrid`, `FaqAccordion`, and a
`BookCard` extracted out of Home's featured-books grid (used with
`compact` on the catalog, without it on Home). `global.css` also gained a
`.gradient-text` utility for the warm sunrise heading treatment, shared
by Home's hero and the Catálogo title instead of duplicating the
3-stop gradient.

Added while implementing Meditaciones/Herramientas: `--color-neutral-badge-bg`
/ `--color-neutral-badge-text` (`oklch(92% 0.01 90)` / `oklch(45% 0.01 90)`)
for the muted "Próximamente" status badge — the first real pull from the
warm-neutral-gray family flagged below. New shared components:
`CollectionHero` (extracted from Catálogo once Meditaciones/Herramientas
needed the identical eyebrow+gradient-title+glow pattern a 2nd/3rd time),
`ComingSoonCard`, `NewsletterSignup` (generalized from Home's inline
newsletter form so all three signup forms share one implementation), and
`MinimalFooter` (copyright-only — these two pages don't have a
sitemap-worthy set of pages yet). `MeditacionesPage`/`HerramientasPage`
are both thin data props into one shared
`public-store/components/ComingSoonCollectionPage` — the two mockups are
structurally identical, not just similar.

Added while implementing Mi Cuenta: `SiteHeader` now takes an optional
`user` prop (see `data/currentUser.ts`) that swaps "Iniciar sesión" for a
circular initials avatar linking to `/cuenta` — there's no real session
yet, so only the pages that represent a logged-in area (Mi Cuenta,
Biblioteca) pass it. New general-purpose shared components (not tied to
one page): `Button` (primary/secondary/danger/accent), `Switch`, `Dialog`
(a small confirmation modal, Escape-to-close + backdrop-click-to-close).
These will get reused heavily once the admin backoffice starts.

Added while implementing Biblioteca: `ImagePlaceholder`'s `caption` prop
is now optional — pass `alt` instead when the mockup shows a plain
placeholder with no visible caption pill (small thumbnails, e.g. the
90px-wide library covers here). `SiteHeader`'s "Mi biblioteca" link is
now a `NavLink` too, so it gets the same active-state treatment as the
main nav on `/biblioteca`.

### Known but not yet formalized

A broader survey of the mockup bundle (`grep -o 'oklch([^)]*)'` across all
`*.dc.html` files) shows additional color families that recur across
specific page groups but haven't been touched by implemented pages yet.
Don't guess their exact values ahead of need — pull them from the actual
mockup file when you implement the page that uses them, and add them to
`tokens.css` + this table at that point:

- **Warm neutral gray** (hue ~90) — a full ramp from `oklch(88% 0.01 90)`
  through `oklch(30% 0.02 90)`, likely the admin backoffice's UI chrome
  (tables, borders, muted admin text) rather than the public site's
  blue-tinted ink scale. Two points on this ramp are already formalized
  (`--color-neutral-badge-*`, above) — the rest is still unclaimed.
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
