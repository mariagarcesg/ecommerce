// Formulario de login: valida email y contraseña en el navegador
// y los envía a POST /api/auth/login (gateway -> auth).
(function () {
  const form = document.getElementById('form-login');
  const mensaje = document.getElementById('mensaje');
  const boton = form.querySelector('button[type="submit"]');

  // Si ya hay una sesión abierta no tiene sentido mostrar el login
  if (Sesion.usuario()) {
    window.location.replace('../catalogo/index.html');
    return;
  }

  const campos = {
    email: {
      input: document.getElementById('email'),
      error: document.getElementById('email-error'),
      validar(valor) {
        if (!valor) return 'Ingresa tu correo electrónico.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'El correo no es válido.';
        return '';
      },
    },
    password: {
      input: document.getElementById('password'),
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

  // Limpia el error de un campo en cuanto el usuario lo corrige
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
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: campos.email.input.value.trim(),
          password: campos.password.input.value,
        }),
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarError(datos.error || 'No se pudo iniciar sesión.');
        return;
      }

      Sesion.guardar(datos.token, datos.usuario);
      window.location.href = '../catalogo/index.html';
    } catch {
      mostrarError('No se pudo conectar con el servidor.');
    } finally {
      boton.disabled = false;
    }
  });

  function mostrarError(texto) {
    mensaje.textContent = texto;
    mensaje.classList.add('formulario__mensaje--error');
  }
})();
