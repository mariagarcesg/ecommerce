// Página de órdenes: solo para usuarios con rol "admin".
// El rol se confirma con GET /api/auth/me (gateway -> auth) en vez de
// confiar en lo guardado en localStorage, que el usuario puede modificar.
// Ojo: esto solo decide qué se muestra; la API de ordenes también debe
// validar el token y el rol para proteger los datos de verdad.
(async function () {
  const contenidoAdmin = document.getElementById('contenido-admin');
  const accesoDenegado = document.getElementById('acceso-denegado');

  const token = Sesion.token();
  if (!token) {
    window.location.replace('../login/index.html');
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      Sesion.cerrar();
      window.location.replace('../login/index.html');
      return;
    }

    const usuario = res.ok ? await res.json() : null;
    if (usuario && usuario.rol === 'admin') {
      contenidoAdmin.hidden = false;
    } else {
      accesoDenegado.hidden = false;
    }
  } catch {
    // Sin conexión con auth no se puede confirmar el rol: se niega el acceso
    accesoDenegado.hidden = false;
  }
})();
