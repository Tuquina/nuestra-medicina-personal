# Nuestra Medicina Personal — Frontend

React + Vite + TypeScript SPA (see [`docs/architecture.md`](../nuestra_medicina_personal_architecture.md) §2, §30 for the full stack rationale).

## Status

Only `/login` is implemented so far, built from the approved Claude Design
mockup (`Nuestra Medicina Personal - Login.dc.html`). `/` redirects to it
temporarily; everything else falls back to a 404 placeholder until it's
built.

## Running it

No local Node install is required — run it in Docker:

```bash
docker compose up
```

Then open <http://localhost:5173/login>. Source changes hot-reload inside
the container.

If you do have Node 20+ installed locally, the usual commands also work
from `frontend/`:

```bash
npm install
npm run dev      # dev server
npm run build    # type-check + production build
npm run lint      # oxlint
```

## Structure

```text
src/
├── app/            # route table / app shell
├── public-store/   # public-facing pages (Login, …)
├── admin/          # backoffice (not started)
├── shared/         # reusable components, hooks, config
└── design-system/  # color/typography/spacing tokens (CSS custom properties)
```

Design tokens in `src/design-system/tokens.css` are the source of truth for
color and typography — avoid hardcoding raw values in component styles.

## Auth

"Continuar con Google" is a full-page navigation to `/api/v1/auth/google`
(architecture.md §19, §34). That endpoint doesn't exist yet — there's no Go
backend in this repo yet — so the click currently 404s. The dev server
proxies `/api/*` to `http://localhost:8080` so this starts working the
moment the backend is added, with no frontend changes needed.
