import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { InventoryService } from '../../../application/inventory.service';

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  listStyles = async (req: Request, res: Response) => {
    try {
      const styles = await this.inventoryService.listBeerStyles();
      return res.status(200).json(styles);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al listar estilos' });
    }
  };

  createStyle = async (req: Request, res: Response) => {
    try {
      const style = await this.inventoryService.createBeerStyle(req.body);
      return res.status(201).json(style);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al crear estilo de cerveza' });
    }
  };

  updateStyle = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userPayload = req.user;
      
      let updatePayload = req.body;
      if (userPayload && userPayload.role === 'vendedor') {
        const currentStyle = await this.inventoryService.listBeerStyles().then(styles => styles.find(s => s.id === id));
        if (!currentStyle) {
          return res.status(404).json({ error: 'El estilo de cerveza solicitado no existe' });
        }
        
        // El vendedor solo puede modificar el stock. Forzamos los valores originales en los demás campos.
        updatePayload = {
          name: currentStyle.name,
          stockBottles: req.body.stockBottles !== undefined ? req.body.stockBottles : currentStyle.stockBottles,
          priceUnit: currentStyle.priceUnit,
          pricePack2: currentStyle.pricePack2,
          pricePack3: currentStyle.pricePack3,
          pricePack4: currentStyle.pricePack4,
          priceWholesale: currentStyle.priceWholesale
        };
      }

      const updated = await this.inventoryService.updateBeerStyle(id, updatePayload);
      return res.status(200).json(updated);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al actualizar estilo de cerveza' });
    }
  };

  deleteStyle = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.inventoryService.deleteBeerStyle(id);
      return res.status(200).json({ message: 'Estilo de cerveza eliminado exitosamente' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al eliminar estilo de cerveza' });
    }
  };

  getSettings = async (req: Request, res: Response) => {
    try {
      const units = await this.inventoryService.getWholesaleUnits();
      const whatsapp = await this.inventoryService.getWhatsAppSettings();
      return res.status(200).json({
        wholesale_units: units,
        whatsapp_sender_number: whatsapp.senderNumber,
        whatsapp_token: whatsapp.token,
        whatsapp_phone_number_id: whatsapp.phoneNumberId
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error al obtener configuraciones' });
    }
  };

  updateSettings = async (req: Request, res: Response) => {
    try {
      const { wholesale_units, whatsapp_sender_number, whatsapp_token, whatsapp_phone_number_id } = req.body;
      if (wholesale_units === undefined) {
        return res.status(400).json({ error: 'El parámetro wholesale_units es requerido' });
      }
      const unitsVal = parseInt(wholesale_units, 10);
      await this.inventoryService.updateWholesaleUnits(unitsVal);

      const senderNum = whatsapp_sender_number !== undefined ? String(whatsapp_sender_number).trim() : '';
      const token = whatsapp_token !== undefined ? String(whatsapp_token).trim() : '';
      const phoneId = whatsapp_phone_number_id !== undefined ? String(whatsapp_phone_number_id).trim() : '';

      await this.inventoryService.updateWhatsAppSettings(senderNum, token, phoneId);

      return res.status(200).json({
        message: 'Configuraciones del sistema actualizadas con éxito',
        wholesale_units: unitsVal,
        whatsapp_sender_number: senderNum,
        whatsapp_token: token,
        whatsapp_phone_number_id: phoneId
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al actualizar configuraciones' });
    }
  };
}
