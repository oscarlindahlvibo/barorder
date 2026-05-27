import { useEffect, useState } from 'react';
import { ChevronLeft, Package, Clock, AlertTriangle } from 'lucide-react';
import { supabase, RestockRequest, STATUS_LABELS, STATUS_COLORS } from '../lib/supabase';
import { useApp } from '../lib/store';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s sedan`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h sedan`;
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function History() {
  const { currentUser, setView } = useApp();
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = supabase
      .from('restock_requests')
      .select(`*, users(id, name), locations(id, name), restock_request_items(*)`)
      .order('created_at', { ascending: false });

    if (currentUser?.role === 'barpersonal') {
      query.eq('user_id', currentUser.id);
    }

    query.then(({ data }) => {
      setRequests(data || []);
      setLoading(false);
    });
  }, [currentUser]);

  const backView = (currentUser?.role === 'lager' || currentUser?.role === 'admin') ? 'dashboard' : 'request';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setView(backView)}
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg">
            {currentUser?.role === 'barpersonal' ? 'Mina beställningar' : 'Alla beställningar'}
          </h1>
          <p className="text-gray-400 text-xs">{requests.length} beställningar</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Inga beställningar än</p>
          </div>
        ) : (
          requests.map(req => (
            <div
              key={req.id}
              className={`rounded-xl border p-4 ${
                req.priority === 'akut'
                  ? 'border-red-500/40 bg-red-950/20'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">{req.locations?.name || '—'}</span>
                  {req.priority === 'akut' && (
                    <span className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" /> AKUT
                    </span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${STATUS_COLORS[req.status]}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>

              <div className="space-y-0.5 mb-2">
                {req.restock_request_items?.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">{item.product_name}</span>
                    <span className="text-gray-400">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>

              {req.note && (
                <p className="text-gray-500 text-xs italic mb-2">&ldquo;{req.note}&rdquo;</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(req.created_at)}
                </span>
                {currentUser?.role !== 'barpersonal' && (
                  <span>{req.users?.name}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
