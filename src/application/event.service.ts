import { IEventRepository } from '../domain/repositories';
import { Event } from '../domain/entities';

export class EventService {
  constructor(private eventRepository: IEventRepository) {}

  async createEvent(data: {
    name: string;
    city: string;
    startDate: string;
    endDate: string;
    status: 'activo' | 'finalizado';
  }): Promise<Event> {
    if (!data.name || !data.city || !data.startDate || !data.endDate) {
      throw new Error('Todos los campos del evento son requeridos');
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    const newEvent: Event = {
      id,
      name: data.name,
      city: data.city,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status || 'activo',
      createdAt: new Date()
    };

    await this.eventRepository.create(newEvent);
    return newEvent;
  }

  async updateEvent(
    id: string,
    data: Partial<Omit<Event, 'id' | 'createdAt'>>
  ): Promise<Event> {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new Error('El evento no existe');
    }

    if (data.name !== undefined) event.name = data.name;
    if (data.city !== undefined) event.city = data.city;
    if (data.startDate !== undefined) event.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) event.endDate = new Date(data.endDate);
    if (data.status !== undefined) event.status = data.status;

    await this.eventRepository.update(event);
    return event;
  }

  async listEvents(): Promise<Event[]> {
    return this.eventRepository.listAll();
  }

  async getEventById(id: string): Promise<Event | null> {
    return this.eventRepository.findById(id);
  }

  async deleteEvent(id: string): Promise<void> {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new Error('El evento no existe');
    }
    await this.eventRepository.delete(id);
  }
}
