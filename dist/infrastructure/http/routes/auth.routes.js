"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
function createAuthRouter(controller) {
    const router = (0, express_1.Router)();
    // Ruta pública para iniciar sesión
    router.post('/login', controller.login);
    // Registro, consulta, modificación y eliminación de usuarios (solo administradores)
    router.post('/register', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.register);
    router.get('/users', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.listUsers);
    router.put('/users/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.updateUser);
    router.delete('/users/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('admin'), controller.deleteUser);
    return router;
}
