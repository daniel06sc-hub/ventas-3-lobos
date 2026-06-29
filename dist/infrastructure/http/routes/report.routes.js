"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportRouter = createReportRouter;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
function createReportRouter(controller) {
    const router = (0, express_1.Router)();
    // Módulo de reportes financieros y rendimiento exclusivo para el Administrador
    router.get('/sellers', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.getSellersPerformance);
    return router;
}
