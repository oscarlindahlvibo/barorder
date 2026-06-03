import { LogOut, Users } from 'lucide-react';
import { ROLE_LABELS } from '../lib/supabase';
import { getUserRoles } from '../lib/auth';
import { useApp } from '../lib/store';

export default function RoleSelect() {
  const { currentUser, logout, selectRole } = useApp();

  if (!currentUser) {
    return null;
  }

  const roles = getUserRoles(currentUser);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/15 border border-orange-500/40 mb-4">
            <Users className="w-9 h-9 text-orange-400" />
          </div>
          <p className="text-orange-400 text-sm font-medium">Inloggad som</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">{currentUser.name}</h1>
          <p className="text-gray-400 mt-2">Välj vad du ska arbeta med just nu.</p>
        </div>

        <div className="space-y-3">
          {roles.map(role => (
            <button
              key={role}
              onClick={() => selectRole(role)}
              className="w-full min-h-14 rounded-xl bg-gray-900 hover:bg-gray-800 active:bg-gray-800 border border-gray-800 hover:border-orange-500/50 text-white font-semibold px-4 py-3 text-left transition-all"
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <button
          onClick={logout}
          className="w-full h-12 mt-5 rounded-xl bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Logga ut
        </button>
      </div>
    </div>
  );
}
