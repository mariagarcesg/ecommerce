#!/usr/bin/env bash
# Carga los seeds (datos de prueba) en las BDs de Docker.
#   ./scripts/cargar-seeds.sh             -> todos los microservicios
#   ./scripts/cargar-seeds.sh catalogo    -> solo uno
#
# - .sql  -> PostgreSQL, con el usuario del servicio (cae en su propio esquema)
# - .json -> MongoDB, en la base del servicio. La colección es el nombre del archivo
#            sin el prefijo numérico (01-productos.json -> colección "productos").
#            Debe ser un arreglo JSON; los documentos con el mismo _id se reemplazan.
# Los archivos se ejecutan en orden alfabético (usar prefijos 01-, 02-...).
set -euo pipefail
cd "$(dirname "$0")/.."

for dir in microservicios/${1:-*}/seeds; do
  [ -d "$dir" ] || continue
  servicio=$(basename "$(dirname "$dir")")
  for archivo in "$dir"/*.sql "$dir"/*.json; do
    [ -e "$archivo" ] || continue
    nombre=$(basename "$archivo")
    echo "-> $servicio: $nombre"
    case "$nombre" in
      *.sql)
        docker exec -i ecommerce-db psql -v ON_ERROR_STOP=1 -q -U "$servicio" -d ecommerce < "$archivo"
        ;;
      *.json)
        coleccion=$(echo "${nombre%.json}" | sed 's/^[0-9]*-//')
        docker exec -i ecommerce-mongo mongoimport --quiet \
          --uri "mongodb://$servicio:$servicio@localhost:27017/$servicio" \
          --collection "$coleccion" --jsonArray --mode upsert < "$archivo"
        ;;
    esac
  done
done
echo "Seeds cargados."
