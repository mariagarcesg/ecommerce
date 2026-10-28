ALTER TABLE usuarios ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente'));
UPDATE usuarios u SET rol = r.nombre FROM roles r WHERE r.id = u.rol_id;
ALTER TABLE usuarios DROP COLUMN rol_id;
DROP TABLE roles;
