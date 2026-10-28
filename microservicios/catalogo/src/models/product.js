import { Schema, model } from 'mongoose';

const productSchema = new Schema(
    {
        name: {type: String, required: true},
        price: {type: Number, required: true, min:0},
        stock: {type: Number, required: true, min:0},
        category: {type: Schema.Types.ObjectId, ref: 'Category', required: true},
        sizes: [String],
        colors: [String],
        details: [String],
        description: String,
        // URL externa (http/https) o una foto subida desde el panel (/api/catalogo/uploads/...)
        imagen: {
            type: String,
            trim: true,
            match: [/^(https?:\/\/|\/api\/catalogo\/uploads\/)/, 'La imagen debe ser una URL http(s) o una foto subida']
        }
    }
)

const Product = model('Product', productSchema)

export default Product;