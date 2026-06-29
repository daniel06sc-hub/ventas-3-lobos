"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || '3lobos-super-secret-key-123!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
class AuthService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    /**
     * Autentica un usuario y genera un JWT si las credenciales son correctas.
     */
    async login(username, passwordPlain) {
        const user = await this.userRepository.findByUsername(username);
        if (!user) {
            throw new Error('Credenciales inválidas');
        }
        const isMatch = await bcryptjs_1.default.compare(passwordPlain, user.passwordHash);
        if (!isMatch) {
            throw new Error('Credenciales inválidas');
        }
        // Generar Payload del token (sin incluir datos sensibles como hashes)
        const payload = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return { token, user: payload };
    }
    /**
     * Registra un nuevo usuario en la base de datos (con hashing de contraseña).
     */
    async register(username, passwordPlain, name, role) {
        if (!username || !passwordPlain || !name || !role) {
            throw new Error('Todos los campos son obligatorios');
        }
        const existingUser = await this.userRepository.findByUsername(username);
        if (existingUser) {
            throw new Error('El nombre de usuario ya está registrado');
        }
        const passwordHash = await bcryptjs_1.default.hash(passwordPlain, 10);
        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const newUser = {
            id,
            username,
            passwordHash,
            name,
            role,
            createdAt: new Date()
        };
        await this.userRepository.create(newUser);
        return {
            id: newUser.id,
            username: newUser.username,
            name: newUser.name,
            role: newUser.role
        };
    }
    /**
     * Obtiene la lista completa de usuarios registrados.
     */
    async listUsers() {
        const users = await this.userRepository.listAll();
        return users.map(({ passwordHash, ...rest }) => rest);
    }
    /**
     * Modifica un usuario existente. Si se proporciona contraseña, se hashea.
     */
    async updateUser(id, data) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }
        if (data.username !== user.username) {
            const existingUser = await this.userRepository.findByUsername(data.username);
            if (existingUser) {
                throw new Error('El nombre de usuario ya está registrado');
            }
        }
        let passwordHash = user.passwordHash;
        if (data.passwordPlain && data.passwordPlain.trim() !== '') {
            passwordHash = await bcryptjs_1.default.hash(data.passwordPlain, 10);
        }
        const updatedUser = {
            ...user,
            username: data.username,
            passwordHash,
            name: data.name,
            role: data.role
        };
        await this.userRepository.update(updatedUser);
    }
    /**
     * Elimina un usuario por ID.
     */
    async deleteUser(id) {
        await this.userRepository.delete(id);
    }
}
exports.AuthService = AuthService;
