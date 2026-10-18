import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory
} from '../controllers/productController.js';

const productsRouter = express.Router();

productsRouter.get('/', getProducts);
productsRouter.get('/category/:categoryId', getProductsByCategory);
productsRouter.get('/:id', getProductById);
productsRouter.post('/', createProduct);
productsRouter.put('/:id', updateProduct);
productsRouter.delete('/:id', deleteProduct);

export default productsRouter;