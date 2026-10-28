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
    cargarCatalogo();
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
  // CRUD de categorías y productos contra /api/catalogo (gateway -> catalogo).
  // Todo se guarda en MongoDB; las escrituras exigen token de admin.
  let categorias = [];
  let productos = [];

  // fetch al catálogo con el token de la sesión; lanza Error con el mensaje de la API
  async function apiCatalogo(ruta, { metodo = 'GET', cuerpo } = {}) {
    const token = window.Sesion.token();
    const res = await fetch(`/api/catalogo${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const datos = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    if (!res.ok) throw new Error(datos.message || datos.error || `Error ${res.status} del catálogo.`);
    return datos;
  }

  async function cargarCatalogo() {
    const cuerpoCategorias = document.getElementById('tabla-adm-categorias-cuerpo');
    const cuerpoProductos = document.getElementById('tabla-adm-productos-cuerpo');
    try {
      [categorias, productos] = await Promise.all([apiCatalogo('/categories'), apiCatalogo('/products')]);
      categorias.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    } catch (err) {
      const fila = `<tr><td colspan="6" style="text-align:center;color:var(--color-texto-suave)">No se pudo cargar el catálogo: ${escapar(err.message)}</td></tr>`;
      cuerpoCategorias.innerHTML = fila;
      cuerpoProductos.innerHTML = fila;
      return;
    }
    pintarCategorias();
    pintarSelectorCategorias();
    pintarProductos();
  }

  const idCategoria = (p) => String(p.category?._id || p.category || '');
  const productosDe = (categoriaId) => productos.filter(p => idCategoria(p) === String(categoriaId)).length;

  // ----- Categorías -----
  const formCategoria = document.getElementById('form-categoria');
  const errorCategoria = document.getElementById('form-categoria-error');
  let categoriaEditando = null;

  function pintarCategorias() {
    const tabla = document.getElementById('tabla-adm-categorias-cuerpo');
    if (!categorias.length) {
      tabla.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-texto-suave)">Aún no hay categorías. Crea la primera con "+ Nueva categoría".</td></tr>';
      return;
    }
    tabla.innerHTML = categorias.map(c => {
      const cantidad = productosDe(c._id);
      const bloqueo = cantidad > 0 ? `disabled title="Tiene ${cantidad} producto(s): muévelos o elimínalos primero"` : '';
      return `
        <tr>
          <td style="font-weight:700">${escapar(c.name)}</td>
          <td style="color:var(--color-texto-suave)">${escapar(c.description || '—')}</td>
          <td><span class="chip" style="font-size:0.75rem;padding:2px 8px">${cantidad}</span></td>
          <td class="admin-acciones">
            <button class="boton boton--secundario boton--sm" type="button" data-editar-categoria="${c._id}">Editar</button>
            <button class="boton boton--sm boton--peligro" type="button" data-eliminar-categoria="${c._id}" ${bloqueo}>Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function abrirFormCategoria(categoria = null) {
    categoriaEditando = categoria;
    formCategoria.reset();
    errorCategoria.textContent = '';
    document.getElementById('form-categoria-titulo').textContent = categoria ? `Editar "${categoria.name}"` : 'Nueva categoría';
    if (categoria) {
      document.getElementById('cat-nombre').value = categoria.name;
      document.getElementById('cat-descripcion').value = categoria.description || '';
    }
    formCategoria.hidden = false;
    formCategoria.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('cat-nombre').focus();
  }

  function cerrarFormCategoria() {
    formCategoria.hidden = true;
    categoriaEditando = null;
  }

  document.getElementById('btn-nueva-categoria').addEventListener('click', () => {
    if (!formCategoria.hidden && !categoriaEditando) return cerrarFormCategoria();
    abrirFormCategoria();
  });
  formCategoria.querySelector('[data-cancelar]').addEventListener('click', cerrarFormCategoria);

  formCategoria.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      name: document.getElementById('cat-nombre').value.trim(),
      description: document.getElementById('cat-descripcion').value.trim()
    };
    if (!datos.name) {
      errorCategoria.textContent = 'Escribe el nombre de la categoría.';
      return;
    }

    const boton = formCategoria.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      if (categoriaEditando) {
        await apiCatalogo(`/categories/${categoriaEditando._id}`, { metodo: 'PUT', cuerpo: datos });
        window.Notificaciones.toast(`Categoría "${datos.name}" actualizada.`, 'exito');
      } else {
        await apiCatalogo('/categories', { metodo: 'POST', cuerpo: datos });
        window.Notificaciones.toast(`Categoría "${datos.name}" creada.`, 'exito');
      }
      cerrarFormCategoria();
      await cargarCatalogo();
    } catch (err) {
      errorCategoria.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('tabla-adm-categorias-cuerpo').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-categoria]');
    const eliminar = e.target.closest('[data-eliminar-categoria]');
    if (editar) {
      abrirFormCategoria(categorias.find(c => c._id === editar.dataset.editarCategoria));
    } else if (eliminar) {
      const categoria = categorias.find(c => c._id === eliminar.dataset.eliminarCategoria);
      if (!confirm(`¿Eliminar la categoría "${categoria.name}"?`)) return;
      try {
        await apiCatalogo(`/categories/${categoria._id}`, { metodo: 'DELETE' });
        window.Notificaciones.toast(`Categoría "${categoria.name}" eliminada.`, 'info');
        if (categoriaEditando?._id === categoria._id) cerrarFormCategoria();
        await cargarCatalogo();
      } catch (err) {
        window.Notificaciones.toast(err.message, 'alerta');
      }
    }
  });

  // ----- Productos -----
  const formProducto = document.getElementById('form-producto');
  const errorProducto = document.getElementById('form-producto-error');
  const buscarProductos = document.getElementById('buscar-productos');
  const inputImagen = document.getElementById('adm-imagen');
  const vistaImagen = document.getElementById('adm-imagen-vista');
  let productoEditando = null;

  function pintarSelectorCategorias() {
    const selector = document.getElementById('adm-categoria');
    const elegida = selector.value;
    selector.innerHTML = '<option value="">Selecciona una categoría</option>' +
      categorias.map(c => `<option value="${c._id}">${escapar(c.name)}</option>`).join('');
    selector.value = elegida;
  }

  function pintarProductos() {
    const tabla = document.getElementById('tabla-adm-productos-cuerpo');
    const texto = buscarProductos.value.trim().toLowerCase();
    const visibles = productos.filter(p =>
      !texto || p.name.toLowerCase().includes(texto) || (p.category?.name || '').toLowerCase().includes(texto)
    );
    document.getElementById('productos-conteo').textContent =
      `${productos.length} producto${productos.length === 1 ? '' : 's'} en ${categorias.length} categoría${categorias.length === 1 ? '' : 's'}`;

    if (!visibles.length) {
      tabla.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-texto-suave)">${productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos.'}</td></tr>`;
      return;
    }
    tabla.innerHTML = visibles.map(p => {
      let badgeStock = `<span style="color:var(--color-exito);font-weight:700">En stock</span>`;
      if (p.stock <= 0) {
        badgeStock = `<span style="color:#374151;font-weight:700">Agotado</span>`;
      } else if (p.stock < 5) {
        badgeStock = `<span style="color:var(--color-rojo-principal);font-weight:700">¡Crítico (&lt;5)!</span>`;
      }
      const imagen = p.imagen
        ? `<img class="admin-miniatura" src="${escapar(p.imagen)}" alt="" loading="lazy">`
        : '<span class="admin-miniatura admin-miniatura--vacia">📦</span>';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              ${imagen}
              <div>
                <div style="font-weight:700">${escapar(p.name)}</div>
                <code style="font-size:0.75rem;color:var(--color-texto-suave)">${String(p._id).slice(-6)}</code>
              </div>
            </div>
          </td>
          <td><span class="chip" style="font-size:0.75rem;padding:2px 8px">${escapar(p.category?.name || 'Sin categoría')}</span></td>
          <td style="font-weight:800">$${Number(p.price).toFixed(2)}</td>
          <td>${p.stock} uds.</td>
          <td>${badgeStock}</td>
          <td class="admin-acciones">
            <button class="boton boton--secundario boton--sm" type="button" data-editar-producto="${p._id}">Editar</button>
            <button class="boton boton--sm boton--peligro" type="button" data-eliminar-producto="${p._id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  buscarProductos.addEventListener('input', pintarProductos);

  // ----- Imagen del producto: URL externa o archivo subido a /api/catalogo/uploads -----
  const estadoImagen = document.getElementById('adm-imagen-estado');
  const archivoImagen = document.getElementById('adm-imagen-archivo');
  const AYUDA_IMAGEN = 'JPG, PNG o WebP de hasta 2 MB.';
  const MAX_BYTES_IMAGEN = 2 * 1024 * 1024;
  const esUrlImagen = (url) => /^(https?:\/\/|\/api\/catalogo\/uploads\/)/.test(url);

  function avisoImagen(texto, esError = false) {
    estadoImagen.textContent = texto;
    estadoImagen.classList.toggle('admin-form__ayuda--error', esError);
  }

  // Vista previa de la imagen mientras se escribe la URL
  function actualizarVistaImagen() {
    const url = inputImagen.value.trim();
    avisoImagen(AYUDA_IMAGEN);
    vistaImagen.hidden = !esUrlImagen(url);
    if (!vistaImagen.hidden) vistaImagen.src = url;
  }
  inputImagen.addEventListener('input', actualizarVistaImagen);
  vistaImagen.addEventListener('error', () => {
    vistaImagen.hidden = true;
    if (inputImagen.value.trim()) avisoImagen('Esa dirección no es una imagen. En Google Imágenes abre la foto y usa clic derecho → "Copiar dirección de imagen".', true);
  });

  // Comprueba que la URL cargue como imagen (una página de resultados de Google, por ejemplo, no)
  function cargaComoImagen(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const limite = setTimeout(() => resolve(false), 8000);
      img.onload = () => { clearTimeout(limite); resolve(img.naturalWidth > 0); };
      img.onerror = () => { clearTimeout(limite); resolve(false); };
      img.src = url;
    });
  }

  // POST /api/catalogo/uploads con el archivo en binario -> { url }
  archivoImagen.addEventListener('change', async () => {
    const archivo = archivoImagen.files[0];
    archivoImagen.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      avisoImagen('Solo se aceptan imágenes JPG, PNG o WebP.', true);
      return;
    }
    if (archivo.size > MAX_BYTES_IMAGEN) {
      avisoImagen(`La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB; el máximo es 2 MB.`, true);
      return;
    }

    const botonGuardar = formProducto.querySelector('button[type="submit"]');
    botonGuardar.disabled = true;
    avisoImagen(`Subiendo "${archivo.name}"...`);
    try {
      const res = await fetch('/api/catalogo/uploads', {
        method: 'POST',
        headers: { 'Content-Type': archivo.type, Authorization: `Bearer ${window.Sesion.token()}` },
        body: archivo
      });
      const datos = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
      if (!res.ok) throw new Error(datos.message || datos.error || `Error ${res.status} al subir la imagen.`);
      inputImagen.value = datos.url;
      actualizarVistaImagen();
      avisoImagen(`"${archivo.name}" subida. Guarda el producto para aplicarla.`);
    } catch (err) {
      avisoImagen(err.message, true);
    } finally {
      botonGuardar.disabled = false;
    }
  });

  const lista = (texto, separador) => texto.split(separador).map(s => s.trim()).filter(Boolean);

  function abrirFormProducto(producto = null) {
    if (!categorias.length) {
      window.Notificaciones.toast('Primero crea una categoría para poder agregar productos.', 'alerta');
      abrirFormCategoria();
      return;
    }
    productoEditando = producto;
    formProducto.reset();
    errorProducto.textContent = '';
    document.getElementById('form-producto-titulo').textContent = producto ? `Editar "${producto.name}"` : 'Nuevo producto';
    if (producto) {
      document.getElementById('adm-nombre').value = producto.name;
      document.getElementById('adm-categoria').value = idCategoria(producto);
      document.getElementById('adm-precio').value = producto.price;
      document.getElementById('adm-stock').value = producto.stock;
      inputImagen.value = producto.imagen || '';
      document.getElementById('adm-descripcion').value = producto.description || '';
      document.getElementById('adm-variantes').value = (producto.sizes || []).join(', ');
      document.getElementById('adm-colores').value = (producto.colors || []).join(', ');
      document.getElementById('adm-detalles').value = (producto.details || []).join('\n');
    }
    actualizarVistaImagen();
    formProducto.hidden = false;
    formProducto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('adm-nombre').focus();
  }

  function cerrarFormProducto() {
    formProducto.hidden = true;
    productoEditando = null;
  }

  document.getElementById('btn-toggle-nuevo-producto').addEventListener('click', () => {
    if (!formProducto.hidden && !productoEditando) return cerrarFormProducto();
    abrirFormProducto();
  });
  formProducto.querySelector('[data-cancelar]').addEventListener('click', cerrarFormProducto);

  function validarProducto(datos) {
    if (!datos.name) return 'Escribe el nombre del producto.';
    if (!datos.category) return 'Selecciona una categoría.';
    if (!Number.isFinite(datos.price) || datos.price < 0) return 'El precio debe ser un número mayor o igual a 0.';
    if (!Number.isInteger(datos.stock) || datos.stock < 0) return 'El stock debe ser un número entero mayor o igual a 0.';
    if (datos.imagen && !esUrlImagen(datos.imagen)) return 'La dirección de la imagen debe empezar con http:// o https://, o sube un archivo.';
    return '';
  }

  formProducto.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = (id) => document.getElementById(id).value.trim();
    const numero = (id) => (valor(id) === '' ? NaN : Number(valor(id)));
    const datos = {
      name: valor('adm-nombre'),
      category: valor('adm-categoria'),
      price: numero('adm-precio'),
      stock: numero('adm-stock'),
      imagen: valor('adm-imagen'),
      description: valor('adm-descripcion'),
      sizes: lista(valor('adm-variantes'), ','),
      colors: lista(valor('adm-colores'), ','),
      details: lista(document.getElementById('adm-detalles').value, '\n')
    };
    const error = validarProducto(datos);
    if (error) {
      errorProducto.textContent = error;
      return;
    }

    const boton = formProducto.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      if (datos.imagen && !(await cargaComoImagen(datos.imagen))) {
        errorProducto.textContent = 'La imagen no se pudo cargar: esa dirección no es una imagen. Usa clic derecho → "Copiar dirección de imagen" o sube un archivo.';
        return;
      }
      if (productoEditando) {
        await apiCatalogo(`/products/${productoEditando._id}`, { metodo: 'PUT', cuerpo: datos });
        window.Notificaciones.toast(`Producto "${datos.name}" actualizado.`, 'exito');
      } else {
        await apiCatalogo('/products', { metodo: 'POST', cuerpo: datos });
        window.Notificaciones.toast(`Producto "${datos.name}" creado en el catálogo.`, 'exito');
      }
      cerrarFormProducto();
      await cargarCatalogo();
    } catch (err) {
      errorProducto.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('tabla-adm-productos-cuerpo').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-producto]');
    const eliminar = e.target.closest('[data-eliminar-producto]');
    if (editar) {
      abrirFormProducto(productos.find(p => p._id === editar.dataset.editarProducto));
    } else if (eliminar) {
      const producto = productos.find(p => p._id === eliminar.dataset.eliminarProducto);
      if (!confirm(`¿Eliminar "${producto.name}" del catálogo?`)) return;
      try {
        await apiCatalogo(`/products/${producto._id}`, { metodo: 'DELETE' });
        window.Notificaciones.toast(`Producto "${producto.name}" eliminado.`, 'info');
        if (productoEditando?._id === producto._id) cerrarFormProducto();
        await cargarCatalogo();
      } catch (err) {
        window.Notificaciones.toast(err.message, 'alerta');
      }
    }
  });

  // ---------- 2. CONTROL DE ÓRDENES (Java Spring Boot + PostgreSQL) ----------
  // GET /api/ordenes (gateway -> ordenes), solo admin. Cada orden es una venta
  // con el pago aprobado; sin datos de ejemplo.
  function mensajeTablaOrdenes(texto) {
    const tabla = document.getElementById('tabla-adm-ordenes-cuerpo');
    if (tabla) tabla.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-texto-suave)">${escapar(texto)}</td></tr>`;
  }

  async function cargarTablaOrdenes() {
    const tabla = document.getElementById('tabla-adm-ordenes-cuerpo');
    const badgeConteo = document.getElementById('conteo-total-pedidos');
    if (!tabla) return;

    mensajeTablaOrdenes('Cargando ventas...');
    const auth = { headers: { Authorization: `Bearer ${window.Sesion.token()}` } };
    // El nombre del comprador sale de su cuenta en auth (GET /api/auth/usuarios).
    // Si auth no responde, se usa el nombre escrito en la pasarela.
    const compradores = fetch('/api/auth/usuarios', auth)
      .then(res => (res.ok ? res.json() : []))
      .then(lista => new Map(lista.map(u => [u.id, u])))
      .catch(() => new Map());

    let ordenes;
    try {
      const res = await fetch('/api/ordenes', auth);
      if (res.status === 401 || res.status === 403) {
        mensajeTablaOrdenes('Tu sesión no tiene permisos de administrador.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ordenes = await res.json();
    } catch {
      if (badgeConteo) badgeConteo.textContent = '0 pedidos';
      mensajeTablaOrdenes('No se pudo conectar con el microservicio de órdenes.');
      return;
    }

    if (badgeConteo) badgeConteo.textContent = `${ordenes.length} ${ordenes.length === 1 ? 'pedido' : 'pedidos'}`;
    if (!ordenes.length) {
      mensajeTablaOrdenes('Aún no hay ventas registradas.');
      return;
    }

    const usuarios = await compradores;
    tabla.innerHTML = ordenes.map(ord => {
      const itemsStr = (ord.detalles || []).map(d => `${d.cantidad}x ${d.productoNombre}`).join(', ');
      const cuenta = usuarios.get(ord.usuarioId);
      // Si quien recibe el envío no es el titular de la cuenta, se muestra debajo
      const recibe = cuenta && ord.clienteNombre && ord.clienteNombre.toLowerCase() !== cuenta.nombre.toLowerCase()
        ? `<div style="font-size:0.75rem;font-weight:600;color:var(--color-texto-suave)">Recibe: ${escapar(ord.clienteNombre)}</div>`
        : '';
      const cliente = cuenta
        ? `${escapar(cuenta.nombre)}<div style="font-size:0.75rem;font-weight:400;color:var(--color-texto-suave)">${escapar(cuenta.email)}</div>${recibe}`
        : escapar(ord.clienteNombre || `Usuario #${ord.usuarioId}`);
      const fecha = new Date(ord.fechaCreacion).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const cupon = Number(ord.descuento) > 0
        ? `<div style="font-size:0.75rem;font-weight:600;color:var(--color-texto-suave)">${escapar(ord.cupon)} -$${Number(ord.descuento).toFixed(2)}</div>`
        : '';

      return `
        <tr>
          <td><strong style="color:var(--color-rojo-principal)">#${ord.id}</strong></td>
          <td style="font-weight:700">${cliente}</td>
          <td style="color:var(--color-texto-suave);font-size:0.85rem">${fecha}</td>
          <td style="max-width:280px;font-size:0.85rem">${escapar(itemsStr)}</td>
          <td style="font-weight:900">$${Number(ord.total).toFixed(2)}${cupon}</td>
          <td><span class="badge-stock badge-stock--normal" style="position:static">PAGO CONFIRMADO</span></td>
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
    if (tabla) tabla.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-texto-suave)">${escapar(texto)}</td></tr>`;
  }

  async function cargarTablaUsuarios() {
    mensajeTablaUsuarios('Cargando usuarios...');
    cargarRoles();
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
        : `<span class="chip" style="font-size:0.75rem;padding:2px 8px">${escapar(ETIQUETAS_ROL[u.rol] || u.rol)}</span>`;
      const verificado = u.verificado
        ? `<span style="color:var(--color-exito);font-weight:700">Sí</span>`
        : `<span style="color:var(--color-rojo-principal);font-weight:700">Pendiente</span>`;
      const estado = u.activo
        ? `<span style="color:var(--color-exito);font-weight:700">Activa</span>`
        : `<span style="color:#374151;font-weight:700">Desactivada</span>`;
      // Nadie puede desactivarse a sí mismo (el backend también lo impide)
      const esYo = u.id === idAdminActual;
      const botonEstado = u.activo
        ? `<button class="boton boton--sm boton--peligro" type="button" data-estado-usuario="${u.id}" ${esYo ? 'disabled title="No puedes desactivar tu propia cuenta"' : ''}>Desactivar</button>`
        : `<button class="boton boton--sm" type="button" data-estado-usuario="${u.id}">Activar</button>`;

      return `
        <tr style="${u.activo ? '' : 'opacity:0.6'}">
          <td><code style="font-size:0.8rem;background:var(--color-fondo);padding:2px 6px;border-radius:4px">${escapar(u.id)}</code></td>
          <td style="font-weight:700">${escapar(u.nombre)}${esYo ? ' <small style="color:var(--color-texto-suave)">(tú)</small>' : ''}</td>
          <td>${escapar(u.email)}</td>
          <td>${rol}</td>
          <td>${verificado}</td>
          <td>${estado}</td>
          <td class="admin-acciones">
            <button class="boton boton--secundario boton--sm" type="button" data-editar-usuario="${u.id}">Editar</button>
            ${botonEstado}
          </td>
        </tr>
      `;
    }).join('');
  }

  buscarUsuarios?.addEventListener('input', pintarTablaUsuarios);

  // ----- Crear / editar / activar usuarios (POST y PUT /api/auth/usuarios) -----
  // No se borran cuentas: se desactivan. El correo no se edita.
  const idAdminActual = window.Sesion.usuario()?.id;
  const formUsuario = document.getElementById('form-usuario');
  const errorUsuario = document.getElementById('form-usuario-error');
  let usuarioEditando = null;

  async function apiAuth(ruta, metodo, cuerpo) {
    const res = await fetch(`/api/auth${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.Sesion.token()}` },
      body: JSON.stringify(cuerpo)
    });
    const datos = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    if (!res.ok) throw new Error(datos.error || `Error ${res.status} del servicio de usuarios.`);
    return datos;
  }

  function abrirFormUsuario(usuario = null) {
    usuarioEditando = usuario;
    formUsuario.reset();
    errorUsuario.textContent = '';
    const email = document.getElementById('usr-email');
    document.getElementById('form-usuario-titulo').textContent = usuario ? `Editar "${usuario.nombre}"` : 'Nuevo usuario';
    document.getElementById('usr-password-label').textContent = usuario ? 'Nueva contraseña (opcional)' : 'Contraseña temporal';
    document.getElementById('usr-password').placeholder = usuario ? 'Déjala vacía para no cambiarla' : '8 a 16, con mayúscula, minúscula y número';
    document.getElementById('usr-email-nota').textContent = usuario ? '(no se puede cambiar)' : '(no se puede cambiar después)';
    document.getElementById('usr-estados').hidden = !usuario;
    email.disabled = !!usuario;

    if (usuario) {
      document.getElementById('usr-nombre').value = usuario.nombre;
      email.value = usuario.email;
      document.getElementById('usr-rol').value = usuario.rol;
      document.getElementById('usr-activo').checked = usuario.activo;
      document.getElementById('usr-verificado').checked = usuario.verificado;
    }
    // Sobre la propia cuenta no se puede cambiar el rol ni desactivarla
    const esYo = usuario?.id === idAdminActual;
    document.getElementById('usr-rol').disabled = esYo;
    document.getElementById('usr-activo').disabled = esYo;

    formUsuario.hidden = false;
    formUsuario.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('usr-nombre').focus();
  }

  function cerrarFormUsuario() {
    formUsuario.hidden = true;
    usuarioEditando = null;
  }

  document.getElementById('btn-nuevo-usuario').addEventListener('click', () => {
    if (!formUsuario.hidden && !usuarioEditando) return cerrarFormUsuario();
    abrirFormUsuario();
  });
  formUsuario.querySelector('[data-cancelar]').addEventListener('click', cerrarFormUsuario);

  formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('usr-nombre').value.trim();
    const email = document.getElementById('usr-email').value.trim();
    const rol = document.getElementById('usr-rol').value;
    const password = document.getElementById('usr-password').value; // sin trim, igual que en el registro

    let error = '';
    if (!nombre) error = 'Escribe el nombre.';
    else if (!usuarioEditando && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'El correo no es válido.';
    // Mismas reglas que el registro; al editar, vacía = no se cambia
    else if (!usuarioEditando || password) error = Sesion.errorContrasena(password);
    if (error) {
      errorUsuario.textContent = error;
      return;
    }

    const boton = formUsuario.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      if (usuarioEditando) {
        await apiAuth(`/usuarios/${usuarioEditando.id}`, 'PUT', {
          nombre,
          rol,
          activo: document.getElementById('usr-activo').checked,
          verificado: document.getElementById('usr-verificado').checked,
          password
        });
        window.Notificaciones.toast(`Usuario "${nombre}" actualizado.`, 'exito');
      } else {
        await apiAuth('/usuarios', 'POST', { nombre, email, rol, password });
        window.Notificaciones.toast(`Usuario "${nombre}" creado. Ya puede iniciar sesión con su contraseña temporal.`, 'exito');
      }
      cerrarFormUsuario();
      await cargarTablaUsuarios();
    } catch (err) {
      errorUsuario.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('tabla-adm-usuarios-cuerpo').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-usuario]');
    const cambiarEstado = e.target.closest('[data-estado-usuario]');
    if (editar) {
      abrirFormUsuario(usuariosRegistrados.find(u => String(u.id) === editar.dataset.editarUsuario));
    } else if (cambiarEstado) {
      const u = usuariosRegistrados.find(x => String(x.id) === cambiarEstado.dataset.estadoUsuario);
      if (u.activo && !confirm(`¿Desactivar la cuenta de ${u.nombre}? No podrá iniciar sesión y se cerrarán sus sesiones abiertas.`)) return;
      try {
        await apiAuth(`/usuarios/${u.id}`, 'PUT', {
          nombre: u.nombre, rol: u.rol, verificado: u.verificado, activo: !u.activo, password: ''
        });
        window.Notificaciones.toast(`Cuenta de ${u.nombre} ${u.activo ? 'desactivada' : 'activada'}.`, 'info');
        await cargarTablaUsuarios();
      } catch (err) {
        window.Notificaciones.toast(`No se pudo ${u.activo ? 'desactivar' : 'activar'}: ${err.message}`, 'alerta');
      }
    }
  });

  // Roles de la tabla roles (GET /api/auth/roles): llenan la tarjeta Roles y el
  // selector de rol del formulario de usuarios. Si auth no responde, el selector
  // conserva las dos opciones escritas en el HTML.
  const ETIQUETAS_ROL = { admin: 'Administrador', cliente: 'Cliente' };
  let rolesRegistrados = [];

  async function cargarRoles() {
    const tabla = document.getElementById('tabla-adm-roles-cuerpo');
    try {
      const res = await fetch('/api/auth/roles', { headers: { Authorization: `Bearer ${window.Sesion.token()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rolesRegistrados = await res.json();
    } catch {
      tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-texto-suave)">No se pudieron cargar los roles.</td></tr>';
      return;
    }

    const selector = document.getElementById('usr-rol');
    const elegido = selector.value;
    selector.innerHTML = rolesRegistrados.map(r => `
      <option value="${escapar(r.nombre)}" title="${escapar(r.descripcion)}">${escapar(ETIQUETAS_ROL[r.nombre] || r.nombre)}</option>
    `).join('');
    if (elegido) selector.value = elegido;

    tabla.innerHTML = rolesRegistrados.map(r => {
      const bloqueoBorrar = r.base
        ? 'disabled title="Los roles base no se pueden eliminar"'
        : r.usuarios > 0 ? `disabled title="${r.usuarios} usuario(s) tienen este rol: cámbiales el rol primero"` : '';
      return `
        <tr>
          <td><span class="chip" style="font-size:0.75rem;padding:2px 8px">${escapar(r.nombre)}</span></td>
          <td style="color:var(--color-texto-suave)">${escapar(r.descripcion || '—')}</td>
          <td>${r.usuarios}</td>
          <td>${r.base ? '<strong>Base</strong>' : 'Personalizado'}</td>
          <td class="admin-acciones">
            <button class="boton boton--secundario boton--sm" type="button" data-editar-rol="${r.id}">Editar</button>
            <button class="boton boton--sm boton--peligro" type="button" data-eliminar-rol="${r.id}" ${bloqueoBorrar}>Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  const formRol = document.getElementById('form-rol');
  const errorRol = document.getElementById('form-rol-error');
  let rolEditando = null;

  function abrirFormRol(rol = null) {
    rolEditando = rol;
    formRol.reset();
    errorRol.textContent = '';
    document.getElementById('form-rol-titulo').textContent = rol ? `Editar rol "${rol.nombre}"` : 'Nuevo rol';
    const nombre = document.getElementById('rol-nombre');
    nombre.value = rol?.nombre || '';
    // admin y cliente: el sistema depende de su nombre, solo se edita la descripción
    nombre.disabled = !!rol?.base;
    document.getElementById('rol-descripcion').value = rol?.descripcion || '';
    formRol.hidden = false;
    formRol.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    (rol?.base ? document.getElementById('rol-descripcion') : nombre).focus();
  }

  function cerrarFormRol() {
    formRol.hidden = true;
    rolEditando = null;
  }

  document.getElementById('btn-nuevo-rol').addEventListener('click', () => {
    if (!formRol.hidden && !rolEditando) return cerrarFormRol();
    abrirFormRol();
  });
  formRol.querySelector('[data-cancelar]').addEventListener('click', cerrarFormRol);

  formRol.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      nombre: document.getElementById('rol-nombre').value.trim().toLowerCase(),
      descripcion: document.getElementById('rol-descripcion').value.trim()
    };
    if (!/^[a-z][a-z0-9_-]{1,19}$/.test(datos.nombre)) {
      errorRol.textContent = 'El nombre debe tener de 2 a 20 caracteres: minúsculas, números, - o _, y empezar con una letra.';
      return;
    }

    const boton = formRol.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      if (rolEditando) {
        await apiAuth(`/roles/${rolEditando.id}`, 'PUT', datos);
        window.Notificaciones.toast(`Rol "${datos.nombre}" actualizado.`, 'exito');
      } else {
        await apiAuth('/roles', 'POST', datos);
        window.Notificaciones.toast(`Rol "${datos.nombre}" creado. Ya puedes asignarlo a usuarios.`, 'exito');
      }
      cerrarFormRol();
      // El nombre del rol también aparece en la tabla de usuarios
      await cargarTablaUsuarios();
    } catch (err) {
      errorRol.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('tabla-adm-roles-cuerpo').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-rol]');
    const eliminar = e.target.closest('[data-eliminar-rol]');
    const buscar = (boton, campo) => rolesRegistrados.find(r => String(r.id) === boton.dataset[campo]);
    if (editar) {
      abrirFormRol(buscar(editar, 'editarRol'));
    } else if (eliminar) {
      const rol = buscar(eliminar, 'eliminarRol');
      if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return;
      try {
        const res = await fetch(`/api/auth/roles/${rol.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${window.Sesion.token()}` }
        });
        if (!res.ok) {
          const datos = await res.json().catch(() => ({}));
          throw new Error(datos.error || `Error ${res.status}`);
        }
        window.Notificaciones.toast(`Rol "${rol.nombre}" eliminado.`, 'info');
        if (rolEditando?.id === rol.id) cerrarFormRol();
        await cargarRoles();
      } catch (err) {
        window.Notificaciones.toast(`No se pudo eliminar: ${err.message}`, 'alerta');
      }
    }
  });

  // ---------- 3. ANALÍTICA Y ESTADÍSTICAS (Python Microservice) ----------
  // GET /api/analitica/reportes (gateway -> analitica), solo con token de rol admin

  function pintarKpi(id, valor, formato = v => v) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor === null || valor === undefined ? 'No disponible' : formato(valor);
  }

  // Barras horizontales sólidas (sin degradados): [{etiqueta, valor}]
  function pintarBarras(id, filas, unidad, vacio) {
    const contenedor = document.getElementById(id);
    if (!contenedor) return;
    if (!filas.length) {
      contenedor.innerHTML = `<p style="color:var(--color-texto-suave)">${escapar(vacio)}</p>`;
      return;
    }
    const maximo = Math.max(1, ...filas.map(f => f.valor));
    contenedor.innerHTML = filas.map(f => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:700;margin-bottom:4px">
          <span>${escapar(f.etiqueta)}</span>
          <span style="color:var(--color-rojo-principal)">${f.valor} ${f.valor === 1 ? unidad[0] : unidad[1]}</span>
        </div>
        <div style="height:10px;background:#E5E7EB;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${(f.valor / maximo) * 100}%;background-color:var(--color-rojo-principal);border-radius:4px"></div>
        </div>
      </div>
    `).join('');
  }

  // Tarjeta KPI con un producto: miniatura, nombre y un detalle debajo
  function pintarKpiProducto(id, producto, detalle, vacio) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!producto) {
      el.innerHTML = `<span class="kpi-producto__vacio">${escapar(vacio)}</span>`;
      return;
    }
    const imagen = producto.imagen
      ? `<img class="admin-miniatura" src="${escapar(producto.imagen)}" alt="" loading="lazy">`
      : '<span class="admin-miniatura admin-miniatura--vacia">📦</span>';
    el.innerHTML = `
      ${imagen}
      <div style="min-width:0">
        <div class="kpi-producto__nombre" title="${escapar(producto.producto)}">${escapar(producto.producto)}</div>
        <div class="kpi-producto__detalle">${escapar(detalle(producto))}</div>
      </div>
    `;
  }

  async function cargarMetricasPython() {
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
      ['kpi-productos', 'kpi-usuarios'].forEach(id => pintarKpi(id, null));
      ['kpi-ultimo-producto', 'kpi-mas-vendido'].forEach(id => pintarKpiProducto(id, null, null, 'No disponible'));
      ['barras-productos-categoria', 'barras-usuarios-rol'].forEach(id => pintarBarras(id, [], [], 'No se pudo conectar con el microservicio de analítica.'));
      return;
    }

    pintarKpi('kpi-productos', reporte.productos_registrados);
    pintarKpi('kpi-usuarios', reporte.usuarios_activos);

    const fecha = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    pintarKpiProducto('kpi-ultimo-producto', reporte.ultimo_producto_agregado,
      p => `${p.categoria} · $${Number(p.precio).toFixed(2)} · ${fecha(p.agregado_en)}`,
      reporte.productos_registrados === null ? 'No disponible' : 'Sin productos');
    // Más unidades sumando todas las órdenes (cada orden es una venta pagada)
    pintarKpiProducto('kpi-mas-vendido', reporte.producto_mas_vendido,
      p => `${p.categoria} · ${p.unidades} ${p.unidades === 1 ? 'unidad vendida' : 'unidades vendidas'}`,
      'Aún no hay ventas');

    pintarBarras('barras-productos-categoria',
      (reporte.productos_por_categoria || []).map(c => ({ etiqueta: c.categoria, valor: c.productos })),
      ['producto', 'productos'], 'Sin productos registrados.');
    pintarBarras('barras-usuarios-rol',
      (reporte.usuarios_por_rol || []).map(r => ({ etiqueta: ETIQUETAS_ROL[r.rol] || r.rol, valor: r.usuarios })),
      ['usuario', 'usuarios'], reporte.usuarios_activos === null ? 'No se pudo consultar el servicio de usuarios.' : 'Sin usuarios activos.');
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
      cargarCatalogo();
    }
  }
  window.addEventListener('hashchange', abrirPestanaSegunHash);
  abrirPestanaSegunHash();
})();
