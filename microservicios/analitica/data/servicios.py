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
ORDENES_URL = os.getenv("ORDENES_URL", "http://ordenes:8080")
JWT_SECRET = os.getenv("JWT_SECRET", "")

TIMEOUT_SEGUNDOS = 5

# El dashboard pide los mismos datos varias veces por pantalla; se guardan
# unos segundos para no repetir la consulta HTTP en cada indicador.
CACHE_SEGUNDOS = 15
_cache: dict[str, tuple[float, object]] = {}


def _con_cache(clave: str, consultar):
    ahora = time.time()
    guardado = _cache.get(clave)
    if guardado and ahora - guardado[0] < CACHE_SEGUNDOS:
        return guardado[1]
    valor = consultar()
    if valor is not None:
        _cache[clave] = (ahora, valor)
    return valor


def _token_servicio() -> str:
    """JWT de corta duracion con rol admin, firmado con el secreto compartido.

    auth exige rol admin para listar usuarios; analitica firma su propio
    token igual que lo haria auth (mismos claims: sub, nombre, rol).
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


def obtener_productos() -> list[dict] | None:
    """Productos de catalogo con su categoria (GET /products es publico)."""
    return _con_cache("productos", _consultar_productos)


def obtener_usuarios() -> list[dict] | None:
    """Usuarios de auth sin contrasena: [{id, nombre, email, rol}] (GET /usuarios, solo admin)."""
    return _con_cache("usuarios", _consultar_usuarios)


def obtener_ordenes() -> list[dict] | None:
    """Ventas registradas en ordenes (GET /api/ordenes, solo admin).

    Cada orden ya es una compra con el pago aprobado:
    [{id, usuarioId, total, fechaCreacion, detalles: [{productoId, productoNombre, precioUnitario, cantidad}]}]
    """
    return _con_cache("ordenes", _consultar_ordenes)


def _consultar_ordenes() -> list[dict] | None:
    if not JWT_SECRET:
        return None
    try:
        ordenes = _get_json(
            f"{ORDENES_URL}/api/ordenes",
            headers={"Authorization": f"Bearer {_token_servicio()}"},
        )
        return ordenes if isinstance(ordenes, list) else None
    except Exception:
        return None


def _consultar_productos() -> list[dict] | None:
    try:
        productos = _get_json(f"{CATALOGO_URL}/products")
        return productos if isinstance(productos, list) else None
    except Exception:
        return None


def _consultar_usuarios() -> list[dict] | None:
    if not JWT_SECRET:
        return None
    try:
        usuarios = _get_json(
            f"{AUTH_URL}/usuarios",
            headers={"Authorization": f"Bearer {_token_servicio()}"},
        )
        return usuarios if isinstance(usuarios, list) else None
    except Exception:
        return None
