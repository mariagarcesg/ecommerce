"""Punto de entrada del dashboard de analitica (Streamlit).

Solo importa la capa de servicios y dibuja la interfaz. La logica de negocio
vive en services/analytics_service.py, los datos en data/ y los estilos y
graficas (Plotly) en ui/.
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


def aviso_sin_seed(servicio: str) -> None:
    ui.aviso(
        "⚠️",
        f"No se encontraron seeds de <strong>{servicio}</strong> en "
        f"<code>microservicios/{servicio}/seeds/</code>. "
        "Revisa <strong>Fuentes de datos</strong> en el menú lateral.",
    )


# ---------------------------------------------------------------------------
# Secciones
# ---------------------------------------------------------------------------

def seccion_productos() -> None:
    if analytics_service.obtener_cantidad_productos_registrados() == 0:
        aviso_sin_seed("catalogo")
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
    if analytics_service.obtener_cantidad_usuarios_activos() == 0:
        aviso_sin_seed("auth")
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
    "Productos": "Productos registrados en el seed de catálogo.",
    "Usuarios": "Usuarios activos registrados en el seed de auth.",
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
# Encabezado e indicadores principales (seeds)
# ---------------------------------------------------------------------------

ui.cabecera("Panel de analítica", "Módulo Analítico · Python")
ui.titulo_pagina("Resumen del e-commerce", "Productos y usuarios registrados en los seeds del proyecto.")

ui.kpis(
    [
        ("Productos registrados", analytics_service.obtener_cantidad_productos_registrados(), "Seed de catálogo"),
        ("Usuarios activos", analytics_service.obtener_cantidad_usuarios_activos(), "Seed de auth"),
        ("Clientes", analytics_service.obtener_cantidad_por_rol("cliente"), "Rol cliente"),
        ("Administradores", analytics_service.obtener_cantidad_por_rol("admin"), "Rol admin"),
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
