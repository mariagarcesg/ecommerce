import express from 'express';
import { getFavoritos, agregarFavorito, quitarFavorito } from '../controllers/favoritoController.js';
import { authenticate } from '../middleware/auth.js';

const favoritosRouter = express.Router();

// Todas exigen sesión: cada usuario solo ve y modifica su propia lista
favoritosRouter.use(authenticate);
favoritosRouter.get('/', getFavoritos);
favoritosRouter.put('/:productoId', agregarFavorito);
favoritosRouter.delete('/:productoId', quitarFavorito);

export default favoritosRouter;
