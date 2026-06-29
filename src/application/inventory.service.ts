import { IBeerStyleRepository, ISystemSettingsRepository } from '../domain/repositories';
import { BeerStyle } from '../domain/entities';

export class InventoryService {
  constructor(
    private beerStyleRepository: IBeerStyleRepository,
    private systemSettingsRepository: ISystemSettingsRepository
  ) {}

  /**
   * Crea un nuevo estilo de cerveza en el catálogo.
   */
  async createBeerStyle(data: {
    name: string;
    stockBottles: number;
    priceUnit: number;
    pricePack2: number;
    pricePack3: number;
    pricePack4: number;
    priceWholesale: number;
  }): Promise<BeerStyle> {
    if (!data.name) {
      throw new Error('El nombre del estilo es obligatorio');
    }

    const existingStyle = await this.beerStyleRepository.findByName(data.name);
    if (existingStyle) {
      throw new Error('Ya existe un estilo de cerveza con este nombre');
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    const newStyle: BeerStyle = {
      id,
      name: data.name,
      stockBottles: data.stockBottles < 0 ? 0 : data.stockBottles,
      priceUnit: Math.max(0, data.priceUnit),
      pricePack2: Math.max(0, data.pricePack2),
      pricePack3: Math.max(0, data.pricePack3),
      pricePack4: Math.max(0, data.pricePack4),
      priceWholesale: Math.max(0, data.priceWholesale),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.beerStyleRepository.create(newStyle);
    return newStyle;
  }

  /**
   * Actualiza los datos o el inventario físico de un estilo existente (CRUD completo).
   */
  async updateBeerStyle(
    id: string,
    data: Partial<Omit<BeerStyle, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<BeerStyle> {
    const style = await this.beerStyleRepository.findById(id);
    if (!style) {
      throw new Error('El estilo de cerveza no existe');
    }

    if (data.name && data.name !== style.name) {
      const existingName = await this.beerStyleRepository.findByName(data.name);
      if (existingName) {
        throw new Error('Ya existe otro estilo de cerveza con este nombre');
      }
      style.name = data.name;
    }

    if (data.stockBottles !== undefined) {
      if (data.stockBottles < 0) {
        throw new Error('El stock no puede ser negativo');
      }
      style.stockBottles = data.stockBottles;
    }

    if (data.priceUnit !== undefined) style.priceUnit = Math.max(0, data.priceUnit);
    if (data.pricePack2 !== undefined) style.pricePack2 = Math.max(0, data.pricePack2);
    if (data.pricePack3 !== undefined) style.pricePack3 = Math.max(0, data.pricePack3);
    if (data.pricePack4 !== undefined) style.pricePack4 = Math.max(0, data.pricePack4);
    if (data.priceWholesale !== undefined) style.priceWholesale = Math.max(0, data.priceWholesale);

    style.updatedAt = new Date();

    await this.beerStyleRepository.update(style);
    return style;
  }

  /**
   * Elimina un estilo de cerveza.
   */
  async deleteBeerStyle(id: string): Promise<void> {
    const style = await this.beerStyleRepository.findById(id);
    if (!style) {
      throw new Error('El estilo de cerveza no existe');
    }
    await this.beerStyleRepository.delete(id);
  }

  /**
   * Lista todos los estilos de cerveza y sus respectivos precios.
   */
  async listBeerStyles(): Promise<BeerStyle[]> {
    return this.beerStyleRepository.listAll();
  }

  /**
   * Obtiene la variable global configurable que define la cantidad de unidades en el Formato Mayorista.
   */
  async getWholesaleUnits(): Promise<number> {
    const value = await this.systemSettingsRepository.getVal('wholesale_units');
    return value ? parseInt(value, 10) : 23;
  }

  /**
   * Modifica la variable global configurable del Formato Mayorista (Admin).
   */
  async updateWholesaleUnits(units: number): Promise<void> {
    if (!units || units <= 0) {
      throw new Error('La cantidad de unidades para formato mayorista debe ser mayor a 0');
    }
    await this.systemSettingsRepository.setVal(
      'wholesale_units',
      units.toString(),
      'Cantidad de unidades (botellas) que componen el Formato Mayorista'
    );
  }
}
