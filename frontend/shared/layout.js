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
window.Carrito = (function () {
  const CLAVE = 'ecommerce_carrito';
  const CLAVE_CUPON = 'ecommerce_cupon';

  let items = [];
  let cupon = null;

  try {
    items = JSON.parse(localStorage.getItem(CLAVE)) || [];
    cupon = JSON.parse(localStorage.getItem(CLAVE_CUPON)) || null;
  } catch { items = []; cupon = null; }

  function persistir() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
      localStorage.setItem(CLAVE_CUPON, JSON.stringify(cupon));
    } catch (e) { console.warn(e); }
    window.dispatchEvent(new CustomEvent('carrito-actualizado', { detail: { items, cupon } }));
  }

  return {
    obtenerItems() { return [...items]; },
    conteo() { return items.reduce((acc, it) => acc + (it.cantidad || 1), 0); },
    subtotal() {
      return items.reduce((acc, it) => acc + (Number(it.precio) * (it.cantidad || 1)), 0);
    },
    obtenerCupon() { return cupon; },
    descuento() {
      if (!cupon) return 0;
      return (this.subtotal() * (cupon.porcentaje / 100));
    },
    total() {
      const t = this.subtotal() - this.descuento();
      return t > 0 ? t : 0;
    },
    agregar(prod, cant = 1) {
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
        items.push({
          id: prod.id || prod._id,
          nombre: prod.name || prod.nombre,
          precio: Number(prod.price || prod.precio),
          imagen: prod.imagen || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80',
          stock: disponible,
          cantidad: Math.min(cant, disponible)
        });
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
      const cod = String(codigo || '').trim().toUpperCase();
      if (cod === 'PROFE20') {
        cupon = { codigo: 'PROFE20', porcentaje: 20, descripcion: '20% OFF Especial' };
        persistir();
        window.Notificaciones.toast('¡Cupón PROFE20 aplicado! 20% de descuento.', 'exito');
        return { ok: true, cupon };
      } else {
        return { ok: false, error: 'Cupón no válido o expirado. Prueba con PROFE20' };
      }
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
window.Favoritos = (function () {
  const CLAVE = 'ecommerce_favoritos';
  let items = [];

  try { items = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { items = []; }

  function persistir() {
    try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch (e) { console.warn(e); }
    window.dispatchEvent(new CustomEvent('favoritos-actualizado', { detail: { items } }));
  }

  return {
    obtenerItems() { return [...items]; },
    conteo() { return items.length; },
    esFavorito(id) {
      return items.some(it => String(it.id) === String(id));
    },
    toggle(prod) {
      const id = prod.id || prod._id;
      const idx = items.findIndex(it => String(it.id) === String(id));
      if (idx >= 0) {
        items.splice(idx, 1);
        persistir();
        window.Notificaciones.toast(`"${prod.name || prod.nombre}" eliminado de favoritos.`, 'info');
        return false;
      } else {
        items.push({
          id,
          nombre: prod.name || prod.nombre,
          precio: Number(prod.price || prod.precio),
          imagen: prod.imagen || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80',
          stock: prod.stock
        });
        persistir();
        window.Notificaciones.toast(`"${prod.name || prod.nombre}" guardado en lista de deseos ❤️`, 'exito');
        return true;
      }
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

  // Banner Promocional Cupón PROFE20
  const banner = document.createElement('aside');
  banner.className = 'banner-promo';
  banner.innerHTML = `
    🔥 ¡Gran Inauguración! Usa el cupón <span class="banner-promo__codigo" id="btn-copiar-cupon" title="Clic para copiar">PROFE20</span> para 20% OFF en toda la tienda.
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
    <a class="navbar__marca-link" href="../catalogo/index.html">
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
      <span class="navbar__saludo" id="nav-saludo" hidden></span>
      
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

      <!-- Enlace Órdenes / Admin -->
      <a class="icono-boton" id="btn-nav-ordenes" href="../ordenes/index.html" title="Mis Pedidos">
        ${iconoOrdenes}
      </a>

      <a class="icono-boton" id="btn-nav-admin" data-solo-admin href="../admin/index.html" hidden title="Panel de Administración">
        ${iconoAdmin}
      </a>

      <a class="icono-boton" id="btn-nav-reportes" data-solo-admin href="../admin/index.html#analitica" hidden title="Reportes">
        ${iconoReportes}
      </a>

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
        <input type="text" id="input-cupon" placeholder="Código de cupón (ej: PROFE20)">
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
        <button class="drawer__cerrar" style="color:var(--color-texto)" id="btn-cerrar-modal-pago">${iconoCerrar}</button>
      </div>
      <div class="modal__cuerpo">
        <div class="caja-info-pago">
          <strong>Reglas de Simulación de Pago Seguro:</strong>
          • Tarjeta terminada en <strong>1234</strong>: Pago aprobado instantáneamente.<br>
          • Tarjeta terminada en <strong>0000</strong>: Pago rechazado y reversión automática sin cobro.
        </div>
        <form id="form-checkout">
          <div class="form-grupo" style="margin-bottom:12px">
            <label for="chk-nombre">Nombre completo</label>
            <input type="text" id="chk-nombre" required placeholder="Ej: Juan Pérez">
          </div>
          <div class="form-grupo" style="margin-bottom:12px">
            <label for="chk-direccion">Dirección de Entrega</label>
            <input type="text" id="chk-direccion" required placeholder="Ej: Av. Principal 123, Apto 4B">
          </div>
          <div class="form-fila" style="margin-bottom:12px">
            <div class="form-grupo">
              <label for="chk-telefono">Teléfono</label>
              <input type="tel" id="chk-telefono" required placeholder="Ej: 0414-1234567">
            </div>
            <div class="form-grupo">
              <label for="chk-ciudad">Ciudad</label>
              <input type="text" id="chk-ciudad" required placeholder="Ej: Caracas">
            </div>
          </div>
          <div class="form-grupo" style="margin-bottom:12px">
            <label for="chk-tarjeta">Número de Tarjeta de Prueba</label>
            <input type="text" id="chk-tarjeta" maxlength="19" required placeholder="4532 •••• •••• 1234" value="4532000000001234">
            <small style="color:var(--color-texto-suave);font-size:0.8rem">Usa una tarjeta terminada en 1234 (éxito) o 0000 (fallo).</small>
          </div>
          <div class="form-fila" style="margin-bottom:16px">
            <div class="form-grupo">
              <label for="chk-exp">Fecha Exp.</label>
              <input type="text" id="chk-exp" placeholder="MM/AA" value="12/28">
            </div>
            <div class="form-grupo">
              <label for="chk-cvv">CVV</label>
              <input type="text" id="chk-cvv" maxlength="4" placeholder="123" value="789">
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
      document.getElementById('txt-cupon-desc').textContent = `${cupon.porcentaje}%`;
      document.getElementById('resumen-descuento').textContent = `-$${desc.toFixed(2)}`;
      bannerCupon.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--color-rojo-suave);padding:6px 10px;border-radius:var(--radio-sm);font-size:0.82rem;font-weight:700;color:var(--color-rojo-profundo)">
          <span>🏷️ Cupón: ${cupon.codigo} (-${cupon.porcentaje}%)</span>
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
            <button class="boton boton--secundario boton--sm" style="margin-top:6px" onclick="Carrito.agregar({id:'${it.id}',nombre:'${it.nombre}',precio:${it.precio},imagen:'${it.imagen}'})">Mover al Carrito</button>
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
  document.getElementById('btn-abrir-carrito')?.addEventListener('click', () => abrirDrawer('drawer-carrito'));
  document.getElementById('btn-cerrar-carrito')?.addEventListener('click', cerrarDrawers);
  document.getElementById('btn-abrir-favoritos')?.addEventListener('click', () => abrirDrawer('drawer-favoritos'));
  document.getElementById('btn-cerrar-favoritos')?.addEventListener('click', cerrarDrawers);
  backdrop.addEventListener('click', cerrarDrawers);
  document.getElementById('btn-cerrar-modal-pago')?.addEventListener('click', cerrarDrawers);

  // Botón proceder al pago
  document.getElementById('btn-proceder-pago')?.addEventListener('click', () => {
    if (window.Carrito.obtenerItems().length === 0) {
      window.Notificaciones.toast('Agrega productos al carrito antes de pagar.', 'alerta');
      return;
    }
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

  // Procesamiento del Checkout (IDEA 03 - Reglas 1234 y 0000)
  document.getElementById('form-checkout')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tarjeta = document.getElementById('chk-tarjeta').value.replace(/\s+/g, '');
    const nombre = document.getElementById('chk-nombre').value;
    const direccion = document.getElementById('chk-direccion').value;
    const items = window.Carrito.obtenerItems();
    const total = window.Carrito.total();

    const btnSubmit = document.getElementById('btn-confirmar-pago');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando transacción segura...';

    await new Promise(r => setTimeout(r, 1200));

    // Regla de simulación de pagos (Slide 5):
    // Termina en 0000 -> Fallo y reversión
    // Termina en 1234 -> Éxito
    if (tarjeta.endsWith('0000')) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Pagar y Confirmar Pedido';
      window.Notificaciones.toast('❌ Pago rechazado: Tarjeta declinada. Reversión automática de fondos sin cobro.', 'alerta');
      return;
    }

    // Si termina en 1234 (o cualquier otra válida): Aprobado
    const ordenId = Math.floor(100000 + Math.random() * 900000);
    const usuario = window.Sesion.usuario();
    const token = window.Sesion.token();

    const nuevaOrden = {
      id: ordenId,
      usuarioId: usuario ? usuario.id : 1,
      clienteNombre: nombre,
      direccion,
      total,
      fechaCreacion: new Date().toISOString(),
      estado: 'PAGADO',
      tarjetaUltimos4: tarjeta.slice(-4),
      detalles: items.map(it => ({
        productoId: String(it.id),
        productoNombre: it.nombre,
        precioUnitario: it.precio,
        cantidad: it.cantidad
      }))
    };

    // Intentar enviar al microservicio Java ordenes
    try {
      await fetch('/api/ordenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          usuarioId: nuevaOrden.usuarioId,
          detalles: nuevaOrden.detalles
        })
      });
    } catch (err) {
      console.log('Orden guardada localmente (Java offline o standalone mode)', err);
    }

    // Persistir orden en historial local
    try {
      const ordenesPrev = JSON.parse(localStorage.getItem('ecommerce_ordenes')) || [];
      ordenesPrev.unshift(nuevaOrden);
      localStorage.setItem('ecommerce_ordenes', JSON.stringify(ordenesPrev));
    } catch (e) { console.warn(e); }

    // Limpiar carrito
    window.Carrito.limpiar();
    cerrarDrawers();
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Pagar y Confirmar Pedido';

    window.Notificaciones.toast(`🎉 ¡Pago Aprobado! Orden #${ordenId} generada exitosamente.`, 'exito');

    setTimeout(() => {
      window.location.href = '../ordenes/index.html';
    }, 1500);
  });

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

    if (usuario) {
      if (saludo) {
        saludo.textContent = `Hola, ${usuario.nombre.split(' ')[0]}`;
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
    window.Notificaciones.toast('Sesión cerrada correctamente.', 'info');
  });

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
