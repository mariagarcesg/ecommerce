# Microservicio Catálogo

Microservicio de catálogo de productos construido con Express.js y MongoDB.

## Estructura

```
catalogo/
├── src/
│   ├── config/
│   │   └── db.js              # Configuración de conexión a MongoDB
│   ├── models/                # Modelos Mongoose (pendiente)
│   ├── controllers/           # Controladores (pendiente)
│   ├── routes/                # Rutas Express (pendiente)
│   ├── middleware/            # Middleware (pendiente)
│   └── index.js               # Punto de entrada
├── seeds/                     # Datos de prueba (pendiente)
├── Dockerfile
├── package.json
└── .env.example
```

## Variables de Entorno

- `PORT`: Puerto del servicio (default: 3000)
- `MONGO_URI`: URI de conexión a MongoDB
- `JWT_SECRET`: Secreto para verificar tokens JWT

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Ejecutar el servicio
npm start
```

## Docker

El servicio está configurado en `docker-compose.yml`:

```bash
docker compose up -d catalogo
```
