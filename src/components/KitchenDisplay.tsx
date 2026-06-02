import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, LogOut, Utensils } from 'lucide-react';
import { KitchenOrder, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';

function formatClock() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenDisplay() {
  const { logout } = useApp();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [clock, setClock] = useState(formatClock());

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('kitchen_orders')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: true });

    setOrders(data || []);
  }, []);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('kitchen-display-realtime')
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

    const refreshId = window.setInterval(loadOrders, 3000);
    const clockId = window.setInterval(() => setClock(formatClock()), 1000);

    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(clockId);
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  const latestOrderId = orders.length > 0 ? orders[orders.length - 1].id : undefined;
  const gridClass = useMemo(() => {
    if (orders.length <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (orders.length <= 6) return 'grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
  }, [orders.length]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      <header className="px-safe-screen pt-safe-header pb-4 sm:pb-6 border-b border-gray-800 bg-gray-900/90 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-green-500/15 border border-green-500/40 flex items-center justify-center flex-shrink-0">
            <Utensils className="w-7 h-7 sm:w-9 sm:h-9 text-green-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-black tracking-normal leading-tight">Order klar</h1>
            <p className="text-gray-400 text-sm sm:text-xl leading-snug">Hämta din order vid utlämningen</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-gray-300 text-2xl font-bold tabular-nums">
            <Clock className="w-6 h-6 text-gray-500" />
            {clock}
          </div>
          <button
            onClick={logout}
            className="h-12 w-12 rounded-lg text-gray-600 hover:text-white hover:bg-gray-800 flex items-center justify-center"
            aria-label="Logga ut"
            title="Logga ut"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-8 pb-safe-screen overflow-hidden">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
              <Utensils className="w-12 h-12 text-gray-700" />
            </div>
            <p className="text-5xl font-black text-gray-500">Inga klara ordrar</p>
            <p className="text-2xl text-gray-700 mt-3">Ordernummer visas här när köket markerar klart</p>
          </div>
        ) : (
          <div className={`h-full grid ${gridClass} gap-6 auto-rows-fr`}>
            {orders.map(order => {
              const isLatest = order.id === latestOrderId;
              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border flex flex-col items-center justify-center p-6 ${
                    isLatest
                      ? 'bg-green-500/20 border-green-400 shadow-[0_0_50px_rgba(34,197,94,0.22)]'
                      : 'bg-gray-900 border-gray-800'
                  }`}
                >
                  <p className="text-gray-400 text-2xl font-bold uppercase tracking-wider mb-4">Order</p>
                  <p className="text-[clamp(5rem,14vw,12rem)] font-black tabular-nums leading-none text-white">
                    {order.order_number}
                  </p>
                  {isLatest && (
                    <p className="mt-5 text-green-200 text-2xl font-black uppercase tracking-wide">Nyss klar</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
