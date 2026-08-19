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
comprueba que la sesión esté vigente y que el `google_subject` corresponda a
`ADMIN_GOOGLE_SUB`. Las operaciones de escritura también exigen un encabezado
`Origin` que coincida con `APP_BASE_URL`.

El login usa Authorization Code con PKCE, `state` y `nonce`. Google identifica
al usuario, pero la aplicación no usa el ID token como sesión: crea un token
opaco aleatorio, almacena sólo su hash y lo entrega en una cookie `HttpOnly`,
`SameSite=Lax` y `Secure` fuera del entorno de desarrollo. Logout revoca la
sesión server-side. Si las tres variables de Google no están configuradas, el
endpoint de inicio responde `AUTH_NOT_CONFIGURED` y las rutas admin permanecen
cerradas.

## Órdenes y pagos

`POST /api/v1/orders` requiere sesión y recibe un único `bookSlug`. La orden y
su item se insertan en una transacción antes de crear la preferencia de Checkout
Pro. El item conserva título, precio y moneda históricos; cambios posteriores
en el libro no alteran la venta.

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

## Biblioteca multimedia

`POST /api/v1/admin/media` acepta `multipart/form-data` y guarda únicamente
JPEG o PNG cuyo MIME declarado, firma real y decodificación coincidan. El límite
predeterminado es 10 MiB y ninguna dimensión puede superar 8000 píxeles. El
archivo físico usa un UUID; el nombre original se conserva sólo como metadata.

`GET /api/v1/media/{id}` permite probar las imágenes directamente en local y
las entrega con ETag y caché immutable. `DELETE /api/v1/admin/media/{id}` revisa
portadas, borradores, publicaciones y todas las versiones del CMS. Si encuentra
una referencia responde `MEDIA_IN_USE` y no borra ni la fila ni el archivo.

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
