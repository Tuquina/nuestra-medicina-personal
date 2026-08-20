# Despliegue de producción

Este directorio contiene el stack de producción separado del Compose de
desarrollo de la raíz. PostgreSQL no publica puertos y los eBooks se comparten
entre la API (lectura/escritura) y Nginx (sólo lectura).

## Imágenes

La imagen backend se construye desde la raíz con `backend/Dockerfile`. La imagen
web compila Vite y empaqueta el resultado con Nginx:

```bash
docker build -f backend/Dockerfile -t registry.example/nmp-backend:tag .
docker build -f deploy/nginx/Dockerfile -t registry.example/nmp-web:tag .
```

Publicar ambas imágenes desde CI; no compilarlas normalmente en el VPS.

## Configuración

Copiar `deploy/.env.example` a un archivo `.env` fuera del repositorio y completar
dominio, credenciales, imágenes y paths absolutos de los certificados TLS. Luego:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml pull
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d
```

Si se cambia `EBOOK_MAX_UPLOAD_BYTES`, ajustar también
`EBOOK_CLIENT_MAX_BODY_SIZE` para que Nginx admita el multipart completo.

Nginx redirige HTTP a HTTPS, sirve el SPA y procesa las descargas autorizadas
mediante la ubicación interna `/_protected/ebooks/`. Esa ubicación nunca es
accesible directamente desde Internet.

## Logs y diagnóstico

La API y Nginx escriben logs estructurados JSON a stdout/stderr. Las solicitudes
comparten `request_id`; la API agrega patrón de endpoint, estado, duración,
tamaño de respuesta y `user_id` después de autenticar. Los eventos de compra,
webhook y email agregan IDs de orden, pago o job, pero nunca tokens, credenciales,
destinatarios ni payloads completos.

El driver `local` de Docker rota los logs de todos los servicios. Por defecto
conserva hasta 5 archivos de 10 MiB por contenedor; `LOG_MAX_SIZE` y
`LOG_MAX_FILES` permiten ajustar ese límite. Para consultar una correlación:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs api nginx
```

Buscar el mismo `request_id` en ambos servicios permite seguir una solicitud a
través del proxy. Los health checks permanecen disponibles en `/health/live` y
`/health/ready`.

Los volúmenes `postgres_data`, `ebooks_data` y `media_data` requieren backups
externos al Netcup VPS y pruebas periódicas de restauración. Los snapshots del
proveedor son una capa adicional, no reemplazan esos backups.

## Backup y restauración

Crear primero en el host el directorio absoluto configurado como `BACKUP_PATH`.
El profile `operations` no se inicia con el stack normal. Para generar un
paquete manual, pausar brevemente API y Nginx para que PostgreSQL y los archivos
pertenezcan al mismo estado:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml stop api nginx
docker compose --env-file deploy/.env -f deploy/docker-compose.yml \
  --profile operations run --rm backup
docker compose --env-file deploy/.env -f deploy/docker-compose.yml start api nginx
```

El último comando debe ejecutarse también si el backup falla, para terminar la
ventana de mantenimiento.

El resultado `nmp-backup-*.tar.gz` contiene un dump PostgreSQL en formato custom,
los volúmenes de eBooks y media, metadata y checksums SHA-256. Se escribe primero
como archivo parcial y sólo se renombra al completar todas las piezas. El
directorio local es temporal: después debe copiarse fuera de la VPS.

`BACKUP_RETENTION_DAYS=0` no elimina archivos. Un valor mayor elimina únicamente
paquetes `nmp-backup-*.tar.gz` más antiguos dentro de `BACKUP_PATH`; activarlo
sólo después de tener una copia externa verificada.

La restauración está diseñada para recuperación ante desastre y se niega a
trabajar sobre una base con tablas o directorios con archivos. Con un stack
nuevo y vacío:

```bash
export RESTORE_ARCHIVE=nmp-backup-YYYYMMDDTHHMMSSZ-PID.tar.gz
export RESTORE_CONFIRM=restore-into-empty-targets
docker compose --env-file deploy/.env -f deploy/docker-compose.yml \
  --profile operations run --rm restore
```

El proceso valida el nombre, contenido y checksums antes de restaurar. Si falla
después de comenzar `pg_restore`, el destino puede quedar parcial: debe
descartarse el volumen vacío usado para la prueba y repetirse desde cero. Nunca
apuntar este comando a una instalación activa.

## Google Workspace y Gmail API

El backend usa OAuth 2.0 server-to-server, no SMTP ni App Passwords:

1. Crear el mailbox remitente en Google Workspace, por ejemplo
   `ventas@nuestramedicinapersonal.com`.
2. Crear un proyecto de Google Cloud, habilitar Gmail API y crear un service
   account con delegación de dominio.
3. En Admin Console de Workspace, autorizar el Client ID numérico del service
   account con el único scope
   `https://www.googleapis.com/auth/gmail.send`.
4. Descargar la credencial JSON, guardarla fuera del repositorio con permisos
   restrictivos y configurar su path host en `GOOGLE_MAIL_CREDENTIALS_FILE`.
5. Configurar `GOOGLE_MAIL_SENDER` con el usuario Workspace que será
   impersonado y `SUPPORT_EMAIL` con la dirección pública de soporte.

Compose monta la credencial read-only como
`/run/secrets/gmail-service-account.json`. La API falla al iniciar si se declara
Gmail pero la credencial no existe o no es válida. Si Gmail está temporalmente
caído, la compra permanece confirmada y `email_jobs` reintenta con backoff.

SPF, DKIM y DMARC deben configurarse con los valores vigentes entregados por
Google Workspace; no copiar registros DNS de ejemplo.
