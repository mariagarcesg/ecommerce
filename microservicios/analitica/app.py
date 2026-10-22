"""Punto de entrada del dashboard de analitica (Streamlit).

Solo importa la capa de servicios y dibuja la interfaz con Plotly.
La logica de negocio vive en services/analytics_service.py y los datos
en data/mock_data.py.
"""

import plotly.express as px
import streamlit as st

from services import analytics_service

st.set_page_config(
    page_title="Analitica | E-commerce",
    page_icon="📊",
    layout="wide",
)

st.title("Panel de Analitica")
st.caption("Primera iteración · datos simulados (mock data)")

st.sidebar.header("Acerca de")
st.sidebar.info(
    "Dashboard de reportes del e-commerce. "
    "En esta iteración los datos provienen de data/mock_data.py; "
    "a futuro se conectará a PostgreSQL (esquema analitica) "
    "y a la API de ordenes."
)

# ---------------------------------------------------------------------------
# Metricas principales
# ---------------------------------------------------------------------------

col_clientes, col_compras, col_ingresos = st.columns(3)
col_clientes.metric("Clientes registrados", analytics_service.obtener_total_clientes())
col_compras.metric("Compras realizadas", analytics_service.obtener_total_compras())
col_ingresos.metric(
    "Ingresos (compras completadas)",
    f"${analytics_service.obtener_ingresos_totales():,.2f}",
)

st.divider()

# ---------------------------------------------------------------------------
# Clientes registrados (torta)
# ---------------------------------------------------------------------------

st.subheader("Clientes registrados por ciudad")
clientes_ciudad = analytics_service.obtener_clientes_por_ciudad()
fig_clientes = px.pie(
    clientes_ciudad,
    names="ciudad",
    values="clientes",
    hole=0.4,
    color_discrete_sequence=px.colors.qualitative.Set2,
)
fig_clientes.update_traces(textposition="inside", textinfo="percent+label+value")
fig_clientes.update_layout(showlegend=False, margin=dict(t=10, b=10, l=10, r=10))
st.plotly_chart(fig_clientes, use_container_width=True)

# ---------------------------------------------------------------------------
# Compras realizadas (barras)
# ---------------------------------------------------------------------------

st.subheader("Compras realizadas por mes")
compras_mes = analytics_service.obtener_compras_por_mes()
fig_compras = px.bar(
    compras_mes,
    x="mes",
    y="compras",
    text="compras",
    color="compras",
    color_continuous_scale="Blues",
)
fig_compras.update_traces(textposition="outside")
fig_compras.update_layout(
    showlegend=False,
    coloraxis_showscale=False,
    xaxis_title="Mes",
    yaxis_title="Compras",
    yaxis=dict(dtick=1),
    margin=dict(t=10, b=10, l=10, r=10),
)
st.plotly_chart(fig_compras, use_container_width=True)

# ---------------------------------------------------------------------------
# Productos mas vendidos (barras horizontales)
# ---------------------------------------------------------------------------

st.subheader("Productos más vendidos (unidades)")
productos = analytics_service.obtener_productos_mas_vendidos()
fig_productos = px.bar(
    productos.sort_values("unidades", ascending=True),
    x="unidades",
    y="producto",
    orientation="h",
    text="unidades",
    color="unidades",
    color_continuous_scale="Greens",
)
fig_productos.update_traces(textposition="outside")
fig_productos.update_layout(
    showlegend=False,
    coloraxis_showscale=False,
    xaxis_title="Unidades vendidas",
    yaxis_title="",
    xaxis=dict(dtick=1),
    margin=dict(t=10, b=10, l=10, r=10),
)
st.plotly_chart(fig_productos, use_container_width=True)

# ---------------------------------------------------------------------------
# Datos en crudo (capa data) para inspeccion
# ---------------------------------------------------------------------------

with st.expander("Ver datos simulados"):
    crudos = analytics_service.obtener_dataframes_crudos()
    tab_clientes, tab_compras, tab_detalle = st.tabs(
        ["Clientes", "Compras", "Detalle de compras"]
    )
    with tab_clientes:
        st.dataframe(crudos["clientes"], use_container_width=True)
    with tab_compras:
        st.dataframe(crudos["compras"], use_container_width=True)
    with tab_detalle:
        st.dataframe(crudos["detalle"], use_container_width=True)
