"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesService = void 0;
const database_1 = require("../config/database");
class SalesService {
    beerStyleRepository;
    customerRepository;
    saleRepository;
    systemSettingsRepository;
    constructor(beerStyleRepository, customerRepository, saleRepository, systemSettingsRepository) {
        this.beerStyleRepository = beerStyleRepository;
        this.customerRepository = customerRepository;
        this.saleRepository = saleRepository;
        this.systemSettingsRepository = systemSettingsRepository;
    }
    /**
     * Procesa un checkout de punto de venta (POS) de manera atómica.
     * Realiza validación de stock, descuento de inventario, cálculo de totales y registro en auditoría.
     */
    async processCheckout(input, seller) {
        if (!input.items || input.items.length === 0) {
            throw new Error('El carrito de compras no puede estar vacío');
        }
        const db = await (0, database_1.getDatabase)();
        // Iniciar transacción atómica en SQLite
        await db.run('BEGIN TRANSACTION');
        try {
            // 1. Obtener la variable global de unidades mayoristas actual
            const wholesaleSetting = await db.get('SELECT value FROM system_settings WHERE key = ?', 'wholesale_units');
            const W = wholesaleSetting ? parseInt(wholesaleSetting.value, 10) : 23;
            // 2. Validar cliente si es necesario
            let customerName = 'Público General';
            let customerId = null;
            if (input.customerId) {
                // Ejecutado dentro de la transacción para consistencia de lectura
                const customer = await db.get('SELECT * FROM customers WHERE id = ?', input.customerId);
                if (!customer) {
                    throw new Error('El cliente corporativo seleccionado no existe');
                }
                customerName = customer.business_name;
                customerId = customer.id;
            }
            // Generar ID único correlativo para toda esta venta agrupada
            const dateStr = new Date().toISOString().replace(/T/, '').replace(/\..+/, '').replace(/-|:/g, '');
            const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
            const correlationId = `TR-${dateStr}-${randStr}`;
            const salesToRecord = [];
            let totalPaid = 0;
            // 3. Iterar por cada ítem en el carrito para validar stock, precios y descontar
            for (const item of input.items) {
                if (item.quantity <= 0) {
                    throw new Error('La cantidad solicitada de cada ítem debe ser mayor que 0');
                }
                if (!item.styles || item.styles.length === 0) {
                    throw new Error('Cada ítem del carrito debe contener al menos un estilo de cerveza especificado.');
                }
                // Determinar cuántas botellas individuales representa el formato elegido por pack
                let bottlesPerFormat = 0;
                switch (item.format) {
                    case 'unit':
                        bottlesPerFormat = 1;
                        break;
                    case 'pack2':
                        bottlesPerFormat = 2;
                        break;
                    case 'pack3':
                        bottlesPerFormat = 3;
                        break;
                    case 'pack4':
                        bottlesPerFormat = 4;
                        break;
                    case 'wholesale':
                        bottlesPerFormat = W;
                        break;
                    default:
                        throw new Error(`Formato de venta no reconocido: ${item.format}`);
                }
                // Validar que la suma física de botellas en el desglose coincida con (botellas del formato * cantidad de packs)
                const expectedTotalBottles = bottlesPerFormat * item.quantity;
                const actualTotalBottles = item.styles.reduce((sum, s) => sum + s.bottlesCount, 0);
                if (expectedTotalBottles !== actualTotalBottles) {
                    throw new Error(`El desglose de botellas no coincide con el formato de venta. Esperado: ${expectedTotalBottles} botellas para el formato ${item.format} (cantidad: ${item.quantity}). Recibido: ${actualTotalBottles} botellas en total.`);
                }
                // Procesar cada estilo dentro del pack mixto o simple
                for (const styleBreakdown of item.styles) {
                    if (styleBreakdown.bottlesCount <= 0) {
                        throw new Error('La cantidad de botellas de cada estilo en un pack mixto debe ser mayor a 0');
                    }
                    // Obtener datos del estilo en caliente dentro de la transacción
                    const beerStyle = await db.get('SELECT * FROM beer_styles WHERE id = ?', styleBreakdown.beerStyleId);
                    if (!beerStyle) {
                        throw new Error(`El estilo de cerveza solicitado no existe en catálogo`);
                    }
                    // Determinar precio del formato de este estilo
                    let priceOfFormat = 0;
                    switch (item.format) {
                        case 'unit':
                            priceOfFormat = beerStyle.price_unit;
                            break;
                        case 'pack2':
                            priceOfFormat = beerStyle.price_pack2;
                            break;
                        case 'pack3':
                            priceOfFormat = beerStyle.price_pack3;
                            break;
                        case 'pack4':
                            priceOfFormat = beerStyle.price_pack4;
                            break;
                        case 'wholesale':
                            priceOfFormat = beerStyle.price_wholesale;
                            break;
                    }
                    // A. Validar stock disponible para este estilo en particular
                    if (beerStyle.stock_bottles < styleBreakdown.bottlesCount) {
                        throw new Error(`Stock insuficiente para el estilo "${beerStyle.name}". Solicitado en pack mixto/simple: ${styleBreakdown.bottlesCount} botellas. Stock disponible actual: ${beerStyle.stock_bottles} botellas.`);
                    }
                    // B. Calcular precios (proporcional si es un pack mixto)
                    const pricePerBottleInFormat = priceOfFormat / bottlesPerFormat;
                    const portionTotalAmount = pricePerBottleInFormat * styleBreakdown.bottlesCount;
                    totalPaid += portionTotalAmount;
                    // C. Descontar stock
                    const newStock = beerStyle.stock_bottles - styleBreakdown.bottlesCount;
                    await db.run('UPDATE beer_styles SET stock_bottles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, beerStyle.id);
                    // D. Registrar línea de auditoría
                    salesToRecord.push({
                        correlationId,
                        transactionDate: new Date(),
                        sellerId: seller.id,
                        sellerName: seller.name,
                        customerId,
                        customerName,
                        beerStyleId: beerStyle.id,
                        beerStyleName: beerStyle.name,
                        formatSold: item.format,
                        unitsSold: styleBreakdown.bottlesCount,
                        unitPrice: pricePerBottleInFormat,
                        totalAmount: portionTotalAmount,
                        paymentStatus: input.paymentStatus || 'pagado'
                    });
                }
            }
            // 4. Guardar todas las líneas en el historial permanente de ventas y auditoría
            const insertStmt = await db.prepare(`INSERT INTO sales (
          correlation_id, seller_id, seller_name, customer_id, customer_name,
          beer_style_id, beer_style_name, format_sold, units_sold, unit_price, total_amount, payment_status, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`);
            for (const sale of salesToRecord) {
                await insertStmt.run(sale.correlationId, sale.sellerId, sale.sellerName, sale.customerId, sale.customerName, sale.beerStyleId, sale.beerStyleName, sale.formatSold, sale.unitsSold, sale.unitPrice, sale.totalAmount, sale.paymentStatus);
            }
            await insertStmt.finalize();
            // Confirmar transacción si todo es correcto y no hubo errores
            await db.run('COMMIT');
            return {
                correlationId,
                totalPaid,
                sales: salesToRecord
            };
        }
        catch (error) {
            // Revertir cualquier cambio en la base de datos si ocurre un error
            await db.run('ROLLBACK');
            throw error;
        }
    }
    /**
     * Obtiene el historial completo de ventas registradas (Admin).
     */
    async getSalesHistory() {
        return this.saleRepository.listAll();
    }
    /**
     * Actualiza el estado de pago de una venta específica.
     */
    async updatePaymentStatus(id, status) {
        await this.saleRepository.updatePaymentStatus(id, status);
    }
}
exports.SalesService = SalesService;
