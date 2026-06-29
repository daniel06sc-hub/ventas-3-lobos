"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesController = void 0;
class SalesController {
    salesService;
    constructor(salesService) {
        this.salesService = salesService;
    }
    /**
     * Endpoint de checkout. Recibe el carrito, valida stock de forma atómica y descuenta inventario.
     */
    checkout = async (req, res) => {
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
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error en la transacción de venta' });
        }
    };
    /**
     * Historial de auditoría de ventas (Solo Admin).
     */
    history = async (req, res) => {
        try {
            const history = await this.salesService.getSalesHistory();
            return res.status(200).json(history);
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al obtener historial de auditoría' });
        }
    };
    /**
     * Modifica el estado de pago de una venta específica (ej. marcar crédito como pagado).
     */
    updatePaymentStatus = async (req, res) => {
        try {
            const { id } = req.params;
            const { paymentStatus } = req.body;
            if (!paymentStatus || !['pagado', 'pendiente'].includes(paymentStatus)) {
                return res.status(400).json({ error: 'Estado de pago inválido. Debe ser "pagado" o "pendiente"' });
            }
            await this.salesService.updatePaymentStatus(Number(id), paymentStatus);
            return res.status(200).json({ message: 'Estado de pago actualizado con éxito', id: Number(id), paymentStatus });
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al actualizar estado de pago' });
        }
    };
}
exports.SalesController = SalesController;
