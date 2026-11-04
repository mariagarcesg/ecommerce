import { Schema, model } from 'mongoose';

// Carrito de compras de un usuario: un documento por usuario de auth (id del token)
const carritoSchema = new Schema(
    {
        usuarioId: {type: String, required: true, unique: true},
        items: [
            {
                _id: false,
                producto: {type: Schema.Types.ObjectId, ref: 'Product', required: true},
                cantidad: {type: Number, required: true, min: 1, max: 99}
            }
        ],
        // Código del cupón aplicado; ordenes lo valida de nuevo al pagar
        cupon: {type: String, default: null}
    }
)

const Carrito = model('Carrito', carritoSchema)

export default Carrito;
