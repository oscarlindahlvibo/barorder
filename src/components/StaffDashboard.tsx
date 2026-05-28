import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BellOff, CheckCircle2, Clock, LogOut, RefreshCw, ShieldAlert, UserCheck, Wrench } from 'lucide-react';
import { supabase, PRIORITY_LABELS, REQUEST_TYPE_LABELS, RequestStatus, RestockRequest, STATUS_COLORS, STATUS_LABELS } from '../lib/supabase';
import { useApp } from '../lib/store';
import { enableLockedScreenPush } from '../lib/pushNotifications';

const STAFF_TYPES = ['security_call', 'it_support', 'serving_manager'];
const STAFF_STATUS_LABELS: Partial<Record<RequestStatus, string>> = {
  mottagen: 'Mottagen',
  pa_vag: 'Tillkallad',
  kan_ej_levereras: 'Återkallad',
  levererad: 'Avslutat',
};
const STAFF_STATUS_COLORS: Partial<Record<RequestStatus, string>> = {
  mottagen: STATUS_COLORS.mottagen,
  pa_vag: STATUS_COLORS.pa_vag,
  kan_ej_levereras: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  levererad: STATUS_COLORS.levererad,
};
const STAFF_STATUS_ACTIONS: { status: RequestStatus; label: string }[] = [
  { status: 'mottagen', label: 'Mottagen' },
  { status: 'pa_vag', label: 'Tillkallad' },
  { status: 'levererad', label: 'Avsluta ärende' },
];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s sedan`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h sedan`;
  return `${Math.floor(diff / 86400)} d sedan`;
}

function iconFor(type: string) {
  if (type === 'security_call') return ShieldAlert;
  if (type === 'it_support') return Wrench;
  return UserCheck;
}

function getItemsText(req: RestockRequest): string {
  return req.restock_request_items?.map(i => `${i.quantity}× ${i.product_name}`).join(', ') || '';
}

function sortStaffRequests(requests: RestockRequest[]) {
  return [...requests].sort((a, b) => {
    const priorityDiff = (a.priority === 'akut' ? 0 : 1) - (b.priority === 'akut' ? 0 : 1);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export default function StaffDashboard() {
  const { currentUser, logout } = useApp();
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  async function requestNotificationPermission() {
    if (!currentUser) return;
    const enabled = await enableLockedScreenPush(currentUser);
    setNotificationsEnabled(enabled);
  }

  const playAlert = useCallback((requestType?: string) => {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (requestType === 'security_call') {
        osc.type = 'square';
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);

        for (let step = 0; step < 40; step += 1) {
          const t = ctx.currentTime + step * 0.25;
          osc.frequency.setValueAtTime(step % 2 === 0 ? 1650 : 2350, t);
          gain.gain.setValueAtTime(0.75, t);
          gain.gain.setValueAtTime(0.03, t + 0.12);
        }

        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 10);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 10);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio not available
    }
  }, []);

  const sendBrowserNotification = useCallback((req: RestockRequest) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const location = req.locations?.name || 'Okänd plats';
        const typeLabel = REQUEST_TYPE_LABELS[req.request_type ?? 'security_call'];
        const title = req.priority === 'akut' ? `AKUT! ${typeLabel} - ${location}` : `${typeLabel} - ${location}`;
        const options = {
          body: getItemsText(req) || 'Nytt personalärende väntar.',
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: req.id,
          requireInteraction: req.priority === 'akut',
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(registration => registration.showNotification(title, options))
            .catch(() => new Notification(title, options));
        } else {
          new Notification(title, options);
        }
      }
    } catch {
      // Notification not available
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    const query = supabase
      .from('restock_requests')
      .select(`*, users(id, name, role), locations(id, name), restock_request_items(*)`)
      .in('request_type', STAFF_TYPES)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query.in('status', ['mottagen', 'pa_vag', 'kan_ej_levereras']);
    }

    const { data } = await query as { data: RestockRequest[] | null };
    return sortStaffRequests(data || []);
  }, [filter]);

  const refreshRequests = useCallback(async () => {
    const data = await fetchRequests();
    if (initialLoadDoneRef.current) {
      data
        .filter(req => req.status === 'mottagen' && !prevIdsRef.current.has(req.id))
        .forEach(req => {
          playAlert(req.request_type);
          sendBrowserNotification(req);
        });
    }
    prevIdsRef.current = new Set(data.filter(req => req.status === 'mottagen').map(req => req.id));
    initialLoadDoneRef.current = true;
    setRequests(data);
    return data;
  }, [fetchRequests, playAlert, sendBrowserNotification]);

  useEffect(() => {
    setLoading(true);
    refreshRequests().then(() => {
      setLoading(false);
    });
  }, [refreshRequests]);

  useEffect(() => {
    const channel = supabase
      .channel('staff-calls-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restock_requests',
      }, () => {
        refreshRequests();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restock_requests',
      }, () => {
        refreshRequests();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restock_request_items',
      }, () => {
        refreshRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refreshRequests]);

  useEffect(() => {
    const refreshWhenActive = () => {
      refreshRequests();
    };

    const intervalId = window.setInterval(() => {
      refreshRequests();
    }, 3000);

    window.addEventListener('focus', refreshWhenActive);
    window.addEventListener('online', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenActive);
      window.removeEventListener('online', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
    };
  }, [refreshRequests]);

  async function updateStatus(id: string, status: RequestStatus) {
    setUpdatingId(id);
    await supabase.from('restock_requests').update({ status }).eq('id', id);
    await refreshRequests();
    setUpdatingId(null);
  }

  const activeCount = requests.filter(req => req.status === 'mottagen' || req.status === 'pa_vag' || req.status === 'kan_ej_levereras').length;
  const urgentCount = requests.filter(req => req.priority === 'akut' && (req.status === 'mottagen' || req.status === 'pa_vag')).length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10 safe-area-inset-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">Tillkalla personal</h1>
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
            <button
              onClick={logout}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-3">
          <div className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-center">
            <p className="text-amber-400 text-xl font-bold">{activeCount}</p>
            <p className="text-gray-400 text-xs">Aktiva</p>
          </div>
          <div className="flex-1 bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-2 text-center">
            <p className="text-red-400 text-xl font-bold">{urgentCount}</p>
            <p className="text-gray-400 text-xs">Akuta</p>
          </div>
        </div>

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

      <div className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Inga personalärenden</p>
          </div>
        ) : (
          requests.map(req => {
            const type = req.request_type ?? 'security_call';
            const Icon = iconFor(type);
            const isUrgent = req.priority === 'akut';
            const isCalled = req.status === 'pa_vag';
            const isRecalled = req.status === 'kan_ej_levereras';

            return (
              <div
                key={req.id}
                className={`rounded-xl border overflow-hidden ${
                  isCalled
                    ? 'border-green-500/70 bg-green-950/20'
                    : isRecalled
                      ? 'border-orange-500/70 bg-orange-950/20'
                    : isUrgent
                      ? 'border-red-500/60 bg-red-950/30'
                      : 'border-gray-800 bg-gray-900'
                }`}
              >
                <div className={`px-4 py-1.5 flex items-center gap-2 ${
                  isCalled ? 'bg-green-500' : isRecalled ? 'bg-orange-500' : isUrgent ? 'bg-red-500' : 'bg-gray-800'
                }`}>
                  {isUrgent || isRecalled ? <AlertTriangle className="w-4 h-4 text-white" /> : <Icon className="w-4 h-4 text-white" />}
                  <span className="text-white text-sm font-bold">
                    {isCalled ? 'TILLKALLAD' : isRecalled ? 'ÅTERKALLAD' : REQUEST_TYPE_LABELS[type].toUpperCase()}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-lg">{req.locations?.name || 'Okänd plats'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STAFF_STATUS_COLORS[req.status] ?? STATUS_COLORS[req.status]}`}>
                          {STAFF_STATUS_LABELS[req.status] ?? STATUS_LABELS[req.status]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          isUrgent
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                        }`}>
                          {PRIORITY_LABELS[req.priority] ?? PRIORITY_LABELS.inom_20}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(req.created_at)}
                        </span>
                        <span>{req.users?.name || '-'}</span>
                      </div>
                    </div>
                    <Icon className="w-6 h-6 text-gray-500 flex-shrink-0" />
                  </div>

                  <div className="space-y-1">
                    {req.restock_request_items?.map(item => (
                      <div key={item.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-gray-300">{item.product_name}</span>
                        <span className="text-orange-400 font-medium">{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>

                  {updatingId === req.id ? (
                    <div className="flex justify-center py-2">
                      <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {STAFF_STATUS_ACTIONS.map(({ status, label }) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(req.id, status)}
                          className={`h-10 rounded-lg text-xs font-semibold border transition-all ${
                            req.status === status
                              ? STAFF_STATUS_COLORS[status]
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
