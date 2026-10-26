"""Punto de entrada del dashboard de analitica (Streamlit).

Solo importa la capa de servicios y dibuja la interfaz. La logica de negocio
vive en services/analytics_service.py, los datos en data/ (APIs de catalogo
y auth, ventas simuladas) y los estilos y graficas (Plotly) en ui/.
"""

from html import escape

import streamlit as st

from services import analytics_service
from ui import componentes as ui
from ui import estilos

st.set_page_config(
    page_title="Analítica | E-commerce",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="auto",  # abierto en computador, plegado en celular
)
estilos.aplicar_estilos()


def mostrar(valor) -> object:
    """Valor para un KPI; None significa que el servicio no respondió."""
    return "No disponible" if valor is None else valor


def aviso_sin_servicio(servicio: str) -> None:
    ui.aviso(
        "⚠️",
        f"No se pudo consultar el servicio de <strong>{servicio}</strong>. "
        "Revisa que esté corriendo y que analítica tenga el <code>JWT_SECRET</code> compartido.",
    )


# ---------------------------------------------------------------------------
# Secciones
# ---------------------------------------------------------------------------

def seccion_productos() -> None:
    if analytics_service.obtener_cantidad_productos_registrados() is None:
        aviso_sin_servicio("catálogo")
        return

    ui.kpis(
        [
            ("Categorías", analytics_service.obtener_cantidad_categorias(), "Con productos asignados"),
            ("Unidades en stock", analytics_service.obtener_stock_total(), "Suma de todos los productos"),
            ("Productos agotados", analytics_service.obtener_productos_agotados(), "Stock en 0"),
        ]
    )

    izquierda, derecha = st.columns([2, 3], gap="medium")
    with izquierda, ui.tarjeta("Productos por categoría", "Cantidad de productos en cada categoría"):
        ui.torta(
            analytics_service.obtener_productos_por_categoria(),
            "categoria",
            "productos",
            "Productos",
        )
    with derecha, ui.tarjeta("Stock por producto", "Unidades disponibles; en gris, los agotados"):
        ui.barras(
            analytics_service.obtener_stock_por_producto(),
            "producto",
            "stock",
            "Stock",
            horizontal=True,
            resaltar_cero=True,
        )

    with ui.tarjeta("Catálogo registrado"):
        st.dataframe(
            analytics_service.obtener_tabla_productos(),
            hide_index=True,
            use_container_width=True,
            column_config={
                "producto": "Producto",
                "categoria": "Categoría",
                "precio": st.column_config.NumberColumn("Precio", format="$ %.2f"),
                "stock": st.column_config.NumberColumn("Stock", format="%d"),
            },
        )


def seccion_usuarios() -> None:
    if analytics_service.obtener_cantidad_usuarios_activos() is None:
        aviso_sin_servicio("autenticación")
        return

    izquierda, derecha = st.columns([2, 3], gap="medium")
    with izquierda, ui.tarjeta("Usuarios activos por rol"):
        ui.torta(
            analytics_service.obtener_usuarios_por_rol(),
            "rol",
            "usuarios",
            "Usuarios",
            colores=estilos.COLORES_ROL,
        )
    with derecha, ui.tarjeta(
        "Usuarios registrados",
        "La tabla usuarios de auth no tiene estado: todo usuario registrado cuenta como activo.",
    ):
        st.dataframe(
            analytics_service.obtener_tabla_usuarios(),
            hide_index=True,
            use_container_width=True,
            column_config={"nombre": "Nombre", "email": "Email", "rol": "Rol"},
        )


def seccion_ventas(limite_productos: int) -> None:
    ui.aviso(
        "ℹ️",
        "<strong>Datos de ejemplo:</strong> todavía no hay compras registradas en el sistema.",
    )
    ui.kpis(
        [
            ("Compras realizadas", analytics_service.obtener_total_compras(), "Todos los estados"),
            ("Ingresos", f"$ {analytics_service.obtener_ingresos_totales():,.2f}", "Solo compras completadas"),
        ]
    )

    izquierda, derecha = st.columns(2, gap="medium")
    with izquierda, ui.tarjeta("Compras por estado"):
        ui.torta(
            analytics_service.obtener_compras_por_estado(),
            "estado",
            "compras",
            "Compras",
            colores=estilos.COLORES_ESTADO,
        )
    with derecha, ui.tarjeta("Compras por mes"):
        ui.barras(analytics_service.obtener_compras_por_mes(), "mes", "compras", "Compras")

    with ui.tarjeta(f"Top {limite_productos} productos más vendidos", "Unidades en compras completadas"):
        ui.barras(
            analytics_service.obtener_productos_mas_vendidos(limite_productos),
            "producto",
            "unidades",
            "Unidades",
            horizontal=True,
        )


SECCIONES = {
    "Productos": "Productos registrados en catálogo.",
    "Usuarios": "Usuarios activos registrados en autenticación.",
    "Ventas": "Compras y productos más vendidos.",
}

# ---------------------------------------------------------------------------
# Menu lateral (desplegable)
# ---------------------------------------------------------------------------

with st.sidebar:
    ui.marca_lateral()

    st.markdown('<p class="titulo-lateral">Secciones</p>', unsafe_allow_html=True)
    seccion = st.radio("Sección", list(SECCIONES), label_visibility="collapsed", key="menu")

    if seccion == "Ventas":
        st.markdown('<p class="titulo-lateral">Opciones</p>', unsafe_allow_html=True)
        # El tope es la cantidad de productos con ventas completadas.
        vendidos = analytics_service.obtener_cantidad_productos_vendidos()
        limite_productos = st.slider(
            "Productos en el ranking",
            min_value=1,
            max_value=max(vendidos, 2),
            value=max(1, min(5, vendidos)),
            help=f"{vendidos} productos tienen al menos una compra completada.",
        )

    st.markdown('<p class="titulo-lateral">Fuentes de datos</p>', unsafe_allow_html=True)
    items = "".join(
        f"<li><b>{escape(dato)}</b>: {escape(detalle)}<br><span>desde {escape(origen)}</span></li>"
        for dato, detalle, origen in analytics_service.obtener_resumen_fuentes()
    )
    st.markdown(f'<ul class="lista-lateral">{items}</ul>', unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Encabezado e indicadores principales (APIs de catalogo y auth)
# ---------------------------------------------------------------------------

ui.cabecera("Panel de analítica", "Módulo Analítico · Python")
ui.titulo_pagina("Resumen del e-commerce", "Productos y usuarios registrados en catálogo y autenticación.")

ui.kpis(
    [
        ("Productos registrados", mostrar(analytics_service.obtener_cantidad_productos_registrados()), "Catálogo"),
        ("Usuarios activos", mostrar(analytics_service.obtener_cantidad_usuarios_activos()), "Autenticación"),
        ("Clientes", mostrar(analytics_service.obtener_cantidad_por_rol("cliente")), "Rol cliente"),
        ("Administradores", mostrar(analytics_service.obtener_cantidad_por_rol("admin")), "Rol admin"),
    ]
)

# ---------------------------------------------------------------------------
# Seccion elegida en el menu
# ---------------------------------------------------------------------------

ui.titulo_seccion(seccion, SECCIONES[seccion])

if seccion == "Productos":
    seccion_productos()
elif seccion == "Usuarios":
    seccion_usuarios()
else:
    seccion_ventas(limite_productos)
