"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteSaleRepository = exports.SQLiteSystemSettingsRepository = exports.SQLiteBeerStyleRepository = exports.SQLiteCustomerRepository = exports.SQLiteUserRepository = void 0;
const database_1 = require("../../config/database");
// Helper de mapeo para Usuario
function mapUserRow(row) {
    return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        name: row.name,
        role: row.role,
        createdAt: new Date(row.created_at)
    };
}
// Helper de mapeo para Cliente
function mapCustomerRow(row) {
    return {
        id: row.id,
        businessName: row.business_name,
        fiscalId: row.fiscal_id,
        phone: row.phone || '',
        customerType: row.customer_type,
        createdAt: new Date(row.created_at)
    };
}
// Helper de mapeo para Estilos de Cerveza
function mapBeerStyleRow(row) {
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
function mapSaleRow(row) {
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
        formatSold: row.format_sold,
        unitsSold: row.units_sold,
        unitPrice: row.unit_price,
        totalAmount: row.total_amount,
        paymentStatus: row.payment_status
    };
}
class SQLiteUserRepository {
    async getDb() {
        return (0, database_1.getDatabase)();
    }
    async findById(id) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM users WHERE id = ?', id);
        return row ? mapUserRow(row) : null;
    }
    async findByUsername(username) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM users WHERE username = ?', username);
        return row ? mapUserRow(row) : null;
    }
    async create(user) {
        const db = await this.getDb();
        await db.run('INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)', user.id, user.username, user.passwordHash, user.name, user.role);
    }
    async update(user) {
        const db = await this.getDb();
        await db.run('UPDATE users SET username = ?, password_hash = ?, name = ?, role = ? WHERE id = ?', user.username, user.passwordHash, user.name, user.role, user.id);
    }
    async delete(id) {
        const db = await this.getDb();
        await db.run('DELETE FROM users WHERE id = ?', id);
    }
    async listAll() {
        const db = await this.getDb();
        const rows = await db.all('SELECT * FROM users ORDER BY name ASC');
        return rows.map(mapUserRow);
    }
}
exports.SQLiteUserRepository = SQLiteUserRepository;
class SQLiteCustomerRepository {
    async getDb() {
        return (0, database_1.getDatabase)();
    }
    async findById(id) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', id);
        return row ? mapCustomerRow(row) : null;
    }
    async findByFiscalId(fiscalId) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM customers WHERE fiscal_id = ?', fiscalId);
        return row ? mapCustomerRow(row) : null;
    }
    async create(customer) {
        const db = await this.getDb();
        await db.run('INSERT INTO customers (id, business_name, fiscal_id, phone, customer_type) VALUES (?, ?, ?, ?, ?)', customer.id, customer.businessName, customer.fiscalId, customer.phone, customer.customerType);
    }
    async update(customer) {
        const db = await this.getDb();
        await db.run('UPDATE customers SET business_name = ?, fiscal_id = ?, phone = ?, customer_type = ? WHERE id = ?', customer.businessName, customer.fiscalId, customer.phone, customer.customerType, customer.id);
    }
    async delete(id) {
        const db = await this.getDb();
        await db.run('DELETE FROM customers WHERE id = ?', id);
    }
    async listAll() {
        const db = await this.getDb();
        const rows = await db.all('SELECT * FROM customers ORDER BY business_name ASC');
        return rows.map(mapCustomerRow);
    }
    async search(query) {
        const db = await this.getDb();
        const searchPattern = `%${query}%`;
        const rows = await db.all('SELECT * FROM customers WHERE business_name LIKE ? OR fiscal_id LIKE ? ORDER BY business_name ASC', searchPattern, searchPattern);
        return rows.map(mapCustomerRow);
    }
}
exports.SQLiteCustomerRepository = SQLiteCustomerRepository;
class SQLiteBeerStyleRepository {
    async getDb() {
        return (0, database_1.getDatabase)();
    }
    async findById(id) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM beer_styles WHERE id = ?', id);
        return row ? mapBeerStyleRow(row) : null;
    }
    async findByName(name) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM beer_styles WHERE name = ?', name);
        return row ? mapBeerStyleRow(row) : null;
    }
    async create(beerStyle) {
        const db = await this.getDb();
        await db.run('INSERT INTO beer_styles (id, name, stock_bottles, price_unit, price_pack2, price_pack3, price_pack4, price_wholesale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', beerStyle.id, beerStyle.name, beerStyle.stockBottles, beerStyle.priceUnit, beerStyle.pricePack2, beerStyle.pricePack3, beerStyle.pricePack4, beerStyle.priceWholesale);
    }
    async update(beerStyle) {
        const db = await this.getDb();
        await db.run(`UPDATE beer_styles SET 
        name = ?, 
        stock_bottles = ?, 
        price_unit = ?, 
        price_pack2 = ?, 
        price_pack3 = ?, 
        price_pack4 = ?, 
        price_wholesale = ?,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`, beerStyle.name, beerStyle.stockBottles, beerStyle.priceUnit, beerStyle.pricePack2, beerStyle.pricePack3, beerStyle.pricePack4, beerStyle.priceWholesale, beerStyle.id);
    }
    async delete(id) {
        const db = await this.getDb();
        await db.run('DELETE FROM beer_styles WHERE id = ?', id);
    }
    async listAll() {
        const db = await this.getDb();
        const rows = await db.all('SELECT * FROM beer_styles ORDER BY name ASC');
        return rows.map(mapBeerStyleRow);
    }
    async updateStock(id, newStock) {
        const db = await this.getDb();
        await db.run('UPDATE beer_styles SET stock_bottles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, id);
    }
}
exports.SQLiteBeerStyleRepository = SQLiteBeerStyleRepository;
class SQLiteSystemSettingsRepository {
    async getDb() {
        return (0, database_1.getDatabase)();
    }
    async getVal(key) {
        const db = await this.getDb();
        const row = await db.get('SELECT value FROM system_settings WHERE key = ?', key);
        return row ? row.value : null;
    }
    async setVal(key, value, description) {
        const db = await this.getDb();
        await db.run(`INSERT INTO system_settings (key, value, description, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET 
         value = excluded.value, 
         description = COALESCE(excluded.description, system_settings.description),
         updated_at = CURRENT_TIMESTAMP`, key, value, description || null);
    }
}
exports.SQLiteSystemSettingsRepository = SQLiteSystemSettingsRepository;
class SQLiteSaleRepository {
    async getDb() {
        return (0, database_1.getDatabase)();
    }
    async createMany(sales) {
        const db = await this.getDb();
        const stmt = await db.prepare(`INSERT INTO sales (
        correlation_id, seller_id, seller_name, customer_id, customer_name,
        beer_style_id, beer_style_name, format_sold, units_sold, unit_price, total_amount, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const sale of sales) {
            await stmt.run(sale.correlationId, sale.sellerId, sale.sellerName, sale.customerId || null, sale.customerName, sale.beerStyleId, sale.beerStyleName, sale.formatSold, sale.unitsSold, sale.unitPrice, sale.totalAmount, sale.paymentStatus);
        }
        await stmt.finalize();
    }
    async listAll() {
        const db = await this.getDb();
        const rows = await db.all('SELECT * FROM sales ORDER BY transaction_date DESC');
        return rows.map(mapSaleRow);
    }
    async getSellerPerformance(month) {
        const db = await this.getDb();
        let query = `
      SELECT 
        seller_id as sellerId, 
        seller_name as sellerName, 
        SUM(total_amount) as totalRevenue, 
        COUNT(DISTINCT correlation_id) as transactionCount
      FROM sales
    `;
        const params = [];
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
    async updatePaymentStatus(id, status) {
        const db = await this.getDb();
        await db.run('UPDATE sales SET payment_status = ? WHERE id = ?', status, id);
    }
}
exports.SQLiteSaleRepository = SQLiteSaleRepository;
