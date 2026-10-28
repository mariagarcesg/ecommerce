// ==========================================================================
// ECOMMERCE - CONTROLADOR DEL PANEL DE ADMINISTRACIÓN Y ANALÍTICA (IDEAS 01, 08)
// ==========================================================================

(function () {
  // Solo el rol admin puede ver este panel (el backend además valida el token en cada API)
  if (!window.Sesion.esAdmin()) {
    window.location.replace(window.Sesion.usuario() ? '../catalogo/index.html' : '../login/index.html');
    return;
  }

  // Pestañas
  const tabCatalogo = document.getElementById('tab-btn-catalogo');
  const tabOrdenes = document.getElementById('tab-btn-ordenes');
  const tabUsuarios = document.getElementById('tab-btn-usuarios');
  const tabAnalitica = document.getElementById('tab-btn-analitica');

  const panelCatalogo = document.getElementById('panel-catalogo');
  const panelOrdenes = document.getElementById('panel-ordenes');
  const panelUsuarios = document.getElementById('panel-usuarios');
  const panelAnalitica = document.getElementById('panel-analitica');

  function activarTab(tabActivo, panelActivo) {
    [tabCatalogo, tabOrdenes, tabUsuarios, tabAnalitica].forEach(t => t.classList.remove('chip--activo'));
    [panelCatalogo, panelOrdenes, panelUsuarios, panelAnalitica].forEach(p => p.style.display = 'none');

    tabActivo.classList.add('chip--activo');
    panelActivo.style.display = 'block';

    // La URL refleja la pestaña, para que "Reportes" del header funcione desde cualquier pestaña
    const hash = panelActivo === panelAnalitica ? '#analitica' : panelActivo === panelUsuarios ? '#usuarios' : '';
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + hash);
  }

  tabCatalogo?.addEventListener('click', () => {
    activarTab(tabCatalogo, panelCatalogo);
    cargarTablaProductos();
  });
  tabOrdenes?.addEventListener('click', () => {
    activarTab(tabOrdenes, panelOrdenes);
    cargarTablaOrdenes();
  });
  tabUsuarios?.addEventListener('click', () => {
    activarTab(tabUsuarios, panelUsuarios);
    cargarTablaUsuarios();
  });
  tabAnalitica?.addEventListener('click', () => {
    activarTab(tabAnalitica, panelAnalitica);
    cargarMetricasPython();
  });

  // ---------- 1. GESTIÓN DE CATÁLOGO (Node.js + MongoDB) ----------
  const btnToggleNuevo = document.getElementById('btn-toggle-nuevo-producto');
  const formCrear = document.getElementById('form-crear-producto');

  btnToggleNuevo?.addEventListener('click', () => {
    formCrear.style.display = formCrear.style.display === 'none' ? 'block' : 'none';
  });

  async function obtenerProductosAdmin() {
    try {
      const res = await fetch('/api/catalogo/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}

    // Fallback a almacenamiento local o iniciales
    try {
      const locales = JSON.parse(localStorage.getItem('ecommerce_catalogo_admin'));
      if (locales && locales.length > 0) return locales;
    } catch {}

    return [
      { id: "prod-01", name: "Smartphone Crimson Pro 256GB", category: "Electrónica", price: 799.99, stock: 3 },
      { id: "prod-02", name: "Funda Protectora Silicona Roja", category: "Accesorios", price: 24.99, stock: 45 },
      { id: "prod-03", name: "Laptop Pro Ultradelgada 16\"", category: "Electrónica", price: 1299.00, stock: 8 },
      { id: "prod-04", name: "Mouse Ergonómico Inalámbrico Silent", category: "Accesorios", price: 39.99, stock: 19 },
      { id: "prod-05", name: "Zapatillas Deportivas Runner Red", category: "Calzado", price: 89.50, stock: 4 },
      { id: "prod-06", name: "Camiseta Deportiva Transpirable Fit", category: "Ropa", price: 29.90, stock: 25 },
      { id: "prod-07", name: "Cafetera Expreso Barista Red", category: "Hogar", price: 189.00, stock: 0 },
      { id: "prod-08", name: "Audífonos Inalámbricos Noise Cancelling", category: "Electrónica", price: 149.99, stock: 12 }
    ];
  }

  async function cargarTablaProductos() {
    const tabla = document.getElementById('tabla-adm-productos-cuerpo');
    if (!tabla) return;

    const productos = await obtenerProductosAdmin();
    tabla.innerHTML = productos.map(p => {
      const pid = p._id || p.id;
      const cat = (p.category && p.category.name) ? p.category.name : (p.category || 'General');
      
      let badgeStock = `<span style="color:var(--color-exito);font-weight:700">En stock</span>`;
      if (p.stock <= 0) {
        badgeStock = `<span style="color:#374151;font-weight:700">Agotado</span>`;
      } else if (p.stock < 5) {
        badgeStock = `<span style="color:var(--color-rojo-principal);font-weight:700">¡Crítico (&lt;5)!</span>`;
      }

      return `
        <tr>
          <td><code style="font-size:0.8rem;background:var(--color-fondo);padding:2px 6px;border-radius:4px">${String(pid).slice(-6)}</code></td>
          <td style="font-weight:700">${p.name}</td>
          <td><span class="chip" style="font-size:0.75rem;padding:2px 8px">${cat}</span></td>
          <td style="font-weight:800">$${Number(p.price).toFixed(2)}</td>
          <td>${p.stock} uds.</td>
          <td>${badgeStock}</td>
          <td>
            <button class="boton boton--secundario boton--sm" style="padding:3px 8px;font-size:0.78rem" onclick="window.editarStock('${pid}', ${p.stock})">Editar Stock</button>
            <button class="boton boton--sm" style="padding:3px 8px;font-size:0.78rem;background:#374151;border-color:#374151" onclick="window.eliminarProducto('${pid}')">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Guardar nuevo producto
  formCrear?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = window.Sesion.token();
    const nombre = document.getElementById('adm-nombre').value;
    const categoria = document.getElementById('adm-categoria').value;
    const precio = parseFloat(document.getElementById('adm-precio').value);
    const stock = parseInt(document.getElementById('adm-stock').value, 10);
    const desc = document.getElementById('adm-descripcion').value;

    const nuevoProd = {
      id: `prod-${Date.now()}`,
      name: nombre,
      category: categoria,
      price: precio,
      stock: stock,
      description: desc,
      imagen: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'
    };

    try {
      await fetch('/api/catalogo/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(nuevoProd)
      });
    } catch {}

    // Guardar en copia local
    try {
      const items = await obtenerProductosAdmin();
      items.unshift(nuevoProd);
      localStorage.setItem('ecommerce_catalogo_admin', JSON.stringify(items));
    } catch (err) { console.warn(err); }

    window.Notificaciones.toast(`Producto "${nombre}" creado exitosamente en Catálogo.`, 'exito');
    formCrear.reset();
    formCrear.style.display = 'none';
    cargarTablaProductos();
  });

  window.editarStock = async function (id, stockActual) {
    const nuevo = prompt(`Modificar stock para producto (Actual: ${stockActual}):`, stockActual);
    if (nuevo === null) return;
    const cant = parseInt(nuevo, 10);
    if (isNaN(cant) || cant < 0) {
      alert('Ingresa una cantidad válida mayor o igual a 0.');
      return;
    }

    const token = window.Sesion.token();
    try {
      await fetch(`/api/catalogo/products/${id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ stock: cant })
      });
    } catch {}

    try {
      const items = await obtenerProductosAdmin();
      const p = items.find(it => String(it._id || it.id) === String(id));
      if (p) p.stock = cant;
      localStorage.setItem('ecommerce_catalogo_admin', JSON.stringify(items));
    } catch {}

    window.Notificaciones.toast('Stock actualizado con éxito.', 'exito');
    cargarTablaProductos();
  };

  window.eliminarProducto = async function (id) {
    if (!confirm('¿Estás seguro de eliminar este producto del catálogo?')) return;
    const token = window.Sesion.token();
    try {
      await fetch(`/api/catalogo/products/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
    } catch {}

    try {
      let items = await obtenerProductosAdmin();
      items = items.filter(it => String(it._id || it.id) !== String(id));
      localStorage.setItem('ecommerce_catalogo_admin', JSON.stringify(items));
    } catch {}

    window.Notificaciones.toast('Producto eliminado.', 'info');
    cargarTablaProductos();
  };

  // ---------- 2. CONTROL DE ÓRDENES (Java Spring Boot + PostgreSQL) ----------
  function obtenerOrdenes() {
    try {
      const ords = JSON.parse(localStorage.getItem('ecommerce_ordenes'));
      if (ords && ords.length > 0) return ords;
    } catch {}

    return [
      {
        id: 104521,
        clienteNombre: 'Carlos Mendoza',
        fechaCreacion: '2026-10-21T16:40:00Z',
        detalles: [{ productoNombre: 'Smartphone Crimson Pro 256GB', cantidad: 1, precioUnitario: 799.99 }],
        total: 799.99,
        estado: 'PAGADO',
        tarjetaUltimos4: '1234'
      },
      {
        id: 104520,
        clienteNombre: 'María García',
        fechaCreacion: '2026-10-21T14:15:00Z',
        detalles: [
          { productoNombre: 'Funda Protectora Silicona Roja', cantidad: 1, precioUnitario: 24.99 },
          { productoNombre: 'Zapatillas Deportivas Runner Red', cantidad: 1, precioUnitario: 89.50 }
        ],
        total: 91.59, // con cupón
        estado: 'PAGADO',
        tarjetaUltimos4: '1234'
      },
      {
        id: 104519,
        clienteNombre: 'Intento Fallido',
        fechaCreacion: '2026-10-21T11:00:00Z',
        detalles: [{ productoNombre: 'Laptop Pro Ultradelgada 16"', cantidad: 1, precioUnitario: 1299.00 }],
        total: 1299.00,
        estado: 'RECHAZADO',
        tarjetaUltimos4: '0000'
      }
    ];
  }

  function cargarTablaOrdenes() {
    const tabla = document.getElementById('tabla-adm-ordenes-cuerpo');
    const badgeConteo = document.getElementById('conteo-total-pedidos');
    if (!tabla) return;

    const ordenes = obtenerOrdenes();
    if (badgeConteo) badgeConteo.textContent = `${ordenes.length} pedidos`;

    tabla.innerHTML = ordenes.map(ord => {
      const itemsStr = (ord.detalles || []).map(d => `${d.cantidad}x ${d.productoNombre}`).join(', ');
      const fecha = new Date(ord.fechaCreacion).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      let badgeEstado = `<span class="badge-stock badge-stock--normal" style="position:static">PAGO CONFIRMADO</span>`;
      if (ord.estado === 'RECHAZADO') {
        badgeEstado = `<span class="badge-stock badge-stock--critico" style="position:static">RECHAZADO</span>`;
      }

      return `
        <tr>
          <td><strong style="color:var(--color-rojo-principal)">#${ord.id}</strong></td>
          <td style="font-weight:700">${ord.clienteNombre || 'Cliente Demo'}</td>
          <td style="color:var(--color-texto-suave);font-size:0.85rem">${fecha}</td>
          <td style="max-width:280px;font-size:0.85rem">${itemsStr}</td>
          <td style="font-weight:900">$${Number(ord.total).toFixed(2)}</td>
          <td>${badgeEstado}</td>
        </tr>
      `;
    }).join('');
  }

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto ?? '');
    return div.innerHTML;
  }

  // ---------- USUARIOS REGISTRADOS (Go + PostgreSQL) ----------
  // GET /api/auth/usuarios (gateway -> auth), solo con token de rol admin.
  // Sin datos de ejemplo: si auth no responde se muestra el error.
  const buscarUsuarios = document.getElementById('buscar-usuarios');
  let usuariosRegistrados = [];

  function mensajeTablaUsuarios(texto) {
    const tabla = document.getElementById('tabla-adm-usuarios-cuerpo');
    if (tabla) tabla.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-texto-suave)">${escapar(texto)}</td></tr>`;
  }

  async function cargarTablaUsuarios() {
    mensajeTablaUsuarios('Cargando usuarios...');
    try {
      const res = await fetch('/api/auth/usuarios', {
        headers: { Authorization: `Bearer ${window.Sesion.token()}` }
      });
      if (res.status === 401 || res.status === 403) {
        mensajeTablaUsuarios('Tu sesión no tiene permisos de administrador.');
        window.Notificaciones.toast('Tu sesión no tiene permisos de administrador.', 'alerta');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      usuariosRegistrados = await res.json();
    } catch {
      usuariosRegistrados = [];
      document.getElementById('conteo-total-usuarios').textContent = '0 usuarios';
      mensajeTablaUsuarios('No se pudo conectar con el microservicio de autenticación.');
      return;
    }
    pintarTablaUsuarios();
  }

  function pintarTablaUsuarios() {
    const tabla = document.getElementById('tabla-adm-usuarios-cuerpo');
    const badgeConteo = document.getElementById('conteo-total-usuarios');
    if (!tabla) return;

    const total = usuariosRegistrados.length;
    if (badgeConteo) badgeConteo.textContent = `${total} ${total === 1 ? 'usuario' : 'usuarios'}`;

    const filtro = (buscarUsuarios?.value || '').trim().toLowerCase();
    const visibles = usuariosRegistrados.filter(u =>
      !filtro || u.nombre.toLowerCase().includes(filtro) || u.email.toLowerCase().includes(filtro)
    );

    if (visibles.length === 0) {
      mensajeTablaUsuarios(filtro ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados.');
      return;
    }

    tabla.innerHTML = visibles.map(u => {
      const rol = u.rol === 'admin'
        ? `<span class="chip" style="font-size:0.75rem;padding:2px 8px;border-color:var(--color-rojo-principal);color:var(--color-rojo-principal)">Administrador</span>`
        : `<span class="chip" style="font-size:0.75rem;padding:2px 8px">Cliente</span>`;
      const verificado = u.verificado
        ? `<span style="color:var(--color-exito);font-weight:700">Sí</span>`
        : `<span style="color:var(--color-rojo-principal);font-weight:700">Pendiente</span>`;

      return `
        <tr>
          <td><code style="font-size:0.8rem;background:var(--color-fondo);padding:2px 6px;border-radius:4px">${escapar(u.id)}</code></td>
          <td style="font-weight:700">${escapar(u.nombre)}</td>
          <td>${escapar(u.email)}</td>
          <td>${rol}</td>
          <td>${verificado}</td>
        </tr>
      `;
    }).join('');
  }

  buscarUsuarios?.addEventListener('input', pintarTablaUsuarios);

  // ---------- 3. ANALÍTICA Y ESTADÍSTICAS (Python Microservice) ----------
  // GET /api/analitica/reportes (gateway -> analitica), solo con token de rol admin

  function pintarKpi(id, valor, formato = v => v) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor === null || valor === undefined ? 'No disponible' : formato(valor);
  }

  async function cargarMetricasPython() {
    const contenedorBarras = document.getElementById('barras-categorias-analitica');
    const listaTop = document.getElementById('lista-top-productos');

    let reporte;
    try {
      const res = await fetch('/api/analitica/reportes', {
        headers: { Authorization: `Bearer ${window.Sesion.token()}` }
      });
      if (res.status === 401 || res.status === 403) {
        window.Notificaciones.toast('Tu sesión no tiene permisos de administrador.', 'alerta');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reporte = await res.json();
    } catch {
      ['kpi-productos', 'kpi-usuarios', 'kpi-total-compras', 'kpi-ingresos'].forEach(id => pintarKpi(id, null));
      if (contenedorBarras) contenedorBarras.innerHTML = '<p style="color:var(--color-texto-suave)">No se pudo conectar con el microservicio de analítica.</p>';
      if (listaTop) listaTop.innerHTML = '';
      return;
    }

    pintarKpi('kpi-productos', reporte.productos_registrados);
    pintarKpi('kpi-usuarios', reporte.usuarios_activos);
    pintarKpi('kpi-total-compras', reporte.total_compras);
    pintarKpi('kpi-ingresos', reporte.ingresos_totales, v => `$${Number(v).toFixed(2)}`);

    // Gráfico de barras sólido rojo y blanco (sin degradados)
    if (contenedorBarras) {
      const meses = reporte.compras_por_mes || [];
      const maximo = Math.max(1, ...meses.map(m => m.compras));
      contenedorBarras.innerHTML = meses.map(m => `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:700;margin-bottom:4px">
            <span>${escapar(m.mes)}</span>
            <span style="color:var(--color-rojo-principal)">${m.compras} compras</span>
          </div>
          <div style="height:10px;background:#E5E7EB;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${(m.compras / maximo) * 100}%;background-color:var(--color-rojo-principal);border-radius:4px"></div>
          </div>
        </div>
      `).join('');
    }

    if (listaTop) {
      listaTop.innerHTML = (reporte.productos_mas_vendidos || []).map((t, idx) => `
        <li style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-blanco);border:1px solid var(--color-borde);border-radius:var(--radio-sm)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="display:grid;place-items:center;width:24px;height:24px;background:var(--color-rojo-suave);color:var(--color-rojo-principal);font-weight:900;border-radius:50%;font-size:0.75rem">${idx + 1}</span>
            <span style="font-weight:700;font-size:0.9rem">${escapar(t.producto)}</span>
          </div>
          <span class="chip" style="font-size:0.75rem;padding:2px 8px;border-color:var(--color-rojo-principal);color:var(--color-rojo-principal)">${t.unidades} uds.</span>
        </li>
      `).join('');
    }
  }

  document.getElementById('btn-refrescar-analitica')?.addEventListener('click', () => {
    cargarMetricasPython();
  });

  // Inicialización: el botón "Reportes" del header abre directo la pestaña de analítica
  function abrirPestanaSegunHash() {
    if (location.hash === '#analitica') {
      activarTab(tabAnalitica, panelAnalitica);
      cargarMetricasPython();
    } else if (location.hash === '#usuarios') {
      activarTab(tabUsuarios, panelUsuarios);
      cargarTablaUsuarios();
    } else {
      cargarTablaProductos();
    }
  }
  window.addEventListener('hashchange', abrirPestanaSegunHash);
  abrirPestanaSegunHash();
})();
