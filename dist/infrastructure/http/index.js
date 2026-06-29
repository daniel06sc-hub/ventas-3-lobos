"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpressApp = createExpressApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const sqlite_repositories_1 = require("../database/sqlite-repositories");
const auth_service_1 = require("../../application/auth.service");
const inventory_service_1 = require("../../application/inventory.service");
const customer_service_1 = require("../../application/customer.service");
const sales_service_1 = require("../../application/sales.service");
const report_service_1 = require("../../application/report.service");
const auth_controller_1 = require("./controllers/auth.controller");
const inventory_controller_1 = require("./controllers/inventory.controller");
const customer_controller_1 = require("./controllers/customer.controller");
const sales_controller_1 = require("./controllers/sales.controller");
const report_controller_1 = require("./controllers/report.controller");
const auth_routes_1 = require("./routes/auth.routes");
const inventory_routes_1 = require("./routes/inventory.routes");
const customer_routes_1 = require("./routes/customer.routes");
const sales_routes_1 = require("./routes/sales.routes");
const report_routes_1 = require("./routes/report.routes");
const database_1 = require("../../config/database");
/**
 * Fabrica y configura la instancia de la aplicación Express
 * realizando la inyección de dependencias limpia del Backend.
 */
async function createExpressApp() {
    // Asegura la conexión e inicialización de SQLite
    await (0, database_1.getDatabase)();
    const app = (0, express_1.default)();
    // Middlewares globales
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.static(path_1.default.resolve(__dirname, '../../../public')));
    // 1. Inyección de Repositorios (Detalle de Infraestructura)
    const userRepo = new sqlite_repositories_1.SQLiteUserRepository();
    const customerRepo = new sqlite_repositories_1.SQLiteCustomerRepository();
    const beerStyleRepo = new sqlite_repositories_1.SQLiteBeerStyleRepository();
    const settingsRepo = new sqlite_repositories_1.SQLiteSystemSettingsRepository();
    const saleRepo = new sqlite_repositories_1.SQLiteSaleRepository();
    // 2. Inyección de Servicios de Aplicación (Lógica de Negocio)
    const authService = new auth_service_1.AuthService(userRepo);
    const inventoryService = new inventory_service_1.InventoryService(beerStyleRepo, settingsRepo);
    const customerService = new customer_service_1.CustomerService(customerRepo);
    const salesService = new sales_service_1.SalesService(beerStyleRepo, customerRepo, saleRepo, settingsRepo);
    const reportService = new report_service_1.ReportService(saleRepo);
    // 3. Inyección de Controladores HTTP
    const authController = new auth_controller_1.AuthController(authService);
    const inventoryController = new inventory_controller_1.InventoryController(inventoryService);
    const customerController = new customer_controller_1.CustomerController(customerService);
    const salesController = new sales_controller_1.SalesController(salesService);
    const reportController = new report_controller_1.ReportController(reportService);
    // 4. Montaje de Enrutadores con prefijos REST API
    app.use('/api/auth', (0, auth_routes_1.createAuthRouter)(authController));
    app.use('/api/inventory', (0, inventory_routes_1.createInventoryRouter)(inventoryController));
    app.use('/api/customers', (0, customer_routes_1.createCustomerRouter)(customerController));
    app.use('/api/sales', (0, sales_routes_1.createSalesRouter)(salesController));
    app.use('/api/reports', (0, report_routes_1.createReportRouter)(reportController));
    // Ruta de bienvenida en el root (evita el error 'Cannot GET /')
    app.get('/', (req, res) => {
        res.status(200).send(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>3 Lobos Cervecería API</title>
          <style>
            body { 
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
              text-align: center; 
              padding: 60px 20px; 
              background-color: #0f172a; 
              color: #e2e8f0; 
            }
            .card {
              max-width: 600px;
              margin: 0 auto;
              background: #1e293b;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
              border: 1px solid #334155;
            }
            h1 { 
              color: #f59e0b; 
              margin-top: 0;
            }
            p { 
              font-size: 1.1em; 
              color: #94a3b8;
              line-height: 1.6;
            }
            code { 
              background: #0f172a; 
              padding: 3px 8px; 
              border-radius: 6px; 
              font-family: Consolas, monospace; 
              color: #38bdf8;
              font-size: 0.95em;
            }
            a {
              color: #38bdf8;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🍺 Cervecería 3 Lobos</h1>
            <p>El backend de tu aplicación SaaS está corriendo exitosamente.</p>
            <p>Los endpoints de negocio se encuentran bajo el prefijo: <code>/api</code></p>
            <p>Puedes verificar el estado del servidor en: <a href="/health"><code>/health</code></a></p>
          </div>
        </body>
      </html>
    `);
    });
    // Health-check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            service: '3 Lobos Cervecería API Backend',
            timestamp: new Date().toISOString()
        });
    });
    // Middleware global para manejo de errores de ruta
    app.use((err, req, res, next) => {
        console.error('Unhandled API Error:', err);
        res.status(500).json({
            error: err.message || 'Ocurrió un error inesperado en el servidor'
        });
    });
    return app;
}
