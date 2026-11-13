# Nuestra Medicina Personal

[![CI](https://github.com/Tuquina/nuestra-medicina-personal/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Tuquina/nuestra-medicina-personal/actions/workflows/ci.yml)

Tienda de eBooks full-stack para una autora independiente: web pública con
catálogo y landings por libro, compra con Mercado Pago, biblioteca privada
del comprador y un backoffice completo (CMS, editor de manuscritos, ventas,
cupones, reseñas y métricas).

**Demo (ambiente de desarrollo, pagos en modo prueba):**
https://dev.nuestramedicinapersonal.com.ar

Diseñado para su escala real (~5 libros, pocas visitas diarias, una sola
administradora): un monolito modular en un único VPS, sin infraestructura que
el problema no necesite.

## Funcionalidad

**Web pública**

- Catálogo, landing por libro, secciones editoriales, legales y ayuda.
- Login con Google (OpenID Connect), sin contraseñas.
- Checkout con cupones de descuento → Mercado Pago Checkout Pro → el sitio
  confirma la orden consultando su estado real en el servidor.
- Biblioteca con descargas protegidas, cuenta de usuario, reseñas moderadas y
  newsletter.

**Backoffice (`/admin`)**

- Dashboard y analítica de ventas por período y por libro.
- ABM de libros: precio, portada, archivo vendible y landing del libro.
- Editor de manuscritos: importa DOCX/PDF/TXT/EPUB y exporta EPUB y PDF.
- CMS / page builder con borradores, vista previa, publicación e historial de
  versiones con restauración.
- Ventas, clientes, cupones, moderación de reseñas y biblioteca multimedia.

## Arquitectura

```text
Navegador ─► Caddy (TLS) ─► Nginx ─┬─► SPA React (estáticos)
                                   └─► API Go ─► PostgreSQL
                                          ├─► Mercado Pago (pagos + webhook)
                                          ├─► Google OIDC (login)
                                          └─► Gmail API (emails, vía outbox)
```

- **Backend:** monolito modular en Go con capas `domain` → `application` →
  `infrastructure` / `interfaces`. El dominio no depende de HTTP ni de la base
  de datos; las integraciones externas quedan detrás de interfaces.
- **Frontend:** SPA en React + TypeScript, separada en `public-store/`,
  `admin/`, `shared/` y un `design-system/` con tokens CSS.
- **Infraestructura:** Docker Compose en un VPS. Un proxy Caddy compartido
  sirve dos stacks aislados (producción y desarrollo) con certificados
  automáticos.

Diagramas en [`docs/diagrams/`](docs/diagrams/) (abrir con
[Excalidraw](https://excalidraw.com)) y el detalle completo en
[`docs/architecture.md`](docs/architecture.md).

## Decisiones técnicas destacadas

- **Pagos verificables e idempotentes.** Una orden pasa a `PAID` sólo si el
  webhook tiene firma HMAC válida **y** el pago, reconsultado a Mercado Pago,
  coincide en monto, moneda y referencia. Reprocesar un webhook no duplica
  efectos.
- **Dinero sin `float`.** Montos en unidades menores enteras; cada orden
  guarda el precio histórico. Órdenes y pagos son entidades separadas.
- **Descargas sin URL pública.** El endpoint de descarga valida la compra y
  delega el streaming a Nginx con `X-Accel-Redirect`.
- **Sesiones server-side** (cookies `HttpOnly`) en lugar de JWT, login con
  Authorization Code + PKCE y autorización verificada en el servidor para
  toda ruta `/api/v1/admin/*`.
- **Contenido del CMS estructurado.** El page builder guarda bloques
  validados por esquema, nunca HTML crudo.
- **Emails desacoplados** mediante un outbox en PostgreSQL y un worker con
  reintentos.
- **Decisiones documentadas** como ADRs en [`docs/decisions/`](docs/decisions/).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, CSS Modules |
| Backend | Go 1.26, `net/http`, pgx |
| Base de datos | PostgreSQL 17 con migraciones SQL versionadas |
| Servidores | Nginx (SPA, proxy, descargas) y Caddy (TLS) |
| Integraciones | Google OIDC, Mercado Pago Checkout Pro, Gmail API |
| Testing | `go test` (unitarios + integración con PostgreSQL), Playwright E2E |
| CI/CD | GitHub Actions + GitHub Container Registry, deploy por SSH |

## Calidad y CI/CD

Cada PR a `develop` o `main` ejecuta:

- `gofmt`, `go vet`, más de 170 tests de Go y tests de integración contra
  PostgreSQL real con las migraciones aplicadas;
- lint (oxlint) y build tipado del frontend;
- E2E con Playwright sobre el stack completo, con un Mercado Pago simulado
  (compra, webhook, biblioteca, reseñas y flujos de administración);
- validación del contrato OpenAPI y de los archivos Compose;
- un ciclo real de backup y restauración de la base y los archivos;
- build de las imágenes Docker.

Un merge a `develop` despliega automáticamente al ambiente de desarrollo; un
merge a `main` despliega a producción con aprobación manual. Ver
[`docs/ci.md`](docs/ci.md).

## Desarrollo local

Requisito: Docker con Compose (no hace falta Node ni Go instalados).

```bash
docker compose up --build
```

Levanta PostgreSQL, aplica migraciones y sirve la API en
`http://localhost:8080` y el frontend en `http://localhost:5173`. En local,
`/admin` usa una identidad de administración sintética que sólo se habilita
fuera de producción. Las variables opcionales están documentadas en
[`.env.example`](.env.example).

```bash
# Backend
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go test ./...
# Frontend
docker run --rm -v "$(pwd)/frontend:/app" -w /app node:20-alpine sh -c "npm ci && npm run lint && npm run build"
```

Los tests E2E se describen en [`e2e/README.md`](e2e/README.md).

## Estructura

```text
frontend/    SPA React (tienda pública, backoffice, componentes y design system)
backend/     API Go (cmd/api, cmd/migrate, internal/…)
migrations/  Migraciones SQL numeradas (up/down)
deploy/      Compose de producción, Nginx, proxy Caddy y scripts de backup
e2e/         Tests Playwright con un Mercado Pago simulado
docs/        Arquitectura, API (OpenAPI), design system, CI, ADRs y diagramas
```

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura y reglas del producto |
| [`docs/api.md`](docs/api.md) · [`docs/openapi.yaml`](docs/openapi.yaml) | Contrato de la API |
| [`docs/design-system.md`](docs/design-system.md) | Tokens y convenciones de UI |
| [`docs/ci.md`](docs/ci.md) | Ramas, CI y flujo de deploy |
| [`deploy/README.md`](deploy/README.md) | Despliegue, backups y operación |
| [`docs/decisions/`](docs/decisions/) | ADRs |

## Desarrollo asistido por IA

El proyecto se desarrolla con agentes de código. [`AGENTS.md`](AGENTS.md)
define las reglas que cualquier agente debe respetar (stack fijo salvo ADR,
seguridad de pagos y descargas, convenciones de frontend, commits y ramas), y
la arquitectura está escrita como fuente de verdad para que los cambios sean
consistentes. Todo cambio pasa por PR y por el mismo CI.
