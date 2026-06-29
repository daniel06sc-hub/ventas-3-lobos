import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ReportService } from '../../../application/report.service';

export class ReportController {
  constructor(private reportService: ReportService) {}

  /**
   * Endpoint de rendimiento de vendedores. Exclusivo para Administradores.
   */
  getSellersPerformance = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { month } = req.query;
      const performance = await this.reportService.getSellersPerformance(month as string);
      return res.status(200).json(performance);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al generar reporte de rendimiento' });
    }
  };
}
