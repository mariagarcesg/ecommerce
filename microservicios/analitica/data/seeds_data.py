"""Capa de datos: lectura de los seeds del proyecto.

Lee los archivos de datos de prueba que cada equipo comparte por git
(ver README, seccion "Seeds") y los devuelve como DataFrames de Pandas:

- auth/seeds/*.sql       -> INSERT INTO usuarios (...) VALUES (...)
- catalogo/seeds/*.json  -> arreglos JSON (colecciones products / categories)

Solo LEE archivos: no se conecta a ninguna base de datos. La carpeta donde
estan los seeds se toma de la variable de entorno SEEDS_DIR; si no existe,
se usa la carpeta microservicios/ del repositorio (ejecucion local).
"""

import json
import os
import re
from pathlib import Path

import pandas as pd

# microservicios/analitica/data/seeds_data.py -> microservicios/
_MICROSERVICIOS_DIR = Path(__file__).resolve().parents[2]

# Nombres de coleccion aceptados (el nombre del archivo sin el prefijo 01-).
_COLECCIONES_PRODUCTOS = {"products", "productos"}
_COLECCIONES_CATEGORIAS = {"categories", "categorias"}

# Columnas que nunca se cargan en el dashboard.
_COLUMNAS_SENSIBLES = {"password_hash", "password"}


def get_seeds_dir() -> Path:
    """Carpeta raiz que contiene <servicio>/seeds/."""
    return Path(os.getenv("SEEDS_DIR", _MICROSERVICIOS_DIR))


def _archivos_seed(servicio: str, extension: str) -> list[Path]:
    """Archivos de seeds de un servicio, en orden alfabetico (01-, 02-...)."""
    carpeta = get_seeds_dir() / servicio / "seeds"
    if not carpeta.is_dir():
        return []
    return sorted(carpeta.glob(f"*{extension}"))


def _nombre_coleccion(archivo: Path) -> str:
    """01-products.json -> products (misma regla que scripts/cargar-seeds.sh)."""
    return re.sub(r"^\d+-", "", archivo.stem).lower()


# ---------------------------------------------------------------------------
# Lectura de SQL (INSERT INTO ... VALUES ...)
# ---------------------------------------------------------------------------

_PATRON_INSERT = re.compile(
    r"INSERT\s+INTO\s+(?P<tabla>[\w.]+)\s*\((?P<columnas>[^)]*)\)\s*VALUES\s*(?P<valores>.*?)"
    r"(?=\bON\s+CONFLICT\b|;|\Z)",
    re.IGNORECASE | re.DOTALL,
)


def _quitar_comentarios_sql(sql: str) -> str:
    """Elimina los comentarios de linea (-- ...) fuera de las cadenas."""
    return "\n".join(
        linea for linea in sql.splitlines() if not linea.lstrip().startswith("--")
    )


def _convertir_valor_sql(valor: str):
    """Convierte un literal SQL a su tipo de Python."""
    if valor.upper() == "NULL":
        return None
    if valor.upper() in {"TRUE", "FALSE"}:
        return valor.upper() == "TRUE"
    try:
        return float(valor) if "." in valor else int(valor)
    except ValueError:
        return valor


def _parsear_tuplas(valores: str) -> list[list]:
    """Separa "(a, 'b'), (c, 'd')" en filas, respetando las comillas."""
    filas, fila, actual = [], [], ""
    en_cadena = era_cadena = False
    profundidad = 0
    i = 0
    while i < len(valores):
        c = valores[i]
        if en_cadena:
            if c == "'" and valores[i + 1 : i + 2] == "'":  # comilla escapada ''
                actual += "'"
                i += 1
            elif c == "'":
                en_cadena = False
            else:
                actual += c
        elif c == "'":
            en_cadena = era_cadena = True
            actual = ""  # descarta el espacio previo a la comilla
        elif c == "(" and profundidad == 0:
            profundidad = 1
            fila, actual, era_cadena = [], "", False
        elif c == "(":  # parentesis dentro de un valor, ej. now()
            profundidad += 1
            actual += c
        elif c == ")" and profundidad > 1:
            profundidad -= 1
            actual += c
        elif c == "," and profundidad == 1:
            fila.append(actual if era_cadena else _convertir_valor_sql(actual.strip()))
            actual, era_cadena = "", False
        elif c == ")" and profundidad == 1:
            fila.append(actual if era_cadena else _convertir_valor_sql(actual.strip()))
            filas.append(fila)
            profundidad = 0
        elif profundidad == 1:
            actual += c
        i += 1
    return filas


def _leer_inserts(archivos: list[Path], tabla: str) -> pd.DataFrame:
    """Une en un DataFrame todas las filas insertadas en `tabla`."""
    registros = []
    for archivo in archivos:
        sql = _quitar_comentarios_sql(archivo.read_text(encoding="utf-8"))
        for insert in _PATRON_INSERT.finditer(sql):
            if insert["tabla"].split(".")[-1].lower() != tabla:
                continue
            columnas = [c.strip() for c in insert["columnas"].split(",")]
            for fila in _parsear_tuplas(insert["valores"]):
                registros.append(dict(zip(columnas, fila)))

    df = pd.DataFrame(registros)
    return df.drop(columns=[c for c in df.columns if c in _COLUMNAS_SENSIBLES])


# ---------------------------------------------------------------------------
# Lectura de JSON (MongoDB)
# ---------------------------------------------------------------------------

def _normalizar_extended_json(valor):
    """{"$oid": "..."} -> "..." (formato extendido de MongoDB)."""
    if isinstance(valor, dict) and len(valor) == 1:
        clave, contenido = next(iter(valor.items()))
        if clave in {"$oid", "$date", "$numberDecimal", "$numberLong"}:
            return contenido
    return valor


def _leer_coleccion(servicio: str, nombres: set[str]) -> pd.DataFrame:
    """Une los documentos de los archivos JSON cuya coleccion esta en `nombres`."""
    documentos = []
    for archivo in _archivos_seed(servicio, ".json"):
        if _nombre_coleccion(archivo) not in nombres:
            continue
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        for doc in datos if isinstance(datos, list) else [datos]:
            documentos.append({k: _normalizar_extended_json(v) for k, v in doc.items()})
    return pd.DataFrame(documentos)


# ---------------------------------------------------------------------------
# Funciones publicas: retornan DataFrames en crudo
# ---------------------------------------------------------------------------

def get_usuarios_df() -> pd.DataFrame:
    """Usuarios del seed de auth (sin el hash de la contrasena)."""
    return _leer_inserts(_archivos_seed("auth", ".sql"), "usuarios")


def get_productos_df() -> pd.DataFrame:
    """Productos del seed de catalogo."""
    return _leer_coleccion("catalogo", _COLECCIONES_PRODUCTOS)


def get_categorias_df() -> pd.DataFrame:
    """Categorias del seed de catalogo."""
    return _leer_coleccion("catalogo", _COLECCIONES_CATEGORIAS)
