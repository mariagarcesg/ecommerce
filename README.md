# ecommerce

E-commerce con **microservicios en contenedores Docker**. Cada microservicio puede estar en un lenguaje distinto; el frontend es uno solo. Todo corre en local (no hay entorno productivo).

> **Estado actual:** solo existe la base del proyecto. Los módulos (microservicios) **aún no están definidos**; no crear servicios sin acordarlo con el equipo.

## Estructura

```
ecommerce/
├── docker-compose.yml
├── .env.example
├── frontend/
├── gateway/
├── microservicios/
├── infra/
│   └── db/init/
└── scripts/
```

| Carpeta / archivo | Para qué es |
|---|---|
| `docker-compose.yml` | Levanta todos los contenedores (BD, microservicios, gateway, frontend) con un solo comando. Cada servicio nuevo se agrega aquí usando la plantilla comentada. |
| `.env.example` | Variables de entorno de ejemplo. Copiar a `.env` (que no se sube a git). |
| `frontend/` | La única aplicación web del proyecto, con su propio `Dockerfile`. Solo habla con el **gateway**, nunca directo con los microservicios. |
| `gateway/` | Punto de entrada único (Nginx). Recibe las peticiones del frontend y las reparte al microservicio correspondiente según la ruta (ej. `/api/productos/` → servicio de productos). No contiene lógica de negocio, solo configuración. |
| `microservicios/` | Un subdirectorio por microservicio (`microservicios/<servicio>/`). Cada uno es independiente: su propio lenguaje, `Dockerfile`, dependencias, `migrations/` (tablas) y `seeds/` (datos de prueba). |
| `infra/` | Configuración del entorno que no es lógica de negocio. Hoy solo `infra/db/init/01-esquemas.sql`, que crea un esquema y un usuario por microservicio en PostgreSQL. A futuro: mensajería, monitoreo, etc. |
| `scripts/` | Utilidades para el equipo: cargar seeds, exportar y restaurar backups de la BD. |

## Inicio rápido

Requisito: Docker Desktop abierto.

```bash
cp .env.example .env
docker compose up -d          # levantar
docker compose down           # detener (los datos se conservan)
docker compose down -v        # detener y BORRAR la BD (se recrea desde cero al volver a levantar)
```

Los scripts de `scripts/` son de bash: en Windows ejecutarlos desde **Git Bash** (ej. `./scripts/cargar-seeds.sh`).

---

# Base de datos

## 1. Cómo está organizada

- **Un solo PostgreSQL 16 en Docker** (contenedor `ecommerce-db`), con una base llamada `ecommerce`.
- Dentro de esa base hay **un esquema por microservicio** (no por persona), cada uno con su propio usuario:

```
Base de datos: ecommerce
├── esquema productos   ← solo lo usa el usuario "productos"
├── esquema pedidos     ← solo lo usa el usuario "pedidos"
└── esquema usuarios    ← solo lo usa el usuario "usuarios"
   (nombres de ejemplo: los módulos aún no están definidos)
```

- El **código** de un microservicio solo puede acceder a su esquema. Si `pedidos` intenta leer las tablas de `productos`, PostgreSQL responde `permission denied`. Si necesita esos datos, se los pide al servicio `productos` **por API**.
- Las **personas** sí ven todo: el usuario `admin` tiene acceso a todos los esquemas para consultarlos.

## 2. Cada computadora tiene su propia BD completa

Cada participante, al ejecutar `docker compose up -d`, crea en **su computadora** la base `ecommerce` con **todos** los esquemas:

```
PC participante 1           PC participante 2           PC participante 3
ecommerce                   ecommerce                   ecommerce
├── productos               ├── productos               ├── productos
├── pedidos                 ├── pedidos                 ├── pedidos
└── usuarios                └── usuarios                └── usuarios
```

- Los datos se guardan en el volumen Docker `db-data` de esa computadora (dentro del disco de Docker Desktop, no en la carpeta del proyecto ni en git).
- Sobreviven a apagar el PC y a `docker compose down`. Solo se borran con `docker compose down -v`.
- **Lo que inserta un participante en su BD no lo ven los demás.** No hay BD compartida en vivo.

Para que todos tengan **la misma estructura y los mismos datos**, se comparten por git las *instrucciones* para crearlos, no los datos:

| Qué se comparte | Dónde | Cuándo se aplica |
|---|---|---|
| Esquemas y usuarios | `infra/db/init/01-esquemas.sql` | Automático, la primera vez que se crea la BD |
| Tablas | `microservicios/<servicio>/migrations/` | Cada microservicio las aplica al arrancar |
| Datos de prueba | `microservicios/<servicio>/seeds/` | Con `./scripts/cargar-seeds.sh` |
| Copia completa (opcional) | `infra/db/backup.sql` | Con `./scripts/restaurar.sh` |

Flujo normal al empezar el día:

```bash
git pull
docker compose up -d                 # migraciones nuevas se aplican al arrancar cada servicio
./scripts/cargar-seeds.sh            # datos de prueba nuevos que hayan subido otros
```

## 3. Esquemas: cómo se crean

El archivo `infra/db/init/01-esquemas.sql` se ejecuta **solo la primera vez** que se crea la BD. Por cada microservicio tiene estas líneas (hay una plantilla comentada):

```sql
CREATE USER productos WITH PASSWORD 'productos';
CREATE SCHEMA productos AUTHORIZATION productos;
ALTER ROLE productos SET search_path = productos;
```

Cuando alguien agrega un microservicio nuevo a este archivo, los demás deben **recrear su BD** para que se ejecute de nuevo:

```bash
git pull
docker compose down -v && docker compose up -d
./scripts/cargar-seeds.sh
```

## 4. Migraciones: las tablas

- Cada microservicio crea y modifica **sus tablas** con archivos en `microservicios/<servicio>/migrations/`, usando la herramienta de su lenguaje (Flyway, Alembic, golang-migrate, Prisma, etc.).
- Se ejecutan con el usuario del servicio, así que las tablas quedan en su esquema sin escribir el prefijo.
- **Nunca crear ni modificar tablas a mano en pgAdmin**: si lo haces, tu BD quedará distinta a la de los demás.
- Para cambiar una tabla existente se crea una **migración nueva**; no se editan las que ya se subieron a git.

## 5. Seeds: datos de prueba compartidos

Los seeds son archivos `.sql` con `INSERT`s en `microservicios/<servicio>/seeds/`. Así todos tienen los mismos productos, usuarios, etc. de prueba.

Ejemplo `microservicios/productos/seeds/01-productos.sql`:

```sql
INSERT INTO productos (id, nombre, precio) VALUES
  (1, 'Camiseta', 15.00),
  (2, 'Zapatos',  45.00)
ON CONFLICT (id) DO NOTHING;
```

Reglas:
- Escribir las tablas **sin prefijo de esquema** (`productos`, no `productos.productos`): el script los ejecuta con el usuario del servicio.
- Usar `ON CONFLICT ... DO NOTHING` para que se puedan cargar varias veces sin errores ni duplicados.
- Nombrar con prefijo numérico (`01-`, `02-`): se ejecutan en orden alfabético.
- Las tablas deben existir antes (las crean las migraciones del servicio).
- ¿Necesitas un dato de prueba nuevo que deban tener todos? Agrégalo al seed y súbelo a git, no lo insertes a mano.

Cargarlos:

```bash
./scripts/cargar-seeds.sh             # todos los microservicios
./scripts/cargar-seeds.sh productos   # solo uno
```

## 6. Backup: copia completa de la BD (opcional)

Para casos puntuales, por ejemplo pasar a todos un set de datos ya armado para una demo:

```bash
./scripts/backup.sh       # quien tiene los datos: exporta todo a infra/db/backup.sql
./scripts/restaurar.sh    # los demás: reemplazan su BD local con ese archivo
```

- `restaurar.sh` **borra y reemplaza** los datos locales de los esquemas incluidos en el backup.
- Los usuarios y esquemas deben existir (los crea el script de init), así que todos deben tener el mismo `01-esquemas.sql`.
- Un backup hecho antes de una migración nueva puede no coincidir con las tablas actuales.
- Por eso, para el día a día se usan **seeds**; el backup es solo para compartir una foto puntual. Avisar al equipo antes de subir un `backup.sql` a git para no pisarse.

## 7. Conectarse desde un microservicio

Cada microservicio recibe sus datos de conexión como variables de entorno desde `docker-compose.yml`:

| Variable | Valor dentro de Docker | Valor desde tu PC (fuera de Docker) |
|---|---|---|
| `DB_HOST` | `db` | `localhost` |
| Puerto | `5432` | `5433` |
| `DB_NAME` | `ecommerce` | `ecommerce` |
| `DB_USER` / `DB_PASSWORD` | `<servicio>` / `<servicio>` | igual |
| `DB_SCHEMA` | `<servicio>` | igual |

> Dentro de Docker el host es `db` (nombre del servicio en el compose), **no** `localhost`.

Ejemplos de cadena de conexión (servicio `productos`):

```text
Node / Go / Python:  postgres://productos:productos@db:5432/ecommerce?search_path=productos
Java (Spring):       jdbc:postgresql://db:5432/ecommerce?currentSchema=productos
```

Las herramientas de migraciones deben usar ese mismo usuario y esquema.

## 8. Ver la BD con pgAdmin o la terminal

**pgAdmin**

1. Clic derecho en *Servers* → *Register* → *Server…*
2. Pestaña *General*: nombre `ecommerce-docker`.
3. Pestaña *Connection*: host `localhost`, puerto `5433`, base `ecommerce`, usuario `admin`, contraseña `admin`.
4. Navegar a *ecommerce-docker → Databases → ecommerce → Schemas → `<servicio>` → Tables*.
5. Para ver datos: clic derecho en una tabla → *View/Edit Data* → *All Rows*.

Si no aparece algo nuevo, clic derecho → *Refresh*. pgAdmin es solo para **ver**; las tablas se cambian con migraciones y los datos de prueba con seeds.

> Se usa el puerto **5433** para no chocar con un PostgreSQL instalado en Windows (que usa el 5432). Si en pgAdmin ya tienes un servidor en 5432, ese es tu PostgreSQL local, **no** el del proyecto.

**Terminal (psql dentro del contenedor)**

```bash
docker exec -it ecommerce-db psql -U admin -d ecommerce
```

```sql
\dn                          -- listar esquemas
\dt <servicio>.*             -- listar tablas de un esquema
\d <servicio>.<tabla>        -- ver columnas de una tabla
SELECT * FROM <servicio>.<tabla> LIMIT 10;
\du                          -- listar usuarios
\q                           -- salir
```

## 9. Problemas comunes

| Problema | Causa / solución |
|---|---|
| `failed to connect to the docker API` | Docker Desktop no está abierto. |
| `port is already allocated` en 5433 | Otro programa usa el puerto: cambiar `POSTGRES_PORT` en `.env`. |
| No aparece el esquema de un servicio nuevo | El script de init solo corre la primera vez: `docker compose down -v && docker compose up -d`. |
| `permission denied for schema ...` | Un servicio intenta leer el esquema de otro. Debe pedir los datos por API. |
| `relation ... does not exist` al cargar seeds | Faltan las tablas: levantar el servicio para que corra sus migraciones primero. |
| Mi BD está rota o desordenada | `docker compose down -v && docker compose up -d` y `./scripts/cargar-seeds.sh`. |

---

## Reglas del equipo

1. **Nunca crear ni modificar tablas a mano** (pgAdmin, DBeaver). Todo cambio de tablas va en `microservicios/<servicio>/migrations/`.
2. **Los datos de prueba compartidos van en seeds**, no insertados a mano.
3. **Un microservicio no accede al esquema de otro.** Se comunican por API.
4. **El frontend solo llama al gateway.**
5. Cada microservicio debe poder construirse solo con su `Dockerfile`.
6. Las credenciales van en `.env`, no en el código.

## Agregar un microservicio

1. Crear `microservicios/<nombre>/` con su `Dockerfile`, `migrations/` y `seeds/`.
2. Agregar su usuario y esquema en `infra/db/init/01-esquemas.sql` (plantilla comentada) y recrear la BD: `docker compose down -v && docker compose up -d`.
3. Agregar el servicio en `docker-compose.yml` (plantilla comentada).
4. Agregar su ruta en la configuración del `gateway/`.
5. Avisar al equipo para que hagan `git pull` y recreen su BD.
