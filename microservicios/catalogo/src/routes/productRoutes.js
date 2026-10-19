import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  updateStock
} from '../controllers/productController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const productsRouter = express.Router();

// Públicas: cualquiera puede ver los productos, con o sin sesión
productsRouter.get('/', getProducts);
productsRouter.get('/category/:categoryId', getProductsByCategory);
productsRouter.get('/:id', getProductById);

// Solo admin puede modificar
productsRouter.post('/', authenticate, authorize('admin'), createProduct);
productsRouter.put('/:id', authenticate, authorize('admin'), updateProduct);
productsRouter.delete('/:id', authenticate, authorize('admin'), deleteProduct);
productsRouter.patch('/:id/stock', authenticate, authorize('admin'), updateStock);

export default productsRouter;