-- Usuarios de prueba (contraseñas en texto plano en el README: admin123 / cliente123).
-- Los hashes son bcrypt; nunca guardar contraseñas en texto plano.
-- Vienen verificados para poder iniciar sesión sin pedir el código por correo.
-- El rol se guarda como rol_id (tabla roles, creada por la migración 000004).
INSERT INTO usuarios (nombre, email, password_hash, rol_id, verificado)
SELECT u.nombre, u.email, u.hash, r.id, true
FROM (VALUES
  ('Admin',   'admin@test.com',   '$2a$10$S/OEnH1coXsy6bV6qalNBOxiKqlzfljdFgKIFH6ikCiHCQSf3phpq', 'admin'),
  ('Cliente', 'cliente@test.com', '$2a$10$WPOU/eEQMFkPAjfrGHJ7Qe07TYiJLGoSAqvvv1gG4CI/noKun.kRy', 'cliente')
) AS u (nombre, email, hash, rol)
JOIN roles r ON r.nombre = u.rol
ON CONFLICT (email) DO NOTHING;
