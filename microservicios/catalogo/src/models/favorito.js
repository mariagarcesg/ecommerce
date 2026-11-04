import { Schema, model } from 'mongoose';

// Lista de deseos de un usuario: un documento por usuario de auth (id del token)
const favoritoSchema = new Schema(
    {
        usuarioId: {type: String, required: true, unique: true},
        productos: [{type: Schema.Types.ObjectId, ref: 'Product'}]
    }
)

const Favorito = model('Favorito', favoritoSchema)

export default Favorito;
