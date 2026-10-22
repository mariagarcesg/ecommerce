// ==========================================================================
// ECOMMERCE - CONTROLADOR DEL CATÁLOGO DE PRODUCTOS (IDEAS 01, 04, 06, 07, 10)
// ==========================================================================

(function () {
  // Catálogo base con datos realistas para demostración y fallback
  const PRODUCTOS_INICIALES = [
    {
      id: "prod-01",
      name: "Smartphone Crimson Pro 256GB",
      price: 799.99,
      stock: 3, // Escasez Crítica (IDEA 07: < 5)
      category: "Electrónica",
      sizes: ["128GB", "256GB", "512GB"],
      colors: ["Rojo Carmesí", "Blanco Glaciar", "Negro Ónix"],
      details: ["Pantalla AMOLED 6.7\" 120Hz", "Cámara Triple 108MP", "Batería 5000mAh carga 67W"],
      description: "Smartphone de alto rendimiento con acabado rojo mate y marco de aluminio pulido. Máxima velocidad para multitarea.",
      imagen: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80",
      reviews: [
        { autor: "Carlos M.", estrellas: 5, comentario: "Excelente pantalla y la batería dura todo el día.", fecha: "18/10/2026" },
        { autor: "Andrea S.", estrellas: 4, comentario: "El color rojo es hermoso, muy buen equipo.", fecha: "15/10/2026" }
      ]
    },
    {
      id: "prod-02",
      name: "Funda Protectora Silicona Roja",
      price: 24.99,
      stock: 45,
      category: "Accesorios",
      sizes: ["Pro", "Pro Max"],
      colors: ["Rojo Escarlata", "Blanco Nieve"],
      details: ["Interior de microfibra suave", "Compatible con carga MagSafe", "Bordes reforzados"],
      description: "Protección ultra resistente contra caídas y rayones con textura sedosa al tacto.",
      imagen: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&q=80",
      reviews: [
        { autor: "Javier R.", estrellas: 5, comentario: "Encaja perfecta en el teléfono, no resbala.", fecha: "12/10/2026" }
      ]
    },
    {
      id: "prod-03",
      name: "Laptop Pro Ultradelgada 16\"",
      price: 1299.00,
      stock: 8,
      category: "Electrónica",
      sizes: ["16GB RAM / 512GB SSD", "32GB RAM / 1TB SSD"],
      colors: ["Blanco Titanio", "Gris Espacial"],
      details: ["Procesador 12 núcleos", "Pantalla 3K Liquid Retina", "Batería hasta 18 horas"],
      description: "Potencia gráfica y cálculo extremo en un chasis unibody ultrafino y silencioso.",
      imagen: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80",
      reviews: [
        { autor: "Lucía P.", estrellas: 5, comentario: "Una bestia de máquina para programar y renderizar.", fecha: "20/10/2026" }
      ]
    },
    {
      id: "prod-04",
      name: "Mouse Ergonómico Inalámbrico Silent",
      price: 39.99,
      stock: 19,
      category: "Accesorios",
      sizes: ["Única"],
      colors: ["Rojo Rubí", "Blanco Mate"],
      details: ["Clicks 100% silenciosos", "Sensor óptico 4000 DPI", "Batería recargable USB-C"],
      description: "Diseño ergonómico que reduce la fatiga en la muñeca durante largas jornadas de trabajo.",
      imagen: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80",
      reviews: [
        { autor: "Gabriel T.", estrellas: 4, comentario: "Muy cómodo y silencioso, justo lo que necesitaba.", fecha: "05/10/2026" }
      ]
    },
    {
      id: "prod-05",
      name: "Zapatillas Deportivas Runner Red",
      price: 89.50,
      stock: 4, // Escasez Crítica (IDEA 07: < 5)
      category: "Calzado",
      sizes: ["38", "39", "40", "41", "42", "43"],
      colors: ["Rojo y Blanco", "Blanco Puro"],
      details: ["Suela con amortiguación de aire", "Malla transpirable", "Plantilla ortopédica removible"],
      description: "Zapatillas ligeras diseñadas para corredores de media y larga distancia o uso urbano diario.",
      imagen: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
      reviews: [
        { autor: "Marcos V.", estrellas: 5, comentario: "Super ligeras y el diseño en rojo llama la atención.", fecha: "19/10/2026" }
      ]
    },
    {
      id: "prod-06",
      name: "Camiseta Deportiva Transpirable Fit",
      price: 29.90,
      stock: 25,
      category: "Ropa",
      sizes: ["S", "M", "L", "XL"],
      colors: ["Blanco con franja roja", "Rojo Sólido"],
      details: ["Tecnología Dri-Fit", "Costuras planas antiroce", "100% poliéster reciclado"],
      description: "Camiseta deportiva ultra cómoda que absorbe el sudor manteniéndote seco durante el entrenamiento.",
      imagen: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
      reviews: [
        { autor: "Elena D.", estrellas: 4, comentario: "Tela suave y fresca, talla perfecta.", fecha: "10/10/2026" }
      ]
    },
    {
      id: "prod-07",
      name: "Cafetera Expreso Barista Red",
      price: 189.00,
      stock: 0, // AGOTADO (IDEA 07: stock = 0)
      category: "Hogar",
      sizes: ["1.5 Litros"],
      colors: ["Rojo Vintage", "Blanco Retro"],
      details: ["Bomba de 20 bares de presión", "Vaporizador de leche para cappuccino", "Calentador de tazas superior"],
      description: "Disfruta de café con crema espesa en la comodidad de tu hogar. Estilo retro italiano.",
      imagen: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&q=80",
      reviews: [
        { autor: "Ricardo N.", estrellas: 5, comentario: "Saca un café digno de cafetería italiana.", fecha: "01/10/2026" }
      ]
    },
    {
      id: "prod-08",
      name: "Audífonos Inalámbricos Noise Cancelling",
      price: 149.99,
      stock: 12,
      category: "Electrónica",
      sizes: ["Estuche estándar"],
      colors: ["Blanco Puro", "Rojo Carmesí"],
      details: ["Cancelación activa de ruido (ANC)", "36 horas de autonomía", "Carga inalámbrica Qi"],
      description: "Audio envolvente de alta fidelidad con graves profundos y almohadillas de memoria viscoelástica.",
      imagen: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
      reviews: [
        { autor: "Sofía F.", estrellas: 5, comentario: "La cancelación de ruido aísla todo en la oficina.", fecha: "14/10/2026" },
        { autor: "Mario G.", estrellas: 4, comentario: "Muy buen sonido y comodísimos.", fecha: "11/10/2026" }
      ]
    }
  ];

  let listaProductos = [];
  let categoriaActual = 'Todas';
  let busquedaActual = '';
  let minPrecio = null;
  let maxPrecio = null;
  let ordenActual = 'relevancia';
  let soloStock = false;

  // Carga productos desde MongoDB (o recurre al catálogo local)
  async function cargarProductos() {
    try {
      const res = await fetch('/api/catalogo/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          listaProductos = data.map((p, idx) => ({
            id: p._id || p.id || `prod-${idx}`,
            name: p.name,
            price: Number(p.price),
            stock: Number(p.stock !== undefined ? p.stock : 10),
            category: (p.category && p.category.name) ? p.category.name : (p.category || 'General'),
            sizes: p.sizes || ['Estándar'],
            colors: p.colors || ['Rojo', 'Blanco'],
            details: p.details || ['Calidad garantizada'],
            description: p.description || 'Producto de alta calidad disponible en nuestra tienda.',
            imagen: p.imagen || PRODUCTOS_INICIALES[idx % PRODUCTOS_INICIALES.length].imagen,
            reviews: p.reviews || [
              { autor: 'Comprador Verificado', estrellas: 5, comentario: 'Excelente producto, entrega rápida.', fecha: '21/10/2026' }
            ]
          }));
        } else {
          listaProductos = [...PRODUCTOS_INICIALES];
        }
      } else {
        listaProductos = [...PRODUCTOS_INICIALES];
      }
    } catch {
      listaProductos = [...PRODUCTOS_INICIALES];
    }

    renderizarCategoriasChips();
    aplicarFiltrosYRenderizar();
    generarRecomendacionesPython();
  }

  // Renderiza chips de categorías dinámicas (IDEA 04)
  function renderizarCategoriasChips() {
    const contenedor = document.getElementById('contenedor-chips-categorias');
    if (!contenedor) return;

    const categorias = ['Todas', ...new Set(listaProductos.map(p => p.category))];
    contenedor.innerHTML = categorias.map(cat => `
      <button class="chip ${cat === categoriaActual ? 'chip--activo' : ''}" type="button" data-categoria="${cat}">
        ${cat}
      </button>
    `).join('');

    contenedor.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        categoriaActual = btn.getAttribute('data-categoria');
        renderizarCategoriasChips();
        aplicarFiltrosYRenderizar();
      });
    });
  }

  // Calcula promedio de estrellas de un producto (IDEA 06)
  function calcularEstrellas(producto) {
    if (!producto.reviews || producto.reviews.length === 0) {
      return { promedio: 5.0, total: 1 };
    }
    const suma = producto.reviews.reduce((acc, r) => acc + (r.estrellas || 5), 0);
    const prom = (suma / producto.reviews.length).toFixed(1);
    return { promedio: prom, total: producto.reviews.length };
  }

  // Genera estrellas en SVG
  function renderEstrellasSVG(promedio) {
    const p = Math.round(Number(promedio));
    let svgStr = '';
    for (let i = 1; i <= 5; i++) {
      const color = i <= p ? 'var(--color-estrella)' : '#D1D5DB';
      svgStr += `<span class="estrella-icono" style="color:${color}"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>`;
    }
    return svgStr;
  }

  // Filtrado, Ordenamiento y Renderizado (IDEA 04 & IDEA 07)
  function aplicarFiltrosYRenderizar() {
    let filtrados = listaProductos.filter(p => {
      // Categoría
      if (categoriaActual !== 'Todas' && p.category !== categoriaActual) return false;
      // Búsqueda por texto (nombre o descripción)
      if (busquedaActual) {
        const q = busquedaActual.toLowerCase();
        const coincide = (p.name || '').toLowerCase().includes(q) ||
                         (p.description || '').toLowerCase().includes(q) ||
                         (p.category || '').toLowerCase().includes(q);
        if (!coincide) return false;
      }
      // Precio mínimo y máximo
      if (minPrecio !== null && !isNaN(minPrecio) && p.price < minPrecio) return false;
      if (maxPrecio !== null && !isNaN(maxPrecio) && p.price > maxPrecio) return false;
      // Solo en stock
      if (soloStock && (p.stock || 0) <= 0) return false;

      return true;
    });

    // Ordenamiento
    if (ordenActual === 'precio-asc') {
      filtrados.sort((a, b) => a.price - b.price);
    } else if (ordenActual === 'precio-desc') {
      filtrados.sort((a, b) => b.price - a.price);
    } else if (ordenActual === 'calificacion') {
      filtrados.sort((a, b) => Number(calcularEstrellas(b).promedio) - Number(calcularEstrellas(a).promedio));
    }

    // Actualizar encabezado
    const titulo = document.getElementById('catalogo-titulo');
    const conteo = document.getElementById('catalogo-conteo');
    if (titulo) titulo.textContent = categoriaActual === 'Todas' ? 'Catálogo General' : `Categoría: ${categoriaActual}`;
    if (conteo) conteo.textContent = `Mostrando ${filtrados.length} de ${listaProductos.length} productos`;

    const grilla = document.getElementById('grilla-productos');
    if (!grilla) return;

    if (filtrados.length === 0) {
      grilla.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--color-blanco); border-radius: var(--radio-lg); border: 1px dashed var(--color-borde-fuerte);">
          <p style="font-size: 3rem; margin-bottom: 12px">🔍</p>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--color-texto);">No encontramos productos</h3>
          <p style="color: var(--color-texto-suave); margin-top: 6px;">Intenta cambiar el término de búsqueda o limpia los filtros aplicados.</p>
          <button class="boton boton--secundario boton--sm" style="margin-top: 16px;" onclick="document.getElementById('btn-limpiar-filtros').click()">Limpiar filtros</button>
        </div>
      `;
      return;
    }

    grilla.innerHTML = filtrados.map(prod => {
      const { promedio, total } = calcularEstrellas(prod);
      const esFav = window.Favoritos.esFavorito(prod.id);
      
      // Manejo de Stock y Alertas (IDEA 07)
      let badgeStockHtml = '';
      let btnComprarDisabled = '';
      let btnComprarTexto = 'Agregar al Carrito';

      if (prod.stock <= 0) {
        badgeStockHtml = `<span class="badge-stock badge-stock--agotado">Agotado</span>`;
        btnComprarDisabled = 'disabled style="opacity:0.5;cursor:not-allowed;"';
        btnComprarTexto = 'Sin Stock';
      } else if (prod.stock < 5) {
        badgeStockHtml = `<span class="badge-stock badge-stock--critico">¡Solo quedan ${prod.stock}!</span>`;
      } else {
        badgeStockHtml = `<span class="badge-stock badge-stock--normal">${prod.stock} en stock</span>`;
      }

      return `
        <article class="producto-card" data-id="${prod.id}">
          <div class="producto-card__imagen-caja">
            ${badgeStockHtml}
            <button class="producto-card__favorito ${esFav ? 'producto-card__favorito--activo' : ''}"
                    type="button"
                    title="${esFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}"
                    onclick="window.Favoritos.toggle(${JSON.stringify(prod).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <img class="producto-card__imagen" src="${prod.imagen}" alt="${prod.name}" loading="lazy">
          </div>

          <div class="producto-card__cuerpo">
            <span class="producto-card__categoria">${prod.category}</span>
            <h3 class="producto-card__titulo">${prod.name}</h3>

            <div class="estrellas">
              ${renderEstrellasSVG(promedio)}
              <span class="estrellas__promedio">${promedio}</span>
              <span class="estrellas__conteo">(${total})</span>
            </div>

            <div class="producto-card__precio-fila">
              <span class="producto-card__precio">$${prod.price.toFixed(2)}</span>
            </div>

            <div class="producto-card__acciones">
              <button class="boton boton--secundario boton--sm" style="flex:1" type="button" onclick="window.abrirModalDetalle('${prod.id}')">
                Ver detalle
              </button>
              <button class="boton boton--sm" style="flex:1" type="button" ${btnComprarDisabled} onclick="window.Carrito.agregar(${JSON.stringify(prod).replace(/"/g, '&quot;')})">
                ${btnComprarTexto}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // ====================================================================
  // FUNCIÓN DE PYTHON: MOTOR DE RECOMENDACIONES (IDEA 01)
  // ====================================================================
  async function generarRecomendacionesPython() {
    const contenedor = document.getElementById('grilla-recomendaciones-python');
    if (!contenedor) return;

    // Regla de recomendación (Slide 3): Compra de teléfono dispara funda, laptop dispara mouse, etc.
    const cartItems = window.Carrito.obtenerItems();
    let sugerencias = [];

    // Intenta consultar la API real si el microservicio Python está corriendo
    try {
      const prodRefId = cartItems.length > 0 ? cartItems[0].id : 'prod-01';
      const res = await fetch(`/api/analitica/recomendaciones?productoId=${prodRefId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          sugerencias = data;
        }
      }
    } catch {
      // Fallback a motor local simulado
    }

    if (sugerencias.length === 0) {
      // Algoritmo de afinidad complementaria (Cross-Selling)
      sugerencias = [
        {
          tag: 'Venta Cruzada Recomendada',
          nombre: 'Funda Protectora Silicona Roja',
          precio: 24.99,
          motivo: 'Frecuentemente comprado junto con Smartphone Crimson Pro',
          prodOriginal: PRODUCTOS_INICIALES[1]
        },
        {
          tag: 'Complemento de Tecnología',
          nombre: 'Mouse Ergonómico Inalámbrico Silent',
          precio: 39.99,
          motivo: '87% de los compradores de Laptops agregaron este mouse',
          prodOriginal: PRODUCTOS_INICIALES[3]
        },
        {
          tag: 'Oferta Especial del Día',
          nombre: 'Audífonos Inalámbricos Noise Cancelling',
          precio: 149.99,
          motivo: 'Sugerencia inteligente de alta fidelidad acústica',
          prodOriginal: PRODUCTOS_INICIALES[7]
        }
      ];
    }

    contenedor.innerHTML = sugerencias.map(sug => `
      <div class="recom-card">
        <span class="recom-card__tag">⚡ ${sug.tag}</span>
        <h4 class="recom-card__nombre">${sug.nombre}</h4>
        <p style="font-size:0.8rem;color:var(--color-texto-suave);">${sug.motivo}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:8px">
          <span class="recom-card__precio">$${sug.precio.toFixed(2)}</span>
          <button class="boton boton--sm" type="button" onclick="Carrito.agregar(${JSON.stringify(sug.prodOriginal || PRODUCTOS_INICIALES[1]).replace(/"/g, '&quot;')})">
            + Agregar
          </button>
        </div>
      </div>
    `).join('');
  }

  // Botón para forzar ejecución del análisis de afinidad Python
  document.getElementById('btn-ejecutar-python-api')?.addEventListener('click', async () => {
    window.Notificaciones.toast('Analizando historial y matrices de afinidad con Python...', 'info');
    await new Promise(r => setTimeout(r, 600));
    generarRecomendacionesPython();
    window.Notificaciones.toast('Recomendaciones de venta cruzada actualizadas.', 'exito');
  });

  // ====================================================================
  // MODAL DE DETALLE Y RESEÑAS DINÁMICAS (IDEA 06)
  // ====================================================================
  window.abrirModalDetalle = function (prodId) {
    const prod = listaProductos.find(p => String(p.id) === String(prodId));
    if (!prod) return;

    const modal = document.getElementById('modal-detalle-producto');
    const titulo = document.getElementById('modal-prod-nombre');
    const cuerpo = document.getElementById('modal-prod-cuerpo');
    const { promedio, total } = calcularEstrellas(prod);

    titulo.textContent = prod.name;

    cuerpo.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="background:#F3F4F6;border-radius:var(--radio);overflow:hidden;display:grid;place-items:center;height:240px">
          <img src="${prod.imagen}" alt="${prod.name}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <span style="font-size:0.8rem;font-weight:700;color:var(--color-rojo-principal);text-transform:uppercase">${prod.category}</span>
          <div style="font-size:1.6rem;font-weight:900;color:var(--color-texto)">$${prod.price.toFixed(2)}</div>
          <div class="estrellas">
            ${renderEstrellasSVG(promedio)}
            <span class="estrellas__promedio">${promedio} / 5</span>
            <span class="estrellas__conteo">(${total} valoraciones)</span>
          </div>
          <p style="font-size:0.9rem;color:var(--color-texto-suave);line-height:1.4">${prod.description}</p>
          <div style="font-size:0.85rem">
            <strong>Stock disponible:</strong> ${prod.stock > 0 ? `<span style="color:var(--color-exito);font-weight:700">${prod.stock} unidades</span>` : '<span style="color:var(--color-rojo-principal);font-weight:700">Agotado</span>'}
          </div>
          <button class="boton boton--bloque" style="margin-top:auto" ${prod.stock <= 0 ? 'disabled' : ''} onclick="Carrito.agregar(${JSON.stringify(prod).replace(/"/g, '&quot;')})">
            ${prod.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
          </button>
        </div>
      </div>

      <!-- Sección de Reseñas y Calificaciones (IDEA 06) -->
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--color-borde)">
        <h4 style="font-size:1.1rem;font-weight:800;margin-bottom:12px;color:var(--color-texto)">Opiniones y Reseñas de Clientes</h4>
        
        <div id="lista-resenas" style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
          ${(prod.reviews || []).map(r => `
            <div style="background:var(--color-fondo);padding:10px 14px;border-radius:var(--radio-sm);border:1px solid var(--color-borde)">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <strong style="font-size:0.88rem">${r.autor}</strong>
                <span style="color:var(--color-texto-suave);font-size:0.75rem">${r.fecha || 'Reciente'}</span>
              </div>
              <div class="estrellas" style="margin-bottom:4px">${renderEstrellasSVG(r.estrellas)}</div>
              <p style="font-size:0.85rem;color:var(--color-texto);">${r.comentario}</p>
            </div>
          `).join('')}
        </div>

        <!-- Formulario para agregar nueva reseña -->
        <form id="form-nueva-resena" style="background:var(--color-rojo-suave);padding:14px;border-radius:var(--radio);border:1px solid var(--color-rojo-borde)">
          <h5 style="font-weight:800;color:var(--color-rojo-profundo);margin-bottom:8px">Deja tu valoración del producto</h5>
          <div class="form-fila" style="margin-bottom:10px">
            <div class="form-grupo">
              <label for="res-nombre" style="font-size:0.8rem">Tu Nombre</label>
              <input type="text" id="res-nombre" required placeholder="Ej: María Gómez" style="background:var(--color-blanco);padding:6px 10px">
            </div>
            <div class="form-grupo">
              <label for="res-estrellas" style="font-size:0.8rem">Calificación</label>
              <select id="res-estrellas" style="background:var(--color-blanco);padding:6px 10px">
                <option value="5">★★★★★ (5 Estrellas)</option>
                <option value="4">★★★★☆ (4 Estrellas)</option>
                <option value="3">★★★☆☆ (3 Estrellas)</option>
                <option value="2">★★☆☆☆ (2 Estrellas)</option>
                <option value="1">★☆☆☆☆ (1 Estrella)</option>
              </select>
            </div>
          </div>
          <div class="form-grupo" style="margin-bottom:10px">
            <label for="res-comentario" style="font-size:0.8rem">Comentario</label>
            <textarea id="res-comentario" rows="2" required placeholder="¿Qué te pareció este artículo?" style="background:var(--color-blanco);padding:6px 10px"></textarea>
          </div>
          <button class="boton boton--sm" type="submit">Publicar Reseña</button>
        </form>
      </div>
    `;

    modal.classList.add('modal-backdrop--abierto');

    // Manejar envío de reseña
    document.getElementById('form-nueva-resena')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const autor = document.getElementById('res-nombre').value;
      const estrellas = Number(document.getElementById('res-estrellas').value);
      const comentario = document.getElementById('res-comentario').value;

      if (!prod.reviews) prod.reviews = [];
      prod.reviews.unshift({
        autor,
        estrellas,
        comentario,
        fecha: new Date().toLocaleDateString('es-ES')
      });

      window.Notificaciones.toast('¡Gracias por tu reseña! Calificación actualizada.', 'exito');
      window.abrirModalDetalle(prodId);
      aplicarFiltrosYRenderizar();
    });
  };

  document.getElementById('btn-cerrar-modal-detalle')?.addEventListener('click', () => {
    document.getElementById('modal-detalle-producto')?.classList.remove('modal-backdrop--abierto');
  });

  // Filtros reactivos
  document.getElementById('filtro-min-precio')?.addEventListener('input', (e) => {
    minPrecio = e.target.value ? parseFloat(e.target.value) : null;
    aplicarFiltrosYRenderizar();
  });

  document.getElementById('filtro-max-precio')?.addEventListener('input', (e) => {
    maxPrecio = e.target.value ? parseFloat(e.target.value) : null;
    aplicarFiltrosYRenderizar();
  });

  document.getElementById('filtro-orden')?.addEventListener('change', (e) => {
    ordenActual = e.target.value;
    aplicarFiltrosYRenderizar();
  });

  document.getElementById('filtro-solo-stock')?.addEventListener('change', (e) => {
    soloStock = e.target.checked;
    aplicarFiltrosYRenderizar();
  });

  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => {
    categoriaActual = 'Todas';
    busquedaActual = '';
    minPrecio = null;
    maxPrecio = null;
    ordenActual = 'relevancia';
    soloStock = false;

    document.getElementById('filtro-min-precio').value = '';
    document.getElementById('filtro-max-precio').value = '';
    document.getElementById('filtro-orden').value = 'relevancia';
    document.getElementById('filtro-solo-stock').checked = false;
    const inputGlobal = document.getElementById('input-buscador-global');
    if (inputGlobal) inputGlobal.value = '';

    renderizarCategoriasChips();
    aplicarFiltrosYRenderizar();
  });

  // Listener para evento de búsqueda desde navbar
  window.addEventListener('busqueda-ejecutada', (e) => {
    busquedaActual = e.detail.query || '';
    aplicarFiltrosYRenderizar();
  });

  // Chequeo de parámetro url 'q'
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('q')) {
    busquedaActual = urlParams.get('q');
    const inputGlobal = document.getElementById('input-buscador-global');
    if (inputGlobal) inputGlobal.value = busquedaActual;
  }

  // Reaccionar a cambios en favoritos para actualizar iconos de corazón
  window.addEventListener('favoritos-actualizado', aplicarFiltrosYRenderizar);

  // Inicialización
  cargarProductos();
})();
