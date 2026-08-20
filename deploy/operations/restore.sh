#!/bin/sh
set -eu

umask 077

fail() {
    printf 'restore error: %s\n' "$*" >&2
    exit 1
}

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${RESTORE_ARCHIVE:?RESTORE_ARCHIVE is required}"

[ "${RESTORE_CONFIRM:-}" = "restore-into-empty-targets" ] ||
    fail "set RESTORE_CONFIRM=restore-into-empty-targets to continue"

backup_root="${BACKUP_DIR:-/backups}"
ebook_root="${EBOOK_STORAGE_PATH:-/data/ebooks}"
media_root="${MEDIA_STORAGE_PATH:-/data/media}"

case "$RESTORE_ARCHIVE" in
    */*|*\\*) fail "RESTORE_ARCHIVE must be a filename inside BACKUP_DIR" ;;
    nmp-backup-*.tar.gz) ;;
    *) fail "RESTORE_ARCHIVE does not match the expected backup filename" ;;
esac
case "$backup_root" in
    /*) ;;
    *) fail "BACKUP_DIR must be an absolute path" ;;
esac
[ "$backup_root" != "/" ] || fail "BACKUP_DIR cannot be /"

archive_path="$backup_root/$RESTORE_ARCHIVE"
[ -f "$archive_path" ] || fail "backup archive does not exist: $archive_path"
[ -d "$ebook_root" ] || fail "eBook target does not exist: $ebook_root"
[ -d "$media_root" ] || fail "media target does not exist: $media_root"
[ -z "$(find "$ebook_root" -mindepth 1 -maxdepth 1 -print -quit)" ] ||
    fail "eBook target must be empty"
[ -z "$(find "$media_root" -mindepth 1 -maxdepth 1 -print -quit)" ] ||
    fail "media target must be empty"

temporary_dir="$(mktemp -d /tmp/nmp-restore.XXXXXX)"
cleanup() {
    case "$temporary_dir" in
        /tmp/nmp-restore.*) rm -rf -- "$temporary_dir" ;;
    esac
}
trap cleanup EXIT HUP INT TERM

validate_regular_archive_entries() {
    archive="$1"
    label="$2"
    list_file="$3"
    verbose_file="$4"

    tar -tzf "$archive" > "$list_file"
    while IFS= read -r entry; do
        case "$entry" in
            /*|..|../*|*/..|*/../*) fail "$label contains an unsafe path: $entry" ;;
        esac
    done < "$list_file"

    tar -tvzf "$archive" > "$verbose_file"
    while IFS= read -r entry; do
        case "$entry" in
            d*|-*) ;;
            *) fail "$label contains a link or unsupported entry" ;;
        esac
    done < "$verbose_file"
}

validate_regular_archive_entries \
    "$archive_path" "backup package" \
    "$temporary_dir/package.list" "$temporary_dir/package.verbose"
while IFS= read -r entry; do
    case "$entry" in
        ./|database.dump|./database.dump|ebooks.tar.gz|./ebooks.tar.gz|media.tar.gz|./media.tar.gz|manifest.sha256|./manifest.sha256|metadata.txt|./metadata.txt) ;;
        *) fail "backup contains an unexpected entry: $entry" ;;
    esac
done < "$temporary_dir/package.list"

tar -xzf "$archive_path" -C "$temporary_dir"
for required_file in database.dump ebooks.tar.gz media.tar.gz metadata.txt manifest.sha256; do
    [ -f "$temporary_dir/$required_file" ] || fail "backup is missing $required_file"
done
(
    cd "$temporary_dir"
    sha256sum -c manifest.sha256
)
validate_regular_archive_entries \
    "$temporary_dir/ebooks.tar.gz" "eBook archive" \
    "$temporary_dir/ebooks.list" "$temporary_dir/ebooks.verbose"
validate_regular_archive_entries \
    "$temporary_dir/media.tar.gz" "media archive" \
    "$temporary_dir/media.list" "$temporary_dir/media.verbose"

export PGPASSWORD="$POSTGRES_PASSWORD"
export PGCONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT:-10}"
table_count="$(
    psql \
        --host "$POSTGRES_HOST" \
        --username "$POSTGRES_USER" \
        --dbname "$POSTGRES_DB" \
        --tuples-only \
        --no-align \
        --command "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';"
)"
[ "$table_count" = "0" ] || fail "database target must have no public tables"

pg_restore \
    --host "$POSTGRES_HOST" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-owner \
    --no-acl \
    --exit-on-error \
    "$temporary_dir/database.dump"

tar -xzf "$temporary_dir/ebooks.tar.gz" -C "$ebook_root"
tar -xzf "$temporary_dir/media.tar.gz" -C "$media_root"

printf 'restore completed from %s\n' "$archive_path"
