import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, setDoc, doc } from 'firebase/firestore';
import { db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from './lib/firebase';
import { useAuth } from './components/AuthProvider';
import { Machine, MachineType, InventoryLog, Sparepart, Accessory, AccessoryType } from './types';
import { 
  initializeDefaultMachineTypes, 
  bulkUploadMachines, 
  updateMachineStatus,
  addMachineType,
  updateMachineType,
  deleteMachineType,
  revertMachineStatus,
  updateSoldMachineRecord,
  deleteMachineRecord,
  addSparepart,
  updateSparepart,
  deleteSparepart,
  cannibalizeMachine,
  repairMachine,
  sellSparepart,
  restockSparepart,
  addAccessoryType,
  deleteAccessoryType,
  addAccessory,
  updateAccessory,
  deleteAccessory,
  sellAccessory,
  restockAccessory
} from './lib/services';
import { cn, formatDate } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Plus, 
  Search, 
  Download, 
  User as UserIcon, 
  Trash2, 
  ClipboardList, 
  History, 
  CheckCircle2, 
  FileText,
  LogOut,
  ChevronRight,
  RefreshCw,
  Box,
  Truck,
  Hash,
  Settings,
  ArrowRightCircle,
  ArrowLeftCircle,
  Edit,
  X,
  Calendar,
  Image as ImageIcon,
  ChevronDown,
  ArrowUpRight,
  Wrench,
  Scissors,
  Hammer,
  ShieldAlert,
  AlertCircle,
  Monitor,
  Users as UsersIcon,
  ShieldCheck,
  Undo2,
  Trash,
  Briefcase,
  Check,
  Filter,
  MoreVertical,
  Edit2,
  ExternalLink,
  Clock,
  PackageCheck,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser } from './types';
import { 
  saveAppUser, 
  deleteAppUser,
  returnMachine,
  returnSparepart,
  disposeMachine,
  toggleMachineDemo,
  loanDemoMachine,
  returnDemoMachine,
  returnAccessory
} from './lib/services';

const WAREHOUSES = ['Ngemplak', 'Gresik', 'Lamongan', 'Jakarta'] as const;

export default function App() {
  const { user, appUser, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'returns' | 'inbound' | 'outbound' | 'spareparts' | 'accessories' | 'cannibal' | 'repair' | 'demo_mgmt' | 'logs' | 'report' | 'config' | 'users'>('inventory');

  useEffect(() => {
    console.log("App mounted");
  }, []);

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} appUser={appUser} isSuperAdmin={isSuperAdmin} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab={activeTab} user={user} appUser={appUser} isSuperAdmin={isSuperAdmin} />
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'inventory' && <InventoryView />}
            {activeTab === 'returns' && <ReturnsView />}
            {activeTab === 'inbound' && <InboundView />}
            {activeTab === 'outbound' && <OutboundView />}
            {activeTab === 'spareparts' && <SparepartsView />}
            {activeTab === 'accessories' && <AccessoryView />}
            {activeTab === 'cannibal' && <CannibalView />}
            {activeTab === 'repair' && <RepairView />}
            {activeTab === 'demo_mgmt' && <DemoManagementView />}
            {activeTab === 'config' && <ConfigView />}
            {activeTab === 'logs' && <LogsView />}
            {activeTab === 'report' && <ReportView />}
            {activeTab === 'users' && isSuperAdmin && <UsersView />}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Silakan masukkan email Anda terlebih dahulu untuk reset password.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Email instruksi reset password telah dikirim ke alamat Anda.');
    } catch (err: any) {
      console.error("Reset Error:", err);
      if (err.code === 'auth/user-not-found') {
        setError('Email tidak terdaftar di sistem.');
      } else {
        setError('Gagal mengirim email reset: ' + (err.code || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, {
          displayName: fullName
        });
        // Create initial appUser document
        await setDoc(doc(db, 'appUsers', userCred.user.uid), {
          email: email,
          displayName: fullName,
          role: 'staff',
          permissions: ['inventory'] // Default minimal permission
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let message = 'Terjadi kesalahan sistem. Silakan coba lagi.';
      
      if (err.code === 'auth/email-already-in-use') {
        message = 'Email ini sudah terdaftar. Silakan gunakan menu Login di bawah.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Format email tidak valid.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password terlalu lemah (minimal 6 karakter).';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Email atau password salah. Silakan periksa kembali.';
      } else {
        message = err.message || 'Gagal masuk ke sistem.';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
          <Box className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">MesinInventory Pro</h1>
        <p className="text-slate-600 mb-8 text-center small text-sm font-medium">Sistem manajemen stok mesin industri profesional.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nama Lengkap</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium text-slate-900 focus:border-blue-500 transition-colors"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium text-slate-900 focus:border-blue-500 transition-colors"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1 ml-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
              {!isRegistering && (
                <button 
                  type="button" 
                  disabled={loading}
                  onClick={handleResetPassword}
                  className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  Lupa Password?
                </button>
              )}
            </div>
            <input 
              type="password" 
              required={!loading}
              minLength={6}
              className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium text-slate-900 focus:border-blue-500 transition-colors"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="flex-1 overflow-hidden overflow-ellipsis">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-100">
              <Check className="w-4 h-4" />
              <span className="flex-1 overflow-hidden overflow-ellipsis">{successMessage}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg shadow-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {isRegistering ? 'Daftar Akun Baru' : 'Masuk ke Sistem'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500 mb-2">
            {isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'}
          </p>
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccessMessage('');
            }}
            className="text-blue-600 font-bold hover:underline"
          >
            {isRegistering ? 'Login Sekarang' : 'Daftar Disini'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ activeTab, user, appUser, isSuperAdmin }: { activeTab: string; user: any; appUser?: AppUser | null; isSuperAdmin?: boolean }) {
  const titles: Record<string, string> = {
    inventory: 'Stock Overview',
    returns: 'Barang Return (Sales Return)',
    inbound: 'Inbound (Masuk Barang)',
    outbound: 'Outbound (Keluar Barang)',
    spareparts: 'Manajemen Sparepart',
    accessories: 'Manajemen Kelengkapan',
    cannibal: 'Kanibal & Status Hold',
    repair: 'Perbaikan Mesin',
    demo_mgmt: 'Pinjam & Keluar Unit Demo',
    config: 'Model Configuration',
    logs: 'System Audit Logs',
    report: 'Inventory Analytics',
    users: 'User Management'
  };

  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-slate-800">{titles[activeTab]}</h2>
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
          System Online
        </span>
        {isSuperAdmin && (
          <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Super Admin
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-2">
          <span className="text-xs font-bold text-slate-900 leading-none">{displayName}</span>
          <span className="text-[10px] text-slate-500 mt-1">{user.email}</span>
        </div>
        <img src={photoURL} alt="Avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg border border-slate-100 shadow-sm" />
      </div>
    </header>
  );
}

function Sidebar({ activeTab, setActiveTab, user, appUser, isSuperAdmin }: { 
  activeTab: string, 
  setActiveTab: (t: any) => void, 
  user: any,
  appUser?: AppUser | null,
  isSuperAdmin?: boolean 
}) {
  const tabs = [
    { id: 'inventory', label: 'Monitor Stok', icon: Box },
    { id: 'returns', label: 'Unit Return', icon: Undo2 },
    { id: 'inbound', label: 'Input Barang', icon: ArrowLeftCircle },
    { id: 'outbound', label: 'Output Barang', icon: ArrowRightCircle },
    { id: 'spareparts', label: 'Sparepart', icon: Wrench },
    { id: 'accessories', label: 'Kelengkapan', icon: Briefcase },
    { id: 'cannibal', label: 'Kanibal / Hold', icon: Scissors },
    { id: 'repair', label: 'Perbaikan', icon: Hammer },
    { id: 'demo_mgmt', label: 'Unit Demo', icon: Monitor },
    { id: 'config', label: 'Jenis & Warna', icon: Settings },
    { id: 'logs', label: 'Audit Records', icon: History },
    { id: 'report', label: 'Laporan Eksport', icon: FileText },
    { id: 'users', label: 'Manajemen User', icon: UsersIcon, superOnly: true },
  ];

  const visibleTabs = tabs.filter(tab => {
    if (isSuperAdmin) return true;
    if (tab.superOnly) return false;
    if (appUser?.permissions?.includes(tab.id)) return true;
    return false;
  });

  const displayName = user.displayName || user.email?.split('@')[0] || 'User';

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">M</div>
        <h1 className="text-xl font-bold tracking-tight">MesinInv</h1>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-xl p-3 mb-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{isSuperAdmin ? 'SUPER ADMIN' : 'USER STATUS'}</p>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isSuperAdmin ? "bg-red-500" : "bg-emerald-500")} />
            <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 pl-4 truncate">{isSuperAdmin ? 'Full System Access' : (appUser?.role || 'Staff Member')}</p>
        </div>
        <button 
          onClick={async () => {
            await signOut(auth);
            setActiveTab('inventory');
          }}
          className="w-full flex items-center gap-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 p-2 rounded-lg transition-all text-xs font-semibold"
        >
          <LogOut className="w-4 h-4" />
          Logout Session
        </button>
      </div>
    </aside>
  );
}

function InventoryView() {
  const { isSuperAdmin } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [types, setTypes] = useState<MachineType[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterWarehouse, setFilterWarehouse] = useState('All');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const qMachines = query(collection(db, 'machines'), orderBy('updatedAt', 'desc'));
    const unsubMachines = onSnapshot(qMachines, (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });

    const qTypes = query(collection(db, 'machineTypes'), orderBy('name', 'asc'));
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MachineType)));
    });

    return () => {
      unsubMachines();
      unsubTypes();
    };
  }, []);

  const handleToggleDemo = async (m: Machine) => {
    if(!confirm(`Jadikan mesin ini sebagai UNIT DEMO?`)) return;
    setIsProcessing(true);
    try {
      await toggleMachineDemo(m, !m.isDemo);
    } catch (e) {
      alert('Gagal update status demo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispose = async (m: Machine) => {
    const note = prompt('Alasan pemusnahan (disposed):');
    if(note === null) return;
    setIsProcessing(true);
    try {
      await disposeMachine(m, note);
    } catch (e) {
      alert('Gagal proses pemusnahan');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredMachines = machines.filter(m => {
    // Hide disposed from main inventory unless explicitly searching? 
    // Usually disposed is "removed" but kept in DB.
    if (m.status === 'disposed') return false; 
    
    const matchesSearch = m.serialNumber.toLowerCase().includes(search.toLowerCase()) || 
                          m.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'All' || m.typeName === filterType;
    const matchesWarehouse = filterWarehouse === 'All' || m.warehouse === filterWarehouse;
    return matchesSearch && matchesType && matchesWarehouse;
  });

  const uniqueTypes = ['All', ...new Set(machines.map(m => m.typeName))];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Machines', value: machines.filter(m => m.status !== 'disposed').length, sub: `+${machines.filter(m => m.status !== 'disposed' && m.createdAt?.toDate().toDateString() === new Date().toDateString()).length} added today`, icon: Box, color: 'blue' },
          { label: 'Available Stock', value: machines.filter(m => m.status === 'available').length, sub: 'Ready for shipment', icon: CheckCircle2, color: 'emerald' },
          { label: 'Unit Demo', value: machines.filter(m => m.status === 'demo').length, sub: 'Displays at showroom', icon: ImageIcon, color: 'amber' },
          { label: 'Total Sold', value: machines.filter(m => m.status === 'sold').length, sub: 'Processed sales', icon: Truck, color: 'blue' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
              <stat.icon className={cn("w-4 h-4", stat.color === 'emerald' ? 'text-emerald-500' : stat.color === 'amber' ? 'text-amber-500' : 'text-blue-500')} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 leading-none">{stat.value}</h3>
            <p className={cn("text-[10px] font-semibold mt-2", stat.color === 'emerald' ? 'text-emerald-600' : stat.color === 'amber' ? 'text-amber-600' : 'text-slate-400')}>{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-800 text-sm">Live Inventory Feed</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
              <input 
                type="text" 
                placeholder="Search Serial / Customer..."
                className="text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 w-64 bg-white outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select 
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
            >
              <option value="All">All Warehouses</option>
              {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
                <th className="px-6 py-3">Machine Model</th>
                <th className="px-6 py-3">Color Config</th>
                <th className="px-6 py-3">Gudang</th>
                <th className="px-6 py-3">Serial Number</th>
                <th className="px-6 py-3">Assignment / Customer</th>
                <th className="px-6 py-3 text-right">Last Change</th>
                <th className="px-6 py-3 text-right">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredMachines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        <img 
                          src={types.find(t => t.id === m.typeId)?.imageUrl || 'https://picsum.photos/seed/tool/100/100'} 
                          alt={m.typeName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="font-bold text-slate-900">{m.typeName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <div className="w-2 h-2 rounded-full border border-slate-200" style={{ backgroundColor: m.color.toLowerCase() }} />
                      {m.color}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded font-bold text-[10px] uppercase">{m.warehouse}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-blue-600 font-bold bg-blue-50/50 px-2 py-1 rounded tracking-tight">{m.serialNumber}</span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {m.status === 'sold' ? (
                      <div className="text-slate-900 flex items-center gap-1.5">
                        <UserIcon className="w-3 h-3 text-emerald-500" />
                        {m.customerName}
                      </div>
                    ) : m.status === 'demo' ? (
                      <div className="text-amber-600 flex flex-col gap-0.5">
                        <span className="font-bold italic">UNIT DEMO</span>
                        {m.demoStatus === 'loaned' && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-normal">
                             <ArrowUpRight className="w-2.5 h-2.5 text-blue-500" /> {m.demoCustomerName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic font-normal">— Stock —</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400 font-mono tracking-tighter">
                    {m.updatedAt ? formatDate(m.updatedAt.toDate()) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                       {m.status === 'available' && isSuperAdmin && (
                         <button 
                          onClick={() => handleToggleDemo(m)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-all"
                          title="Set as Demo Machine"
                         >
                           <ImageIcon className="w-4 h-4" />
                         </button>
                       )}
                       {m.status === 'hold' && isSuperAdmin && (
                         <button 
                          onClick={() => handleDispose(m)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          title="Dispose / Musnahkan Unit"
                         >
                           <Trash className="w-4 h-4" />
                         </button>
                       )}
                       
                       {m.status === 'available' ? (
                         <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded font-bold">READY</span>
                       ) : m.status === 'sold' ? (
                         <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                           <CheckCircle2 className="w-3 h-3" /> SOLD
                         </span>
                       ) : m.status === 'demo' ? (
                         <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                           <ImageIcon className="w-3 h-3" /> DEMO
                         </span>
                       ) : (
                         <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                           <ShieldAlert className="w-3 h-3" /> HOLD
                         </span>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMachines.length === 0 && (
            <div className="p-16 text-center">
              <Box className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No matching records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReturnsView() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [spareparts, setSpareparts] = useState<Sparepart[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [returnType, setReturnType] = useState<'machine' | 'sparepart' | 'accessory'>('machine');
  
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedSparepart, setSelectedSparepart] = useState<Sparepart | null>(null);
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);
  
  const [condition, setCondition] = useState<'good' | 'hold'>('good');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // For machine return (associated accessories)
  const [returnStatusAccs, setReturnStatusAccs] = useState<{ id: string; quantity: number; name: string; isGood: boolean }[]>([]);

  useEffect(() => {
    const qMachines = query(collection(db, 'machines'), where('status', '==', 'sold'), orderBy('updatedAt', 'desc'));
    const unsubMachines = onSnapshot(qMachines, (snap) => {
      setMachines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });

    const qParts = query(collection(db, 'spareparts'), orderBy('name', 'asc'));
    const unsubParts = onSnapshot(qParts, (snap) => {
      setSpareparts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sparepart)));
    });

    const qAccs = query(collection(db, 'accessories'), orderBy('name', 'asc'));
    const unsubAccs = onSnapshot(qAccs, (snap) => {
      setAccessories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Accessory)));
    });

    return () => {
      unsubMachines();
      unsubParts();
      unsubAccs();
    };
  }, []);

  // Sync returnStatusAccs when machine selected
  useEffect(() => {
    if (selectedMachine?.attachedAccessories) {
      setReturnStatusAccs(selectedMachine.attachedAccessories.map(a => ({ ...a, isGood: true })));
    } else {
      setReturnStatusAccs([]);
    }
  }, [selectedMachine]);

  const handleReturnAction = async () => {
    setIsProcessing(true);
    try {
      if (returnType === 'machine' && selectedMachine) {
        await returnMachine(selectedMachine, condition, note, returnStatusAccs);
        setSelectedMachine(null);
      } else if (returnType === 'sparepart' && selectedSparepart) {
        await returnSparepart(selectedSparepart, condition, quantity, note);
        setSelectedSparepart(null);
      } else if (returnType === 'accessory' && selectedAccessory) {
        await returnAccessory(selectedAccessory, condition, quantity, note);
        setSelectedAccessory(null);
      }
      setNote('');
      setQuantity(1);
      alert('Return berhasil diproses!');
    } catch (e) {
      alert('Gagal proses return');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-red-100 rounded-2xl text-red-600">
            <Undo2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Proses Barang Return</h2>
            <p className="text-sm text-slate-500">Kembalikan unit mesin, suku cadang, atau kelengkapan.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-8 bg-slate-50 p-1.5 rounded-2xl w-fit">
          {(['machine', 'sparepart', 'accessory'] as const).map(t => (
            <button 
              key={t}
              onClick={() => { setReturnType(t); setSelectedMachine(null); setSelectedSparepart(null); setSelectedAccessory(null); }}
              className={cn("px-6 py-2.5 rounded-xl text-xs font-bold transition-all", returnType === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}
            >
              {t === 'machine' ? 'Unit Mesin' : t === 'sparepart' ? 'Sparepart' : 'Kelengkapan'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            {returnType === 'machine' ? (
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Mesin (Status Terjual)</span>
                <select 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium"
                  onChange={(e) => setSelectedMachine(machines.find(m => m.id === e.target.value) || null)}
                  value={selectedMachine?.id || ''}
                >
                  <option value="">-- Pilih Unit Mesin --</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.serialNumber} - {m.typeName} ({m.customerName})</option>
                  ))}
                </select>
              </label>
            ) : returnType === 'sparepart' ? (
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Sparepart</span>
                <select 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium"
                  onChange={(e) => setSelectedSparepart(spareparts.find(s => s.id === e.target.value) || null)}
                  value={selectedSparepart?.id || ''}
                >
                  <option value="">-- Pilih Sparepart --</option>
                  {spareparts.map(s => (
                    <option key={s.id} value={s.id}>{s.partNumber} - {s.name} (Stock: {s.stock})</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Kelengkapan</span>
                <select 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium"
                  onChange={(e) => setSelectedAccessory(accessories.find(a => a.id === e.target.value) || null)}
                  value={selectedAccessory?.id || ''}
                >
                  <option value="">-- Pilih Kelengkapan --</option>
                  {accessories.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (Stock: {a.stock})</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Kondisi Utama</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCondition('good')}
                    className={cn("flex-1 py-3 rounded-xl border font-bold text-xs", condition === 'good' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white text-slate-400")}
                  >
                    Bagus
                  </button>
                  <button 
                    onClick={() => setCondition('hold')}
                    className={cn("flex-1 py-3 rounded-xl border font-bold text-xs", condition === 'hold' ? "bg-amber-600 border-amber-600 text-white" : "bg-white text-slate-400")}
                  >
                    Wait
                  </button>
                </div>
              </div>
              {returnType !== 'machine' && (
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Jumlah</span>
                  <input type="number" className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </label>
              )}
            </div>

            {returnType === 'machine' && returnStatusAccs.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Item Kelengkapan Terikut</span>
                <div className="space-y-2">
                  {returnStatusAccs.map((acc, idx) => (
                    <div key={acc.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-600">{acc.name} (x{acc.quantity})</span>
                      <button 
                        onClick={() => {
                          const n = [...returnStatusAccs];
                          n[idx].isGood = !n[idx].isGood;
                          setReturnStatusAccs(n);
                        }}
                        className={cn("px-2 py-1 rounded text-[8px] font-bold border uppercase", acc.isGood ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100")}
                      >
                        {acc.isGood ? 'BAIK' : 'RUSAK'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Catatan Return</span>
              <textarea 
                className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none h-32" 
                placeholder="Alasan barang dikembalikan..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            <button 
              onClick={handleReturnAction}
              disabled={isProcessing || (returnType === 'machine' ? !selectedMachine : returnType === 'sparepart' ? !selectedSparepart : !selectedAccessory)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw className={cn("w-5 h-5", isProcessing && "animate-spin")} />
              Proses Return Ke Sistem
            </button>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 flex flex-col justify-center items-center text-center">
            {selectedMachine || selectedSparepart ? (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-slate-200">
                  <Box className="w-10 h-10 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">
                    {returnType === 'machine' ? selectedMachine?.serialNumber : returnType === 'sparepart' ? selectedSparepart?.partNumber : selectedAccessory?.name}
                  </h4>
                  <p className="text-slate-500 font-medium italic">
                    {returnType === 'machine' ? selectedMachine?.typeName : returnType === 'sparepart' ? selectedSparepart?.name : selectedAccessory?.typeName}
                  </p>
                </div>
                <div className="pt-6 border-t border-slate-200 space-y-2">
                   <p className="text-xs text-slate-600">Alur setelah diproses:</p>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                     {condition === 'good' ? 'KEMBALI KE STOCK READY' : 'MASUK KE ANTREAN PERBAIKAN (HOLD)'}
                   </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 opacity-30">
                <Undo2 className="w-16 h-16 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pilih Item untuk Lihat Preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutboundView() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [availableAccessories, setAvailableAccessories] = useState<Accessory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 16));
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Accessory selection states
  const [attachedAccs, setAttachedAccs] = useState<{ id: string; quantity: number; name: string }[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'machines'), where('status', 'in', ['available', 'demo']), orderBy('updatedAt', 'desc'));
    const unsubMachines = onSnapshot(q, (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });

    const qAcc = query(collection(db, 'accessories'), where('stock', '>', 0));
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      setAvailableAccessories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Accessory)));
    });

    return () => { unsubMachines(); unsubAcc(); };
  }, []);

  const addAccessory = (accId: string) => {
    const acc = availableAccessories.find(a => a.id === accId);
    if (!acc) return;
    if (attachedAccs.find(a => a.id === accId)) return;
    setAttachedAccs([...attachedAccs, { id: acc.id, quantity: 1, name: acc.name }]);
  };

  const removeAcc = (id: string) => {
    setAttachedAccs(attachedAccs.filter(a => a.id !== id));
  };

  const updateAccQty = (id: string, qty: number) => {
    const accRef = availableAccessories.find(a => a.id === id);
    if (accRef && qty > accRef.stock) {
      alert(`Stok maksimal untuk ${accRef.name} adalah ${accRef.stock}`);
      return;
    }
    setAttachedAccs(attachedAccs.map(a => a.id === id ? { ...a, quantity: qty } : a));
  };

  const filteredMachines = machines.filter(m => 
    m.serialNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleSale = async () => {
    if (!selectedMachine || !customerName) return;
    setIsUpdating(true);
    try {
      await updateMachineStatus(selectedMachine, 'sold', customerName, new Date(manualDate), attachedAccs);
      setSelectedMachine(null);
      setCustomerName('');
      setAttachedAccs([]);
      setManualDate(new Date().toISOString().slice(0, 16));
      alert('Penjualan unit dan kelengkapan berhasil diproses!');
    } catch (e: any) {
      alert(e.message || 'Gagal memproses output barang');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 grayscale">
           <ArrowRightCircle className="w-48 h-48" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ArrowRightCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Output Barang (Penjualan)</h2>
              <p className="text-slate-500 text-sm">Pilih mesin yang tersedia untuk dikirim/dijual ke customer.</p>
            </div>
          </div>

          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari Serial Number yang tersedia..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMachines.map(m => (
              <button 
                key={m.id}
                onClick={() => setSelectedMachine(m)}
                className="bg-white border border-slate-200 p-4 rounded-2xl text-left hover:border-emerald-500 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{m.serialNumber}</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color.toLowerCase() }} />
                </div>
                <h4 className="font-bold text-slate-900">{m.typeName}</h4>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Config: {m.color}</p>
                <div className="mt-4 flex items-center justify-between text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Process Dispatch</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            ))}
            {filteredMachines.length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-medium">Tidak ada mesin `{search}` yang tersedia untuk dijual.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedMachine && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Konfirmasi Penjualan</h2>
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
               <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Items to Dispatch</p>
               <p className="font-bold text-slate-900">{selectedMachine.typeName}</p>
               <p className="text-sm font-mono text-blue-600 mt-1">{selectedMachine.serialNumber}</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Waktu Penjualan</span>
                <input 
                  type="datetime-local" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nama Customer</span>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Masukkan nama pembeli..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>

              <div className="space-y-4 pt-2 border-t border-slate-100 mt-2">
                 <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sertakan Kelengkapan</span>
                   <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded italic tracking-wide">STOCK CHECKED</span>
                 </div>
                 
                 <select 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                   onChange={(e) => { addAccessory(e.target.value); e.target.value = ''; }}
                   value=""
                 >
                   <option value="">+ Tambah Kelengkapan...</option>
                   {availableAccessories.map(a => (
                     <option key={a.id} value={a.id} disabled={attachedAccs.find(at => at.id === a.id)}>{a.name} ({a.typeName}) - Stok: {a.stock}</option>
                   ))}
                 </select>

                 <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                   {attachedAccs.map(acc => (
                     <div key={acc.id} className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100 group animate-in fade-in slide-in-from-top-1">
                       <div className="flex-1">
                         <p className="text-[11px] font-bold text-slate-700">{acc.name}</p>
                         <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Qty Attached</p>
                       </div>
                       <div className="flex items-center gap-3">
                         <input 
                           type="number" 
                           min="1"
                           className="w-12 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
                           value={acc.quantity}
                           onChange={(e) => updateAccQty(acc.id, parseInt(e.target.value) || 1)}
                         />
                         <button onClick={() => removeAcc(acc.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   ))}
                   {attachedAccs.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">Belum ada kelengkapan tambahan.</p>
                   )}
                 </div>
               </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedMachine(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200"
                disabled={isUpdating}
              >
                Batal
              </button>
              <button 
                onClick={handleSale}
                className={cn(
                  "flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-100",
                  isUpdating && "opacity-70 cursor-not-allowed"
                )}
                disabled={!customerName || isUpdating}
              >
                {isUpdating ? 'Memproses...' : 'Proses Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccessoryView() {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [types, setTypes] = useState<AccessoryType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Accessory | null>(null);
  
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('All');
  const [filterType, setFilterType] = useState('All');

  const [activeAcc, setActiveAcc] = useState<Accessory | null>(null);
  const [transType, setTransType] = useState<'sell' | 'restock' | null>(null);
  const [transQty, setTransQty] = useState(1);
  const [customerName, setCustomerName] = useState('');

  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState('Pcs');
  const [warehouse, setWarehouse] = useState<string>('Ngemplak');
  const [newTypeName, setNewTypeName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubAcc = onSnapshot(collection(db, 'accessories'), (snap) => {
      setAccessories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Accessory)));
    });
    const unsubTypes = onSnapshot(collection(db, 'accessoryTypes'), (snap) => {
      setTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessoryType)));
    });
    return () => { unsubAcc(); unsubTypes(); };
  }, []);

  const openModal = (a: Accessory | null = null) => {
    if (a) {
      setEditingAcc(a);
      setName(a.name);
      setTypeId(a.typeId);
      setStock(a.stock);
      setUnit(a.unit);
      setWarehouse(a.warehouse);
    } else {
      setEditingAcc(null);
      setName('');
      setTypeId(types[0]?.id || '');
      setStock(0);
      setUnit('Pcs');
      setWarehouse('Ngemplak');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name || !typeId) return;
    setIsSaving(true);
    try {
      const typeName = types.find(t => t.id === typeId)?.name || '';
      const data = { name, typeId, typeName, stock, unit, warehouse: warehouse as any };
      if (editingAcc) {
        await updateAccessory(editingAcc.id, data);
      } else {
        await addAccessory(data);
      }
      setIsModalOpen(false);
    } catch (e) {
      alert('Gagal simpan kelengkapan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddType = async () => {
    if (!newTypeName) return;
    try {
      await addAccessoryType(newTypeName);
      setNewTypeName('');
    } catch (e) {
      alert('Gagal tambah jenis');
    }
  };

  const handleTransaction = async () => {
    if (!activeAcc || !transType) return;
    setIsSaving(true);
    try {
      if (transType === 'sell') {
        await sellAccessory(activeAcc, transQty, customerName);
        alert('Berhasil memproses penjualan kelengkapan');
      } else {
        await restockAccessory(activeAcc, transQty);
        alert('Stok berhasil ditambahkan');
      }
      setActiveAcc(null);
      setTransType(null);
      setTransQty(1);
      setCustomerName('');
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAccessories = accessories.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse = filterWarehouse === 'All' || a.warehouse === filterWarehouse;
    const matchesType = filterType === 'All' || a.typeName === filterType;
    return matchesSearch && matchesWarehouse && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data Kelengkapan & Aksesoris</h2>
          <p className="text-sm text-slate-500 font-medium">Kelola stok perlengkapan mesin dan penjualan langsung.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input 
              type="text" 
              placeholder="Cari kelengkapan..."
              className="text-xs border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 w-full md:w-48 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all font-medium" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-600"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="All">Semua Jenis</option>
            {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <button 
            onClick={() => setIsTypeModalOpen(true)}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
            title="Kelola Jenis Kelengkapan"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all text-xs shadow-lg shadow-blue-100 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Barang
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Informasi Barang</th>
                <th className="px-6 py-4">Jenis</th>
                <th className="px-6 py-4">Gudang</th>
                <th className="px-6 py-4">Stok Saat Ini</th>
                <th className="px-6 py-4 text-right">Manajemen Stok</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 font-medium text-slate-600">
              {filteredAccessories.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{a.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Kelengkapan ID: {a.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg font-bold text-[10px] uppercase tracking-wide border border-amber-100">
                      {a.typeName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-wide">
                      {a.warehouse}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={cn("text-base font-bold leading-none", a.stock < 10 ? "text-red-500" : "text-emerald-600")}>
                        {a.stock}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{a.unit}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all scale-95 group-hover:scale-100">
                      <button 
                        onClick={() => { setActiveAcc(a); setTransType('sell'); }} 
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-700 shadow-md shadow-emerald-100"
                      >
                        JUAL
                      </button>
                      <button 
                        onClick={() => { setActiveAcc(a); setTransType('restock'); }} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700 shadow-md shadow-blue-100"
                      >
                        ISI STOK
                      </button>
                      <button onClick={() => openModal(a)} className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteAccessory(a.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAccessories.length === 0 && (
            <div className="p-16 text-center text-slate-400 italic">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-medium">Data Kelengkapan tidak ditemukan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Accessory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
            <div className="flex justify-between items-center mb-8">
               <div>
                <h3 className="text-2xl font-bold text-slate-900">{editingAcc ? 'Edit Data Kelengkapan' : 'Tambah Kelengkapan Baru'}</h3>
                <p className="text-sm text-slate-500 font-medium">Input informasi detail barang ke sistem.</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                 <X className="w-6 h-6 text-slate-400" />
               </button>
            </div>

            <div className="space-y-6">
              <label className="block">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Barang</span>
                 <input 
                  type="text" 
                  className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Toolbox Standard"
                 />
              </label>

              <div className="grid grid-cols-2 gap-6">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Jenis</span>
                  <select 
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={typeId}
                    onChange={e => setTypeId(e.target.value)}
                  >
                    <option value="">-- Pilih Jenis --</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Gudang</span>
                  <select 
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={warehouse}
                    onChange={e => setWarehouse(e.target.value)}
                  >
                    {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Initial Stock</span>
                  <input 
                    type="number" 
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" 
                    value={stock}
                    onChange={e => setStock(parseInt(e.target.value) || 0)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Satuan</span>
                  <input 
                    type="text" 
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" 
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                  />
                </label>
              </div>

              <button 
                onClick={handleSave}
                disabled={isSaving || !name || !typeId}
                className="w-full py-4.5 mt-4 bg-slate-900 text-white rounded-[1.5rem] font-bold shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {editingAcc ? 'Update Kelengkapan' : 'Simpan Barang Baru'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Type Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-bold text-slate-900">Jenis Kelengkapan</h3>
               <button onClick={() => setIsTypeModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                 <X className="w-6 h-6 text-slate-400" />
               </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                  placeholder="Tambah Jenis Baru..."
                  value={newTypeName}
                  onChange={e => setNewTypeName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddType()}
                />
                <button onClick={handleAddType} className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {types.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <span className="font-bold text-slate-700">{t.name}</span>
                    <button onClick={() => deleteAccessoryType(t.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {types.length === 0 && <p className="text-center text-slate-400 italic py-4">Belum ada jenis kelengkapan.</p>}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Transaction Modal */}
      {activeAcc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative"
          >
            <div className="flex justify-between items-center mb-8">
               <div>
                <h3 className="text-xl font-bold text-slate-900">{transType === 'sell' ? 'Penjualan Kelengkapan' : 'Input Stok Masuk'}</h3>
                <p className="text-sm font-bold text-blue-600 mt-1 uppercase tracking-wider">{activeAcc.name}</p>
               </div>
               <button onClick={() => setActiveAcc(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                 <X className="w-6 h-6 text-slate-400" />
               </button>
            </div>

            <div className="space-y-6">
              {transType === 'sell' && (
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Customer</span>
                  <input 
                    type="text" 
                    className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" 
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Wajib diisi..."
                  />
                </label>
              )}

              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Jumlah ({activeAcc.unit})</span>
                <input 
                  type="number" 
                  className="w-full mt-1.5 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" 
                  value={transQty}
                  onChange={e => setTransQty(parseInt(e.target.value) || 0)}
                  min="1"
                />
              </label>

              <button 
                onClick={handleTransaction}
                disabled={isSaving || (transType === 'sell' && !customerName) || transQty < 1}
                className={cn(
                  "w-full py-4.5 mt-4 text-white rounded-[1.5rem] font-bold shadow-xl flex items-center justify-center gap-3 transition-all",
                  transType === 'sell' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                )}
              >
                <CheckCircle2 className="w-5 h-5" />
                Konfirmasi {transType === 'sell' ? 'Penjualan' : 'Update Stok'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ConfigView() {
  const [types, setTypes] = useState<MachineType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<MachineType | null>(null);
  
  const [name, setName] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    return onSnapshot(collection(db, 'machineTypes'), (snap) => {
      setTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MachineType)));
    });
  }, []);

  const openModal = (type: MachineType | null = null) => {
    if (type) {
      setEditingType(type);
      setName(type.name);
      setColors(type.colors);
      setImageUrl(type.imageUrl || '');
    } else {
      setEditingType(null);
      setName('');
      setColors([]);
      setImageUrl('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
    setName('');
    setColors([]);
    setNewColor('');
    setImageUrl('');
  };

  const handleSave = async () => {
    if (!name || colors.length === 0) return;
    try {
      if (editingType) {
        await updateMachineType(editingType.id, name, colors, imageUrl);
      } else {
        await addMachineType(name, colors, imageUrl);
      }
      closeModal();
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan data');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus jenis mesin ini? Data stok lama tidak akan terhapus tapi tidak bisa diinput lagi.')) return;
    try {
      await deleteMachineType(id);
    } catch (e) {
      console.error(e);
    }
  };

  const addColor = () => {
    if (!newColor || colors.includes(newColor)) return;
    setColors([...colors, newColor]);
    setNewColor('');
  };

  const removeColor = (color: string) => {
    setColors(colors.filter(c => c !== color));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Manajemen Jenis & Warna</h2>
          <p className="text-sm text-slate-500">Tambahkan atau edit model mesin yang tersedia di sistem.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          Tambah Jenis Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {types.map(t => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-slate-900 truncate pr-4">{t.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => openModal(t)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {t.colors.map(c => (
                <span key={c} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.toLowerCase() }} />
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{editingType ? 'Edit Jenis Mesin' : 'Tambah Jenis Mesin Baru'}</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Model mesin</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  placeholder="Contoh: Excavator Power X-100"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL Foto Mesin</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    placeholder="Contoh: https://images.com/excavator.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  {imageUrl && (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                       <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Konfigurasi Warna</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    placeholder="Warna baru..."
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addColor()}
                  />
                  <button 
                    onClick={addColor}
                    className="bg-slate-900 text-white px-4 rounded-xl hover:bg-slate-800"
                  >
                    Tambah
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4 min-h-[32px]">
                  {colors.map(c => (
                    <span key={c} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100">
                      {c}
                      <button onClick={() => removeColor(c)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {colors.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada warna ditambahkan</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={closeModal}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200"
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-lg shadow-blue-100"
                disabled={!name || colors.length === 0}
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InboundView() {
  const [types, setTypes] = useState<MachineType[]>([]);
  const [selectedType, setSelectedType] = useState<MachineType | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('Ngemplak');
  const [rawSerials, setRawSerials] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 16));
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let unsub: any;
    initializeDefaultMachineTypes().then(() => {
      unsub = onSnapshot(collection(db, 'machineTypes'), (snap) => {
        setTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MachineType)));
      });
    });
    return () => unsub && unsub();
  }, []);

  const handleUpload = async () => {
    if (!selectedType || !selectedColor || !rawSerials || !selectedWarehouse) return;
    const serials = rawSerials.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    
    setIsUploading(true);
    try {
      await bulkUploadMachines(selectedType, selectedColor, selectedWarehouse, serials, new Date(manualDate));
      setRawSerials('');
      setManualDate(new Date().toISOString().slice(0, 16));
      alert(`Berhasil mengunggah ${serials.length} mesin!`);
    } catch (e) {
      console.error(e);
      alert('Gagal mengunggah data');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 grayscale">
           <ArrowLeftCircle className="w-48 h-48" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowLeftCircle className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Inbound (Input Barang Masuk)</h2>
          </div>
          <p className="text-slate-500 text-sm mb-10">Gunakan form ini untuk merekam stok mesin baru yang masuk ke inventory.</p>

          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Target Model</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700"
                  onChange={(e) => {
                    const type = types.find(t => t.id === e.target.value);
                    setSelectedType(type || null);
                    setSelectedColor('');
                  }}
                >
                  <option value="">Select Machine Type...</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Conf. Color</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-semibold text-slate-700"
                  disabled={!selectedType}
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                >
                  <option value="">Select Color...</option>
                  {selectedType?.colors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Warehouse</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700"
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                >
                  {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Waktu Masuk</label>
                <input 
                  type="datetime-local" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                Data Stream (Serial Numbers / 1 per line)
              </label>
              <textarea
                rows={10}
                placeholder="SN-CORE-001&#10;SN-CORE-002&#10;..."
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed"
                value={rawSerials}
                onChange={(e) => setRawSerials(e.target.value)}
              />
              <div className="flex justify-between items-center mt-2 px-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  Load status: <span className="text-blue-600">{rawSerials.split('\n').filter(s => s.trim()).length} objects detected</span>
                </p>
                <button 
                  onClick={() => setRawSerials('')}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest"
                >
                  Clear Buffer
                </button>
              </div>
            </div>

            <button 
              onClick={handleUpload}
              className={cn(
                "w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95 group overflow-hidden relative",
                (!selectedType || !selectedColor || !rawSerials || isUploading) && "opacity-50 cursor-not-allowed"
              )}
              disabled={!selectedType || !selectedColor || !rawSerials || isUploading}
            >
               <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
               <div className="relative z-10 flex items-center gap-2">
                {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isUploading ? 'Executing Batch Process...' : 'Simpan Barang Masuk'}
               </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoManagementView() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [availableAccessories, setAvailableAccessories] = useState<Accessory[]>([]);
  const [subTab, setSubTab] = useState<'stock' | 'loans' | 'loan_form' | 'return_form'>('stock');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form states
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState<'ready' | 'hold'>('ready');
  const [note, setNote] = useState('');

  // Accessory tracking for loan
  const [attachedAccs, setAttachedAccs] = useState<{ id: string; quantity: number; name: string }[]>([]);
  // Accessory tracking for return
  const [returnStatusAccs, setReturnStatusAccs] = useState<{ id: string; quantity: number; name: string; isGood: boolean }[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'machines'), where('isDemo', '==', true), orderBy('updatedAt', 'desc'));
    const unsubMachines = onSnapshot(q, (snap) => {
      setMachines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });

    const qAcc = query(collection(db, 'accessories'), where('stock', '>', 0));
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      setAvailableAccessories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Accessory)));
    });

    return () => { unsubMachines(); unsubAcc(); };
  }, []);

  const addAccessoryToLoan = (accId: string) => {
    const acc = availableAccessories.find(a => a.id === accId);
    if (!acc) return;
    if (attachedAccs.find(a => a.id === accId)) return;
    setAttachedAccs([...attachedAccs, { id: acc.id, quantity: 1, name: acc.name }]);
  };

  const updateLoanAccQty = (id: string, qty: number) => {
    const accRef = availableAccessories.find(a => a.id === id);
    if (accRef && qty > accRef.stock) return;
    setAttachedAccs(attachedAccs.map(a => a.id === id ? { ...a, quantity: qty } : a));
  };

  const handleLoan = async () => {
    if (!selectedMachine || !customerName) return;
    setIsProcessing(true);
    try {
      await loanDemoMachine(selectedMachine, customerName, new Date(loanDate), attachedAccs);
      setSubTab('loans');
      setSelectedMachine(null);
      setCustomerName('');
      setAttachedAccs([]);
    } catch (e) {
      alert('Gagal memproses peminjaman');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedMachine) return;
    setIsProcessing(true);
    try {
      await returnDemoMachine(selectedMachine, condition, note, returnStatusAccs);
      setSubTab('stock');
      setSelectedMachine(null);
      setNote('');
      setReturnStatusAccs([]);
    } catch (e) {
      alert('Gagal memproses pengembalian');
    } finally {
      setIsProcessing(false);
    }
  };

  // When selected machine changes in return form, load its attached accessories
  useEffect(() => {
    if (subTab === 'return_form' && selectedMachine) {
      if (selectedMachine.attachedAccessories) {
        setReturnStatusAccs(selectedMachine.attachedAccessories.map(a => ({ ...a, isGood: true })));
      } else {
        setReturnStatusAccs([]);
      }
    }
  }, [selectedMachine, subTab]);

  const readyDemo = machines.filter(m => m.demoStatus === 'ready' || !m.demoStatus);
  const loanedDemo = machines.filter(m => m.demoStatus === 'loaned');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">Manajemen Unit Demo</h2>
              <p className="text-sm text-slate-500">Pantau lokasi dan status peminjaman mesin demo pameran.</p>
            </div>
          </div>
          
          <div className="flex gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-100">
            {(['stock', 'loans', 'loan_form', 'return_form'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setSubTab(t); setSelectedMachine(null); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                  subTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t === 'stock' ? 'Showroom Stock' : t === 'loans' ? 'Active Loans' : t === 'loan_form' ? 'Pinjamkan' : 'Pengembalian'}
              </button>
            ))}
          </div>
        </div>

        {subTab === 'stock' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Serial Number</th>
                  <th className="px-6 py-4">Machine Type</th>
                  <th className="px-6 py-4">Gudang / Lokasi</th>
                  <th className="px-6 py-4 text-right">Last Movement</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {readyDemo.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{m.serialNumber}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{m.typeName}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded font-bold text-[10px] uppercase tracking-wide">
                        {m.warehouse}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 font-mono">
                      {m.updatedAt ? formatDate(m.updatedAt.toDate()) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {readyDemo.length === 0 && (
              <div className="p-12 text-center text-slate-400 italic text-sm">Tidak ada unit demo di showroom.</div>
            )}
          </div>
        )}

        {subTab === 'loans' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Machine</th>
                  <th className="px-6 py-4">Customer / Lokasi Pinjam</th>
                  <th className="px-6 py-4">Tanggal Pinjam</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {loanedDemo.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{m.serialNumber}</p>
                      <p className="text-[10px] text-slate-500 italic">{m.typeName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-bold text-emerald-600">
                        <UserIcon className="w-3 h-3" />
                        {m.demoCustomerName}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600 italic">
                      {m.demoLoanDate ? formatDate(m.demoLoanDate.toDate()) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded font-bold text-[10px] uppercase">DIPINJAMKAN</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loanedDemo.length === 0 && (
              <div className="p-12 text-center text-slate-400 italic text-sm">Tidak ada peminjaman aktif.</div>
            )}
          </div>
        )}

        {subTab === 'loan_form' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Unit Demo Ready</span>
                <select 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium"
                  onChange={e => setSelectedMachine(readyDemo.find(m => m.id === e.target.value) || null)}
                  value={selectedMachine?.id || ''}
                >
                  <option value="">-- Pilih Unit Mesin --</option>
                  {readyDemo.map(m => (
                    <option key={m.id} value={m.id}>{m.serialNumber} - {m.typeName}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Customer / Pihak Peminjam</span>
                <input 
                  type="text" 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium" 
                  placeholder="Nama Customer..."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tanggal Keluar</span>
                <input 
                  type="date" 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium"
                  value={loanDate}
                  onChange={e => setLoanDate(e.target.value)}
                />
              </label>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Sertakan Kelengkapan</span>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold"
                  onChange={(e) => { addAccessoryToLoan(e.target.value); e.target.value = ''; }}
                  value=""
                >
                  <option value="">+ Tambah Kelengkapan...</option>
                  {availableAccessories.map(a => (
                    <option key={a.id} value={a.id} disabled={attachedAccs.find(at => at.id === a.id)}>{a.name} - Stok: {a.stock}</option>
                  ))}
                </select>

                <div className="space-y-2">
                  {attachedAccs.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-600 truncate flex-1">{acc.name}</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="1"
                          className="w-10 text-[10px] font-bold text-center bg-white border border-slate-200 rounded"
                          value={acc.quantity}
                          onChange={(e) => updateLoanAccQty(acc.id, parseInt(e.target.value) || 1)}
                        />
                        <button onClick={() => setAttachedAccs(attachedAccs.filter(a => a.id !== acc.id))}>
                          <X className="w-3 h-3 text-slate-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleLoan}
                disabled={isProcessing || !selectedMachine || !customerName}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                <ArrowUpRight className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                Proses Peminjaman
              </button>
            </div>
            
            <div className="bg-slate-50 rounded-3xl p-8 flex flex-col justify-center items-center text-center">
              <Monitor className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-sm text-slate-400 italic">Formulir untuk memproses unit pameran yang keluar untuk dipinjamkan ke customer.</p>
            </div>
          </div>
        )}

        {subTab === 'return_form' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Unit Demo Yang Dipinjam</span>
                <select 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium"
                  onChange={e => setSelectedMachine(loanedDemo.find(m => m.id === e.target.value) || null)}
                  value={selectedMachine?.id || ''}
                >
                  <option value="">-- Pilih Unit Mesin --</option>
                  {loanedDemo.map(m => (
                    <option key={m.id} value={m.id}>{m.serialNumber} ({m.demoCustomerName})</option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Kondisi Pengembalian</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCondition('ready')}
                    className={cn("flex-1 py-3 rounded-xl border font-bold text-xs", condition === 'ready' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white text-slate-400")}
                  >
                    Bagus / Ready Demo
                  </button>
                  <button 
                    onClick={() => setCondition('hold')}
                    className={cn("flex-1 py-3 rounded-xl border font-bold text-xs", condition === 'hold' ? "bg-amber-600 border-amber-600 text-white" : "bg-white text-slate-400")}
                  >
                    Rusak / Hold
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Catatan Pengecekan</span>
                <textarea 
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none h-32" 
                  placeholder="Keterangan fisik mesin..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </label>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pengembalian Kelengkapan</span>
                <div className="space-y-2">
                  {returnStatusAccs.map((acc, idx) => (
                    <div key={acc.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] font-bold text-slate-700">{acc.name}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Qty: {acc.quantity}</p>
                      </div>
                      <button 
                        onClick={() => {
                          const newAccs = [...returnStatusAccs];
                          newAccs[idx].isGood = !newAccs[idx].isGood;
                          setReturnStatusAccs(newAccs);
                        }}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all",
                          acc.isGood ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                        )}
                      >
                        {acc.isGood ? 'Kondisi Baik' : 'Kondisi Rusak'}
                      </button>
                    </div>
                  ))}
                  {returnStatusAccs.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-2">Tidak ada kelengkapan terdaftar.</p>}
                </div>
              </div>

              <button 
                onClick={handleReturn}
                disabled={isProcessing || !selectedMachine}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                <Undo2 className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                Proses Pengembalian
              </button>
            </div>

            <div className="bg-slate-50 rounded-3xl p-8 flex flex-col justify-center items-center text-center">
              <RefreshCw className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-sm text-slate-400 italic">Formulir untuk memproses pengembalian unit demo kembali ke showroom atau masuk ke perbaikan.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LogsView() {
  const [logs, setLogs] = useState<InventoryLog[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'inventoryLogs'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryLog)));
    });
  }, []);

  return (
    <div 
      className="grid grid-cols-12 gap-8"
    >
      <div className="col-span-12 md:col-span-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Master Audit Trail</h3>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-6 flex gap-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-3 h-3 rounded-full shadow-sm mt-1.5",
                    log.action === 'SALE' ? "bg-emerald-500 shadow-emerald-200" : "bg-blue-500 shadow-blue-200"
                  )} />
                  <div className="w-px h-full bg-slate-100 mt-2" />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-tight">
                        {log.action === 'SALE' ? 'Assignment Authorized' : 'Machine Provisioned'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">SN: <span className="font-mono text-blue-600 font-bold">{log.serialNumber}</span></p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.timestamp ? formatDate(log.timestamp.toDate()) : '-'}</p>
                       <p className="text-[9px] text-slate-500 mt-0.5 flex items-center justify-end gap-1">
                         <UserIcon className="w-2.5 h-2.5" /> {log.userEmail}
                       </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-600 font-medium">
                    {log.action === 'SALE' ? (
                      <div className="flex items-center gap-4">
                         <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                            <p className="text-slate-900 font-bold">{log.newData.customerName}</p>
                         </div>
                         <div className="w-px h-6 bg-slate-200" />
                         <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Shift</p>
                            <div className="flex items-center gap-2">
                               <span className="line-through text-slate-400">{log.previousData?.status}</span>
                               <ChevronRight className="w-3 h-3 text-slate-300" />
                               <span className="text-emerald-600 font-bold">SOLD</span>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Model Provisioned</p>
                            <p className="text-slate-900 font-bold">{log.newData.typeName}</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Config Code</p>
                            <p className="text-slate-900 font-bold">{log.newData.color}</p>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 space-y-6">
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <Download className="absolute -bottom-8 -right-8 w-40 h-40 opacity-5" />
           <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Log Analytics</h3>
           
           <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                 <div>
                    <p className="text-xs text-slate-400 mb-1">Today's Transactions</p>
                    <p className="text-3xl font-bold">{logs.filter(l => l.timestamp?.toDate().toDateString() === new Date().toDateString()).length}</p>
                 </div>
                 <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">+4 Active Users</p>
              </div>

              <div className="space-y-3">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reliability Index</p>
                 <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[99.9%]" />
                 </div>
                 <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400">SYNC ACCURACY</span>
                    <span className="text-emerald-400">99.9%</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
           <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Recent Users</h3>
           <div className="space-y-4">
             {Array.from(new Set(logs.map(l => l.userEmail))).slice(0, 5).map((email, i) => (
               <div key={i} className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {email[0].toUpperCase()}
                 </div>
                 <p className="text-xs font-bold text-slate-800 truncate">{email}</p>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}

function ReportView() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [reportType, setReportType] = useState<'available' | 'sold' | 'demo' | 'accessories' | 'all'>('sold');
  
  // States for editing sales
  const [editingSale, setEditingSale] = useState<Machine | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const qM = query(collection(db, 'machines'), orderBy('updatedAt', 'desc'));
    const unsubM = onSnapshot(qM, (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });

    const qA = query(collection(db, 'accessories'), orderBy('name', 'asc'));
    const unsubA = onSnapshot(qA, (snapshot) => {
      setAccessories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Accessory)));
    });

    return () => { unsubM(); unsubA(); };
  }, []);

  const reportData = machines.filter(m => {
    if (reportType === 'accessories') return false;
    if (reportType === 'all') return true;
    return m.status === reportType;
  });

  const soldMachines = machines.filter(m => m.status === 'sold');
  
  // Prepare data for charts
  const salesByModel = soldMachines.reduce((acc: any, m) => {
    acc[m.typeName] = (acc[m.typeName] || 0) + 1;
    return acc;
  }, {});

  const barChartData = Object.entries(salesByModel).map(([name, value]) => ({ name, value }));

  const salesByDay = soldMachines.reduce((acc: any, m) => {
    const date = m.updatedAt?.toDate().toLocaleDateString() || 'N/A';
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const lineChartData = Object.entries(salesByDay)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, sales]) => ({ date, sales }));

  const downloadCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'accessories') {
      headers = ['ID', 'Name', 'Type', 'Warehouse', 'Stock', 'Unit'];
      rows = accessories.map(a => [a.id, a.name, a.typeName, a.warehouse, a.stock, a.unit]);
    } else {
      headers = ['Serial Number', 'Machine Type', 'Color', 'Status', 'Customer', 'Date Transacted', 'Attached Accessories'];
      rows = reportData.map(m => [
        m.serialNumber,
        m.typeName,
        m.color,
        m.status.toUpperCase(),
        m.customerName || '-',
        m.updatedAt ? formatDate(m.updatedAt.toDate()) : '-',
        m.attachedAccessories?.map(a => `${a.name} (x${a.quantity})`).join("; ") || '-'
      ]);
    }
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditSale = (m: Machine) => {
    setEditingSale(m);
    setEditCustomerName(m.customerName || '');
    setEditDate(m.updatedAt?.toDate().toISOString().slice(0, 16) || '');
  };

  const saveEdit = async () => {
    if (!editingSale) return;
    setIsSaving(true);
    try {
      await updateSoldMachineRecord(editingSale.id, editCustomerName, new Date(editDate));
      setEditingSale(null);
    } catch (e) {
      alert('Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = async (m: Machine) => {
    if (!confirm('Batalkan penjualan ini? Unit akan kembali berstatus READY.')) return;
    try {
      await revertMachineStatus(m);
    } catch (e) {
      alert('Gagal membatalkan penjualan');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('HAPUS PERMANEN? Data mesin akan hilang sepenuhnya dari sistem.')) return;
    try {
      await deleteMachineRecord(id);
    } catch (e) {
      alert('Gagal menghapus data');
    }
  };

  return (
    <div className="space-y-8">
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart className="w-4 h-4" /> Penjualan Per Model
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <LineChart className="w-4 h-4" /> Trend Penjualan (Harian)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rincian Laporan Penjualan</h2>
            <p className="text-slate-500 text-sm">Kelola riwayat penjualan, edit data customer, atau batalkan transaksi.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100 flex gap-1">
              {(['sold', 'available', 'demo', 'accessories', 'all'] as const).map(type => (
                <button 
                  key={type}
                  onClick={() => setReportType(type)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    reportType === type 
                      ? "bg-slate-900 text-white shadow-lg" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {type === 'available' ? 'Stock Ready' : type === 'sold' ? 'Sold Items' : type === 'demo' ? 'Demo Units' : type === 'accessories' ? 'Kelengkapan' : 'All Machines'}
                </button>
              ))}
            </div>
            <button 
              onClick={downloadCSV}
              className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
              title="Download CSV"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
                {reportType === 'accessories' ? (
                  <>
                    <th className="px-6 py-3">Nama Barang</th>
                    <th className="px-6 py-3">Jenis</th>
                    <th className="px-6 py-3">Stok</th>
                    <th className="px-6 py-3 text-right">Gudang</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-3">Customer / Lokasi</th>
                    <th className="px-6 py-3">Machine & SN</th>
                    <th className="px-6 py-3">Date Info</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {reportType === 'accessories' ? (
                accessories.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{a.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{a.typeName}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-600">{a.stock} {a.unit}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">{a.warehouse}</span>
                    </td>
                  </tr>
                ))
              ) : (
                reportData.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 truncate max-w-[200px]">
                        {m.status === 'sold' ? (m.customerName || '-') : m.status === 'demo' ? (m.demoCustomerName || 'Showroom Stock') : m.warehouse}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {m.status === 'sold' ? 'Verified Sale' : m.status === 'demo' ? (m.demoStatus === 'loaned' ? 'Demo Loan' : 'Showroom') : 'Warehouse Stock'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{m.typeName}</div>
                      <div className="font-mono text-blue-600 font-bold flex items-center gap-2">
                        {m.serialNumber}
                        {m.attachedAccessories && m.attachedAccessories.length > 0 && (
                          <span className="cursor-help" title={m.attachedAccessories.map(a => `${a.name} (x${a.quantity})`).join('\n')}>
                            <Briefcase className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {m.status === 'demo' && m.demoStatus === 'loaned' 
                        ? (m.demoLoanDate ? formatDate(m.demoLoanDate.toDate()) : '-') 
                        : (m.updatedAt ? formatDate(m.updatedAt.toDate()) : '-')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.status === 'sold' && (
                          <>
                            <button onClick={() => handleEditSale(m)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleRevert(m)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg" title="Batalkan Penjualan">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteRecord(m.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {reportData.length === 0 && (
            <div className="py-20 text-center text-slate-300">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-[10px]">No records match selected perspective</p>
            </div>
          )}
        </div>
      </div>

      {editingSale && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Edit Data Penjualan</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Customer Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sale Date/Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setEditingSale(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200"
              >
                Batal
              </button>
              <button 
                onClick={saveEdit}
                className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
                disabled={isSaving}
              >
                {isSaving ? 'Menyimpan...' : 'Update Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SparepartsView() {
  const [parts, setParts] = useState<Sparepart[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Sparepart | null>(null);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('All');
  
  // Transaction states
  const [activePart, setActivePart] = useState<Sparepart | null>(null);
  const [transType, setTransType] = useState<'sell' | 'restock' | null>(null);
  const [transQty, setTransQty] = useState(1);
  const [customerName, setCustomerName] = useState('');
  
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState('Pcs');
  const [warehouse, setWarehouse] = useState<string>('Ngemplak');
  const [compats, setCompats] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'spareparts'), (snap) => {
      setParts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sparepart)));
    });
  }, []);

  const openModal = (p: Sparepart | null = null) => {
    if (p) {
      setEditingPart(p);
      setName(p.name);
      setPartNumber(p.partNumber);
      setStock(p.stock);
      setUnit(p.unit);
      setWarehouse(p.warehouse || 'Ngemplak');
      setCompats(p.machineCompatibility || []);
    } else {
      setEditingPart(null);
      setName('');
      setPartNumber('');
      setStock(0);
      setUnit('Pcs');
      setWarehouse('Ngemplak');
      setCompats([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = { name, partNumber, stock, unit, warehouse: warehouse as any, machineCompatibility: compats };
      if (editingPart) {
        await updateSparepart(editingPart.id, data);
      } else {
        await addSparepart(data);
      }
      setIsModalOpen(false);
    } catch (e) {
      alert('Gagal simpan sparepart');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus sparepart ini?')) return;
    await deleteSparepart(id);
  };

  const handleTransaction = async () => {
    if (!activePart || !transType) return;
    setIsSaving(true);
    try {
      if (transType === 'sell') {
        await sellSparepart(activePart, transQty, customerName);
        alert('Berhasil memproses penjualan sparepart');
      } else {
        await restockSparepart(activePart, transQty);
        alert('Stok berhasil ditambahkan');
      }
      setActivePart(null);
      setTransType(null);
      setTransQty(1);
      setCustomerName('');
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredParts = parts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.partNumber.toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse = filterWarehouse === 'All' || p.warehouse === filterWarehouse;
    return matchesSearch && matchesWarehouse;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">Inventory Sparepart</h2>
          <p className="text-sm text-slate-500">Kelola ketersediaan data stok dan penjualan suku cadang.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <input 
              type="text" 
              placeholder="Search sparepart..."
              className="text-xs border rounded-lg pl-8 pr-3 py-2 w-48 outline-none focus:ring-1 focus:ring-slate-900" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="text-xs border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-900"
            value={filterWarehouse}
            onChange={e => setFilterWarehouse(e.target.value)}
          >
            <option value="All">Semua Gudang</option>
            {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-all text-xs"
          >
            <Plus className="w-3 h-3" />
            Tambah Part
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
              <th className="px-6 py-4">Part Info</th>
              <th className="px-6 py-4">Gudang</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4">Kompabilitas</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredParts.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 group">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="font-mono text-xs text-blue-600">{p.partNumber}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{p.warehouse}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("px-2 py-1 rounded font-bold", p.stock < 5 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>
                    {p.stock} {p.unit}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {p.machineCompatibility?.map(m => (
                      <span key={m} className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">{m}</span>
                    )) || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { setActivePart(p); setTransType('sell'); }} 
                      className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-200"
                    >
                      JUAL
                    </button>
                    <button 
                      onClick={() => { setActivePart(p); setTransType('restock'); }} 
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold hover:bg-blue-200"
                    >
                      STOK MASUK
                    </button>
                    <button onClick={() => openModal(p)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transaction Modal */}
      {(activePart && transType) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {transType === 'sell' ? 'Penjualan Sparepart' : 'Tambah Stok Sparepart'}
            </h2>
            <p className="text-sm text-slate-500 mb-6">{activePart.name} ({activePart.partNumber})</p>
            
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Jumlah ({activePart.unit})</span>
                <input 
                  type="number" 
                  min="1"
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-bold" 
                  value={transQty} 
                  onChange={e => setTransQty(Math.max(1, Number(e.target.value)))} 
                />
              </label>

              {transType === 'sell' && (
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Pembeli</span>
                  <input 
                    type="text" 
                    placeholder="Masukkan nama customer..."
                    className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-medium" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                  />
                </label>
              )}
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => { setActivePart(null); setTransType(null); }}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button 
                onClick={handleTransaction}
                className={cn(
                  "flex-1 px-4 py-3 text-white rounded-xl font-semibold disabled:opacity-50",
                  transType === 'sell' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                )}
                disabled={isSaving || (transType === 'sell' && !customerName)}
              >
                {isSaving ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{editingPart ? 'Update Sparepart' : 'Input Sparepart Baru'}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Part</span>
                  <input type="text" className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none" value={name} onChange={e => setName(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Part Number</span>
                  <input type="text" className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-mono" value={partNumber} onChange={e => setPartNumber(e.target.value)} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Stok</span>
                  <input type="number" className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none" value={stock} onChange={e => setStock(Number(e.target.value))} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Satuan</span>
                  <input type="text" className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none" value={unit} onChange={e => setUnit(e.target.value)} />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Lokasi Gudang</span>
                <select className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none font-semibold" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                  {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CannibalView() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [partsTaken, setPartsTaken] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'machines'), where('status', '==', 'available'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setMachines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });
  }, []);

  const filtered = machines.filter(m => m.serialNumber.toLowerCase().includes(search.toLowerCase()));

  const handleCannibalize = async () => {
    if (!selectedMachine || !partsTaken) return;
    setIsProcessing(true);
    try {
      const parts = partsTaken.split(',').map(p => p.trim()).filter(p => p);
      await cannibalizeMachine(selectedMachine, parts, note);
      setSelectedMachine(null);
      setPartsTaken('');
      setNote('');
      alert('Mesin berhasil di-hold (Kanibal)');
    } catch (e) {
      alert('Gagal proses kanibal');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <Scissors className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Alur Kanibal / Hold</h2>
            <p className="text-sm text-slate-500">Pilih mesin ready yang akan dikanibal sparepartnya. Status akan di-HOLD otomatis.</p>
          </div>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Cari Serial Number untuk dikanibal..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <button 
              key={m.id} 
              onClick={() => setSelectedMachine(m)}
              className="p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-amber-500 hover:bg-amber-50/10 transition-all group relative"
            >
              <div className="absolute top-4 right-4 px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-bold text-slate-500 uppercase">{m.warehouse}</div>
              <div className="font-mono text-xs font-bold text-blue-600 mb-1">{m.serialNumber}</div>
              <div className="font-bold text-slate-900">{m.typeName}</div>
              <div className="text-[10px] text-slate-400 uppercase mt-2">Status: READY</div>
            </button>
          ))}
          {filtered.length === 0 && <div className="col-span-full py-10 text-center text-slate-400 italic">Tidak ada mesin ready yang ditemukan.</div>}
        </div>
      </div>

      {selectedMachine && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Konfirmasi Kanibal</h2>
            <p className="text-sm text-slate-500 mb-6">Serial: <span className="font-bold text-slate-900">{selectedMachine.serialNumber}</span></p>

            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Part yang Diambil (Pisahkan koma)</span>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Contoh: Sensor, Kabel Utama, Gear"
                  className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none italic"
                  value={partsTaken}
                  onChange={e => setPartsTaken(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Catatan Tambahan</span>
                <textarea className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none h-24" placeholder="Alasan dikanibal atau detail unit tujuan..." value={note} onChange={e => setNote(e.target.value)} />
              </label>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setSelectedMachine(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button 
                onClick={handleCannibalize}
                className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-semibold disabled:opacity-50"
                disabled={isProcessing || !partsTaken}
              >
                Hold Mesin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RepairView() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState('');
  const [fixingMachine, setFixingMachine] = useState<Machine | null>(null);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'machines'), where('status', '==', 'hold'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setMachines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine)));
    });
  }, []);

  const handleRepair = async () => {
    if (!fixingMachine) return;
    setIsProcessing(true);
    try {
      await repairMachine(fixingMachine, note);
      setFixingMachine(null);
      setNote('');
      alert('Mesin berhasil diperbaiki dan siap dijual!');
    } catch (e) {
      alert('Gagal selesaikan perbaikan');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Perbaikan Mesin (Repair)</h2>
            <p className="text-sm text-slate-500">Kembalikan status mesin HOLD menjadi READY setelah sparepart dipasang.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map(m => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 rounded">SN: {m.serialNumber}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 rounded font-bold uppercase">{m.warehouse}</span>
                 </div>
                 <ShieldAlert className="w-4 h-4 text-amber-500" />
              </div>
              <div className="p-6 flex-1">
                 <h4 className="font-bold text-slate-900 text-lg mb-2">{m.typeName}</h4>
                 <div className="space-y-2 mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Missing Parts:</p>
                    <div className="flex flex-wrap gap-1">
                      {m.cannibalizedParts?.map(p => (
                        <span key={p} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">{p}</span>
                      )) || <span className="text-xs italic text-slate-400">Kerusakan umum</span>}
                    </div>
                 </div>
                 <button 
                  onClick={() => setFixingMachine(m)}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-50 flex items-center justify-center gap-2"
                 >
                   <Hammer className="w-3.5 h-3.5" />
                   Selesaikan Perbaikan
                 </button>
              </div>
            </div>
          ))}
          {machines.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic uppercase tracking-widest text-[10px]">Tidak ada unit yang butuh perbaikan saat ini.</div>}
        </div>
      </div>

      {fixingMachine && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Selesaikan Perbaikan</h2>
            <div className="space-y-4 mb-10">
               <div className="p-4 bg-slate-50 rounded-xl">
                 <p className="text-xs text-slate-500">Mesin akan dikembalikan statusnya menjadi <span className="font-bold text-blue-600">READY (Available)</span> dan siap untuk proses Output Barang.</p>
               </div>
               <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Catatan Perbaikan</span>
                  <textarea className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none h-24 font-medium" placeholder="Part apa yang sudah diganti atau dipasang..." value={note} onChange={e => setNote(e.target.value)} />
               </label>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setFixingMachine(null)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold">Batal</button>
              <button 
                onClick={handleRepair}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-emerald-100"
                disabled={isProcessing}
              >
                Selesai & Ready
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersView() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [permissions, setPermissions] = useState<string[]>(['inventory']);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'appUsers'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });
  }, []);

  const openModal = (u: AppUser | null = null) => {
    if (u) {
      setEditingUser(u);
      setEmail(u.email);
      setDisplayName(u.displayName || '');
      setRole(u.role);
      setPermissions(u.permissions);
    } else {
      setEditingUser(null);
      setEmail('');
      setDisplayName('');
      setRole('staff');
      setPermissions(['inventory']);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!email) return;
    setIsSaving(true);
    try {
      await saveAppUser({
        id: editingUser?.id,
        email,
        displayName,
        role,
        permissions
      });
      setIsModalOpen(false);
    } catch (e) {
      alert('Gagal simpan user');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (p: string) => {
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const availablePermissions = [
    { id: 'inventory', label: 'Monitor Stok' },
    { id: 'inbound', label: 'Input Barang' },
    { id: 'outbound', label: 'Output Barang' },
    { id: 'spareparts', label: 'Sparepart' },
    { id: 'cannibal', label: 'Kanibal / Hold' },
    { id: 'repair', label: 'Perbaikan' },
    { id: 'config', label: 'Jenis & Warna' },
    { id: 'logs', label: 'Audit Records' },
    { id: 'report', label: 'Laporan Eksport' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg text-white">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manajemen Pengguna</h2>
            <p className="text-sm text-slate-500">Kelola akses dan izin menu untuk setiap anggota tim.</p>
          </div>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-black transition-all"
        >
          <Plus className="w-4 h-4" />
          Tambah User Access
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(u => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <ShieldCheck className="w-24 h-24 text-slate-900" />
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-none mb-1">{u.displayName || 'No Name'}</h3>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Akses Menu:</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">{u.role}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.permissions.map(p => (
                  <span key={p} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase border border-slate-200">
                    {availablePermissions.find(x => x.id === p)?.label || p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => openModal(u)}
                className="flex-1 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Edit Izin
              </button>
              <button 
                onClick={() => {
                  if(confirm('Hapus akses user ini?')) deleteAppUser(u.id);
                }}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingUser ? 'Edit Izin User' : 'Tambah User Management'}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email User</span>
                  <input 
                    type="email" 
                    className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none" 
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Tampilan</span>
                  <input 
                    type="text" 
                    className="w-full mt-1 px-4 py-3 bg-slate-50 border rounded-xl outline-none" 
                    placeholder="Budi Santoso"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Menu yang Boleh Diakses</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availablePermissions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePermission(p.id)}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-[10px] font-bold uppercase transition-all text-left",
                        permissions.includes(p.id)
                          ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100"
                          : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Role Utama</span>
                <div className="flex gap-2">
                  {(['staff', 'admin'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={cn(
                        "flex-1 py-3 rounded-xl border font-bold uppercase text-xs",
                        role === r ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 shadow-xl shadow-blue-100"
                disabled={isSaving || !email}
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Izin User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
