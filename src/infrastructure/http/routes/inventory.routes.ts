import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();

  // Todos los usuarios autenticados pueden ver el inventario y leer los settings
  router.get('/', authenticateToken, controller.listStyles);
  router.get('/settings', authenticateToken, controller.getSettings);

  // Solo los Administradores de 3 Lobos pueden editar el catálogo de estilos o modificar variables
  router.post('/', authenticateToken, authorizeRoles('admin'), controller.createStyle);
  router.put('/settings', authenticateToken, authorizeRoles('admin'), controller.updateSettings);
  router.put('/:id', authenticateToken, authorizeRoles('admin', 'vendedor'), controller.updateStyle);
  router.put('/:id/favorite', authenticateToken, authorizeRoles('admin'), controller.toggleFavorite);
  router.delete('/:id', authenticateToken, authorizeRoles('admin'), controller.deleteStyle);

  return router;
}
