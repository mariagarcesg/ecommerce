"""Capa de datos reales: consulta las APIs de los otros microservicios.

Analitica no lee la BD ni los archivos de otros servicios; les pide los
datos por HTTP dentro de la red de Docker. Si un servicio no responde, las
funciones devuelven None para que el dashboard lo muestre como no disponible.
"""

import json
import os
import time
import urllib.request

import jwt

CATALOGO_URL = os.getenv("CATALOGO_URL", "http://catalogo:3000")
AUTH_URL = os.getenv("AUTH_URL", "http://auth:8081")
JWT_SECRET = os.getenv("JWT_SECRET", "")

TIMEOUT_SEGUNDOS = 5


def _token_servicio() -> str:
    """JWT de corta duracion con rol admin, firmado con el secreto compartido.

    auth exige rol admin para dar el total de usuarios; analitica firma su
    propio token igual que lo haria auth (mismos claims: sub, nombre, rol).
    """
    ahora = int(time.time())
    claims = {
        "sub": "0",
        "nombre": "servicio-analitica",
        "rol": "admin",
        "jti": f"analitica-{ahora}",
        "iat": ahora,
        "exp": ahora + 60,
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def _get_json(url: str, headers: dict | None = None):
    peticion = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def contar_productos_registrados() -> int | None:
    """Cantidad de productos en catalogo (GET /products es publico)."""
    try:
        productos = _get_json(f"{CATALOGO_URL}/products")
        return len(productos) if isinstance(productos, list) else None
    except Exception:
        return None


def contar_usuarios_activos() -> int | None:
    """Cantidad de usuarios registrados en auth (GET /usuarios/total, solo admin)."""
    if not JWT_SECRET:
        return None
    try:
        datos = _get_json(
            f"{AUTH_URL}/usuarios/total",
            headers={"Authorization": f"Bearer {_token_servicio()}"},
        )
        return int(datos["total"])
    except Exception:
        return None
