#!/bin/sh
# Runs on the VPS itself, invoked over SSH by .github/workflows/deploy.yml
# (piped in via stdin — never committed as an executable entry point run
# directly). Expects GHCR_ACTOR, GHCR_TOKEN, GIT_SHA and STACK_NAME already
# exported in this shell's environment; deploy/.env.$STACK_NAME must already
# be in place (the workflow uploads it just before calling this).
set -eu

: "${GHCR_ACTOR:?}" "${GHCR_TOKEN:?}" "${GIT_SHA:?}" "${STACK_NAME:?}"

cd "$HOME/nuestra-medicina-personal"

git fetch origin
git checkout --detach "$GIT_SHA"

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_ACTOR" --password-stdin

docker compose -p "nmp-$STACK_NAME" --env-file "deploy/.env.$STACK_NAME" -f deploy/docker-compose.yml pull
docker compose -p "nmp-$STACK_NAME" --env-file "deploy/.env.$STACK_NAME" -f deploy/docker-compose.yml up -d

# Dangling layers only (superseded builds) -- never touches named volumes
# or images still tagged/in use by either stack.
docker image prune -f > /dev/null
