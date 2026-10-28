-- Las cuentas no se borran: el admin las desactiva y dejan de poder iniciar sesión.
-- Así se conservan sus órdenes y su historial.
ALTER TABLE usuarios ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;
