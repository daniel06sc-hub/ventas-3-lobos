"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSalesRouter = createSalesRouter;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
function createSalesRouter(controller) {
    const router = (0, express_1.Router)();
    // El checkout está habilitado para vendedores y administradores en el punto de venta
    router.post('/checkout', auth_middleware_1.authenticateToken, controller.checkout);
    // El historial de auditoría de ventas es de uso exclusivo del Administrador
    router.get('/history', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.history);
    // Permitir a vendedores y administradores actualizar el estado de pago de las cuentas
    router.put('/:id/payment', auth_middleware_1.authenticateToken, controller.updatePaymentStatus);
    return router;
}
