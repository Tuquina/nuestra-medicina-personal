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
