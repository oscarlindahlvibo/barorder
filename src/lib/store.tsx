import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppUser, Location } from './supabase';

type View = 'login' | 'location-select' | 'request' | 'dashboard' | 'staff-dashboard' | 'history' | 'admin' | 'chat';

interface PersistedState {
  user: AppUser | null;
  location: Location | null;
  view: View;
}

interface AppState {
  currentUser: AppUser | null;
  currentLocation: Location | null;
  view: View;
  setCurrentUser: (user: AppUser | null, nextView?: View) => void;
  setCurrentLocation: (location: Location | null, nextView?: View) => void;
  setView: (view: View) => void;
  logout: () => void;
}

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = 'truckmeet_state';

function readStorage(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.user && parsed.view) {
        return { user: parsed.user, location: parsed.location || null, view: parsed.view };
      }
    }
  } catch { /* corrupted */ }
  return { user: null, location: null, view: 'login' };
}

function writeStorage(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: reads localStorage synchronously BEFORE first render
  const [state, setState] = useState<PersistedState>(readStorage);

  const setCurrentUser = useCallback((user: AppUser | null, nextView?: View) => {
    setState(prev => {
      const next = { ...prev, user, view: nextView ?? prev.view };
      writeStorage(next);
      return next;
    });
  }, []);

  const setCurrentLocation = useCallback((location: Location | null, nextView?: View) => {
    setState(prev => {
      const next = { ...prev, location, view: nextView ?? prev.view };
      writeStorage(next);
      return next;
    });
  }, []);

  const setView = useCallback((view: View) => {
    setState(prev => {
      const next = { ...prev, view };
      writeStorage(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    const next = { user: null, location: null, view: 'login' as View };
    writeStorage(next);
    setState(next);
  }, []);

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setState(readStorage());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser: state.user,
      currentLocation: state.location,
      view: state.view,
      setCurrentUser,
      setCurrentLocation,
      setView,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
