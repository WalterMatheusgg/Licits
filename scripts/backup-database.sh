#!/usr/bin/env bash
# Encrypted PostgreSQL backup. Does NOT back up Supabase Storage object bytes.
set -Eeuo pipefail
umask 077
: "${LICITS_DATABASE_URL:?Set LICITS_DATABASE_URL to a private connection string}"
: "${LICITS_BACKUP_AGE_RECIPIENT:?Set LICITS_BACKUP_AGE_RECIPIENT to a trusted age public key}"
for command in pg_dump pg_restore age sha256sum; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing dependency: $command" >&2; exit 2; }
done
out="${LICITS_BACKUP_DIR:-$PWD/backups}"
mkdir -p "$out"
chmod 700 "$out"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$tmp/licits-$stamp.dump"
destination="$out/licits-$stamp.dump.age"
pg_dump --no-password --format=custom --no-owner --no-privileges --file="$archive" "$LICITS_DATABASE_URL"
pg_restore --list "$archive" >/dev/null
age --encrypt --recipient "$LICITS_BACKUP_AGE_RECIPIENT" --output "$tmp/encrypted.age" "$archive"
test -s "$tmp/encrypted.age"
mv "$tmp/encrypted.age" "$destination"
(cd "$out" && sha256sum "$(basename "$destination")" > "$(basename "$destination").sha256")
if [[ -n "${LICITS_BACKUP_S3_URI:-}" ]]; then
  command -v aws >/dev/null || { echo "AWS CLI required for offsite backup" >&2; exit 2; }
  aws s3 cp --only-show-errors "$destination" "${LICITS_BACKUP_S3_URI%/}/"
  aws s3 cp --only-show-errors "$destination.sha256" "${LICITS_BACKUP_S3_URI%/}/"
fi
echo "Encrypted backup created: $destination"
echo "Warning: Supabase Storage object contents require a separate offsite backup and restore drill."
