import Category from '../models/category.js';
import Product from '../models/product.js';

// "gaming" y "Gaming" (o "Electronica" y "Electrónica") cuentan como el mismo nombre
const sinMayusculasNiTildes = { locale: 'es', strength: 1 };

// Solo se aceptan nombre y descripción; el resto del body se ignora
const leerCategoria = (body) => ({
  name: typeof body.name === 'string' ? body.name.trim() : '',
  description: typeof body.description === 'string' ? body.description.trim() : ''
});

// Devuelve null si es válida, o { status, message } con el error a responder
const validarCategoria = async ({ name }, idActual = null) => {
  if (!name) return { status: 400, message: 'El nombre de la categoría es obligatorio' };
  if (name.length > 60) return { status: 400, message: 'El nombre no puede tener más de 60 caracteres' };
  const repetida = await Category.findOne({ name }).collation(sinMayusculasNiTildes);
  if (repetida && String(repetida._id) !== String(idActual)) {
    return { status: 409, message: `Ya existe la categoría "${repetida.name}"` };
  }
  return null;
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const datos = leerCategoria(req.body);
    const error = await validarCategoria(datos);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }
    const savedCategory = await new Category(datos).save();
    res.status(201).json(savedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const datos = leerCategoria(req.body);
    const error = await validarCategoria(datos, req.params.id);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      datos,
      { new: true, runValidators: true }
    );
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    res.json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// No se borra una categoría con productos: quedarían apuntando a una categoría inexistente
export const deleteCategory = async (req, res) => {
  try {
    const enUso = await Product.countDocuments({ category: req.params.id });
    if (enUso > 0) {
      return res.status(409).json({
        message: `No se puede eliminar: tiene ${enUso} producto${enUso === 1 ? '' : 's'}. Muévelos a otra categoría o elimínalos primero.`
      });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
