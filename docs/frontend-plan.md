# Frontend implementation plan

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
| `Admin Configuracion.dc.html` | `/admin/configuracion` | `admin/pages/ConfiguracionPage` | P2 | ⬜ Pending |
| `Admin Page Builder.dc.html` | `/admin/paginas/:pageId/editor` | `admin/pages/PageBuilderPage` | P3 (most complex; do last) | ⬜ Pending |

## Notes for whoever picks this up next

- All of this is **frontend-only, no backend yet**. Pages should render
  with realistic placeholder/mock data and wire API calls to the
  contracts in architecture.md §34, but those calls will 404 until the
  Go backend exists — that's expected, not a bug to work around with
  fake success states.
- Every new page: read the `.dc.html` source in full first (see
  `AGENTS.md`), extract any new tokens into
  `design-system/tokens.css` + `docs/design-system.md` before writing
  the component, then build the page.
- Verify with `docker compose up` + the browser tools, plus
  `npm run build` / `npm run lint` (via Docker — see AGENTS.md) before
  marking a row ✅ here.
