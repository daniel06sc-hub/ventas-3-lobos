import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUserPayload, UserRole } from '../../../domain/entities';

const JWT_SECRET = process.env.JWT_SECRET || '3lobos-super-secret-key-123!';

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

/**
 * Middleware para autenticar el JWT de sesión en las cabeceras HTTP.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Sesión expirada o token inválido.' });
  }
}

/**
 * Middleware para requerir roles específicos (RBAC).
 */
export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso restringido. Se requiere el rol de: ${allowedRoles.join(' o ')}. Tu rol actual es: ${req.user.role}`
      });
    }

    next();
  };
}
