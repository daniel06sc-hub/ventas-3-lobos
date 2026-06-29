import { Request, Response } from 'express';
import { CustomerService } from '../../../application/customer.service';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  listOrSearchCustomers = async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const customers = await this.customerService.searchCustomers(query || '');
      return res.status(200).json(customers);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al listar clientes' });
    }
  };

  createCustomer = async (req: Request, res: Response) => {
    try {
      const customer = await this.customerService.createCustomer(req.body);
      return res.status(201).json(customer);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al registrar cliente' });
    }
  };

  updateCustomer = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await this.customerService.updateCustomer(id, req.body);
      return res.status(200).json(updated);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al actualizar cliente' });
    }
  };

  deleteCustomer = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.customerService.deleteCustomer(id);
      return res.status(200).json({ message: 'Cliente eliminado exitosamente' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al eliminar cliente' });
    }
  };
}
