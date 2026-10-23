"""Logica de negocio de analitica.

Pide los datos en crudo a la capa data (data/mock_data.py) y los
prepara/agrega para que app.py solo los dibuje. Ningun calculo ni
acceso a datos vive en la interfaz.
"""

import os

import jwt
import pandas as pd

from data import mock_data, servicios

# En proximas iteraciones: URL del microservicio de ordenes dentro de Docker
# (ver docker-compose.yml -> analitica -> ORDENES_URL).
ORDENES_URL = os.getenv("ORDENES_URL", "http://ordenes:8080")

# En proximas iteraciones: secreto compartido con auth para verificar la
# firma de los JWT (ver docker-compose.yml -> analitica -> JWT_SECRET).
JWT_SECRET = os.getenv("JWT_SECRET", "")


# ---------------------------------------------------------------------------
# Datos reales desde las APIs de auth y catalogo (None si no responden)
# ---------------------------------------------------------------------------


def obtener_cantidad_usuarios_activos() -> int | None:
    """Cantidad de usuarios registrados en auth."""
    return servicios.contar_usuarios_activos()


def obtener_cantidad_productos_registrados() -> int | None:
    """Cantidad de productos registrados en catalogo."""
    return servicios.contar_productos_registrados()


# ---------------------------------------------------------------------------
# Iteracion actual (mock data)
# ---------------------------------------------------------------------------


def obtener_total_clientes() -> int:
    """Cantidad de clientes registrados."""
    return int(len(mock_data.get_clientes_df()))


def obtener_total_compras() -> int:
    """Cantidad de compras realizadas."""
    return int(len(mock_data.get_compras_df()))


def obtener_ingresos_totales() -> float:
    """Suma de los totales de las compras completadas."""
    compras = mock_data.get_compras_df()
    completadas = compras.loc[compras["estado"] == "completada", "total"]
    return float(completadas.sum())


def obtener_clientes_por_ciudad() -> pd.DataFrame:
    """Clientes agrupados por ciudad: columnas [ciudad, clientes]."""
    clientes = mock_data.get_clientes_df()
    resumen = (
        clientes.groupby("ciudad")
        .size()
        .reset_index(name="clientes")
        .sort_values("clientes", ascending=False)
        .reset_index(drop=True)
    )
    return resumen


def obtener_compras_por_mes() -> pd.DataFrame:
    """Compras agrupadas por mes: columnas [mes, compras]."""
    compras = mock_data.get_compras_df()
    resumen = (
        compras.assign(mes=compras["fecha"].dt.to_period("M").astype(str))
        .groupby("mes")
        .size()
        .reset_index(name="compras")
        .sort_values("mes")
        .reset_index(drop=True)
    )
    return resumen


def obtener_productos_mas_vendidos(limite: int = 5) -> pd.DataFrame:
    """Unidades vendidas por producto, de mayor a menor: [producto, unidades]."""
    detalle = mock_data.get_detalle_compras_df()
    resumen = (
        detalle.groupby("producto")["cantidad"]
        .sum()
        .reset_index(name="unidades")
        .sort_values("unidades", ascending=False)
        .head(limite)
        .reset_index(drop=True)
    )
    return resumen


def obtener_dataframes_crudos() -> dict[str, pd.DataFrame]:
    """DataFrames en crudo de la capa data (solo para inspeccion en el dashboard)."""
    return {
        "clientes": mock_data.get_clientes_df(),
        "compras": mock_data.get_compras_df(),
        "detalle": mock_data.get_detalle_compras_df(),
    }


# ---------------------------------------------------------------------------
# Pendiente: proximas iteraciones
# ---------------------------------------------------------------------------

def obtener_compras_desde_api_ordenes() -> pd.DataFrame:
    """FUTURO: pedir las ventas al microservicio de ordenes por HTTP.

    Regla del README: analitica NO lee el esquema `ordenes` en PostgreSQL;
    pide los datos a su API (ej. GET {ORDENES_URL}/ventas) y guarda los
    resumenes en el esquema `analitica`.

    Aqui ira algo del estilo:
        respuesta = requests.get(f"{ORDENES_URL}/ventas", headers=...)
        respuesta.raise_for_status()
        return pd.DataFrame(respuesta.json())
    """
    pass


def validar_token_jwt(token: str) -> dict | None:
    """Valida el JWT emitido por auth antes de servir reportes.

    Cada microservicio verifica la firma con el mismo JWT_SECRET y obtiene
    id y rol del usuario sin consultar a auth. Devuelve el payload o None si
    el token es invalido o esta vencido.
    """
    if not JWT_SECRET or not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None


def obtener_reporte_ventas_guardadas() -> pd.DataFrame:
    """FUTURO: leer los resumenes propios desde PostgreSQL (esquema analitica).

    Reemplazara a mock_data al conectar la capa data con PostgreSQL usando
    las variables de entorno DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    y DB_SCHEMA (migraciones con Alembic en migrations/, datos en seeds/).
    """
    pass
