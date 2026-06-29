import { User, Customer, BeerStyle, Sale } from './entities';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  listAll(): Promise<User[]>;
}

export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByFiscalId(fiscalId: string): Promise<Customer | null>;
  create(customer: Customer): Promise<void>;
  update(customer: Customer): Promise<void>;
  delete(id: string): Promise<void>;
  listAll(): Promise<Customer[]>;
  search(query: string): Promise<Customer[]>;
}

export interface IBeerStyleRepository {
  findById(id: string): Promise<BeerStyle | null>;
  findByName(name: string): Promise<BeerStyle | null>;
  create(beerStyle: BeerStyle): Promise<void>;
  update(beerStyle: BeerStyle): Promise<void>;
  delete(id: string): Promise<void>;
  listAll(): Promise<BeerStyle[]>;
  updateStock(id: string, newStock: number): Promise<void>;
}

export interface ISystemSettingsRepository {
  getVal(key: string): Promise<string | null>;
  setVal(key: string, value: string, description?: string): Promise<void>;
}

export interface ISaleRepository {
  createMany(sales: Sale[]): Promise<void>;
  listAll(): Promise<Sale[]>;
  getSellerPerformance(month?: string): Promise<{ sellerId: string; sellerName: string; totalRevenue: number; transactionCount: number }[]>;
  updatePaymentStatus(id: number, status: 'pagado' | 'pendiente'): Promise<void>;
}

// Interfaz para manejar transacciones atómicas
export interface IDatabaseTransaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
