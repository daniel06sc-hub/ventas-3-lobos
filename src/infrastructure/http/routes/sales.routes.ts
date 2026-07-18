import { Router } from 'express';
import { SalesController } from '../controllers/sales.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

export function createSalesRouter(controller: SalesController): Router {
  const router = Router();

  // El checkout está habilitado para vendedores y administradores en el punto de venta
  router.post('/checkout', authenticateToken, controller.checkout);

  // El historial de auditoría de ventas es de uso exclusivo del Administrador
  router.get('/history', authenticateToken, authorizeRoles('admin'), controller.history);

  // Permitir a vendedores y administradores actualizar el estado de pago de las cuentas
  router.put('/:id/payment', authenticateToken, controller.updatePaymentStatus);

  // Permitir a administradores eliminar una transacción de venta agrupada por su correlativo y reponer stock
  router.delete('/transaction/:correlationId', authenticateToken, authorizeRoles('admin'), controller.deleteTransaction);

  return router;
}
