"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
class InventoryController {
    inventoryService;
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    listStyles = async (req, res) => {
        try {
            const styles = await this.inventoryService.listBeerStyles();
            return res.status(200).json(styles);
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al listar estilos' });
        }
    };
    createStyle = async (req, res) => {
        try {
            const style = await this.inventoryService.createBeerStyle(req.body);
            return res.status(201).json(style);
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al crear estilo de cerveza' });
        }
    };
    updateStyle = async (req, res) => {
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
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al actualizar estilo de cerveza' });
        }
    };
    deleteStyle = async (req, res) => {
        try {
            const { id } = req.params;
            await this.inventoryService.deleteBeerStyle(id);
            return res.status(200).json({ message: 'Estilo de cerveza eliminado exitosamente' });
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al eliminar estilo de cerveza' });
        }
    };
    getSettings = async (req, res) => {
        try {
            const units = await this.inventoryService.getWholesaleUnits();
            return res.status(200).json({ wholesale_units: units });
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al obtener configuraciones' });
        }
    };
    updateSettings = async (req, res) => {
        try {
            const { wholesale_units } = req.body;
            if (wholesale_units === undefined) {
                return res.status(400).json({ error: 'El parámetro wholesale_units es requerido' });
            }
            const unitsVal = parseInt(wholesale_units, 10);
            await this.inventoryService.updateWholesaleUnits(unitsVal);
            return res.status(200).json({ message: 'Configuración de formato mayorista actualizada', wholesale_units: unitsVal });
        }
        catch (error) {
            return res.status(400).json({ error: error.message || 'Error al actualizar configuraciones' });
        }
    };
}
exports.InventoryController = InventoryController;
