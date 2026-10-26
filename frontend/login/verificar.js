// Verificación del correo con el código de 6 dígitos que envía el microservicio otp.
// POST /api/auth/verificar (gateway -> auth -> otp). Al verificar, el usuario queda logueado.
// POST /api/auth/reenviar-codigo pide un código nuevo (máximo uno cada 60 segundos).
(function () {
  const ESPERA_REENVIO = 60;

  const parametros = new URLSearchParams(window.location.search);
  const email = (parametros.get('email') || '').trim();

  if (Sesion.usuario()) {
    window.location.replace('../catalogo/index.html');
    return;
  }
  if (!email) {
    window.location.replace('registro.html');
    return;
  }

  const form = document.getElementById('form-verificar');
  const mensaje = document.getElementById('mensaje');
  const inputCodigo = document.getElementById('codigo');
  const errorCodigo = document.getElementById('codigo-error');
  const boton = form.querySelector('button[type="submit"]');
  const botonReenviar = document.getElementById('btn-reenviar');
  let temporizador = null;

  document.getElementById('email-destino').textContent = email;

  // Solo dígitos, máximo 6 (también al pegar el código desde el correo)
  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.replace(/\D/g, '').slice(0, 6);
    if (inputCodigo.getAttribute('aria-invalid') === 'true') validarCodigo();
  });

  function validarCodigo() {
    const error = /^\d{6}$/.test(inputCodigo.value) ? '' : 'Ingresa los 6 dígitos del código.';
    errorCodigo.textContent = error;
    inputCodigo.setAttribute('aria-invalid', error ? 'true' : 'false');
    return !error;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarMensaje();
    if (!validarCodigo()) return;

    boton.disabled = true;
    try {
      const res = await fetch('/api/auth/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo: inputCodigo.value }),
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarError(datos.error || 'No se pudo verificar el código.');
        // Código vencido o sin intentos: hay que pedir otro
        if (datos.codigo === 'expirado' || datos.codigo === 'bloqueado') inputCodigo.value = '';
        return;
      }

      Sesion.guardar(datos.token, datos.usuario);
      window.Notificaciones.toast('Correo verificado. ¡Bienvenido!', 'exito');
      setTimeout(() => { window.location.href = '../catalogo/index.html'; }, 500);
    } catch {
      mostrarError('No se pudo conectar con el servidor.');
    } finally {
      boton.disabled = false;
    }
  });

  botonReenviar.addEventListener('click', reenviar);

  async function reenviar() {
    limpiarMensaje();
    botonReenviar.disabled = true;
    try {
      const res = await fetch('/api/auth/reenviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const datos = await res.json().catch(() => ({}));

      if (res.status === 429) {
        mostrarError(datos.error || 'Espera antes de pedir otro código.');
        iniciarEspera(datos.reintentar_en || ESPERA_REENVIO);
        return;
      }
      if (!res.ok) {
        mostrarError(datos.error || 'No se pudo enviar el código.');
        botonReenviar.disabled = false;
        return;
      }

      window.Notificaciones.toast('Te enviamos un código nuevo.', 'info');
      inputCodigo.value = '';
      inputCodigo.focus();
      iniciarEspera(ESPERA_REENVIO);
    } catch {
      mostrarError('No se pudo conectar con el servidor.');
      botonReenviar.disabled = false;
    }
  }

  // Deshabilita "Reenviar código" y muestra la cuenta regresiva
  function iniciarEspera(segundos) {
    clearInterval(temporizador);
    let restantes = Math.max(1, Math.ceil(segundos));
    botonReenviar.disabled = true;
    botonReenviar.textContent = `Reenviar código (${restantes}s)`;
    temporizador = setInterval(() => {
      restantes -= 1;
      if (restantes <= 0) {
        clearInterval(temporizador);
        botonReenviar.disabled = false;
        botonReenviar.textContent = 'Reenviar código';
        return;
      }
      botonReenviar.textContent = `Reenviar código (${restantes}s)`;
    }, 1000);
  }

  function limpiarMensaje() {
    mensaje.textContent = '';
    mensaje.classList.remove('formulario__mensaje--error');
  }

  function mostrarError(texto) {
    mensaje.textContent = texto;
    mensaje.classList.add('formulario__mensaje--error');
  }

  // Desde el login (cuenta sin verificar) o si el registro no pudo enviar el
  // correo, se pide un código al entrar; si no, se acaba de enviar uno.
  if (parametros.get('reenviar') === '1') {
    reenviar();
  } else {
    iniciarEspera(ESPERA_REENVIO);
  }
  inputCodigo.focus();
})();
