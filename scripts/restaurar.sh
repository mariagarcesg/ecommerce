#!/usr/bin/env bash
# Reemplaza las BDs locales de Docker con los backups de infra/.
# OJO: borra los datos locales que estén incluidos en el backup.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

if [ -f infra/db/backup.sql ]; then
  docker exec -i ecommerce-db psql -v ON_ERROR_STOP=1 -q -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-ecommerce}" < infra/db/backup.sql > /dev/null
  echo "PostgreSQL restaurado."
else
  echo "No existe infra/db/backup.sql (se omite PostgreSQL)."
fi

if [ -f infra/mongo/backup.archive ]; then
  docker exec -i ecommerce-mongo mongorestore --quiet --drop --archive \
    --uri "mongodb://${MONGO_USER:-admin}:${MONGO_PASSWORD:-admin}@localhost:27017/?authSource=admin" < infra/mongo/backup.archive
  echo "MongoDB restaurado."
else
  echo "No existe infra/mongo/backup.archive (se omite MongoDB)."
fi
