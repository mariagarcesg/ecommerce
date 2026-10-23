"""Capa de datos del microservicio de analitica.

Genera y retorna los DataFrames de Pandas con datos simulados (mock data).
Es la unica fuente de datos en crudo del servicio: no conecta a bases de
datos ni a APIs. En una proxima iteracion esta capa se sustituira por
PostgreSQL (esquema analitica) manteniendo las mismas funciones publicas.
"""

import pandas as pd

# ---------------------------------------------------------------------------
# Datos estaticos en crudo
# ---------------------------------------------------------------------------

_CLIENTES = [
    {"id": 1, "nombre": "Ana Torres", "ciudad": "Bogota", "fecha_registro": "2025-01-05"},
    {"id": 2, "nombre": "Luis Ramirez", "ciudad": "Medellin", "fecha_registro": "2025-01-18"},
    {"id": 3, "nombre": "Carla Gomez", "ciudad": "Cali", "fecha_registro": "2025-02-02"},
    {"id": 4, "nombre": "Diego Moreno", "ciudad": "Bogota", "fecha_registro": "2025-02-14"},
    {"id": 5, "nombre": "Sofia Herrera", "ciudad": "Barranquilla", "fecha_registro": "2025-03-01"},
    {"id": 6, "nombre": "Jorge Salazar", "ciudad": "Medellin", "fecha_registro": "2025-03-09"},
    {"id": 7, "nombre": "Valentina Rios", "ciudad": "Bogota", "fecha_registro": "2025-03-27"},
    {"id": 8, "nombre": "Andres Pinzon", "ciudad": "Cali", "fecha_registro": "2025-04-05"},
    {"id": 9, "nombre": "Camila Vargas", "ciudad": "Barranquilla", "fecha_registro": "2025-04-19"},
    {"id": 10, "nombre": "Felipe Ortiz", "ciudad": "Medellin", "fecha_registro": "2025-05-03"},
    {"id": 11, "nombre": "Daniela Castro", "ciudad": "Bogota", "fecha_registro": "2025-05-16"},
    {"id": 12, "nombre": "Sebastian Lara", "ciudad": "Cali", "fecha_registro": "2025-06-08"},
    {"id": 13, "nombre": "Paula Mesa", "ciudad": "Medellin", "fecha_registro": "2025-06-21"},
    {"id": 14, "nombre": "Mateo Acevedo", "ciudad": "Barranquilla", "fecha_registro": "2025-07-04"},
]

_COMPRAS = [
    {"id": 1, "cliente_id": 1, "fecha": "2025-01-10", "total": 93.50, "estado": "completada"},
    {"id": 2, "cliente_id": 2, "fecha": "2025-01-22", "total": 134.80, "estado": "completada"},
    {"id": 3, "cliente_id": 3, "fecha": "2025-02-05", "total": 50.00, "estado": "completada"},
    {"id": 4, "cliente_id": 1, "fecha": "2025-02-18", "total": 180.00, "estado": "completada"},
    {"id": 5, "cliente_id": 4, "fecha": "2025-02-27", "total": 58.50, "estado": "pendiente"},
    {"id": 6, "cliente_id": 5, "fecha": "2025-03-06", "total": 100.00, "estado": "completada"},
    {"id": 7, "cliente_id": 6, "fecha": "2025-03-15", "total": 39.90, "estado": "completada"},
    {"id": 8, "cliente_id": 7, "fecha": "2025-03-28", "total": 127.00, "estado": "completada"},
    {"id": 9, "cliente_id": 8, "fecha": "2025-04-09", "total": 70.00, "estado": "cancelada"},
    {"id": 10, "cliente_id": 9, "fecha": "2025-04-21", "total": 108.30, "estado": "completada"},
    {"id": 11, "cliente_id": 10, "fecha": "2025-05-04", "total": 45.00, "estado": "completada"},
    {"id": 12, "cliente_id": 2, "fecha": "2025-05-19", "total": 149.90, "estado": "completada"},
    {"id": 13, "cliente_id": 11, "fecha": "2025-05-28", "total": 63.50, "estado": "pendiente"},
    {"id": 14, "cliente_id": 12, "fecha": "2025-06-11", "total": 85.00, "estado": "completada"},
    {"id": 15, "cliente_id": 13, "fecha": "2025-06-24", "total": 68.40, "estado": "completada"},
    {"id": 16, "cliente_id": 3, "fecha": "2025-07-02", "total": 90.00, "estado": "completada"},
    {"id": 17, "cliente_id": 14, "fecha": "2025-07-13", "total": 57.00, "estado": "completada"},
    {"id": 18, "cliente_id": 5, "fecha": "2025-07-25", "total": 149.80, "estado": "completada"},
]

_DETALLE_COMPRAS = [
    {"compra_id": 1, "producto": "Camiseta Basica", "cantidad": 2, "precio_unitario": 15.00},
    {"compra_id": 1, "producto": "Mochila Escolar", "cantidad": 1, "precio_unitario": 28.50},
    {"compra_id": 1, "producto": "Audifonos Bluetooth", "cantidad": 1, "precio_unitario": 35.00},
    {"compra_id": 2, "producto": "Jeans Clasicos", "cantidad": 2, "precio_unitario": 39.90},
    {"compra_id": 2, "producto": "Zapatillas Urbanas", "cantidad": 1, "precio_unitario": 55.00},
    {"compra_id": 3, "producto": "Camiseta Basica", "cantidad": 1, "precio_unitario": 15.00},
    {"compra_id": 3, "producto": "Audifonos Bluetooth", "cantidad": 1, "precio_unitario": 35.00},
    {"compra_id": 4, "producto": "Zapatillas Urbanas", "cantidad": 2, "precio_unitario": 55.00},
    {"compra_id": 4, "producto": "Reloj Deportivo", "cantidad": 1, "precio_unitario": 70.00},
    {"compra_id": 5, "producto": "Mochila Escolar", "cantidad": 1, "precio_unitario": 28.50},
    {"compra_id": 5, "producto": "Camiseta Basica", "cantidad": 2, "precio_unitario": 15.00},
    {"compra_id": 6, "producto": "Reloj Deportivo", "cantidad": 1, "precio_unitario": 70.00},
    {"compra_id": 6, "producto": "Camiseta Basica", "cantidad": 2, "precio_unitario": 15.00},
    {"compra_id": 7, "producto": "Jeans Clasicos", "cantidad": 1, "precio_unitario": 39.90},
    {"compra_id": 8, "producto": "Reloj Deportivo", "cantidad": 1, "precio_unitario": 70.00},
    {"compra_id": 8, "producto": "Mochila Escolar", "cantidad": 2, "precio_unitario": 28.50},
    {"compra_id": 9, "producto": "Audifonos Bluetooth", "cantidad": 2, "precio_unitario": 35.00},
    {"compra_id": 10, "producto": "Jeans Clasicos", "cantidad": 2, "precio_unitario": 39.90},
    {"compra_id": 10, "producto": "Mochila Escolar", "cantidad": 1, "precio_unitario": 28.50},
    {"compra_id": 11, "producto": "Camiseta Basica", "cantidad": 3, "precio_unitario": 15.00},
    {"compra_id": 12, "producto": "Zapatillas Urbanas", "cantidad": 2, "precio_unitario": 55.00},
    {"compra_id": 12, "producto": "Jeans Clasicos", "cantidad": 1, "precio_unitario": 39.90},
    {"compra_id": 13, "producto": "Mochila Escolar", "cantidad": 1, "precio_unitario": 28.50},
    {"compra_id": 13, "producto": "Audifonos Bluetooth", "cantidad": 1, "precio_unitario": 35.00},
    {"compra_id": 14, "producto": "Reloj Deportivo", "cantidad": 1, "precio_unitario": 70.00},
    {"compra_id": 14, "producto": "Camiseta Basica", "cantidad": 1, "precio_unitario": 15.00},
    {"compra_id": 15, "producto": "Jeans Clasicos", "cantidad": 1, "precio_unitario": 39.90},
    {"compra_id": 15, "producto": "Mochila Escolar", "cantidad": 1, "precio_unitario": 28.50},
    {"compra_id": 16, "producto": "Zapatillas Urbanas", "cantidad": 1, "precio_unitario": 55.00},
    {"compra_id": 16, "producto": "Audifonos Bluetooth", "cantidad": 1, "precio_unitario": 35.00},
    {"compra_id": 17, "producto": "Mochila Escolar", "cantidad": 2, "precio_unitario": 28.50},
    {"compra_id": 18, "producto": "Reloj Deportivo", "cantidad": 1, "precio_unitario": 70.00},
    {"compra_id": 18, "producto": "Jeans Clasicos", "cantidad": 2, "precio_unitario": 39.90},
]


# ---------------------------------------------------------------------------
# Funciones publicas: retornan DataFrames en crudo
# ---------------------------------------------------------------------------

def get_clientes_df() -> pd.DataFrame:
    """DataFrame con los clientes registrados."""
    df = pd.DataFrame(_CLIENTES)
    df["fecha_registro"] = pd.to_datetime(df["fecha_registro"])
    return df


def get_compras_df() -> pd.DataFrame:
    """DataFrame con las compras realizadas (cabeceras)."""
    df = pd.DataFrame(_COMPRAS)
    df["fecha"] = pd.to_datetime(df["fecha"])
    return df


def get_detalle_compras_df() -> pd.DataFrame:
    """DataFrame con las lineas de cada compra (productos vendidos)."""
    return pd.DataFrame(_DETALLE_COMPRAS)
