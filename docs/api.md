# API del backend

La fuente de verdad del contrato HTTP es [`openapi.yaml`](openapi.yaml). La API
implementa salud, catálogo público, administración de libros y sesiones propias
iniciadas mediante Google OpenID Connect.

## Ejecutar en desarrollo

Desde la raíz:

```bash
docker compose up --build
```

Servicios locales:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8080`
- Liveness: `GET http://localhost:8080/health/live`
- Readiness: `GET http://localhost:8080/health/ready`

`migrate` aplica en orden los archivos `migrations/*.up.sql` antes de iniciar
la API y registra cada versión en `schema_migrations`.

## Autorización administrativa

Las rutas `/api/v1/admin/*` no confían en el frontend. Requieren la cookie de
sesión opaca `nmp_session`; el backend almacena solamente su hash SHA-256 y
comprueba que la sesión esté vigente y que el `email` (en minúsculas) figure
entre los valores (separados por coma) de `ADMIN_EMAILS`. Las operaciones de
escritura también exigen un encabezado `Origin` que coincida con
`APP_BASE_URL`.

El login usa Authorization Code con PKCE, `state` y `nonce`. Google identifica
al usuario, pero la aplicación no usa el ID token como sesión: crea un token
opaco aleatorio, almacena sólo su hash y lo entrega en una cookie `HttpOnly`,
`SameSite=Lax` y `Secure` fuera del entorno de desarrollo. Logout revoca la
sesión server-side. Si las tres variables de Google no están configuradas, el
endpoint de inicio responde `AUTH_NOT_CONFIGURED` y las rutas admin permanecen
cerradas.

## Órdenes y pagos

`POST /api/v1/orders` requiere sesión y recibe un `bookSlug` y, opcionalmente,
un `couponCode`. La orden y su item se insertan en una transacción antes de
crear la preferencia de Checkout Pro. El item conserva título, precio y
moneda históricos; cambios posteriores en el libro no alteran la venta.

Si se envía `couponCode`, el servidor lo busca, valida vigencia/fecha/uso
(`Coupon.EffectiveStatus`, la misma regla que usa la pantalla admin) y alcance
por libro, y calcula el descuento — nunca se confía en un monto calculado por
el cliente. El código, el monto descontado y el total ya descontado quedan
grabados en la orden como snapshot histórico (`couponCode`,
`discountMinorUnits`): si el cupón se edita o se borra después, la orden no
cambia. El incremento de `usage_count` del cupón ocurre en la misma
transacción que el insert de la orden (`UPDATE ... WHERE usage_count <
usage_limit`), así que dos checkouts simultáneos contra un cupón con límite de
uso nunca pueden sobreusarlo — el segundo recibe `422 COUPON_INVALID`.

La redirección de Checkout Pro sólo informa estado visual. Una orden pasa a
`PAID` exclusivamente cuando `/api/v1/webhooks/mercadopago` valida la firma
HMAC, reconsulta el pago por API y comprueba `external_reference`, monto y
moneda dentro de la transacción. `payments` usa `UPSERT` por proveedor e ID de
pago, por lo que repetir la notificación no duplica ventas.

La misma transacción agrega un job idempotente a `email_jobs` para pagos
aprobados, pendientes, fallidos o reembolsados. El worker envía después de
confirmar la transacción; una falla de Gmail nunca revierte el pago. Cuando un
eBook se carga por primera vez después de una compra, se agenda además
`ebook.available` para cada comprador con una orden pagada.

Para activar el módulo deben configurarse juntas:

```env
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_WEBHOOK_SECRET=...
MERCADOPAGO_PUBLIC_BASE_URL=https://tienda.example.com
```

El origen público debe ser HTTPS y no puede ser `localhost` porque se usa para
`back_urls` y `notification_url`.

## Límites HTTP y rate limiting

La API limita por ventanas de un minuto el inicio de sesión de Google por IP
(10 solicitudes), la creación de órdenes por usuario (5), las descargas por
usuario (30) y las escrituras administrativas por administrador (60). Una
respuesta limitada usa el código `RATE_LIMIT_EXCEEDED`, estado `429` y los
encabezados `Retry-After`, `X-RateLimit-Limit` y `X-RateLimit-Remaining`.

El limitador vive en memoria y tiene un número acotado de identidades, suficiente
para la única instancia prevista en la VPS. Los valores y la ventana se pueden
ajustar con las variables `RATE_LIMIT_*`. El webhook de Mercado Pago no consume
una cuota de aplicación: debe poder recibir reintentos legítimos y ya cuenta con
firma HMAC, reconsulta al proveedor e idempotencia.

La API sólo usa `X-Real-IP` cuando `TRUST_PROXY_HEADERS=true`. En producción es
seguro porque la API no publica un puerto y el Nginx incluido reemplaza ese
encabezado; al exponer la API directamente debe permanecer en `false`.

Además, se rechazan URIs mayores a 8 KiB con `414 REQUEST_URI_TOO_LONG`, los
encabezados se limitan a 32 KiB, los JSON a 1 MiB y los uploads conservan sus
límites específicos. Nginx aplica tiempos máximos de lectura, escritura y
conexión. Una variable inválida impide iniciar la API en vez de debilitar estos
límites silenciosamente.

## Errores

Todos los errores de API usan este sobre y nunca incluyen errores internos de
PostgreSQL:

```json
{
  "error": {
    "code": "BOOK_NOT_FOUND",
    "message": "Book not found",
    "details": null
  }
}
```

## Observabilidad

Cada solicitud genera un log JSON con `request_id`, método, patrón estable de
endpoint, estado, duración, bytes de respuesta y `user_id` cuando la sesión fue
autenticada. Se usa el patrón (`GET /api/v1/books/{slug}`), no el identificador
real, para evitar cardinalidad innecesaria. Los errores recuperados también se
registran con estado `500`.

La creación de órdenes, los webhooks verificados y el worker de Gmail agregan
identificadores de correlación de orden, pago, job y mensaje del proveedor. No
se registran cookies, tokens, destinatarios, credenciales ni cuerpos completos.
Nginx usa el mismo `request_id` y Docker rota los logs en producción.

## Cuenta

`DELETE /api/v1/me` requiere sesión y `Origin` válido. Es un soft-delete:
anonimiza `email`, `display_name`, `picture_url` y `google_subject`, marca
`deleted_at` y revoca todas las sesiones del usuario en la misma transacción
— no borra la fila, porque órdenes, pagos y reseñas mantienen su FK para
conservar el histórico de ventas. Un futuro login con la misma cuenta de
Google crea un usuario nuevo, ya que `google_subject` queda liberado. La
respuesta limpia la cookie de sesión, igual que `/api/v1/auth/logout`.

## Biblioteca y archivos protegidos

`GET /api/v1/me/books` requiere sesión y devuelve una sola entrada por libro
adquirido mediante una orden `PAID`. `downloadAvailable` indica si el
administrador ya cargó el archivo correspondiente.

`GET /api/v1/books/{id}/download` vuelve a comprobar en PostgreSQL que el libro
pertenece al usuario y que la orden sigue pagada. Una compra inexistente y un
archivo no disponible producen el mismo `404`, evitando revelar compras de
otros usuarios. La respuesta no contiene el archivo ni su path: entrega un
`X-Accel-Redirect` hacia `/_protected/ebooks/{storageKey}`, ubicación marcada
como `internal` en Nginx.

`PUT /api/v1/admin/books/{identifier}/ebook` requiere administrador, `Origin`
válido y un formulario `multipart/form-data` con el campo `file`. Se aceptan
únicamente PDF y EPUB con extensión, MIME y contenido coherentes. El nombre
físico es un UUID; nunca se reutiliza el nombre suministrado por el usuario.
El límite predeterminado es 50 MiB.

## CMS y versiones de páginas

`POST /api/v1/admin/pages` crea una página `HOME` o `BOOK`. El borrador se
guarda con `PUT /api/v1/admin/pages/{identifier}/draft`; esta operación nunca
modifica `published_content`, por lo que la web pública conserva la versión
anterior hasta recibir `POST .../publish`.

Cada publicación copia el borrador a una fila inmutable de `page_versions` y
actualiza la versión pública en la misma transacción. Restaurar una versión
histórica sólo la copia al borrador: requiere una publicación posterior para
hacerse visible. `GET /api/v1/pages/{slug}` devuelve exclusivamente el contenido
publicado.

El esquema inicial admite `hero`, `richText`, `imageText`, `features`, `faq`,
`cta` y `buyButton`. Cada bloque tiene propiedades cerradas; rich text usa
nodos y marcas controladas, no HTML. Los enlaces sólo aceptan rutas relativas o
URLs `http`/`https`.

Además de `HOME` y `BOOK`, el CMS admite páginas singleton
`MEDITACIONES`, `HERRAMIENTAS`, `CONTACTO`, `SOPORTE`, `FAQ`, `TERMINOS` y
`PRIVACIDAD`. Sólo `BOOK` puede y debe tener `bookId`. Las colecciones, páginas
de ayuda, FAQ y documentos legales tienen propiedades cerradas y límites
propios. Los documentos legales usan texto markdown-lite interpretado por un
renderer seguro; el backend no acepta HTML libre.

El contrato también cubre la composición real de Home (`gallery`,
`manifesto`, `featured-books`, `collection-teaser`, `about`, `newsletter` y
los bloques genéricos del editor) y el bloque estructurado `book-landing`.
Este último admite las variantes `image-text` y `benefits`, FAQ opcional y los
borradores vacíos que crea el formulario de un libro nuevo. Los colores se
restringen a tokens `var(--color-...)` o valores `oklch` literales seguros.

Un libro nuevo se guarda primero como `DRAFT`, porque su página `BOOK` necesita
el UUID persistido. La transición del libro a `PUBLISHED` requiere que esa
landing ya tenga contenido publicado; de lo contrario la API responde `409`
con `BOOK_LANDING_NOT_PUBLISHED`. Esto evita ofrecer en el catálogo un libro
cuya página de venta todavía no está disponible. Las consultas públicas de
libros aplican la misma condición, cubriendo también registros heredados que
hubieran quedado publicados antes de incorporar esta regla.

## Biblioteca multimedia

`POST /api/v1/admin/media` acepta `multipart/form-data` y guarda únicamente
JPEG o PNG cuyo MIME declarado, firma real y decodificación coincidan. El límite
predeterminado es 10 MiB y ninguna dimensión puede superar 8000 píxeles. El
archivo físico usa un UUID; el nombre original se conserva sólo como metadata.

`GET /api/v1/media/{id}` permite probar las imágenes directamente en local y
las entrega con ETag y caché immutable. `DELETE /api/v1/admin/media/{id}` revisa
portadas, borradores, publicaciones y todas las versiones del CMS. Si encuentra
una referencia responde `MEDIA_IN_USE` y no borra ni la fila ni el archivo.

## Manuscrito

`GET/PUT /api/v1/admin/books/{identifier}/manuscript` persisten los capítulos
del editor de manuscrito (`book_manuscripts`, un JSONB por libro). `GET` sobre
un libro sin manuscrito guardado responde `200` con `chapters: []`, no `404`
— "todavía no empezado" no es un error. `PUT` reemplaza el arreglo completo
(lo que envía el autosave del editor); un máximo de 200 capítulos y 8MB de
HTML por capítulo (subido de 2MB ahora que un capítulo puede llevar imágenes
embebidas en base64) evitan que un bucle de autosave descontrolado haga
crecer la fila sin límite.

Cada capítulo es `{id, title, html, kind?, titleMode?}`. `kind` clasifica qué
es la sección más allá de "un capítulo" — `COVER`/`DEDICATION`/`PROLOGUE`/
`INTRODUCTION`/`CHAPTER`/`EPILOGUE`/`ACKNOWLEDGMENTS`/`APPENDIX`/`CUSTOM`; un
valor vacío se trata como `CHAPTER` (manuscritos guardados antes de este
campo). `titleMode` (`AUTO`/`CUSTOM`) sólo le dice al editor si debe seguir
recalculando `title` automáticamente según el tipo/posición o si es texto
propio del autor — `title` ya viene resuelto como el texto final en ambos
casos, así que la exportación (EPUB/PDF) nunca necesita mirar ninguno de los
dos campos, sólo `title`. Una sección con `title` vacío no fuerza ningún
encabezado — ni "Capítulo" ni ningún otro texto — en ninguno de los dos
formatos exportados.

El manuscrito además guarda `pageSize` (`a4`/`carta`/`oficio`/`legal`/
`pocket`): el editor ya simula ese papel en pantalla (ancho, márgenes, saltos
de página) y la exportación a PDF genera exactamente esas páginas físicas, así
que es parte del manuscrito y no una preferencia local del navegador. Un valor
vacío o desconocido se resuelve a `a4` en vez de rechazar el guardado.

`PUT /api/v1/admin/books/{identifier}/manuscript/import` (`multipart/form-data`,
campo `file`) convierte un `.txt`/`.docx`/`.pdf`/`.epub` subido en secciones y
las persiste de inmediato — mismo efecto que guardar desde el editor. Con
`?mode=append` se agregan al final del manuscrito existente en vez de
reemplazarlo (el default sigue siendo `replace`). La extensión y la firma de
bytes se validan antes de intentar convertir (`PK\x03\x04` para DOCX y EPUB,
`%PDF-` para PDF); un archivo con extensión válida pero contenido corrupto
responde `422 MANUSCRIPT_CONVERSION_FAILED`, una extensión no soportada
responde `415 MANUSCRIPT_UNSUPPORTED_FORMAT`.

Un `.epub` se separa en secciones por su propio spine (la estructura que el
libro ya declara sobre sí mismo) e incrusta como data URL las imágenes que
referencia dentro del archivo. Los formatos planos se separan por los
encabezados que use el documento (`h1`, o `h2` si no hay ninguno), y el texto
del encabezado pasa a ser el título de la sección en vez de repetirse en el
cuerpo; un documento sin encabezados sigue importándose como un solo capítulo.
**Todo HTML importado se sanitiza en el servidor** antes de persistirse
(`manuscripts/sanitize.go`): el editor carga un capítulo asignándolo a
`innerHTML`, así que cualquier `<script>`/`onerror=`/`javascript:` que venga
dentro de un EPUB arbitrario se ejecutaría en el navegador del administrador
si no se filtrara ahí. Ver ADR 0004 para el alcance exacto de fidelidad.

`GET /api/v1/admin/books/{identifier}/manuscript/export?format=epub|pdf`
genera el archivo en el momento a partir de los capítulos guardados y lo
devuelve como descarga (`Content-Disposition: attachment`) — no se persiste
en ningún storage ni reemplaza el ebook vendible del libro; el administrador
lo revisa y, si le sirve, lo sube manualmente por `PUT
/api/v1/admin/books/{identifier}/ebook` (ADR 0004).

El PDF reproduce lo que el editor muestra en pantalla, no una aproximación:
usa el papel elegido (`pageSize`) con márgenes de una pulgada, el mismo
cuerpo de texto (los 17px del editor son 12,75pt físicos reales, porque CSS
define el píxel como 1/96 de pulgada fijo) y los márgenes por defecto del
navegador para cada tipo de bloque, incluido el colapso de márgenes entre
bloques adyacentes. Conserva la alineación de cada párrafo (izquierda,
centro, derecha, justificado), el formato *dentro* de un párrafo — una
palabra en negrita, en itálica, subrayada o de otro color en medio de una
oración sobrevive como su propio fragmento — y las listas con su sangría y
numeración. Se genera con una fuente TrueType embebida (antes usaba la
fuente por defecto de `gpdf`, que no declaraba su encoding y hacía que los
visores leyeran letras acentuadas como glyphs equivocados — "é"/"í" salían
como "Ø"/"Æ").

El EPUB lleva su propia hoja de estilos con esa misma tipografía, y su XHTML
se re-serializa con los elementos vacíos autocerrados (`<br />`): `go-epub`
inserta el cuerpo como innerxml sin validarlo, así que un `<br>` sin cerrar
—de cualquier salto de línea— producía un EPUB cuyo XHTML no era XML
bien formado.

Las imágenes que el editor inserta (`<figure data-wrap="..."><img
src="data:...">`) se embeben de verdad en ambos formatos — como entradas
reales del zip en EPUB, como objetos de imagen en el PDF —, pero sólo
`inline`/`center`/`left`/`right` se distinguen en el PDF; el modo "libre"
(arrastrable, delante o detrás del texto) es una capacidad de CSS que sólo
tiene sentido en el editor y en EPUB, así que en el PDF cae a centrado.

## Backoffice de datos

`GET /api/v1/admin/dashboard`, `GET /api/v1/admin/sales` y
`GET /api/v1/admin/customers` requieren autorización administrativa real en el
backend. El rango predeterminado es el año calendario actual; también se
aceptan `7d`, `30d` y `all`. Ventas y clientes admiten paginación con un máximo
de 100 filas.

Ingresos, compradores, ticket promedio y totales gastados cuentan únicamente
órdenes `PAID` y nunca mezclan monedas. Los importes son enteros en unidades
menores. Cada venta devuelve el título y monto históricos de `order_items`, no
el precio vigente del catálogo. `orderStatus`, `paymentStatus` y
`displayStatus` permanecen separados para no perder información operativa.

El listado de clientes excluye la identidad Google configurada como
administradora. Los usuarios sin compras aparecen con totales en cero; el
historial de libros incluye sólo órdenes pagadas.

## Configuración administrativa

`GET /api/v1/admin/settings` devuelve nombre y descripción del sitio, correos
editoriales, remitente y valores SEO generales. También informa si Google,
Mercado Pago y Gmail están configurados según el entorno de ejecución, sin
exponer secretos.

`PUT /api/v1/admin/settings` persiste únicamente los campos editoriales y
requiere sesión administrativa y `Origin` válido. El estado de las integraciones
es de sólo lectura: las credenciales continúan fuera de PostgreSQL y del
repositorio.

## Cupones y reseñas

`GET/POST /api/v1/admin/coupons` y `PUT/DELETE
/api/v1/admin/coupons/{id}` administran cupones persistidos. El código se
normaliza a mayúsculas, los montos fijos usan unidades menores y moneda
explícita, y la API calcula `ACTIVE`, `SCHEDULED`, `EXPIRED` o `INACTIVE` con
la fecha del servidor y el límite de usos. Un cupón puede aplicarse a todos los
libros o a UUIDs de libros concretos. `POST /api/v1/orders` acepta ese mismo
código en `couponCode` — ver [Órdenes y pagos](#órdenes-y-pagos).

`GET /api/v1/books/{slug}/reviews` publica sólo reseñas aprobadas. Para enviar
una reseña, `POST` sobre la misma ruta requiere sesión, `Origin` válido y una
orden `PAID` del usuario para ese libro. La reseña nace `PENDING` y sólo admite
una entrada por usuario y libro. El administrador lista, aprueba, rechaza o
elimina mediante `/api/v1/admin/reviews`; no existen reseñas ficticias semilla.

## Newsletter

`POST /api/v1/newsletter/subscribe` es público e idempotente por email —
crea o reactiva una fila en `marketing_subscriptions` (`ON CONFLICT (email)`).
Un usuario autenticado gestiona su propia preferencia con `GET`/`PUT
/api/v1/me/newsletter`; si más tarde se suscribe con el mismo email desde el
formulario público, la fila existente se vincula a su `user_id` en vez de
duplicarse. No hay envío de campañas todavía — sólo el consentimiento.
