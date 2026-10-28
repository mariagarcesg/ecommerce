import { Schema, model } from 'mongoose';

const categorySchema = new Schema(
    {
        name: {type: String, required: true, unique: true, trim: true},
        description: {type: String, trim: true}
    }
)

const Category = model('Category', categorySchema)

export default Category;