"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
class ReportService {
    saleRepository;
    constructor(saleRepository) {
        this.saleRepository = saleRepository;
    }
    /**
     * Obtiene la agregación del rendimiento de ventas de cada vendedor.
     * Retorna el monto total recaudado y la cantidad de transacciones ejecutadas.
     */
    async getSellersPerformance(month) {
        return this.saleRepository.getSellerPerformance(month);
    }
}
exports.ReportService = ReportService;
