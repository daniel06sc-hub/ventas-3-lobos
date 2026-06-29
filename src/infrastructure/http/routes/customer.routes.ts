import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

export function createCustomerRouter(controller: CustomerController): Router {
  const router = Router();

  // Tanto vendedores como administradores pueden registrar, listar o buscar clientes corporativos
  router.get('/', authenticateToken, controller.listOrSearchCustomers);
  router.post('/', authenticateToken, controller.createCustomer);
  router.put('/:id', authenticateToken, controller.updateCustomer);
  router.delete('/:id', authenticateToken, authorizeRoles('admin'), controller.deleteCustomer);

  return router;
}
