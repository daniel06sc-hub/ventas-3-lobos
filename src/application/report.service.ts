import { ISaleRepository } from '../domain/repositories';

export interface SellerPerformance {
  sellerId: string;
  sellerName: string;
  totalRevenue: number;
  transactionCount: number;
}

export class ReportService {
  constructor(private saleRepository: ISaleRepository) {}

  /**
   * Obtiene la agregación del rendimiento de ventas de cada vendedor.
   * Retorna el monto total recaudado y la cantidad de transacciones ejecutadas.
   */
  async getSellersPerformance(month?: string): Promise<SellerPerformance[]> {
    return this.saleRepository.getSellerPerformance(month);
  }
}
