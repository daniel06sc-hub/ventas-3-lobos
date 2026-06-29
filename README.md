# Backend API SaaS - Cervecería "3 Lobos"

Este proyecto contiene la **arquitectura limpia**, el **esquema detallado de base de datos relacional (SQLite)** y toda la **lógica de negocio de backend (API REST con Node.js, Express y TypeScript)** para el control de inventario, punto de venta (POS) y distribución de la cervecería **3 Lobos**.

---

## 🚀 Requisitos e Instalación

### Requisitos Previos:
- **Node.js** (Versión 18 o superior recomedada, probado en v24)
- **npm** (Versión 9 o superior)

### Configuración del Proyecto:
1. Instala las dependencias del proyecto ejecutando:
   ```bash
   npm install
   ```

2. El proyecto cuenta con un archivo `.env` implícito (con variables por defecto en el código), pero puedes crear un archivo `.env` en la raíz para sobreescribir configuraciones:
   ```env
   PORT=3000
   JWT_SECRET=tu-secreto-super-seguro-3-lobos
   JWT_EXPIRES_IN=8h
   ```

---

## ⚡ Comandos Disponibles

- **`npm run dev`**: Inicia el servidor de desarrollo utilizando `ts-node-dev` (se reinicia automáticamente ante cualquier cambio en el código).
- **`npm run build`**: Compila el código TypeScript a JavaScript de producción (directorio `dist`).
- **`npm run start`**: Levanta el servidor Express compilado.
- **`npm test`**: Ejecuta el script de pruebas automatizadas integradas (`src/test-api.ts`), el cual levanta una instancia limpia de la app en el puerto 3001, realiza las transacciones simulando toda la lógica de negocio y se apaga automáticamente.

---

## 📂 Estructura de la Arquitectura Limpia

El proyecto sigue una organización desacoplada por capas:

```
├── src
│   ├── config
│   │   └── database.ts            # Conexión a SQLite y carga inicial de semillas (Seeders)
│   ├── domain
│   │   ├── entities.ts            # Entidades y tipos de negocio de TypeScript
│   │   └── repositories.ts        # Interfaces y firmas de los repositorios de datos
│   ├── application
│   │   ├── auth.service.ts        # Lógica de login, hashing y tokens JWT
│   │   ├── inventory.service.ts   # CRUD de estilos de cerveza y variables globales
│   │   ├── customer.service.ts    # Gestión de clientes corporativos (restaurantes)
│   │   ├── sales.service.ts       # Motor atómico de ventas, validación y descuento de stock
│   │   └── report.service.ts      # Generación de reportes financieros por vendedor
│   ├── infrastructure
│   │   ├── database
│   │   │   └── sqlite-repositories.ts # Implementación real de repositorios en SQLite
│   │   ├── http
│   │   │   ├── middlewares
│   │   │   │   └── auth.middleware.ts  # Middleware de JWT y autorización de roles (RBAC)
│   │   │   ├── controllers
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── inventory.controller.ts
│   │   │   │   ├── customer.controller.ts
│   │   │   │   ├── sales.controller.ts
│   │   │   │   └── report.controller.ts
│   │   │   └── routes
│   │   │       ├── auth.routes.ts
│   │   │       ├── inventory.routes.ts
│   │   │       ├── customer.routes.ts
│   │   │       ├── sales.routes.ts
│   │   │       └── report.routes.ts
│   │   └── index.ts               # Orquestación de dependencias Express
│   ├── server.ts                  # Punto de entrada inicial del servidor
│   └── test-api.ts                # Archivo de pruebas de integración
├── schema.sql                     # Script SQL DDL de la base de datos
├── database.db                    # Archivo de base de datos relacional SQLite (auto-generado)
├── package.json
└── tsconfig.json
```

---

## 🗄️ Esquema Relacional de Base de Datos (SQLite)

La base de datos se almacena en el archivo local `database.db`. Está estructurada bajo el esquema definido en `schema.sql`:

1. **`users`**: Registra al personal de la cervecería y sus contraseñas cifradas en bcrypt.
2. **`customers`**: Ficha de clientes corporativos (Restaurantes) para ventas mayoristas.
3. **`beer_styles`**: Almacena el stock real estrictamente en **unidades individuales** (botellas físicas) y los 5 precios configurados.
4. **`system_settings`**: Tabla clave-valor para variables globales como `wholesale_units` (inicializada en 23).
5. **`sales`**: Historial permanente de auditoría de ventas individuales con el ID y nombre del vendedor, el cliente (si aplica) y montos cobrados.

### Semilla Automática (Seeders):
Al iniciar la aplicación por primera vez (`npm run dev` o `npm test`), la base de datos se inicializa automáticamente con:
* **Administrador por defecto:**
  * Usuario: `admin`
  * Contraseña: `admin123`
  * Rol: `admin`
* **Vendedor por defecto:**
  * Usuario: `vendedor`
  * Contraseña: `vendedor123`
  * Rol: `vendedor`
* **Estilos iniciales:** IPA, Stout y Amber Ale con precios y stock iniciales.
* **Clientes iniciales:** El Bar del Lobo Solitario y Restaurante Cumbres Andinas.

---

## 🔌 Documentación de la API Endpoints

Todos los endpoints (excepto Login) requieren la cabecera HTTP:
`Authorization: Bearer <JWT_TOKEN>`

### 🔑 1. Autenticación (`/api/auth`)

#### `POST /api/auth/login` (Público)
Inicia sesión y obtiene el token JWT para llamadas subsiguientes.
* **Request Body:**
  ```json
  {
    "username": "vendedor",
    "password": "vendedor123"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "u-vendedor-default-id",
      "username": "vendedor",
      "name": "Vendedor Cervecería",
      "role": "vendedor"
    }
  }
  ```

#### `POST /api/auth/register` (Protegido: Solo `admin`)
Crea un nuevo usuario (vendedor o administrador) en la base de datos.
* **Request Body:**
  ```json
  {
    "username": "juan_lobo",
    "password": "segurapassword",
    "name": "Juan Pérez",
    "role": "vendedor" // 'admin' o 'vendedor'
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "id": "e4c760bb-dca0...",
    "username": "juan_lobo",
    "name": "Juan Pérez",
    "role": "vendedor"
  }
  ```

---

### 🍻 2. Catálogo e Inventario (`/api/inventory`)

#### `GET /api/inventory` (Autenticado: `admin` y `vendedor`)
Obtiene la lista completa de estilos de cerveza, sus precios configurados en los 5 formatos y el stock disponible en botellas físicas.
* **Response (200 OK):**
  ```json
  [
    {
      "id": "style-ipa",
      "name": "3 Lobos IPA",
      "stockBottles": 120,
      "priceUnit": 1500,
      "pricePack2": 2800,
      "pricePack3": 4000,
      "pricePack4": 5000,
      "priceWholesale": 25000,
      "createdAt": "2026-06-28T21:19:15.000Z",
      "updatedAt": "2026-06-28T21:19:15.000Z"
    }
  ]
  ```

#### `POST /api/inventory` (Protegido: Solo `admin`)
Crea un nuevo estilo en el catálogo de cervezas.
* **Request Body:**
  ```json
  {
    "name": "3 Lobos Honey",
    "stockBottles": 60,
    "priceUnit": 1400,
    "pricePack2": 2600,
    "pricePack3": 3800,
    "pricePack4": 4800,
    "priceWholesale": 24000
  }
  ```

#### `PUT /api/inventory/:id` (Protegido: Solo `admin`)
Modifica precios, nombre o realiza ingresos/ajustes de stock.
* **Request Body (parcial o completo):**
  ```json
  {
    "stockBottles": 100, // Ajusta directamente el inventario
    "priceUnit": 1450
  }
  ```

#### `GET /api/inventory/settings` (Autenticado: `admin` y `vendedor`)
Lee el valor dinámico actual para la cantidad de botellas del Formato Mayorista.
* **Response (200 OK):**
  ```json
  {
    "wholesale_units": 23
  }
  ```

#### `PUT /api/inventory/settings` (Protegido: Solo `admin`)
Modifica la cantidad de botellas del Formato Mayorista global del sistema.
* **Request Body:**
  ```json
  {
    "wholesale_units": 24
  }
  ```

---

### 🏢 3. Gestión de Clientes Mayoristas (`/api/customers`)

#### `GET /api/customers?q=busqueda` (Autenticado: `admin` y `vendedor`)
Devuelve los restaurantes mayoristas registrados. Si se incluye el parámetro de búsqueda `q`, filtra por nombre o RUT fiscal.
* **Response (200 OK):**
  ```json
  [
    {
      "id": "cust-bar-lobo",
      "businessName": "El Bar del Lobo Solitario",
      "fiscalId": "76.543.210-K",
      "phone": "+56912345678",
      "customerType": "wholesale",
      "createdAt": "2026-06-28T21:19:15.000Z"
    }
  ]
  ```

#### `POST /api/customers` (Autenticado: `admin` y `vendedor`)
Registra un nuevo restaurante mayorista en el sistema.
* **Request Body:**
  ```json
  {
    "businessName": "Restaurante Patagonia",
    "fiscalId": "79.111.222-3",
    "phone": "+56955554433"
  }
  ```

---

### 🛒 4. Motor de Punto de Venta POS (`/api/sales`)

#### `POST /api/sales/checkout` (Autenticado: `admin` y `vendedor`)
Procesa la compra en el punto de venta de manera atómica. Descuenta stock físico de inmediato tras validar disponibilidad.
* **Formatos de venta permitidos (`format`):**
  * `unit` (Resta 1 botella)
  * `pack2` (Resta 2 botellas)
  * `pack3` (Resta 3 botellas)
  * `pack4` (Resta 4 botellas)
  * `wholesale` (Resta `W` botellas, según variable global. **Obligatorio incluir `customerId` en la petición**).
* **Request Body (Sin Cliente / Venta al detalle minorista):**
  ```json
  {
    "items": [
      {
        "beerStyleId": "style-ipa",
        "format": "pack4",
        "quantity": 2
      }
    ]
  }
  ```
* **Request Body (Con Cliente / Venta Mayorista):**
  ```json
  {
    "customerId": "cust-bar-lobo",
    "items": [
      {
        "beerStyleId": "style-ipa",
        "format": "wholesale",
        "quantity": 1
      }
    ]
  }
  ```
* **Response exitosa (210/201 Created):**
  ```json
  {
    "message": "Venta registrada con éxito",
    "correlationId": "TR-20260628211915-ABCD",
    "totalPaid": 14000,
    "sales": [
      {
        "correlationId": "TR-20260628211915-ABCD",
        "transactionDate": "2026-06-28T21:19:15.000Z",
        "sellerId": "u-vendedor-default-id",
        "sellerName": "Vendedor Cervecería",
        "customerId": null,
        "customerName": "Cliente Detalle",
        "beerStyleId": "style-ipa",
        "beerStyleName": "3 Lobos IPA",
        "formatSold": "pack4",
        "unitsSold": 8,
        "unitPrice": 7000,
        "totalAmount": 14000
      }
    ]
  }
  ```
* **Response en caso de error por falta de stock:**
  ```json
  {
    "error": "Stock insuficiente para el estilo \"3 Lobos IPA\". Solicitado: 23 botellas (Formato: wholesale x 1). Stock actual en inventario: 19 botellas."
  }
  ```

#### `GET /api/sales/history` (Protegido: Solo `admin`)
Retorna el historial completo de auditoría y transacciones en orden cronológico descendente.

---

### 📊 5. Reportes de Caja y Rendimiento (`/api/reports`)

#### `GET /api/reports/sellers` (Protegido: Solo `admin`)
Genera el consolidado del dinero total recaudado y la cantidad de transacciones ejecutadas por cada vendedor del personal.
* **Response (200 OK):**
  ```json
  [
    {
      "sellerId": "u-vendedor-default-id",
      "sellerName": "Vendedor Cervecería",
      "totalRevenue": 44000,
      "transactionCount": 2
    }
  ]
  ```
