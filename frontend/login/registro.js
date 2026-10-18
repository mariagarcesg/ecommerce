// Formulario de registro: valida los datos en el navegador y los envía a
// POST /api/auth/registro (gateway -> auth). Al registrarse, el usuario queda logueado.
(function () {
  const form = document.getElementById('form-registro');
  const mensaje = document.getElementById('mensaje');
  const password = document.getElementById('password');
  const boton = form.querySelector('button[type="submit"]');

  if (Sesion.usuario()) {
    window.location.replace('../catalogo/index.html');
    return;
  }

  const campos = {
    nombre: {
      input: document.getElementById('nombre'),
      error: document.getElementById('nombre-error'),
      validar(valor) {
        if (!valor) return 'Ingresa tu nombre.';
        return '';
      },
    },
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
      input: password,
      error: document.getElementById('password-error'),
      validar(valor) {
        if (!valor) return 'Ingresa una contraseña.';
        if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
        return '';
      },
    },
    confirmar: {
      input: document.getElementById('confirmar'),
      error: document.getElementById('confirmar-error'),
      validar(valor) {
        if (!valor) return 'Repite la contraseña.';
        if (valor !== password.value.trim()) return 'Las contraseñas no coinciden.';
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
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: campos.nombre.input.value.trim(),
          email: campos.email.input.value.trim(),
          password: password.value.trim(),
        }),
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarError(datos.error || 'No se pudo crear la cuenta.');
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
