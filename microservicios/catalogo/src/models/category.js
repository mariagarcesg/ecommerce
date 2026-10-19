import { Schema, model } from 'mongoose';

const categorySchema = new Schema(
    {
        name: {type: String, required: true, unique: true},
        description: String
    }
)

const Category = model('Category', categorySchema)

export default Category;