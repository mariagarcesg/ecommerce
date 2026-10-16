# ecommerce

E-commerce con **microservicios en contenedores Docker**. Cada microservicio usa un lenguaje y una base de datos distintos; el frontend es uno solo. Todo corre en local (no hay entorno productivo).

## Microservicios

| Carpeta | Lenguaje | Base de datos | Responsabilidad |
|---|---|---|---|
| `microservicios/catalogo/` | Node.js | MongoDB (base `catalogo`) | Catálogo de productos: productos, categorías, precios, stock |
| `microservicios/auth/` | Go | PostgreSQL (esquema `auth`) + Redis | Autenticación: registro, login, emisión de tokens JWT |
| `microservicios/ordenes/` | Java | PostgreSQL (esquema `ordenes`) | Órdenes seguras y transacciones: carrito, pedidos, pagos |
| `microservicios/analitica/` | Python | PostgreSQL (esquema `analitica`) | Análisis y datos históricos: reportes, estadísticas de ventas |

```
                          ┌──► catalogo  (Node)   ──► MongoDB
Frontend ──► gateway ─────┼──► auth      (Go)     ──► PostgreSQL [auth] + Redis
                          ├──► ordenes   (Java)   ──► PostgreSQL [ordenes]
                          └──► analitica (Python) ──► PostgreSQL [analitica]
```

> **Estado actual:** las carpetas de los microservicios existen pero **todavía no tienen código**. Cada equipo crea el suyo respetando las reglas de este README.

## Estructura

```
ecommerce/
├── docker-compose.yml
├── .env.example
├── frontend/
├── gateway/
├── microservicios/
│   ├── catalogo/      seeds/
│   ├── auth/          migrations/  seeds/
│   ├── ordenes/       migrations/  seeds/
│   └── analitica/     migrations/  seeds/
├── infra/
│   ├── db/init/       # PostgreSQL: crea esquemas y usuarios
│   └── mongo/init/    # MongoDB: crea la base y el usuario de catalogo
└── scripts/
```

| Carpeta / archivo | Para qué es |
|---|---|
| `docker-compose.yml` | Levanta todos los contenedores (bases de datos, microservicios, gateway, frontend) con un solo comando. Los microservicios están comentados hasta que tengan su `Dockerfile`. |
| `.env.example` | Variables de entorno de ejemplo. Copiar a `.env` (que no se sube a git). |
| `frontend/` | La única aplicación web del proyecto, con su propio `Dockerfile`. Solo habla con el **gateway**, nunca directo con los microservicios. |
| `gateway/` | Punto de entrada único (Nginx). Recibe las peticiones del frontend y las reparte al microservicio correspondiente según la ruta. No contiene lógica de negocio, solo configuración. |
| `microservicios/` | Un subdirectorio por microservicio. Cada uno es independiente: su propio lenguaje, `Dockerfile`, dependencias, `migrations/` (tablas) y `seeds/` (datos de prueba). |
| `infra/` | Configuración del entorno que no es lógica de negocio: scripts que crean usuarios y esquemas de las bases de datos. A futuro: mensajería, monitoreo, etc. |
| `scripts/` | Utilidades para el equipo: cargar seeds, exportar y restaurar backups. |

## Inicio rápido

Requisito: Docker Desktop abierto.

```bash
cp .env.example .env
docker compose up -d          # levantar
docker compose down           # detener (los datos se conservan)
docker compose down -v        # detener y BORRAR las BDs (se recrean desde cero al volver a levantar)
```

Los scripts de `scripts/` son de bash: en Windows ejecutarlos desde **Git Bash** (ej. `./scripts/cargar-seeds.sh`).

---

# Comunicación entre microservicios

Regla de oro: **cada microservicio solo accede a su propia base de datos.** Si necesita datos de otro, se los pide **por API**.

| Desde → hacia | Cómo |
|---|---|
| Frontend → cualquiera | Siempre a través del `gateway` (ej. `/api/catalogo/...`, `/api/auth/...`, `/api/ordenes/...`, `/api/analitica/...`). |
| ordenes → catalogo | Al crear un pedido, `ordenes` consulta precio y stock a `catalogo` por API y **guarda una copia** (nombre, precio) en el pedido. Así el pedido no cambia si luego cambia el precio del producto. |
| analitica → ordenes | `analitica` **no lee** el esquema `ordenes`. Pide los datos a la API de `ordenes` (ej. ventas del día) y guarda resúmenes en su propio esquema. Más adelante se puede pasar a eventos con RabbitMQ. |
| auth → todos | `auth` emite un token JWT; los demás solo lo verifican (ver abajo). Nadie consulta la BD de `auth`. |

Dentro de Docker los servicios se llaman por su nombre en el compose: `http://catalogo:3000`, `http://ordenes:8080`, etc.

# Autenticación

1. El usuario hace login: `frontend → gateway → auth` con email y contraseña.
2. `auth` valida contra su tabla `usuarios` (PostgreSQL) y devuelve un **token JWT** firmado con `JWT_SECRET`. El token incluye el id y el rol del usuario.
3. El frontend envía ese token en cada petición: `Authorization: Bearer <token>`.
4. Cada microservicio verifica la firma del token con el mismo `JWT_SECRET` (librería JWT de su lenguaje) y obtiene el id y el rol del usuario **sin consultar a `auth`**.

Qué guarda `auth` en cada base de datos:

| PostgreSQL (esquema `auth`) — datos permanentes | Redis — datos temporales y rápidos |
|---|---|
| Usuarios, email, **hash** de la contraseña (bcrypt), rol | Sesiones activas, tokens revocados (logout), límite de intentos de login, códigos de verificación |

- Las contraseñas **nunca** se guardan en texto plano, solo su hash (bcrypt).
- `JWT_SECRET` va en `.env`. En `.env.example` hay un valor de relleno.
- Roles previstos: `admin` y `cliente`.

---

# Bases de datos

## 1. Qué base usa cada servicio

| Contenedor | Motor | Qué contiene | Quién lo usa |
|---|---|---|---|
| `ecommerce-db` | PostgreSQL 16 | Base `ecommerce` con los esquemas `auth`, `ordenes`, `analitica` | auth, ordenes, analitica |
| `ecommerce-mongo` | MongoDB 7 | Base `catalogo` | catalogo |
| `ecommerce-redis` | Redis 7 | Datos temporales de autenticación | auth |

En PostgreSQL hay **un esquema por microservicio** (no por persona), cada uno con su propio usuario:

```
PostgreSQL: ecommerce
├── esquema auth        ← solo lo usa el usuario "auth"
├── esquema ordenes     ← solo lo usa el usuario "ordenes"
└── esquema analitica   ← solo lo usa el usuario "analitica"

MongoDB
└── base catalogo       ← solo la usa el usuario "catalogo"
```

- El **código** de un microservicio solo puede acceder a lo suyo. Si `ordenes` intenta leer las tablas de `auth`, PostgreSQL responde `permission denied`. En MongoDB, el usuario `catalogo` no puede escribir en otras bases.
- Las **personas** sí ven todo con el usuario `admin`, para consultar.

## 2. Cada computadora tiene sus propias BDs completas

Cada participante, al ejecutar `docker compose up -d`, crea en **su computadora** las tres bases de datos con **todos** los esquemas:

```
PC participante 1          PC participante 2          PC participante 3
PostgreSQL + Mongo + Redis PostgreSQL + Mongo + Redis PostgreSQL + Mongo + Redis
(sus propios datos)        (sus propios datos)        (sus propios datos)
```

- Los datos se guardan en volúmenes Docker (`db-data`, `mongo-data`, `redis-data`) de esa computadora: no están en la carpeta del proyecto ni en git.
- Sobreviven a apagar el PC y a `docker compose down`. Solo se borran con `docker compose down -v`.
- **Lo que inserta un participante en su BD no lo ven los demás.** No hay BD compartida en vivo.

Para que todos tengan **la misma estructura y los mismos datos**, se comparten por git las *instrucciones* para crearlos, no los datos:

| Qué se comparte | Dónde | Cuándo se aplica |
|---|---|---|
| Esquemas y usuarios de PostgreSQL | `infra/db/init/01-esquemas.sql` | Automático, la primera vez que se crea la BD |
| Base y usuario de MongoDB | `infra/mongo/init/01-catalogo.js` | Automático, la primera vez que se crea la BD |
| Tablas (PostgreSQL) | `microservicios/<servicio>/migrations/` | Cada microservicio las aplica al arrancar |
| Datos de prueba | `microservicios/<servicio>/seeds/` | Con `./scripts/cargar-seeds.sh` |
| Copia completa (opcional) | `infra/db/backup.sql` y `infra/mongo/backup.archive` | Con `./scripts/restaurar.sh` |

Flujo normal al empezar el día:

```bash
git pull
docker compose up -d                 # migraciones nuevas se aplican al arrancar cada servicio
./scripts/cargar-seeds.sh            # datos de prueba nuevos que hayan subido otros
```

## 3. Esquemas y usuarios: cómo se crean

Los scripts de `infra/db/init/` y `infra/mongo/init/` se ejecutan **solo la primera vez** que se crean las bases de datos. Si alguien los modifica (por ejemplo, agrega un servicio), los demás deben **recrear sus BDs**:

```bash
git pull
docker compose down -v && docker compose up -d
./scripts/cargar-seeds.sh
```

## 4. Migraciones: las tablas (PostgreSQL)

- `auth`, `ordenes` y `analitica` crean y modifican **sus tablas** con archivos en `microservicios/<servicio>/migrations/`, usando la herramienta de su lenguaje:
  - Go (auth): golang-migrate
  - Java (ordenes): Flyway
  - Python (analitica): Alembic
- Se ejecutan con el usuario del servicio, así que las tablas quedan en su esquema sin escribir el prefijo.
- **Nunca crear ni modificar tablas a mano en pgAdmin**: si lo haces, tu BD quedará distinta a la de los demás.
- Para cambiar una tabla existente se crea una **migración nueva**; no se editan las que ya se subieron a git.
- `catalogo` (MongoDB) no necesita migraciones: las colecciones se crean solas al insertar. Si necesita índices, los crea el propio servicio al arrancar.

## 5. Seeds: datos de prueba compartidos

Los seeds son archivos en `microservicios/<servicio>/seeds/` con datos de prueba, para que todos tengan los mismos productos, usuarios, etc. El formato depende de la base de datos:

**PostgreSQL (`.sql`)** — ej. `microservicios/ordenes/seeds/01-ordenes.sql`:

```sql
INSERT INTO ordenes (id, usuario_id, total) VALUES
  (1, 2, 60.00)
ON CONFLICT (id) DO NOTHING;
```

- Escribir las tablas **sin prefijo de esquema**: el script los ejecuta con el usuario del servicio.
- Usar `ON CONFLICT ... DO NOTHING` para poder cargarlos varias veces sin duplicados.

**MongoDB (`.json`)** — ej. `microservicios/catalogo/seeds/01-productos.json`:

```json
[
  { "_id": 1, "nombre": "Camiseta", "precio": 15.00, "stock": 20 },
  { "_id": 2, "nombre": "Zapatos",  "precio": 45.00, "stock": 10 }
]
```

- Debe ser un **arreglo JSON**.
- La colección es el nombre del archivo sin el prefijo numérico (`01-productos.json` → colección `productos`).
- Incluir `_id` fijo: si el documento ya existe, se reemplaza (no se duplica).

**Redis** no lleva seeds: solo guarda datos temporales.

**Usuarios de prueba (auth):** el seed de `auth` incluirá usuarios conocidos por todos. Las contraseñas van con **hash bcrypt** en el seed, y en texto plano solo en esta tabla:

| Email | Contraseña | Rol |
|---|---|---|
| `admin@test.com` | `admin123` | admin |
| `cliente@test.com` | `cliente123` | cliente |

Reglas generales:
- Nombrar con prefijo numérico (`01-`, `02-`): se ejecutan en orden alfabético.
- En PostgreSQL las tablas deben existir antes (las crean las migraciones del servicio).
- ¿Necesitas un dato de prueba nuevo que deban tener todos? Agrégalo al seed y súbelo a git, no lo insertes a mano.

Cargarlos:

```bash
./scripts/cargar-seeds.sh             # todos los microservicios
./scripts/cargar-seeds.sh catalogo    # solo uno
```

## 6. Backup: copia completa (opcional)

Para casos puntuales, por ejemplo pasar a todos un set de datos ya armado para una demo:

```bash
./scripts/backup.sh       # quien tiene los datos: exporta PostgreSQL y MongoDB a infra/
./scripts/restaurar.sh    # los demás: reemplazan sus BDs locales con esos archivos
```

- Genera `infra/db/backup.sql` (PostgreSQL) e `infra/mongo/backup.archive` (MongoDB). Redis no se respalda.
- `restaurar.sh` **borra y reemplaza** los datos locales incluidos en el backup.
- Todos deben tener los mismos scripts de `infra/*/init/` (crean los usuarios y esquemas).
- Un backup hecho antes de una migración nueva puede no coincidir con las tablas actuales.
- Para el día a día se usan **seeds**; el backup es solo para compartir una foto puntual. Avisar al equipo antes de subir un backup a git para no pisarse.

## 7. Conexión desde cada microservicio

Cada microservicio recibe sus datos de conexión como variables de entorno desde `docker-compose.yml` (ver la plantilla comentada de cada uno).

> Dentro de Docker el host es el **nombre del servicio** (`db`, `mongo`, `redis`), **no** `localhost`. `localhost` y los puertos externos solo se usan desde tu PC.

| Servicio | Dentro de Docker | Desde tu PC |
|---|---|---|
| catalogo | `mongodb://catalogo:catalogo@mongo:27017/catalogo` | `mongodb://catalogo:catalogo@localhost:27017/catalogo` |
| auth (PostgreSQL) | `postgres://auth:auth@db:5432/ecommerce?search_path=auth` | `localhost:5433`, usuario `auth` |
| auth (Redis) | `redis:6379`, contraseña `redis` | `localhost:6379`, contraseña `redis` |
| ordenes | `jdbc:postgresql://db:5432/ecommerce?currentSchema=ordenes` (usuario y contraseña `ordenes`) | `localhost:5433`, usuario `ordenes` |
| analitica | `postgresql://analitica:analitica@db:5432/ecommerce?options=-csearch_path%3Danalitica` | `localhost:5433`, usuario `analitica` |

Las herramientas de migraciones deben usar ese mismo usuario y esquema.

## 8. Ver las bases de datos

| Base | Herramienta | Conexión (admin) |
|---|---|---|
| PostgreSQL | pgAdmin / DBeaver | `localhost:5433`, base `ecommerce`, usuario `admin`, contraseña `admin` |
| MongoDB | MongoDB Compass | `mongodb://admin:admin@localhost:27017/?authSource=admin` |
| Redis | Redis Insight / terminal | `localhost:6379`, contraseña `redis` |

**pgAdmin**

1. Clic derecho en *Servers* → *Register* → *Server…*
2. Pestaña *General*: nombre `ecommerce-docker`.
3. Pestaña *Connection*: host `localhost`, puerto `5433`, base `ecommerce`, usuario `admin`, contraseña `admin`.
4. Navegar a *ecommerce-docker → Databases → ecommerce → Schemas → `<servicio>` → Tables*.
5. Para ver datos: clic derecho en una tabla → *View/Edit Data* → *All Rows*.

> Se usa el puerto **5433** para no chocar con un PostgreSQL instalado en Windows (que usa el 5432). Si en pgAdmin ya tienes un servidor en 5432, ese es tu PostgreSQL local, **no** el del proyecto.

pgAdmin, Compass, etc. son solo para **ver**: las tablas se cambian con migraciones y los datos de prueba con seeds.

**Terminal**

```bash
# PostgreSQL
docker exec -it ecommerce-db psql -U admin -d ecommerce
#   \dn  esquemas | \dt <servicio>.*  tablas | \d <servicio>.<tabla>  columnas | \q  salir

# MongoDB
docker exec -it ecommerce-mongo mongosh "mongodb://admin:admin@localhost:27017/catalogo?authSource=admin"
#   show collections | db.productos.find() | exit

# Redis
docker exec -it ecommerce-redis redis-cli -a redis
#   KEYS * | GET <clave> | exit
```

## 9. Problemas comunes

| Problema | Causa / solución |
|---|---|
| `failed to connect to the docker API` | Docker Desktop no está abierto. |
| `port is already allocated` | Otro programa usa el puerto: cambiar `POSTGRES_PORT`, `MONGO_PORT` o `REDIS_PORT` en `.env`. |
| No aparece un esquema o usuario nuevo | Los scripts de init solo corren la primera vez: `docker compose down -v && docker compose up -d`. |
| `permission denied for schema ...` | Un servicio intenta leer el esquema de otro. Debe pedir los datos por API. |
| `relation ... does not exist` al cargar seeds | Faltan las tablas: levantar el servicio para que corra sus migraciones primero. |
| `NOAUTH Authentication required` (Redis) | Falta la contraseña: usar `REDIS_PASSWORD`. |
| Mis BDs están rotas o desordenadas | `docker compose down -v && docker compose up -d` y `./scripts/cargar-seeds.sh`. |

---

## Reglas del equipo

1. **Cada microservicio solo accede a su propia base de datos.** Los datos de otro servicio se piden por API.
2. **Nunca crear ni modificar tablas a mano** (pgAdmin, DBeaver). Todo cambio de tablas va en `microservicios/<servicio>/migrations/`.
3. **Los datos de prueba compartidos van en seeds**, no insertados a mano.
4. **El frontend solo llama al gateway.**
5. **La autenticación es con JWT** emitido por `auth`; los demás servicios solo lo verifican.
6. Cada microservicio debe poder construirse solo con su `Dockerfile`.
7. Las credenciales y secretos van en `.env`, no en el código.

## Agregar un microservicio nuevo

1. Crear `microservicios/<nombre>/` con su `Dockerfile`, `migrations/` y `seeds/`.
2. Si usa PostgreSQL: agregar su usuario y esquema en `infra/db/init/01-esquemas.sql` (plantilla comentada) y recrear la BD con `docker compose down -v && docker compose up -d`.
3. Agregar el servicio en `docker-compose.yml`.
4. Agregar su ruta en la configuración del `gateway/`.
5. Agregarlo a la tabla de microservicios de este README.
6. Avisar al equipo para que hagan `git pull` y recreen su BD.
