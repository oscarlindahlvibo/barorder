import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppUser, Location, UserRole } from './supabase';
import { viewForRole, withSelectedRole } from './auth';

type View = 'login' | 'role-select' | 'location-select' | 'request' | 'dashboard' | 'staff-dashboard' | 'serving-dashboard' | 'kitchen-dashboard' | 'kitchen-display' | 'schedule-display' | 'exhibition-display' | 'event-planning' | 'staff-ledger' | 'history' | 'admin' | 'chat';
export type ThemeMode = 'system' | 'dark' | 'light';

interface PersistedState {
  user: AppUser | null;
  location: Location | null;
  view: View;
}

interface AppState {
  currentUser: AppUser | null;
  currentLocation: Location | null;
  view: View;
  themeMode: ThemeMode;
  setCurrentUser: (user: AppUser | null, nextView?: View) => void;
  setCurrentLocation: (location: Location | null, nextView?: View) => void;
  selectRole: (role: UserRole) => void;
  setView: (view: View) => void;
  setThemeMode: (mode: ThemeMode) => void;
  logout: () => void;
}

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = 'truckmeet_state';
const THEME_STORAGE_KEY = 'truckmeet_theme_mode';

function readThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function applyTheme(mode: ThemeMode) {
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const resolved = mode === 'system' ? (prefersLight ? 'light' : 'dark') : mode;
  document.documentElement.classList.toggle('theme-light', resolved === 'light');
  document.documentElement.classList.toggle('theme-dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f8fafc' : '#020617');
}

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
  const [themeModeState, setThemeModeState] = useState<ThemeMode>(readThemeMode);

  useEffect(() => {
    applyTheme(themeModeState);
    localStorage.setItem(THEME_STORAGE_KEY, themeModeState);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    function onChange() {
      if (themeModeState === 'system') applyTheme(themeModeState);
    }
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [themeModeState]);

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

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const selectRole = useCallback((role: UserRole) => {
    setState(prev => {
      if (!prev.user) return prev;
      const user = withSelectedRole(prev.user, role);
      const next = {
        user,
        location: role === 'barpersonal' ? null : prev.location,
        view: viewForRole(role) as View,
      };
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
      themeMode: themeModeState,
      setCurrentUser,
      setCurrentLocation,
      selectRole,
      setView,
      setThemeMode,
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
