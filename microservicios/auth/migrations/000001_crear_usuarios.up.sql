CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol           VARCHAR(20)  NOT NULL DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente')),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
