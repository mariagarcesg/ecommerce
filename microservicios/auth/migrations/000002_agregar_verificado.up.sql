-- Los usuarios nuevos deben verificar su correo con un código (microservicio otp).
-- Los que ya existían antes de este cambio se consideran verificados.
ALTER TABLE usuarios ADD COLUMN verificado BOOLEAN NOT NULL DEFAULT false;
UPDATE usuarios SET verificado = true;
