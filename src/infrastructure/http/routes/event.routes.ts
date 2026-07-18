import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

export function createEventRouter(controller: EventController): Router {
  const router = Router();

  // Todos los usuarios autenticados pueden ver la lista de eventos
  router.get('/', authenticateToken, controller.listEvents);

  // Solo Administradores y Supervisores pueden crear, modificar o eliminar eventos
  router.post('/', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.createEvent);
  router.put('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.updateEvent);
  router.delete('/:id', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.deleteEvent);

  // Gestión de productos por evento (Caja Rápida de Festival)
  router.get('/:eventId/products', authenticateToken, controller.listEventProducts);
  router.post('/:eventId/products', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.addEventProduct);
  router.put('/:eventId/products/:productId', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.updateEventProduct);
  router.delete('/:eventId/products/:productId', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.deleteEventProduct);

  return router;
}
