# Salida a producción — guía paso a paso

Checklist para publicar **https://nuestramedicinapersonal.com.ar** con cobros
reales. Seguir los pasos en orden: cada uno dice qué hacer, dónde y cómo
comprobar que quedó bien.

Diagramas (abrir en https://excalidraw.com → menú → *Open*):

- [`diagrams/infraestructura.excalidraw`](diagrams/infraestructura.excalidraw): qué corre dónde.
- [`diagrams/deploy-pipeline.excalidraw`](diagrams/deploy-pipeline.excalidraw): de un PR a DEV y a PROD.
- [`diagrams/flujo-de-compra.excalidraw`](diagrams/flujo-de-compra.excalidraw): checkout, webhook y biblioteca.
- [`diagrams/go-live-checklist.excalidraw`](diagrams/go-live-checklist.excalidraw): esta guía en un vistazo.

## Dónde estamos (4 de noviembre de 2026)

| Pieza | Estado |
|---|---|
| VPS, usuario `deploy`, red `edge`, proxy Caddy | ✅ Listo (Caddy ya sirve el certificado de prod) |
| DNS `nuestramedicinapersonal.com.ar` y `dev.…` | ✅ Apuntan al VPS |
| DNS `www.nuestramedicinapersonal.com.ar` | ❌ No existe (opcional) |
| Ambiente DEV | ✅ Funcionando, Mercado Pago en modo prueba |
| Ambiente PROD | ❌ Responde 502: nunca se desplegó |
| Rama `main` | ❌ Atrasada: no tiene `deploy-prod.yml` ni nada desde el 20/08 |
| Mercado Pago en PROD | ❌ Faltan credenciales y webhook |
| Gmail (emails de compra) | ❌ No configurado en ningún ambiente (opcional para lanzar) |
| Repositorio | ✅ Público (necesario para los deploys: ver paso 0) |

---

## Paso 0 — Mantener el repositorio público ✅

**Resuelto el 4/11/2026.** Queda documentado porque el repo **no debe volver a
ser privado** sin preparar antes estas dos cosas:

1. **GitHub Free no da Environments en repos privados.** GitHub lo documenta
   así: al pasar un repo a privado, *"any configured protection rules or
   environment secrets will be ignored"*. Los deploys armarían el `.env` del
   servidor sin secrets y se perdería la aprobación manual de producción.
   Además, GitHub **borra la protección de ramas** de `develop` y `main` y
   no la restaura al volver a público: hay que crearla de nuevo.
2. **El VPS clona el repo por HTTPS sin credenciales.** `deploy.sh` hace
   `git fetch` en el VPS; con el repo privado falla con *"could not read
   Username for 'https://github.com'"* y el deploy se corta.

Si algún día se quiere privado: **GitHub Pro** (USD 4/mes) devuelve los
secrets de los Environments y la protección de ramas, pero **no** la
aprobación manual de producción: los *required reviewers* en repos privados
sólo existen en GitHub Enterprise. Con Pro, un push a `main` desplegaría
directo, así que habría que agregar otra traba (por ejemplo, que
`deploy-prod.yml` sólo corra a mano con *workflow_dispatch*). También hay que
agregar una *deploy key* de sólo lectura en el VPS (cambiando el remoto a SSH)
y volver a crear la protección de ramas.

El código no contiene secretos (se revisó todo el historial de git): viven en
los Environments de GitHub y en el VPS.

**Comprobar:** Actions → *Deploy · development* → *Run workflow* sobre
`develop`. Debe terminar en verde y
https://dev.nuestramedicinapersonal.com.ar/health/ready debe responder
`{"status":"ok"}`.

---

## Paso 1 — Compra de prueba completa en DEV

Antes de cobrar de verdad, confirmar que el circuito entero funciona en modo
prueba.

1. Mercado Pago Developers → Tus integraciones → la aplicación →
   **Credenciales de prueba**: el *Access Token* empieza con `TEST-` y es el
   mismo que está en el secret `MERCADOPAGO_ACCESS_TOKEN` del Environment
   `development`.
2. Misma aplicación → **Webhooks** → *Configurar notificaciones* → pestaña
   **Modo de prueba**:
   - URL: `https://dev.nuestramedicinapersonal.com.ar/api/v1/webhooks/mercadopago`
   - Evento: **Pagos**
   - La **clave secreta** que muestra el panel debe ser igual al secret
     `MERCADOPAGO_WEBHOOK_SECRET` de `development`.
3. Si cambiaste algún secret, correr *Deploy · development* a mano.
4. En una ventana de incógnito, sin tu cuenta real de Mercado Pago iniciada:
   1. entrar a https://dev.nuestramedicinapersonal.com.ar y loguearte con Google;
   2. elegir un libro → Comprar;
   3. pagar con una tarjeta de prueba de Mercado Pago, con titular `APRO`. Si
      pide login, usar un usuario **comprador** de prueba (Tus integraciones →
      Cuentas de prueba).
5. **Comprobar:** al volver al sitio dice "¡Tu compra fue confirmada!", el
   libro aparece en `/biblioteca` y se descarga. En `/admin/ventas` figura la
   venta.

Si la orden queda en *pendiente*, ver los logs de la API en DEV (sección
[Diagnóstico](#diagnóstico)).

---

## Paso 2 — Credenciales de producción de Mercado Pago

> **Importante:** la aplicación de Mercado Pago debe estar creada en la
> **cuenta de Mercado Pago que va a recibir el dinero** (la cuenta de la
> tienda). Si la aplicación está en otra cuenta, los cobros van a esa otra
> cuenta.

1. Entrar a https://www.mercadopago.com.ar/developers/panel/app con la cuenta
   que cobra.
2. Elegir la aplicación (o crear una: *Pagos online* → *Checkout Pro*).
3. **Credenciales de producción** → *Activar credenciales*: completar
   industria y sitio web (`https://nuestramedicinapersonal.com.ar`) y aceptar
   los términos.
4. Copiar el **Access Token** de producción (empieza con `APP_USR-`). Ese es el
   valor de `MERCADOPAGO_ACCESS_TOKEN` para `production`.
5. **Webhooks** → *Configurar notificaciones* → pestaña **Modo productivo**:
   - URL: `https://nuestramedicinapersonal.com.ar/api/v1/webhooks/mercadopago`
   - Evento: **Pagos**
   - Guardar y copiar la **clave secreta**. Ese es el valor de
     `MERCADOPAGO_WEBHOOK_SECRET` para `production`.

Nunca pegar estos valores en el repo, en issues ni en chats: sólo en GitHub
(paso 3).

---

## Paso 3 — Cargar variables y secrets de `production`

Dónde: GitHub → repo → **Settings → Environments → `production`**. Ahí hay dos
listas: *Environment secrets* (valores ocultos) y *Environment variables*
(visibles).

### Lo que falta cargar

| Nombre | Tipo | Valor |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Secret | Access Token de **producción** (`APP_USR-…`), del paso 2.4 |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret | Clave secreta del webhook en *Modo productivo*, del paso 2.5 |
| `MERCADOPAGO_PUBLIC_BASE_URL` | Variable | `https://nuestramedicinapersonal.com.ar` |

Las tres van juntas: si falta una, la API no arranca (`config.go` exige las
tres o ninguna). Sin las tres, el sitio funciona pero el checkout responde
"pagos no configurados".

Desde la terminal (pide el valor sin mostrarlo):

```bash
gh secret set MERCADOPAGO_ACCESS_TOKEN --env production
```

```bash
gh secret set MERCADOPAGO_WEBHOOK_SECRET --env production
```

```bash
gh variable set MERCADOPAGO_PUBLIC_BASE_URL --env production --body "https://nuestramedicinapersonal.com.ar"
```

### Lo que ya está cargado (revisar que sea correcto)

| Nombre | Tipo | Valor esperado |
|---|---|---|
| `APP_DOMAIN` | Variable | `nuestramedicinapersonal.com.ar` (sin `https://`) |
| `ADMIN_EMAILS` | Variable | Emails de Google con acceso a `/admin`, separados por coma |
| `GOOGLE_CLIENT_ID` | Variable | El mismo Client ID que DEV |
| `SUPPORT_EMAIL` | Variable | Email de soporte que se muestra a los clientes |
| `BACKUP_PATH` | Variable | `/home/deploy/backups-prod` |
| `POSTGRES_PASSWORD` | Secret | Generado con `openssl rand -hex 24`. **No cambiarlo** después del primer deploy: la base queda creada con esa contraseña |
| `GOOGLE_CLIENT_SECRET` | Secret | Client Secret de Google Cloud |

### Opcionales (se pueden dejar vacíos para lanzar)

| Nombre | Tipo | Para qué |
|---|---|---|
| `GOOGLE_MAIL_SENDER` | Variable | Buzón de Google Workspace que envía los emails (paso 8) |
| `GOOGLE_MAIL_CREDENTIALS_JSON` | Secret | JSON de la service account de Gmail (paso 8) |

Van juntos: los dos vacíos o los dos cargados.

### A nivel repositorio (ya cargados, comunes a los dos ambientes)

Settings → Secrets and variables → Actions:

| Nombre | Tipo | Qué es |
|---|---|---|
| `DEPLOY_SSH_KEY` | Secret | Clave privada del usuario `deploy` del VPS |
| `DEPLOY_HOST` | Variable | IP pública del VPS |
| `DEPLOY_USER` | Variable | `deploy` |

### Aprobación manual del deploy

Settings → Environments → `production` → **Required reviewers**: ya está
configurado con `Tuquina`. Un push a `main` queda en pausa hasta que lo
apruebes desde Actions (*Review deployments*).

---

## Paso 4 — Google: login en producción

En https://console.cloud.google.com/apis/credentials → el *OAuth 2.0 Client
ID* que usa el proyecto:

1. **Authorized redirect URIs** debe tener las dos:
   - `https://nuestramedicinapersonal.com.ar/api/v1/auth/google/callback`
   - `https://dev.nuestramedicinapersonal.com.ar/api/v1/auth/google/callback`
2. **Authorized JavaScript origins** (si aparece): los dos dominios con `https://`.
3. **OAuth consent screen** (Google Auth Platform → Audience): si dice
   *Testing*, sólo pueden loguearse los *test users* cargados. Pasarlo a
   **In production** (*Publish app*). Para los scopes que usa el sitio (email y
   perfil) Google no exige verificación.
4. En *Branding*, completar nombre de la app, logo, email de soporte y los
   links a `https://nuestramedicinapersonal.com.ar/privacidad` y `/terminos`.

---

## Paso 5 — Publicar: PR de `develop` a `main`

1. En GitHub: *Pull requests* → *New* → base **`main`** ← compare **`develop`**.
   Título sugerido: `release: primera versión en producción`.
2. Esperar el CI en verde.
3. Mergear con **Squash and merge**: queda un solo commit de release en
   `main`. `main` es un ancestro de `develop`, así que no hay conflictos. En
   los releases siguientes el PR puede listar commits y archivos que ya
   estaban publicados (los commits de release de `main` no existen en
   `develop`). Es normal: lo que termina en `main` es el contenido de `develop`.
4. El push a `main` dispara **Deploy · production** (Actions). Si configuraste
   *Required reviewers*, entrar al run → *Review deployments* → aprobar.
5. El primer deploy crea la base de prod vacía y corre todas las migraciones.

---

## Paso 6 — Verificar producción

| Qué | Cómo | Esperado |
|---|---|---|
| API | https://nuestramedicinapersonal.com.ar/health/ready | `{"status":"ok"}` |
| Sitio | https://nuestramedicinapersonal.com.ar | Carga el inicio |
| Login | https://nuestramedicinapersonal.com.ar/login | Entra con Google y vuelve logueado |
| Admin | https://nuestramedicinapersonal.com.ar/admin | Dashboard (sólo con un email de `ADMIN_EMAILS`) |
| Integraciones | `/admin/configuracion` | Google y Mercado Pago figuran configurados |
| Webhook | Mercado Pago → Webhooks → *Simular notificación* (modo productivo) | Llega (el pago simulado no existe, así que la orden no cambia: es esperable) |
| Cobro real | Publicar un libro de prueba a precio mínimo, comprarlo con una tarjeta real, verificar `/biblioteca` | Compra confirmada y descarga OK; después reembolsar desde Mercado Pago y archivar el libro |

---

## Paso 7 — Cargar el contenido real

Desde `/admin` en producción (la base de prod arranca vacía; lo cargado en DEV
no se copia):

1. **Libros** → *Nuevo*: título, precio, portada, archivo PDF/EPUB, landing.
   Un libro sólo se puede publicar con su landing publicada.
2. **Páginas**: Inicio, Meditaciones, Herramientas, Sobre el proyecto.
3. **Legales**: Términos y Privacidad (los pide Mercado Pago y Google).
4. **Ayuda**: Contacto, Soporte, Preguntas frecuentes.
5. **Configuración**: datos editoriales.

---

## Paso 8 — Después del lanzamiento (recomendado)

### Emails de compra (Gmail API)

Hoy no se envía ningún email. Los emails (confirmación, pago pendiente,
reembolso) quedan guardados en la base y se envían solos cuando se
configure. Requiere **Google Workspace** (pago) con un buzón del dominio (p.
ej. `ventas@nuestramedicinapersonal.com.ar`); una cuenta `@gmail.com` común
no sirve para esto.

1. Crear el buzón en Workspace.
2. En Google Cloud: habilitar *Gmail API*, crear una *service account* y
   descargar su JSON.
3. En Workspace Admin → Seguridad → Controles de API → *Delegación de todo el
   dominio*: autorizar el Client ID numérico de la service account con el
   scope `https://www.googleapis.com/auth/gmail.send`.
4. En el Environment de GitHub: `GOOGLE_MAIL_SENDER` (variable) = el buzón, y
   `GOOGLE_MAIL_CREDENTIALS_JSON` (secret) = el contenido completo del JSON.
5. Configurar SPF, DKIM y DMARC del dominio con los valores que da Workspace.
6. Volver a desplegar.

Detalle en [`deploy/README.md`](../deploy/README.md#google-workspace-y-gmail-api).

### `www`

Crear un registro DNS `A` para `www` con la IP del VPS y agregar al
`deploy/proxy/Caddyfile` del VPS:

```text
www.{$PROD_DOMAIN} {
	redir https://{$PROD_DOMAIN}{uri} permanent
}
```

Luego reiniciar el proxy (`docker compose … -f deploy/proxy/docker-compose.yml up -d`).

### Backups

El backup de prod existe pero hay que programarlo y copiarlo **fuera** del VPS
(ver [`deploy/README.md`](../deploy/README.md#backup-y-restauración)). Hasta
entonces dejar `BACKUP_RETENTION_DAYS=0`.

---

## Diagnóstico

Logs de la API en el VPS (entrar por SSH con tu usuario):

```bash
cd /home/deploy/nuestra-medicina-personal
docker compose -p nmp-prod --env-file deploy/.env.prod -f deploy/docker-compose.yml logs -f api
```

(`nmp-dev` / `deploy/.env.dev` para DEV.)

| Mensaje en el log | Significa |
|---|---|
| `mercado pago webhook processed` | La notificación llegó y se aplicó |
| `mercado pago webhook signature rejected` | `MERCADOPAGO_WEBHOOK_SECRET` no coincide con la clave del panel |
| `verified payment does not match a local order` | Pago de otra orden o ambiente (normal con la simulación del panel) |
| `PAYMENTS_NOT_CONFIGURED` en el checkout | Falta alguna de las 3 variables de Mercado Pago |
| La API no arranca: `… must be configured together` | Mercado Pago o Gmail cargados a medias |
