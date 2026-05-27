import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, BellOff, Clock, MapPin, AlertTriangle, Package, ChevronDown, History, Settings, LogOut, RefreshCw, X } from 'lucide-react';
import { supabase, RestockRequest, RequestStatus, STATUS_LABELS, STATUS_COLORS } from '../lib/supabase';
import { useApp } from '../lib/store';

const STATUS_ORDER: RequestStatus[] = ['mottagen', 'pa_vag', 'levererad', 'kan_ej_levereras'];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s sedan`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h sedan`;
  return `${Math.floor(diff / 86400)} d sedan`;
}

interface NewOrderAlert {
  id: string;
  location: string;
  items: string;
  priority: string;
  time: number;
}

export default function Dashboard() {
  const { currentUser, setView, logout } = useApp();
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [alert, setAlert] = useState<NewOrderAlert | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const alertTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Check notification state on mount
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    } else if (Notification.permission === 'default') {
      // Not yet asked — show the onboarding prompt
      setShowNotifPrompt(true);
    }
  }, []);

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === 'granted');
    setShowNotifPrompt(false);
  }

  const playAlert = useCallback((isAkut: boolean) => {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isAkut) {
        // Urgent alarm: 3 rapid high beeps
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.45);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
      } else {
        // Normal: single pleasant chime
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio not available
    }
  }, []);

  const sendBrowserNotification = useCallback((req: RestockRequest) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const location = req.locations?.name || 'Okänd plats';
        const items = req.restock_request_items?.map(i => `${i.quantity}× ${i.product_name}`).join(', ') || '';
        const title = req.priority === 'akut' ? `AKUT! Ny beställning — ${location}` : `Ny beställning — ${location}`;
        new Notification(title, {
          body: items,
          icon: '/vite.svg',
          tag: req.id,
          requireInteraction: req.priority === 'akut',
        });
      }
    } catch {
      // Notification not available
    }
  }, []);

  function showAlertPopup(req: RestockRequest) {
    const location = req.locations?.name || 'Okänd plats';
    const items = req.restock_request_items?.map(i => `${i.quantity}× ${i.product_name}`).join(', ') || '';

    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert({
      id: req.id,
      location,
      items,
      priority: req.priority,
      time: Date.now(),
    });

    // Auto-dismiss after 8 seconds for normal, 15 for akut
    const duration = req.priority === 'akut' ? 15000 : 8000;
    alertTimerRef.current = setTimeout(() => setAlert(null), duration);
  }

  async function fetchRequests() {
    const query = supabase
      .from('restock_requests')
      .select(`
        *,
        users(id, name, role),
        locations(id, name),
        restock_request_items(*)
      `)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query.in('status', ['mottagen', 'pa_vag']);
    }

    const { data } = await query;
    return data || [];
  }

  useEffect(() => {
    setLoading(true);
    fetchRequests().then(data => {
      setRequests(data);
      const mottagenIds = new Set(data.filter(r => r.status === 'mottagen').map(r => r.id));
      prevIdsRef.current = mottagenIds;
      setLoading(false);
    });
  }, [filter]);

  useEffect(() => {
    const channel = supabase
      .channel('restock-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restock_requests',
      }, (payload) => {
        // New request inserted — fetch full details with relations
        supabase
          .from('restock_requests')
          .select(`*, users(id, name, role), locations(id, name), restock_request_items(*)`)
          .eq('id', payload.new.id)
          .maybeSingle()
          .then(({ data: newReq }) => {
            if (!newReq) return;
            const isNew = !prevIdsRef.current.has(newReq.id);
            if (isNew) {
              prevIdsRef.current.add(newReq.id);
              playAlert(newReq.priority === 'akut');
              sendBrowserNotification(newReq);
              showAlertPopup(newReq);
            }
            // Refresh full list
            fetchRequests().then(setRequests);
          });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restock_requests',
      }, () => {
        fetchRequests().then(setRequests);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter, playAlert, sendBrowserNotification]);

  async function updateStatus(requestId: string, status: RequestStatus) {
    setUpdatingId(requestId);
    await supabase
      .from('restock_requests')
      .update({ status })
      .eq('id', requestId);
    setUpdatingId(null);
    const data = await fetchRequests();
    setRequests(data);
  }

  const activeCount = requests.filter(r => r.status === 'mottagen' || r.status === 'pa_vag').length;
  const akutCount = requests.filter(r => r.priority === 'akut' && (r.status === 'mottagen' || r.status === 'pa_vag')).length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">Lagerdashboard</h1>
            <p className="text-gray-400 text-xs">{currentUser?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={requestNotificationPermission}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                notificationsEnabled
                  ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                  : 'text-gray-400 bg-gray-800 hover:text-white hover:bg-gray-700'
              }`}
              title={notificationsEnabled ? 'Notiser aktiva' : 'Aktivera notiser'}
            >
              {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span>{notificationsEnabled ? 'Pa' : 'Off'}</span>
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setView('admin')}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setView('history')}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-3">
          <div className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-center">
            <p className="text-amber-400 text-xl font-bold">{activeCount}</p>
            <p className="text-gray-400 text-xs">Aktiva</p>
          </div>
          {akutCount > 0 && (
            <div className="flex-1 bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-2 text-center animate-pulse">
              <p className="text-red-400 text-xl font-bold">{akutCount}</p>
              <p className="text-gray-400 text-xs">Akuta</p>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setFilter('active')}
            className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-all ${
              filter === 'active'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            Aktiva
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-all ${
              filter === 'all'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            Alla
          </button>
        </div>
      </div>

      {/* Notification onboarding banner */}
      {showNotifPrompt && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-200 font-semibold text-sm">Aktivera notiser</p>
              <p className="text-gray-400 text-xs mt-0.5">Fa ljud och notiser nar nya bestallningar kommer in, aven nar fliken ar i bakgrunden.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowNotifPrompt(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
              >
                Senare
              </button>
              <button
                onClick={requestNotificationPermission}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-gray-950 hover:bg-amber-400 transition-colors"
              >
                Aktivera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request list */}
      <div className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Inga aktiva beställningar</p>
          </div>
        ) : (
          requests.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              expanded={expandedId === req.id}
              onToggle={() => setExpandedId(prev => prev === req.id ? null : req.id)}
              onStatusChange={updateStatus}
              updating={updatingId === req.id}
            />
          ))
        )}
      </div>

      {/* New order alert popup */}
      {alert && (
        <div className="fixed inset-x-0 top-4 z-50 px-4 animate-slide-down">
          <div className={`max-w-lg mx-auto rounded-2xl border-2 p-4 shadow-2xl ${
            alert.priority === 'akut'
              ? 'bg-red-900/95 border-red-500 shadow-red-900/50'
              : 'bg-gray-900/95 border-orange-500 shadow-orange-900/30'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                alert.priority === 'akut' ? 'bg-red-500/30 animate-pulse' : 'bg-orange-500/30'
              }`}>
                {alert.priority === 'akut'
                  ? <AlertTriangle className="w-6 h-6 text-red-300" />
                  : <Bell className="w-6 h-6 text-orange-300" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-lg ${
                  alert.priority === 'akut' ? 'text-red-200' : 'text-white'
                }`}>
                  {alert.priority === 'akut' ? 'AKUT BESTÄLLNING!' : 'Ny beställning!'}
                </p>
                <p className="text-gray-300 font-semibold">{alert.location}</p>
                <p className="text-gray-400 text-sm mt-1 truncate">{alert.items}</p>
              </div>
              <button
                onClick={() => {
                  if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
                  setAlert(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  expanded,
  onToggle,
  onStatusChange,
  updating,
}: {
  request: RestockRequest;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
  updating: boolean;
}) {
  const isAkut = request.priority === 'akut';
  const isActive = request.status === 'mottagen' || request.status === 'pa_vag';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isAkut && isActive
        ? 'border-red-500/60 bg-red-950/30 shadow-red-900/20 shadow-lg'
        : 'border-gray-800 bg-gray-900'
    }`}>
      {isAkut && isActive && (
        <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-bold">AKUT BESTÄLLNING</span>
        </div>
      )}

      <button onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-base">
                {request.locations?.name || '—'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[request.status]}`}>
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(request.created_at)}
              </span>
              <span className="text-gray-500 text-xs">{request.users?.name || '—'}</span>
            </div>
            {/* Items preview */}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {request.restock_request_items?.slice(0, 3).map(item => (
                <span key={item.id} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                  {item.quantity}× {item.product_name}
                </span>
              ))}
              {(request.restock_request_items?.length || 0) > 3 && (
                <span className="text-gray-500 text-xs px-1">+{(request.restock_request_items?.length || 0) - 3} till</span>
              )}
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          {/* Full items list */}
          <div className="space-y-1">
            {request.restock_request_items?.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-300">{item.product_name}</span>
                <span className="text-orange-400 font-medium">{item.quantity} {item.unit}</span>
              </div>
            ))}
          </div>

          {request.note && (
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <p className="text-gray-400 text-xs mb-1">Anteckning</p>
              <p className="text-gray-200 text-sm">{request.note}</p>
            </div>
          )}

          {/* Status buttons */}
          {updating ? (
            <div className="flex justify-center py-2">
              <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(['mottagen', 'pa_vag', 'levererad', 'kan_ej_levereras'] as RequestStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(request.id, s)}
                  className={`h-10 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                    request.status === s
                      ? STATUS_COLORS[s] + ' opacity-100'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
