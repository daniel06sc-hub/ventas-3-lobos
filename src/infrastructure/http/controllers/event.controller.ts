import { Request, Response } from 'express';
import { EventService } from '../../../application/event.service';

export class EventController {
  constructor(private eventService: EventService) {}

  listEvents = async (req: Request, res: Response) => {
    try {
      const events = await this.eventService.listEvents();
      return res.status(200).json(events);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al listar eventos' });
    }
  };

  createEvent = async (req: Request, res: Response) => {
    try {
      const event = await this.eventService.createEvent(req.body);
      return res.status(201).json(event);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al crear evento' });
    }
  };

  updateEvent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await this.eventService.updateEvent(id, req.body);
      return res.status(200).json(updated);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al actualizar evento' });
    }
  };

  deleteEvent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.eventService.deleteEvent(id);
      return res.status(200).json({ message: 'Evento eliminado exitosamente' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al eliminar evento' });
    }
  };
}
