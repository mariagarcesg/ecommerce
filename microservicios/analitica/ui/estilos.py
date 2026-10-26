"""Estilos del dashboard, alineados con el frontend del e-commerce.

Usa la misma paleta rojo y blanco de frontend/shared/styles.css
(rojo de marca, fondo gris claro, tarjetas blancas con sombra suave).
"""

import streamlit as st

# ---------------------------------------------------------------------------
# Tokens de diseno (mismos valores que frontend/shared/styles.css)
# ---------------------------------------------------------------------------

ROJO = "#DC2626"
ROJO_OSCURO = "#B91C1C"
ROJO_SUAVE = "#FEE2E2"
BLANCO = "#FFFFFF"
FONDO = "#F9FAFB"
TEXTO = "#111827"
TEXTO_SUAVE = "#4B5563"
TEXTO_MUTADO = "#9CA3AF"
BORDE = "#E5E7EB"
BORDE_FUERTE = "#D1D5DB"
EXITO = "#16A34A"
FUENTE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

# Colores de las graficas. Orden fijo, validado para daltonismo:
# rojo de marca, azul, amarillo, aqua, violeta.
PALETA = [ROJO, "#2a78d6", "#eda100", "#1baf7a", "#6250d6"]
COLORES_ROL = {"cliente": ROJO, "admin": "#2a78d6"}
COLORES_ESTADO = {"completada": EXITO, "pendiente": "#eda100", "cancelada": ROJO}

_CSS = f"""
<style>
/* ---------- Base ---------- */
html, body, [class*="css"], .stApp {{
    font-family: {FUENTE};
}}
.stApp {{
    background-color: {FONDO};
}}
.block-container {{
    padding-top: 1.25rem;
    padding-bottom: 3rem;
    max-width: 1280px;
}}

/* Ocultar la barra superior y el menu de Streamlit */
header[data-testid="stHeader"] {{
    background: transparent;
    height: 0;
}}
[data-testid="stToolbar"], [data-testid="stDecoration"], #MainMenu, footer {{
    display: none;
}}

/* ---------- Cabecera (igual a la navbar del e-commerce) ---------- */
.cabecera {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 14px 24px;
    margin-bottom: 20px;
    background: {BLANCO};
    border: 1px solid {BORDE};
    border-bottom: 2px solid {ROJO};
    border-radius: 12px;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}}
.cabecera__marca {{
    display: flex;
    align-items: center;
    gap: 10px;
}}
.cabecera__logo {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background: {ROJO};
    color: {BLANCO};
    border-radius: 8px;
    font-weight: 900;
    font-size: 1.2rem;
}}
.cabecera__texto {{
    display: flex;
    flex-direction: column;
    line-height: 1;
}}
.cabecera__nombre {{
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: {TEXTO};
}}
.cabecera__sub {{
    margin-top: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: {ROJO};
}}
.insignia {{
    background: {ROJO};
    color: {BLANCO};
    font-size: 0.75rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    white-space: nowrap;
}}
.insignia--suave {{
    background: {ROJO_SUAVE};
    color: {ROJO_OSCURO};
}}

/* ---------- Titulo de pagina ---------- */
.stMarkdown h1.titulo-pagina {{
    margin: 0 0 4px;
    padding: 0;
    font-size: 1.6rem;
    line-height: 1.25;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: {TEXTO};
}}
.subtitulo-pagina {{
    margin: 0 0 18px;
    font-size: 0.9rem;
    color: {TEXTO_SUAVE};
}}

/* ---------- KPIs (igual a .kpi-card del panel admin) ---------- */
.kpi-grilla {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}}
.kpi-card {{
    background: {BLANCO};
    border: 1px solid {BORDE};
    border-top: 4px solid {ROJO};
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}}
.kpi-card__titulo {{
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: {TEXTO_SUAVE};
}}
.kpi-card__valor {{
    margin-top: 4px;
    font-size: 1.9rem;
    font-weight: 900;
    line-height: 1.2;
    color: {TEXTO};
}}
.kpi-card__nota {{
    margin-top: 2px;
    font-size: 0.8rem;
    color: {TEXTO_MUTADO};
}}

/* ---------- Titulo de la seccion elegida ---------- */
.titulo-seccion {{
    margin: 8px 0 16px;
    padding-left: 12px;
    border-left: 4px solid {ROJO};
}}
.titulo-seccion h2 {{
    margin: 0;
    padding: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: {TEXTO};
}}
.titulo-seccion p {{
    margin: 2px 0 0;
    font-size: 0.88rem;
    color: {TEXTO_SUAVE};
}}

/* ---------- Menu lateral: st.radio con forma de lista de navegacion ---------- */
.marca-lateral {{
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 14px;
    margin-bottom: 16px;
    border-bottom: 2px solid {ROJO};
}}
[data-testid="stSidebar"] [role="radiogroup"] {{
    gap: 4px;
    margin-bottom: 16px;
}}
[data-testid="stSidebar"] [role="radiogroup"] label {{
    width: 100%;
    margin: 0;
    padding: 9px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
}}
/* Oculta el circulo del radio: la opcion entera es el boton */
[data-testid="stSidebar"] [role="radiogroup"] label > div:first-child {{
    display: none;
}}
[data-testid="stSidebar"] [role="radiogroup"] label p {{
    font-size: 0.95rem;
    font-weight: 600;
    color: {TEXTO};
}}
[data-testid="stSidebar"] [role="radiogroup"] label:hover {{
    background: {ROJO_SUAVE};
}}
[data-testid="stSidebar"] [role="radiogroup"] label:hover p {{
    color: {ROJO_OSCURO};
}}
[data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) {{
    background: {ROJO};
    border-color: {ROJO};
}}
[data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) p {{
    color: {BLANCO};
}}

/* ---------- Tarjetas (st.container con borde) ---------- */
/* Solo los contenedores cuyo primer elemento es el titulo de ui.tarjeta() */
[data-testid="stVerticalBlockBorderWrapper"]:has(
    > div > [data-testid="stVerticalBlock"] > [data-testid="stElementContainer"]:first-child .titulo-tarjeta
) {{
    background: {BLANCO};
    border: 1px solid {BORDE};
    border-radius: 12px;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}}
.titulo-tarjeta {{
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: {TEXTO};
}}
.nota-tarjeta {{
    margin: 2px 0 0;
    font-size: 0.82rem;
    color: {TEXTO_SUAVE};
}}

/* ---------- Avisos ---------- */
.aviso {{
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 16px;
    margin-bottom: 16px;
    border-radius: 8px;
    border: 1px solid {BORDE};
    border-left: 4px solid {ROJO};
    background: {BLANCO};
    color: {TEXTO_SUAVE};
    font-size: 0.9rem;
}}
.aviso strong {{
    color: {TEXTO};
}}
.aviso code, .lista-lateral code {{
    font-size: 0.82rem;
    color: {ROJO_OSCURO};
    background: {ROJO_SUAVE};
    padding: 1px 5px;
    border-radius: 4px;
}}

/* ---------- Barra lateral ---------- */
[data-testid="stSidebar"] {{
    background: {BLANCO};
    border-right: 1px solid {BORDE};
}}
.titulo-lateral {{
    margin: 0 0 8px;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: {TEXTO_SUAVE};
}}
.lista-lateral {{
    margin: 0 0 16px;
    padding-left: 18px;
    font-size: 0.86rem;
    color: {TEXTO_SUAVE};
}}
.lista-lateral li {{
    margin-bottom: 8px;
}}
.lista-lateral b {{
    color: {TEXTO};
}}
.lista-lateral span {{
    font-size: 0.8rem;
    color: {TEXTO_MUTADO};
}}

/* ---------- Celular ---------- */
@media (max-width: 640px) {{
    .block-container {{
        padding-top: 3rem;  /* espacio para el boton de la barra lateral */
    }}
    .stMarkdown h1.titulo-pagina {{
        font-size: 1.35rem;
    }}
    .kpi-card {{
        padding: 12px;
    }}
    .kpi-card__valor {{
        font-size: 1.5rem;
    }}
}}

/* ---------- Tablas ---------- */
[data-testid="stDataFrame"] {{
    border: 1px solid {BORDE};
    border-radius: 8px;
    overflow: hidden;
}}
</style>
"""


def aplicar_estilos() -> None:
    """Inyecta el CSS del dashboard en la pagina."""
    st.markdown(_CSS, unsafe_allow_html=True)
