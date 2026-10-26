import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET no está configurado');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    
    req.user = {
      id: decoded.sub,
      nombre: decoded.nombre,
      rol: decoded.rol
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    console.error('Error de autenticación:', error);
    return res.status(500).json({ error: 'Error de autenticación' });
  }
};
