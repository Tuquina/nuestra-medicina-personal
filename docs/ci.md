# Integración continua y ramas

El workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) valida cada
push y pull request dirigido a `develop` o `main`. También puede ejecutarse
manualmente desde GitHub Actions.

## Responsabilidad de cada rama

- `develop` es la rama de integración. Los cambios funcionales deberían llegar
  aquí primero y superar el CI completo.
- `main` representa código candidato a producción. Integrar `develop` en `main`
  vuelve a ejecutar todos los controles, pero todavía no publica ni despliega.
- El despliegue futuro será otro workflow, limitado a `main` y al environment de
  GitHub `production`, con aprobación manual y secretos propios de la VPS.

No se define un environment remoto de desarrollo por ahora. Docker Compose es
el entorno persistente local y cada ejecución de Actions crea un entorno Linux
efímero con PostgreSQL real. Esto cubre integración sin pagar ni mantener una
segunda VPS.

## Controles automáticos

El CI ejecuta en paralelo:

1. tests unitarios, `go vet`, migraciones, integración PostgreSQL y un ciclo
   completo de backup/restauración;
2. instalación reproducible, lint y build del frontend;
3. validación de OpenAPI y de ambos archivos Compose;
4. build de las imágenes backend y web sin publicarlas.

Las credenciales usadas por PostgreSQL existen sólo durante el job. Google,
Gmail y Mercado Pago permanecen deshabilitados y no requieren secretos reales.

## Flujo recomendado

```text
rama de trabajo -> pull request a develop -> CI
develop         -> pull request a main    -> CI
main            -> CD de producción futuro
```

Mientras varios agentes compartan el mismo directorio local, no deben cambiar
la rama activa sin coordinarse. Se puede crear o actualizar la referencia remota
de `develop` sin sacar el worktree compartido de `main`; para trabajar realmente
en paralelo conviene usar worktrees separados.

## Reproducir localmente

```bash
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go test ./...
docker run --rm -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go vet ./...
docker compose up -d postgres migrate
docker run --rm --network nuestra-medicina-personal_default -e DATABASE_URL=postgres://nmp:nmp_dev_only@postgres:5432/nmp?sslmode=disable -v "$(pwd)/backend:/src" -w /src golang:1.26.5-alpine go test -tags=integration ./internal/infrastructure/postgres
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run build
docker run --rm -v "$(pwd):/src" -w /src ruby:3.4-alpine ruby scripts/validate-openapi.rb docs/openapi.yaml
docker compose config --quiet
docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml config --quiet
docker build -f backend/Dockerfile -t nmp-backend:ci .
docker build -f deploy/nginx/Dockerfile -t nmp-web:ci .
```
