"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
class CustomerService {
    customerRepository;
    constructor(customerRepository) {
        this.customerRepository = customerRepository;
    }
    /**
     * Registra una nueva ficha de cliente corporativo (restaurante).
     */
    async createCustomer(data) {
        if (!data.businessName || !data.fiscalId) {
            throw new Error('El nombre de negocio e identificación fiscal son requeridos');
        }
        const existingCustomer = await this.customerRepository.findByFiscalId(data.fiscalId);
        if (existingCustomer) {
            throw new Error(`Ya existe un cliente registrado con la identificación fiscal: ${data.fiscalId}`);
        }
        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const newCustomer = {
            id,
            businessName: data.businessName,
            fiscalId: data.fiscalId,
            phone: data.phone || '',
            customerType: 'wholesale', // Por defecto, si se registra en este módulo, es cliente corporativo mayorista
            createdAt: new Date()
        };
        await this.customerRepository.create(newCustomer);
        return newCustomer;
    }
    /**
     * Modifica una ficha de cliente corporativo.
     */
    async updateCustomer(id, data) {
        const customer = await this.customerRepository.findById(id);
        if (!customer) {
            throw new Error('El cliente no existe');
        }
        if (data.fiscalId && data.fiscalId !== customer.fiscalId) {
            const existing = await this.customerRepository.findByFiscalId(data.fiscalId);
            if (existing) {
                throw new Error(`Ya existe otro cliente registrado con la identificación fiscal: ${data.fiscalId}`);
            }
            customer.fiscalId = data.fiscalId;
        }
        if (data.businessName !== undefined)
            customer.businessName = data.businessName;
        if (data.phone !== undefined)
            customer.phone = data.phone;
        if (data.customerType !== undefined)
            customer.customerType = data.customerType;
        await this.customerRepository.update(customer);
        return customer;
    }
    /**
     * Devuelve la lista completa de clientes registrados.
     */
    async listCustomers() {
        return this.customerRepository.listAll();
    }
    /**
     * Busca clientes que coincidan con un texto (nombre comercial o identificación fiscal).
     */
    async searchCustomers(query) {
        if (!query || query.trim() === '') {
            return this.customerRepository.listAll();
        }
        return this.customerRepository.search(query.trim());
    }
    /**
     * Elimina un cliente corporativo.
     */
    async deleteCustomer(id) {
        const customer = await this.customerRepository.findById(id);
        if (!customer) {
            throw new Error('El cliente no existe');
        }
        await this.customerRepository.delete(id);
    }
}
exports.CustomerService = CustomerService;
