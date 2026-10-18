
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import express, { json } from 'express';
import cors from 'cors';
import connectDB from './config/db';
import productsRouter from './routes/productRoutes.js';
import categoriesRouter from './routes/categoriesRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDotenvPath = path.join(__dirname, '..', '..', '..', '.env');
config({ path: path.resolve(projectDotenvPath) });

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
