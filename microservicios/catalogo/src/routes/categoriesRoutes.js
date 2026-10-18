import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';

const categoriesRouter = express.Router();

categoriesRouter.get('/', getCategories);
categoriesRouter.get('/:id', getCategoryById);
categoriesRouter.post('/', createCategory);
categoriesRouter.put('/:id', updateCategory);
categoriesRouter.delete('/:id', deleteCategory);

export default categoriesRouter;