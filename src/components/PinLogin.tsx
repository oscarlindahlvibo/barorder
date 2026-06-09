import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { AppUser, supabase, UserRole } from '../lib/supabase';
import { getUserRoles, passwordMatches, viewForRole, withSelectedRole } from '../lib/auth';
import { useApp } from '../lib/store';
import ThemeSelector from './ThemeSelector';

const BOOTSTRAP_USERS = [
  { name: 'Admin', username: 'admin', pin: '0000', role: 'admin' as UserRole },
  { name: 'Barpersonal', username: 'bar', pin: '1234', role: 'barpersonal' as UserRole },
  { name: 'Serveringsansvarig', username: 'servering', pin: '4444', role: 'serveringsansvarig' as UserRole },
  { name: 'Personalansvarig', username: 'personal', pin: '5555', role: 'personal' as UserRole },
  { name: 'Lager', username: 'lager', pin: '6789', role: 'lager' as UserRole },
  { name: 'Kök', username: 'kok', pin: '2468', role: 'kitchen' as UserRole },
  { name: 'Köksskärm gäster', username: 'gastskarm', pin: '1357', role: 'kitchen_display' as UserRole },
  { name: 'Schemaskärm', username: 'schema', pin: '8642', role: 'schedule_display' as UserRole },
  { name: 'Utställningsservice TV', username: 'utstallning', pin: '9753', role: 'exhibition_display' as UserRole },
  { name: 'Personalliggare', username: 'personalliggare', pin: '1122', role: 'staff_ledger' as UserRole },
];

export default function PinLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useApp();

  async function bootstrapKnownUser(login: string) {
    const bootstrapUser = BOOTSTRAP_USERS.find(user => user.username === login || user.pin === login);
    if (!bootstrapUser) return null;

    const result = await supabase
      .from('users')
      .insert({
        name: bootstrapUser.name,
        username: bootstrapUser.username,
        pin: bootstrapUser.pin,
        role: bootstrapUser.role,
        roles: bootstrapUser.role === 'admin' ? BOOTSTRAP_USERS.map(user => user.role) : [bootstrapUser.role],
        active: true,
      })
      .select()
      .single();

    return result.data as AppUser | null;
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    const login = username.trim().toLowerCase();
    if (!login || !password) return;

    setLoading(true);
    setError('');

    let { data } = await supabase
      .from('users')
      .select('*')
      .eq('username', login)
      .eq('active', true)
      .maybeSingle();

    if (!data) {
      const legacy = await supabase
        .from('users')
        .select('*')
        .eq('pin', login)
        .eq('active', true)
        .maybeSingle();
      data = legacy.data;
    }

    if (!data) {
      data = await bootstrapKnownUser(login);
    }

    const user = data as AppUser | null;
    const allowed = user ? await passwordMatches(user, password) : false;
    setLoading(false);

    if (!user || !allowed) {
      setError('Fel användarnamn eller lösenord.');
      setPassword('');
      return;
    }

    const roles = getUserRoles(user);
    if (roles.length === 1) {
      const selectedUser = withSelectedRole(user, roles[0]);
      setCurrentUser(selectedUser, viewForRole(selectedUser.role));
      return;
    }

    setCurrentUser(withSelectedRole(user, roles[0]), 'role-select');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 safe-area-inset-top safe-area-inset-bottom">
      <form onSubmit={handleLogin} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/aseda-truckmeet-logo.png"
            alt="Åseda Truckmeet"
            className="mx-auto mb-4 w-full max-w-[260px] brightness-0 invert"
          />
          <h1 className="text-2xl font-bold tracking-[0.22em] text-white">ÅTM PERSONAL</h1>
          <p className="text-gray-400 mt-1">Logga in för att välja arbetsläge</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-300">Användarnamn</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-gray-900 border border-gray-800 px-3 focus-within:border-orange-500">
              <User className="w-5 h-5 text-gray-500" />
              <input
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="h-12 min-h-12 w-full bg-transparent text-white placeholder-gray-600 focus:outline-none"
                placeholder="t.ex. admin"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-300">Lösenord</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-gray-900 border border-gray-800 px-3 focus-within:border-orange-500">
              <Lock className="w-5 h-5 text-gray-500" />
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="h-12 min-h-12 w-full bg-transparent text-white placeholder-gray-600 focus:outline-none"
                placeholder="Lösenord"
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="p-2 -mr-2 rounded-lg text-gray-500 hover:text-white"
                aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
                title={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <p className="text-center text-red-400 text-sm mt-4 bg-red-500/10 rounded-lg py-2 px-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full h-12 min-h-12 mt-5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
          Logga in
        </button>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 mb-2">Tema</p>
          <ThemeSelector />
        </div>
      </form>
    </div>
  );
}
