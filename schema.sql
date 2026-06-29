-- Habilitar claves foráneas en SQLite
PRAGMA foreign_keys = ON;

-- 1. Tabla de Usuarios (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'vendedor')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Clientes Corporativos (Restaurantes Mayoristas)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    fiscal_id TEXT NOT NULL UNIQUE, -- Rut / Identificación Fiscal
    phone TEXT,
    customer_type TEXT DEFAULT 'retail', -- 'retail' o 'wholesale' (Restaurantes)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Estilos de Cerveza e Inventario en Unidades (Botellas)
-- Contiene las 5 tarifas de precios editables por el admin
CREATE TABLE IF NOT EXISTS beer_styles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    stock_bottles INTEGER NOT NULL DEFAULT 0 CHECK(stock_bottles >= 0),
    price_unit REAL NOT NULL DEFAULT 0.0 CHECK(price_unit >= 0),
    price_pack2 REAL NOT NULL DEFAULT 0.0 CHECK(price_pack2 >= 0),
    price_pack3 REAL NOT NULL DEFAULT 0.0 CHECK(price_pack3 >= 0),
    price_pack4 REAL NOT NULL DEFAULT 0.0 CHECK(price_pack4 >= 0),
    price_wholesale REAL NOT NULL DEFAULT 0.0 CHECK(price_wholesale >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Parámetros Globales del Sistema (Configuración)
-- Se usa para almacenar dinámicamente el multiplicador del Formato Mayorista (ej. 23 unidades)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Historial Permanente de Ventas y Auditoría
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correlation_id TEXT NOT NULL, -- ID correlativo de la transacción completa (unifica ventas con múltiples ítems)
    transaction_date DATETIME DEFAULT (datetime('now', 'localtime')),
    seller_id TEXT, -- Nullable to allow delete with SET NULL
    seller_name TEXT NOT NULL,
    customer_id TEXT, -- Nullable to allow delete with SET NULL
    customer_name TEXT DEFAULT 'Cliente Detalle',
    beer_style_id TEXT, -- Nullable to allow delete with SET NULL
    beer_style_name TEXT NOT NULL,
    format_sold TEXT NOT NULL, -- 'unit', 'pack2', 'pack3', 'pack4', 'wholesale'
    units_sold INTEGER NOT NULL, -- Número físico de botellas descontadas
    unit_price REAL NOT NULL, -- Precio del formato aplicado por unidad de venta
    total_amount REAL NOT NULL, -- Total de la línea (cantidad * precio_formato)
    payment_status TEXT NOT NULL DEFAULT 'pagado' CHECK(payment_status IN ('pagado', 'pendiente')), -- Estado de pago
    FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY(beer_style_id) REFERENCES beer_styles(id) ON DELETE SET NULL
);
