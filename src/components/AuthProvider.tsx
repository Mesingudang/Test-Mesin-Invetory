import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { AppUser } from '../types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
}

const SUPER_ADMIN_EMAIL = 'mesingudang8@gmail.com';

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  appUser: null, 
  loading: true, 
  isSuperAdmin: false 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubAppUser: () => void = () => {};

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      unsubAppUser(); // Clean up current user subscription
      setUser(authUser);
      
      if (authUser) {
        unsubAppUser = onSnapshot(doc(db, 'appUsers', authUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setAppUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          } else {
            setAppUser(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Error fetching app user doc", err);
          setLoading(false);
        });
      } else {
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      unsubAppUser();
    };
  }, []);

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse text-sm uppercase tracking-widest">Initializing Secure Connection...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, appUser, loading, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
