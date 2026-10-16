#!/usr/bin/env bash
# Carga los seeds (datos de prueba) en la BD de Docker.
#   ./scripts/cargar-seeds.sh             -> todos los microservicios
#   ./scripts/cargar-seeds.sh productos   -> solo uno
# Cada seed se ejecuta con el usuario del servicio, así cae en su propio esquema.
# Los archivos se ejecutan en orden alfabético (usar prefijos 01-, 02-...).
set -euo pipefail
cd "$(dirname "$0")/.."

for dir in microservicios/${1:-*}/seeds; do
  [ -d "$dir" ] || continue
  servicio=$(basename "$(dirname "$dir")")
  for archivo in "$dir"/*.sql; do
    [ -e "$archivo" ] || continue
    echo "-> $servicio: $(basename "$archivo")"
    docker exec -i ecommerce-db psql -v ON_ERROR_STOP=1 -q -U "$servicio" -d ecommerce < "$archivo"
  done
done
echo "Seeds cargados."
