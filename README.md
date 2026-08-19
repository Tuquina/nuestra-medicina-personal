# Nuestra Medicina Personal

Tienda personal de eBooks construida como monorepo: React/Vite en `frontend/`
y un monolito modular en Go en `backend/`, con PostgreSQL como fuente de verdad.

Antes de cambiar contratos o infraestructura, leer `AGENTS.md` y
[`docs/architecture.md`](docs/architecture.md).

## Desarrollo local

Requisito: Docker con Compose.

```bash
docker compose up --build
```

Esto inicia PostgreSQL, aplica migraciones, levanta la API en el puerto `8080`
y el frontend en el `5173`. La base no publica un puerto al host.

Verificaciones del backend:

```bash
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go test ./...
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go vet ./...
docker compose build api
```

El contrato disponible y las decisiones de seguridad de esta fase están en
[`docs/api.md`](docs/api.md) y [`docs/openapi.yaml`](docs/openapi.yaml).

## Backend implementado

- health checks de vida y disponibilidad de PostgreSQL;
- runner transaccional de migraciones SQL;
- esquema inicial normalizado para usuarios, sesiones, catálogo, CMS, órdenes y pagos;
- catálogo público que nunca expone borradores, archivados ni rutas físicas;
- CRUD administrativo de libros con archivado lógico;
- Google OIDC mediante Authorization Code, PKCE, state y nonce;
- sesiones opacas persistidas server-side y logout con revocación;
- sesión opaca y autorización server-side para todo `/api/v1/admin/*`;
- validación de origen, cuerpos JSON limitados, request IDs y logs JSON;
- pruebas unitarias de dominio, aplicación y límites HTTP.

Para habilitar login, definir juntas `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
y `GOOGLE_REDIRECT_URL`. Sin esas variables la API sigue operativa, pero la
autenticación queda cerrada explícitamente.
