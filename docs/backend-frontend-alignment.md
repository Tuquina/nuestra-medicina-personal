# Alineación pendiente entre backend y frontend

Este documento registra adaptaciones necesarias para integrar las pantallas al
final de la construcción funcional. No modifica todavía los mocks ni las vistas.

## Backoffice de datos

La pantalla de ventas actual usa un modelo de presentación local. La adaptación
al contrato `GET /api/v1/admin/sales` debe aplicar:

| Frontend actual | API | Adaptación |
| --- | --- | --- |
| `dateISO` | `createdAt` | Renombrar al mapear. |
| `client` | `customerName` | Renombrar al mapear. |
| `email` | `customerEmail` | Renombrar al mapear. |
| `bookSlug` | `bookSlug` | Directa. |
| `status` localizado | `displayStatus` | Traducir `APPROVED`, `PENDING`, `REJECTED`, `REFUNDED`, `CANCELLED` y `EXPIRED`. |
| `mpId` | `providerPaymentId` | Admitir `null` mientras no exista pago. |
| precio buscado en libros | `amountMinorUnits` + `currency` | Eliminar el cálculo con el precio actual; la API entrega el importe histórico. |

La vista puede mostrar `orderStatus` y `paymentStatus` en el detalle operativo,
sin deducir uno a partir del otro. Los IDs de órdenes, usuarios y libros son
UUID en texto.

La pantalla de clientes debe reemplazar su `id` numérico por UUID y mapear
`displayName`, `purchasedBooks[].slug` y `lastPurchaseAt`, que puede ser `null`.
Los totales de compras e importe ya llegan agregados y no deben recalcularse con
los mocks de ventas.

El dashboard debe consumir `GET /api/v1/admin/dashboard` y dejar de calcular
KPIs, tendencia, estados y libros principales en el navegador. Los filtros de
rango y libro se envían al servidor. El endpoint devuelve todos los importes en
unidades menores y una moneda explícita.

## Revisión final

Antes de retirar los mocks conviene revisar conjuntamente rutas, estados vacíos,
errores `401/403/422`, formato monetario y campos opcionales. La pantalla de
Analytics todavía menciona un futuro endpoint propio; se debe decidir al
integrarla si reutiliza los agregados de `/admin/dashboard` o si necesita un
contrato adicional basado en requerimientos visibles de esa pantalla.

La correspondencia completa del CMS y de las pantallas públicas se revisará en
la fase final, cuando los cambios de frontend en paralelo estén estabilizados.

## Configuración y páginas editoriales

`/admin/configuracion` puede cargar y guardar su modelo actual mediante
`GET/PUT /api/v1/admin/settings`. Los badges de Google, Mercado Pago y Correo
deben leer `integrations.*.configured`; no deben continuar como constantes ni
enviarse en el `PUT`.

El backend ya admite los nueve valores actuales de `PageType` y los bloques
`collection`, `contacto`, `soporte`, el formato de página `faq` y `legal-doc`.
La integración pendiente consiste en reemplazar `contentStore.ts` por llamadas
al API conservando borrador, publicación y versiones. Las páginas públicas
deben seguir usando exclusivamente `publishedContent`.
