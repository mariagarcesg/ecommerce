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

# Colores unificados con el frontend
COLOR_PRIMARIO = "#2563eb"
COLOR_FONDO = "#f6f7f9"
COLOR_SUPERFICIE = "#ffffff"
COLOR_TEXTO = "#1f2933"
COLOR_TEXTO_SUAVE = "#616e7c"
COLOR_BORDE = "#e4e7eb"

st.markdown(
    f"""
    <style>
    .stApp {{
        background-color: {COLOR_FONDO};
    }}
    [data-testid="stSidebar"] {{
        background-color: {COLOR_SUPERFICIE};
        border-right: 1px solid {COLOR_BORDE};
    }}
    h1, h2, h3 {{
        color: {COLOR_TEXTO};
    }}
    .stMetric {{
        background-color: {COLOR_SUPERFICIE};
        border: 1px solid {COLOR_BORDE};
        padding: 1rem;
        border-radius: 8px;
    }}
    [data-testid="stMetricLabel"] {{
        color: {COLOR_TEXTO_SUAVE};
    }}
    [data-testid="stMetricValue"] {{
        color: {COLOR_TEXTO};
    }}
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("Panel de Analitica")
st.caption("Dashboard con datos registrados en los seeds del proyecto")

st.sidebar.header("Acerca de")
st.sidebar.info(
    "Dashboard de reportes del e-commerce. "
    "Muestra la cantidad de productos registrados y usuarios activos "
    "consultando las APIs de catálogo y auth. "
    "A futuro se conectará a PostgreSQL (esquema analitica) "
    "y a la API de ordenes."
)

# ---------------------------------------------------------------------------
# Metricas principales (desde las APIs de catalogo y auth)
# ---------------------------------------------------------------------------

productos = analytics_service.obtener_cantidad_productos_registrados()
usuarios = analytics_service.obtener_cantidad_usuarios_activos()

col_productos, col_usuarios = st.columns(2)
col_productos.metric(
    "Cantidad de productos registrados",
    productos if productos is not None else "No disponible",
)
col_usuarios.metric(
    "Cantidad de usuarios activos",
    usuarios if usuarios is not None else "No disponible",
)
if productos is None or usuarios is None:
    st.warning("No se pudo consultar catálogo o auth. Revisa que esos servicios estén corriendo.")

st.divider()

# ---------------------------------------------------------------------------
# Origen de los datos
# ---------------------------------------------------------------------------

with st.expander("Ver origen de los datos"):
    st.write("**Auth (usuarios activos):** `GET /usuarios/total` del servicio auth")
    st.write("**Catálogo (productos registrados):** `GET /products` del servicio catálogo")
    st.caption("Los conteos se obtienen leyendo directamente los archivos seeds del repositorio.")
