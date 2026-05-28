import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, BellOff, Clock, AlertTriangle, Package, ChevronDown, History, Settings, LogOut, MessageSquare, RefreshCw, X } from 'lucide-react';
import { supabase, RestockRequest, RequestStatus, STATUS_LABELS, STATUS_COLORS, REQUEST_TYPE_LABELS, PRIORITY_LABELS, RequestType } from '../lib/supabase';
import { useApp } from '../lib/store';
import { enableLockedScreenPush } from '../lib/pushNotifications';
import { useUnreadChatCount } from '../lib/chatUnread';

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
  type: string;
  time: number;
}

function getRequestType(request: RestockRequest): RequestType {
  return request.request_type ?? 'restock';
}

function isServiceRequest(type: RequestType): boolean {
  return type === 'crate_pickup' || type === 'waste_pickup';
}

function isStaffCall(type: RequestType): boolean {
  return type === 'security_call' || type === 'it_support' || type === 'serving_manager';
}

function getItemsText(req: RestockRequest): string {
  return req.restock_request_items?.map(i => `${i.quantity}× ${i.product_name}`).join(', ') || '';
}

function getPriorityRank(request: RestockRequest): number {
  if (request.priority === 'akut') return 0;
  if (request.priority === 'inom_20' || request.priority === 'normal') return 1;
  return 2;
}

function sortRequests(requests: RestockRequest[]): RestockRequest[] {
  return [...requests].sort((a, b) => {
    const priorityDiff = getPriorityRank(a) - getPriorityRank(b);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function isNearDeadline(request: RestockRequest): boolean {
  if (request.priority !== 'inom_20' && request.priority !== 'normal') return false;
  if (request.status !== 'mottagen' && request.status !== 'pa_vag') return false;
  const minutesSinceCreated = (Date.now() - new Date(request.created_at).getTime()) / 60000;
  return minutesSinceCreated >= 15 && minutesSinceCreated < 20;
}

function isPastDeadline(request: RestockRequest): boolean {
  if (request.priority !== 'inom_20' && request.priority !== 'normal') return false;
  if (request.status !== 'mottagen' && request.status !== 'pa_vag') return false;
  const minutesSinceCreated = (Date.now() - new Date(request.created_at).getTime()) / 60000;
  return minutesSinceCreated >= 20;
}

interface DashboardProps {
  embedded?: boolean;
}

export default function Dashboard({ embedded = false }: DashboardProps) {
  const { currentUser, setView, logout } = useApp();
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [typeFilter, setTypeFilter] = useState<'all' | 'orders' | 'service' | 'staff'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [alert, setAlert] = useState<NewOrderAlert | null>(null);
  const unreadChatCount = useUnreadChatCount(currentUser);
  const audioRef = useRef<AudioContext | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
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
    if (!currentUser) return;
    const enabled = await enableLockedScreenPush(currentUser);
    setNotificationsEnabled(enabled);
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
        osc.type = 'square';
        osc.frequency.setValueAtTime(1850, ctx.currentTime);
        osc.frequency.setValueAtTime(2450, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(1850, ctx.currentTime + 0.16);
        osc.frequency.setValueAtTime(2450, ctx.currentTime + 0.24);
        osc.frequency.setValueAtTime(1850, ctx.currentTime + 0.32);
        osc.frequency.setValueAtTime(2450, ctx.currentTime + 0.4);
        osc.frequency.setValueAtTime(1850, ctx.currentTime + 0.48);
        osc.frequency.setValueAtTime(2450, ctx.currentTime + 0.56);
        gain.gain.setValueAtTime(0.65, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.65, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.02, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.65, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.02, ctx.currentTime + 0.23);
        gain.gain.setValueAtTime(0.65, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(0.02, ctx.currentTime + 0.31);
        gain.gain.setValueAtTime(0.65, ctx.currentTime + 0.32);
        gain.gain.setValueAtTime(0.02, ctx.currentTime + 0.39);
        gain.gain.setValueAtTime(0.65, ctx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.75);
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
        const items = getItemsText(req);
        const typeLabel = REQUEST_TYPE_LABELS[getRequestType(req)];
        const title = req.priority === 'akut' ? `AKUT! ${typeLabel} — ${location}` : `${typeLabel} — ${location}`;
        const options = {
          body: items,
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

  const showAlertPopup = useCallback((req: RestockRequest) => {
    const location = req.locations?.name || 'Okänd plats';
    const items = getItemsText(req);

    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert({
      id: req.id,
      location,
      items,
      priority: req.priority,
      type: REQUEST_TYPE_LABELS[getRequestType(req)],
      time: Date.now(),
    });

    // Auto-dismiss after 8 seconds for standard priority, 15 for urgent.
    const duration = req.priority === 'akut' ? 15000 : 8000;
    alertTimerRef.current = setTimeout(() => setAlert(null), duration);
  }, []);

  const fetchRequests = useCallback(async () => {
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

    const { data } = await query as { data: RestockRequest[] | null };
    return data || [];
  }, [filter]);

  const handleFreshData = useCallback((data: RestockRequest[], notify: boolean) => {
    if (notify && initialLoadDoneRef.current) {
      const newRequests = data.filter(req => {
        const type = getRequestType(req);
        return req.status === 'mottagen' && !isStaffCall(type) && !prevIdsRef.current.has(req.id);
      });

      newRequests.forEach(req => {
        playAlert(req.priority === 'akut');
        sendBrowserNotification(req);
        showAlertPopup(req);
      });
    }

    prevIdsRef.current = new Set(data.filter(r => r.status === 'mottagen').map(r => r.id));
    initialLoadDoneRef.current = true;
    setRequests(data);
  }, [playAlert, sendBrowserNotification, showAlertPopup]);

  const refreshRequests = useCallback(async (notify = true) => {
    const data = await fetchRequests();
    handleFreshData(data, notify);
    return data;
  }, [fetchRequests, handleFreshData]);

  useEffect(() => {
    setLoading(true);
    refreshRequests(false).then(() => {
      setLoading(false);
    });
  }, [refreshRequests]);

  useEffect(() => {
    const channel = supabase
      .channel('restock-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restock_requests',
      }, (payload: { new: RestockRequest }) => {
        // New request inserted — fetch full details with relations
        supabase
          .from('restock_requests')
          .select(`*, users(id, name, role), locations(id, name), restock_request_items(*)`)
          .eq('id', payload.new.id)
          .maybeSingle()
          .then(({ data: newReq }: { data: RestockRequest | null }) => {
            if (!newReq) return;
            const isNew = !prevIdsRef.current.has(newReq.id) && !isStaffCall(getRequestType(newReq));
            if (isNew) {
              prevIdsRef.current.add(newReq.id);
              playAlert(newReq.priority === 'akut');
              sendBrowserNotification(newReq);
              showAlertPopup(newReq);
            }
            // Refresh full list
            refreshRequests(false);
          });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restock_requests',
      }, () => {
        refreshRequests(false);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restock_request_items',
      }, () => {
        refreshRequests(false);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playAlert, refreshRequests, sendBrowserNotification, showAlertPopup]);

  useEffect(() => {
    const refreshWhenActive = () => {
      refreshRequests(true);
    };

    const intervalId = window.setInterval(() => {
      refreshRequests(true);
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

  async function updateStatus(requestId: string, status: RequestStatus) {
    setUpdatingId(requestId);
    await supabase
      .from('restock_requests')
      .update({ status })
      .eq('id', requestId);
    setUpdatingId(null);
    await refreshRequests(false);
  }

  const activeCount = requests.filter(r => r.status === 'mottagen' || r.status === 'pa_vag').length;
  const akutCount = requests.filter(r => r.priority === 'akut' && (r.status === 'mottagen' || r.status === 'pa_vag')).length;
  const displayedRequests = sortRequests(
    requests.filter(req => {
      const type = getRequestType(req);
      if (typeFilter === 'orders') return type === 'restock';
      if (typeFilter === 'service') return isServiceRequest(type);
      if (typeFilter === 'staff') return false;
      return !isStaffCall(type);
    })
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      {!embedded && <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10 safe-area-inset-top">
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
              onClick={() => setView('chat')}
              className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Chatt"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadChatCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center font-bold">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
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

        {/* Type filter */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {([
            { id: 'all', label: 'Alla' },
            { id: 'orders', label: 'Ordrar' },
            { id: 'service', label: 'Service' },
          ] as { id: typeof typeFilter; label: string }[]).map(option => (
            <button
              key={option.id}
              onClick={() => {
                setTypeFilter(option.id);
                setExpandedId(null);
              }}
              className={`h-9 rounded-lg text-sm font-medium border transition-all ${
                typeFilter === option.id
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
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
      </div>}

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
        ) : displayedRequests.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">
              {filter === 'active' ? 'Inga aktiva ärenden' : 'Inga ärenden'}
            </p>
          </div>
        ) : (
          displayedRequests.map(req => (
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
        <div className="fixed inset-x-0 top-safe-toast z-50 px-4 animate-slide-down">
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
                  {alert.priority === 'akut' ? `AKUT ${alert.type.toUpperCase()}!` : `Ny ${alert.type.toLowerCase()}!`}
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
  const nearDeadline = isNearDeadline(request);
  const pastDeadline = isPastDeadline(request);
  const isActive = request.status === 'mottagen' || request.status === 'pa_vag';
  const isPicking = request.status === 'pa_vag';
  const typeLabel = REQUEST_TYPE_LABELS[getRequestType(request)];
  const priorityLabel = pastDeadline
    ? 'Passerat deadline'
    : nearDeadline
      ? 'Nära deadline'
      : PRIORITY_LABELS[request.priority] ?? PRIORITY_LABELS.inom_20;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isPicking
        ? 'border-green-500/70 bg-green-950/20 shadow-green-900/20 shadow-lg'
        : isAkut && isActive
        ? 'border-red-500/60 bg-red-950/30 shadow-red-900/20 shadow-lg'
        : nearDeadline || pastDeadline
          ? 'border-orange-500/70 bg-orange-950/20 shadow-orange-900/20 shadow-lg'
        : 'border-gray-800 bg-gray-900'
    }`}>
      {isPicking && (
        <div className="bg-green-500 px-4 py-1.5 flex items-center gap-2">
          <Package className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-bold">PLOCKAS</span>
        </div>
      )}
      {!isPicking && isAkut && isActive && (
        <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-bold">AKUT {typeLabel.toUpperCase()}</span>
        </div>
      )}
      {!isPicking && !isAkut && (nearDeadline || pastDeadline) && (
        <div className="bg-orange-500 px-4 py-1.5 flex items-center gap-2">
          {pastDeadline
            ? <AlertTriangle className="w-4 h-4 text-white" />
            : <Clock className="w-4 h-4 text-white" />
          }
          <span className="text-white text-sm font-bold">
            {pastDeadline ? 'PASSERAT DEADLINE' : 'NÄRA DEADLINE'}
          </span>
        </div>
      )}

      <button onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-base">
                {request.locations?.name || '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-800 text-gray-300 border-gray-700">
                {typeLabel}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[request.status]}`}>
                {STATUS_LABELS[request.status]}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                isAkut
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : nearDeadline || pastDeadline
                    ? 'bg-orange-500/25 text-orange-200 border-orange-500/50'
                  : request.priority === 'inom_20' || request.priority === 'normal'
                    ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}>
                {priorityLabel}
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
