#!/usr/bin/env bash
# Reemplaza la BD local de Docker con el contenido de infra/db/backup.sql
# OJO: borra los datos locales de los esquemas incluidos en el backup.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f infra/db/backup.sql ] || { echo "No existe infra/db/backup.sql"; exit 1; }
docker exec -i ecommerce-db psql -v ON_ERROR_STOP=1 -q -U admin -d ecommerce < infra/db/backup.sql > /dev/null
echo "Backup restaurado."
