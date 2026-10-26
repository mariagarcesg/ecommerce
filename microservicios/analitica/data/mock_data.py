"""Capa de datos: ventas simuladas (mock data).

El microservicio de ordenes todavia no tiene seeds, asi que las compras
se simulan con DataFrames estaticos. Cuando analitica pida las ventas a la
API de ordenes, esta capa se sustituira manteniendo las mismas funciones
publicas, para que la capa de servicios no tenga que cambiar.
"""

import pandas as pd

# ---------------------------------------------------------------------------
# Datos estaticos en crudo
# ---------------------------------------------------------------------------

_COMPRAS = [
    {"id": 1, "fecha": "2026-05-04", "estado": "completada"},
    {"id": 2, "fecha": "2026-05-11", "estado": "completada"},
    {"id": 3, "fecha": "2026-05-23", "estado": "pendiente"},
    {"id": 4, "fecha": "2026-06-02", "estado": "completada"},
    {"id": 5, "fecha": "2026-06-14", "estado": "completada"},
    {"id": 6, "fecha": "2026-06-20", "estado": "cancelada"},
    {"id": 7, "fecha": "2026-06-29", "estado": "completada"},
    {"id": 8, "fecha": "2026-07-06", "estado": "completada"},
    {"id": 9, "fecha": "2026-07-18", "estado": "completada"},
    {"id": 10, "fecha": "2026-07-27", "estado": "pendiente"},
    {"id": 11, "fecha": "2026-08-03", "estado": "completada"},
    {"id": 12, "fecha": "2026-08-15", "estado": "completada"},
    {"id": 13, "fecha": "2026-08-22", "estado": "completada"},
    {"id": 14, "fecha": "2026-09-05", "estado": "completada"},
    {"id": 15, "fecha": "2026-09-19", "estado": "cancelada"},
    {"id": 16, "fecha": "2026-09-28", "estado": "completada"},
    {"id": 17, "fecha": "2026-10-07", "estado": "completada"},
    {"id": 18, "fecha": "2026-10-16", "estado": "completada"},
]

# Lineas de cada compra. El nombre y el precio son una copia, igual que hara
# el microservicio de ordenes (README: "guarda una copia").
_DETALLE_COMPRAS = [
    {"compra_id": 1, "producto": "Smartphone Crimson Pro 256GB", "cantidad": 1, "precio": 799.99},
    {"compra_id": 1, "producto": "Funda Protectora Silicona Roja", "cantidad": 1, "precio": 24.99},
    {"compra_id": 2, "producto": "Camiseta Deportiva Transpirable Fit", "cantidad": 2, "precio": 29.90},
    {"compra_id": 3, "producto": "Mouse Ergonómico Inalámbrico Silent", "cantidad": 1, "precio": 39.99},
    {"compra_id": 4, "producto": "Zapatillas Deportivas Runner Red", "cantidad": 1, "precio": 89.50},
    {"compra_id": 4, "producto": "Camiseta Deportiva Transpirable Fit", "cantidad": 1, "precio": 29.90},
    {"compra_id": 5, "producto": "Funda Protectora Silicona Roja", "cantidad": 2, "precio": 24.99},
    {"compra_id": 6, "producto": "Laptop Pro Ultradelgada 16\"", "cantidad": 1, "precio": 1299.00},
    {"compra_id": 7, "producto": "Audífonos Inalámbricos Noise Cancelling", "cantidad": 1, "precio": 149.99},
    {"compra_id": 7, "producto": "Funda Protectora Silicona Roja", "cantidad": 1, "precio": 24.99},
    {"compra_id": 8, "producto": "Laptop Pro Ultradelgada 16\"", "cantidad": 1, "precio": 1299.00},
    {"compra_id": 8, "producto": "Mouse Ergonómico Inalámbrico Silent", "cantidad": 1, "precio": 39.99},
    {"compra_id": 9, "producto": "Camiseta Deportiva Transpirable Fit", "cantidad": 3, "precio": 29.90},
    {"compra_id": 10, "producto": "Cafetera Expreso Barista Red", "cantidad": 1, "precio": 189.00},
    {"compra_id": 11, "producto": "Smartphone Crimson Pro 256GB", "cantidad": 1, "precio": 799.99},
    {"compra_id": 11, "producto": "Audífonos Inalámbricos Noise Cancelling", "cantidad": 1, "precio": 149.99},
    {"compra_id": 12, "producto": "Funda Protectora Silicona Roja", "cantidad": 1, "precio": 24.99},
    {"compra_id": 13, "producto": "Zapatillas Deportivas Runner Red", "cantidad": 2, "precio": 89.50},
    {"compra_id": 14, "producto": "Mouse Ergonómico Inalámbrico Silent", "cantidad": 2, "precio": 39.99},
    {"compra_id": 15, "producto": "Smartphone Crimson Pro 256GB", "cantidad": 1, "precio": 799.99},
    {"compra_id": 16, "producto": "Camiseta Deportiva Transpirable Fit", "cantidad": 1, "precio": 29.90},
    {"compra_id": 16, "producto": "Funda Protectora Silicona Roja", "cantidad": 1, "precio": 24.99},
    {"compra_id": 17, "producto": "Audífonos Inalámbricos Noise Cancelling", "cantidad": 1, "precio": 149.99},
    {"compra_id": 18, "producto": "Zapatillas Deportivas Runner Red", "cantidad": 1, "precio": 89.50},
]


# ---------------------------------------------------------------------------
# Funciones publicas: retornan DataFrames en crudo
# ---------------------------------------------------------------------------

def get_compras_df() -> pd.DataFrame:
    """Compras simuladas (cabeceras): [id, fecha, estado]."""
    df = pd.DataFrame(_COMPRAS)
    df["fecha"] = pd.to_datetime(df["fecha"])
    return df


def get_detalle_compras_df() -> pd.DataFrame:
    """Lineas de cada compra simulada: [compra_id, producto, cantidad, precio]."""
    return pd.DataFrame(_DETALLE_COMPRAS)
