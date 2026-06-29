"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomerRouter = createCustomerRouter;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
function createCustomerRouter(controller) {
    const router = (0, express_1.Router)();
    // Tanto vendedores como administradores pueden registrar, listar o buscar clientes corporativos
    router.get('/', auth_middleware_1.authenticateToken, controller.listOrSearchCustomers);
    router.post('/', auth_middleware_1.authenticateToken, controller.createCustomer);
    router.put('/:id', auth_middleware_1.authenticateToken, controller.updateCustomer);
    router.delete('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.deleteCustomer);
    return router;
}
