-- Usuarios de prueba (contraseñas en texto plano en el README: admin123 / cliente123).
-- Los hashes son bcrypt; nunca guardar contraseñas en texto plano.
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Admin',   'admin@test.com',   '$2a$10$S/OEnH1coXsy6bV6qalNBOxiKqlzfljdFgKIFH6ikCiHCQSf3phpq', 'admin'),
  ('Cliente', 'cliente@test.com', '$2a$10$WPOU/eEQMFkPAjfrGHJ7Qe07TYiJLGoSAqvvv1gG4CI/noKun.kRy', 'cliente')
ON CONFLICT (email) DO NOTHING;
