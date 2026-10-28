// Pantalla del código de 6 dígitos que envía el microservicio otp. Tiene dos modos:
//   registro (por defecto): POST /api/auth/verificar verifica el correo recién registrado.
//   login (?modo=login): POST /api/auth/login/verificar completa el inicio de sesión con
//   el ticket que dejó login.js en sessionStorage.
// En ambos, al validar el código el usuario queda logueado, y "Reenviar código" pide
// uno nuevo (máximo uno cada 60 segundos).
(function () {
  const ESPERA_REENVIO = 60;

  const parametros = new URLSearchParams(window.location.search);
  const email = (parametros.get('email') || '').trim();
  const modoLogin = parametros.get('modo') === 'login';
  const ticket = modoLogin ? sessionStorage.getItem('ticketLogin') : null;

  if (Sesion.usuario()) {
    window.location.replace(Sesion.paginaInicio());
    return;
  }
  if (!email || (modoLogin && !ticket)) {
    window.location.replace(modoLogin ? 'index.html' : 'registro.html');
    return;
  }

  const api = modoLogin
    ? { verificar: '/api/auth/login/verificar', reenviar: '/api/auth/login/reenviar', cuerpo: { ticket } }
    : { verificar: '/api/auth/verificar', reenviar: '/api/auth/reenviar-codigo', cuerpo: { email } };

  const form = document.getElementById('form-verificar');
  const mensaje = document.getElementById('mensaje');
  const inputCodigo = document.getElementById('codigo');
  const errorCodigo = document.getElementById('codigo-error');
  const boton = form.querySelector('button[type="submit"]');
  const botonReenviar = document.getElementById('btn-reenviar');
  let temporizador = null;

  document.getElementById('email-destino').textContent = email;

  if (modoLogin) {
    document.title = 'Código de Acceso | ECOMMERCE';
    document.getElementById('titulo').textContent = 'Confirma que eres tú';
    document.querySelector('label[for="codigo"]').textContent = 'Código de inicio de sesión';
    boton.textContent = 'Ingresar';
    document.getElementById('pie-alterno').innerHTML = '¿No eres tú? <a href="index.html">Vuelve al login</a>';
  }

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
      const res = await fetch(api.verificar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...api.cuerpo, codigo: inputCodigo.value }),
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (datos.codigo === 'ticket_expirado') return volverAlLogin(datos.error);
        mostrarError(datos.error || 'No se pudo verificar el código.');
        // Código vencido o sin intentos: hay que pedir otro
        if (datos.codigo === 'expirado' || datos.codigo === 'bloqueado') inputCodigo.value = '';
        return;
      }

      sessionStorage.removeItem('ticketLogin');
      Sesion.guardar(datos.token, datos.usuario);
      window.Notificaciones.toast(modoLogin ? 'Sesión iniciada con éxito.' : 'Correo verificado. ¡Bienvenido!', 'exito');
      setTimeout(() => { window.location.href = Sesion.paginaInicio(); }, 500);
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
      const res = await fetch(api.reenviar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(api.cuerpo),
      });
      const datos = await res.json().catch(() => ({}));

      if (datos.codigo === 'ticket_expirado') return volverAlLogin(datos.error);
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

  // El ticket de login venció (10 min): hay que volver a ingresar la contraseña
  function volverAlLogin(texto) {
    sessionStorage.removeItem('ticketLogin');
    window.Notificaciones.toast(texto || 'Tu inicio de sesión expiró.', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  }

  // Desde el login (cuenta sin verificar) o si el registro no pudo enviar el
  // correo, se pide un código al entrar; si no, se acaba de enviar uno.
  // En modo login, si auth no envió uno nuevo por la espera, vale el anterior.
  const aviso = modoLogin ? sessionStorage.getItem('avisoLogin') : null;
  sessionStorage.removeItem('avisoLogin');
  if (aviso) mostrarError(`${aviso} Usa el último código que te enviamos.`);

  if (parametros.get('reenviar') === '1') {
    reenviar();
  } else {
    iniciarEspera(Number(parametros.get('espera')) || ESPERA_REENVIO);
  }
  inputCodigo.focus();
})();
