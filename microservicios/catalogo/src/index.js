
import path from 'path'
const projectDotenvPath = path.join(__dirname, "..", "..", "..", ".env")
require('dotenv').config({ path: path.resolve(projectDotenvPath)});
import express, { json } from 'express';
import cors from 'cors';
import connectDB from './config/db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(json());

connectDB();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'catalogo' });
});

app.listen(PORT, () => {
  console.log(`Servicio de catálogo corriendo en puerto ${CATALOGO_PORT}`);
});
