import { isValidObjectId } from 'mongoose';
import Favorito from '../models/favorito.js';
import Product from '../models/product.js';

// La lista de deseos es de cada usuario: siempre se usa el id del token
// (req.user.id), nunca uno que venga en la petición.

// Productos de la lista con su categoría; los que se borraron del catálogo no aparecen
const listaDe = async (usuarioId) => {
  const favorito = await Favorito.findOne({ usuarioId }).populate({
    path: 'productos',
    populate: { path: 'category' }
  });
  return favorito ? favorito.productos.filter(Boolean) : [];
};

export const getFavoritos = async (req, res) => {
  try {
    res.json(await listaDe(req.user.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /favoritos/:productoId -> lo agrega (si ya estaba, no se repite)
export const agregarFavorito = async (req, res) => {
  try {
    const { productoId } = req.params;
    if (!isValidObjectId(productoId) || !(await Product.exists({ _id: productoId }))) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    await Favorito.updateOne(
      { usuarioId: req.user.id },
      { $addToSet: { productos: productoId } },
      { upsert: true }
    );
    res.json(await listaDe(req.user.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /favoritos/:productoId -> lo quita de la lista
export const quitarFavorito = async (req, res) => {
  try {
    const { productoId } = req.params;
    if (isValidObjectId(productoId)) {
      await Favorito.updateOne({ usuarioId: req.user.id }, { $pull: { productos: productoId } });
    }
    res.json(await listaDe(req.user.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
