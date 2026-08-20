#!/bin/sh
set -eu

umask 077

fail() {
    printf 'backup error: %s\n' "$*" >&2
    exit 1
}

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

backup_root="${BACKUP_DIR:-/backups}"
ebook_root="${EBOOK_STORAGE_PATH:-/data/ebooks}"
media_root="${MEDIA_STORAGE_PATH:-/data/media}"
retention_days="${BACKUP_RETENTION_DAYS:-0}"

case "$backup_root" in
    /*) ;;
    *) fail "BACKUP_DIR must be an absolute path" ;;
esac
[ "$backup_root" != "/" ] || fail "BACKUP_DIR cannot be /"
[ -d "$ebook_root" ] || fail "eBook directory does not exist: $ebook_root"
[ -d "$media_root" ] || fail "media directory does not exist: $media_root"
case "$retention_days" in
    *[!0-9]*|'') fail "BACKUP_RETENTION_DAYS must be a non-negative integer" ;;
esac

mkdir -p "$backup_root"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
staging_dir="$(mktemp -d "$backup_root/.nmp-backup.XXXXXX")"
partial_archive="$(mktemp "$backup_root/.nmp-backup-$backup_timestamp.partial.XXXXXX")"
partial_name="$(basename "$partial_archive")"
backup_nonce="${partial_name##*.partial.}"
backup_name="nmp-backup-$backup_timestamp-$backup_nonce"
final_archive="$backup_root/$backup_name.tar.gz"

cleanup() {
    case "$staging_dir" in
        "$backup_root"/.nmp-backup.*) rm -rf -- "$staging_dir" ;;
    esac
    case "$partial_archive" in
        "$backup_root"/.nmp-backup-*.partial.*) rm -f -- "$partial_archive" ;;
    esac
}
trap cleanup EXIT HUP INT TERM

export PGPASSWORD="$POSTGRES_PASSWORD"
export PGCONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT:-10}"

pg_dump \
    --host "$POSTGRES_HOST" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format custom \
    --no-owner \
    --no-acl \
    --file "$staging_dir/database.dump"

tar -czf "$staging_dir/ebooks.tar.gz" -C "$ebook_root" .
tar -czf "$staging_dir/media.tar.gz" -C "$media_root" .

printf '%s\n' \
    "format_version=1" \
    "created_at=$created_at" \
    "database=$POSTGRES_DB" \
    "postgres_client=$(pg_dump --version)" \
    > "$staging_dir/metadata.txt"

(
    cd "$staging_dir"
    sha256sum database.dump ebooks.tar.gz media.tar.gz metadata.txt > manifest.sha256
)

tar -czf "$partial_archive" -C "$staging_dir" .
ln "$partial_archive" "$final_archive" || fail "backup archive already exists: $final_archive"
rm -f -- "$partial_archive"
rm -rf -- "$staging_dir"
trap - EXIT HUP INT TERM

if [ "$retention_days" -gt 0 ]; then
    find "$backup_root" -maxdepth 1 -type f -name 'nmp-backup-*.tar.gz' \
        -mtime "+$retention_days" ! -name "$(basename "$final_archive")" \
        -exec rm -f -- {} \;
fi

printf '%s\n' "$final_archive"
