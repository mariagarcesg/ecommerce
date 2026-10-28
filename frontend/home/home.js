// ==========================================================================
// ECOMMERCE - HOME (tienda de tecnología)
// Destacados desde GET /api/catalogo/products (gateway -> catalogo), con una
// lista local de respaldo si el servicio no responde. Animaciones: aparición
// al hacer scroll, contadores, marquesina y cuenta regresiva de la oferta.
// ==========================================================================

(function () {
  document.documentElement.classList.add('home-js');

  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Productos tecnológicos del seed del catálogo, por si la API no responde
  const RESPALDO = [
    { id: '671600000000000000000003', name: 'Laptop Pro Ultradelgada 16"', price: 1299.00, stock: 8, category: 'Electrónica', details: ['Procesador 12 núcleos'], imagen: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80' },
    { id: '671600000000000000000001', name: 'Smartphone Crimson Pro 256GB', price: 799.99, stock: 3, category: 'Electrónica', details: ['Pantalla AMOLED 6.7" 120Hz'], imagen: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80' },
    { id: '671600000000000000000008', name: 'Audífonos Inalámbricos Noise Cancelling', price: 149.99, stock: 12, category: 'Electrónica', details: ['Cancelación activa de ruido'], imagen: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80' },
    { id: '671600000000000000000004', name: 'Mouse Ergonómico Inalámbrico Silent', price: 39.99, stock: 19, category: 'Accesorios', details: ['Sensor óptico 4000 DPI'], imagen: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80' },
  ];
  const CATEGORIAS_TECH = ['Electrónica', 'Accesorios'];
  const MAX_DESTACADOS = 4;

  const contenedor = document.getElementById('home-destacados');
  let destacados = [];

  // ---------- Productos destacados ----------
  contenedor.innerHTML = '<div class="home-esqueleto"></div>'.repeat(MAX_DESTACADOS);

  async function cargarDestacados() {
    try {
      const res = await fetch('/api/catalogo/products');
      const data = res.ok ? await res.json() : [];
      const tech = (Array.isArray(data) ? data : [])
        .map((p) => ({
          id: p._id || p.id,
          name: p.name,
          price: Number(p.price),
          stock: Number(p.stock ?? 10),
          category: p.category?.name || p.category || 'General',
          details: p.details || [],
          imagen: p.imagen,
        }))
        .filter((p) => CATEGORIAS_TECH.includes(p.category) && p.imagen)
        // Los más caros primero: los equipos estrella arriba
        .sort((a, b) => b.price - a.price);
      destacados = tech.length ? tech.slice(0, MAX_DESTACADOS) : RESPALDO;
    } catch {
      destacados = RESPALDO;
    }
    pintarDestacados();
  }

  function pintarDestacados() {
    contenedor.innerHTML = destacados.map((p, i) => {
      const agotado = p.stock <= 0;
      const badge = agotado
        ? '<span class="home-producto__badge home-producto__badge--agotado">Agotado</span>'
        : p.stock <= 5 ? '<span class="home-producto__badge">¡Últimas unidades!</span>' : '';
      return `
        <article class="home-producto home-revelar" style="--retraso:${i * 80}ms">
          <div class="home-producto__imagen">
            <img src="${escapar(p.imagen)}" alt="${escapar(p.name)}" loading="lazy">
            ${badge}
          </div>
          <div class="home-producto__cuerpo">
            <span class="home-producto__categoria">${escapar(p.category)}</span>
            <h3 class="home-producto__nombre">${escapar(p.name)}</h3>
            ${p.details[0] ? `<p class="home-producto__detalle">${escapar(p.details[0])}</p>` : ''}
            <div class="home-producto__pie">
              <span class="home-producto__precio">${formatoPrecio(p.price)}</span>
              <button class="boton boton--sm" type="button" data-agregar="${i}" ${agotado ? 'disabled' : ''}>
                ${agotado ? 'Agotado' : 'Agregar'}
              </button>
            </div>
          </div>
        </article>`;
    }).join('');
    contenedor.querySelectorAll('.home-revelar').forEach((el) => observador.observe(el));
  }

  contenedor.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-agregar]');
    if (boton) window.Carrito.agregar(destacados[Number(boton.dataset.agregar)]);
  });

  function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function formatoPrecio(valor) {
    return '$' + valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- Aparición al hacer scroll ----------
  const observador = 'IntersectionObserver' in window && !sinMovimiento
    ? new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add('home-visible');
          observador.unobserve(entrada.target);
        });
      }, { threshold: 0.15 })
    : { observe: (el) => el.classList.add('home-visible'), unobserve() {} };

  document.querySelectorAll('.home-revelar').forEach((el) => observador.observe(el));

  // ---------- Contadores del hero ----------
  function animarContador(el) {
    const meta = Number(el.dataset.contador);
    const decimales = Number(el.dataset.decimales || 0);
    const sufijo = el.dataset.sufijo || '';
    const formatear = (v) => v.toLocaleString('es', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + sufijo;

    if (sinMovimiento) {
      el.textContent = formatear(meta);
      return;
    }
    const duracion = 1600;
    const inicio = performance.now();
    function paso(ahora) {
      const t = Math.min((ahora - inicio) / duracion, 1);
      const suavizado = 1 - Math.pow(1 - t, 3); // ease-out cúbico
      el.textContent = formatear(meta * suavizado);
      if (t < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }
  // Empiezan después de que aparece el hero
  setTimeout(() => document.querySelectorAll('[data-contador]').forEach(animarContador), 400);

  // ---------- Marquesina infinita ----------
  // Se duplica la lista: la animación recorre el 50% y vuelve sin salto visible
  const pista = document.querySelector('.home-cinta__pista');
  const lista = pista.querySelector('.home-cinta__lista');
  const copia = lista.cloneNode(true);
  copia.setAttribute('aria-hidden', 'true');
  pista.appendChild(copia);

  // ---------- Cuenta regresiva de la oferta del día (hasta medianoche) ----------
  const cuenta = {
    horas: document.getElementById('cuenta-horas'),
    minutos: document.getElementById('cuenta-minutos'),
    segundos: document.getElementById('cuenta-segundos'),
  };
  function actualizarCuenta() {
    const ahora = new Date();
    const medianoche = new Date(ahora);
    medianoche.setHours(24, 0, 0, 0);
    const restante = Math.max(0, Math.floor((medianoche - ahora) / 1000));
    const dos = (n) => String(n).padStart(2, '0');
    cuenta.horas.textContent = dos(Math.floor(restante / 3600));
    cuenta.minutos.textContent = dos(Math.floor((restante % 3600) / 60));
    cuenta.segundos.textContent = dos(restante % 60);
  }
  actualizarCuenta();
  setInterval(actualizarCuenta, 1000);

  // ---------- Boletín (solo interfaz: no hay servicio de correo masivo) ----------
  const formBoletin = document.getElementById('form-boletin');
  formBoletin.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('boletin-email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
      window.Notificaciones.toast('Ingresa un correo válido.', 'alerta');
      input.focus();
      return;
    }
    window.Notificaciones.toast('¡Listo! Te avisaremos de las novedades.', 'exito');
    formBoletin.reset();
  });

  cargarDestacados();
})();
