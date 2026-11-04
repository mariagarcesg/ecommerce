import express from 'express';
import { getCarrito, guardarCarrito } from '../controllers/carritoController.js';
import { authenticate } from '../middleware/auth.js';

const carritoRouter = express.Router();

// Todas exigen sesión: cada usuario solo ve y modifica su propio carrito
carritoRouter.use(authenticate);
carritoRouter.get('/', getCarrito);
carritoRouter.put('/', guardarCarrito);

export default carritoRouter;
