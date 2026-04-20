export type MachineStatus = 'available' | 'sold' | 'hold' | 'demo' | 'disposed';
export type Warehouse = 'Ngemplak' | 'Gresik' | 'Lamongan' | 'Jakarta';

export interface MachineType {
  id: string;
  name: string;
  colors: string[];
  imageUrl?: string;
}

export interface Machine {
  id: string;
  serialNumber: string;
  typeId: string;
  typeName: string;
  color: string;
  warehouse: Warehouse;
  status: MachineStatus;
  holdReason?: 'cannibalized' | 'damaged' | 'return' | 'other';
  cannibalizedParts?: string[];
  isDemo?: boolean;
  demoStatus?: 'ready' | 'loaned';
  demoCustomerName?: string;
  demoLoanDate?: any;
  customerName?: string;
  attachedAccessories?: { id: string; name: string; quantity: number }[];
  createdAt: any;
  updatedAt: any;
}

export interface Sparepart {
  id: string;
  partNumber: string;
  name: string;
  warehouse: Warehouse;
  machineCompatibility: string[];
  stock: number;
  unit: string;
}

export interface AccessoryType {
  id: string;
  name: string;
}

export interface Accessory {
  id: string;
  typeId: string;
  typeName: string;
  name: string;
  warehouse: Warehouse;
  stock: number;
  unit: string;
}

export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff';
  permissions: string[];
}

export interface InventoryLog {
  id: string;
  machineId: string;
  serialNumber: string;
  action: string;
  previousData?: Partial<Machine>;
  newData: Partial<Machine>;
  timestamp: any;
  userEmail: string;
}
