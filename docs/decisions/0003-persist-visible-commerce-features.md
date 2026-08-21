# ADR 0003: persistir las funcionalidades comerciales visibles

## Context

El backoffice ya expone Cupones y Reseñas, pero ambas pantallas conservaban
datos de demostración en `localStorage`. Newsletter y Analítica también deben
dejar de presentar resultados locales como si fueran operaciones reales.

El alcance del producto ya no se limita a un MVP: una funcionalidad visible en
la interfaz debe tener un contrato de API, autorización y persistencia reales.
El contenido editorial administrable, incluidos los textos legales y de ayuda,
debe continuar bajo el flujo de borrador, vista previa, publicación y versiones
del CMS.

## Decision

- Cupones y Reseñas serán recursos PostgreSQL del monolito Go.
- Los cupones almacenarán importes en unidades menores y moneda explícita. Su
  vigencia y estado efectivo se calcularán en el servidor.
- Las reseñas pertenecerán a un usuario y un libro. Sólo un comprador con una
  orden pagada podrá enviarlas; la publicación requerirá moderación.
- No se migrarán ventas, clientes, cupones ni reseñas ficticias. Los entornos
  nuevos comenzarán sin datos operativos.
- El texto editorial que debe mostrarse se sembrará como contenido CMS y nunca
  quedará duplicado como una segunda fuente editable en el frontend.
- Newsletter persistirá consentimientos en PostgreSQL; el envío de campañas es
  una capacidad separada del correo transaccional.
- Analítica consumirá exclusivamente agregados calculados desde órdenes y pagos
  persistidos.

## Consequences

- El backoffice necesita estados de carga, error y vacío reales.
- Las rutas administrativas quedan protegidas por la sesión de administrador.
- El contenido generado por usuarios no se publica automáticamente.
- Los cambios futuros de precios o cupones no pueden alterar el histórico de
  una orden; cualquier descuento aplicado deberá guardarse como snapshot.
- Los prototipos basados en `localStorage` y datasets de demostración se retiran
  al conectar cada pantalla.

## Estado

Cupones, Reseñas y Analítica: implementados. Newsletter: implementado
(`marketing_subscriptions`, migración `010`; `POST /api/v1/newsletter/subscribe`,
`GET`/`PUT /api/v1/me/newsletter`) — el formulario público y el switch de Mi
Cuenta ya no son locales.

