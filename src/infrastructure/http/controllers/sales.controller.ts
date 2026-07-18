import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SalesService } from '../../../application/sales.service';

export class SalesController {
  constructor(private salesService: SalesService) {}

  /**
   * Endpoint de checkout. Recibe el carrito, valida stock de forma atómica y descuenta inventario.
   */
  checkout = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const seller = req.user;
      if (!seller) {
        return res.status(401).json({ error: 'Usuario no autenticado o sesión expirada' });
      }

      // El body contiene: { customerId?: string, items: [{ beerStyleId, format, quantity }] }
      const result = await this.salesService.processCheckout(req.body, {
        id: seller.id,
        name: seller.name
      });

      return res.status(201).json({
        message: 'Venta registrada con éxito',
        ...result
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error en la transacción de venta' });
    }
  };

  /**
   * Historial de auditoría de ventas (Solo Admin).
   */
  history = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const history = await this.salesService.getSalesHistory();
      return res.status(200).json(history);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al obtener historial de auditoría' });
    }
  };

  /**
   * Modifica el estado de pago de una venta específica (ej. marcar crédito como pagado).
   */
  updatePaymentStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;
      if (!paymentStatus || !['pagado', 'pendiente'].includes(paymentStatus)) {
        return res.status(400).json({ error: 'Estado de pago inválido. Debe ser "pagado" o "pendiente"' });
      }

      await this.salesService.updatePaymentStatus(Number(id), paymentStatus);
      return res.status(200).json({ message: 'Estado de pago actualizado con éxito', id: Number(id), paymentStatus });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al actualizar estado de pago' });
    }
  };

  /**
   * Elimina una transacción agrupada por correlativo y devuelve las unidades al stock (Solo Admin).
   */
  deleteTransaction = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { correlationId } = req.params;
      if (!correlationId) {
        return res.status(400).json({ error: 'El correlationId de la transacción es obligatorio' });
      }

      await this.salesService.deleteTransactionByCorrelationId(correlationId);
      return res.status(200).json({ message: 'Transacción eliminada de la bitácora y stock repuesto con éxito', correlationId });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al eliminar la transacción' });
    }
  };

  /**
   * Sincroniza un lote de ventas offline de festival de forma atómica.
   */
  sync = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const seller = req.user;
      if (!seller) {
        return res.status(401).json({ error: 'Usuario no autenticado o sesión expirada' });
      }

      const { sales } = req.body;
      if (!sales || !Array.isArray(sales)) {
        return res.status(400).json({ error: 'Payload inválido: se esperaba un array de ventas en la propiedad "sales"' });
      }

      await this.salesService.syncOfflineSales(sales, {
        id: seller.id,
        name: seller.name
      });

      return res.status(200).json({
        message: 'Lote de ventas offline sincronizado exitosamente en el servidor'
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error en la sincronización de ventas' });
    }
  };
}
