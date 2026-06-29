import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

export function createReportRouter(controller: ReportController): Router {
  const router = Router();

  // Módulo de reportes financieros y rendimiento exclusivo para el Administrador
  router.get('/sellers', authenticateToken, authorizeRoles('admin'), controller.getSellersPerformance);

  return router;
}
