/**
 * Persistence & Initial Seed Data for Small Business Inventory
 */

import { Product, ReorderOrder, ScanLogItem, EmailMessage, EmailConfig } from '../core/types';

const STORAGE_KEYS = {
  PRODUCTS: 'stockpulse_supply_chain_data_v1',
  ORDERS: 'stockpulse_orders_v2',
  LOGS: 'stockpulse_logs_v2',
  EMAILS: 'stockpulse_emails_v2',
  CONFIG: 'stockpulse_config_v2',
};

export const DEFAULT_CONFIG: EmailConfig = {
  provider: 'simulated',
  ownerEmail: 'kprasant1603@gmail.com',
  businessName: 'Apex Supply & Fulfillment Co.',
  senderEmail: 'inventory@apexsupply.local',
};

/**
 * Connected from /public/assets/aistudio/Supply_Chain_AI_Demo_Data_266a34ef
 * Item Name,Current Stock,Minimum Required Stock,Unit
 */
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    sku: 'SUP-TOWL-001',
    barcode: '793573192070',
    name: 'Paper towel boxes',
    category: 'Facilities & Janitorial',
    currentStock: 5, // Deficit: 15 -> Reorder 15
    minThreshold: 20,
    unit: 'boxes',
    price: 28.50,
    costPrice: 16.00,
    supplierName: 'CleanPro Solutions',
    supplierEmail: 'orders@cleanpro.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  {
    id: 'prod_2',
    sku: 'PKG-BOX-002',
    barcode: '793573192071',
    name: 'Cardboard box packs',
    category: 'Shipping Supplies',
    currentStock: 12, // Deficit: 8 -> Reorder 8
    minThreshold: 20,
    unit: 'packs',
    price: 36.00,
    costPrice: 19.50,
    supplierName: 'Apex Packaging Direct',
    supplierEmail: 'supply@apexpackaging.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  {
    id: 'prod_3',
    sku: 'JAN-SOAP-003',
    barcode: '793573192072',
    name: 'Hand soap bottles',
    category: 'Facilities & Janitorial',
    currentStock: 30, // Surplus: 15 -> Healthy (No reorder)
    minThreshold: 15,
    unit: 'bottles',
    price: 6.50,
    costPrice: 3.20,
    supplierName: 'CleanPro Solutions',
    supplierEmail: 'orders@cleanpro.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  {
    id: 'prod_4',
    sku: 'PKG-TAPE-004',
    barcode: '793573192073',
    name: 'Packing tape rolls',
    category: 'Shipping Supplies',
    currentStock: 25, // Surplus: 15 -> Healthy (No reorder)
    minThreshold: 10,
    unit: 'rolls',
    price: 4.75,
    costPrice: 2.10,
    supplierName: 'Apex Packaging Direct',
    supplierEmail: 'supply@apexpackaging.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  {
    id: 'prod_5',
    sku: 'PKG-BUBL-005',
    barcode: '793573192074',
    name: 'Bubble wrap rolls',
    category: 'Shipping Supplies',
    currentStock: 2, // Deficit: 6 -> Reorder 6
    minThreshold: 8,
    unit: 'rolls',
    price: 24.00,
    costPrice: 12.00,
    supplierName: 'Apex Packaging Direct',
    supplierEmail: 'supply@apexpackaging.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  {
    id: 'prod_6',
    sku: 'LBL-THRM-006',
    barcode: '793573192075',
    name: 'Thermal shipping labels',
    category: 'Shipping Supplies',
    currentStock: 1500, // Deficit: 1500 -> Reorder 1500
    minThreshold: 3000,
    unit: 'labels',
    price: 0.05,
    costPrice: 0.02,
    supplierName: 'PrintFast Logistics',
    supplierEmail: 'labels@printfast.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  {
    id: 'prod_7',
    sku: 'OFF-SHRP-007',
    barcode: '793573192076',
    name: 'Sharpie markers',
    category: 'Office Supplies',
    currentStock: 18, // Surplus: 6 -> Healthy (No reorder)
    minThreshold: 12,
    unit: 'pcs',
    price: 1.85,
    costPrice: 0.90,
    supplierName: 'Metro Stationers',
    supplierEmail: 'orders@metrostationers.example.com',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
];

export function loadProducts(): Product[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return parsed;
  } catch {
    return INITIAL_PRODUCTS;
  }
}

export function saveProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products:', e);
  }
}

export function loadOrders(): ReorderOrder[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveOrders(orders: ReorderOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to save orders:', e);
  }
}

export function loadLogs(): ScanLogItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLogs(logs: ScanLogItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 100))); // retain latest 100
  } catch (e) {
    console.error('Failed to save logs:', e);
  }
}

export function loadEmails(): EmailMessage[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EMAILS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveEmails(emails: EmailMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(emails.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save emails:', e);
  }
}

export function loadConfig(): EmailConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    return data ? { ...DEFAULT_CONFIG, ...JSON.parse(data) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: EmailConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function resetDemoData(): {
  products: Product[];
  orders: ReorderOrder[];
  logs: ScanLogItem[];
  emails: EmailMessage[];
  config: EmailConfig;
} {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  localStorage.removeItem(STORAGE_KEYS.ORDERS);
  localStorage.removeItem(STORAGE_KEYS.LOGS);
  localStorage.removeItem(STORAGE_KEYS.EMAILS);
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));

  return {
    products: INITIAL_PRODUCTS,
    orders: [],
    logs: [],
    emails: [],
    config: DEFAULT_CONFIG,
  };
}
