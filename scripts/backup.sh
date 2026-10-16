#!/usr/bin/env bash
# Exporta toda la BD de Docker (todos los esquemas y datos) a infra/db/backup.sql
set -euo pipefail
cd "$(dirname "$0")/.."

docker exec ecommerce-db pg_dump -U admin -d ecommerce --clean --if-exists > infra/db/backup.sql
echo "Backup guardado en infra/db/backup.sql"
