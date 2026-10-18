import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { json } from 'express';
import cors from 'cors';
import connectDB from './config/db.js';

// Fuera de Docker toma las variables del .env de la raíz del proyecto.
// Dentro de Docker ese archivo no existe y las variables llegan desde docker-compose.yml.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const app = express();
const PORT = process.env.CATALOGO_PORT || 3000;

app.use(cors());
app.use(json());

connectDB();

app.get('/api/catalogo/health', (req, res) => {
  res.json({ status: 'ok', service: 'catalogo' });
});
app.use('/api/catalogo/products', productsRouter)
app.use('/api/catalogo/categories', categoriesRouter)

app.listen(PORT, () => {
  console.log(`Servicio de catálogo corriendo en puerto ${PORT}`);
});
