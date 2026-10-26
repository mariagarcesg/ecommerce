"""Componentes visuales reutilizables: cabecera, KPIs, tarjetas y graficas."""

from contextlib import contextmanager
from html import escape

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from ui import estilos

# ---------------------------------------------------------------------------
# Bloques HTML
# ---------------------------------------------------------------------------


def cabecera(subtitulo: str, insignia: str) -> None:
    """Barra superior con la marca del e-commerce."""
    st.markdown(
        f"""
        <div class="cabecera">
          <div class="cabecera__marca">
            <span class="cabecera__logo">E</span>
            <div class="cabecera__texto">
              <span class="cabecera__nombre">ECOMMERCE</span>
              <span class="cabecera__sub">{escape(subtitulo)}</span>
            </div>
          </div>
          <span class="insignia">{escape(insignia)}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def titulo_pagina(titulo: str, subtitulo: str) -> None:
    """Titulo principal con una linea descriptiva."""
    st.markdown(
        f'<h1 class="titulo-pagina">{escape(titulo)}</h1>'
        f'<p class="subtitulo-pagina">{escape(subtitulo)}</p>',
        unsafe_allow_html=True,
    )


def marca_lateral() -> None:
    """Marca del e-commerce en la parte superior del menu lateral."""
    st.markdown(
        """
        <div class="marca-lateral">
          <span class="cabecera__logo">E</span>
          <div class="cabecera__texto">
            <span class="cabecera__nombre">ECOMMERCE</span>
            <span class="cabecera__sub">Analítica</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def titulo_seccion(titulo: str, descripcion: str) -> None:
    """Titulo de la seccion elegida en el menu lateral."""
    st.markdown(
        f'<div class="titulo-seccion"><h2>{escape(titulo)}</h2>'
        f"<p>{escape(descripcion)}</p></div>",
        unsafe_allow_html=True,
    )


def kpis(indicadores: list[tuple[str, object, str]]) -> None:
    """Grilla de tarjetas KPI. Cada indicador es (titulo, valor, nota)."""
    tarjetas = "".join(
        f'<div class="kpi-card">'
        f'<div class="kpi-card__titulo">{escape(titulo)}</div>'
        f'<div class="kpi-card__valor">{escape(str(valor))}</div>'
        f'<div class="kpi-card__nota">{escape(nota)}</div>'
        f"</div>"
        for titulo, valor, nota in indicadores
    )
    st.markdown(f'<div class="kpi-grilla">{tarjetas}</div>', unsafe_allow_html=True)


def aviso(icono: str, html_mensaje: str) -> None:
    """Aviso con borde rojo a la izquierda. El mensaje es HTML de confianza."""
    st.markdown(
        f'<div class="aviso"><span>{icono}</span><div>{html_mensaje}</div></div>',
        unsafe_allow_html=True,
    )


@contextmanager
def tarjeta(titulo: str, nota: str = ""):
    """Contenedor blanco con titulo, para agrupar una grafica o tabla."""
    with st.container(border=True):
        encabezado = f'<p class="titulo-tarjeta">{escape(titulo)}</p>'
        if nota:
            encabezado += f'<p class="nota-tarjeta">{escape(nota)}</p>'
        st.markdown(encabezado, unsafe_allow_html=True)
        yield


# ---------------------------------------------------------------------------
# Graficas (Plotly)
# ---------------------------------------------------------------------------

_CONFIG_PLOTLY = {"displayModeBar": False}


def _estilo_base(fig: go.Figure, alto: int) -> go.Figure:
    """Estilo comun: fondo transparente, tipografia y grilla del e-commerce."""
    fig.update_layout(
        height=alto,
        margin=dict(l=8, r=24, t=8, b=8),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family=estilos.FUENTE, color=estilos.TEXTO_SUAVE, size=13),
        hoverlabel=dict(
            bgcolor=estilos.BLANCO,
            bordercolor=estilos.BORDE_FUERTE,
            font=dict(family=estilos.FUENTE, color=estilos.TEXTO, size=13),
        ),
        legend=dict(orientation="h", yanchor="top", y=-0.04, xanchor="center", x=0.5),
        barcornerradius=4,
        bargap=0.35,
    )
    fig.update_xaxes(showgrid=False, linecolor=estilos.BORDE, title=None)
    fig.update_yaxes(gridcolor=estilos.BORDE, zeroline=False, title=None)
    return fig


def _mostrar(fig: go.Figure) -> None:
    st.plotly_chart(fig, use_container_width=True, config=_CONFIG_PLOTLY)


def torta(df: pd.DataFrame, nombres: str, valores: str, etiqueta: str, colores: dict | None = None) -> None:
    """Grafica de dona con el total en el centro."""
    fig = px.pie(
        df,
        names=nombres,
        values=valores,
        hole=0.62,
        color=nombres,
        color_discrete_map=colores,
        color_discrete_sequence=estilos.PALETA,
    )
    fig.update_traces(
        sort=False,
        textinfo="value",
        textfont=dict(color=estilos.BLANCO, size=14),
        marker=dict(line=dict(color=estilos.BLANCO, width=2)),
        hovertemplate=f"<b>%{{label}}</b><br>{etiqueta}: %{{value}} (%{{percent}})<extra></extra>",
    )
    fig.add_annotation(
        text=f"<b style='font-size:26px;color:{estilos.TEXTO}'>{int(df[valores].sum())}</b>"
        f"<br><span style='font-size:12px'>{escape(etiqueta.lower())}</span>",
        showarrow=False,
        font=dict(color=estilos.TEXTO_SUAVE),
    )
    _mostrar(_estilo_base(fig, alto=320))


def barras(
    df: pd.DataFrame,
    x: str,
    y: str,
    etiqueta: str,
    horizontal: bool = False,
    resaltar_cero: bool = False,
) -> None:
    """Barras de una sola serie en rojo de marca, con el valor en cada barra.

    Con `resaltar_cero`, las barras en 0 (ej. productos agotados) quedan en gris.
    """
    colores = [
        estilos.BORDE_FUERTE if resaltar_cero and v == 0 else estilos.ROJO for v in df[y]
    ]
    if horizontal:
        fig = px.bar(df, x=y, y=x, orientation="h", text=y)
        fig.update_yaxes(autorange="reversed", showgrid=False, type="category", linecolor=estilos.BORDE)
        fig.update_xaxes(showgrid=True, gridcolor=estilos.BORDE, linecolor="rgba(0,0,0,0)")
        plantilla = f"<b>%{{y}}</b><br>{etiqueta}: %{{x}}<extra></extra>"
        alto = max(300, 44 * len(df))
    else:
        fig = px.bar(df, x=x, y=y, text=y)
        fig.update_xaxes(type="category")
        plantilla = f"<b>%{{x}}</b><br>{etiqueta}: %{{y}}<extra></extra>"
        alto = 320
    fig.update_traces(
        marker_color=colores,
        textposition="outside",
        textfont=dict(color=estilos.TEXTO, size=13),
        cliponaxis=False,
        hovertemplate=plantilla,
    )
    _mostrar(_estilo_base(fig, alto=alto))
