// Navbar común a todas las páginas y manejo de la sesión.
// Cada página solo incluye este script. Las rutas son relativas
// (todas las páginas están a un nivel: catalogo/, login/).

// ---------- Sesión ----------
// El token JWT lo emite el microservicio auth. Se guarda en localStorage
// y se envía como "Authorization: Bearer <token>" a la API.
window.Sesion = (function () {
  const CLAVE_TOKEN = 'token';
  const CLAVE_USUARIO = 'usuario';

  function leer(clave) {
    try { return localStorage.getItem(clave); } catch { return null; }
  }

  // Lee la fecha de expiración (exp) del JWT sin verificar la firma:
  // solo sirve para no mostrar una sesión vencida. Quien valida de verdad es auth.
  function tokenVencido(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(base64));
      return !exp || exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  return {
    guardar(token, usuario) {
      try {
        localStorage.setItem(CLAVE_TOKEN, token);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
      } catch { /* sin localStorage la sesión dura solo esta página */ }
    },
    cerrar() {
      try {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_USUARIO);
      } catch { /* nada que limpiar */ }
    },
    token() {
      const token = leer(CLAVE_TOKEN);
      return token && !tokenVencido(token) ? token : null;
    },
    usuario() {
      if (!this.token()) return null;
      try { return JSON.parse(leer(CLAVE_USUARIO)); } catch { return null; }
    },
    // "María García" -> "MG", "Admin" -> "A" (para el avatar)
    iniciales(nombre) {
      const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
      if (partes.length === 0) return '?';
      const primera = partes[0][0];
      const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
      return (primera + ultima).toUpperCase();
    },
  };
})();

// ---------- Navbar ----------
(function () {
  const iconoLupa = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
    </svg>`;

  const iconoCarrito = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="20" r="1.5"></circle>
      <circle cx="18" cy="20" r="1.5"></circle>
      <path d="M2 3h3l2.7 12.4a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6"></path>
    </svg>`;

  const iconoUsuario = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4"></circle>
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"></path>
    </svg>`;

  const iconoSalir = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>`;

  const iconoOrdenes = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2"></rect>
      <path d="M9 4V3h6v1"></path>
      <line x1="9" y1="10" x2="15" y2="10"></line>
      <line x1="9" y1="14" x2="15" y2="14"></line>
    </svg>`;

  const header = document.createElement('header');
  header.className = 'navbar';
  header.innerHTML = `
    <a class="navbar__marca" href="../catalogo/index.html">ecommerce</a>

    <form class="buscador" role="search">
      <span class="buscador__icono">${iconoLupa}</span>
      <input class="buscador__input" type="search" name="q"
             placeholder="Buscar productos" aria-label="Buscar productos">
    </form>

    <nav class="navbar__acciones">
      <span class="navbar__saludo" hidden></span>
      <a class="avatar" data-avatar href="../perfil/index.html" hidden
         aria-label="Mi perfil" title="Mi perfil"></a>
      <a class="icono-boton" data-solo-admin href="../ordenes/index.html" hidden
         aria-label="Órdenes" title="Órdenes">
        ${iconoOrdenes}
      </a>
      <!-- Pendiente: página del carrito -->
      <button class="icono-boton" type="button" aria-label="Carrito de compras" title="Carrito">
        ${iconoCarrito}
      </button>
      <a class="icono-boton" data-sin-sesion href="../login/index.html"
         aria-label="Iniciar sesión" title="Iniciar sesión">
        ${iconoUsuario}
      </a>
      <button class="icono-boton" data-con-sesion type="button" hidden
              aria-label="Cerrar sesión" title="Cerrar sesión">
        ${iconoSalir}
      </button>
    </nav>
  `;

  const iconoDashboard = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2"></rect>
      <rect x="14" y="3" width="7" height="7" rx="2"></rect>
      <rect x="3" y="14" width="7" height="7" rx="2"></rect>
      <rect x="14" y="14" width="7" height="7" rx="2"></rect>
    </svg>`;

  const iconoCatalogo = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7l9-4 9 4-9 4-9-4z"></path>
      <path d="M3 7v10l9 4 9-4V7"></path>
      <line x1="12" y1="11" x2="12" y2="21"></line>
    </svg>`;

  const iconoFlecha = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="15 6 9 12 15 18"></polyline>
    </svg>`;

  // ---------- Sidebar de administración ----------
  // Se agrega en todas las páginas y solo se muestra al admin.
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.hidden = true;
  sidebar.innerHTML = `
    <div class="sidebar__tarjeta">
      <button class="sidebar__colapsar" type="button">${iconoFlecha}</button>
      <h2 class="sidebar__titulo">Administración</h2>
      <nav aria-label="Administración">
        <!-- Pendiente: Dashboard (reportes) aún no tiene microservicio ni página -->
        <button class="sidebar__enlace" type="button" title="Dashboard">
          ${iconoDashboard}
          <span class="sidebar__texto">Dashboard</span>
        </button>
        <a class="sidebar__enlace" href="../ordenes/index.html" title="Órdenes">
          ${iconoOrdenes}
          <span class="sidebar__texto">Órdenes</span>
        </a>
        <a class="sidebar__enlace" href="../catalogo/index.html" title="Catálogo">
          ${iconoCatalogo}
          <span class="sidebar__texto">Catálogo</span>
        </a>
      </nav>
    </div>
  `;

  // Marca el enlace de la página actual
  sidebar.querySelectorAll('a.sidebar__enlace').forEach((enlace) => {
    if (enlace.pathname === window.location.pathname
        || enlace.pathname.replace(/index\.html$/, '') === window.location.pathname) {
      enlace.setAttribute('aria-current', 'page');
    }
  });

  const botonColapsar = sidebar.querySelector('.sidebar__colapsar');
  const CLAVE_COLAPSADO = 'sidebarColapsado';

  function aplicarColapsado(colapsado) {
    sidebar.classList.toggle('sidebar--colapsado', colapsado);
    botonColapsar.setAttribute('aria-expanded', String(!colapsado));
    const texto = colapsado ? 'Expandir menú' : 'Colapsar menú';
    botonColapsar.setAttribute('aria-label', texto);
    botonColapsar.title = texto;
  }

  // Recuerda entre páginas si el admin dejó el menú colapsado
  let colapsado = false;
  try { colapsado = localStorage.getItem(CLAVE_COLAPSADO) === '1'; } catch { /* sin localStorage: expandido */ }
  aplicarColapsado(colapsado);

  botonColapsar.addEventListener('click', () => {
    colapsado = !colapsado;
    aplicarColapsado(colapsado);
    try { localStorage.setItem(CLAVE_COLAPSADO, colapsado ? '1' : '0'); } catch { /* solo dura esta página */ }
  });

  // El contenido de la página va junto al sidebar dentro de .pagina,
  // así el sidebar reserva su columna y no tapa nada.
  const pagina = document.createElement('div');
  pagina.className = 'pagina';
  pagina.append(sidebar);
  Array.from(document.body.children)
    .filter((el) => el.tagName !== 'SCRIPT')
    .forEach((el) => pagina.append(el));
  document.body.prepend(pagina);

  const avatar = header.querySelector('[data-avatar]');
  const saludo = header.querySelector('.navbar__saludo');
  const botonLogin = header.querySelector('[data-sin-sesion]');
  const botonLogout = header.querySelector('[data-con-sesion]');
  const enlaceOrdenes = header.querySelector('[data-solo-admin]');

  function pintarSesion() {
    const usuario = Sesion.usuario();
    const esAdmin = !!usuario && usuario.rol === 'admin';
    // textContent (no innerHTML): el nombre lo escribe el usuario y no debe interpretarse como HTML
    saludo.textContent = usuario ? `Bienvenido, ${usuario.nombre}!` : '';
    saludo.hidden = !usuario;
    avatar.textContent = usuario ? Sesion.iniciales(usuario.nombre) : '';
    avatar.hidden = !usuario;
    botonLogin.hidden = !!usuario;
    botonLogout.hidden = !usuario;
    // Solo ocultan la navegación; la página de órdenes vuelve a comprobar el rol con auth
    enlaceOrdenes.hidden = !esAdmin;
    sidebar.hidden = !esAdmin;
  }

  botonLogout.addEventListener('click', async () => {
    const token = Sesion.token();
    if (token) {
      try {
        // auth marca el token como revocado en Redis
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* aunque falle la red, la sesión se cierra en este navegador */ }
    }
    Sesion.cerrar();
    pintarSesion();
  });

  // Pendiente: conectar la búsqueda con el microservicio de catálogo.
  header.querySelector('.buscador').addEventListener('submit', (e) => e.preventDefault());

  document.body.prepend(header);
  pintarSesion();

  // Confirma con auth que la sesión sigue siendo válida (pudo cerrarse en otra pestaña).
  const token = Sesion.token();
  if (token) {
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) {
          Sesion.cerrar();
          pintarSesion();
        }
      })
      .catch(() => { /* sin conexión con auth: se mantiene lo guardado */ });
  }
})();
