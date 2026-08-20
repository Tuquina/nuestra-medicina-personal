# Frontend implementation plan

**Status: all 17 mockups implemented.** Every public-store and admin page
in the handoff bundle has a working route, verified against its mockup
in the browser. Backend transport integration is in progress: session,
published catalog and the authenticated library now use the real API. See
"Notes for whoever picks this up next" below for the remaining modules.

Maps every mockup in the Claude Design handoff bundle
(`Web page UI mockup-handoff.zip` → `project/*.dc.html`) to a route and
component, in implementation order. Update the Status column as pages
land — this is the resumable checklist for "continue where we left off."

Order follows architecture.md §75 (tokens → shared components → page
templates → public store → admin → Page Builder) and §73 (small,
verifiable steps rather than "build the whole app").

## Public store

| Mockup file | Route | Component | Priority | Status |
|---|---|---|---|---|
| `Login.dc.html` | `/login` | `public-store/pages/LoginPage` | P0 | ✅ Done |
| `Inicio.dc.html` | `/` | `public-store/pages/HomePage` | P0 | ✅ Done |
| `Catalogo.dc.html` | `/libros` | `public-store/pages/CatalogoPage` | P0 | ✅ Done |
| `Libro - El poder de tu historia.dc.html` | `/libros/el-poder-de-tu-historia` | `public-store/pages/BookLandingPage` (shared, data-driven) | P0 | ✅ Done |
| `Libro - La escritura terapeutica entra a la escuela.dc.html` | `/libros/la-escritura-terapeutica-entra-a-la-escuela` | same as above | P0 | ✅ Done |
| `Mi Cuenta.dc.html` | `/cuenta` | `public-store/pages/MiCuentaPage` | P1 | ✅ Done |
| `Biblioteca.dc.html` | `/biblioteca` | `public-store/pages/BibliotecaPage` | P1 | ✅ Done |
| `Checkout.dc.html` | `/checkout/:slug` | `public-store/pages/CheckoutPage` | P1 | ✅ Done |
| `Meditaciones.dc.html` | `/meditaciones` | `public-store/pages/MeditacionesPage` | P1 | ✅ Done |
| `Herramientas.dc.html` | `/herramientas` | `public-store/pages/HerramientasPage` | P1 | ✅ Done |

`BookLandingPage` is **one** data-driven component at `/libros/:slug`,
not two files. The two mockups *do* diverge (one has an image+text
section + FAQ accordion, the other has a benefits grid and no FAQ) — that
divergence is modeled as a discriminated union (`middleSection.type`)
plus an optional `faqs` field in `data/bookLandings.ts`, so each book
picks the blocks it actually has instead of forcing a shared shape or
duplicating the whole page.

## Admin backoffice

All admin routes live under `/admin` and require server-side
authorization in the backend (architecture.md §21) — the
frontend routes themselves are not a security boundary.

Route slugs generally follow the mockups' own Spanish nav labels
(`/admin/multimedia`, matching the sidebar's "Multimedia" link) rather
than architecture.md §16's suggested `/admin/media` — that section calls
its own routes "orientativos y pueden ajustarse"; consistency across the
sidebar/pages/quick-action links mattered more here than matching the
suggested slug exactly. The *API* route in §34 (`/api/v1/admin/media`)
is unaffected — only this frontend path differs.

| Mockup file | Route | Component | Priority | Status |
|---|---|---|---|---|
| `Admin Dashboard.dc.html` | `/admin` | `admin/pages/DashboardPage` | P2 | ✅ Done |
| `Admin Libros.dc.html` | `/admin/libros` | `admin/pages/LibrosListPage` | P2 | ✅ Done |
| `Admin Libro Nuevo.dc.html` | `/admin/libros/nuevo` + `/admin/libros/:slug/editar` | `admin/pages/LibroFormPage` | P2 | ✅ Done |
| `Admin Ventas.dc.html` | `/admin/ventas` | `admin/pages/VentasPage` | P2 | ✅ Done |
| `Admin Clientes.dc.html` | `/admin/clientes` | `admin/pages/ClientesPage` | P2 | ✅ Done |
| `Admin Multimedia.dc.html` | `/admin/multimedia` | `admin/pages/MultimediaPage` | P2 | ✅ Done |
| `Admin Configuracion.dc.html` | `/admin/configuracion` | `admin/pages/ConfiguracionPage` | P2 | ✅ Done |
| `Admin Page Builder.dc.html` | `/admin/paginas` | `admin/pages/PageBuilderPage` | P3 (most complex; done last) | ✅ Done |

## Post-launch content & admin extensions

Added after the 17-mockup handoff was fully implemented and `shared/cms`
(the localStorage-backed content store, see its own doc comments) landed
for Home and each book's landing page. Two kinds of follow-up work:

**A. Extend `shared/cms` editability to Meditaciones, Herramientas, and
the "Sobre el proyecto" bio** — these already render from
`ComingSoonCollectionPage` / Home's `about` section, but with hardcoded
copy. Same pattern as Home/book pages: a seed content builder + a small
admin form, reading/writing through `contentStore.ts`.

- `PageType` gains `'MEDITACIONES' | 'HERRAMIENTAS'` alongside
  `'HOME' | 'BOOK'`. The backend now supports these singleton types through
  `migrations/006_expand_page_types.up.sql`; wiring the frontend still remains.
- Each collection page's content = hero copy (title/description) + a
  list of "coming soon" cards (title/description/imageCaption per card),
  matching `ComingSoonCollectionPage`'s existing props shape.
- Admin editors: `/admin/paginas/meditaciones` and
  `/admin/paginas/herramientas`, structured forms like the book-page
  editor (not the generic Page Builder — these pages don't have
  swappable blocks, just a hero and N cards), with add/remove-card
  support.
- "Sobre el proyecto": a small dedicated form (not the full Page
  Builder) editing the Home page's `about` section content directly —
  reuses `homeContent.ts`'s existing `AboutProps` shape and
  `contentStore.ts`'s Home record, so it's the same underlying data the
  Page Builder's "Sobre el proyecto" block already edits, just reached
  through a simpler, purpose-built form. Lives at
  `/admin/sobre-el-proyecto`.
- Sidebar: "Páginas" section gains "Meditaciones", "Herramientas", and
  "Sobre el proyecto" links (`AdminLayout.tsx`).

**B. Build out the 3 "Próximamente" admin sections** (Cupones, Reseñas,
Analítica — listed as future extensions in architecture.md §6). Cupones y
Reseñas no forman parte del contrato backend MVP; cada una mantiene una
localStorage-backed mock data layer shaped like the eventual REST
resource, so swapping in real `fetch` calls later is a small, isolated
change (same principle as `admin/data/sales.ts` / `customers.ts` today,
just with write operations too since these are admin-editable).

- **Cupones** (`/admin/cupones`): `Coupon { id, code, kind:
  'percentage'|'fixed', value, status, startDateISO, endDateISO,
  usageLimit, usageCount, appliesTo: 'all' | string[] (book slugs) }`.
  List + create/edit dialog, matching the table conventions in
  `VentasPage`/`ClientesPage`. Store: `admin/data/couponsStore.ts`
  (localStorage-backed CRUD, mirrors `shared/cms/contentStore.ts`'s
  shape but for a plain resource list rather than draft/published page
  content).
- **Reseñas** (`/admin/resenas`): `Review { id, bookSlug, customerName,
  rating (1-5), text, status: 'pending'|'approved'|'rejected',
  createdAtISO }`. List with per-status filter + approve/reject actions.
  Store: `admin/data/reviewsStore.ts`.
- **Analítica** (`/admin/analitica`): read-only dashboard extending
  `DashboardPage`'s stat-card/chart components with more detail (revenue
  by period, top books, funnel-ish counts) computed from the existing
  mock `SALES`/`CUSTOMERS` data — architecture.md §60 explicitly says to
  compute these via Postgres aggregate queries rather than a separate
  analytics tool, so this page is structured to call one future
  aggregate endpoint (`GET /api/v1/admin/analytics?range=...`), not
  several.
- Sidebar: the three "Próximamente" `<span>` placeholders in
  `AdminLayout.tsx` become real `NavLink`s once each route exists.

**C. `/terminos` and `/privacidad`** — real content, replacing the
`NotFoundPage` fallback the footer/login links used to hit, and now
editable from `/admin/legal/*` (see D below). No `.dc.html` mockup
exists for these (they weren't part of the original handoff), so they
follow the site's existing typographic conventions via a new shared
`LegalPage` layout (`shared/components/LegalPage`) — hero + table of
contents + prose sections — rather than a specific source design.
Written with Argentine law as the reference point (Ley 24.240 Defensa
del Consumidor, Ley 25.326 Protección de Datos Personales, Ley 11.723
Propiedad Intelectual, Resolución 424/2020) since the site sells to
consumers in Argentina via Mercado Pago, but both pages open with a
note that this is a starting point for a real abogado to review, not a
finished legal instrument — and the site owner's actual legal identity
(razón social/CUIT/domicilio) is marked `[a completar]` rather than
invented.

**D. The rest of the footer's "Ayuda" and "Legal" links, and admin
editors for both groups** — `/contacto`, `/soporte`,
`/preguntas-frecuentes` are real pages now (previously 404ing), and
every one of C/D's five pages is editable from the admin, in two
sidebar sections separate from "Páginas": **Ayuda**
(`/admin/ayuda/contacto`, `/admin/ayuda/soporte`,
`/admin/ayuda/preguntas-frecuentes`) and **Legal**
(`/admin/legal/terminos`, `/admin/legal/privacidad`).

- `shared/cms/helpContent.ts` models the three Ayuda pages: Contacto is
  a title/intro + a repeatable list of contact methods
  (label/value/href); Soporte is a title/intro + repeatable "topic"
  cards (reuses `FeatureGrid`); FAQ is a title/intro + repeatable Q&A
  items (reuses `FaqAccordion`, both now take an optional `heading` so
  a standalone page doesn't get a duplicate title).
- `shared/cms/legalDocContent.ts` models Términos/Privacidad as a
  title/updated-label/intro-note + an ordered list of numbered
  sections, where each section's body is a small **markdown-lite**
  string (blank line = new paragraph, `- ` = bullet, `> ` = highlighted
  note, `**bold**`) rather than JSX — safe to edit from a plain
  `<textarea>` without a rich-text editor. `legalDocRenderer.tsx`
  parses it back into `LegalParagraph`/`LegalList`/`LegalNote`. (Split
  into a `.ts` data file + a `.tsx` renderer file specifically so the
  data file has no JSX and doesn't trip oxlint's
  `react/only-export-components` Fast Refresh rule.)
- Admin editors: `admin/pages/AyudaEditorPages/*` (one file per Ayuda
  page) and `admin/pages/LegalDocEditorPage/LegalDocEditorPage.tsx` (one
  generic editor, reused for both legal docs via two thin wrapper
  components) — all sharing `admin/components/EditorForm/EditorForm.module.css`,
  the toolbar/status-badge/card-list styling first written for
  `CollectionPageEditor` and promoted here once a third and fourth
  editor needed the same look.
- `PageType` (`shared/cms/types.ts`) now also has `'CONTACTO'`,
  `'SOPORTE'`, `'FAQ'`, `'TERMINOS'`, `'PRIVACIDAD'`; these types and their
  closed content schemas are accepted by the backend. Replacing the local store
  with API calls remains a later integration task.

## Responsive audit (tablet/mobile)

A full pass over every public and admin route at 768px (tablet) and
375px (mobile), fixing what was actually broken rather than guessing
from CSS alone. Real bugs found and fixed:

- **`AdminLayout`'s sidebar had zero responsive handling** — a fixed
  240px column plus a 240px content margin doesn't fit in a 375px
  viewport at all, so every single `/admin/*` page was unusable on
  phones. Now an off-canvas drawer below 900px: a hamburger button in
  the header, a backdrop to dismiss, `menuOpen` state that naturally
  resets closed on every navigation since each admin page mounts its
  own `<AdminLayout>`.
- **Every admin table clipped its own columns instead of scrolling to
  them** (`LibrosListPage`, `VentasPage`, `ClientesPage`, `CuponesPage`,
  the Dashboard's "Ventas recientes", `AnaliticaPage`'s "Ingresos por
  libro") — their shared `.panel { overflow: hidden }` silently hid
  whatever columns didn't fit (Estado, Acciones, etc. were completely
  inaccessible, not just visually cramped). Fixed by wrapping each
  `<table>` in its own `overflow-x: auto` scroll container with a
  `min-width` on the table, instead of letting the panel clip it.
- **`CuponesPage`'s new-coupon dialog**: the "Desde"/"Hasta" date row
  used a bare `1fr 1fr` grid, which still respects each native
  `<input type="date">`'s intrinsic minimum width — inside the 380px
  dialog that pushed the second date input past the card's edge (at
  any viewport, not just mobile — the dialog's width doesn't change
  with the page). Fixed with `minmax(0, 1fr)` tracks.
- **`MultimediaPage`'s detail drawer and `ConfiguracionPage`'s section
  nav** both used a fixed-width side column (`300px` / `180px`) next
  to a `flex: 1` content area with no breakpoint — below ~860/700px
  the content area was squeezed to a sliver while the side column kept
  its full width. Both now stack (drawer full-width below the grid;
  section nav becomes a wrapping horizontal tab row) below their
  breakpoint.
- **`ContactoPage`**: a long email address in a fixed-row layout
  overflowed its card on narrow screens. Fixed with `flex-wrap` +
  `overflow-wrap: anywhere` on the value.

**Deliberately left as-is**: `PageBuilderPage`'s 3-pane visual builder
(block library / canvas / inspector) and `ManuscritoTab`'s
physical-page-simulating editor aren't mobile-optimized — both work
tolerably at tablet width (verified), but a phone-width redesign would
need a different interaction model entirely (tabs instead of panes),
not a CSS fix, matching how every comparable visual-builder product
(Webflow, Framer, WordPress's block editor) treats small screens.

## Frontend route guards (`shared/auth`)

Until now the frontend had **no** notion of the real session at all:
`/admin/*`, `/cuenta` and `/biblioteca` rendered unconditionally for any
visitor who navigated to them directly, and `SiteHeader`/`MiCuentaPage`/
`BibliotecaPage` showed a hardcoded mock user (`public-store/data/currentUser.ts`,
now deleted) regardless of whether anyone was actually logged in.

**This was never a security gap** — architecture.md §21 is explicit that
every `/api/v1/admin/*` (and other user-scoped) request is authorized
server-side by `requireAdmin`/`requireUser` (`backend/internal/interfaces/httpapi/middleware.go`)
validating the session cookie, independent of whatever the frontend
does or doesn't show. But it was a real UX gap: a logged-out visitor
saw the full admin UI (with every request inside it then failing), and
a logged-in visitor saw "Iniciar sesión" everywhere instead of their
own account.

Added `shared/auth/`:
- `types.ts` — `AuthUser`/`AuthState` (mirrors the backend's `GET
  /api/v1/me` response shape) and `initialsFrom()`.
- `useAuth.ts` — the `AuthContext` plus the `useAuth()` hook. Kept
  separate from `AuthContext.tsx` (Fast Refresh breaks on a file that
  exports both a component and a plain function) and deliberately
  **not** named `authContext.ts` — that differs from `AuthContext.tsx`
  only in casing, which case-insensitive filesystems (Windows, some
  Docker bind mounts) collide on even though the extensions differ.
- `AuthContext.tsx` — `AuthProvider`, which calls `GET /api/v1/me`
  once per app load (`credentials: 'include'`) and resolves to
  `'authenticated' | 'anonymous'`.
- `RequireAuth.tsx` / `RequireAdmin.tsx` — React Router layout-route
  guards. `RequireAuth` redirects anonymous visitors to `/login`.
  `RequireAdmin` does the same, plus renders an inline "no tenés
  permisos de administrador" card (rather than a redirect) for a
  logged-in non-admin, so they're not silently bounced with no
  explanation.
- `shared/components/AuthLoading/` — the brief "Cargando…" state shown
  while the `/api/v1/me` call is in flight.

`App.tsx` now wraps the whole route tree in `<AuthProvider>`, nests
`/cuenta` and `/biblioteca` under `<Route element={<RequireAuth />}>`,
and nests every `/admin/*` route (converted to relative children)
under `<Route path="/admin" element={<RequireAdmin />}>`.
`SiteHeader` reads `useAuth()` internally instead of taking a `user`
prop, so all ten of its call sites now show the real signed-in state
automatically instead of only the two pages that used to remember to
pass one.

**Caught during manual verification**: `shared/config/api.ts`'s
`ME_URL` was initially written as `/api/v1/auth/me`, guessed by
analogy with `/api/v1/auth/google` and `/api/v1/auth/logout`. The real
route (`router.go`) is `GET /api/v1/me` — it lives next to `/api/v1/me/books`,
not under `/api/v1/auth/*`. Fixed; worth remembering if this endpoint
ever needs touching again.

One layer here is genuinely still missing, not by oversight but
because there's nothing to guard yet: **admin sidebar items aren't
filtered by admin sub-role/permission**, because the backend only has
a single boolean `isAdmin` today (no finer-grained roles). If
architecture.md ever grows role-scoped admin permissions, `RequireAdmin`
and the sidebar are the two places to extend.

## Notes for whoever picks this up next

- The backend content validator now accepts the current Home section schemas
  and the complete `book-landing` shape, including both middle-section
  variants. The remaining CMS work is transport integration: replace the
  localStorage adapter with the draft/publish/version endpoints.

- Session, public catalog, book detail, checkout book lookup and library now
  consume the backend contracts. They include loading, empty and retryable
  error states; protected downloads use the book UUID returned by the library.
- Checkout now creates the order, stores its UUID for the external handoff and
  verifies the authoritative order after Mercado Pago returns. URL status
  parameters never unlock an approved result by themselves.
- **Next real milestone for these screens**: integrate administrative books,
  eBook files and multimedia, then replace the remaining reporting, settings
  and CMS local adapters with authenticated API calls.
- If new frontend pages get added later that *do* have a mockup: read
  the `.dc.html` source in full first (see `AGENTS.md`), extract any new
  tokens into `design-system/tokens.css` + `docs/design-system.md` before writing
  the component, then build the page. Verify with `docker compose up` +
  the browser tools, plus `npm run build` / `npm run lint` (via Docker
  — see AGENTS.md) before marking anything done.
