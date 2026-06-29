import express from 'express';
import cors from 'cors';
import path from 'path';
import {
  SQLiteUserRepository,
  SQLiteCustomerRepository,
  SQLiteBeerStyleRepository,
  SQLiteSystemSettingsRepository,
  SQLiteSaleRepository
} from '../database/sqlite-repositories';
import { AuthService } from '../../application/auth.service';
import { InventoryService } from '../../application/inventory.service';
import { CustomerService } from '../../application/customer.service';
import { SalesService } from '../../application/sales.service';
import { ReportService } from '../../application/report.service';
import { AuthController } from './controllers/auth.controller';
import { InventoryController } from './controllers/inventory.controller';
import { CustomerController } from './controllers/customer.controller';
import { SalesController } from './controllers/sales.controller';
import { ReportController } from './controllers/report.controller';
import { createAuthRouter } from './routes/auth.routes';
import { createInventoryRouter } from './routes/inventory.routes';
import { createCustomerRouter } from './routes/customer.routes';
import { createSalesRouter } from './routes/sales.routes';
import { createReportRouter } from './routes/report.routes';
import { getDatabase } from '../../config/database';

/**
 * Fabrica y configura la instancia de la aplicación Express
 * realizando la inyección de dependencias limpia del Backend.
 */
export async function createExpressApp() {
  // Asegura la conexión e inicialización de SQLite
  await getDatabase();

  const app = express();

  // Middlewares globales
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, '../../../public')));

  // 1. Inyección de Repositorios (Detalle de Infraestructura)
  const userRepo = new SQLiteUserRepository();
  const customerRepo = new SQLiteCustomerRepository();
  const beerStyleRepo = new SQLiteBeerStyleRepository();
  const settingsRepo = new SQLiteSystemSettingsRepository();
  const saleRepo = new SQLiteSaleRepository();

  // 2. Inyección de Servicios de Aplicación (Lógica de Negocio)
  const authService = new AuthService(userRepo);
  const inventoryService = new InventoryService(beerStyleRepo, settingsRepo);
  const customerService = new CustomerService(customerRepo);
  const salesService = new SalesService(beerStyleRepo, customerRepo, saleRepo, settingsRepo);
  const reportService = new ReportService(saleRepo);

  // 3. Inyección de Controladores HTTP
  const authController = new AuthController(authService);
  const inventoryController = new InventoryController(inventoryService);
  const customerController = new CustomerController(customerService);
  const salesController = new SalesController(salesService);
  const reportController = new ReportController(reportService);

  // 4. Montaje de Enrutadores con prefijos REST API
  app.use('/api/auth', createAuthRouter(authController));
  app.use('/api/inventory', createInventoryRouter(inventoryController));
  app.use('/api/customers', createCustomerRouter(customerController));
  app.use('/api/sales', createSalesRouter(salesController));
  app.use('/api/reports', createReportRouter(reportController));

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
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled API Error:', err);
    res.status(500).json({
      error: err.message || 'Ocurrió un error inesperado en el servidor'
    });
  });

  return app;
}
