"""
Microservicio de Analítica y Motor de Recomendaciones (Python + PostgreSQL [analitica])
Responsabilidad:
- IDEA 01: Motor de recomendaciones inteligentes y ventas cruzadas automáticas.
- IDEA 08: Analítica de datos históricos, reportes de ventas y métricas para el panel admin.
"""

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import os

from services import analytics_service

app = FastAPI(
    title="Ecommerce Analitica & Recomendaciones",
    description="Microservicio en Python para análisis de datos y sugerencias cross-selling",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "analitica", "language": "python"}

# IDEA 01: Motor de Recomendaciones (Ventas cruzadas automáticas)
# Ejemplo de la diapositiva: Compra de teléfono dispara sugerencia de funda.
REGLAS_CROSS_SELLING = {
    "prod-01": [ # Smartphone
        {
            "tag": "Sugerencia Inteligente Python",
            "nombre": "Funda Protectora Silicona Roja",
            "precio": 24.99,
            "motivo": "Frecuentemente adquirido junto con Smartphone Crimson Pro"
        },
        {
            "tag": "Accesorio Recomendado",
            "nombre": "Audífonos Inalámbricos Noise Cancelling",
            "precio": 149.99,
            "motivo": "91% de los compradores agregaron audio inalámbrico"
        }
    ],
    "prod-03": [ # Laptop
        {
            "tag": "Complemento Productividad",
            "nombre": "Mouse Ergonómico Inalámbrico Silent",
            "precio": 39.99,
            "motivo": "Accesorio más solicitado por desarrolladores y diseñadores"
        }
    ],
    "prod-05": [ # Zapatillas
        {
            "tag": "Ropa Deportiva Cruzada",
            "nombre": "Camiseta Deportiva Transpirable Fit",
            "precio": 29.90,
            "motivo": "Combinación perfecta de entrenamiento de running"
        }
    ]
}

@app.get("/recomendaciones")
def obtener_recomendaciones(productoId: Optional[str] = Query(None)):
    """
    Evalúa el producto actual o el historial y devuelve sugerencias inteligentes de productos complementarios.
    """
    if productoId and productoId in REGLAS_CROSS_SELLING:
        return REGLAS_CROSS_SELLING[productoId]
    
    # Recomendaciones por defecto basadas en afinidad general
    return [
        {
            "tag": "Venta Cruzada Recomendada",
            "nombre": "Funda Protectora Silicona Roja",
            "precio": 24.99,
            "motivo": "Recomendación de alta rotación para smartphones"
        },
        {
            "tag": "Complemento Tecnológico",
            "nombre": "Mouse Ergonómico Inalámbrico Silent",
            "precio": 39.99,
            "motivo": "Excelente complemento para estaciones de trabajo"
        },
        {
            "tag": "Top Ventas Históricas",
            "nombre": "Audífonos Inalámbricos Noise Cancelling",
            "precio": 149.99,
            "motivo": "Mayor índice de satisfacción en reseñas"
        }
    ]

# IDEA 08: Reportes y Métricas Globales (solo admin)
# Usa la misma capa de servicios que el dashboard Streamlit (services/analytics_service.py).
def requerir_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Exige 'Authorization: Bearer <token>' de auth con rol admin."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    claims = analytics_service.validar_token_jwt(token)
    if claims is None:
        raise HTTPException(status_code=401, detail="Sesión no válida.")
    if claims.get("rol") != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción.")
    return claims


@app.get("/reportes")
def obtener_reportes(_admin: dict = Depends(requerir_admin)):
    """
    Métricas para el panel admin, solo con datos reales de catálogo, auth y
    ordenes (None si el servicio no responde). Las ventas simuladas de
    mock_data ya no se publican aquí.
    """
    return {
        "productos_registrados": analytics_service.obtener_cantidad_productos_registrados(),
        "usuarios_activos": analytics_service.obtener_cantidad_usuarios_activos(),
        "ultimo_producto_agregado": analytics_service.obtener_ultimo_producto_agregado(),
        "producto_mas_vendido": analytics_service.obtener_producto_mas_vendido(),
        "productos_por_categoria": analytics_service.obtener_productos_por_categoria().to_dict(orient="records"),
        "usuarios_por_rol": analytics_service.obtener_usuarios_por_rol().to_dict(orient="records"),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
