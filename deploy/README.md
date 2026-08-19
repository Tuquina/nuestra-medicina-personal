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

Los volúmenes `postgres_data` y `ebooks_data` requieren backups externos al
Netcup VPS y pruebas periódicas de restauración. Los snapshots del proveedor
son una capa adicional, no reemplazan esos backups.
