"""
Microservicio de Analítica y Motor de Recomendaciones (Python + PostgreSQL [analitica])
Responsabilidad:
- IDEA 01: Motor de recomendaciones inteligentes y ventas cruzadas automáticas.
- IDEA 08: Analítica de datos históricos, reportes de ventas y métricas para el panel admin.
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import os

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

# IDEA 08: Reportes y Métricas Globales
@app.get("/reportes")
def obtener_reportes():
    """
    Devuelve métricas consolidadas calculadas a partir del historial de ventas.
    """
    return {
        "ventas_totales": 2195.57,
        "total_ordenes": 3,
        "ticket_promedio": 731.85,
        "tasa_conversion": 4.8,
        "categorias": [
            {"nombre": "Electrónica", "porcentaje": 52},
            {"nombre": "Accesorios", "porcentaje": 24},
            {"nombre": "Calzado & Moda", "porcentaje": 16},
            {"nombre": "Hogar", "porcentaje": 8}
        ],
        "top_productos": [
            {"nombre": "Smartphone Crimson Pro 256GB", "ventas": 142},
            {"nombre": "Funda Protectora Silicona Roja", "ventas": 98},
            {"nombre": "Audífonos Inalámbricos Pro", "ventas": 76},
            {"nombre": "Zapatillas Runner Red", "ventas": 54}
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
