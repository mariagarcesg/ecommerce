-- Solo se registran órdenes con el pago aprobado en la pasarela: toda orden es una venta.
UPDATE ordenes SET estado = 'PAGADA' WHERE estado = 'PENDIENTE';
ALTER TABLE ordenes ALTER COLUMN estado SET DEFAULT 'PAGADA';

-- Datos de la compra que llena el cliente en la pasarela de pagos
ALTER TABLE ordenes ADD COLUMN cliente_nombre   VARCHAR(80);
ALTER TABLE ordenes ADD COLUMN telefono         VARCHAR(15);
ALTER TABLE ordenes ADD COLUMN direccion        VARCHAR(150);
ALTER TABLE ordenes ADD COLUMN ciudad           VARCHAR(60);
ALTER TABLE ordenes ADD COLUMN tarjeta_ultimos4 VARCHAR(4);

-- total = suma de las líneas - descuento del cupón
ALTER TABLE ordenes ADD COLUMN cupon     VARCHAR(20);
ALTER TABLE ordenes ADD COLUMN descuento NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
