import { Request, Response } from 'express';
import { AuthService } from '../../../application/auth.service';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
      }

      const result = await this.authService.login(username, password);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || 'Error de autenticación' });
    }
  };

  register = async (req: Request, res: Response) => {
    try {
      const { username, password, name, role } = req.body;
      const userPayload = await this.authService.register(username, password, name, role);
      return res.status(201).json(userPayload);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al registrar usuario' });
    }
  };

  listUsers = async (req: Request, res: Response) => {
    try {
      const users = await this.authService.listUsers();
      return res.status(200).json(users);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al obtener usuarios' });
    }
  };

  updateUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { username, password, name, role } = req.body;
      await this.authService.updateUser(id, { username, passwordPlain: password, name, role });
      return res.status(200).json({ message: 'Usuario actualizado con éxito', id });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al actualizar usuario' });
    }
  };

  deleteUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.authService.deleteUser(id);
      return res.status(200).json({ message: 'Usuario eliminado con éxito', id });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al eliminar usuario' });
    }
  };
}
