import express from 'express';
import { subirImagen, UPLOADS_DIR, MAX_BYTES_IMAGEN } from '../controllers/uploadController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const uploadsRouter = express.Router();

// Pública: las fotos de los productos las ve cualquiera
uploadsRouter.use(express.static(UPLOADS_DIR, {
  maxAge: '7d',
  setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff')
}));

// Solo admin puede subir. El cuerpo llega en binario con Content-Type image/*
uploadsRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  express.raw({ type: 'image/*', limit: MAX_BYTES_IMAGEN }),
  subirImagen
);

// Imagen de más de 2 MB: JSON en vez de la página de error de Express
uploadsRouter.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La imagen pesa más de 2 MB. Usa una más liviana.' });
  }
  next(err);
});

export default uploadsRouter;
