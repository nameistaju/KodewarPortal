#!/usr/bin/env bash
set -euo pipefail

APP_NAME="sharpkode"
DB_NAME="${DB_NAME:-sharpkode}"
MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/${DB_NAME}?replicaSet=rs0}"
UPLOAD_ROOT="${UPLOAD_ROOT:-/var/www/sharpkode/uploads}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/sharpkode}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"

mkdir -p "${DEST}"

mongodump --uri="${MONGO_URI}" --out="${DEST}/mongo"
tar -C "$(dirname "${UPLOAD_ROOT}")" -czf "${DEST}/uploads.tar.gz" "$(basename "${UPLOAD_ROOT}")"

sha256sum "${DEST}/uploads.tar.gz" > "${DEST}/uploads.tar.gz.sha256"
tar -C "${DEST}" -czf "${BACKUP_ROOT}/${APP_NAME}-${STAMP}.tar.gz" mongo uploads.tar.gz uploads.tar.gz.sha256

echo "Backup created: ${BACKUP_ROOT}/${APP_NAME}-${STAMP}.tar.gz"
