import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

let dbInstance: Database | null = null;

/**
 * Abre y retorna la conexión activa a la base de datos SQLite.
 * Si es la primera vez que se llama, inicializa el esquema y valores por defecto.
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

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

  // Cargar y ejecutar el archivo de esquema schema.sql
  const schemaPath = path.resolve(__dirname, '../../schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await dbInstance.exec(schemaSql);
  }

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
            FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
            FOREIGN KEY(beer_style_id) REFERENCES beer_styles(id) ON DELETE SET NULL
        );
      `);
      
      // 2. Copiar los datos históricos
      await dbInstance.exec(`
        INSERT INTO sales_new (
          id, correlation_id, transaction_date, seller_id, seller_name, 
          customer_id, customer_name, beer_style_id, beer_style_name, 
          format_sold, units_sold, unit_price, total_amount, payment_status
        )
        SELECT 
          id, correlation_id, transaction_date, seller_id, seller_name, 
          customer_id, customer_name, beer_style_id, beer_style_name, 
          format_sold, units_sold, unit_price, total_amount, payment_status
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

  // 2. Semilla para Usuarios por Defecto (si no existen usuarios)
  const userCountRow = await dbInstance.get('SELECT COUNT(*) as count FROM users');
  if (userCountRow && userCountRow.count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
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

    // Insertar Vendedor por defecto
    await dbInstance.run(
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      'u-vendedor-default-id',
      'vendedor',
      sellerHash,
      'Vendedor Cervecería',
      'vendedor'
    );

    console.log('Seeder: Usuarios por defecto creados (admin/admin123 y vendedor/vendedor123).');
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
