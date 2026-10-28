"""Logica de negocio de analitica.

Pide los datos en crudo a la capa data (servicios.py para catalogo y auth,
mock_data.py para ventas) y los prepara/agrega para que app.py y main.py
solo los muestren. Ningun calculo ni acceso a datos vive en la interfaz.
"""

import os

import jwt
import pandas as pd

from data import mock_data, servicios

# En proximas iteraciones: URL del microservicio de ordenes dentro de Docker
# (ver docker-compose.yml -> analitica -> ORDENES_URL).
ORDENES_URL = os.getenv("ORDENES_URL", "http://ordenes:8080")

# Secreto compartido con auth para verificar la firma de los JWT
# (ver docker-compose.yml -> analitica -> JWT_SECRET).
JWT_SECRET = os.getenv("JWT_SECRET", "")


# ---------------------------------------------------------------------------
# Usuarios (API de auth; None si no responde)
# ---------------------------------------------------------------------------

def _usuarios_activos() -> pd.DataFrame | None:
    """Usuarios activos de auth: [id, nombre, email, rol].

    auth devuelve `activo` por usuario: las cuentas desactivadas por el admin
    no cuentan como activas.
    """
    usuarios = servicios.obtener_usuarios()
    if usuarios is None:
        return None
    df = pd.DataFrame(usuarios)
    if df.empty:
        return pd.DataFrame(columns=["id", "nombre", "email", "rol"])
    if "activo" in df.columns:
        df = df[df["activo"] == True]  # noqa: E712
    return df[["id", "nombre", "email", "rol"]].reset_index(drop=True)


def obtener_cantidad_usuarios_activos() -> int | None:
    """Cantidad de usuarios activos registrados en auth."""
    usuarios = _usuarios_activos()
    return None if usuarios is None else int(len(usuarios))


def obtener_cantidad_por_rol(rol: str) -> int | None:
    """Cantidad de usuarios activos con un rol (admin / cliente)."""
    usuarios = _usuarios_activos()
    return None if usuarios is None else int((usuarios["rol"] == rol).sum())


def obtener_usuarios_por_rol() -> pd.DataFrame:
    """Usuarios activos agrupados por rol: [rol, usuarios]."""
    usuarios = _usuarios_activos()
    if usuarios is None or usuarios.empty:
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
    if usuarios is None:
        return pd.DataFrame(columns=["nombre", "email", "rol"])
    return usuarios[["nombre", "email", "rol"]].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Productos (API de catalogo; None si no responde)
# ---------------------------------------------------------------------------

def _nombre_categoria(categoria) -> str | None:
    """GET /products trae la categoria poblada ({_id, name}); si no, viene el id o null."""
    if isinstance(categoria, dict):
        return categoria.get("name")
    return None


def _productos_con_categoria() -> pd.DataFrame | None:
    """Productos de catalogo con el nombre de su categoria: [producto, categoria, precio, stock]."""
    productos = servicios.obtener_productos()
    if productos is None:
        return None
    return pd.DataFrame(
        [
            {
                "producto": p.get("name"),
                "categoria": _nombre_categoria(p.get("category")) or "Sin categoría",
                "precio": p.get("price", 0),
                "stock": p.get("stock", 0),
            }
            for p in productos
        ],
        columns=["producto", "categoria", "precio", "stock"],
    )


def _fecha_creacion(object_id: str | None) -> pd.Timestamp | None:
    """Momento en que MongoDB creó el documento: los primeros 8 caracteres
    hexadecimales del _id son su timestamp en segundos."""
    try:
        return pd.Timestamp(int(str(object_id)[:8], 16), unit="s", tz="UTC")
    except (TypeError, ValueError):
        return None


def obtener_ultimo_producto_agregado() -> dict | None:
    """El producto creado más recientemente en catálogo (None si no hay o no responde).

    Los productos no guardan fecha de alta; se usa la que va dentro de su _id.
    """
    productos = servicios.obtener_productos()
    if not productos:
        return None
    con_fecha = [(p, _fecha_creacion(p.get("_id"))) for p in productos]
    con_fecha = [(p, fecha) for p, fecha in con_fecha if fecha is not None]
    if not con_fecha:
        return None
    producto, fecha = max(con_fecha, key=lambda par: par[1])
    return {
        "producto": producto.get("name"),
        "categoria": _nombre_categoria(producto.get("category")) or "Sin categoría",
        "precio": producto.get("price", 0),
        "imagen": producto.get("imagen"),
        "agregado_en": fecha.isoformat(),
    }


def obtener_producto_mas_vendido() -> dict | None:
    """Producto con más unidades vendidas según las órdenes reales (todas pagadas).

    None si ordenes no responde o aún no hay ventas. La foto y la categoría se
    toman del catálogo actual; el nombre, de la venta (por si el producto se borró).
    """
    ordenes = servicios.obtener_ordenes()
    if not ordenes:
        return None
    lineas = pd.DataFrame(
        [
            {"producto_id": d.get("productoId"), "producto": d.get("productoNombre"), "unidades": d.get("cantidad", 0)}
            for o in ordenes
            for d in o.get("detalles") or []
        ],
        columns=["producto_id", "producto", "unidades"],
    )
    if lineas.empty:
        return None
    vendidos = lineas.groupby("producto_id").agg(producto=("producto", "last"), unidades=("unidades", "sum"))
    # En empate gana el de nombre alfabéticamente primero, para que el resultado sea estable
    mejor = vendidos.reset_index().sort_values(["unidades", "producto"], ascending=[False, True]).iloc[0]

    en_catalogo = next((p for p in servicios.obtener_productos() or [] if p.get("_id") == mejor["producto_id"]), {})
    return {
        "producto": en_catalogo.get("name") or mejor["producto"],
        "unidades": int(mejor["unidades"]),
        "categoria": _nombre_categoria(en_catalogo.get("category")) or "Sin categoría",
        "imagen": en_catalogo.get("imagen"),
    }


def obtener_cantidad_productos_registrados() -> int | None:
    """Cantidad de productos registrados en catalogo."""
    productos = _productos_con_categoria()
    return None if productos is None else int(len(productos))


def obtener_cantidad_categorias() -> int:
    """Cantidad de categorias con al menos un producto."""
    productos = _productos_con_categoria()
    if productos is None:
        return 0
    return int(productos.loc[productos["categoria"] != "Sin categoría", "categoria"].nunique())


def obtener_stock_total() -> int:
    """Unidades en stock sumando todos los productos."""
    productos = _productos_con_categoria()
    return 0 if productos is None else int(productos["stock"].sum())


def obtener_productos_agotados() -> int:
    """Cantidad de productos con stock 0."""
    productos = _productos_con_categoria()
    return 0 if productos is None else int((productos["stock"] == 0).sum())


def obtener_productos_por_categoria() -> pd.DataFrame:
    """Productos registrados por categoria: [categoria, productos]."""
    productos = _productos_con_categoria()
    if productos is None or productos.empty:
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
    productos = _productos_con_categoria()
    if productos is None:
        return pd.DataFrame(columns=["producto", "stock"])
    return (
        productos[["producto", "stock"]]
        .sort_values("stock", ascending=False)
        .reset_index(drop=True)
    )


def obtener_tabla_productos() -> pd.DataFrame:
    """Listado de productos para mostrar: [producto, categoria, precio, stock]."""
    productos = _productos_con_categoria()
    if productos is None:
        return pd.DataFrame(columns=["producto", "categoria", "precio", "stock"])
    return productos.reset_index(drop=True)


def _registros(cantidad: int | None) -> str:
    if cantidad is None:
        return "no disponible"
    if cantidad == 0:
        return "sin datos"
    return f"{cantidad} registro" + ("" if cantidad == 1 else "s")


def obtener_resumen_fuentes() -> list[tuple[str, str, str]]:
    """De donde sale cada dato del dashboard: [(dato, detalle, origen)]."""
    return [
        ("Productos", _registros(obtener_cantidad_productos_registrados()), "API de catálogo"),
        ("Usuarios", _registros(obtener_cantidad_usuarios_activos()), "API de autenticación"),
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
# Autenticacion de reportes
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Pendiente: proximas iteraciones
# ---------------------------------------------------------------------------

def obtener_compras_desde_api_ordenes(token: str) -> pd.DataFrame:
    """FUTURO: pedir las ventas al microservicio de ordenes por HTTP.

    Regla del README: analitica NO lee el esquema `ordenes` en PostgreSQL;
    pide los datos a su API y guarda los resumenes en el esquema `analitica`.
    Reemplazara a mock_data. Aqui ira algo del estilo:
        respuesta = requests.get(
            f"{ORDENES_URL}/ordenes",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        respuesta.raise_for_status()
        return pd.DataFrame(respuesta.json())
    """
    pass


def guardar_resumen_ventas(resumen: pd.DataFrame) -> None:
    """FUTURO: guardar los resumenes en PostgreSQL (esquema analitica).

    Usara las variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD y
    DB_SCHEMA del docker-compose. Las tablas se crearan con Alembic en
    migrations/ y los datos de prueba iran en seeds/.
    """
    pass
