// Capa de Dominio - Entidades y Tipos

export type UserRole = 'admin' | 'vendedor';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export type CustomerType = 'retail' | 'wholesale';

export interface Customer {
  id: string;
  businessName: string;
  fiscalId: string; // Rut / Identificación Fiscal
  phone: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
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
  beerStyleId: string;
  beerStyleName: string;
  formatSold: SalesFormat;
  unitsSold: number; // total bottles deducted for this format * quantity
  unitPrice: number; // price of the chosen format
  totalAmount: number; // unitPrice * quantity
  paymentStatus: 'pagado' | 'pendiente'; // Estado de pago ('pagado' o 'pendiente')
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
  paymentStatus?: 'pagado' | 'pendiente'; // Estado de pago inicial de la venta (opcional, por defecto 'pagado')
  items: CheckoutItem[];
}

export interface AuthUserPayload {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}
