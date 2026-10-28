// Formulario de registro: valida los datos en el navegador y los envía a
// POST /api/auth/registro (gateway -> auth). auth envía un código al correo y
// el usuario pasa a verificar.html; la sesión se inicia al verificar el código.
(function () {
  const form = document.getElementById('form-registro');
  const mensaje = document.getElementById('mensaje');
  const password = document.getElementById('password');
  const boton = form.querySelector('button[type="submit"]');

  if (Sesion.usuario()) {
    window.location.replace(Sesion.paginaInicio());
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
    // Las contraseñas se validan tal cual se envían (sin trim): antes se validaba
    // recortada pero se guardaba con los espacios, y luego el login fallaba
    password: {
      input: password,
      error: document.getElementById('password-error'),
      sinTrim: true,
      validar: (valor) => Sesion.errorContrasena(valor),
    },
    confirmar: {
      input: document.getElementById('confirmar'),
      error: document.getElementById('confirmar-error'),
      sinTrim: true,
      validar(valor) {
        if (!valor) return 'Repite la contraseña.';
        if (valor !== password.value) return 'Las contraseñas no coinciden.';
        return '';
      },
    },
  };

  // Lista de requisitos de la contraseña, marcada en vivo
  const listaReglas = document.getElementById('password-reglas');
  function pintarReglas() {
    listaReglas.innerHTML = Sesion.reglasContrasena(password.value).map(r => `
      <li class="${r.ok ? 'reglas-clave__ok' : ''}">${r.ok ? '✓' : '•'} ${r.texto}</li>
    `).join('');
  }
  password.addEventListener('input', () => {
    pintarReglas();
    // Si ya se escribió la confirmación, se revisa de nuevo al cambiar la clave
    if (campos.confirmar.input.value) validarCampo(campos.confirmar);
  });
  pintarReglas();

  function validarCampo(campo) {
    const valor = campo.sinTrim ? campo.input.value : campo.input.value.trim();
    const error = campo.validar(valor);
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
          password: password.value, // sin trim: el login la envía tal cual
        }),
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarError(datos.error || 'No se pudo crear la cuenta.');
        return;
      }

      // Si el correo no salió, verificar.html pide otro código al abrir
      const reenviar = datos.correo_enviado === false ? '&reenviar=1' : '';
      window.location.href = `verificar.html?email=${encodeURIComponent(datos.email)}${reenviar}`;
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
