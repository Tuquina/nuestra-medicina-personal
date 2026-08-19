# Frontend implementation plan

**Status: all 17 mockups implemented.** Every public-store and admin page
in the handoff bundle has a working route, verified against its mockup
in the browser. There is still no backend — see "Notes for whoever picks
this up next" below for what that means and what's next.

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
authorization once the backend exists (architecture.md §21) — the
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
  `'HOME' | 'BOOK'`. **This is wider than the real backend's `pages.type`
  CHECK constraint** (`migrations/001_initial_schema.up.sql` only allows
  `'HOME'` and `'BOOK'` today) — whoever wires the real `pages` API needs
  a migration adding these values (or a generic `'PAGE'` type +
  slug-based lookup) before this can point at a real endpoint. Flagged
  with a comment at the `PageType` definition.
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
Analítica — listed as future extensions in architecture.md §6). None of
these have a backend yet, same as everything else here — each gets a
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

## Notes for whoever picks this up next

- All of this is **frontend-only, no backend yet**. Pages render with
  realistic mock data (`public-store/data/*`, `admin/data/*`) and wire
  API calls to the contracts in architecture.md §34, but those calls
  404 until the Go backend exists — that's expected, not a bug to work
  around with fake success states. Search the frontend for `No backend
  yet` comments to find every one of these seams.
- **Next real milestone**: the backend. Architecture.md §73 has a
  recommended build order (schema → domain → API → auth → …) — follow
  that rather than re-deriving one, and use the DTOs implied by what
  the frontend already calls (`shared/config/api.ts`, and each page's
  `fetch(...)` calls) as the de facto contract to implement against.
- If new frontend pages get added later (e.g. real Term/Privacy pages
  currently 404ing to `NotFoundPage`): read the `.dc.html` source in
  full first (see `AGENTS.md`), extract any new tokens into
  `design-system/tokens.css` + `docs/design-system.md` before writing
  the component, then build the page. Verify with `docker compose up` +
  the browser tools, plus `npm run build` / `npm run lint` (via Docker
  — see AGENTS.md) before marking anything done.
