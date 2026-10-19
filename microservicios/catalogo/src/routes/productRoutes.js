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

productsRouter.get('/', authenticate, authorize('cliente', 'admin'), getProducts);
productsRouter.get('/category/:categoryId', authenticate, authorize('cliente', 'admin'), getProductsByCategory);
productsRouter.get('/:id', authenticate, authorize('cliente', 'admin'), getProductById);
productsRouter.post('/', authenticate, authorize('admin'), createProduct);
productsRouter.put('/:id', authenticate, authorize('admin'), updateProduct);
productsRouter.delete('/:id', authenticate, authorize('admin'), deleteProduct);
productsRouter.patch('/:id/stock', authenticate, authorize('admin'), updateStock);

export default productsRouter;