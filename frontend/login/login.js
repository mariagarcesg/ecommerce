// ==========================================================================
// ECOMMERCE - CONTROLADOR DE LOGIN (GO + POSTGRESQL + REDIS)
// ==========================================================================

(function () {
  const form = document.getElementById('form-login');
  const mensaje = document.getElementById('mensaje');
  const boton = form.querySelector('button[type="submit"]');

  const inputEmail = document.getElementById('email');
  const inputPassword = document.getElementById('password');

  // Botones de acceso rápido para pruebas
  document.getElementById('btn-demo-admin')?.addEventListener('click', () => {
    inputEmail.value = 'admin@test.com';
    inputPassword.value = 'admin123';
    window.Notificaciones.toast('Credenciales de Administrador cargadas.', 'info');
  });

  document.getElementById('btn-demo-cliente')?.addEventListener('click', () => {
    inputEmail.value = 'cliente@test.com';
    inputPassword.value = 'cliente123';
    window.Notificaciones.toast('Credenciales de Cliente cargadas.', 'info');
  });

  if (window.Sesion.usuario()) {
    window.location.replace('../catalogo/index.html');
    return;
  }

  const campos = {
    email: {
      input: inputEmail,
      error: document.getElementById('email-error'),
      validar(valor) {
        if (!valor) return 'Ingresa tu correo electrónico.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'El correo no es válido.';
        return '';
      },
    },
    password: {
      input: inputPassword,
      error: document.getElementById('password-error'),
      validar(valor) {
        if (!valor) return 'Ingresa tu contraseña.';
        return '';
      },
    },
  };

  function validarCampo(campo) {
    const error = campo.validar(campo.input.value.trim());
    campo.error.textContent = error;
    campo.input.setAttribute('aria-invalid', error ? 'true' : 'false');
    return !error;
  }

  Object.values(campos).forEach((campo) => {
    campo.input.addEventListener('input', () => {
      if (campo.input.getAttribute('aria-invalid') === 'true') validarCampo(campo);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.textContent = '';
    mensaje.classList.remove('formulario__mensaje--error');

    const valido = Object.values(campos).map(validarCampo).every(Boolean);
    if (!valido) return;

    boton.disabled = true;
    boton.textContent = 'Verificando credenciales...';

    const email = campos.email.input.value.trim();
    const password = campos.password.input.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const datos = await res.json().catch(() => ({}));

      if (res.ok) {
        window.Sesion.guardar(datos.token, datos.usuario);
        window.Notificaciones.toast('Sesión iniciada con éxito.', 'exito');
        setTimeout(() => { window.location.href = '../catalogo/index.html'; }, 500);
        return;
      } else if (res.status === 403 && datos.codigo === 'correo_no_verificado') {
        // Contraseña correcta pero correo sin verificar: se pide un código nuevo
        window.Notificaciones.toast('Verifica tu correo para continuar.', 'info');
        window.location.href = `verificar.html?email=${encodeURIComponent(email)}&reenviar=1`;
        return;
      } else {
        mostrarError(datos.error || 'Credenciales incorrectas.');
        boton.disabled = false;
        boton.textContent = 'Ingresar al Sistema';
        return;
      }
    } catch {
      // Sin respuesta del servicio auth no hay sesión: nunca se crea una sesión local
      mostrarError('No se pudo conectar con el microservicio de autenticación.');
    } finally {
      boton.disabled = false;
      boton.textContent = 'Ingresar al Sistema';
    }
  });

  function mostrarError(texto) {
    mensaje.textContent = texto;
    mensaje.classList.add('formulario__mensaje--error');
  }
})();
