import Product from '../models/product.js';

export const getProducts = async (req, res) => {
  try {
    const { name, minPrice, maxPrice, minStock, maxStock } = req.query;
    
    const filter = {};
    
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
        filter.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined) {
        filter.price.$lte = parseFloat(maxPrice);
      }
    }
    
    if (minStock !== undefined || maxStock !== undefined) {
      filter.stock = {};
      if (minStock !== undefined) {
        filter.stock.$gte = parseInt(minStock);
      }
      if (maxStock !== undefined) {
        filter.stock.$lte = parseInt(maxStock);
      }
    }
    
    const products = await Product.find(filter).populate('category');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    const savedProduct = await product.save();
    const populatedProduct = await savedProduct.populate('category');
    res.status(201).json(populatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category');
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.categoryId }).populate('category');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
      return res.status(400).json({ message: 'La cantidad debe ser un número entero' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { stock: quantity } },
      { new: true, runValidators: true }
    ).populate('category');

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (product.stock < 0) {
      await Product.findByIdAndUpdate(req.params.id, { $inc: { stock: -quantity } });
      return res.status(400).json({ message: 'Stock insuficiente' });
    }

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
