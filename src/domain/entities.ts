// Capa de Dominio - Entidades y Tipos

export type UserRole = 'admin' | 'supervisor' | 'vendedor';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  isActive: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
}

export type CustomerType = 'retail' | 'wholesale';

export interface Customer {
  id: string;
  businessName: string;
  fiscalId: string; // Rut / Identificación Fiscal
  phone: string;
  contactName?: string | null;   // Nombre del contacto
  address?: string | null;       // Dirección física
  ivaPercent: number;            // % IVA (Ej: 19.0)
  ilaPercent: number;            // % Impuesto Adicional ILA (Ej: 15.0 o 0.0)
  customerType: CustomerType;
  createdAt: Date;
}

export interface BeerStyle {
  id: string;
  name: string;
  stockBottles: number;
  priceUnit: number;
  pricePack2: number;
  pricePack3: number;
  pricePack4: number;
  priceWholesale: number;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
}

export interface Event {
  id: string;
  name: string;
  city: string;
  startDate: Date;
  endDate: Date;
  status: 'activo' | 'finalizado';
  createdAt: Date;
}

export type SalesFormat = 'unit' | 'pack2' | 'pack3' | 'pack4' | 'wholesale';

export interface Sale {
  id?: number;
  correlationId: string;
  transactionDate: Date;
  sellerId: string;
  sellerName: string;
  customerId: string | null;
  customerName: string;
  beerStyleId: string | null;
  beerStyleName: string;
  formatSold: SalesFormat;
  units_sold?: number; // legacy compatibility
  unitsSold: number; // total bottles deducted for this format * quantity
  unitPrice: number; // price of the chosen format
  totalAmount: number; // unitPrice * quantity
  paymentStatus: 'pagado' | 'pendiente'; // Estado de pago ('pagado' o 'pendiente')
  eventId?: string | null;    // ID del evento asociado
  eventName?: string | null;  // Nombre del evento histórico
  paymentMethod?: string;     // Método de pago utilizado ('efectivo', 'tarjeta', etc.)
}

// DTOs (Data Transfer Objects) e inputs
export interface CheckoutStyleBreakdown {
  beerStyleId: string;
  bottlesCount: number; // Cantidad física de botellas de este estilo
}

export interface CheckoutItem {
  format: SalesFormat;
  quantity: number; // Cantidad de packs / unidades solicitadas
  styles: CheckoutStyleBreakdown[]; // Desglose de estilos que componen el pack
}

export interface CheckoutInput {
  customerId?: string; // Optional customer ID for discount/association
  customerPhone?: string; // Teléfono opcional para entrega de voucher por WhatsApp
  paymentStatus?: 'pagado' | 'pendiente'; // Estado de pago inicial de la venta (opcional, por defecto 'pagado')
  eventId?: string; // ID opcional del evento asociado
  paymentMethod?: string; // Método de pago ('efectivo', 'tarjeta', 'transferencia', 'otro')
  items: CheckoutItem[];
}

export interface AuthUserPayload {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}
