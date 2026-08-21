# ADR 0005: ambiente de desarrollo desplegado, detrás de un proxy Caddy compartido

## Context

`docs/ci.md` documentaba hasta ahora que no habría un ambiente remoto de
desarrollo: "Docker Compose es el entorno persistente local y cada ejecución
de Actions crea un entorno Linux efímero con PostgreSQL real. Esto cubre
integración sin pagar ni mantener una segunda VPS." Eso alcanzaba para
integración de código, pero no para probar el flujo de compra completo contra
Mercado Pago de verdad (aunque sea en modo test) antes de exponerlo en
producción — algo que el proyecto necesita ahora, previo a la configuración
real de Google/Mercado Pago/DNS/CD.

ADR 0001 ya fijó un único Netcup VPS 500 G12 (2 vCore, 4 GB RAM, 128 GB NVMe)
para producción. La escala del proyecto (tienda personal de bajo tráfico) no
justifica una segunda VPS sólo para tener un ambiente de prueba desplegado.

El stack de producción (`deploy/docker-compose.yml`) daba por sentado que
Nginx es el único punto de entrada: publicaba `80`/`443` directamente y
montaba certificados TLS provistos manualmente. Dos stacks de ese tipo no
pueden convivir en el mismo host sin que algo arbitre esos puertos.

## Decision

Desarrollo desplegado y producción conviven en el **mismo VPS**, como dos
stacks Compose completamente aislados (`nmp-prod` / `nmp-dev`, mismo
`deploy/docker-compose.yml`, cada uno con su propio `.env`, `STACK_NAME`,
Postgres y volúmenes con nombre — mismo patrón de aislamiento por nombre de
proyecto ya probado en `e2e/fixtures/compose.ts`). Ninguno publica puertos al
host directamente.

Un tercer stack, `deploy/proxy/` (**Caddy**), es el único servicio con
`80`/`443` publicados en todo el VPS. Resuelve TLS automático (Let's Encrypt,
renovación automática, sin gestión manual de certificados) para ambos
dominios (`tudominio.com` y `dev.tudominio.com`) y reenvía a cada stack por
una red Docker externa compartida (`edge`) a la que sólo se unen Caddy y el
Nginx de cada stack — Postgres y la API de cada ambiente siguen aislados en
la red por defecto de su propio proyecto de Compose.

`nginx/default.conf.template` deja de terminar TLS y de redirigir HTTP→HTTPS
(ahora responsabilidad exclusiva de Caddy) y pasa a confiar en el
`X-Real-IP` que Caddy reenvía explícitamente, en vez de derivarlo de la
conexión TCP entrante (que ahora es siempre Caddy, no el cliente real) — sin
este cambio, el rate limiter del backend (`rate_limit.go`, que lee
`X-Real-IP`) vería todo el tráfico como proveniente del contenedor de Caddy.

Mercado Pago del lado de `nmp-dev` usa credenciales de **cuenta de prueba**
(panel de developers de Mercado Pago) — mismo código, mismo flujo real de
checkout/webhook, sin dinero real. Google OAuth usa un único Client ID con
dos "Authorized redirect URIs" (una por dominio) en vez de dos proyectos de
Google Cloud separados.

## Consequences

- `docs/ci.md` queda desactualizado en su afirmación de "no hay ambiente
  remoto de desarrollo" — corregido para referenciar esta ADR.
- Un componente nuevo (Caddy) en el VPS, pero de mínimo overhead (~15 MB de
  imagen, sin estado más allá de certificados) a cambio de eliminar la
  gestión manual de TLS que ya existía para producción.
- Los tres stacks (`nmp-prod`, `nmp-dev`, el proxy) se levantan y actualizan
  de forma independiente — un despliegue a `nmp-dev` no reinicia ni afecta a
  `nmp-prod`, y viceversa.
- El futuro CD (push a `develop` → `nmp-dev`; push a `main` → `nmp-prod`) ya
  tiene un destino real y aislado para cada rama, sin trabajo adicional de
  infraestructura.
- Backups, restauración y logs (`deploy/README.md`) ahora deben indicar
  explícitamente `-p nmp-prod`/`-p nmp-dev` y el `.env` correspondiente, ya
  que un solo `deploy/.env` implícito ya no identifica un stack sin
  ambigüedad.

## Alternatives considered

- **Segunda VPS para desarrollo**: descartado por costo/mantenimiento
  desproporcionado para la escala del proyecto (mismo razonamiento de ADR
  0001).
- **Puertos alternativos por stack sin proxy compartido** (ej.
  `dev.tudominio.com:8443`): evita agregar Caddy, pero expone el puerto en la
  URL, requiere gestión manual de un segundo certificado TLS, y no escala si
  en el futuro se agrega un tercer ambiente.
- **Certificados manuales para ambos dominios** (como ya se hacía para
  producción): descartado porque duplica el trabajo operativo manual que
  Caddy elimina automáticamente, sin ningún beneficio a cambio.
- **Dos proyectos de Google Cloud separados para OAuth**: más aislamiento,
  pero un solo Client ID con dos redirect URIs es suficiente para este caso
  (mismo desarrollador, mismo dominio raíz) y evita mantener credenciales
  duplicadas.
