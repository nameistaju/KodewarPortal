#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/sharpkode-YYYYMMDD-HHMMSS.tar.gz" >&2
  exit 1
fi

ARCHIVE="$1"
DB_NAME="${DB_NAME:-sharpkode}"
MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/${DB_NAME}?replicaSet=rs0}"
UPLOAD_ROOT="${UPLOAD_ROOT:-/var/www/sharpkode/uploads}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

tar -xzf "${ARCHIVE}" -C "${TMP_DIR}"

mongorestore --uri="${MONGO_URI}" --drop "${TMP_DIR}/mongo/${DB_NAME}"
mkdir -p "$(dirname "${UPLOAD_ROOT}")"
tar -xzf "${TMP_DIR}/uploads.tar.gz" -C "$(dirname "${UPLOAD_ROOT}")"

echo "Restore completed from: ${ARCHIVE}"
