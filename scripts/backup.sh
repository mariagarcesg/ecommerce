#!/usr/bin/env bash
# Exporta las BDs de Docker:
#   PostgreSQL (todos los esquemas) -> infra/db/backup.sql
#   MongoDB (base catalogo)         -> infra/mongo/backup.archive
# Redis no se respalda: solo guarda datos temporales (sesiones, tokens).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

docker exec ecommerce-db pg_dump -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-ecommerce}" --clean --if-exists > infra/db/backup.sql
echo "PostgreSQL -> infra/db/backup.sql"

docker exec ecommerce-mongo mongodump --quiet --archive \
  --uri "mongodb://${MONGO_USER:-admin}:${MONGO_PASSWORD:-admin}@localhost:27017/?authSource=admin" \
  --db catalogo > infra/mongo/backup.archive
echo "MongoDB    -> infra/mongo/backup.archive"
