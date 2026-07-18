import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  // Ruta pública para iniciar sesión
  router.post('/login', controller.login);

  // Registro, consulta, modificación y eliminación de usuarios (administradores y supervisores)
  router.post('/register', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.register);
  router.get('/users', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.listUsers);
  router.put('/users/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.updateUser);
  router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), controller.deleteUser);

  return router;
}
