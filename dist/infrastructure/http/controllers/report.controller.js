"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
class ReportController {
    reportService;
    constructor(reportService) {
        this.reportService = reportService;
    }
    /**
     * Endpoint de rendimiento de vendedores. Exclusivo para Administradores.
     */
    getSellersPerformance = async (req, res) => {
        try {
            const { month } = req.query;
            const performance = await this.reportService.getSellersPerformance(month);
            return res.status(200).json(performance);
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al generar reporte de rendimiento' });
        }
    };
}
exports.ReportController = ReportController;
