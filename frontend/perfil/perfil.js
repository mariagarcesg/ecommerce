// ==========================================================================
// ECOMMERCE - MI PERFIL
// Datos reales de la cuenta: usuario (GET /api/auth/me), pedidos
// (GET /api/ordenes/mias) y lista de deseos (window.Favoritos).
// Sin sesión, layout.js ya redirige al Home (página privada).
// ==========================================================================

(async function () {
  const perfil = document.getElementById('perfil');
  const token = window.Sesion.token();
  if (!token) return;

  const NOMBRES_ROL = { admin: 'Administrador', cliente: 'Cliente' };
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto ?? '');
    return div.innerHTML;
  }
  const dinero = (v) => '$' + Number(v || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------- Usuario ----------
  let usuario = window.Sesion.usuario();
  try {
    const res = await fetch('/api/auth/me', auth);
    if (res.ok) usuario = await res.json();
  } catch {}
  if (!usuario) return;

  const rol = NOMBRES_ROL[usuario.rol] || usuario.rol;
  const primerNombre = usuario.nombre.split(' ')[0];
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  document.title = `${usuario.nombre} | Mi Perfil | ECOMMERCE`;
  document.getElementById('perfil-avatar').textContent = window.Sesion.iniciales(usuario.nombre);
  document.getElementById('perfil-saludo').textContent = `${saludo}, ${primerNombre}`;
  document.getElementById('perfil-nombre').textContent = usuario.nombre;
  document.getElementById('perfil-email').textContent = usuario.email;
  document.getElementById('perfil-rol').textContent = rol;
  document.getElementById('perfil-panel-admin').hidden = usuario.rol !== 'admin';
  document.getElementById('dato-nombre').textContent = usuario.nombre;
  document.getElementById('dato-email').textContent = usuario.email;
  document.getElementById('dato-rol').textContent = rol;
  document.getElementById('dato-id').textContent = `#${String(usuario.id).padStart(5, '0')}`;
  perfil.hidden = false;

  // ---------- Pedidos ----------
  const listaPedidos = document.getElementById('perfil-pedidos');
  try {
    const res = await fetch('/api/ordenes/mias', auth);
    if (!res.ok) throw new Error();
    const pedidos = await res.json();

    document.getElementById('kpi-pedidos').textContent = pedidos.length;
    document.getElementById('kpi-gastado').textContent = dinero(pedidos.reduce((acc, o) => acc + Number(o.total), 0));

    listaPedidos.innerHTML = pedidos.length
      ? pedidos.slice(0, 4).map(o => {
          const articulos = (o.detalles || []).map(d => `${d.cantidad}× ${d.productoNombre}`).join(', ');
          const fecha = new Date(o.fechaCreacion).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
          return `
            <li class="perfil-pedido">
              <span class="perfil-pedido__numero">#${o.id}</span>
              <div class="perfil-pedido__info">
                <div class="perfil-pedido__articulos" title="${escapar(articulos)}">${escapar(articulos)}</div>
                <div class="perfil-pedido__fecha">${fecha}</div>
              </div>
              <div class="perfil-pedido__lado">
                <span class="perfil-pedido__total">${dinero(o.total)}</span>
                <span class="perfil-estado">Pagado</span>
              </div>
            </li>`;
        }).join('')
      : '<li class="perfil-vacio">Aún no tienes pedidos. <a href="../catalogo/index.html">Explora el catálogo</a></li>';
  } catch {
    document.getElementById('kpi-pedidos').textContent = '—';
    document.getElementById('kpi-gastado').textContent = '—';
    listaPedidos.innerHTML = '<li class="perfil-vacio">No se pudieron cargar tus pedidos.</li>';
  }

  // ---------- Lista de deseos (se actualiza cuando llega la lista del servidor) ----------
  function pintarFavoritos() {
    const favoritos = window.Favoritos.obtenerItems();
    document.getElementById('kpi-favoritos').textContent = favoritos.length;
    document.getElementById('perfil-favoritos').innerHTML = favoritos.length
      ? favoritos.slice(0, 6).map(f => `
          <article class="perfil-favorito">
            <img src="${escapar(f.imagen)}" alt="" loading="lazy">
            <div class="perfil-favorito__info">
              <div class="perfil-favorito__nombre">${escapar(f.nombre)}</div>
              <div class="perfil-favorito__precio">${dinero(f.precio)}</div>
            </div>
          </article>`).join('')
      : '<p class="perfil-vacio">Tu lista está vacía. Toca el ♥ de un producto en el <a href="../catalogo/index.html">catálogo</a> para guardarlo.</p>';
  }
  pintarFavoritos();
  window.addEventListener('favoritos-actualizado', pintarFavoritos);

  // Abre el panel de favoritos del navbar
  document.getElementById('perfil-ver-favoritos').addEventListener('click', () => {
    document.getElementById('btn-abrir-favoritos')?.click();
  });
})();
