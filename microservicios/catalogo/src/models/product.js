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
        description: String
    }
)

const Product = model('Product', productSchema)

export default Product;