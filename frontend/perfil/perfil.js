// ==========================================================================
// ECOMMERCE - CONTROLADOR DE PERFIL DE USUARIO
// ==========================================================================

(async function () {
  const perfil = document.getElementById('perfil');
  const error = document.getElementById('perfil-error');
  const NOMBRES_ROL = { admin: 'Administrador / Vendedor', cliente: 'Cliente / Comprador' };

  let usuario = window.Sesion.usuario();
  const token = window.Sesion.token();

  if (!usuario && !token) {
    if (error) error.hidden = false;
    return;
  }

  // Si hay token, intentamos confirmar con /api/auth/me
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        usuario = await res.json();
      }
    } catch {}
  }

  if (usuario) {
    const rol = NOMBRES_ROL[usuario.rol] || usuario.rol;
    document.getElementById('perfil-avatar').textContent = window.Sesion.iniciales(usuario.nombre);
    document.getElementById('perfil-nombre').textContent = usuario.nombre;
    document.getElementById('perfil-rol').textContent = rol;
    document.getElementById('dato-nombre').textContent = usuario.nombre;
    document.getElementById('dato-email').textContent = usuario.email;
    document.getElementById('dato-rol').textContent = rol;
    document.getElementById('dato-id').textContent = usuario.id || '#102';
    perfil.hidden = false;
  } else {
    if (error) error.hidden = false;
  }
})();
