import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { createClient, Client, Transaction } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

export interface IStatement {
  run(...params: any[]): Promise<any>;
  finalize(): Promise<void>;
}

export interface IDatabase {
  get<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  run(sql: string, ...params: any[]): Promise<{ lastID?: number; changes?: number }>;
  exec(sql: string): Promise<void>;
  prepare(sql: string): Promise<IStatement>;
}

class TursoStatement implements IStatement {
  constructor(private db: IDatabase, private sql: string) {}

  async run(...params: any[]): Promise<any> {
    return this.db.run(this.sql, ...params);
  }

  async finalize(): Promise<void> {
    // No-op en conexión remota
  }
}

class TursoDatabaseWrapper implements IDatabase {
  private currentTx: Transaction | null = null;

  constructor(private client: Client) {}

  private convertRow(row: any, columns: string[]): any {
    if (!row) return undefined;
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[col] !== undefined ? row[col] : row[idx];
    });
    return obj;
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    const executor = this.currentTx || this.client;
    const res = await executor.execute({ sql, args: params });
    return res.rows[0] ? this.convertRow(res.rows[0], res.columns) : undefined;
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const executor = this.currentTx || this.client;
    const res = await executor.execute({ sql, args: params });
    return res.rows.map(row => this.convertRow(row, res.columns));
  }

  async run(sql: string, ...params: any[]): Promise<{ lastID?: number; changes?: number }> {
    const sqlUpper = sql.trim().toUpperCase();

    if (sqlUpper.startsWith('BEGIN')) {
      if (this.currentTx) {
        throw new Error('Transaction is already active');
      }
      this.currentTx = await this.client.transaction("write");
      return { changes: 0 };
    }

    if (sqlUpper.startsWith('COMMIT')) {
      if (!this.currentTx) {
        throw new Error('No active transaction to commit');
      }
      await this.currentTx.commit();
      this.currentTx = null;
      return { changes: 0 };
    }

    if (sqlUpper.startsWith('ROLLBACK')) {
      if (!this.currentTx) {
        // Retornar silenciosamente si no hay transacción activa para evitar crashes redundantes
        return { changes: 0 };
      }
      await this.currentTx.rollback();
      this.currentTx = null;
      return { changes: 0 };
    }

    const executor = this.currentTx || this.client;
    const res = await executor.execute({ sql, args: params });
    return {
      lastID: res.lastInsertRowid ? Number(res.lastInsertRowid) : undefined,
      changes: Number(res.rowsAffected)
    };
  }

  async exec(sql: string): Promise<void> {
    // Eliminar comentarios de SQL y líneas vacías para evitar errores de parseo en Turso
    const cleanSql = sql
      .split('\n')
      .map(line => line.replace(/--.*$/, '').trim())
      .join(' ');

    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.toLowerCase().startsWith('pragma'));
    
    if (statements.length > 0) {
      await this.client.batch(statements, "write");
    }
  }

  async prepare(sql: string): Promise<IStatement> {
    return new TursoStatement(this, sql);
  }
}

let dbInstance: IDatabase | null = null;

/**
 * Abre y retorna la conexión activa a la base de datos (SQLite local o Turso remota).
 * Si es la primera vez que se llama, inicializa el esquema y valores por defecto.
 */
export async function getDatabase(): Promise<IDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (process.env.TURSO_DATABASE_URL) {
    console.log('Conectando a la base de datos remota de Turso...');
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    dbInstance = new TursoDatabaseWrapper(client);
  } else {
    console.log('Conectando a la base de datos local de SQLite...');
    // Ruta física de la base de datos (soporta disco persistente en entornos como Render/Docker)
    const dbPath = process.env.DATABASE_PATH
      ? path.resolve(process.env.DATABASE_PATH)
      : path.resolve(__dirname, '../../database.db');

    // Asegurar que el directorio contenedor exista
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Habilitar restricciones de claves foráneas
    await dbInstance.exec('PRAGMA foreign_keys = ON;');
  }

  // Cargar y ejecutar el archivo de esquema schema.sql
  const schemaPath = path.resolve(__dirname, '../../schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await dbInstance.exec(schemaSql);
  }

  // Migración de columnas para customers si no existen (aplica para SQLite y Turso)
  try {
    const customerCols = await dbInstance.all('PRAGMA table_info(customers)');
    const hasContactName = customerCols.some((col: any) => col.name === 'contact_name');
    if (!hasContactName) {
      await dbInstance.exec('ALTER TABLE customers ADD COLUMN contact_name TEXT;');
      await dbInstance.exec('ALTER TABLE customers ADD COLUMN address TEXT;');
      await dbInstance.exec('ALTER TABLE customers ADD COLUMN iva_percent REAL DEFAULT 19.0;');
      await dbInstance.exec('ALTER TABLE customers ADD COLUMN ila_percent REAL DEFAULT 0.0;');
      console.log('Migración: Columnas fiscales y contacto agregadas a la tabla "customers" exitosamente.');
    }
  } catch (err) {
    console.error('Error al migrar la tabla "customers":', err);
  }

  // Migración de columnas para users si no existen (aplica para SQLite y Turso)
  try {
    const userCols = await dbInstance.all('PRAGMA table_info(users)');
    const hasPhone = userCols.some((col: any) => col.name === 'phone');
    if (!hasPhone) {
      await dbInstance.exec('ALTER TABLE users ADD COLUMN phone TEXT;');
      await dbInstance.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
      await dbInstance.exec('ALTER TABLE users ADD COLUMN last_login DATETIME;');
      console.log('Migración: Columnas "phone", "is_active" y "last_login" agregadas a la tabla "users" exitosamente.');
    }
  } catch (err) {
    console.error('Error al migrar la tabla "users":', err);
  }

  // Migración de columnas de eventos para sales si no existen (aplica para SQLite y Turso)
  try {
    const salesCols = await dbInstance.all('PRAGMA table_info(sales)');
    const hasEventId = salesCols.some((col: any) => col.name === 'event_id');
    if (!hasEventId) {
      await dbInstance.exec('ALTER TABLE sales ADD COLUMN event_id TEXT;');
      await dbInstance.exec('ALTER TABLE sales ADD COLUMN event_name TEXT;');
      console.log('Migración: Columnas de vinculación a eventos agregadas a la tabla "sales" exitosamente.');
    }
  } catch (err) {
    console.error('Error al migrar la tabla "sales" para eventos:', err);
  }

  // Migración de columnas para beer_styles si no existen
  try {
    const styleCols = await dbInstance.all('PRAGMA table_info(beer_styles)');
    const hasFavorite = styleCols.some((col: any) => col.name === 'is_favorite');
    if (!hasFavorite) {
      await dbInstance.exec('ALTER TABLE beer_styles ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;');
      console.log('Migración: Columna "is_favorite" agregada a la tabla "beer_styles" exitosamente.');
    }
  } catch (err) {
    console.error('Error al migrar la tabla "beer_styles" para favorites:', err);
  }

  // Migración de payment_method para sales si no existe
  try {
    const salesCols = await dbInstance.all('PRAGMA table_info(sales)');
    const hasPaymentMethod = salesCols.some((col: any) => col.name === 'payment_method');
    if (!hasPaymentMethod) {
      await dbInstance.exec("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'efectivo';");
      console.log('Migración: Columna "payment_method" agregada a la tabla "sales" exitosamente.');
    }
  } catch (err) {
    console.error('Error al migrar la tabla "sales" para payment_method:', err);
  }

  // Migración para tabla event_products si no existe
  try {
    let recreateTable = false;
    try {
      const tableInfo = await dbInstance.all('PRAGMA table_info(event_products)');
      if (tableInfo.length > 0) {
        const hasStatus = tableInfo.some((col: any) => col.name === 'status');
        if (!hasStatus) {
          recreateTable = true;
        }
      }
    } catch (e) {
      // Ignorar si no existe
    }

    if (recreateTable) {
      await dbInstance.exec('DROP TABLE IF EXISTS event_products;');
      console.log('Migración: Eliminada tabla antigua "event_products" para actualización.');
    }

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS event_products (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          name TEXT NOT NULL,
          price REAL NOT NULL DEFAULT 0.0 CHECK(price >= 0),
          image_url TEXT,
          status TEXT NOT NULL DEFAULT 'activo' CHECK(status IN ('activo', 'inactivo')),
          display_order INTEGER NOT NULL DEFAULT 0,
          is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
          FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
      );
    `);
    console.log('Migración: Tabla "event_products" verificada/creada exitosamente con las nuevas columnas.');
  } catch (err) {
    console.error('Error al verificar/crear la tabla "event_products":', err);
  }

  // Migración del CHECK constraint de roles en la tabla "users" (aplica para SQLite y Turso)
  try {
    const usersTableInfo = await dbInstance.all('PRAGMA table_info(users)');
    const hasRoleCol = usersTableInfo.some((col: any) => col.name === 'role');
    if (hasRoleCol) {
      console.log('Migrando/Verificando tabla "users" para el rol "supervisor"...');
      await dbInstance.exec('PRAGMA foreign_keys = OFF;');
      await dbInstance.exec('BEGIN TRANSACTION;');
      
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'supervisor', 'vendedor')),
            phone TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await dbInstance.exec(`
        INSERT OR IGNORE INTO users_new (id, username, password_hash, name, role, phone, is_active, last_login, created_at)
        SELECT id, username, password_hash, name, role, phone, is_active, last_login, created_at FROM users;
      `);
      
      await dbInstance.exec('DROP TABLE users;');
      await dbInstance.exec('ALTER TABLE users_new RENAME TO users;');
      await dbInstance.exec('COMMIT;');
      await dbInstance.exec('PRAGMA foreign_keys = ON;');
      console.log('Tabla "users" verificada/migrada para admitir rol "supervisor" con éxito.');
    }
  } catch (usersMigError) {
    console.error('Error al verificar/migrar tabla "users":', usersMigError);
    try { await dbInstance.exec('ROLLBACK;'); } catch (e) {}
    await dbInstance.exec('PRAGMA foreign_keys = ON;');
  }

  // Migraciones dinámicas específicas de base de datos local
  if (!process.env.TURSO_DATABASE_URL) {
    // Migración dinámica: agregar columna payment_status a la tabla sales si no existe
    try {
      const tableInfo = await dbInstance.all('PRAGMA table_info(sales)');
      const hasPaymentStatus = tableInfo.some((col: any) => col.name === 'payment_status');
      if (!hasPaymentStatus) {
        await dbInstance.exec("ALTER TABLE sales ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pagado';");
        console.log('Migración: Columna "payment_status" agregada a la tabla "sales" exitosamente.');
      }
    } catch (migError) {
      console.error('Error al realizar migración en SQLite:', migError);
    }

    // Migración dinámica: modificar claves foráneas de sales a ON DELETE SET NULL para evitar rebotar al borrar entidades
    try {
      const fkList = await dbInstance.all('PRAGMA foreign_key_list(sales)');
      const needsFkMigration = fkList.some((fk: any) => fk.on_delete === 'NO ACTION');
      if (needsFkMigration) {
        console.log('Migrando tabla "sales" para soportar ON DELETE SET NULL...');
        await dbInstance.exec('PRAGMA foreign_keys = OFF;');
        await dbInstance.exec('BEGIN TRANSACTION;');
        
        // 1. Crear tabla nueva con el esquema correcto
        await dbInstance.exec(`
          CREATE TABLE sales_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              correlation_id TEXT NOT NULL,
              transaction_date DATETIME DEFAULT (datetime('now', 'localtime')),
              seller_id TEXT,
              seller_name TEXT NOT NULL,
              customer_id TEXT,
              customer_name TEXT DEFAULT 'Cliente Detalle',
              beer_style_id TEXT,
              beer_style_name TEXT NOT NULL,
              format_sold TEXT NOT NULL,
              units_sold INTEGER NOT NULL,
              unit_price REAL NOT NULL,
              total_amount REAL NOT NULL,
              payment_status TEXT NOT NULL DEFAULT 'pagado',
              event_id TEXT,
              event_name TEXT,
              payment_method TEXT DEFAULT 'efectivo',
              FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
              FOREIGN KEY(beer_style_id) REFERENCES beer_styles(id) ON DELETE SET NULL,
              FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
          );
        `);
        
        // 2. Copiar los datos históricos
        await dbInstance.exec(`
          INSERT INTO sales_new (
            id, correlation_id, transaction_date, seller_id, seller_name, 
            customer_id, customer_name, beer_style_id, beer_style_name, 
            format_sold, units_sold, unit_price, total_amount, payment_status,
            event_id, event_name, payment_method
          )
          SELECT 
            id, correlation_id, transaction_date, seller_id, seller_name, 
            customer_id, customer_name, beer_style_id, beer_style_name, 
            format_sold, units_sold, unit_price, total_amount, payment_status,
            event_id, event_name, payment_method
          FROM sales;
        `);
        
        // 3. Reemplazar la tabla
        await dbInstance.exec('DROP TABLE sales;');
        await dbInstance.exec('ALTER TABLE sales_new RENAME TO sales;');
        
        await dbInstance.exec('COMMIT;');
        await dbInstance.exec('PRAGMA foreign_keys = ON;');
        console.log('Migración de claves foráneas de "sales" completada con éxito.');
      }
    } catch (fkMigError) {
      console.error('Error al migrar claves foráneas de la tabla sales:', fkMigError);
    }
  }

  // 1. Semilla para la variable global del Formato Mayorista (si no existe)
  const wholesaleSetting = await dbInstance.get(
    'SELECT * FROM system_settings WHERE key = ?',
    'wholesale_units'
  );
  if (!wholesaleSetting) {
    await dbInstance.run(
      'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
      'wholesale_units',
      '23',
      'Cantidad de unidades (botellas) que componen el Formato Mayorista para 3 Lobos'
    );
  }

  // Semilla para el remitente de WhatsApp
  const waSender = await dbInstance.get('SELECT * FROM system_settings WHERE key = ?', 'whatsapp_sender_number');
  if (!waSender) {
    await dbInstance.run(
      'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
      'whatsapp_sender_number',
      '',
      'Número de teléfono entregador registrado en WhatsApp Business'
    );
  }

  // Semilla para el Token de WhatsApp Business
  const waToken = await dbInstance.get('SELECT * FROM system_settings WHERE key = ?', 'whatsapp_token');
  if (!waToken) {
    await dbInstance.run(
      'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
      'whatsapp_token',
      '',
      'Token de acceso de API WhatsApp Business Cloud'
    );
  }

  // Semilla para el Phone Number ID de WhatsApp
  const waPhoneId = await dbInstance.get('SELECT * FROM system_settings WHERE key = ?', 'whatsapp_phone_number_id');
  if (!waPhoneId) {
    await dbInstance.run(
      'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
      'whatsapp_phone_number_id',
      '',
      'Phone Number ID de la cuenta de WhatsApp Business'
    );
  }

  // Semilla para Configuración de Empresa
  const companySeeds = [
    { key: 'company_name', val: 'Cervecería 3 Lobos', desc: 'Nombre legal o comercial de la empresa' },
    { key: 'company_logo', val: '/logo.png', desc: 'Logotipo de la empresa (ruta pública o URL)' },
    { key: 'company_rut', val: '76.123.456-7', desc: 'RUT o identificación fiscal de la empresa' },
    { key: 'company_address', val: 'Ruta 5 Sur, Talca, Chile', desc: 'Dirección física principal de la empresa' },
    { key: 'company_phone', val: '+56 9 1234 5678', desc: 'Teléfono corporativo de la empresa' },
    { key: 'company_email', val: 'contacto@3lobos.cl', desc: 'Correo electrónico de contacto' }
  ];
  for (const c of companySeeds) {
    const exist = await dbInstance.get('SELECT * FROM system_settings WHERE key = ?', c.key);
    if (!exist) {
      await dbInstance.run(
        'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)',
        c.key,
        c.val,
        c.desc
      );
    }
  }

  // 2. Semilla para Usuarios por Defecto (si no existen usuarios)
  const userCountRow = await dbInstance.get('SELECT COUNT(*) as count FROM users');
  if (userCountRow && userCountRow.count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const supervisorHash = await bcrypt.hash('supervisor123', 10);
    const sellerHash = await bcrypt.hash('vendedor123', 10);

    // Insertar Administrador por defecto
    await dbInstance.run(
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      'u-admin-default-id',
      'admin',
      adminHash,
      'Administrador 3 Lobos',
      'admin'
    );

    // Insertar Supervisor por defecto
    await dbInstance.run(
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      'u-supervisor-default-id',
      'supervisor',
      supervisorHash,
      'Supervisor Cervecería',
      'supervisor'
    );

    // Insertar Vendedor por defecto
    await dbInstance.run(
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      'u-vendedor-default-id',
      'vendedor',
      sellerHash,
      'Vendedor Cervecería',
      'vendedor'
    );

    console.log('Seeder: Usuarios por defecto creados (admin, supervisor y vendedor).');
  }

  // 3. Semilla para Estilos de Cerveza Iniciales (si no hay estilos)
  const styleCountRow = await dbInstance.get('SELECT COUNT(*) as count FROM beer_styles');
  if (styleCountRow && styleCountRow.count === 0) {
    const styles = [
      {
        id: 'style-ipa',
        name: '3 Lobos IPA',
        stock: 120, // 120 botellas individuales
        p1: 1500,  // Unidad
        p2: 2800,  // Pack de 2
        p3: 4000,  // Pack de 3
        p4: 5000,  // Pack de 4
        pW: 25000  // Pack Mayorista (23 unidades)
      },
      {
        id: 'style-stout',
        name: '3 Lobos Stout',
        stock: 80,
        p1: 1600,
        p2: 3000,
        p3: 4300,
        p4: 5400,
        pW: 27000
      },
      {
        id: 'style-amber',
        name: '3 Lobos Amber Ale',
        stock: 50,
        p1: 1400,
        p2: 2600,
        p3: 3800,
        p4: 4800,
        pW: 24000
      }
    ];

    for (const s of styles) {
      await dbInstance.run(
        `INSERT INTO beer_styles (id, name, stock_bottles, price_unit, price_pack2, price_pack3, price_pack4, price_wholesale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        s.name,
        s.stock,
        s.p1,
        s.p2,
        s.p3,
        s.p4,
        s.pW
      );
    }

    console.log('Seeder: Estilos de cerveza iniciales insertados en la base de datos.');
  }

  // 4. Semilla para Clientes Corporativos por Defecto (si no hay)
  const customerCountRow = await dbInstance.get('SELECT COUNT(*) as count FROM customers');
  if (customerCountRow && customerCountRow.count === 0) {
    await dbInstance.run(
      `INSERT INTO customers (id, business_name, fiscal_id, phone, customer_type)
       VALUES (?, ?, ?, ?, ?)`,
      'cust-bar-lobo',
      'El Bar del Lobo Solitario',
      '76.543.210-K',
      '+56912345678',
      'wholesale'
    );
    await dbInstance.run(
      `INSERT INTO customers (id, business_name, fiscal_id, phone, customer_type)
       VALUES (?, ?, ?, ?, ?)`,
      'cust-resto-andes',
      'Restaurante Cumbres Andinas',
      '78.987.654-3',
      '+56987654321',
      'wholesale'
    );
    console.log('Seeder: Clientes corporativos iniciales insertados en la base de datos.');
  }

  return dbInstance;
}
