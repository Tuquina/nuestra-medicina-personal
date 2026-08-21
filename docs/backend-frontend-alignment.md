# Contratos finales entre backend y frontend

Este documento registra la revisión y ejecución de la integración de contratos.
La fuente de verdad HTTP es [`openapi.yaml`](openapi.yaml); este archivo define
los adaptadores de presentación y las funciones que quedan fuera del MVP.

## Reglas transversales

- La API usa objetos de lista `{ items, total }`; el frontend no debe asumir un
  array en la raíz.
- Los IDs son UUID en texto. Los slugs sólo sustituyen al ID donde el parámetro
  se documenta como `identifier`.
- Todo importe usa unidades menores enteras y una moneda explícita. Nunca se
  recalcula una venta histórica con el precio actual del libro.
- Las fechas llegan en ISO 8601 y se localizan únicamente al presentar.
- Los errores usan `{ error: { code, message, details } }`. La UI decide por
  `error.code`, no por textos en inglés.
- Las escrituras autenticadas son same-origin y deben enviar cookies. El
  navegador agrega `Origin`; cualquier cliente no navegador debe hacerlo de
  forma explícita.
- `401` significa sesión ausente o vencida; `403`, sesión sin privilegios;
  `409`, conflicto de estado o referencia; `422`, datos válidos como JSON pero
  inválidos para el dominio; `429`, cuota agotada.

## Matriz de integración

| Área | Endpoint | Adaptación final |
| --- | --- | --- |
| Sesión | `GET /api/v1/me` | Ya coincide con `AuthUser`. No existe `/api/v1/auth/me`. |
| Catálogo | `GET /api/v1/books` | Leer `items`; usar `updatedAt` en lugar de `updatedAtISO` y `coverMediaId` para construir `/api/v1/media/{id}`. |
| Detalle | `GET /api/v1/books/{slug}` | Consumir el DTO completo; nunca usar `BOOKS` para decidir si el libro está publicado. |
| Checkout | `POST /api/v1/orders` | Enviar sólo `{ bookSlug }`, conservar `id` y navegar a `checkoutUrl`. |
| Resultado | `GET /api/v1/orders/{id}` | Es la única fuente de estado de la orden después del redirect. El query `status` de Mercado Pago nunca confirma un pago. |
| Biblioteca | `GET /api/v1/me/books` | Renderizar directamente `items`; localizar `purchasedAt` y descargar con el `id` UUID, no con el slug. |
| Libros admin | `GET /api/v1/admin/books` | Leer `items`, incluido borrador y archivado. |
| Crear libro | `POST /api/v1/admin/books` | El body es `BookInput`; nunca enviar `priceDisplay` ni usar `/books/nuevo`. |
| Editar libro | `PUT /api/v1/admin/books/{identifier}` | Es reemplazo completo, no `PATCH`; conservar campos que la pestaña actual no edita (`coverMediaId`, `fileSizeBytes`, etc.). |
| Archivar libro | `DELETE /api/v1/admin/books/{identifier}` | No enviar un `PUT` parcial con sólo `{ status }`. |
| eBook | `PUT /api/v1/admin/books/{identifier}/ebook` | `multipart/form-data`, un único campo `file`; la respuesta actualiza metadata del archivo. |
| Dashboard | `GET /api/v1/admin/dashboard` | Enviar `range`, `bookSlug` y `currency`; usar todos los agregados del servidor. |
| Ventas | `GET /api/v1/admin/sales` | Enviar filtros y paginación; aplicar el mapeo detallado debajo. |
| Clientes | `GET /api/v1/admin/customers` | Usar UUID, agregados y `purchasedBooks`; no derivarlos de ventas del navegador. |
| Configuración | `GET/PUT /api/v1/admin/settings` | Cargar antes de editar; enviar sólo campos editoriales. `integrations` y `updatedAt` son de sólo lectura. |
| CMS público | `GET /api/v1/pages/{slug}` | Renderizar únicamente `content`, que siempre es la publicación vigente. |
| CMS admin | rutas `/api/v1/admin/pages/*` | Adaptar `draftContent` y `publishedContent`; restaurar una versión no publica automáticamente. |
| Multimedia | `GET/POST/DELETE /api/v1/admin/media` | UUID, `originalFilename`, bytes, dimensiones y `url`; upload como un único campo `file`. |

## Checkout y confianza del estado

La respuesta de creación incluye la orden completa y `checkoutUrl`. Antes de
salir hacia Mercado Pago, el frontend debe conservar `order.id` en estado
durable de la pestaña. Al regresar, debe consultar `GET /api/v1/orders/{id}` y
mapear el estado autoritativo:

| Orden | Pantalla |
| --- | --- |
| `PAID` | aprobado |
| `PENDING` | pendiente o verificando |
| `CANCELLED`, `EXPIRED` | fallido |

`status=approved` en una URL de retorno sólo puede seleccionar una presentación
provisional. No habilita biblioteca, descarga ni un mensaje definitivo de pago.

## Libros y archivos

El formulario actual mezcla estado de presentación con el DTO. En la
integración se debe construir `BookInput` campo por campo: `priceDisplay` se
convierte a `priceMinorUnits` y no se envía; `updatedAtISO` no existe en la API;
portada y eBook se cargan por sus endpoints separados. Una edición debe partir
del DTO administrativo leído al servidor para no borrar metadata que la vista
no muestra.

Un libro nuevo se crea como borrador. El backend sólo permite pasarlo a
`PUBLISHED` cuando su página `BOOK` ya tiene una publicación; si falta responde
`BOOK_LANDING_NOT_PUBLISHED`. La pestaña de página de venta trabaja con el slug
y título persistidos para que cambios todavía no guardados en Información no
creen ni consulten una página bajo una identidad incorrecta. Las consultas
públicas excluyen además cualquier registro heredado que estuviera marcado
como publicado pero no tenga landing publicada.

## Backoffice de datos

La pantalla de ventas aplica:

| Frontend actual | API |
| --- | --- |
| `dateISO` | `createdAt` |
| `client` | `customerName` |
| `email` | `customerEmail` |
| `status` localizado | `displayStatus` |
| `mpId` | `providerPaymentId`, que puede ser `null` |
| precio buscado en libros | `amountMinorUnits` + `currency` históricos |

`orderStatus`, `paymentStatus` y `displayStatus` se mantienen separados. La
pantalla de clientes usa `displayName`, `purchasedBooks[].slug` y
`lastPurchaseAt`, que puede ser `null`.

Analytics reutilizará `GET /api/v1/admin/dashboard`: `trend`, `topBooks` y
`paymentStatuses` cubren sus gráficos. No se añadirá un endpoint duplicado para
el volumen previsto de esta tienda.

## CMS y páginas editoriales

El backend y frontend coinciden en los nueve `PageType`, `schemaVersion: 1` y
los bloques actuales. El adaptador HTTP incorpora del DTO administrativo
`id`, `title`, `createdAt`, `updatedAt` y los `null` explícitos. Para páginas
conocidas se obtiene por slug; sólo un `404` habilita su creación. Un `409`
durante esa creación vuelve a leer la página para tolerar solicitudes
concurrentes; cualquier otro error bloquea el editor sin intentar publicar.

Las páginas públicas consultan exclusivamente `GET /api/v1/pages/{slug}`. La
vista previa explícita usa la sesión administrativa y lee `draftContent`; antes
de abrirla se persiste el borrador actual. Publicar guarda primero ese borrador
y luego crea la versión. Restaurar una versión reemplaza únicamente el
borrador y requiere una publicación posterior.

La migración editorial inicial preserva el contenido que antes acompañaba al
frontend: crea publicaciones para los ocho singleton únicamente cuando no
existen y agrega las landings conocidas sólo si sus libros ya están en la base.
Nunca reemplaza una página o borrador administrativo existente.

Home y las páginas de libro comparten las propiedades actuales. El `slug`
dentro de `book-landing.props` es compatibilidad temporal; el slug canónico
pertenece a `Page`.

Al cambiar el slug o título de un libro, el repositorio actualiza en la misma
sentencia su página `BOOK` asociada. Así la ruta pública y el CMS no quedan
desalineados, y un conflicto con otro slug se expone como el mismo conflicto de
dominio del libro.

## Multimedia

`MediaAsset` no tiene categoría, texto alternativo ni descripción de uso. La
descripción accesible pertenece al bloque o portada que utiliza la imagen,
porque una misma imagen puede necesitar textos distintos según el contexto.
La vista no debe persistir `altText` en el asset.

El backend ya impide borrar archivos referenciados y responde `MEDIA_IN_USE`.
La UI debe mostrar ese error; no necesita precalcular `usedIn` ni crear otro
contrato antes de tener un requerimiento real para listar referencias.

## Funciones visibles y persistencia

- Cupones y reseñas son recursos PostgreSQL confirmados en ADR 0003. Sus
  pantallas administrativas consumen las APIs reales y no usan `localStorage`.
- Las reseñas requieren una compra pagada, comienzan pendientes y sólo se
  muestran públicamente después de ser aprobadas.
- Newsletter es marketing, no email transaccional. Debe persistir el
  consentimiento antes de habilitar el formulario; la selección de un proveedor
  para campañas puede hacerse después sin fingir un alta exitosa.
- Eliminación de cuenta se gestiona por soporte hasta definir anonimización y
  retención legal de compras; no se inventará `DELETE /api/v1/me`.
- Ninguna pantalla visible puede aparentar persistencia exitosa mediante datos
  locales o mensajes de demostración.

## Orden de integración posterior

1. ✅ sesión, catálogo y biblioteca;
2. ✅ checkout con verificación de orden;
3. ✅ libros, eBook y multimedia administrativos;
4. ✅ dashboard, ventas, clientes y configuración;
5. ✅ CMS público, borrador, publicación, vista previa y versiones;
6. ✅ persistencia y moderación de cupones y reseñas;
7. **Siguiente:** newsletter, analítica y mensajes de demostración restantes;
8. revisar estados vacíos y errores `401/403/409/422/429` en cada pantalla.
