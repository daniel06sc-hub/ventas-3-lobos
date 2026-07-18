import { Request, Response } from 'express';
import { EventService } from '../../../application/event.service';
import { getDatabase } from '../../../config/database';
import * as crypto from 'crypto';

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

  listEventProducts = async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const db = await getDatabase();
      const products = await db.all('SELECT * FROM event_products WHERE event_id = ? ORDER BY name ASC', eventId);
      return res.status(200).json(products);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al listar productos del evento' });
    }
  };

  addEventProduct = async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { name, price, stock } = req.body;
      if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Nombre, precio y stock son campos obligatorios' });
      }

      const db = await getDatabase();
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      await db.run(
        'INSERT INTO event_products (id, event_id, name, price, stock) VALUES (?, ?, ?, ?, ?)',
        id,
        eventId,
        name,
        Number(price),
        Number(stock)
      );

      const created = { id, eventId, name, price, stock };
      return res.status(201).json(created);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al agregar producto al evento' });
    }
  };

  updateEventProduct = async (req: Request, res: Response) => {
    try {
      const { eventId, productId } = req.params;
      const { price, stock } = req.body;

      const db = await getDatabase();
      const product = await db.get('SELECT * FROM event_products WHERE event_id = ? AND id = ?', eventId, productId);
      if (!product) {
        return res.status(404).json({ error: 'El producto solicitado no existe en este evento' });
      }

      const newPrice = price !== undefined ? Number(price) : product.price;
      const newStock = stock !== undefined ? Number(stock) : product.stock;

      await db.run(
        'UPDATE event_products SET price = ?, stock = ? WHERE id = ?',
        newPrice,
        newStock,
        productId
      );

      return res.status(200).json({ id: productId, eventId, name: product.name, price: newPrice, stock: newStock });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al actualizar producto del evento' });
    }
  };

  deleteEventProduct = async (req: Request, res: Response) => {
    try {
      const { eventId, productId } = req.params;
      const db = await getDatabase();
      await db.run('DELETE FROM event_products WHERE event_id = ? AND id = ?', eventId, productId);
      return res.status(200).json({ message: 'Producto eliminado del evento con éxito' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al eliminar producto del evento' });
    }
  };
}
