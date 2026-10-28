-- Los roles pasan de un texto con CHECK en usuarios a una tabla propia.
-- La API y el JWT siguen usando el nombre ("admin" / "cliente").
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(20)  NOT NULL UNIQUE,
    descripcion VARCHAR(200) NOT NULL DEFAULT ''
);

INSERT INTO roles (nombre, descripcion) VALUES
    ('admin',   'Administra catálogo, órdenes, usuarios y analítica'),
    ('cliente', 'Compra en la tienda y ve sus pedidos');

ALTER TABLE usuarios ADD COLUMN rol_id INTEGER REFERENCES roles (id);
UPDATE usuarios u SET rol_id = r.id FROM roles r WHERE r.nombre = u.rol;
ALTER TABLE usuarios ALTER COLUMN rol_id SET NOT NULL;
ALTER TABLE usuarios DROP COLUMN rol;
