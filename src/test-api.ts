import { createExpressApp } from './infrastructure/http';
import { Server } from 'http';
import fs from 'fs';
import path from 'path';

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function runTests() {
  console.log('\n==================================================');
  console.log(' INICIANDO PRUEBAS DE INTEGRACIÓN: 3 LOBOS BACKEND');
  console.log('==================================================\n');

  // Intentar eliminar base de datos de pruebas previa para asegurar limpieza.
  // Si está bloqueada por el servidor dev en ejecución, no hay problema, usamos nombres dinámicos.
  const dbPath = path.resolve(__dirname, '../database.db');
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
      console.log('[Test Setup] Base de datos previa eliminada para asegurar idempotencia.');
    } catch (err) {
      console.log('[Test Setup] Nota: No se eliminó la BD previa (archivo ocupado). Usando parámetros dinámicos.');
    }
  }

  // Generar sufijo y parámetros únicos para evitar conflictos con claves duplicadas
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const testStyleName = `3 Lobos IPA de Prueba ${randSuffix}`;
  const testCustomerName = `Lobo Gourmet Bistro ${randSuffix}`;
  const testFiscalId = `77.777.${Math.floor(100 + Math.random() * 900)}-${randSuffix.substring(0, 1)}`;

  // 1. Levantar servidor Express en puerto de prueba
  let server: Server;
  try {
    const app = await createExpressApp();
    server = app.listen(TEST_PORT);
    console.log(`[Server] Servidor de prueba corriendo en puerto ${TEST_PORT}`);
  } catch (err) {
    console.error('Error al levantar el servidor de pruebas:', err);
    process.exit(1);
  }

  let adminToken = '';
  let vendedorToken = '';
  let uniqueVendedorId = '';
  let createdBeerStyleId = '';
  let createdCustomerId = '';

  try {
    // ----------------------------------------------------
    // TEST 1: Seguridad y RBAC (Login y roles)
    // ----------------------------------------------------
    console.log('--- TEST 1: Autenticación y JWT ---');
    
    // Login con contraseña incorrecta
    const loginFailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert(loginFailRes.status === 401, 'Debería rebotar con 401 credenciales incorrectas');
    console.log('✓ Login fallido controlado correctamente.');

    // Login Admin
    const loginAdminRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    if (loginAdminRes.status !== 200) {
      console.error('Login failed response:', await loginAdminRes.text());
    }
    assert(loginAdminRes.status === 200, 'Debería loguearse exitosamente');
    const adminData = await loginAdminRes.json() as any;
    adminToken = adminData.token;
    assert(adminData.user.role === 'admin', 'El rol retornado debe ser admin');
    console.log('✓ Autenticación de Admin exitosa.');

    // Registrar un vendedor único para esta corrida de pruebas para evitar colisiones en los reportes acumulados
    const testVendedorUser = `vendedor_${randSuffix.toLowerCase()}`;
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        username: testVendedorUser,
        password: 'vendedorpassword123',
        name: `Vendedor ${randSuffix}`,
        role: 'vendedor'
      })
    });
    assert(registerRes.status === 201, 'Admin debe poder registrar un nuevo vendedor');
    const registerData = await registerRes.json() as any;
    uniqueVendedorId = registerData.id;
    console.log(`✓ Vendedor único registrado para el test. ID: ${uniqueVendedorId}`);

    // Login Vendedor Único
    const loginVendedorRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testVendedorUser, password: 'vendedorpassword123' })
    });
    assert(loginVendedorRes.status === 200, 'Debería loguearse exitosamente');
    const vendedorData = await loginVendedorRes.json() as any;
    vendedorToken = vendedorData.token;
    assert(vendedorData.user.role === 'vendedor', 'El rol retornado debe ser vendedor');
    console.log('✓ Autenticación de Vendedor exitosa.');


    // ----------------------------------------------------
    // TEST 2: RBAC Control de accesos restringido
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Control de Acceso RBAC Estricto ---');

    // Intentar cambiar settings globales con token de Vendedor
    const updateSettingsVendedorRes = await fetch(`${BASE_URL}/inventory/settings`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({ wholesale_units: 30 })
    });
    assert(updateSettingsVendedorRes.status === 403, 'Vendedor no debe poder modificar variables globales');
    console.log('✓ Bloqueo exitoso de Vendedor en rutas administrativas.');

    // Cambiar settings con token de Admin
    const updateSettingsAdminRes = await fetch(`${BASE_URL}/inventory/settings`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ wholesale_units: 24 }) // Cambiamos a 24 temporalmente
    });
    assert(updateSettingsAdminRes.status === 200, 'Admin debe poder actualizar variables globales');
    console.log('✓ Admin modificó variable global (wholesale_units a 24) con éxito.');

    // Comprobar que cambió la variable global
    const getSettingsRes = await fetch(`${BASE_URL}/inventory/settings`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    const settingsData = await getSettingsRes.json() as any;
    assert(settingsData.wholesale_units === 24, 'La variable wholesale_units debería ser ahora 24');
    console.log('✓ Verificación de lectura de variable global exitosa.');

    // Regresar a 23 para la lógica de la cervecería
    await fetch(`${BASE_URL}/inventory/settings`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ wholesale_units: 23 })
    });


    // ----------------------------------------------------
    // TEST 3: CRUD de Inventario y precios (Admin vs Vendedor)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: CRUD de Inventario por Estilos (Admin) ---');

    // Vendedor intenta crear un estilo (Debe fallar)
    const createStyleVendedorRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        name: '3 Lobos Bock',
        stockBottles: 100,
        priceUnit: 1200,
        pricePack2: 2200,
        pricePack3: 3200,
        pricePack4: 4000,
        priceWholesale: 20000
      })
    });
    assert(createStyleVendedorRes.status === 403, 'Vendedor no debe poder crear cervezas');

    // Admin crea estilo exitosamente
    const createStyleAdminRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testStyleName,
        stockBottles: 50, // Stock inicial: 50 botellas
        priceUnit: 2000,   // Unidad
        pricePack2: 3800,  // Pack 2
        pricePack3: 5400,  // Pack 3
        pricePack4: 7000,  // Pack 4
        priceWholesale: 30000 // Formato Mayorista (23 unidades)
      })
    });
    assert(createStyleAdminRes.status === 201, 'Admin debe poder crear cervezas');
    const createdStyle = await createStyleAdminRes.json() as any;
    createdBeerStyleId = createdStyle.id;
    console.log(`✓ Estilo creado por Admin. ID: ${createdBeerStyleId}. Stock: 50 botellas.`);


    // ----------------------------------------------------
    // TEST 4: Fichas de Clientes (Restaurantes)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Gestión de Clientes Corporativos ---');

    // Crear cliente corporativo (restaurante) con token de Vendedor
    const createCustomerRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        businessName: testCustomerName,
        fiscalId: testFiscalId,
        phone: '+56999999999'
      })
    });
    assert(createCustomerRes.status === 201, 'El vendedor debe poder registrar clientes corporativos');
    const customerData = await createCustomerRes.json() as any;
    createdCustomerId = customerData.id;
    console.log(`✓ Cliente corporativo creado por vendedor. ID: ${createdCustomerId}`);

    // Buscar clientes en POS
    const searchRes = await fetch(`${BASE_URL}/customers?q=${randSuffix}`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    const searchData = await searchRes.json() as any;
    assert(searchData.length >= 1, 'Debería encontrar al menos un cliente en la búsqueda');
    assert(searchData[0].businessName === testCustomerName, 'Debería coincidir el nombre comercial');
    console.log('✓ Búsqueda de cliente corporativo para POS validada.');


    // ----------------------------------------------------
    // TEST 5: Motor de Venta Transaccional y Control de Stock
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Lógica de Venta Atómica y Descuento de Stock ---');

    // Caso A: Venta Detalle exitosa (Pack de 4 cervezas, cantidad 2 = 8 botellas)
    // Precio Pack 4 = 7000. Total = 14000.
    const saleDetalleRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        items: [{
          format: 'pack4',
          quantity: 2,
          styles: [{
            beerStyleId: createdBeerStyleId,
            bottlesCount: 8
          }]
        }]
      })
    });
    assert(saleDetalleRes.status === 201, 'Venta al detalle debería procesarse con éxito');
    const saleDetalleData = await saleDetalleRes.json() as any;
    assert(saleDetalleData.totalPaid === 14000, 'El total calculado debe ser 14000 (7000 * 2)');
    console.log('✓ Venta al detalle exitosa. Monto calculado: 14000.');

    // Verificar stock: era 50, se vendieron 2 pack de 4 (8 botellas), debe quedar en 42.
    const getInventoryRes1 = await fetch(`${BASE_URL}/inventory`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    const styles1 = await getInventoryRes1.json() as any;
    const style1 = styles1.find((s: any) => s.id === createdBeerStyleId);
    assert(style1.stockBottles === 42, `El stock restante debe ser 42 botellas, actual: ${style1.stockBottles}`);
    console.log('✓ Descuento de stock en unidades individuales correcto (50 -> 42 botellas).');

    // Caso B: Compra en formato mayorista SIN asociar cliente (Ahora Permitido para Público General)
    // Para asegurar independencia de estado, creamos un estilo temporal específico para esta venta.
    const createStyle2Res = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `3 Lobos Temp Style ${randSuffix}`,
        stockBottles: 50,
        priceUnit: 1500,
        pricePack2: 2800,
        pricePack3: 4000,
        pricePack4: 5000,
        priceWholesale: 25000
      })
    });
    const style2Data = await createStyle2Res.json() as any;
    const tempBeerStyleId = style2Data.id;

    const wholesalePublicRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        items: [{
          format: 'wholesale',
          quantity: 1,
          styles: [{
            beerStyleId: tempBeerStyleId,
            bottlesCount: 23
          }]
        }]
      })
    });
    if (wholesalePublicRes.status !== 201) {
      console.error('ERROR BODY:', await wholesalePublicRes.text());
    }
    assert(wholesalePublicRes.status === 201, 'Venta mayorista sin cliente asociado (público general) debería completarse');
    const wholesalePublicData = await wholesalePublicRes.json() as any;
    assert(wholesalePublicData.totalPaid === 25000, 'El total calculado debe ser 25000 (precio mayorista de style-ipa)');
    console.log('✓ Venta mayorista a público general autorizada con éxito.');

    // Caso C: Compra mayorista exitosa CON cliente asociado (1 Pack Mayorista = 23 botellas)
    // Precio mayorista de este estilo = 30000. Total = 30000.
    const wholesaleOkRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        items: [{
          format: 'wholesale',
          quantity: 1,
          styles: [{
            beerStyleId: createdBeerStyleId,
            bottlesCount: 23
          }]
        }]
      })
    });
    assert(wholesaleOkRes.status === 201, 'Venta mayorista con cliente asociado debería completarse');
    const wholesaleOkData = await wholesaleOkRes.json() as any;
    assert(wholesaleOkData.totalPaid === 30000, 'El total calculado debe ser 30000');
    console.log('✓ Venta mayorista exitosa con cliente asociado. Monto calculado: 30000.');

    // Verificar stock: era 42, se restaron 23 botellas, debe quedar en 19.
    const getInventoryRes2 = await fetch(`${BASE_URL}/inventory`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    const styles2 = await getInventoryRes2.json() as any;
    const style2 = styles2.find((s: any) => s.id === createdBeerStyleId);
    assert(style2.stockBottles === 19, `El stock restante debe ser 19 botellas, actual: ${style2.stockBottles}`);
    console.log('✓ Descuento de stock en unidades del Formato Mayorista correcto (42 -> 19 botellas).');

    // Caso D: Intento de compra con stock insuficiente (Falla atómica)
    // Intentar comprar 1 formato mayorista (requiere 23 botellas), pero solo quedan 19.
    const insufficientStockRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        items: [{
          format: 'wholesale',
          quantity: 1,
          styles: [{
            beerStyleId: createdBeerStyleId,
            bottlesCount: 23
          }]
        }]
      })
    });
    assert(insufficientStockRes.status === 400, 'Debería fallar por stock insuficiente');
    const insufficientStockData = await insufficientStockRes.json() as any;
    assert(insufficientStockData.error.includes('Stock insuficiente'), 'Debe retornar error explícito de stock');
    console.log('✓ Congelación y bloqueo atómico por stock insuficiente validada.');

    // Caso E: Venta de Pack de 3 Mixto (2 de Cerveza de prueba y 1 de Stout)
    // Cerveza de prueba Pack 3 = 5400 (5400 / 3 = 1800 por botella). Para 2 botellas = 3600.
    // Stout Pack 3 = 4300 (4300 / 3 = 1433.33 por botella). Para 1 botella = 1433.33.
    // Total esperado: 3600 + 1433.33 = 5033.33

    // Consultar stock de Stout antes de la venta mixta para independizar la prueba
    const getInventoryResBefore = await fetch(`${BASE_URL}/inventory`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    const stylesBefore = await getInventoryResBefore.json() as any;
    const stoutStyleBefore = stylesBefore.find((s: any) => s.id === 'style-stout');
    const stoutStockBefore = stoutStyleBefore.stockBottles;

    const saleMixtaRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        items: [{
          format: 'pack3',
          quantity: 1,
          styles: [
            { beerStyleId: createdBeerStyleId, bottlesCount: 2 },
            { beerStyleId: 'style-stout', bottlesCount: 1 }
          ]
        }]
      })
    });
    assert(saleMixtaRes.status === 201, 'Venta de pack mixto debería procesarse con éxito');
    const saleMixtaData = await saleMixtaRes.json() as any;
    const diff = Math.abs(saleMixtaData.totalPaid - 5033.33);
    assert(diff < 0.1, `El total calculado debe ser cercano a 5033.33, recibido: ${saleMixtaData.totalPaid}`);
    console.log(`✓ Venta de Pack Mixto exitosa. Monto calculado: ${saleMixtaData.totalPaid}`);

    // Verificar stocks:
    // Cerveza prueba era 19, debe quedar en 17.
    // Stout debe haber disminuido en 1 botella.
    const getInventoryRes4 = await fetch(`${BASE_URL}/inventory`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    const styles4 = await getInventoryRes4.json() as any;
    const testStyleAfter = styles4.find((s: any) => s.id === createdBeerStyleId);
    const stoutStyleAfter = styles4.find((s: any) => s.id === 'style-stout');
    assert(testStyleAfter.stockBottles === 17, `Stock restante prueba debe ser 17, actual: ${testStyleAfter.stockBottles}`);
    assert(stoutStyleAfter.stockBottles === stoutStockBefore - 1, `Stock restante Stout debe decrementar en 1, antes: ${stoutStockBefore}, actual: ${stoutStyleAfter.stockBottles}`);
    console.log('✓ Descuento multi-stock atómico de pack mixto verificado correctamente.');

    // ----------------------------------------------------
    // TEST 6: Reportes y Auditoría (Admin)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Reportes de Rendimiento y Auditoría de Ventas ---');

    // Vendedor intenta ver el historial de auditoría de ventas (Falla)
    const historyVendedorRes = await fetch(`${BASE_URL}/sales/history`, {
      headers: { 'Authorization': `Bearer ${vendedorToken}` }
    });
    assert(historyVendedorRes.status === 403, 'Vendedor no debe poder ver auditoría de ventas');

    // Admin consulta el historial de auditoría de ventas (Éxito)
    const historyAdminRes = await fetch(`${BASE_URL}/sales/history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(historyAdminRes.status === 200, 'Admin debe poder ver auditoría de ventas');
    const historyData = await historyAdminRes.json() as any;
    
    // Verificar que las tres transacciones exitosas del test estén en el historial con datos completos
    const testSales = historyData.filter((s: any) => s.beerStyleId === createdBeerStyleId);
    assert(testSales.length === 3, 'Debe haber exactamente 3 registros de auditoría para nuestro estilo de prueba');
    
    // Verificar detalles de auditoría requeridos
    const wholesaleAudit = testSales.find((s: any) => s.formatSold === 'wholesale');
    assert(wholesaleAudit.sellerName === `Vendedor ${randSuffix}`, 'Debe figurar el nombre del vendedor en sesión');
    assert(wholesaleAudit.customerName === testCustomerName, 'Debe figurar el nombre del restaurante');
    assert(wholesaleAudit.unitsSold === 23, 'Debe figurar la cantidad de botellas restadas');
    assert(wholesaleAudit.totalAmount === 30000, 'Debe figurar el total pagado de 30000');
    assert(wholesaleAudit.correlationId !== undefined, 'Debe contener un correlationId de transacción');
    console.log('✓ Auditoría permanente con registros completos validada exitosamente.');

    // Admin consulta el reporte de rendimiento financiero por vendedor
    const reportRes = await fetch(`${BASE_URL}/reports/sellers`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(reportRes.status === 200, 'Admin debe poder ver el reporte de vendedores');
    const reportData = await reportRes.json() as any;
    
    // Buscar al vendedor por ID y verificar rendimiento
    const sellerPerformance = reportData.find((r: any) => r.sellerId === uniqueVendedorId);
    assert(sellerPerformance !== undefined, 'El vendedor único de la prueba debe estar en el reporte');
    assert(sellerPerformance.transactionCount === 4, 'El vendedor debe registrar exactamente 4 transacciones en el POS (Caso A, B, C y E)');
    const revenueDiff = Math.abs(sellerPerformance.totalRevenue - 74033.33);
    assert(revenueDiff < 0.1, `El monto total recaudado debe ser de 74033.33, actual: ${sellerPerformance.totalRevenue}`);
    console.log('✓ Reportes de rendimiento (recaudación total y número de transacciones por vendedor) generados correctamente.');


    // ----------------------------------------------------
    // TEST 7: Registro de Cuentas Pendientes (Crédito) y Cobro
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Registro de Cuentas Pendientes (Crédito) y Cobros ---');

    // Vendedor registra una compra a crédito ('pendiente') para el cliente corporativo
    const pendingSaleRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        paymentStatus: 'pendiente',
        items: [{
          format: 'pack2',
          quantity: 1,
          styles: [{ beerStyleId: 'style-stout', bottlesCount: 2 }]
        }]
      })
    });
    assert(pendingSaleRes.status === 201, 'Venta a crédito debería registrarse exitosamente');
    const pendingSaleData = await pendingSaleRes.json() as any;
    const correlationIdPending = pendingSaleData.correlationId;
    console.log(`✓ Venta a crédito registrada con éxito. Correlation ID: ${correlationIdPending}`);

    // Admin obtiene historial y verifica que el estado de esta venta es 'pendiente'
    const historyPendingRes = await fetch(`${BASE_URL}/sales/history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const historyPendingData = await historyPendingRes.json() as any;
    const recordedPendingSale = historyPendingData.find((s: any) => s.correlationId === correlationIdPending);
    assert(recordedPendingSale !== undefined, 'La venta debe estar en el historial');
    assert(recordedPendingSale.paymentStatus === 'pendiente', 'El estado inicial de la venta a crédito debe ser "pendiente"');
    console.log('✓ Estado de pago inicial "pendiente" verificado en la bitácora.');

    // Vendedor registra pago de esta cuenta por cobrar
    const paymentUpdateRes = await fetch(`${BASE_URL}/sales/${recordedPendingSale.id}/payment`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`
      },
      body: JSON.stringify({
        paymentStatus: 'pagado'
      })
    });
    assert(paymentUpdateRes.status === 200, 'Debería poder marcar la venta como pagada');
    console.log('✓ Solicitud de cobro procesada con éxito (Crédito -> Pagado).');

    // Admin verifica que el estado se actualizó a 'pagado'
    const historyUpdatedRes = await fetch(`${BASE_URL}/sales/history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const historyUpdatedData = await historyUpdatedRes.json() as any;
    const recordedUpdatedSale = historyUpdatedData.find((s: any) => s.id === recordedPendingSale.id);
    assert(recordedUpdatedSale.paymentStatus === 'pagado', 'El estado de la venta debe haberse actualizado a "pagado"');
    console.log('✓ Auditoría final: transacción saldada correctamente en base de datos.');

    // ----------------------------------------------------
    // TEST 8: Eliminación Segura de Entidades Referenciadas
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Eliminación Segura de Entidades Referenciadas (ON DELETE SET NULL) ---');

    // Admin elimina el cliente corporativo de prueba
    const deleteCustomerRes = await fetch(`${BASE_URL}/customers/${createdCustomerId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteCustomerRes.status === 200, 'Admin debe poder eliminar clientes corporativos');
    console.log('✓ Cliente corporativo eliminado exitosamente sin rebotar.');

    // Admin elimina el estilo de cerveza de prueba
    const deleteStyleRes = await fetch(`${BASE_URL}/inventory/${createdBeerStyleId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteStyleRes.status === 200, 'Admin debe poder eliminar estilos de cerveza');
    console.log('✓ Estilo de cerveza eliminado exitosamente sin rebotar.');

    // Admin elimina el vendedor de prueba
    const deleteVendedorRes = await fetch(`${BASE_URL}/auth/users/${uniqueVendedorId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteVendedorRes.status === 200, 'Admin debe poder eliminar cuentas de personal');
    console.log('✓ Cuenta de vendedor eliminada exitosamente sin rebotar.');

    // Verificar en el historial de ventas que los registros siguen existiendo y tienen los nombres correctos
    const historyFinalRes = await fetch(`${BASE_URL}/sales/history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const historyFinalData = await historyFinalRes.json() as any;
    
    // Buscar la venta Caso A (que usaba al vendedor y estilo borrado)
    const saleCasoA = historyFinalData.find((s: any) => s.beerStyleName === testStyleName);
    assert(saleCasoA !== undefined, 'La venta histórica de prueba debe persistir tras los borrados');
    assert(saleCasoA.sellerId === null, 'El sellerId debe haberse establecido en NULL en la base de datos');
    assert(saleCasoA.sellerName === `Vendedor ${randSuffix}`, 'El sellerName histórico debe conservarse intacto');
    assert(saleCasoA.beerStyleId === null, 'El beerStyleId debe haberse establecido en NULL en la base de datos');
    assert(saleCasoA.beerStyleName === testStyleName, 'El beerStyleName histórico debe conservarse intacto');
    console.log('✓ Auditoría histórica e integridad de datos validada tras eliminaciones.');

    // ----------------------------------------------------
    // TEST 9: Eliminación de Transacción y Reposición de Stock
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Eliminación de Transacción y Reposición de Stock ---');

    // 1. Crear un estilo de cerveza nuevo para la prueba
    const tempStyleName = `Temp-Style-${randSuffix}`;
    const createTempRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: tempStyleName,
        priceUnit: 3000,
        pricePack2: 6000,
        pricePack3: 8500,
        pricePack4: 10000,
        priceWholesale: 48300,
        stockBottles: 10 // stock inicial = 10
      })
    });
    const tempStyleData = await createTempRes.json() as any;
    const tempStyleId = tempStyleData.id;
    console.log(`✓ Cerveza temporal creada con 10 botellas. ID: ${tempStyleId}`);

    // 2. Realizar una venta de 4 botellas (Pack de 4) de esta cerveza
    const checkoutRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        items: [{
          format: 'pack4',
          quantity: 1,
          styles: [{ beerStyleId: tempStyleId, bottlesCount: 4 }]
        }]
      })
    });
    const checkoutData = await checkoutRes.json() as any;
    const correlationId = checkoutData.correlationId;
    console.log(`✓ Venta registrada. Correlation ID: ${correlationId}`);

    // 3. Verificar que el stock disminuyó de 10 a 6 botellas
    const checkStock1Res = await fetch(`${BASE_URL}/inventory`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const checkStock1Data = await checkStock1Res.json() as any;
    const tempStyleAfterSale = checkStock1Data.find((s: any) => s.id === tempStyleId);
    assert(tempStyleAfterSale.stockBottles === 6, `El stock debe haber bajado a 6 botellas, actualmente: ${tempStyleAfterSale.stockBottles}`);
    console.log('✓ Descuento de stock inicial confirmado (10 -> 6 botellas).');

    // 4. Eliminar la transacción de venta como administrador
    const deleteTxRes = await fetch(`${BASE_URL}/sales/transaction/${correlationId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteTxRes.status === 200, 'El Admin debe poder eliminar transacciones por su correlationId');
    console.log('✓ Transacción de venta eliminada exitosamente por administrador.');

    // 5. Verificar que el stock se repuso a 10 botellas
    const checkStock2Res = await fetch(`${BASE_URL}/inventory`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const checkStock2Data = await checkStock2Res.json() as any;
    const tempStyleAfterDelete = checkStock2Data.find((s: any) => s.id === tempStyleId);
    assert(tempStyleAfterDelete.stockBottles === 10, `El stock debe haberse repuesto a 10 botellas, actualmente: ${tempStyleAfterDelete.stockBottles}`);
    console.log('✓ Reposición de stock confirmada (6 -> 10 botellas).');

    // ----------------------------------------------------
    // TEST 10: Gestión de Productos de Evento (Feria / Festival)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Gestión de Productos de Evento (Feria / Festival) ---');

    // 1. Crear un evento temporal
    const testEventName = `Feria-Test-${randSuffix}`;
    const createEventRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testEventName,
        city: 'Curicó',
        startDate: '2026-07-20',
        endDate: '2026-07-22'
      })
    });
    const createdEvent = await createEventRes.json() as any;
    const testEventId = createdEvent.id;
    console.log(`✓ Evento temporal de test creado. ID: ${testEventId}`);

    // 2. Agregar un producto al evento (Schop con precio y stock modificado)
    const addProdRes = await fetch(`${BASE_URL}/events/${testEventId}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Schop Furia 500cc',
        price: 4500,
        stock: 50
      })
    });
    assert(addProdRes.status === 201, 'Debería crear el producto del evento exitosamente');
    const createdProd = await addProdRes.json() as any;
    const testEventProductId = createdProd.id;
    console.log(`✓ Producto de evento Schop Furia 500cc agregado. ID: ${testEventProductId}, Precio: 4500, Stock: 50`);

    // 3. Listar productos del evento y comprobar existencia
    const listProdsRes = await fetch(`${BASE_URL}/events/${testEventId}/products`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const eventProds = await listProdsRes.json() as any[];
    assert(eventProds.length === 1, 'Debería haber exactamente 1 producto asociado a este evento');
    assert(eventProds[0].name === 'Schop Furia 500cc', 'El nombre del producto debe coincidir');
    console.log('✓ Lista de productos del evento comprobada con éxito.');

    // 4. Realizar checkout online asociando el ID del evento y descontando del stock de event_products
    const evCheckoutRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        eventId: testEventId,
        paymentMethod: 'transferencia',
        items: [{
          format: 'unit',
          quantity: 2,
          styles: [{ beerStyleId: testEventProductId, bottlesCount: 2 }] // vender 2 schops
        }]
      })
    });
    if (evCheckoutRes.status !== 201) {
      const errBody = await evCheckoutRes.json();
      console.error('Checkout error response:', errBody);
    }
    assert(evCheckoutRes.status === 201, 'El checkout de venta del evento debería ser exitoso');
    const evCheckoutData = await evCheckoutRes.json() as any;
    console.log(`✓ Venta de feria completada con éxito. Correlation ID: ${evCheckoutData.correlationId}`);

    // 5. Verificar que el stock de event_products disminuyó de 50 a 48
    const listProds2Res = await fetch(`${BASE_URL}/events/${testEventId}/products`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const eventProdsAfter = await listProds2Res.json() as any[];
    assert(eventProdsAfter[0].stock === 48, `El stock del producto del evento debió reducirse a 48, actual: ${eventProdsAfter[0].stock}`);
    console.log('✓ Descuento de stock en producto del evento confirmado (50 -> 48).');

    // 6. Eliminar el producto del evento
    const deleteProdRes = await fetch(`${BASE_URL}/events/${testEventId}/products/${testEventProductId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteProdRes.status === 200, 'Debería eliminar el producto de feria exitosamente');
    console.log('✓ Producto eliminado del evento con éxito.');

    console.log('\n==================================================');
    console.log('   ¡TODAS LAS PRUEBAS SE COMPLETARON CON ÉXITO!   ');
    console.log('==================================================\n');

  } catch (error) {
    console.error('\n❌ ERROR EN UNA DE LAS PRUEBAS:', error);
    process.exit(1);
  } finally {
    // Apagar servidor
    server!.close(() => {
      console.log('[Server] Servidor de prueba cerrado.');
      process.exit(0);
    });
  }
}

// Función auxiliar de aserción simple
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Aserción fallida: ${message}`);
  }
}

runTests();
