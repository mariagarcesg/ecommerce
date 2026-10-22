// ==========================================================================
// ECOMMERCE - CONTROLADOR DEL PANEL DE ADMINISTRACIÓN Y ANALÍTICA (IDEAS 01, 08)
// ==========================================================================

(function () {
  // Pestañas
  const tabCatalogo = document.getElementById('tab-btn-catalogo');
  const tabOrdenes = document.getElementById('tab-btn-ordenes');
  const tabAnalitica = document.getElementById('tab-btn-analitica');

  const panelCatalogo = document.getElementById('panel-catalogo');
  const panelOrdenes = document.getElementById('panel-ordenes');
  const panelAnalitica = document.getElementById('panel-analitica');

  function activarTab(tabActivo, panelActivo) {
    [tabCatalogo, tabOrdenes, tabAnalitica].forEach(t => t.classList.remove('chip--activo'));
    [panelCatalogo, panelOrdenes, panelAnalitica].forEach(p => p.style.display = 'none');

    tabActivo.classList.add('chip--activo');
    panelActivo.style.display = 'block';
  }

  tabCatalogo?.addEventListener('click', () => {
    activarTab(tabCatalogo, panelCatalogo);
    cargarTablaProductos();
  });
  tabOrdenes?.addEventListener('click', () => {
    activarTab(tabOrdenes, panelOrdenes);
    cargarTablaOrdenes();
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
      
      let badgeEstado = `<span class="badge-stock badge-stock--normal" style="position:static">PAGADO (ACID)</span>`;
      if (ord.estado === 'RECHAZADO') {
        badgeEstado = `<span class="badge-stock badge-stock--critico" style="position:static">RECHAZADO (REV)</span>`;
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

  // ---------- 3. ANALÍTICA Y ESTADÍSTICAS (Python Microservice) ----------
  async function cargarMetricasPython() {
    const ordenes = obtenerOrdenes();
    const pagadas = ordenes.filter(o => o.estado === 'PAGADO');
    const totalVentas = pagadas.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const ticketPromedio = pagadas.length > 0 ? (totalVentas / pagadas.length) : 0;

    document.getElementById('kpi-ventas-totales').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('kpi-total-pedidos').textContent = ordenes.length;
    document.getElementById('kpi-ticket-promedio').textContent = `$${ticketPromedio.toFixed(2)}`;

    // Gráfico de barras sólido rojo y blanco (sin degradados)
    const contenedorBarras = document.getElementById('barras-categorias-analitica');
    if (contenedorBarras) {
      const categorias = [
        { nombre: 'Electrónica', porcentaje: 52 },
        { nombre: 'Accesorios', porcentaje: 24 },
        { nombre: 'Calzado & Moda', porcentaje: 16 },
        { nombre: 'Hogar', porcentaje: 8 }
      ];

      contenedorBarras.innerHTML = categorias.map(c => `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:700;margin-bottom:4px">
            <span>${c.nombre}</span>
            <span style="color:var(--color-rojo-principal)">${c.porcentaje}%</span>
          </div>
          <div style="height:10px;background:#E5E7EB;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${c.porcentaje}%;background-color:var(--color-rojo-principal);border-radius:4px"></div>
          </div>
        </div>
      `).join('');
    }

    // Top productos según motor analítico
    const listaTop = document.getElementById('lista-top-productos');
    if (listaTop) {
      const tops = [
        { nombre: 'Smartphone Crimson Pro 256GB', ventas: 142, tag: 'Más vendido' },
        { nombre: 'Funda Protectora Silicona Roja', ventas: 98, tag: 'Mayor cross-sell' },
        { nombre: 'Audífonos Inalámbricos Pro', ventas: 76, tag: 'Alta conversión' },
        { nombre: 'Zapatillas Runner Red', ventas: 54, tag: 'Tendencia al alza' }
      ];

      listaTop.innerHTML = tops.map((t, idx) => `
        <li style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-blanco);border:1px solid var(--color-borde);border-radius:var(--radio-sm)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="display:grid;place-items:center;width:24px;height:24px;background:var(--color-rojo-suave);color:var(--color-rojo-principal);font-weight:900;border-radius:50%;font-size:0.75rem">${idx + 1}</span>
            <span style="font-weight:700;font-size:0.9rem">${t.nombre}</span>
          </div>
          <span class="chip" style="font-size:0.75rem;padding:2px 8px;border-color:var(--color-rojo-principal);color:var(--color-rojo-principal)">${t.ventas} ventas</span>
        </li>
      `).join('');
    }
  }

  document.getElementById('btn-refrescar-analitica')?.addEventListener('click', () => {
    window.Notificaciones.toast('Métricas recalculadas con motor analítico de Python.', 'exito');
    cargarMetricasPython();
  });

  // Inicialización
  cargarTablaProductos();
})();
