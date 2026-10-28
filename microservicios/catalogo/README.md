# Microservicio Catálogo

Microservicio de gestión de productos y categorías, construido con **Node.js + Express** y **MongoDB (Mongoose)**. Es parte de la arquitectura de microservicios del ecommerce y está expuesto únicamente a través del API Gateway.

---

## Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Estructura de Archivos](#estructura-de-archivos)
- [Modelos de Datos](#modelos-de-datos)
- [Endpoints](#endpoints)
  - [Productos](#productos)
  - [Categorías](#categorías)
- [Autenticación y Autorización](#autenticación-y-autorización)
- [Filtros de Productos](#filtros-de-productos)
- [Variables de Entorno](#variables-de-entorno)
- [Desarrollo Local](#desarrollo-local)
- [Docker](#docker)

---

## Arquitectura

```
Cliente → Gateway (:8080) → catalogo (:3000) → MongoDB
```

El gateway elimina el prefijo `/api/catalogo` antes de reenviar la petición, por lo que el servicio recibe rutas limpias (`/products`, `/categories`).

---

## Estructura de Archivos

```
catalogo/
├── src/
│   ├── config/
│   │   └── db.js                  # Conexión a MongoDB con Mongoose
│   ├── models/
│   │   ├── product.js             # Esquema y modelo de Producto
│   │   └── category.js            # Esquema y modelo de Categoría
│   ├── controllers/
│   │   ├── productController.js   # Lógica CRUD + filtros + stock
│   │   └── categoryController.js  # Lógica CRUD de categorías
│   ├── routes/
│   │   ├── productRoutes.js       # Rutas /products
│   │   └── categoriesRoutes.js    # Rutas /categories
│   ├── middleware/
│   │   ├── auth.js                # Verifica el JWT (authenticate)
│   │   └── authorize.js           # Verifica el rol del usuario (authorize)
│   └── index.js                   # Punto de entrada del servidor
├── seeds/                         # Scripts de datos de prueba
├── Dockerfile
├── package.json
└── README.md
```

---

## Modelos de Datos

### Category

| Campo         | Tipo   | Requerido | Notas               |
|---------------|--------|-----------|---------------------|
| `name`        | String | ✅        | Único (sin distinguir mayúsculas ni tildes), máx. 60 |
| `description` | String | ❌        | —                   |

### Product

| Campo         | Tipo       | Requerido | Notas                                |
|---------------|------------|-----------|--------------------------------------|
| `name`        | String     | ✅        | —                                    |
| `price`       | Number     | ✅        | Mínimo 0                             |
| `stock`       | Number     | ✅        | Mínimo 0                             |
| `category`    | ObjectId   | ✅        | Referencia a `Category` (populate)   |
| `sizes`       | [String]   | ❌        | Tallas disponibles                   |
| `colors`      | [String]   | ❌        | Colores disponibles                  |
| `details`     | [String]   | ❌        | Detalles adicionales                 |
| `description` | String     | ❌        | Descripción larga                    |
| `imagen`      | String     | ❌        | URL de la foto del producto          |

---

## Endpoints

### Productos

Base: `/products` (o `/api/catalogo/products` desde el gateway)

| Método   | Ruta                       | Descripción                                 | Auth requerida |
|----------|----------------------------|---------------------------------------------|----------------|
| `GET`    | `/`                        | Listar todos los productos (con filtros)     | No             |
| `GET`    | `/:id`                     | Obtener un producto por ID                  | No             |
| `GET`    | `/category/:categoryId`    | Listar productos de una categoría           | No             |
| `POST`   | `/`                        | Crear un producto nuevo                     | Admin          |
| `PUT`    | `/:id`                     | Actualizar un producto                      | Admin          |
| `DELETE` | `/:id`                     | Eliminar un producto                        | Admin          |
| `PATCH`  | `/:id/stock`               | Incrementar o decrementar stock             | Admin          |

#### Filtros disponibles en `GET /products`

Se pasan como query params:

| Param       | Tipo   | Ejemplo              | Descripción                            |
|-------------|--------|----------------------|----------------------------------------|
| `name`      | string | `?name=camisa`       | Búsqueda parcial e insensible a mayúsculas |
| `minPrice`  | number | `?minPrice=10`       | Precio mínimo                          |
| `maxPrice`  | number | `?maxPrice=500`      | Precio máximo                          |
| `minStock`  | number | `?minStock=1`        | Stock mínimo                           |
| `maxStock`  | number | `?maxStock=50`       | Stock máximo                           |

Los filtros son combinables: `GET /products?name=polo&minPrice=20&maxPrice=100`

#### Body de `PATCH /:id/stock`

```json
{ "quantity": -2 }
```

`quantity` puede ser positivo (entrada) o negativo (salida). El servicio rechaza la operación si el stock resultante sería menor que 0.

---

### Categorías

Base: `/categories` (o `/api/catalogo/categories` desde el gateway)

| Método   | Ruta    | Descripción                   | Auth requerida |
|----------|---------|-------------------------------|----------------|
| `GET`    | `/`     | Listar todas las categorías   | No             |
| `GET`    | `/:id`  | Obtener una categoría por ID  | No             |
| `POST`   | `/`     | Crear una categoría           | Admin          |
| `PUT`    | `/:id`  | Actualizar una categoría      | Admin          |
| `DELETE` | `/:id`  | Eliminar una categoría        | Admin          |

- Crear o renombrar con un nombre que ya existe responde `409` (`"gaming"` choca con `"Gaming"` y `"Electronica"` con `"Electrónica"`).
- No se puede eliminar una categoría que todavía tiene productos: responde `409` con cuántos tiene.
- Al crear o editar un producto se comprueba que su `category` exista; si no, responde `400`.

### Imágenes subidas

Base: `/uploads` (o `/api/catalogo/uploads` desde el gateway)

| Método | Ruta       | Descripción                                              | Auth requerida |
|--------|------------|----------------------------------------------------------|----------------|
| `POST` | `/`        | Sube una foto (cuerpo = el archivo en binario) -> `{ url }` | Admin          |
| `GET`  | `/:archivo` | Devuelve la foto                                         | No             |

- Acepta JPG, PNG o WebP de hasta 2 MB; el formato se comprueba por el contenido del archivo, no por su `Content-Type`.
- Las fotos se guardan en el volumen Docker `catalogo-uploads` (carpeta `UPLOADS_DIR`). Son locales de cada máquina, igual que los datos de Mongo.
- `product.imagen` acepta una URL `http(s)://` o una ruta `/api/catalogo/uploads/...` devuelta por esta ruta.

---

## Autenticación y Autorización

El servicio usa dos middlewares en cadena para proteger las rutas de escritura:

1. **`authenticate`** (`middleware/auth.js`): extrae y verifica el JWT del header `Authorization: Bearer <token>`. Inyecta `req.user = { id, nombre, rol }` si es válido.

2. **`authorize(...roles)`** (`middleware/authorize.js`): recibe una lista de roles permitidos y bloquea con `403` si el rol del usuario autenticado no está en la lista.

Ejemplo de uso en rutas de productos:
```js
productsRouter.post('/', authenticate, authorize('admin'), createProduct);
```

---

## Filtros de Productos

El controlador `getProducts` construye un objeto `filter` dinámicamente antes de consultar MongoDB:

```js
const filter = {};

// Búsqueda por nombre: regex case-insensitive
if (name) filter.name = { $regex: name, $options: 'i' };

// Rango de precio
if (minPrice !== undefined || maxPrice !== undefined) {
  filter.price = {};
  if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
  if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
}

// Rango de stock
if (minStock !== undefined || maxStock !== undefined) {
  filter.stock = {};
  if (minStock !== undefined) filter.stock.$gte = parseInt(minStock);
  if (maxStock !== undefined) filter.stock.$lte = parseInt(maxStock);
}

const products = await Product.find(filter).populate('category');
```

Solo se agregan al objeto `filter` los campos que el cliente envió, haciendo la consulta eficiente.

---

## Variables de Entorno

| Variable        | Default                                          | Descripción                              |
|-----------------|--------------------------------------------------|------------------------------------------|
| `PORT`          | `3000`                                           | Puerto en que escucha el servicio        |
| `MONGO_URI`     | `mongodb://catalogo:catalogo@mongo:27017/catalogo` | Cadena de conexión a MongoDB           |
| `JWT_SECRET`    | —                                                | Secreto compartido para verificar JWT   |

---

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno (desde la raíz del proyecto)
cp .env.example .env

# Ejecutar el servicio
npm start
```

> El servicio espera que MongoDB esté accesible en la URI configurada. Localmente se puede levantar con `docker compose up mongo`.

---

## Docker

El servicio está integrado en el `docker-compose.yml` de la raíz del proyecto:

```bash
# Solo el servicio de catálogo (y MongoDB como dependencia)
docker compose up -d catalogo

# Todo el stack
docker compose up -d
```

El healthcheck de MongoDB garantiza que el contenedor `catalogo` no inicie hasta que la base de datos esté lista.
