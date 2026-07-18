import { ICustomerRepository } from '../domain/repositories';
import { Customer } from '../domain/entities';

export class CustomerService {
  constructor(private customerRepository: ICustomerRepository) {}

  /**
   * Registra una nueva ficha de cliente corporativo (restaurante).
   */
  async createCustomer(data: {
    businessName: string;
    fiscalId: string;
    phone?: string;
    contactName?: string;
    address?: string;
    ivaPercent?: number;
    ilaPercent?: number;
  }): Promise<Customer> {
    if (!data.businessName || !data.fiscalId) {
      throw new Error('El nombre de negocio e identificación fiscal son requeridos');
    }

    const existingCustomer = await this.customerRepository.findByFiscalId(data.fiscalId);
    if (existingCustomer) {
      throw new Error(`Ya existe un cliente registrado con la identificación fiscal: ${data.fiscalId}`);
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    const newCustomer: Customer = {
      id,
      businessName: data.businessName,
      fiscalId: data.fiscalId,
      phone: data.phone || '',
      contactName: data.contactName || '',
      address: data.address || '',
      ivaPercent: data.ivaPercent !== undefined ? Number(data.ivaPercent) : 19.0,
      ilaPercent: data.ilaPercent !== undefined ? Number(data.ilaPercent) : 0.0,
      customerType: 'wholesale', // Por defecto es wholesale para restaurantes
      createdAt: new Date()
    };

    await this.customerRepository.create(newCustomer);
    return newCustomer;
  }

  /**
   * Modifica una ficha de cliente corporativo.
   */
  async updateCustomer(
    id: string,
    data: Partial<Omit<Customer, 'id' | 'createdAt'>>
  ): Promise<Customer> {
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

    if (data.businessName !== undefined) customer.businessName = data.businessName;
    if (data.phone !== undefined) customer.phone = data.phone;
    if (data.contactName !== undefined) customer.contactName = data.contactName;
    if (data.address !== undefined) customer.address = data.address;
    if (data.ivaPercent !== undefined) customer.ivaPercent = Number(data.ivaPercent);
    if (data.ilaPercent !== undefined) customer.ilaPercent = Number(data.ilaPercent);
    if (data.customerType !== undefined) customer.customerType = data.customerType;

    await this.customerRepository.update(customer);
    return customer;
  }

  /**
   * Devuelve la lista completa de clientes registrados.
   */
  async listCustomers(): Promise<Customer[]> {
    return this.customerRepository.listAll();
  }

  /**
   * Busca clientes que coincidan con un texto (nombre comercial o identificación fiscal).
   */
  async searchCustomers(query: string): Promise<Customer[]> {
    if (!query || query.trim() === '') {
      return this.customerRepository.listAll();
    }
    return this.customerRepository.search(query.trim());
  }

  /**
   * Elimina un cliente corporativo.
   */
  async deleteCustomer(id: string): Promise<void> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new Error('El cliente no existe');
    }
    await this.customerRepository.delete(id);
  }
}
