"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    login = async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
            }
            const result = await this.authService.login(username, password);
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(401).json({ error: error.message || 'Error de autenticación' });
        }
    };
    register = async (req, res) => {
        try {
            const { username, password, name, role } = req.body;
            const userPayload = await this.authService.register(username, password, name, role);
            return res.status(201).json(userPayload);
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al registrar usuario' });
        }
    };
    listUsers = async (req, res) => {
        try {
            const users = await this.authService.listUsers();
            return res.status(200).json(users);
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al obtener usuarios' });
        }
    };
    updateUser = async (req, res) => {
        try {
            const { id } = req.params;
            const { username, password, name, role } = req.body;
            await this.authService.updateUser(id, { username, passwordPlain: password, name, role });
            return res.status(200).json({ message: 'Usuario actualizado con éxito', id });
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al actualizar usuario' });
        }
    };
    deleteUser = async (req, res) => {
        try {
            const { id } = req.params;
            await this.authService.deleteUser(id);
            return res.status(200).json({ message: 'Usuario eliminado con éxito', id });
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al eliminar usuario' });
        }
    };
}
exports.AuthController = AuthController;
