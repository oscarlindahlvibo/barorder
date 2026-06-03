import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, User, Users } from 'lucide-react';
import { AppUser, ROLE_LABELS, supabase, UserRole } from '../lib/supabase';
import { getUserRoles, passwordMatches, viewForRole, withSelectedRole } from '../lib/auth';
import { useApp } from '../lib/store';

const BOOTSTRAP_USERS = [
  { name: 'Admin', username: 'admin', pin: '0000', role: 'admin' as UserRole },
  { name: 'Barpersonal', username: 'bar', pin: '1234', role: 'barpersonal' as UserRole },
  { name: 'Serveringsansvarig', username: 'servering', pin: '4444', role: 'serveringsansvarig' as UserRole },
  { name: 'Personalansvarig', username: 'personal', pin: '5555', role: 'personal' as UserRole },
  { name: 'Lager', username: 'lager', pin: '6789', role: 'lager' as UserRole },
  { name: 'Kök', username: 'kok', pin: '2468', role: 'kitchen' as UserRole },
  { name: 'Köksskärm gäster', username: 'gastskarm', pin: '1357', role: 'kitchen_display' as UserRole },
];

export default function PinLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleChoices, setRoleChoices] = useState<UserRole[] | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<AppUser | null>(null);
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

    setAuthenticatedUser(user);
    setRoleChoices(roles);
  }

  function chooseRole(role: UserRole) {
    if (!authenticatedUser) return;
    const selectedUser = withSelectedRole(authenticatedUser, role);
    setCurrentUser(selectedUser, viewForRole(role));
  }

  function resetLogin() {
    setAuthenticatedUser(null);
    setRoleChoices(null);
    setPassword('');
    setError('');
  }

  if (authenticatedUser && roleChoices) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 safe-area-inset-top safe-area-inset-bottom">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/15 border border-orange-500/40 mb-4">
              <Users className="w-9 h-9 text-orange-400" />
            </div>
            <p className="text-orange-400 text-sm font-medium">Inloggad som</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">{authenticatedUser.name}</h1>
            <p className="text-gray-400 mt-2">Välj vad du ska arbeta med just nu.</p>
          </div>

          <div className="space-y-3">
            {roleChoices.map(role => (
              <button
                key={role}
                onClick={() => chooseRole(role)}
                className="w-full min-h-14 rounded-xl bg-gray-900 hover:bg-gray-800 active:bg-gray-800 border border-gray-800 hover:border-orange-500/50 text-white font-semibold px-4 py-3 text-left transition-all"
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          <button
            onClick={resetLogin}
            className="w-full h-12 mt-5 rounded-xl bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 font-medium"
          >
            Byt användare
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 safe-area-inset-top safe-area-inset-bottom">
      <form onSubmit={handleLogin} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/15 border border-orange-500/40 mb-4">
            <Lock className="w-9 h-9 text-orange-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ÅTM Personal</h1>
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

      </form>
    </div>
  );
}
