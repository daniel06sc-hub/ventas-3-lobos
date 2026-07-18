import { getDatabase } from '../config/database';
import { IBeerStyleRepository, ICustomerRepository, ISaleRepository, ISystemSettingsRepository, IEventRepository } from '../domain/repositories';
import { CheckoutInput, Sale, SalesFormat, CheckoutItem } from '../domain/entities';

export class SalesService {
  constructor(
    private beerStyleRepository: IBeerStyleRepository,
    private customerRepository: ICustomerRepository,
    private saleRepository: ISaleRepository,
    private systemSettingsRepository: ISystemSettingsRepository,
    private eventRepository: IEventRepository
  ) {}

  /**
   * Procesa un checkout de punto de venta (POS) de manera atómica.
   * Realiza validación de stock, descuento de inventario, cálculo de totales y registro en auditoría.
   */
  async processCheckout(
    input: CheckoutInput,
    seller: { id: string; name: string }
  ): Promise<{ correlationId: string; totalPaid: number; sales: Sale[] }> {
    if (!input.items || input.items.length === 0) {
      throw new Error('El carrito de compras no puede estar vacío');
    }

    const db = await getDatabase();
    
    // Iniciar transacción atómica en SQLite
    await db.run('BEGIN TRANSACTION');

    try {
      // 1. Obtener la variable global de unidades mayoristas actual
      const wholesaleSetting = await db.get('SELECT value FROM system_settings WHERE key = ?', 'wholesale_units');
      const W = wholesaleSetting ? parseInt(wholesaleSetting.value, 10) : 23;

      // 2. Validar cliente si es necesario
      let customerName = 'Público General';
      let customerId: string | null = null;

      if (input.customerId) {
        // Ejecutado dentro de la transacción para consistencia de lectura
        const customer = await db.get('SELECT * FROM customers WHERE id = ?', input.customerId);
        if (!customer) {
          throw new Error('El cliente corporativo seleccionado no existe');
        }
        customerName = customer.business_name;
        customerId = customer.id;
      }

      // Validar evento si se asoció
      let eventId: string | null = null;
      let eventName: string | null = null;
      if (input.eventId) {
        const event = await db.get('SELECT * FROM events WHERE id = ?', input.eventId);
        if (event) {
          eventId = event.id;
          eventName = event.name;
        }
      }

      // Generar ID único correlativo para toda esta venta agrupada
      const dateStr = new Date().toISOString().replace(/T/, '').replace(/\..+/, '').replace(/-|:/g, '');
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const correlationId = `TR-${dateStr}-${randStr}`;

      const salesToRecord: Sale[] = [];
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
          case 'unit': bottlesPerFormat = 1; break;
          case 'pack2': bottlesPerFormat = 2; break;
          case 'pack3': bottlesPerFormat = 3; break;
          case 'pack4': bottlesPerFormat = 4; break;
          case 'wholesale': bottlesPerFormat = W; break;
          default:
            throw new Error(`Formato de venta no reconocido: ${item.format}`);
        }

        // Validar que la suma física de botellas en el desglose coincida con (botellas del formato * cantidad de packs)
        const expectedTotalBottles = bottlesPerFormat * item.quantity;
        const actualTotalBottles = item.styles.reduce((sum, s) => sum + s.bottlesCount, 0);
        if (expectedTotalBottles !== actualTotalBottles) {
          throw new Error(
            `El desglose de botellas no coincide con el formato de venta. Esperado: ${expectedTotalBottles} botellas para el formato ${item.format} (cantidad: ${item.quantity}). Recibido: ${actualTotalBottles} botellas en total.`
          );
        }

        // Procesar cada estilo dentro del pack mixto o simple
        for (const styleBreakdown of item.styles) {
          if (styleBreakdown.bottlesCount <= 0) {
            throw new Error('La cantidad de botellas de cada estilo en un pack mixto debe ser mayor a 0');
          }

          let isEventProd = false;
          let eventProdName = '';
          let eventProdPrice = 0;

          if (eventId) {
            const evProduct = await db.get('SELECT * FROM event_products WHERE event_id = ? AND id = ?', eventId, styleBreakdown.beerStyleId);
            if (evProduct) {
              isEventProd = true;
              eventProdName = evProduct.name;
              eventProdPrice = evProduct.price;

              // Registrar línea de auditoría (sin descontar stock de inventario)
              const portionTotalAmount = evProduct.price * styleBreakdown.bottlesCount;
              totalPaid += portionTotalAmount;

              salesToRecord.push({
                correlationId,
                transactionDate: new Date(),
                sellerId: seller.id,
                sellerName: seller.name,
                customerId,
                customerName,
                beerStyleId: null, // null para evitar fallos de FK
                beerStyleName: evProduct.name,
                formatSold: item.format,
                unitsSold: styleBreakdown.bottlesCount,
                unitPrice: evProduct.price,
                totalAmount: portionTotalAmount,
                paymentStatus: input.paymentStatus || 'pagado',
                eventId,
                eventName
              });
            }
          }

          if (!isEventProd) {
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
              throw new Error(
                `Stock insuficiente para el estilo "${beerStyle.name}". Solicitado en pack mixto/simple: ${styleBreakdown.bottlesCount} botellas. Stock disponible actual: ${beerStyle.stock_bottles} botellas.`
              );
            }

            // B. Calcular precios (proporcional si es un pack mixto)
            const pricePerBottleInFormat = priceOfFormat / bottlesPerFormat;
            const portionTotalAmount = pricePerBottleInFormat * styleBreakdown.bottlesCount;
            totalPaid += portionTotalAmount;

            // C. Descontar stock
            const newStock = beerStyle.stock_bottles - styleBreakdown.bottlesCount;
            await db.run(
              'UPDATE beer_styles SET stock_bottles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              newStock,
              beerStyle.id
            );

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
              paymentStatus: input.paymentStatus || 'pagado',
              eventId,
              eventName
            });
          }
        }
      }

      // 4. Guardar todas las líneas en el historial permanente de ventas y auditoría
      const insertStmt = await db.prepare(
        `INSERT INTO sales (
          correlation_id, seller_id, seller_name, customer_id, customer_name,
          beer_style_id, beer_style_name, format_sold, units_sold, unit_price, total_amount, payment_status, event_id, event_name, payment_method, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`
      );

      for (const sale of salesToRecord) {
        await insertStmt.run(
          sale.correlationId,
          sale.sellerId,
          sale.sellerName,
          sale.customerId,
          sale.customerName,
          sale.beerStyleId,
          sale.beerStyleName,
          sale.formatSold,
          sale.unitsSold,
          sale.unitPrice,
          sale.totalAmount,
          sale.paymentStatus,
          sale.eventId || null,
          sale.eventName || null,
          input.paymentMethod || 'efectivo'
        );
      }
      await insertStmt.finalize();

      // Confirmar transacción si todo es correcto y no hubo errores
      await db.run('COMMIT');

      // Obtener teléfono del cliente
      let recipientPhone = input.customerPhone || null;
      if (!recipientPhone && input.customerId) {
        const customer = await db.get('SELECT phone FROM customers WHERE id = ?', input.customerId);
        if (customer && customer.phone) {
          recipientPhone = customer.phone;
        }
      }

      // Envío de WhatsApp en segundo plano (para no bloquear el hilo de ejecución principal del POS)
      if (recipientPhone) {
        this.triggerWhatsAppVoucher(correlationId, recipientPhone, salesToRecord, totalPaid, input.paymentStatus || 'pagado')
          .catch(err => console.error('Error al enviar voucher por WhatsApp:', err));
      }

      return {
        correlationId,
        totalPaid,
        sales: salesToRecord
      };
    } catch (error) {
      // Revertir cualquier cambio en la base de datos si ocurre un error
      try {
        await db.run('ROLLBACK');
      } catch (rollbackError) {
        // Ignorar el error de rollback para no tapar el error de negocio original
        console.error('Error al ejecutar ROLLBACK en la transacción:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Envía de forma automática el voucher en formato texto de WhatsApp al cliente.
   * Utiliza la API oficial de WhatsApp Business Cloud (Meta) si las credenciales están configuradas.
   */
  private async triggerWhatsAppVoucher(
    correlationId: string,
    recipientPhone: string,
    sales: Sale[],
    totalPaid: number,
    paymentStatus: string
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const senderPhoneSetting = await db.get("SELECT value FROM system_settings WHERE key = 'whatsapp_sender_number'");
      const tokenSetting = await db.get("SELECT value FROM system_settings WHERE key = 'whatsapp_token'");
      const phoneIdSetting = await db.get("SELECT value FROM system_settings WHERE key = 'whatsapp_phone_number_id'");
      
      const senderNumber = senderPhoneSetting ? senderPhoneSetting.value : '';
      const accessToken = tokenSetting ? tokenSetting.value : '';
      const phoneNumberId = phoneIdSetting ? phoneIdSetting.value : '';

      if (!senderNumber) {
        console.log(`[WhatsApp Simulado] No se envió mensaje porque no se ha configurado un número entregador en settings.`);
        return;
      }

      const dateStr = new Date().toLocaleString('es-ES', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
      const first = sales[0];
      const sellerName = first ? first.sellerName : 'Sistema';
      const customerName = first ? first.customerName : 'Cliente Detalle';

      const formatNames: Record<string, string> = {
        unit: '1 Botella',
        pack2: 'Pack de 2',
        pack3: 'Pack de 3',
        pack4: 'Pack de 4',
        wholesale: 'Wholesale'
      };

      const itemMap = new Map<string, { format: string; qty: number; styles: string[]; subtotal: number }>();
      for (const s of sales) {
        const key = `${s.formatSold}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            format: formatNames[s.formatSold] || s.formatSold,
            qty: s.unitsSold,
            styles: [],
            subtotal: s.totalAmount
          });
        } else {
          const val = itemMap.get(key)!;
          val.subtotal += s.totalAmount;
          val.qty += s.unitsSold;
        }
        itemMap.get(key)!.styles.push(`${s.unitsSold} ${s.beerStyleName.split(' (')[0]}`);
      }

      let itemsText = '';
      itemMap.forEach((val) => {
        itemsText += `• *${val.format}* (${val.styles.join(', ')}) - $${val.subtotal.toFixed(2)}\n`;
      });

      const paymentLabel = paymentStatus === 'pendiente' ? 'PENDIENTE (A Crédito)' : 'PAGADO (Saldado)';

      const messageBody = `🍺 *Cervecería 3 Lobos* 🍺\n` +
                          `¡Hola! Aquí tienes el comprobante de tu compra:\n\n` +
                          `*Voucher ID:* \`${correlationId}\`\n` +
                          `*Fecha:* ${dateStr}\n` +
                          `*Atendido por:* ${sellerName}\n` +
                          `*Cliente:* ${customerName}\n\n` +
                          `*Detalle de Compra:*\n${itemsText}\n` +
                          `*TOTAL:* $${totalPaid.toFixed(2)}\n` +
                          `*Estado:* ${paymentLabel}\n\n` +
                          `¡Muchas gracias por su preferencia! 🐺🐺🐺`;

      console.log(`\n--- ENVIANDO VOUCHER WHATSAPP DESDE: ${senderNumber} PARA: ${recipientPhone} ---`);
      console.log(messageBody);
      console.log('------------------------------------------------------------\n');

      if (accessToken && phoneNumberId) {
        const cleanRecipient = recipientPhone.replace(/\+/g, '').replace(/\s/g, '').trim();
        // Llamada a la API de WhatsApp Cloud
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanRecipient,
            type: 'text',
            text: {
              preview_url: false,
              body: messageBody
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json() as any;
          console.error('Error al enviar WhatsApp a través de la API oficial de Meta:', errData);
        } else {
          console.log(`✓ Mensaje enviado exitosamente a través de la API oficial de Meta para: ${cleanRecipient}`);
        }
      } else {
        console.log(`[WhatsApp MOCK] Para enviar mensajes de forma real, configura 'whatsapp_token' y 'whatsapp_phone_number_id' en el panel de administrador.`);
      }
    } catch (err) {
      console.error('Error al procesar envío de WhatsApp:', err);
    }
  }

  /**
   * Obtiene el historial completo de ventas registradas (Admin).
   */
  async getSalesHistory(): Promise<Sale[]> {
    return this.saleRepository.listAll();
  }

  /**
   * Actualiza el estado de pago de una venta específica.
   */
  async updatePaymentStatus(id: number, status: 'pagado' | 'pendiente'): Promise<void> {
    await this.saleRepository.updatePaymentStatus(id, status);
  }

  /**
   * Elimina una transacción completa por su correlativo de venta (correlationId)
   * y repone de manera atómica el stock físico de cada estilo de cerveza en inventario.
   */
  async deleteTransactionByCorrelationId(correlationId: string): Promise<void> {
    const db = await getDatabase();
    
    // Iniciar transacción atómica
    await db.run('BEGIN TRANSACTION');

    try {
      // 1. Obtener todas las líneas de venta asociadas a este correlationId
      const sales = await db.all('SELECT beer_style_id, units_sold FROM sales WHERE correlation_id = ?', correlationId);

      // 2. Reponer el stock para cada línea física de cerveza
      for (const sale of sales) {
        if (sale.beer_style_id) {
          const style = await db.get('SELECT stock_bottles FROM beer_styles WHERE id = ?', sale.beer_style_id);
          if (style) {
            const newStock = style.stock_bottles + sale.units_sold;
            await db.run('UPDATE beer_styles SET stock_bottles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, sale.beer_style_id);
          }
        }
      }

      // 3. Eliminar los registros de auditoría de venta asociados
      await db.run('DELETE FROM sales WHERE correlation_id = ?', correlationId);

      // Confirmar cambios
      await db.run('COMMIT');
    } catch (error) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error al realizar rollback en eliminación de transacción:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Sincroniza un lote de ventas realizadas en modo offline.
   * Clampea a 0 el stock si la cantidad vendida offline supera las existencias actuales,
   * garantizando que la transacción no falle por la restricción stock_bottles >= 0.
   */
  async syncOfflineSales(
    salesPayload: {
      correlationId: string;
      transactionDate: string;
      customerId?: string | null;
      customerName?: string;
      paymentStatus: 'pagado' | 'pendiente';
      paymentMethod: string;
      eventId?: string | null;
      eventName?: string | null;
      items: {
        beerStyleId: string;
        beerStyleName: string;
        quantity: number; // physical bottles sold
        unitPrice: number;
        totalAmount: number;
      }[];
    }[],
    seller: { id: string; name: string }
  ): Promise<void> {
    if (!salesPayload || salesPayload.length === 0) {
      return;
    }

    const db = await getDatabase();
    await db.run('BEGIN TRANSACTION');

    try {
      for (const t of salesPayload) {
        // Verificar si esta transacción ya fue sincronizada previamente (evitar duplicados)
        const existing = await db.get('SELECT id FROM sales WHERE correlation_id = ? LIMIT 1', t.correlationId);
        if (existing) {
          continue; // saltar si ya existe
        }

        const customerName = t.customerName || 'Público General';
        const customerId = t.customerId || null;
        const eventId = t.eventId || null;
        const eventName = t.eventName || null;

        for (const item of t.items) {
          if (item.quantity <= 0) continue;

          let isEventProd = false;
          let dbStyleId = null;

          if (eventId) {
            const evProduct = await db.get('SELECT * FROM event_products WHERE event_id = ? AND id = ?', eventId, item.beerStyleId);
            if (evProduct) {
              isEventProd = true;
              // No stock updates for event products since they are not tracked as inventory
            }
          }

          if (!isEventProd) {
            // Obtener stock actual
            const beerStyle = await db.get('SELECT * FROM beer_styles WHERE id = ?', item.beerStyleId);
            if (beerStyle) {
              dbStyleId = beerStyle.id;
              // Descontar stock con clampeo a 0
              let newStock = beerStyle.stock_bottles - item.quantity;
              if (newStock < 0) {
                newStock = 0; // clampear a 0 para no romper la restricción CHECK(stock_bottles >= 0)
              }
              await db.run(
                'UPDATE beer_styles SET stock_bottles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                newStock,
                beerStyle.id
              );
            }
          }

          // Registrar en la tabla sales
          await db.run(
            `INSERT INTO sales (
              correlation_id, seller_id, seller_name, customer_id, customer_name,
              beer_style_id, beer_style_name, format_sold, units_sold, unit_price, total_amount, payment_status, event_id, event_name, payment_method, transaction_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            t.correlationId,
            seller.id,
            seller.name,
            dbStyleId,
            item.beerStyleName,
            'unit', // Las ventas rápidas de festival se registran como formato individual 'unit'
            item.quantity,
            item.unitPrice,
            item.totalAmount,
            t.paymentStatus || 'pagado',
            eventId,
            eventName,
            t.paymentMethod || 'efectivo',
            t.transactionDate
          );
        }
      }
      await db.run('COMMIT');
    } catch (error) {
      try {
        await db.run('ROLLBACK');
      } catch (err) {
        console.error('Error al realizar rollback en syncOfflineSales:', err);
      }
      throw error;
    }
  }
}
