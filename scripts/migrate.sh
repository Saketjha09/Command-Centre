#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_DSN:-}" ]; then
  echo "Error: DATABASE_DSN is not set"
  exit 1
fi

echo "Starting migrations..."

for f in backend/db/migrations/*.sql; do
  echo "Running: $(basename "$f")"
  if ! psql "$DATABASE_DSN" -f "$f" > /dev/null; then
    echo "Error: Migration failed on $(basename "$f")"
    exit 1
  fi
done

echo "All migrations complete"
