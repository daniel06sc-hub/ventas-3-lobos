import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../domain/repositories';
import { User, AuthUserPayload, UserRole } from '../domain/entities';

const JWT_SECRET = process.env.JWT_SECRET || '3lobos-super-secret-key-123!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export class AuthService {
  constructor(private userRepository: IUserRepository) {}

  /**
   * Autentica un usuario y genera un JWT si las credenciales son correctas y el usuario está activo.
   */
  async login(username: string, passwordPlain: string): Promise<{ token: string; user: AuthUserPayload }> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    // Verificar si el usuario está activo
    if (user.isActive === false) {
      throw new Error('El usuario se encuentra desactivado. Contacte al administrador.');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Credenciales inválidas');
    }

    // Actualizar fecha del último acceso
    user.lastLogin = new Date();
    await this.userRepository.update(user);

    // Generar Payload del token (sin incluir datos sensibles como hashes)
    const payload: AuthUserPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    return { token, user: payload };
  }

  /**
   * Registra un nuevo usuario en la base de datos (con hashing de contraseña).
   */
  async register(username: string, passwordPlain: string, name: string, role: UserRole, phone?: string): Promise<AuthUserPayload> {
    if (!username || !passwordPlain || !name || !role) {
      throw new Error('Todos los campos son obligatorios');
    }

    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new Error('El nombre de usuario ya está registrado');
    }

    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    const newUser: User = {
      id,
      username,
      passwordHash,
      name,
      role,
      phone: phone || '',
      isActive: true,
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
   * Devuelve la lista completa de usuarios registrados.
   */
  async listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.userRepository.listAll();
    return users.map(({ passwordHash, ...rest }) => rest);
  }

  /**
   * Modifica un usuario existente. Si se proporciona contraseña, se hashea.
   */
  async updateUser(
    id: string,
    data: {
      username: string;
      passwordPlain?: string;
      name: string;
      role: UserRole;
      phone?: string;
      isActive?: boolean;
    }
  ): Promise<void> {
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
      passwordHash = await bcrypt.hash(data.passwordPlain, 10);
    }

    const updatedUser: User = {
      ...user,
      username: data.username,
      passwordHash,
      name: data.name,
      role: data.role,
      phone: data.phone !== undefined ? data.phone : user.phone,
      isActive: data.isActive !== undefined ? data.isActive : user.isActive
    };

    await this.userRepository.update(updatedUser);
  }

  /**
   * Elimina un usuario por ID.
   */
  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
