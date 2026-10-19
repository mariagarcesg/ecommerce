// Perfil: muestra los datos del usuario logueado.
// Los pide a GET /api/auth/me (gateway -> auth) para mostrar lo que hay
// en la base de datos y no lo guardado en localStorage.
(async function () {
  const perfil = document.getElementById('perfil');
  const error = document.getElementById('perfil-error');
  const NOMBRES_ROL = { admin: 'Administrador', cliente: 'Cliente' };

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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const usuario = await res.json();
    const rol = NOMBRES_ROL[usuario.rol] || usuario.rol;

    // textContent (no innerHTML): son datos que escribió el usuario
    document.getElementById('perfil-avatar').textContent = Sesion.iniciales(usuario.nombre);
    document.getElementById('perfil-nombre').textContent = usuario.nombre;
    document.getElementById('perfil-rol').textContent = rol;
    document.getElementById('dato-nombre').textContent = usuario.nombre;
    document.getElementById('dato-email').textContent = usuario.email;
    document.getElementById('dato-rol').textContent = rol;
    document.getElementById('dato-id').textContent = usuario.id;
    perfil.hidden = false;
  } catch {
    error.hidden = false;
  }
})();
