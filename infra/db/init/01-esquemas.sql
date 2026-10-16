-- Se ejecuta solo la primera vez que se crea el volumen de la BD.
-- Para volver a ejecutarlo: docker compose down -v && docker compose up -d
-- Cada microservicio tiene su propio usuario y esquema, y no puede acceder a los demás.

-- Nadie crea objetos en el esquema public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Plantilla por microservicio (reemplazar <servicio> y descomentar):
-- CREATE USER <servicio> WITH PASSWORD '<servicio>';
-- CREATE SCHEMA <servicio> AUTHORIZATION <servicio>;
-- ALTER ROLE <servicio> SET search_path = <servicio>;
