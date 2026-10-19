CREATE TABLE IF NOT EXISTS ordenes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detalles_orden (
    id BIGSERIAL PRIMARY KEY,
    orden_id BIGINT NOT NULL,
    producto_id VARCHAR(50) NOT NULL,
    producto_nombre VARCHAR(255) NOT NULL,
    precio_unitario NUMERIC(10, 2) NOT NULL,
    cantidad INT NOT NULL,
    CONSTRAINT fk_detalles_orden_orden FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE
);