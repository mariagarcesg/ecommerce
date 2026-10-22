// ==========================================================================
// ECOMMERCE - CONTROLADOR DE ÓRDENES (JAVA + POSTGRESQL [ordenes])
// ==========================================================================

(function () {
  const contenedor = document.getElementById('contenedor-lista-ordenes');

  function obtenerOrdenes() {
    try {
      const ords = JSON.parse(localStorage.getItem('ecommerce_ordenes'));
      if (ords && ords.length > 0) return ords;
    } catch {}

    // Datos demostrativos de compras previas
    return [
      {
        id: 104521,
        clienteNombre: 'Carlos Mendoza',
        direccion: 'Av. Libertador, Edif. Torre Centro, Piso 5',
        fechaCreacion: new Date(Date.now() - 3600000 * 2).toISOString(),
        detalles: [
          { productoNombre: 'Smartphone Crimson Pro 256GB', cantidad: 1, precioUnitario: 799.99 },
          { productoNombre: 'Funda Protectora Silicona Roja', cantidad: 1, precioUnitario: 24.99 }
        ],
        total: 824.98,
        estado: 'PAGADO',
        tarjetaUltimos4: '1234'
      },
      {
        id: 104520,
        clienteNombre: 'Cliente Demo',
        direccion: 'Calle Los Pinos 42, Urb. Miranda',
        fechaCreacion: new Date(Date.now() - 3600000 * 24).toISOString(),
        detalles: [
          { productoNombre: 'Zapatillas Deportivas Runner Red', cantidad: 1, precioUnitario: 89.50 }
        ],
        total: 71.60, // con cupón PROFE20
        estado: 'PAGADO',
        tarjetaUltimos4: '1234'
      }
    ];
  }

  function renderizar() {
    if (!contenedor) return;
    const ordenes = obtenerOrdenes();

    if (ordenes.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:var(--color-blanco);border-radius:var(--radio-lg);border:1px solid var(--color-borde)">
          <p style="font-size:3rem;margin-bottom:12px">📦</p>
          <h2 style="font-size:1.3rem;font-weight:800;color:var(--color-texto)">Aún no tienes pedidos registrados</h2>
          <p style="color:var(--color-texto-suave);margin-top:6px">Tus compras confirmadas aparecerán aquí con seguimiento en tiempo real.</p>
          <a class="boton boton--sm" style="margin-top:16px" href="../catalogo/index.html">Ir al Catálogo de Productos</a>
        </div>
      `;
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
            <span style="font-weight:700">${d.cantidad}x</span> ${d.productoNombre}
          </div>
          <div style="font-weight:700">$${(Number(d.precioUnitario) * (d.cantidad || 1)).toFixed(2)}</div>
        </div>
      `).join('');

      let badgeEstado = `<span class="badge-stock badge-stock--normal" style="position:static">PAGO CONFIRMADO (ACID JAVA)</span>`;
      if (ord.estado === 'RECHAZADO') {
        badgeEstado = `<span class="badge-stock badge-stock--critico" style="position:static">TRANSACCIÓN REVERTIDA</span>`;
      }

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
              <span>Tarjeta: <strong>•••• •••• •••• ${ord.tarjetaUltimos4 || '1234'}</strong></span>
              ${ord.direccion ? ` | <span>Envío a: <strong>${ord.direccion}</strong></span>` : ''}
            </div>
            <div style="font-size:1.25rem;font-weight:900;color:var(--color-texto)">
              Total: <span style="color:var(--color-rojo-principal)">$${Number(ord.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderizar();
})();
