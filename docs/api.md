# API del backend

La fuente de verdad del contrato HTTP es [`openapi.yaml`](openapi.yaml). La
primera entrega implementa salud, catálogo público y administración de libros.

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

El flujo que crea usuarios y sesiones mediante Google OIDC pertenece a la
siguiente fase. Hasta entonces las rutas admin permanecen cerradas por defecto,
especialmente cuando `ADMIN_GOOGLE_SUB` no está configurado.

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
