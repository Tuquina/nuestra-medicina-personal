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
docker compose build api migrate
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
- órdenes con precio histórico y Checkout Pro de Mercado Pago;
- webhook HMAC que reconsulta y valida pago, monto, moneda y referencia;
- persistencia idempotente de pagos separada de las órdenes;
- biblioteca del comprador derivada exclusivamente de órdenes pagadas;
- carga administrativa validada de PDF/EPUB en almacenamiento privado;
- descarga autorizada mediante `X-Accel-Redirect`, sin revelar paths físicos;
- outbox transaccional e idempotente para eventos de pago y disponibilidad;
- worker con reintentos exponenciales y envío por Gmail API/Google Workspace;
- CMS con borradores aislados, publicación transaccional e historial de versiones;
- biblioteca multimedia local con validación JPEG/PNG y borrado seguro;
- dashboard, ventas y clientes administrativos con importes históricos y paginación;
- validación de origen, cuerpos JSON limitados, request IDs y logs JSON;
- pruebas unitarias de dominio, aplicación y límites HTTP.

Para habilitar login, definir juntas `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
y `GOOGLE_REDIRECT_URL`. Sin esas variables la API sigue operativa, pero la
autenticación queda cerrada explícitamente.

Para habilitar cobros, definir juntas `MERCADOPAGO_ACCESS_TOKEN`,
`MERCADOPAGO_WEBHOOK_SECRET` y `MERCADOPAGO_PUBLIC_BASE_URL`. Esta última debe
ser un origen HTTPS público; Mercado Pago no admite `localhost` en las URLs de
retorno de Checkout Pro.

Los eBooks se almacenan en el volumen privado `ebooks_data`. El límite por
defecto es 50 MiB y puede ajustarse con `EBOOK_MAX_UPLOAD_BYTES` dentro del
rango de 1 a 200 MiB. La API de desarrollo autoriza la descarga y devuelve
`X-Accel-Redirect`; el streaming real se realiza con el Nginx definido en
[`deploy/`](deploy/).

La configuración de producción, las imágenes esperadas y los certificados TLS
están documentados en [`deploy/README.md`](deploy/README.md).

El worker de email queda deshabilitado en desarrollo mientras
`GOOGLE_MAIL_CREDENTIALS_PATH` y `GOOGLE_MAIL_SENDER` estén vacíos. Los jobs se
persisten igualmente y pueden enviarse cuando se configure Gmail API.
