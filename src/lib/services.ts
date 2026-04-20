import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs, orderBy, onSnapshot, Timestamp, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Machine, MachineType, InventoryLog, Sparepart, Accessory, AccessoryType, AppUser } from '../types';

export async function initializeDefaultMachineTypes() {
  const typesRef = collection(db, 'machineTypes');
  const snapshot = await getDocs(typesRef);
  
  if (snapshot.empty) {
    const batch = writeBatch(db);
    const machines = [
      { name: 'Excavator XP', colors: ['Yellow', 'Orange', 'Blue'], imageUrl: 'https://picsum.photos/seed/excavator/400/300' },
      { name: 'Bulldozer Heavy', colors: ['Yellow', 'Red', 'Green'], imageUrl: 'https://picsum.photos/seed/bulldozer/400/300' },
      { name: 'Road Roller', colors: ['Yellow', 'White', 'Blue'], imageUrl: 'https://picsum.photos/seed/roller/400/300' },
      { name: 'Forklift Compact', colors: ['Orange', 'Yellow', 'Black'], imageUrl: 'https://picsum.photos/seed/forklift/400/300' },
      { name: 'Crane Master', colors: ['Red', 'White', 'Blue'], imageUrl: 'https://picsum.photos/seed/crane/400/300' },
      { name: 'Concrete Mixer', colors: ['White', 'Grey', 'Orange'], imageUrl: 'https://picsum.photos/seed/mixer/400/300' },
    ];
    
    machines.forEach(m => {
      const newDoc = doc(typesRef);
      batch.set(newDoc, { ...m });
    });
    
    await batch.commit();
  }
}

export async function addMachineType(name: string, colors: string[], imageUrl: string) {
  const typesRef = collection(db, 'machineTypes');
  await writeBatch(db).set(doc(typesRef), { name, colors, imageUrl }).commit();
}

export async function updateMachineType(id: string, name: string, colors: string[], imageUrl: string) {
  const typeRef = doc(db, 'machineTypes', id);
  const batch = writeBatch(db);
  batch.update(typeRef, { name, colors, imageUrl });
  await batch.commit();
}

export async function deleteMachineType(id: string) {
  const typeRef = doc(db, 'machineTypes', id);
  await writeBatch(db).delete(typeRef).commit();
}

export async function bulkUploadMachines(type: MachineType, color: string, warehouse: string, serialNumbers: string[], manualDate?: Date) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machinesRef = collection(db, 'machines');
  const logsRef = collection(db, 'inventoryLogs');
  const timestamp = manualDate ? Timestamp.fromDate(manualDate) : serverTimestamp();
  
  for (const sn of serialNumbers) {
    const machineDoc = doc(machinesRef);
    const machineData = {
      serialNumber: sn,
      typeId: type.id,
      typeName: type.name,
      color: color,
      warehouse,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    batch.set(machineDoc, machineData);
    
    const logDoc = doc(logsRef);
    batch.set(logDoc, {
      machineId: machineDoc.id,
      serialNumber: sn,
      action: 'BULK_UPLOAD',
      newData: machineData,
      timestamp: serverTimestamp(),
      userEmail: auth.currentUser.email,
    });
  }
  
  await batch.commit();
}

export async function updateMachineStatus(
  machine: Machine, 
  newStatus: 'sold', 
  customerName: string, 
  manualDate?: Date, 
  accessories?: { id: string; quantity: number; name: string }[]
) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  const timestamp = manualDate ? Timestamp.fromDate(manualDate) : serverTimestamp();
  
  batch.update(machineRef, {
    status: newStatus,
    customerName: customerName,
    updatedAt: timestamp,
  });

  if (accessories && accessories.length > 0) {
    accessories.forEach(acc => {
      const accRef = doc(db, 'accessories', acc.id);
      batch.update(accRef, { stock: increment(-acc.quantity) });
    });
  }
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'SALE',
    previousData: { status: machine.status },
    newData: { 
      status: newStatus, 
      customerName, 
      updatedAt: timestamp,
      accessoriesAttached: accessories || [] 
    },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function revertMachineStatus(machine: Machine) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(machineRef, {
    status: 'available',
    customerName: null,
    updatedAt: serverTimestamp(),
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'REVERT_SALE',
    previousData: { status: machine.status, customerName: machine.customerName },
    newData: { status: 'available' },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function updateSoldMachineRecord(id: string, customerName: string, updatedAt: Date) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', id);
  const logsRef = collection(db, 'inventoryLogs');
  const timestamp = Timestamp.fromDate(updatedAt);
  
  batch.update(machineRef, {
    customerName,
    updatedAt: timestamp,
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: id,
    action: 'EDIT_SALE_DETAILS',
    newData: { customerName, updatedAt: timestamp },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function deleteMachineRecord(id: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  await writeBatch(db).delete(doc(db, 'machines', id)).commit();
}

// Spareparts Services
export async function addSparepart(part: Omit<Sparepart, 'id'>) {
  const partsRef = collection(db, 'spareparts');
  await writeBatch(db).set(doc(partsRef), part).commit();
}

export async function updateSparepart(id: string, updates: Partial<Sparepart>) {
  const partRef = doc(db, 'spareparts', id);
  await writeBatch(db).update(partRef, updates as any).commit();
}

export async function deleteSparepart(id: string) {
  await writeBatch(db).delete(doc(db, 'spareparts', id)).commit();
}

export async function sellSparepart(part: Sparepart, quantity: number, customerName: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  if (part.stock < quantity) throw new Error('Stock tidak mencukupi');
  
  const batch = writeBatch(db);
  const partRef = doc(db, 'spareparts', part.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(partRef, {
    stock: part.stock - quantity,
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: part.id,
    serialNumber: part.partNumber, // Using partNumber as identifier
    action: 'SPAREPART_SALE',
    newData: { 
      partName: part.name, 
      quantity, 
      customerName, 
      remainingStock: part.stock - quantity 
    },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function restockSparepart(part: Sparepart, quantity: number) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const partRef = doc(db, 'spareparts', part.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(partRef, {
    stock: part.stock + quantity,
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: part.id,
    serialNumber: part.partNumber,
    action: 'SPAREPART_RESTOCK',
    newData: { 
      partName: part.name, 
      quantity, 
      newStock: part.stock + quantity 
    },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

// Accessory Services
export async function addAccessoryType(name: string) {
  const ref = doc(collection(db, 'accessoryTypes'));
  const batch = writeBatch(db);
  batch.set(ref, { name });
  await batch.commit();
}

export async function deleteAccessoryType(id: string) {
  await writeBatch(db).delete(doc(db, 'accessoryTypes', id)).commit();
}

export async function addAccessory(acc: Omit<Accessory, 'id'>) {
  const ref = doc(collection(db, 'accessories'));
  await writeBatch(db).set(ref, acc).commit();
}

export async function updateAccessory(id: string, updates: Partial<Accessory>) {
  const ref = doc(db, 'accessories', id);
  await writeBatch(db).update(ref, updates as any).commit();
}

export async function deleteAccessory(id: string) {
  await writeBatch(db).delete(doc(db, 'accessories', id)).commit();
}

export async function sellAccessory(acc: Accessory, quantity: number, customerName: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  if (acc.stock < quantity) throw new Error('Stock tidak mencukupi');
  
  const batch = writeBatch(db);
  const accRef = doc(db, 'accessories', acc.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(accRef, {
    stock: acc.stock - quantity,
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: acc.id,
    serialNumber: acc.name, // Use name since accessories might not have numbers
    action: 'ACCESSORY_SALE',
    newData: { 
      accessoryName: acc.name, 
      quantity, 
      customerName, 
      remainingStock: acc.stock - quantity 
    },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function restockAccessory(acc: Accessory, quantity: number) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const accRef = doc(db, 'accessories', acc.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(accRef, {
    stock: acc.stock + quantity,
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: acc.id,
    serialNumber: acc.name,
    action: 'ACCESSORY_RESTOCK',
    newData: { 
      accessoryName: acc.name, 
      quantity, 
      newStock: acc.stock + quantity 
    },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

// Cannibalization & Repair Services
export async function cannibalizeMachine(machine: Machine, partsTaken: string[], note: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(machineRef, {
    status: 'hold',
    holdReason: 'cannibalized',
    cannibalizedParts: partsTaken,
    updatedAt: serverTimestamp(),
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'CANNIBALIZED',
    newData: { status: 'hold', holdReason: 'cannibalized', cannibalizedParts: partsTaken, note },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function repairMachine(machine: Machine, note: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(machineRef, {
    status: 'available',
    holdReason: null,
    cannibalizedParts: [],
    updatedAt: serverTimestamp(),
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'REPAIRED',
    newData: { status: 'available', note },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function saveAppUser(userData: Omit<AppUser, 'id'> & { id?: string }) {
  const userRef = userData.id ? doc(db, 'appUsers', userData.id) : doc(collection(db, 'appUsers'));
  await writeBatch(db).set(userRef, {
    email: userData.email,
    displayName: userData.displayName || '',
    role: userData.role,
    permissions: userData.permissions
  }, { merge: true }).commit();
}

export async function deleteAppUser(id: string) {
  await writeBatch(db).delete(doc(db, 'appUsers', id)).commit();
}

export async function returnMachine(
  machine: Machine, 
  condition: 'good' | 'hold', 
  note: string,
  returnedAccessories?: { id: string; quantity: number; isGood: boolean }[]
) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  const status = condition === 'good' ? 'available' : 'hold';
  const holdReason = condition === 'hold' ? 'return' : null;

  batch.update(machineRef, {
    status,
    holdReason,
    customerName: null, 
    attachedAccessories: null, // Clear attached accessories on return
    updatedAt: serverTimestamp(),
  });

  if (returnedAccessories && returnedAccessories.length > 0) {
    returnedAccessories.forEach(acc => {
      if (acc.isGood) {
        const accRef = doc(db, 'accessories', acc.id);
        batch.update(accRef, { stock: increment(acc.quantity) });
      }
    });
  }
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'RETURN',
    newData: { status, condition, note, returnedAccessories: returnedAccessories || [] },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function returnSparepart(part: Sparepart, condition: 'good' | 'hold', quantity: number, note: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const partRef = doc(db, 'spareparts', part.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  // If good, add back to stock. If hold, we just log it (or could move to a damaged section).
  // For simplicity, if hold we just log the return but don't increase normal stock? 
  // User said "return hold disimpan atau dimusnahkan".
  // Let's assume if 'good' stock increases, if 'hold' it doesn't increase ready stock.
  
  if (condition === 'good') {
    batch.update(partRef, {
      stock: part.stock + quantity,
    });
  }

  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: part.id,
    serialNumber: part.partNumber,
    action: 'SPAREPART_RETURN',
    newData: { condition, quantity, note, addedToStock: condition === 'good' },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function disposeMachine(machine: Machine, note: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(machineRef, {
    status: 'disposed',
    updatedAt: serverTimestamp(),
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'DISPOSED',
    newData: { note },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function toggleMachineDemo(machine: Machine, isDemo: boolean) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(machineRef, {
    status: isDemo ? 'demo' : 'available',
    isDemo: isDemo,
    updatedAt: serverTimestamp(),
  });
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'DEMO_TOGGLE',
    newData: { isDemo, status: isDemo ? 'demo' : 'available' },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function loanDemoMachine(
  machine: Machine, 
  customerName: string, 
  loanDate: Date, 
  accessories?: { id: string; quantity: number; name: string }[]
) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  batch.update(machineRef, {
    demoStatus: 'loaned',
    demoCustomerName: customerName,
    demoLoanDate: Timestamp.fromDate(loanDate),
    attachedAccessories: accessories || [],
    updatedAt: serverTimestamp(),
  });

  if (accessories && accessories.length > 0) {
    accessories.forEach(acc => {
      const accRef = doc(db, 'accessories', acc.id);
      batch.update(accRef, { stock: increment(-acc.quantity) });
    });
  }
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'DEMO_LOAN',
    newData: { demoStatus: 'loaned', customerName, loanDate, accessoriesAttached: accessories || [] },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function returnDemoMachine(
  machine: Machine, 
  condition: 'ready' | 'hold', 
  note: string,
  returnedAccessories?: { id: string; quantity: number; isGood: boolean }[]
) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const machineRef = doc(db, 'machines', machine.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  const status = condition === 'ready' ? 'demo' : 'hold';
  const demoStatus = condition === 'ready' ? 'ready' : null;
  const holdReason = condition === 'hold' ? 'return' : null;

  batch.update(machineRef, {
    status,
    demoStatus,
    holdReason,
    demoCustomerName: null,
    demoLoanDate: null,
    attachedAccessories: null, // Clear attached accessories from machine
    updatedAt: serverTimestamp(),
  });

  if (returnedAccessories && returnedAccessories.length > 0) {
    returnedAccessories.forEach(acc => {
      if (acc.isGood) {
        const accRef = doc(db, 'accessories', acc.id);
        batch.update(accRef, { stock: increment(acc.quantity) });
      }
    });
  }
  
  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'DEMO_RETURN',
    newData: { status, condition, note, returnedAccessories: returnedAccessories || [] },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}

export async function returnAccessory(acc: Accessory, condition: 'good' | 'hold', quantity: number, note: string) {
  if (!auth.currentUser) throw new Error('Not authenticated');
  
  const batch = writeBatch(db);
  const accRef = doc(db, 'accessories', acc.id);
  const logsRef = collection(db, 'inventoryLogs');
  
  if (condition === 'good') {
    batch.update(accRef, { stock: increment(quantity) });
  }

  const logDoc = doc(logsRef);
  batch.set(logDoc, {
    accessoryId: acc.id,
    accessoryName: acc.name,
    action: 'ACCESSORY_RETURN',
    newData: { condition, quantity, note },
    timestamp: serverTimestamp(),
    userEmail: auth.currentUser.email,
  });
  
  await batch.commit();
}
