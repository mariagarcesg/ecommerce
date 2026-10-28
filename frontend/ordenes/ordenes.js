// ==========================================================================
// ECOMMERCE - CONTROLADOR DE ÓRDENES (JAVA + POSTGRESQL [ordenes])
// ==========================================================================

(function () {
  const contenedor = document.getElementById('contenedor-lista-ordenes');

  // GET /api/ordenes/mias: compras confirmadas de quien inició sesión (ordenes, PostgreSQL)
  async function obtenerOrdenes() {
    const res = await fetch('/api/ordenes/mias', {
      headers: { Authorization: `Bearer ${window.Sesion.token()}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function mensaje(icono, titulo, texto, enlace) {
    contenedor.innerHTML = `
      <div style="text-align:center;padding:60px 20px;background:var(--color-blanco);border-radius:var(--radio-lg);border:1px solid var(--color-borde)">
        <p style="font-size:3rem;margin-bottom:12px">${icono}</p>
        <h2 style="font-size:1.3rem;font-weight:800;color:var(--color-texto)">${titulo}</h2>
        <p style="color:var(--color-texto-suave);margin-top:6px">${texto}</p>
        ${enlace}
      </div>
    `;
  }

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto ?? '');
    return div.innerHTML;
  }

  async function renderizar() {
    if (!contenedor) return;
    if (!window.Sesion.token()) {
      mensaje('🔐', 'Inicia sesión para ver tus pedidos', 'Tus compras quedan guardadas en tu cuenta.',
        '<a class="boton boton--sm" style="margin-top:16px" href="../login/index.html">Iniciar sesión</a>');
      return;
    }

    let ordenes;
    try {
      ordenes = await obtenerOrdenes();
    } catch {
      mensaje('⚠️', 'No se pudieron cargar tus pedidos', 'El servicio de órdenes no respondió. Intenta de nuevo en unos segundos.', '');
      return;
    }

    if (ordenes.length === 0) {
      mensaje('📦', 'Aún no tienes pedidos registrados', 'Tus compras confirmadas aparecerán aquí.',
        '<a class="boton boton--sm" style="margin-top:16px" href="../catalogo/index.html">Ir al Catálogo de Productos</a>');
      return;
    }

    contenedor.innerHTML = ordenes.map(ord => {
      const fecha = new Date(ord.fechaCreacion).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const itemsHtml = (ord.detalles || []).map(d => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--color-borde);font-size:0.9rem">
          <div>
            <span style="font-weight:700">${d.cantidad}x</span> ${escapar(d.productoNombre)}
          </div>
          <div style="font-weight:700">$${(Number(d.precioUnitario) * (d.cantidad || 1)).toFixed(2)}</div>
        </div>
      `).join('');

      // Solo se registran compras con el pago aprobado
      const badgeEstado = `<span class="badge-stock badge-stock--normal" style="position:static">PAGO CONFIRMADO</span>`;

      return `
        <div style="background:var(--color-blanco);border:1px solid var(--color-borde);border-left:5px solid var(--color-rojo-principal);border-radius:var(--radio-lg);padding:20px 24px;box-shadow:var(--sombra-sm)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--color-borde)">
            <div>
              <span style="font-size:0.8rem;font-weight:800;color:var(--color-rojo-principal);text-transform:uppercase">Pedido #${ord.id}</span>
              <div style="color:var(--color-texto-suave);font-size:0.85rem">${fecha}</div>
            </div>
            ${badgeEstado}
          </div>

          <div style="margin-bottom:14px">
            <h4 style="font-size:0.85rem;font-weight:800;color:var(--color-texto-suave);text-transform:uppercase;margin-bottom:8px">Artículos Comprados</h4>
            ${itemsHtml}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:10px;font-size:0.9rem">
            <div style="color:var(--color-texto-suave)">
              ${ord.tarjetaUltimos4 ? `<span>Tarjeta: <strong>•••• •••• •••• ${escapar(ord.tarjetaUltimos4)}</strong></span>` : ''}
              ${ord.direccion ? ` | <span>Envío a: <strong>${escapar(ord.direccion)}${ord.ciudad ? ', ' + escapar(ord.ciudad) : ''}</strong></span>` : ''}
            </div>
            <div style="font-size:1.25rem;font-weight:900;color:var(--color-texto)">
              ${Number(ord.descuento) > 0 ? `<span style="font-size:0.85rem;font-weight:600;color:var(--color-texto-suave)">Cupón ${escapar(ord.cupon)}: -$${Number(ord.descuento).toFixed(2)} · </span>` : ''}Total: <span style="color:var(--color-rojo-principal)">$${Number(ord.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderizar();
})();
