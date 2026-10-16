-- Se ejecuta solo la primera vez que se crea el volumen de la BD.
-- Para volver a ejecutarlo: docker compose down -v && docker compose up -d
-- Cada microservicio tiene su propio usuario y esquema, y no puede acceder a los demás.

-- Nadie crea objetos en el esquema public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- auth (Go): usuarios y credenciales. Las sesiones/tokens van en Redis.
CREATE USER auth WITH PASSWORD 'auth';
CREATE SCHEMA auth AUTHORIZATION auth;
ALTER ROLE auth SET search_path = auth;

-- ordenes (Java): carrito, pedidos y pagos
CREATE USER ordenes WITH PASSWORD 'ordenes';
CREATE SCHEMA ordenes AUTHORIZATION ordenes;
ALTER ROLE ordenes SET search_path = ordenes;

-- analitica (Python): reportes y datos históricos
CREATE USER analitica WITH PASSWORD 'analitica';
CREATE SCHEMA analitica AUTHORIZATION analitica;
ALTER ROLE analitica SET search_path = analitica;

-- Plantilla para un microservicio nuevo (reemplazar <servicio> y descomentar):
-- CREATE USER <servicio> WITH PASSWORD '<servicio>';
-- CREATE SCHEMA <servicio> AUTHORIZATION <servicio>;
-- ALTER ROLE <servicio> SET search_path = <servicio>;
