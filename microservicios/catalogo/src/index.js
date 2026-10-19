import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { json } from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import productsRouter from './routes/productRoutes.js';
import categoriesRouter from './routes/categoriesRoutes.js';

// Fuera de Docker toma las variables del .env de la raíz del proyecto.
// Dentro de Docker ese archivo no existe y las variables llegan desde docker-compose.yml.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const app = express();
// CATALOGO_PORT (del .env en desarrollo local) o PORT (el que pasa docker-compose)
const PORT = process.env.CATALOGO_PORT || process.env.PORT || 3000;

app.use(cors());
app.use(json());

connectDB();

// Rutas sin el prefijo /api/catalogo: el gateway lo quita antes de reenviar
// (http://localhost:8080/api/catalogo/products -> catalogo:3000/products).
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'catalogo' });
});
app.use('/products', productsRouter);
app.use('/categories', categoriesRouter);

app.listen(PORT, () => {
  console.log(`Servicio de catálogo corriendo en puerto ${PORT}`);
});
