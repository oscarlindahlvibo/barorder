import { useState } from 'react';
import { Delete, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/store';

export default function PinLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useApp();

  async function handleLogin(finalPin: string) {
    if (finalPin.length < 4) return;
    setLoading(true);
    setError('');

    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('pin', finalPin)
      .eq('active', true)
      .maybeSingle();

    setLoading(false);

    if (dbError || !data) {
      setError('Fel PIN-kod. Försök igen.');
      setPin('');
      return;
    }

    const nextView = data.role === 'personal'
      ? 'staff-dashboard'
      : (data.role === 'lager' || data.role === 'admin')
        ? 'dashboard'
        : 'location-select';
    setCurrentUser(data, nextView);
  }

  function pressKey(digit: string) {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      handleLogin(newPin);
    }
  }

  function pressDelete() {
    setPin(p => p.slice(0, -1));
    setError('');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-xs">
        {/* Logo/Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-500/20 border border-orange-500/40 mb-4">
            <span className="text-4xl">🚛</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Åseda Truckmeet</h1>
          <p className="text-gray-400 mt-1">Bardashboard</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? 'bg-orange-500 border-orange-500 scale-110'
                  : 'bg-transparent border-gray-600'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-red-400 text-sm mb-4 bg-red-500/10 rounded-lg py-2 px-3">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          /* PIN pad */
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                onClick={() => pressKey(d)}
                className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 text-white text-2xl font-semibold border border-gray-700 transition-all duration-100 select-none"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => pressKey('0')}
              className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 text-white text-2xl font-semibold border border-gray-700 transition-all duration-100 select-none"
            >
              0
            </button>
            <button
              onClick={pressDelete}
              className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 text-gray-300 border border-gray-700 transition-all duration-100 select-none flex items-center justify-center"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs mt-8">
          Demo: PIN 0000 = Admin · 1234 = Barpersonal · 5555 = Personal · 6789 = Lager
        </p>
      </div>
    </div>
  );
}
