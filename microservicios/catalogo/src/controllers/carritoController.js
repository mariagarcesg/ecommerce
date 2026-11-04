import { isValidObjectId } from 'mongoose';
import Carrito from '../models/carrito.js';
import Product from '../models/product.js';

// El carrito es de cada usuario: siempre se usa el id del token (req.user.id).
const MAX_PRODUCTOS = 50;

// {items: [{producto (con categoría), cantidad}], cupon}; los productos borrados no aparecen
const carritoDe = async (usuarioId) => {
  const carrito = await Carrito.findOne({ usuarioId }).populate({
    path: 'items.producto',
    populate: { path: 'category' }
  });
  if (!carrito) return { items: [], cupon: null };
  return { items: carrito.items.filter(it => it.producto), cupon: carrito.cupon };
};

export const getCarrito = async (req, res) => {
  try {
    res.json(await carritoDe(req.user.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /carrito {items: [{productoId, cantidad}], cupon} -> reemplaza el carrito completo
export const guardarCarrito = async (req, res) => {
  try {
    const { items = [], cupon = null } = req.body || {};
    if (!Array.isArray(items) || items.length > MAX_PRODUCTOS) {
      return res.status(400).json({ message: `El carrito admite hasta ${MAX_PRODUCTOS} productos distintos` });
    }

    // Se suman cantidades repetidas y se descartan ids inválidos o cantidades fuera de 1..99
    const cantidades = new Map();
    for (const it of items) {
      const cantidad = Number(it?.cantidad);
      if (!isValidObjectId(it?.productoId) || !Number.isInteger(cantidad) || cantidad < 1) continue;
      cantidades.set(String(it.productoId), Math.min(99, (cantidades.get(String(it.productoId)) || 0) + cantidad));
    }
    // Solo productos que existen en el catálogo
    const existentes = await Product.find({ _id: { $in: [...cantidades.keys()] } }, '_id');
    const validos = new Set(existentes.map(p => String(p._id)));

    await Carrito.updateOne(
      { usuarioId: req.user.id },
      {
        items: [...cantidades].filter(([id]) => validos.has(id)).map(([producto, cantidad]) => ({ producto, cantidad })),
        cupon: typeof cupon === 'string' && cupon.trim() ? cupon.trim().toUpperCase().slice(0, 20) : null
      },
      { upsert: true }
    );
    res.json(await carritoDe(req.user.id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
