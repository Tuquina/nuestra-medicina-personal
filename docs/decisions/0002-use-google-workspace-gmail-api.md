# ADR 0002: enviar emails con Google Workspace y Gmail API

## Context

La tienda necesita emails transaccionales de compra, pago, reembolso y acceso
al eBook. El volumen inicial es muy bajo, pero el envío debe usar el dominio de
la marca y una falla de correo no puede revertir una compra.

Google documenta que Gmail API recibe mensajes MIME RFC 2822 codificados como
base64URL mediante `users.messages.send`:
https://developers.google.com/workspace/gmail/api/guides/sending

Para acceso server-to-server a datos de un usuario Workspace, Google documenta
service accounts con delegación de dominio e impersonación explícita:
https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority

## Decision

Usar Google Workspace con un mailbox del dominio propio y Gmail API. La API Go
se autentica con un service account, impersona exclusivamente el mailbox
configurado y solicita sólo `https://www.googleapis.com/auth/gmail.send`.

Los eventos se guardan primero en `email_jobs` dentro de la transacción de
negocio. Un worker pequeño en el monolito reclama jobs con `SKIP LOCKED`, envía
por Gmail API y registra el ID del proveedor. Los fallos usan backoff y nunca
modifican el estado del pago.

## Consequences

- Se requiere Google Workspace, Gmail API habilitada y configuración de
  delegación por un superadministrador.
- La clave JSON debe existir sólo como secreto read-only en el VPS.
- Deben configurarse SPF, DKIM y DMARC según Google Workspace.
- Los templates HTML y texto viven versionados con el backend.
- `EmailSender` conserva el dominio desacoplado de Gmail.

## Alternatives considered

- SMTP de Gmail con App Password: descartado por el secreto de larga duración
  y el acoplamiento a SMTP.
- MTA propio en el VPS: carga operacional y de entregabilidad injustificada.
- Proveedor transaccional externo: reemplazo posible detrás de `EmailSender`,
  pero no es la decisión inicial.
