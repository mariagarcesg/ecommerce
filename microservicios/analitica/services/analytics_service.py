"""Logica de negocio de analitica.

Pide los datos en crudo a la capa data (seeds_data.py y mock_data.py) y
los prepara/agrega para que app.py solo los dibuje. Ningun calculo ni
acceso a datos vive en la interfaz.
"""

import os

import pandas as pd

from data import mock_data, seeds_data

# URLs de los otros microservicios dentro de Docker (docker-compose).
ORDENES_URL = os.getenv("ORDENES_URL", "http://ordenes:8080")
CATALOGO_URL = os.getenv("CATALOGO_URL", "http://catalogo:3000")

# Secreto compartido con auth para verificar la firma de los JWT (.env -> JWT_SECRET).
JWT_SECRET = os.getenv("JWT_SECRET", "")


# ---------------------------------------------------------------------------
# Usuarios (seed de auth)
# ---------------------------------------------------------------------------

def _usuarios_activos() -> pd.DataFrame:
    """Usuarios activos del seed.

    La tabla usuarios de auth no tiene columna de estado: todo usuario
    registrado se considera activo. Si se agrega `activo`, se respeta.
    """
    usuarios = seeds_data.get_usuarios_df()
    if "activo" in usuarios.columns:
        usuarios = usuarios[usuarios["activo"] == True]  # noqa: E712
    return usuarios


def obtener_cantidad_usuarios_activos() -> int:
    """Cantidad de usuarios activos registrados en el seed de auth."""
    return int(len(_usuarios_activos()))


def obtener_cantidad_por_rol(rol: str) -> int:
    """Cantidad de usuarios activos con un rol (admin / cliente)."""
    usuarios = _usuarios_activos()
    return int((usuarios["rol"] == rol).sum()) if "rol" in usuarios.columns else 0


def obtener_usuarios_por_rol() -> pd.DataFrame:
    """Usuarios activos agrupados por rol: [rol, usuarios]."""
    usuarios = _usuarios_activos()
    if usuarios.empty:
        return pd.DataFrame(columns=["rol", "usuarios"])
    return (
        usuarios.groupby("rol")
        .size()
        .reset_index(name="usuarios")
        .sort_values("usuarios", ascending=False)
        .reset_index(drop=True)
    )


def obtener_tabla_usuarios() -> pd.DataFrame:
    """Listado de usuarios activos para mostrar: [nombre, email, rol]."""
    usuarios = _usuarios_activos()
    columnas = [c for c in ("nombre", "email", "rol") if c in usuarios.columns]
    return usuarios[columnas].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Productos (seed de catalogo)
# ---------------------------------------------------------------------------

def _productos_con_categoria() -> pd.DataFrame:
    """Productos del seed con el nombre de su categoria: [producto, categoria, precio, stock]."""
    productos = seeds_data.get_productos_df()
    if productos.empty:
        return pd.DataFrame(columns=["producto", "categoria", "precio", "stock"])

    categorias = seeds_data.get_categorias_df()
    if not categorias.empty and "category" in productos.columns:
        nombres = categorias.set_index("_id")["name"]
        productos = productos.assign(categoria=productos["category"].map(nombres))
    else:
        productos = productos.assign(categoria=None)

    return (
        productos.rename(columns={"name": "producto", "price": "precio"})
        .assign(categoria=lambda df: df["categoria"].fillna("Sin categoría"))
        [["producto", "categoria", "precio", "stock"]]
    )


def obtener_cantidad_productos_registrados() -> int:
    """Cantidad de productos registrados en el seed de catalogo."""
    return int(len(seeds_data.get_productos_df()))


def obtener_cantidad_categorias() -> int:
    """Cantidad de categorias registradas en el seed de catalogo."""
    return int(len(seeds_data.get_categorias_df()))


def obtener_stock_total() -> int:
    """Unidades en stock sumando todos los productos."""
    return int(_productos_con_categoria()["stock"].sum())


def obtener_productos_agotados() -> int:
    """Cantidad de productos con stock 0."""
    return int((_productos_con_categoria()["stock"] == 0).sum())


def obtener_productos_por_categoria() -> pd.DataFrame:
    """Productos registrados por categoria: [categoria, productos]."""
    productos = _productos_con_categoria()
    if productos.empty:
        return pd.DataFrame(columns=["categoria", "productos"])
    return (
        productos.groupby("categoria")
        .size()
        .reset_index(name="productos")
        .sort_values("productos", ascending=False)
        .reset_index(drop=True)
    )


def obtener_stock_por_producto() -> pd.DataFrame:
    """Stock de cada producto, de mayor a menor: [producto, stock]."""
    return (
        _productos_con_categoria()[["producto", "stock"]]
        .sort_values("stock", ascending=False)
        .reset_index(drop=True)
    )


def obtener_tabla_productos() -> pd.DataFrame:
    """Listado de productos para mostrar: [producto, categoria, precio, stock]."""
    return _productos_con_categoria().reset_index(drop=True)


def _registros(cantidad: int) -> str:
    if cantidad == 0:
        return "sin datos"
    return f"{cantidad} registro" + ("" if cantidad == 1 else "s")


def obtener_resumen_fuentes() -> list[tuple[str, str, str]]:
    """De donde sale cada dato del dashboard: [(dato, detalle, origen)]."""
    return [
        ("Productos", _registros(obtener_cantidad_productos_registrados()), "Catálogo"),
        ("Usuarios", _registros(obtener_cantidad_usuarios_activos()), "Autenticación"),
        ("Ventas", "datos de ejemplo", "simulación propia"),
    ]


# ---------------------------------------------------------------------------
# Ventas (simuladas hasta que ordenes tenga datos)
# ---------------------------------------------------------------------------

def _ventas_completadas() -> pd.DataFrame:
    """Lineas de compras completadas con su subtotal."""
    detalle = mock_data.get_detalle_compras_df()
    compras = mock_data.get_compras_df().rename(columns={"id": "compra_id"})
    ventas = detalle.merge(compras, on="compra_id")
    ventas["subtotal"] = ventas["cantidad"] * ventas["precio"]
    return ventas[ventas["estado"] == "completada"]


def obtener_total_compras() -> int:
    """Cantidad de compras realizadas (todas, sin importar el estado)."""
    return int(len(mock_data.get_compras_df()))


def obtener_ingresos_totales() -> float:
    """Suma de los subtotales de las compras completadas."""
    return float(_ventas_completadas()["subtotal"].sum())


def obtener_compras_por_estado() -> pd.DataFrame:
    """Compras agrupadas por estado: [estado, compras]."""
    return (
        mock_data.get_compras_df()
        .groupby("estado")
        .size()
        .reset_index(name="compras")
        .sort_values("compras", ascending=False)
        .reset_index(drop=True)
    )


def obtener_compras_por_mes() -> pd.DataFrame:
    """Compras realizadas por mes: [mes, compras]."""
    compras = mock_data.get_compras_df()
    return (
        compras.assign(mes=compras["fecha"].dt.strftime("%Y-%m"))
        .groupby("mes")
        .size()
        .reset_index(name="compras")
        .sort_values("mes")
        .reset_index(drop=True)
    )


def obtener_cantidad_productos_vendidos() -> int:
    """Productos distintos con al menos una venta completada (tope del ranking)."""
    return int(_ventas_completadas()["producto"].nunique())


def obtener_productos_mas_vendidos(limite: int = 5) -> pd.DataFrame:
    """Productos con mas unidades vendidas: [producto, unidades, ingresos]."""
    return (
        _ventas_completadas()
        .groupby("producto", as_index=False)
        .agg(unidades=("cantidad", "sum"), ingresos=("subtotal", "sum"))
        .sort_values(["unidades", "ingresos"], ascending=False)
        .head(limite)
        .reset_index(drop=True)
    )


# ---------------------------------------------------------------------------
# Pendiente: proximas iteraciones
# ---------------------------------------------------------------------------

def obtener_compras_desde_api_ordenes(token: str) -> pd.DataFrame:
    """FUTURO: pedir las ventas al microservicio de ordenes por HTTP.

    Regla del README: analitica NO lee el esquema `ordenes` en PostgreSQL;
    pide los datos a su API y guarda los resumenes en el esquema `analitica`.
    Reemplazara a mock_data. Aqui ira algo del estilo (agregar `requests`
    a requirements.txt):
        respuesta = requests.get(
            f"{ORDENES_URL}/ordenes",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        respuesta.raise_for_status()
        return pd.DataFrame(respuesta.json())
    """
    pass


def obtener_productos_desde_api_catalogo() -> pd.DataFrame:
    """FUTURO: pedir los productos vigentes a la API de catalogo.

    Los seeds solo traen los datos de prueba; los productos creados desde el
    panel admin viven en MongoDB y se piden por API (lectura publica):
        respuesta = requests.get(f"{CATALOGO_URL}/products", timeout=5)
        respuesta.raise_for_status()
        return pd.DataFrame(respuesta.json())
    """
    pass


def validar_token_jwt(token: str) -> dict | None:
    """FUTURO: validar el JWT emitido por auth antes de servir reportes.

    Cada microservicio verifica la firma con el mismo JWT_SECRET y obtiene
    el id y el rol del usuario sin consultar a auth. Aqui ira (agregar
    `PyJWT` a requirements.txt):
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.InvalidTokenError:
            return None
        return payload if payload.get("rol") == "admin" else None
    """
    pass


def guardar_resumen_ventas(resumen: pd.DataFrame) -> None:
    """FUTURO: guardar los resumenes en PostgreSQL (esquema analitica).

    Usara las variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD y
    DB_SCHEMA del docker-compose. Las tablas se crearan con Alembic en
    migrations/ y los datos de prueba iran en seeds/.
    """
    pass
