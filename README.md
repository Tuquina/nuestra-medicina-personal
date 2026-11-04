# Nuestra Medicina Personal

Tienda personal de eBooks (escritura terapéutica, meditaciones, herramientas)
con web pública, compra con Mercado Pago, biblioteca del comprador y un
backoffice completo para administrar libros, páginas, ventas y contenido.

Monorepo: React/Vite en `frontend/`, monolito modular en Go en `backend/`,
PostgreSQL como fuente de verdad. Pensado para ~5 visitas/día y ~5 libros:
todo corre en un único VPS con Docker Compose.

> Antes de cambiar contratos o infraestructura, leer [`AGENTS.md`](AGENTS.md)
> y [`docs/architecture.md`](docs/architecture.md).

## Links rápidos

| Qué | Desarrollo (DEV) | Producción (PROD) |
|---|---|---|
| Sitio público | https://dev.nuestramedicinapersonal.com.ar | https://nuestramedicinapersonal.com.ar |
| Ingreso (login con Google) | https://dev.nuestramedicinapersonal.com.ar/login | https://nuestramedicinapersonal.com.ar/login |
| Panel admin (dashboard) | https://dev.nuestramedicinapersonal.com.ar/admin | https://nuestramedicinapersonal.com.ar/admin |
| Estado de la API | https://dev.nuestramedicinapersonal.com.ar/health/ready | https://nuestramedicinapersonal.com.ar/health/ready |
| Rama que se despliega | `develop` (automático) | `main` (con aprobación manual) |
| Mercado Pago | Modo prueba (`TEST-…`) | Credenciales reales |

Otros:

- Repositorio: https://github.com/Tuquina/nuestra-medicina-personal
- Deploys y CI: https://github.com/Tuquina/nuestra-medicina-personal/actions
- Secrets/variables por ambiente: Settings → Environments → `development` /
  `production` (ahí están dominio, emails de admins, credenciales; la IP y el
  usuario del VPS están en Settings → Secrets and variables → Actions →
  *Repository variables* `DEPLOY_HOST` / `DEPLOY_USER`).
- Imágenes Docker: GitHub Container Registry (`ghcr.io/tuquina/nuestra-medicina-personal-backend` y `-web`).
- Mercado Pago Developers (credenciales y webhooks): https://www.mercadopago.com.ar/developers/panel/app
- Google Cloud Console (login OAuth): https://console.cloud.google.com/apis/credentials

Para entrar a `/admin` hay que iniciar sesión con una cuenta de Google que
esté en la variable `ADMIN_EMAILS` del ambiente correspondiente.

## Estado actual (noviembre 2026)

| Área | DEV | PROD |
|---|---|---|
| Sitio y API | ✅ Funcionando | ❌ Responde 502: el stack de prod nunca se desplegó |
| Login con Google | ✅ Configurado | ⚠️ Configurado en GitHub, sin desplegar |
| Mercado Pago | ✅ Modo prueba configurado (falta una compra de prueba end-to-end) | ❌ Sin credenciales en el Environment `production` |
| Emails (Gmail API) | ❌ Sin configurar | ❌ Sin configurar |
| CI (tests, lint, E2E) | ✅ En verde en `develop` | — |
| Deploys | ⚠️ Repo privado en GitHub Free: GitHub ignora los secrets de los Environments | ⚠️ Ídem |

### Salir a producción

La guía paso a paso, con las variables exactas que faltan cargar, está en
**[`docs/go-live.md`](docs/go-live.md)**. Resumen:

0. **Bloqueante:** resolver el repo privado (GitHub Pro o volver a público).
   Hasta entonces no mergear a `develop`, porque el deploy dejaría DEV sin
   secrets.
1. Compra de prueba completa en DEV.
2. Mercado Pago: activar credenciales de producción y configurar el webhook
   en *Modo productivo*.
3. Cargar en el Environment `production`: `MERCADOPAGO_ACCESS_TOKEN`,
   `MERCADOPAGO_WEBHOOK_SECRET` (secrets) y `MERCADOPAGO_PUBLIC_BASE_URL`
   (variable).
4. Google: redirect URI de prod y pantalla de consentimiento publicada.
5. PR `develop → main` y aprobar el deploy.
6. Verificar prod. 7. Cargar contenido. 8. Después: Gmail, `www`, backups.

## Diagramas

Archivos Excalidraw en [`docs/diagrams/`](docs/diagrams/) (abrir en
https://excalidraw.com → menú → *Open*):

| Diagrama | Muestra |
|---|---|
| [`infraestructura.excalidraw`](docs/diagrams/infraestructura.excalidraw) | VPS, Caddy, stacks prod/dev e integraciones externas |
| [`deploy-pipeline.excalidraw`](docs/diagrams/deploy-pipeline.excalidraw) | Ramas, CI y qué hace cada deploy |
| [`flujo-de-compra.excalidraw`](docs/diagrams/flujo-de-compra.excalidraw) | Checkout, webhook de Mercado Pago y biblioteca |
| [`go-live-checklist.excalidraw`](docs/diagrams/go-live-checklist.excalidraw) | Los pasos para salir a producción |

Pendientes de producto menores (no bloquean): revisar estados vacíos y de
error en toda la app; números de página en el PDF exportado del manuscrito
(ver [`docs/frontend-plan.md`](docs/frontend-plan.md)).

## Funcionalidad

**Web pública**

- Inicio, catálogo (`/libros`), landing de cada libro (`/libros/:slug`),
  Meditaciones, Herramientas, términos, privacidad, contacto, soporte y FAQ.
- Login con Google (`/login`); no hay contraseñas.
- Checkout (`/checkout/:slug`) con cupones de descuento → Mercado Pago
  Checkout Pro → vuelta al sitio, que verifica el estado real de la orden.
- Mi cuenta (`/cuenta`): datos, newsletter, eliminar cuenta.
- Biblioteca (`/biblioteca`): libros comprados con descarga protegida.
- Reseñas de libros (sólo compradores; quedan pendientes de moderación).
- Suscripción al newsletter.

**Panel admin (`/admin`)**

- Dashboard y Analítica: ventas, ingresos y métricas por período y libro.
- Libros: alta/edición/archivado, precio, portada, archivo PDF/EPUB, landing
  del libro y **editor de manuscrito** (importa DOCX/PDF/TXT/EPUB, exporta
  EPUB y PDF).
- Páginas (CMS): Inicio, Meditaciones, Herramientas, Sobre el proyecto,
  legales y ayuda; borradores, publicación, vista previa e historial de
  versiones con restauración.
- Ventas, Clientes, Cupones, Reseñas (moderación) y Multimedia (imágenes).
- Configuración: datos editoriales y estado (sólo lectura) de las
  integraciones (Google, Mercado Pago, Gmail).

## Stack y arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript 6, React Router 7, CSS Modules |
| Backend | Go 1.26, monolito modular (domain / application / infrastructure / interfaces) |
| Base de datos | PostgreSQL 17, migraciones SQL en `migrations/` |
| Web server | Nginx: sirve el SPA, hace proxy a la API y streamea descargas con `X-Accel-Redirect` |
| Proxy / TLS | Caddy 2 compartido (`deploy/proxy/`), certificados Let's Encrypt automáticos |
| Login | Google OpenID Connect (Authorization Code + PKCE), sesiones server-side (no JWT) |
| Pagos | Mercado Pago Checkout Pro + webhook firmado con HMAC |
| Emails | Gmail API con service account de Google Workspace (outbox + worker con reintentos) |
| Archivos | Disco local del VPS en volúmenes Docker privados (`ebooks_data`, `media_data`) |
| Infraestructura | Un Netcup VPS 500 G12 (2 vCore, 4 GB RAM) con Docker Compose |
| CI/CD | GitHub Actions: CI en cada PR, deploy por SSH a DEV/PROD |
| Tests | Go (unitarios + integración con Postgres), Playwright E2E con un Mercado Pago falso |

```text
Internet ─► Caddy (80/443, TLS) ─┬─► nginx-prod ─► api-prod (Go) ─► postgres-prod
                                 └─► nginx-dev  ─► api-dev  (Go) ─► postgres-dev
                        (mismo VPS, dos stacks Compose aislados: nmp-prod / nmp-dev)
```

Reglas importantes (detalle en [`AGENTS.md`](AGENTS.md)):

- Los eBooks nunca tienen URL pública: se descargan por
  `GET /api/v1/books/{id}/download`, que valida la compra.
- Una orden sólo pasa a `PAID` cuando el webhook de Mercado Pago tiene firma
  válida **y** el pago reconsultado a Mercado Pago coincide en monto, moneda
  y referencia. El webhook es idempotente.
- Dinero siempre en unidades menores enteras; las órdenes guardan el precio
  histórico. Órdenes y pagos son entidades separadas.
- Toda ruta `/api/v1/admin/*` valida permisos en el servidor.

### Cómo funciona el pago

1. El comprador (logueado) confirma en `/checkout/:slug`; la API crea la orden
   `PENDING` y una *preferencia* en Mercado Pago.
2. El navegador va al checkout de Mercado Pago (sandbox si el token es
   `TEST-`).
3. Mercado Pago llama a `POST /api/v1/webhooks/mercadopago`; la API valida la
   firma, reconsulta el pago y marca la orden `PAID`.
4. El comprador vuelve a `/checkout/:slug?status=…`; la página consulta la
   orden real y el libro aparece en `/biblioteca`.

## Estructura del repo

```text
frontend/    SPA React (public-store/ + admin/ + shared/ + design-system/)
backend/     API Go (cmd/api, cmd/migrate, internal/…)
migrations/  Migraciones SQL numeradas (up/down)
deploy/      Stack de producción/dev (Compose + Nginx), proxy Caddy, backups
e2e/         Tests Playwright con fake de Mercado Pago
docs/        Arquitectura, API, OpenAPI, design system, CI, ADRs
.github/     CI (ci.yml) y deploy (deploy.yml, deploy-dev.yml, deploy-prod.yml)
```

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Fuente de verdad de la arquitectura y el producto |
| [`docs/design-system.md`](docs/design-system.md) | Tokens (colores OKLCH, tipografías Newsreader + Public Sans) y convenciones de componentes |
| [`docs/frontend-plan.md`](docs/frontend-plan.md) | Qué mockup corresponde a qué pantalla y qué está hecho |
| [`docs/api.md`](docs/api.md) / [`docs/openapi.yaml`](docs/openapi.yaml) | Contrato de la API |
| [`docs/ci.md`](docs/ci.md) | Ramas, CI y flujo de deploy |
| [`deploy/README.md`](deploy/README.md) | VPS, secrets de GitHub, Mercado Pago en DEV, Gmail, backups, logs |
| [`docs/decisions/`](docs/decisions/) | ADRs: VPS, Gmail API, features de comercio, manuscrito, ambiente DEV |
| [`e2e/README.md`](e2e/README.md) | Cómo correr los tests E2E |

## Flujo de trabajo

```text
rama feature/… o fix/… ─► PR a develop ─► CI ─► merge ─► deploy automático a DEV
develop ─► PR a main ─► CI ─► merge ─► deploy a PROD (aprobación manual en Actions)
```

`develop` y `main` están protegidas: sólo se cambia por PR, con CI en verde y
todas las conversaciones del PR resueltas.

## Desarrollo local

Requisito: Docker con Compose (no hace falta Node ni Go instalados).

```bash
docker compose up --build
```

Inicia PostgreSQL, aplica migraciones, levanta la API en `http://localhost:8080`
y el frontend en `http://localhost:5173`. En local `/admin` entra sin login
(`LOCAL_ADMIN_BYPASS`, nunca activo en producción). Mercado Pago no funciona
en local porque exige URLs HTTPS públicas: para probar pagos usar DEV.

Verificaciones:

```bash
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go test ./...
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go vet ./...
docker run --rm -v "$(pwd)/frontend":/app -w /app node:20-alpine sh -c "npm install && npm run build && npm run lint"
```

Variables de entorno: ver [`.env.example`](.env.example) (local) y
[`deploy/.env.example`](deploy/.env.example) (servidor). En DEV/PROD no se
editan a mano: el workflow de deploy arma el `.env` desde los secrets y
variables del Environment de GitHub en cada despliegue.

## Logs y diagnóstico en el VPS

```bash
docker compose -p nmp-dev --env-file deploy/.env.dev -f deploy/docker-compose.yml logs -f api
```

(`nmp-prod` / `deploy/.env.prod` para producción). Mensajes útiles para pagos:
`mercado pago webhook processed` (llegó y se aplicó) y
`mercado pago webhook signature rejected` (clave secreta incorrecta).
