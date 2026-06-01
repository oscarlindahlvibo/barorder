import { useCallback, useEffect, useState } from 'react';
import { Check, Delete, LogOut, RotateCw, Utensils, X } from 'lucide-react';
import { KitchenOrder, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenDashboard() {
  const { currentUser, logout } = useApp();
  const [orderNumber, setOrderNumber] = useState('');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('kitchen_orders')
      .select('*, users(id, name, role)')
      .eq('status', 'ready')
      .order('created_at', { ascending: true });

    setOrders(data || []);
  }, []);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kitchen_orders',
      }, () => loadOrders())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kitchen_orders',
      }, () => loadOrders())
      .subscribe();

    const intervalId = window.setInterval(loadOrders, 3000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  function pressDigit(digit: string) {
    if (orderNumber.length >= 4 || saving) return;
    setOrderNumber(value => value + digit);
  }

  function clearOne() {
    setOrderNumber(value => value.slice(0, -1));
  }

  async function markReady() {
    const trimmed = orderNumber.replace(/\D/g, '');
    if (!trimmed || saving) return;

    setSaving(true);
    await supabase.from('kitchen_orders').insert({
      order_number: trimmed,
      status: 'ready',
      created_by: currentUser?.id ?? null,
    });
    setOrderNumber('');
    await loadOrders();
    setSaving(false);
  }

  async function dismissOrder(order: KitchenOrder) {
    setUpdatingId(order.id);
    await supabase
      .from('kitchen_orders')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', order.id);
    await loadOrders();
    setUpdatingId(null);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center">
            <Utensils className="w-6 h-6 text-orange-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Kök</h1>
            <p className="text-sm text-gray-400">Markera ordernummer som klara</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="h-10 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Logga ut
        </button>
      </header>

      <main className="flex-1 grid lg:grid-cols-[420px_1fr] gap-4 p-4 overflow-hidden">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col">
          <div className="h-24 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center mb-4">
            <span className={`font-black tabular-nums ${orderNumber ? 'text-white text-6xl' : 'text-gray-700 text-3xl'}`}>
              {orderNumber || 'ORDERNR'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                onClick={() => pressDigit(digit)}
                className="h-20 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-3xl font-bold border border-gray-700"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={() => setOrderNumber('')}
              className="h-20 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 flex items-center justify-center"
              aria-label="Rensa"
              title="Rensa"
            >
              <X className="w-8 h-8" />
            </button>
            <button
              onClick={() => pressDigit('0')}
              className="h-20 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-3xl font-bold border border-gray-700"
            >
              0
            </button>
            <button
              onClick={clearOne}
              className="h-20 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center justify-center"
              aria-label="Ta bort siffra"
              title="Ta bort siffra"
            >
              <Delete className="w-8 h-8" />
            </button>
          </div>

          <button
            onClick={markReady}
            disabled={!orderNumber || saving}
            className="mt-4 h-16 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xl font-black flex items-center justify-center gap-2"
          >
            <Check className="w-6 h-6" />
            KLAR
          </button>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col min-h-[480px]">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">På utlämningsskärmen</h2>
              <p className="text-sm text-gray-500">{orders.length} order visas för gäster</p>
            </div>
            <button
              onClick={loadOrders}
              className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center"
              aria-label="Uppdatera"
              title="Uppdatera"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {orders.length === 0 ? (
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center">
                <Utensils className="w-14 h-14 text-gray-700 mb-3" />
                <p className="text-gray-500 text-lg">Inga klara ordrar just nu</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {orders.map(order => (
                  <button
                    key={order.id}
                    onClick={() => dismissOrder(order)}
                    disabled={updatingId === order.id}
                    className="min-h-36 rounded-xl border border-green-500/35 bg-green-500/10 hover:bg-green-500/20 text-left p-4 transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-6xl font-black tabular-nums text-white leading-none">{order.order_number}</span>
                      <span className="text-xs font-bold text-green-200 bg-green-500/20 border border-green-500/30 rounded-full px-2 py-1">
                        Klar
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-4">Tryck när ordern är hämtad</p>
                    <p className="text-xs text-gray-600 mt-1">{formatTime(order.created_at)} · {order.users?.name || 'Kök'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
