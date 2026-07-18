import { getDatabase, IDatabase } from '../../config/database';
import { User, Customer, BeerStyle, Sale, UserRole, CustomerType, SalesFormat } from '../../domain/entities';
import {
  IUserRepository,
  ICustomerRepository,
  IBeerStyleRepository,
  ISystemSettingsRepository,
  ISaleRepository
} from '../../domain/repositories';

// Helper de mapeo para Usuario
function mapUserRow(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role as UserRole,
    createdAt: new Date(row.created_at)
  };
}

// Helper de mapeo para Cliente
function mapCustomerRow(row: any): Customer {
  return {
    id: row.id,
    businessName: row.business_name,
    fiscalId: row.fiscal_id,
    phone: row.phone || '',
    customerType: row.customer_type as CustomerType,
    createdAt: new Date(row.created_at)
  };
}

// Helper de mapeo para Estilos de Cerveza
function mapBeerStyleRow(row: any): BeerStyle {
  return {
    id: row.id,
    name: row.name,
    stockBottles: row.stock_bottles,
    priceUnit: row.price_unit,
    pricePack2: row.price_pack2,
    pricePack3: row.price_pack3,
    pricePack4: row.price_pack4,
    priceWholesale: row.price_wholesale,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

// Helper de mapeo para Ventas
function mapSaleRow(row: any): Sale {
  return {
    id: row.id,
    correlationId: row.correlation_id,
    transactionDate: new Date(row.transaction_date),
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    beerStyleId: row.beer_style_id,
    beerStyleName: row.beer_style_name,
    formatSold: row.format_sold as SalesFormat,
    unitsSold: row.units_sold,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status as 'pagado' | 'pendiente'
  };
}

export class SQLiteUserRepository implements IUserRepository {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async findById(id: string): Promise<User | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM users WHERE id = ?', id);
    return row ? mapUserRow(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM users WHERE username = ?', username);
    return row ? mapUserRow(row) : null;
  }

  async create(user: User): Promise<void> {
    const db = await this.getDb();
    await db.run(
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      user.id,
      user.username,
      user.passwordHash,
      user.name,
      user.role
    );
  }

  async update(user: User): Promise<void> {
    const db = await this.getDb();
    await db.run(
      'UPDATE users SET username = ?, password_hash = ?, name = ?, role = ? WHERE id = ?',
      user.username,
      user.passwordHash,
      user.name,
      user.role,
      user.id
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.run('DELETE FROM users WHERE id = ?', id);
  }

  async listAll(): Promise<User[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM users ORDER BY name ASC');
    return rows.map(mapUserRow);
  }
}

export class SQLiteCustomerRepository implements ICustomerRepository {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async findById(id: string): Promise<Customer | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM customers WHERE id = ?', id);
    return row ? mapCustomerRow(row) : null;
  }

  async findByFiscalId(fiscalId: string): Promise<Customer | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM customers WHERE fiscal_id = ?', fiscalId);
    return row ? mapCustomerRow(row) : null;
  }

  async create(customer: Customer): Promise<void> {
    const db = await this.getDb();
    await db.run(
      'INSERT INTO customers (id, business_name, fiscal_id, phone, customer_type) VALUES (?, ?, ?, ?, ?)',
      customer.id,
      customer.businessName,
      customer.fiscalId,
      customer.phone,
      customer.customerType
    );
  }

  async update(customer: Customer): Promise<void> {
    const db = await this.getDb();
    await db.run(
      'UPDATE customers SET business_name = ?, fiscal_id = ?, phone = ?, customer_type = ? WHERE id = ?',
      customer.businessName,
      customer.fiscalId,
      customer.phone,
      customer.customerType,
      customer.id
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.run('DELETE FROM customers WHERE id = ?', id);
  }

  async listAll(): Promise<Customer[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM customers ORDER BY business_name ASC');
    return rows.map(mapCustomerRow);
  }

  async search(query: string): Promise<Customer[]> {
    const db = await this.getDb();
    const searchPattern = `%${query}%`;
    const rows = await db.all(
      'SELECT * FROM customers WHERE business_name LIKE ? OR fiscal_id LIKE ? ORDER BY business_name ASC',
      searchPattern,
      searchPattern
    );
    return rows.map(mapCustomerRow);
  }
}

export class SQLiteBeerStyleRepository implements IBeerStyleRepository {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async findById(id: string): Promise<BeerStyle | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM beer_styles WHERE id = ?', id);
    return row ? mapBeerStyleRow(row) : null;
  }

  async findByName(name: string): Promise<BeerStyle | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM beer_styles WHERE name = ?', name);
    return row ? mapBeerStyleRow(row) : null;
  }

  async create(beerStyle: BeerStyle): Promise<void> {
    const db = await this.getDb();
    await db.run(
      'INSERT INTO beer_styles (id, name, stock_bottles, price_unit, price_pack2, price_pack3, price_pack4, price_wholesale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      beerStyle.id,
      beerStyle.name,
      beerStyle.stockBottles,
      beerStyle.priceUnit,
      beerStyle.pricePack2,
      beerStyle.pricePack3,
      beerStyle.pricePack4,
      beerStyle.priceWholesale
    );
  }

  async update(beerStyle: BeerStyle): Promise<void> {
    const db = await this.getDb();
    await db.run(
      `UPDATE beer_styles SET 
        name = ?, 
        stock_bottles = ?, 
        price_unit = ?, 
        price_pack2 = ?, 
        price_pack3 = ?, 
        price_pack4 = ?, 
        price_wholesale = ?,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      beerStyle.name,
      beerStyle.stockBottles,
      beerStyle.priceUnit,
      beerStyle.pricePack2,
      beerStyle.pricePack3,
      beerStyle.pricePack4,
      beerStyle.priceWholesale,
      beerStyle.id
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.run('DELETE FROM beer_styles WHERE id = ?', id);
  }

  async listAll(): Promise<BeerStyle[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM beer_styles ORDER BY name ASC');
    return rows.map(mapBeerStyleRow);
  }

  async updateStock(id: string, newStock: number): Promise<void> {
    const db = await this.getDb();
    await db.run(
      'UPDATE beer_styles SET stock_bottles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      newStock,
      id
    );
  }
}

export class SQLiteSystemSettingsRepository implements ISystemSettingsRepository {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async getVal(key: string): Promise<string | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT value FROM system_settings WHERE key = ?', key);
    return row ? row.value : null;
  }

  async setVal(key: string, value: string, description?: string): Promise<void> {
    const db = await this.getDb();
    await db.run(
      `INSERT INTO system_settings (key, value, description, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET 
         value = excluded.value, 
         description = COALESCE(excluded.description, system_settings.description),
         updated_at = CURRENT_TIMESTAMP`,
      key,
      value,
      description || null
    );
  }
}

export class SQLiteSaleRepository implements ISaleRepository {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async createMany(sales: Sale[]): Promise<void> {
    const db = await this.getDb();
    const stmt = await db.prepare(
      `INSERT INTO sales (
        correlation_id, seller_id, seller_name, customer_id, customer_name,
        beer_style_id, beer_style_name, format_sold, units_sold, unit_price, total_amount, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const sale of sales) {
      await stmt.run(
        sale.correlationId,
        sale.sellerId,
        sale.sellerName,
        sale.customerId || null,
        sale.customerName,
        sale.beerStyleId,
        sale.beerStyleName,
        sale.formatSold,
        sale.unitsSold,
        sale.unitPrice,
        sale.totalAmount,
        sale.paymentStatus
      );
    }
    await stmt.finalize();
  }

  async listAll(): Promise<Sale[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM sales ORDER BY transaction_date DESC');
    return rows.map(mapSaleRow);
  }

  async getSellerPerformance(month?: string): Promise<{ sellerId: string; sellerName: string; totalRevenue: number; transactionCount: number }[]> {
    const db = await this.getDb();
    let query = `
      SELECT 
        seller_id as sellerId, 
        seller_name as sellerName, 
        SUM(total_amount) as totalRevenue, 
        COUNT(DISTINCT correlation_id) as transactionCount
      FROM sales
    `;
    const params: any[] = [];
    if (month) {
      query += ` WHERE strftime('%Y-%m', transaction_date) = ?`;
      params.push(month);
    }
    query += ` GROUP BY seller_id`;

    const rows = await db.all(query, ...params);
    return rows.map(r => ({
      sellerId: r.sellerId,
      sellerName: r.sellerName,
      totalRevenue: Number(r.totalRevenue) || 0,
      transactionCount: Number(r.transactionCount) || 0
    }));
  }

  async updatePaymentStatus(id: number, status: 'pagado' | 'pendiente'): Promise<void> {
    const db = await this.getDb();
    const row = await db.get('SELECT correlation_id FROM sales WHERE id = ?', id);
    if (row && row.correlation_id) {
      await db.run('UPDATE sales SET payment_status = ? WHERE correlation_id = ?', status, row.correlation_id);
    } else {
      await db.run('UPDATE sales SET payment_status = ? WHERE id = ?', status, id);
    }
  }
}
