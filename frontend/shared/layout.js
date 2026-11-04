// ==========================================================================
// ECOMMERCE - LAYOUT COMPARTIDO, SESIÓN, CARRITO Y PASARELA DE PAGOS
// ==========================================================================

// ---------- 1. Manejo de Sesión (Go + PostgreSQL + Redis) ----------
window.Sesion = (function () {
  const CLAVE_TOKEN = 'token';
  const CLAVE_USUARIO = 'usuario';

  function leer(clave) {
    try { return localStorage.getItem(clave); } catch { return null; }
  }

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
      } catch (e) { console.warn('No se pudo guardar la sesión en localStorage', e); }
      window.dispatchEvent(new CustomEvent('sesion-cambiada'));
    },
    cerrar() {
      try {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_USUARIO);
      } catch (e) { console.warn(e); }
      window.dispatchEvent(new CustomEvent('sesion-cambiada'));
    },
    token() {
      const token = leer(CLAVE_TOKEN);
      return token && !tokenVencido(token) ? token : null;
    },
    usuario() {
      if (!this.token()) return null;
      try { return JSON.parse(leer(CLAVE_USUARIO)); } catch { return null; }
    },
    esAdmin() {
      const u = this.usuario();
      return !!u && u.rol === 'admin';
    },
    // Página de inicio tras iniciar sesión (ruta relativa a /login/): todos van
    // al Home; el admin llega al panel desde el navbar (Analítica / menú)
    paginaInicio() {
      return '../home/index.html';
    },
    // Reglas de toda contraseña nueva (las mismas que valida auth): devuelve
    // cada regla con si se cumple, para mostrarlas como lista mientras se escribe
    reglasContrasena(clave) {
      const largo = [...clave].length;
      return [
        { texto: 'Entre 8 y 16 caracteres', ok: largo >= 8 && largo <= 16 },
        { texto: 'Una letra mayúscula', ok: /\p{Lu}/u.test(clave) },
        { texto: 'Una letra minúscula', ok: /\p{Ll}/u.test(clave) },
        { texto: 'Un número', ok: /\d/.test(clave) },
        { texto: 'Sin espacios al inicio ni al final', ok: clave === clave.trim() },
        { texto: 'Sin espacios dobles', ok: !clave.includes('  ') }
      ];
    },
    errorContrasena(clave) {
      if (!clave) return 'Ingresa una contraseña.';
      const pendiente = this.reglasContrasena(clave).find(r => !r.ok);
      return pendiente ? `La contraseña necesita: ${pendiente.texto.toLowerCase()}.` : '';
    },
    iniciales(nombre) {
      const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
      if (partes.length === 0) return '?';
      const primera = partes[0][0];
      const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
      return (primera + ultima).toUpperCase();
    }
  };
})();

// ---------- 2. Carrito de Compras (IDEA 05 & IDEA 09 - Cupones) ----------
// El carrito es de cada cuenta y vive en el servidor (catalogo, /api/catalogo/carrito).
// Se guarda una copia local por usuario solo para mostrarlo al instante al cargar.
window.Carrito = (function () {
  const IMAGEN_POR_DEFECTO = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80';

  // Cupones de la tienda: el descuento aplica solo a los productos de esa
  // categoría (ordenes valida lo mismo al registrar la venta)
  const CUPONES = {
    PROFE20: { codigo: 'PROFE20', porcentaje: 20, categoria: 'Laptops', descripcion: '20% OFF en laptops' }
  };
  const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

  let items = [];
  let cupon = null;

  // Versión anterior: un solo carrito para todo el navegador, compartido entre cuentas
  try { ['ecommerce_carrito', 'ecommerce_cupon'].forEach(k => localStorage.removeItem(k)); } catch {}

  const usuarioId = () => window.Sesion.usuario()?.id;
  const claveLocal = () => `ecommerce_carrito_${usuarioId()}`;

  try {
    if (usuarioId()) {
      const guardado = JSON.parse(localStorage.getItem(claveLocal())) || {};
      items = guardado.items || [];
      cupon = CUPONES[guardado.cupon] || null;
    }
  } catch { items = []; cupon = null; }

  const aplicaCupon = (it, c = cupon) => !!c && normalizar(it.categoria) === normalizar(c.categoria);
  if (cupon && !items.some(it => aplicaCupon(it))) cupon = null;

  // Producto del catálogo + cantidad -> ítem del carrito
  const aItem = (p, cantidad) => ({
    id: p._id || p.id,
    nombre: p.name || p.nombre,
    precio: Number(p.price ?? p.precio),
    imagen: p.imagen || IMAGEN_POR_DEFECTO,
    // El catálogo trae la categoría poblada ({name}) o ya como texto
    categoria: p.category?.name || p.category || p.categoria || '',
    stock: p.stock !== undefined ? p.stock : 999,
    cantidad
  });

  // Los cambios se envían al servidor agrupados (varios clics seguidos = un PUT)
  let envioPendiente = null;
  function guardarEnServidor() {
    clearTimeout(envioPendiente);
    envioPendiente = setTimeout(() => {
      const token = window.Sesion.token();
      if (!token) return;
      fetch('/api/catalogo/carrito', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: items.map(it => ({ productoId: String(it.id), cantidad: it.cantidad })),
          cupon: cupon?.codigo || null
        })
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }).catch(() => {
        window.Notificaciones?.toast('No se pudo guardar tu carrito. Revisa tu conexión.', 'alerta');
      });
    }, 400);
  }

  function persistir({ sincronizar = true } = {}) {
    // Si ya no queda ningún producto al que aplique el cupón, se quita solo
    if (cupon && !items.some(it => aplicaCupon(it))) {
      window.Notificaciones?.toast(`Se quitó el cupón ${cupon.codigo}: ya no hay productos de ${cupon.categoria} en el carrito.`, 'info');
      cupon = null;
    }
    try {
      if (usuarioId()) localStorage.setItem(claveLocal(), JSON.stringify({ items, cupon: cupon?.codigo || null }));
    } catch (e) { console.warn(e); }
    window.dispatchEvent(new CustomEvent('carrito-actualizado', { detail: { items, cupon } }));
    if (sincronizar) guardarEnServidor();
  }

  // Al cargar cualquier página con sesión se trae el carrito real de la cuenta
  // (con precios y stock actuales del catálogo)
  if (window.Sesion.token()) {
    fetch('/api/catalogo/carrito', { headers: { Authorization: `Bearer ${window.Sesion.token()}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(datos => {
        items = (datos.items || []).map(it => aItem(it.producto, it.cantidad));
        cupon = CUPONES[datos.cupon] || null;
        persistir({ sincronizar: false });
      })
      .catch(() => {});
  }

  return {
    obtenerItems() { return [...items]; },
    conteo() { return items.reduce((acc, it) => acc + (it.cantidad || 1), 0); },
    subtotal() {
      return items.reduce((acc, it) => acc + (Number(it.precio) * (it.cantidad || 1)), 0);
    },
    obtenerCupon() { return cupon; },
    // Solo sobre los productos de la categoría del cupón, redondeado a centavos como en ordenes
    descuento() {
      if (!cupon) return 0;
      const base = items.filter(it => aplicaCupon(it)).reduce((acc, it) => acc + Number(it.precio) * (it.cantidad || 1), 0);
      return Math.round(base * cupon.porcentaje) / 100;
    },
    total() {
      const t = this.subtotal() - this.descuento();
      return t > 0 ? t : 0;
    },
    // Comprar es por cuenta: sin sesión se manda al login con un aviso. Devuelve true si hay sesión.
    exigirSesion() {
      if (window.Sesion.token()) return true;
      try { sessionStorage.setItem('avisoPendiente', '¡Regístrate o inicia sesión para armar tu carrito de compras!'); } catch {}
      window.location.href = '../login/index.html';
      return false;
    },
    agregar(prod, cant = 1) {
      if (!this.exigirSesion()) return false;
      const idx = items.findIndex(it => String(it.id) === String(prod.id || prod._id));
      const disponible = prod.stock !== undefined ? prod.stock : 999;
      if (disponible <= 0) {
        window.Notificaciones.toast('Este producto está agotado.', 'alerta');
        return false;
      }
      if (idx >= 0) {
        if (items[idx].cantidad + cant > disponible) {
          window.Notificaciones.toast(`Solo hay ${disponible} unidades disponibles de este producto.`, 'alerta');
          items[idx].cantidad = disponible;
        } else {
          items[idx].cantidad += cant;
        }
      } else {
        items.push(aItem(prod, Math.min(cant, disponible)));
      }
      persistir();
      window.Notificaciones.toast(`"${prod.name || prod.nombre}" agregado al carrito.`, 'exito');
      return true;
    },
    actualizarCantidad(id, cant) {
      const idx = items.findIndex(it => String(it.id) === String(id));
      if (idx >= 0) {
        if (cant <= 0) {
          items.splice(idx, 1);
        } else {
          items[idx].cantidad = Math.min(cant, items[idx].stock || 999);
        }
        persistir();
      }
    },
    quitar(id) {
      items = items.filter(it => String(it.id) !== String(id));
      persistir();
      window.Notificaciones.toast('Producto retirado del carrito.', 'info');
    },
    aplicarCupon(codigo) {
      const nuevo = CUPONES[String(codigo || '').trim().toUpperCase()];
      if (!nuevo) {
        return { ok: false, error: 'Cupón no válido o expirado. Prueba con PROFE20 en laptops.' };
      }
      if (!items.some(it => aplicaCupon(it, nuevo))) {
        return { ok: false, error: `El cupón ${nuevo.codigo} solo aplica a ${nuevo.categoria.toLowerCase()}. Agrega una al carrito.` };
      }
      cupon = nuevo;
      persistir();
      window.Notificaciones.toast(`¡Cupón ${cupon.codigo} aplicado! ${cupon.porcentaje}% de descuento en ${cupon.categoria.toLowerCase()}.`, 'exito');
      return { ok: true, cupon };
    },
    quitarCupon() {
      cupon = null;
      persistir();
      window.Notificaciones.toast('Cupón removido.', 'info');
    },
    limpiar() {
      items = [];
      cupon = null;
      persistir();
    }
  };
})();

// ---------- 3. Lista de Deseos / Favoritos (IDEA 10) ----------
// La lista es de cada cuenta y vive en el servidor (catalogo, /api/catalogo/favoritos).
// Se guarda una copia local por usuario solo para mostrarla al instante al cargar.
window.Favoritos = (function () {
  const IMAGEN_POR_DEFECTO = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80';
  let items = [];

  // Versión anterior: una sola lista para todo el navegador, compartida entre cuentas
  try { localStorage.removeItem('ecommerce_favoritos'); } catch {}

  const usuarioId = () => window.Sesion.usuario()?.id;
  const claveLocal = () => `ecommerce_favoritos_${usuarioId()}`;

  try { if (usuarioId()) items = JSON.parse(localStorage.getItem(claveLocal())) || []; } catch { items = []; }

  function persistir() {
    try { if (usuarioId()) localStorage.setItem(claveLocal(), JSON.stringify(items)); } catch (e) { console.warn(e); }
    window.dispatchEvent(new CustomEvent('favoritos-actualizado', { detail: { items } }));
  }

  // Producto del catálogo -> ítem de la lista
  const aItem = (p) => ({
    id: p._id || p.id,
    nombre: p.name || p.nombre,
    precio: Number(p.price ?? p.precio),
    imagen: p.imagen || IMAGEN_POR_DEFECTO,
    categoria: p.category?.name || p.category || p.categoria || '',
    stock: p.stock
  });

  async function api(metodo, productoId = '') {
    const res = await fetch(`/api/catalogo/favoritos/${productoId}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${window.Sesion.token()}` }
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(datos.message || datos.error || `Error ${res.status}`);
    return datos.map(aItem);
  }

  // Al cargar cualquier página con sesión se trae la lista real de la cuenta
  if (window.Sesion.token()) {
    api('GET').then((lista) => { items = lista; persistir(); }).catch(() => {});
  }

  return {
    obtenerItems() { return [...items]; },
    conteo() { return items.length; },
    esFavorito(id) {
      return items.some(it => String(it.id) === String(id));
    },
    // La lista de deseos es de cada cuenta: sin sesión se manda al login con un aviso.
    // Devuelve true si hay sesión.
    exigirSesion() {
      if (window.Sesion.token()) return true;
      try { sessionStorage.setItem('avisoPendiente', '¡Regístrate o inicia sesión para armar tu lista de deseos!'); } catch {}
      window.location.href = '../login/index.html';
      return false;
    },
    // Se marca/desmarca al instante y se guarda en el servidor; si falla, se revierte
    toggle(prod) {
      if (!this.exigirSesion()) return false;
      const id = prod.id || prod._id;
      const nombre = prod.name || prod.nombre;
      const anterior = [...items];
      const quitar = items.some(it => String(it.id) === String(id));

      items = quitar ? items.filter(it => String(it.id) !== String(id)) : [...items, aItem(prod)];
      persistir();
      window.Notificaciones.toast(quitar
        ? `"${nombre}" eliminado de favoritos.`
        : `"${nombre}" guardado en lista de deseos ❤️`, quitar ? 'info' : 'exito');

      api(quitar ? 'DELETE' : 'PUT', id)
        .then((lista) => { items = lista; persistir(); })
        .catch((err) => {
          items = anterior;
          persistir();
          window.Notificaciones.toast(`No se pudo actualizar tu lista de deseos: ${err.message}`, 'alerta');
        });
      return !quitar;
    }
  };
})();

// ---------- 4. Motor de Notificaciones en Tiempo Real (IDEA 02) ----------
window.Notificaciones = (function () {
  let contenedor = null;

  function asegurarContenedor() {
    if (!contenedor) {
      contenedor = document.createElement('div');
      contenedor.className = 'toast-contenedor';
      document.body.appendChild(contenedor);
    }
  }

  return {
    toast(mensaje, tipo = 'info') {
      asegurarContenedor();
      const t = document.createElement('div');
      t.className = `toast toast--${tipo}`;
      
      let icono = '🔔';
      if (tipo === 'exito') icono = '✓';
      if (tipo === 'alerta') icono = '⚠️';
      
      t.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
      contenedor.appendChild(t);

      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
        t.style.transition = 'all 0.2s';
        setTimeout(() => t.remove(), 250);
      }, 3500);
    }
  };
})();

// ---------- 5. Renderizado de Navbar, Drawers y Modales ----------
(function () {
  // Íconos SVG
  const iconoLupa = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>`;
  const iconoCarrito = `<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle><path d="M2 3h3l2.7 12.4a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6"></path></svg>`;
  const iconoCorazon = `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  const iconoUsuario = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"></path></svg>`;
  const iconoSalir = `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
  const iconoOrdenes = `<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"></rect><path d="M9 4V3h6v1"></path><line x1="9" y1="10" x2="15" y2="10"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`;
  const iconoAdmin = `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"></path></svg>`;
  const iconoReportes = `<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="20"></line><rect x="6" y="11" width="3" height="7"></rect><rect x="11" y="6" width="3" height="12"></rect><rect x="16" y="13" width="3" height="5"></rect></svg>`;
  const iconoCerrar = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  const iconoCatalogo = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>`;
  const iconoMenu = `<svg viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>`;
  const iconoInicio = `<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M10 20v-6h4v6"></path></svg>`;

  // Banner Promocional Cupón PROFE20
  const banner = document.createElement('aside');
  banner.className = 'banner-promo';
  banner.innerHTML = `
    🔥 ¡Gran Inauguración! Usa el cupón <span class="banner-promo__codigo" id="btn-copiar-cupon" title="Clic para copiar">PROFE20</span> para 20% OFF en laptops.
  `;
  document.body.prepend(banner);

  document.getElementById('btn-copiar-cupon')?.addEventListener('click', () => {
    navigator.clipboard?.writeText('PROFE20');
    window.Notificaciones.toast('Código "PROFE20" copiado al portapapeles', 'exito');
  });

  // Navbar
  const header = document.createElement('header');
  header.className = 'navbar';
  header.innerHTML = `
    <a class="navbar__marca-link" href="../home/index.html">
      <span class="navbar__logo-badge">E</span>
      <div class="navbar__marca-texto">
        <span class="navbar__marca-nombre">ECOMMERCE</span>
        <span class="navbar__marca-sub">ROJO & BLANCO</span>
      </div>
    </a>

    <form class="buscador" id="form-buscador-global" role="search">
      <span class="buscador__icono">${iconoLupa}</span>
      <input class="buscador__input" id="input-buscador-global" type="search" name="q"
             placeholder="Buscar laptops, calzado, accesorios..." aria-label="Buscar productos">
    </form>

    <nav class="navbar__acciones">
      <a class="icono-boton" id="btn-nav-productos" href="../catalogo/index.html" title="Productos" aria-label="Productos">
        ${iconoCatalogo}
      </a>

      <!-- Botón Favoritos -->
      <button class="icono-boton" id="btn-abrir-favoritos" type="button" title="Lista de Deseos">
        ${iconoCorazon}
        <span class="badge-contador" id="conteo-favoritos" hidden>0</span>
      </button>

      <!-- Botón Carrito -->
      <button class="icono-boton" id="btn-abrir-carrito" type="button" title="Carrito de Compras">
        ${iconoCarrito}
        <span class="badge-contador" id="conteo-carrito" hidden>0</span>
      </button>

      <a class="icono-boton" id="btn-nav-reportes" data-solo-admin href="../admin/index.html#analitica" hidden title="Analítica" aria-label="Analítica">
        ${iconoReportes}
      </a>

      <!-- Menú desplegable con el resto de las páginas -->
      <div class="menu-nav" id="menu-nav">
        <button class="icono-boton" id="btn-menu-nav" type="button" title="Más opciones"
                aria-label="Más opciones" aria-haspopup="menu" aria-expanded="false" aria-controls="menu-nav-lista">
          ${iconoMenu}
        </button>
        <div class="menu-nav__lista" id="menu-nav-lista" role="menu" hidden>
          <div class="menu-nav__cabecera" id="nav-saludo" hidden></div>
          <a class="menu-nav__item" role="menuitem" href="../home/index.html">${iconoInicio}<span>Inicio</span></a>
          <a class="menu-nav__item" role="menuitem" href="../ordenes/index.html">${iconoOrdenes}<span>Mis pedidos</span></a>
          <a class="menu-nav__item" role="menuitem" href="../perfil/index.html" id="btn-nav-perfil" hidden>${iconoUsuario}<span>Mi perfil</span></a>
          <a class="menu-nav__item" role="menuitem" href="../admin/index.html" id="btn-nav-admin" data-solo-admin hidden>${iconoAdmin}<span>Panel de administración</span></a>
        </div>
      </div>

      <!-- Avatar o Login -->
      <a class="avatar" id="nav-avatar" href="../perfil/index.html" hidden title="Mi Perfil"></a>
      <a class="boton boton--sm" id="btn-nav-login" href="../login/index.html">Ingresar</a>
      <button class="icono-boton" id="btn-nav-logout" type="button" hidden title="Cerrar Sesión">
        ${iconoSalir}
      </button>
    </nav>
  `;
  document.body.prepend(header);

  // ---------- Drawers (Carrito y Favoritos) ----------
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.id = 'drawer-backdrop';
  document.body.appendChild(backdrop);

  // Drawer Carrito
  const drawerCarrito = document.createElement('aside');
  drawerCarrito.className = 'drawer';
  drawerCarrito.id = 'drawer-carrito';
  drawerCarrito.innerHTML = `
    <div class="drawer__cabecera">
      <h2 class="drawer__titulo">Tu Carrito de Compras</h2>
      <button class="drawer__cerrar" id="btn-cerrar-carrito" type="button" aria-label="Cerrar">${iconoCerrar}</button>
    </div>
    <div class="drawer__cuerpo" id="carrito-items-lista"></div>
    <div class="drawer__pie">
      <div class="seccion-cupon">
        <input type="text" id="input-cupon" placeholder="Cupón (PROFE20: 20% en laptops)">
        <button class="boton boton--secundario boton--sm" id="btn-aplicar-cupon" type="button">Aplicar</button>
      </div>
      <div id="cupon-aplicado-banner"></div>
      <div class="resumen-totales">
        <div class="resumen-fila"><span>Subtotal:</span><span id="resumen-subtotal">$0.00</span></div>
        <div class="resumen-fila resumen-fila--descuento" id="fila-descuento" hidden>
          <span>Descuento (<span id="txt-cupon-desc">0%</span>):</span>
          <span id="resumen-descuento">-$0.00</span>
        </div>
        <div class="resumen-fila"><span>Envío:</span><span style="color:var(--color-exito);font-weight:700">GRATIS</span></div>
        <div class="resumen-fila resumen-fila--total"><span>Total a pagar:</span><span id="resumen-total">$0.00</span></div>
      </div>
      <button class="boton boton--bloque" id="btn-proceder-pago" type="button">Proceder al Pago</button>
    </div>
  `;
  document.body.appendChild(drawerCarrito);

  // Drawer Favoritos (Wishlist)
  const drawerFavoritos = document.createElement('aside');
  drawerFavoritos.className = 'drawer';
  drawerFavoritos.id = 'drawer-favoritos';
  drawerFavoritos.innerHTML = `
    <div class="drawer__cabecera">
      <h2 class="drawer__titulo">Lista de Deseos</h2>
      <button class="drawer__cerrar" id="btn-cerrar-favoritos" type="button" aria-label="Cerrar">${iconoCerrar}</button>
    </div>
    <div class="drawer__cuerpo" id="favoritos-items-lista"></div>
  `;
  document.body.appendChild(drawerFavoritos);

  // Modal Checkout y Pasarela de Pagos (IDEA 03)
  const modalCheckout = document.createElement('div');
  modalCheckout.className = 'modal-backdrop';
  modalCheckout.id = 'modal-checkout';
  modalCheckout.innerHTML = `
    <div class="modal">
      <div class="modal__cabecera">
        <h2 class="modal__titulo">Pasarela de Pagos y Confirmación</h2>
        <button class="drawer__cerrar" style="color:var(--color-texto)" id="btn-cerrar-modal-pago" type="button" title="Cerrar" aria-label="Cerrar pasarela de pagos">${iconoCerrar}</button>
      </div>
      <div class="modal__cuerpo">
        <div class="caja-info-pago">
          <strong>Reglas de Simulación de Pago Seguro:</strong>
          • Tarjeta terminada en <strong>1234</strong>: Pago aprobado instantáneamente.<br>
          • Tarjeta terminada en <strong>0000</strong>: Pago rechazado y reversión automática sin cobro.<br>
          Elige cuál usar con los botones bajo el número de tarjeta.
        </div>
        <form id="form-checkout" novalidate>
          <div class="form-grupo" style="margin-bottom:12px">
            <label for="chk-nombre">Nombre completo</label>
            <input type="text" id="chk-nombre" maxlength="80" autocomplete="name" required placeholder="Ej: Juan Pérez">
            <small class="form-grupo__error" id="chk-nombre-error"></small>
          </div>
          <div class="form-grupo" style="margin-bottom:12px">
            <label for="chk-direccion">Dirección de Entrega</label>
            <input type="text" id="chk-direccion" maxlength="150" autocomplete="street-address" required placeholder="Ej: Av Principal 123 - Apto 4B">
            <small class="form-grupo__error" id="chk-direccion-error"></small>
          </div>
          <div class="form-fila" style="margin-bottom:12px">
            <div class="form-grupo">
              <label for="chk-telefono">Teléfono</label>
              <input type="tel" id="chk-telefono" inputmode="numeric" maxlength="15" autocomplete="tel" required placeholder="Ej: 04141234567">
              <small class="form-grupo__error" id="chk-telefono-error"></small>
            </div>
            <div class="form-grupo">
              <label for="chk-ciudad">Ciudad</label>
              <input type="text" id="chk-ciudad" maxlength="60" autocomplete="address-level2" required placeholder="Ej: Caracas">
              <small class="form-grupo__error" id="chk-ciudad-error"></small>
            </div>
          </div>
          <!-- Datos de la tarjeta de prueba: solo lectura; se elige cuál usar con los botones -->
          <div class="form-grupo" style="margin-bottom:12px">
            <label for="chk-tarjeta">Número de Tarjeta de Prueba</label>
            <input type="text" id="chk-tarjeta" readonly tabindex="-1" value="4532 0000 0000 1234">
            <div class="chk-tarjetas" role="group" aria-label="Tarjeta de prueba">
              <button type="button" class="chip chip--activo" data-tarjeta="4532 0000 0000 1234" aria-pressed="true">Aprobada (…1234)</button>
              <button type="button" class="chip" data-tarjeta="4532 0000 0000 0000" aria-pressed="false">Rechazada (…0000)</button>
            </div>
          </div>
          <div class="form-fila" style="margin-bottom:16px">
            <div class="form-grupo">
              <label for="chk-exp">Fecha Exp.</label>
              <input type="text" id="chk-exp" readonly tabindex="-1" value="12/28">
            </div>
            <div class="form-grupo">
              <label for="chk-cvv">CVV</label>
              <input type="text" id="chk-cvv" readonly tabindex="-1" value="789">
            </div>
          </div>

          <div style="background-color:var(--color-fondo);padding:12px;border-radius:var(--radio);margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;font-weight:700">
              <span>Total a cargar:</span>
              <span id="chk-total-mostrar" style="color:var(--color-rojo-principal);font-size:1.15rem">$0.00</span>
            </div>
          </div>

          <button class="boton boton--bloque" id="btn-confirmar-pago" type="submit">Pagar y Confirmar Pedido</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modalCheckout);

  // ---------- Controladores de Interfaz ----------
  function actualizarBadges() {
    const cCarrito = window.Carrito.conteo();
    const cFav = window.Favoritos.conteo();
    const bCarrito = document.getElementById('conteo-carrito');
    const bFav = document.getElementById('conteo-favoritos');

    if (bCarrito) {
      bCarrito.textContent = cCarrito;
      bCarrito.hidden = cCarrito === 0;
    }
    if (bFav) {
      bFav.textContent = cFav;
      bFav.hidden = cFav === 0;
    }
  }

  function renderizarCarrito() {
    const contenedor = document.getElementById('carrito-items-lista');
    if (!contenedor) return;

    const items = window.Carrito.obtenerItems();
    if (items.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--color-texto-suave)">
          <p style="font-size:2.5rem;margin-bottom:10px">🛒</p>
          <p style="font-weight:700">Tu carrito está vacío</p>
          <p style="font-size:0.85rem;margin-top:6px">Explora el catálogo y agrega productos.</p>
        </div>
      `;
    } else {
      contenedor.innerHTML = items.map(it => `
        <div class="item-carrito">
          <img class="item-carrito__img" src="${it.imagen}" alt="${it.nombre}">
          <div class="item-carrito__info">
            <h4 class="item-carrito__nombre">${it.nombre}</h4>
            <div class="item-carrito__precio">$${it.precio.toFixed(2)}</div>
            <div class="item-carrito__controles">
              <button class="btn-qty" onclick="Carrito.actualizarCantidad('${it.id}', ${it.cantidad - 1})">-</button>
              <span style="font-weight:700;font-size:0.9rem;min-width:20px;text-align:center">${it.cantidad}</span>
              <button class="btn-qty" onclick="Carrito.actualizarCantidad('${it.id}', ${it.cantidad + 1})">+</button>
            </div>
          </div>
          <button class="item-carrito__eliminar" onclick="Carrito.quitar('${it.id}')" title="Eliminar">${iconoCerrar}</button>
        </div>
      `).join('');
    }

    const sub = window.Carrito.subtotal();
    const desc = window.Carrito.descuento();
    const tot = window.Carrito.total();
    const cupon = window.Carrito.obtenerCupon();

    document.getElementById('resumen-subtotal').textContent = `$${sub.toFixed(2)}`;
    document.getElementById('resumen-total').textContent = `$${tot.toFixed(2)}`;
    document.getElementById('chk-total-mostrar').textContent = `$${tot.toFixed(2)}`;

    const filaDesc = document.getElementById('fila-descuento');
    const bannerCupon = document.getElementById('cupon-aplicado-banner');
    if (cupon) {
      filaDesc.hidden = false;
      document.getElementById('txt-cupon-desc').textContent = `${cupon.porcentaje}% en ${cupon.categoria.toLowerCase()}`;
      document.getElementById('resumen-descuento').textContent = `-$${desc.toFixed(2)}`;
      bannerCupon.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--color-rojo-suave);padding:6px 10px;border-radius:var(--radio-sm);font-size:0.82rem;font-weight:700;color:var(--color-rojo-profundo)">
          <span>🏷️ Cupón: ${cupon.codigo} (-${cupon.porcentaje}% en ${cupon.categoria.toLowerCase()})</span>
          <button type="button" onclick="Carrito.quitarCupon()" style="background:none;border:none;cursor:pointer;color:var(--color-rojo-principal)">Quitar</button>
        </div>
      `;
    } else {
      filaDesc.hidden = true;
      bannerCupon.innerHTML = '';
    }
  }

  function renderizarFavoritos() {
    const contenedor = document.getElementById('favoritos-items-lista');
    if (!contenedor) return;
    const items = window.Favoritos.obtenerItems();
    if (items.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--color-texto-suave)">
          <p style="font-size:2.5rem;margin-bottom:10px">❤️</p>
          <p style="font-weight:700">No tienes productos en favoritos</p>
          <p style="font-size:0.85rem;margin-top:6px">Guarda productos para comprarlos luego.</p>
        </div>
      `;
    } else {
      contenedor.innerHTML = items.map(it => `
        <div class="item-carrito">
          <img class="item-carrito__img" src="${it.imagen}" alt="${it.nombre}">
          <div class="item-carrito__info">
            <h4 class="item-carrito__nombre">${it.nombre}</h4>
            <div class="item-carrito__precio">$${it.precio.toFixed(2)}</div>
            <button class="boton boton--secundario boton--sm" style="margin-top:6px" onclick="Carrito.agregar({id:'${it.id}',nombre:'${it.nombre}',precio:${it.precio},imagen:'${it.imagen}',categoria:'${it.categoria || ''}'})">Mover al Carrito</button>
          </div>
          <button class="item-carrito__eliminar" onclick="Favoritos.toggle({id:'${it.id}',nombre:'${it.nombre}'})" title="Quitar">${iconoCerrar}</button>
        </div>
      `).join('');
    }
  }

  // Apertura y Cierre de Drawers
  function abrirDrawer(id) {
    backdrop.classList.add('drawer-backdrop--abierto');
    document.getElementById(id)?.classList.add('drawer--abierto');
    if (id === 'drawer-carrito') renderizarCarrito();
    if (id === 'drawer-favoritos') renderizarFavoritos();
  }

  function cerrarDrawers() {
    backdrop.classList.remove('drawer-backdrop--abierto');
    document.querySelectorAll('.drawer').forEach(d => d.classList.remove('drawer--abierto'));
    document.getElementById('modal-checkout')?.classList.remove('modal-backdrop--abierto');
  }

  // Event Listeners
  document.getElementById('btn-abrir-carrito')?.addEventListener('click', () => {
    if (window.Carrito.exigirSesion()) abrirDrawer('drawer-carrito');
  });
  document.getElementById('btn-cerrar-carrito')?.addEventListener('click', cerrarDrawers);
  document.getElementById('btn-abrir-favoritos')?.addEventListener('click', () => {
    if (window.Favoritos.exigirSesion()) abrirDrawer('drawer-favoritos');
  });
  document.getElementById('btn-cerrar-favoritos')?.addEventListener('click', cerrarDrawers);
  backdrop.addEventListener('click', cerrarDrawers);
  document.getElementById('btn-cerrar-modal-pago')?.addEventListener('click', cerrarDrawers);
  // El modal de pago también se cierra con clic fuera de la ventana o con Escape
  modalCheckout.addEventListener('click', (e) => {
    if (e.target === modalCheckout) cerrarDrawers();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCheckout.classList.contains('modal-backdrop--abierto')) cerrarDrawers();
  });

  // Botón proceder al pago
  document.getElementById('btn-proceder-pago')?.addEventListener('click', () => {
    if (window.Carrito.obtenerItems().length === 0) {
      window.Notificaciones.toast('Agrega productos al carrito antes de pagar.', 'alerta');
      return;
    }
    if (!window.Sesion.token()) return irALoginParaPagar();
    cerrarDrawers();
    document.getElementById('modal-checkout').classList.add('modal-backdrop--abierto');
  });

  // Aplicar cupón
  document.getElementById('btn-aplicar-cupon')?.addEventListener('click', () => {
    const val = document.getElementById('input-cupon').value;
    const res = window.Carrito.aplicarCupon(val);
    if (!res.ok) {
      window.Notificaciones.toast(res.error, 'alerta');
    }
    renderizarCarrito();
  });

  // ---------- Sin espacios dobles en ningún campo de la app ----------
  // Al escribir o pegar, dos o más espacios seguidos quedan en uno. En login y
  // registro también las contraseñas (auth rechaza claves nuevas con espacios
  // dobles); en el resto de la app las contraseñas no se tocan.
  const CAMPOS_DE_TEXTO = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="url"], textarea, #form-login input[type="password"], #form-registro input[type="password"]';
  document.addEventListener('input', (e) => {
    const campo = e.target;
    if (!campo.matches?.(CAMPOS_DE_TEXTO) || campo.readOnly) return;
    const { value, selectionStart } = campo;
    if (!/ {2,}/.test(value)) return;
    const antesDelCursor = value.slice(0, selectionStart ?? value.length).replace(/ {2,}/g, ' ');
    campo.value = value.replace(/ {2,}/g, ' ');
    // email no admite setSelectionRange
    try { campo.setSelectionRange(antesDelCursor.length, antesDelCursor.length); } catch {}
  }, true); // captura: corre antes que los listeners de cada campo, que ya ven el valor limpio

  // ---------- Validación del formulario de pago ----------
  // Cada campo filtra lo que se escribe o pega, y se vuelve a validar al pagar.
  const LETRA = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
  const camposCheckout = {
    nombre: {
      input: document.getElementById('chk-nombre'),
      noPermitido: new RegExp(`[^${LETRA} ]`, 'g'),
      aviso: 'Solo letras y espacios.',
      validar: (v) => (new RegExp(`^[${LETRA}]{2,}( [${LETRA}]+)*$`).test(v) ? '' : 'Escribe tu nombre (solo letras).')
    },
    direccion: {
      input: document.getElementById('chk-direccion'),
      noPermitido: new RegExp(`[^${LETRA}0-9 _/-]`, 'g'),
      aviso: 'Solo letras, números, espacios y los símbolos - _ /',
      validar: (v) => (v.length >= 5 && new RegExp(`[${LETRA}]`).test(v) ? '' : 'Escribe la dirección de entrega (mínimo 5 caracteres).')
    },
    telefono: {
      input: document.getElementById('chk-telefono'),
      noPermitido: /\D/g,
      aviso: 'Solo números, sin espacios ni guiones.',
      validar: (v) => (/^\d{7,15}$/.test(v) ? '' : 'El teléfono debe tener entre 7 y 15 dígitos.')
    },
    ciudad: {
      input: document.getElementById('chk-ciudad'),
      noPermitido: new RegExp(`[^${LETRA} ]`, 'g'),
      aviso: 'Solo letras y espacios.',
      validar: (v) => (new RegExp(`^[${LETRA}]{2,}( [${LETRA}]+)*$`).test(v) ? '' : 'Escribe la ciudad (solo letras).')
    }
  };

  function mostrarErrorCampo(campo, texto) {
    document.getElementById(`${campo.input.id}-error`).textContent = texto;
    campo.input.setAttribute('aria-invalid', texto ? 'true' : 'false');
  }

  Object.values(camposCheckout).forEach((campo) => {
    campo.input.addEventListener('input', () => {
      const { value, selectionStart } = campo.input;
      const limpio = value.replace(campo.noPermitido, '');
      if (limpio === value) {
        if (campo.input.getAttribute('aria-invalid') === 'true') mostrarErrorCampo(campo, campo.validar(limpio.trim()));
        return;
      }
      // Se quitan los caracteres no permitidos sin mover el cursor al final
      const quitados = value.slice(0, selectionStart).length - value.slice(0, selectionStart).replace(campo.noPermitido, '').length;
      campo.input.value = limpio;
      campo.input.setSelectionRange(selectionStart - quitados, selectionStart - quitados);
      mostrarErrorCampo(campo, campo.aviso);
    });
    campo.input.addEventListener('blur', () => {
      // Espacios repetidos o en los extremos no cuentan
      campo.input.value = campo.input.value.replace(/ {2,}/g, ' ').trim();
    });
  });

  function validarCheckout() {
    let primeroInvalido = null;
    Object.values(camposCheckout).forEach((campo) => {
      campo.input.value = campo.input.value.replace(/ {2,}/g, ' ').trim();
      const error = campo.validar(campo.input.value);
      mostrarErrorCampo(campo, error);
      if (error && !primeroInvalido) primeroInvalido = campo.input;
    });
    primeroInvalido?.focus();
    return !primeroInvalido;
  }

  // Botones de tarjeta de prueba: los campos de tarjeta son de solo lectura
  document.querySelectorAll('.chk-tarjetas [data-tarjeta]').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.getElementById('chk-tarjeta').value = boton.dataset.tarjeta;
      document.querySelectorAll('.chk-tarjetas [data-tarjeta]').forEach((b) => {
        b.classList.toggle('chip--activo', b === boton);
        b.setAttribute('aria-pressed', String(b === boton));
      });
    });
  });

  // Procesamiento del Checkout (IDEA 03 - Reglas 1234 y 0000)
  document.getElementById('form-checkout')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarCheckout()) return;
    const token = window.Sesion.token();
    if (!token) return irALoginParaPagar();

    const tarjeta = document.getElementById('chk-tarjeta').value.replace(/\s+/g, '');
    const btnSubmit = document.getElementById('btn-confirmar-pago');
    const restaurarBoton = () => {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Pagar y Confirmar Pedido';
    };
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando transacción segura...';

    await new Promise(r => setTimeout(r, 1200));

    // Regla de simulación de pagos (Slide 5):
    // Termina en 0000 -> Fallo y reversión: no se registra nada
    // Termina en 1234 -> Éxito: se registra la venta
    if (tarjeta.endsWith('0000')) {
      restaurarBoton();
      window.Notificaciones.toast('❌ Pago rechazado: Tarjeta declinada. Reversión automática de fondos sin cobro.', 'alerta');
      return;
    }

    // Pago aprobado: POST /api/ordenes registra la venta (estado PAGADA).
    // ordenes toma el comprador del token y nombres/precios del catálogo, y descuenta el stock.
    let orden;
    try {
      const res = await fetch('/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productos: window.Carrito.obtenerItems().map(it => ({ productoId: String(it.id), cantidad: it.cantidad })),
          clienteNombre: document.getElementById('chk-nombre').value,
          telefono: document.getElementById('chk-telefono').value,
          direccion: document.getElementById('chk-direccion').value,
          ciudad: document.getElementById('chk-ciudad').value,
          tarjetaUltimos4: tarjeta.slice(-4),
          cupon: window.Carrito.obtenerCupon()?.codigo || null
        })
      });
      const datos = await res.json().catch(() => ({}));
      if (res.status === 401) {
        restaurarBoton();
        return irALoginParaPagar(datos.error);
      }
      if (!res.ok) throw new Error(datos.error || `Error ${res.status} al registrar la compra.`);
      orden = datos;
    } catch (err) {
      // Sin orden no hay venta: el carrito se conserva para reintentar
      restaurarBoton();
      window.Notificaciones.toast(`No se completó la compra: ${err.message}`, 'alerta');
      return;
    }

    window.Carrito.limpiar();
    cerrarDrawers();
    restaurarBoton();
    window.Notificaciones.toast(`🎉 ¡Pago Aprobado! Orden #${orden.id} por $${Number(orden.total).toFixed(2)} registrada.`, 'exito');

    setTimeout(() => {
      window.location.href = '../ordenes/index.html';
    }, 1500);
  });

  // Comprar exige sesión: cada venta queda a nombre de quien la hizo
  function irALoginParaPagar(mensaje) {
    cerrarDrawers();
    window.Notificaciones.toast(mensaje || 'Inicia sesión para completar tu compra. Tu carrito se conserva.', 'info');
    setTimeout(() => { window.location.href = '../login/index.html'; }, 1400);
  }

  // Manejo de Sesión en Navbar
  function pintarSesion() {
    const usuario = window.Sesion.usuario();
    const esAdmin = window.Sesion.esAdmin();

    const saludo = document.getElementById('nav-saludo');
    const avatar = document.getElementById('nav-avatar');
    const btnLogin = document.getElementById('btn-nav-login');
    const btnLogout = document.getElementById('btn-nav-logout');
    const btnAdmin = document.getElementById('btn-nav-admin');
    const btnReportes = document.getElementById('btn-nav-reportes');
    const btnPerfil = document.getElementById('btn-nav-perfil');

    if (btnPerfil) btnPerfil.hidden = !usuario;

    if (usuario) {
      if (saludo) {
        // Cabecera del menú desplegable: nombre y correo de la sesión
        saludo.innerHTML = '<strong></strong><small></small>';
        saludo.querySelector('strong').textContent = `Hola, ${usuario.nombre.split(' ')[0]}`;
        saludo.querySelector('small').textContent = usuario.email || '';
        saludo.hidden = false;
      }
      if (avatar) {
        avatar.textContent = window.Sesion.iniciales(usuario.nombre);
        avatar.hidden = false;
      }
      if (btnLogin) btnLogin.hidden = true;
      if (btnLogout) btnLogout.hidden = false;
      if (btnAdmin) btnAdmin.hidden = !esAdmin;
      if (btnReportes) btnReportes.hidden = !esAdmin;
    } else {
      if (saludo) saludo.hidden = true;
      if (avatar) avatar.hidden = true;
      if (btnLogin) btnLogin.hidden = false;
      if (btnLogout) btnLogout.hidden = true;
      if (btnAdmin) btnAdmin.hidden = true;
      if (btnReportes) btnReportes.hidden = true;
    }
  }

  // Menú desplegable del navbar: abre con clic, cierra con clic afuera o Escape
  const menuNav = document.getElementById('menu-nav');
  const btnMenuNav = document.getElementById('btn-menu-nav');
  const listaMenuNav = document.getElementById('menu-nav-lista');

  function abrirMenuNav(abrir) {
    listaMenuNav.hidden = !abrir;
    btnMenuNav.setAttribute('aria-expanded', String(abrir));
    btnMenuNav.classList.toggle('icono-boton--activo', abrir);
  }

  btnMenuNav.addEventListener('click', () => {
    abrirMenuNav(listaMenuNav.hidden);
    if (!listaMenuNav.hidden) listaMenuNav.querySelector('.menu-nav__item:not([hidden])')?.focus();
  });
  document.addEventListener('click', (e) => {
    if (!listaMenuNav.hidden && !menuNav.contains(e.target)) abrirMenuNav(false);
  });
  document.addEventListener('keydown', (e) => {
    if (listaMenuNav.hidden) return;
    if (e.key === 'Escape') {
      abrirMenuNav(false);
      btnMenuNav.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...listaMenuNav.querySelectorAll('.menu-nav__item:not([hidden])')];
      const actual = items.indexOf(document.activeElement);
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      items[(actual + paso + items.length) % items.length]?.focus();
    }
  });

  // Marca la página actual en el navbar y en el menú
  const carpetaActual = window.location.pathname.split('/').filter(Boolean)[0] || 'home';
  document.querySelectorAll('.navbar__acciones a[href^="../"]').forEach((enlace) => {
    const [ruta, ancla] = enlace.getAttribute('href').slice(3).split('#');
    const esActual = ruta.split('/')[0] === carpetaActual && (ancla ? window.location.hash === `#${ancla}` : true);
    if (esActual && !enlace.classList.contains('avatar')) enlace.setAttribute('aria-current', 'page');
  });

  document.getElementById('btn-nav-logout')?.addEventListener('click', async () => {
    const token = window.Sesion.token();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {}
    }
    window.Sesion.cerrar();
    // Al salir se vuelve al Home como visitante: páginas como Mi Perfil o el
    // panel admin seguirían mostrando datos de la sesión. El aviso se muestra
    // al llegar al Home.
    try { sessionStorage.setItem('avisoPendiente', 'Sesión cerrada correctamente.'); } catch {}
    window.location.href = '../home/index.html';
  });

  // Páginas que solo tienen sentido con sesión: sin ella se vuelve al Home.
  // Cubre entrar sin sesión, volver con "Atrás" tras salir (caché del navegador)
  // y cerrar sesión en otra pestaña.
  const PAGINAS_PRIVADAS = ['perfil', 'ordenes', 'admin'];
  function salirSiNoHaySesion() {
    if (!PAGINAS_PRIVADAS.includes(carpetaActual) || window.Sesion.token()) return;
    try { sessionStorage.setItem('avisoPendiente', 'Tu sesión se cerró. Inicia sesión para continuar.'); } catch {}
    window.location.replace('../home/index.html');
  }
  salirSiNoHaySesion();
  window.addEventListener('pageshow', (e) => { if (e.persisted) salirSiNoHaySesion(); });
  window.addEventListener('storage', (e) => { if (e.key === 'token' || e.key === null) salirSiNoHaySesion(); });

  // Aviso que dejó la página anterior antes de redirigir (por ejemplo, al cerrar sesión)
  try {
    const aviso = sessionStorage.getItem('avisoPendiente');
    if (aviso) {
      sessionStorage.removeItem('avisoPendiente');
      window.Notificaciones.toast(aviso, 'info');
    }
  } catch {}

  // Buscador global
  document.getElementById('form-buscador-global')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('input-buscador-global').value.trim();
    if (window.location.pathname.includes('/catalogo/')) {
      window.dispatchEvent(new CustomEvent('busqueda-ejecutada', { detail: { query } }));
    } else {
      window.location.href = `../catalogo/index.html?q=${encodeURIComponent(query)}`;
    }
  });

  // Listeners reactivos
  window.addEventListener('carrito-actualizado', () => {
    actualizarBadges();
    renderizarCarrito();
  });
  window.addEventListener('favoritos-actualizado', () => {
    actualizarBadges();
    renderizarFavoritos();
  });
  window.addEventListener('sesion-cambiada', pintarSesion);

  // Inicializar
  actualizarBadges();
  pintarSesion();
})();
