-- Usuarios de prueba (contraseñas en texto plano en el README: admin123 / cliente123).
-- Los hashes son bcrypt; nunca guardar contraseñas en texto plano.
-- Vienen verificados para poder iniciar sesión sin pedir el código por correo.
INSERT INTO usuarios (nombre, email, password_hash, rol, verificado) VALUES
  ('Admin',   'admin@test.com',   '$2a$10$S/OEnH1coXsy6bV6qalNBOxiKqlzfljdFgKIFH6ikCiHCQSf3phpq', 'admin',   true),
  ('Cliente', 'cliente@test.com', '$2a$10$WPOU/eEQMFkPAjfrGHJ7Qe07TYiJLGoSAqvvv1gG4CI/noKun.kRy', 'cliente', true)
ON CONFLICT (email) DO NOTHING;
