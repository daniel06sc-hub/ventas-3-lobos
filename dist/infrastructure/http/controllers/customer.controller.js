"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
class CustomerController {
    customerService;
    constructor(customerService) {
        this.customerService = customerService;
    }
    listOrSearchCustomers = async (req, res) => {
        try {
            const query = req.query.q;
            const customers = await this.customerService.searchCustomers(query || '');
            return res.status(200).json(customers);
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al listar clientes' });
        }
    };
    createCustomer = async (req, res) => {
        try {
            const customer = await this.customerService.createCustomer(req.body);
            return res.status(201).json(customer);
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al registrar cliente' });
        }
    };
    updateCustomer = async (req, res) => {
        try {
            const { id } = req.params;
            const updated = await this.customerService.updateCustomer(id, req.body);
            return res.status(200).json(updated);
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al actualizar cliente' });
        }
    };
    deleteCustomer = async (req, res) => {
        try {
            const { id } = req.params;
            await this.customerService.deleteCustomer(id);
            return res.status(200).json({ message: 'Cliente eliminado exitosamente' });
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al eliminar cliente' });
        }
    };
}
exports.CustomerController = CustomerController;
