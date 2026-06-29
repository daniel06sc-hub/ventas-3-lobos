"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInventoryRouter = createInventoryRouter;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
function createInventoryRouter(controller) {
    const router = (0, express_1.Router)();
    // Todos los usuarios autenticados pueden ver el inventario y leer los settings
    router.get('/', auth_middleware_1.authenticateToken, controller.listStyles);
    router.get('/settings', auth_middleware_1.authenticateToken, controller.getSettings);
    // Solo los Administradores de 3 Lobos pueden editar el catálogo de estilos o modificar variables
    router.post('/', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.createStyle);
    router.put('/settings', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.updateSettings);
    router.put('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin', 'vendedor'), controller.updateStyle);
    router.delete('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.deleteStyle);
    return router;
}
