import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const categoriesRouter = express.Router();

categoriesRouter.get('/', authenticate, authorize('cliente', 'admin'), getCategories);
categoriesRouter.get('/:id', authenticate, authorize('cliente', 'admin'), getCategoryById);
categoriesRouter.post('/', authenticate, authorize('admin'), createCategory);
categoriesRouter.put('/:id', authenticate, authorize('admin'), updateCategory);
categoriesRouter.delete('/:id', authenticate, authorize('admin'), deleteCategory);

export default categoriesRouter;