import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// Carpeta de imágenes subidas desde el panel. En Docker es el volumen catalogo-uploads.
export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || 'uploads');
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024; // 2 MB

// Se identifica el formato por los primeros bytes del archivo, no por el
// Content-Type que manda el navegador (se puede falsear).
const FORMATOS = [
  { ext: 'jpg', esDelTipo: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', esDelTipo: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', esDelTipo: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' }
];

// POST /uploads (cuerpo = la imagen en binario) -> 201 { url }
// La url es relativa al gateway, lista para guardarla en product.imagen.
export const subirImagen = async (req, res) => {
  try {
    const archivo = req.body;
    if (!Buffer.isBuffer(archivo) || archivo.length === 0) {
      return res.status(400).json({ message: 'Envía una imagen JPG, PNG o WebP.' });
    }
    const formato = FORMATOS.find(f => f.esDelTipo(archivo));
    if (!formato) {
      return res.status(400).json({ message: 'El archivo no es una imagen JPG, PNG o WebP válida.' });
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const nombre = `${randomUUID()}.${formato.ext}`;
    await writeFile(path.join(UPLOADS_DIR, nombre), archivo);
    res.status(201).json({ url: `/api/catalogo/uploads/${nombre}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
