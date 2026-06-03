import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, LogOut, Package, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import {
  PRIORITY_LABELS,
  REQUEST_TYPE_LABELS,
  RequestType,
  RestockRequest,
  ScheduleEntry,
  STATUS_LABELS,
  supabase,
} from '../lib/supabase';
import { useApp } from '../lib/store';
import RoleMenuButton from './RoleMenuButton';

const PICK_TYPES: RequestType[] = ['restock', 'crate_pickup', 'waste_pickup'];
const STAFF_TYPES: RequestType[] = ['security_call', 'it_support', 'serving_manager'];

function formatClock() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  return `${Math.floor(diff / 3600)} h`;
}

function requestItems(request: RestockRequest) {
  return request.restock_request_items?.map(item => `${item.quantity} ${item.unit} ${item.product_name}`).join(', ') || request.note || '';
}

function priorityRank(request: RestockRequest) {
  if (request.priority === 'akut') return 0;
  if (request.priority === 'inom_20' || request.priority === 'normal') return 1;
  return 2;
}

function sortRequests(requests: RestockRequest[]) {
  return [...requests].sort((a, b) => {
    const priorityDiff = priorityRank(a) - priorityRank(b);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function deadlineLabel(request: RestockRequest) {
  if (request.priority !== 'inom_20' && request.priority !== 'normal') {
    return PRIORITY_LABELS[request.priority];
  }

  const minutes = (Date.now() - new Date(request.created_at).getTime()) / 60000;
  if (minutes >= 20) return 'Passerat deadline';
  if (minutes >= 15) return 'Nära deadline';
  return 'Inom 20 min';
}

function requestAccent(request: RestockRequest) {
  if (request.status === 'pa_vag') return 'border-green-500/60 bg-green-500/10';
  if (request.priority === 'akut') return 'border-red-500/70 bg-red-500/15';
  if (request.priority === 'inom_20' || request.priority === 'normal') return 'border-orange-500/60 bg-orange-500/12';
  return 'border-gray-700 bg-gray-900';
}

function staffStatusLabel(request: RestockRequest) {
  if (request.status === 'pa_vag') return 'Tillkallad';
  if (request.status === 'kan_ej_levereras') return 'Återkallad';
  if (request.status === 'levererad') return 'Avslutad';
  return 'Väntar';
}

function scheduleTime(entry: ScheduleEntry) {
  return `${entry.start_time.slice(0, 5)}-${entry.end_time.slice(0, 5)}`;
}

function scheduleStatus(entry: ScheduleEntry) {
  const diff = entry.assigned_names.length - entry.required_count;
  if (diff < 0) return { label: `Saknas ${Math.abs(diff)}`, className: 'text-red-200 bg-red-500/20 border-red-500/40' };
  if (diff > 0) return { label: `+${diff}`, className: 'text-amber-200 bg-amber-500/20 border-amber-500/40' };
  return { label: 'OK', className: 'text-green-200 bg-green-500/20 border-green-500/40' };
}

export default function ExhibitionDisplay() {
  const { currentUser, logout } = useApp();
  const [pickRequests, setPickRequests] = useState<RestockRequest[]>([]);
  const [staffRequests, setStaffRequests] = useState<RestockRequest[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [clock, setClock] = useState(formatClock());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pickResult, staffResult, scheduleResult] = await Promise.all([
      supabase
        .from('restock_requests')
        .select('*, users(id, name, role), locations(id, name), restock_request_items(*)')
        .in('request_type', PICK_TYPES)
        .in('status', ['mottagen', 'pa_vag'])
        .order('created_at', { ascending: true }),
      supabase
        .from('restock_requests')
        .select('*, users(id, name, role), locations(id, name), restock_request_items(*)')
        .in('request_type', STAFF_TYPES)
        .in('status', ['mottagen', 'pa_vag', 'kan_ej_levereras'])
        .order('created_at', { ascending: true }),
      supabase
        .from('schedule_entries')
        .select('*')
        .eq('active', true)
        .order('day')
        .order('sort_order'),
    ]);

    setPickRequests(sortRequests((pickResult.data || []) as RestockRequest[]));
    setStaffRequests(sortRequests((staffResult.data || []) as RestockRequest[]));
    setScheduleEntries((scheduleResult.data || []) as ScheduleEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const requestChannel = supabase
      .channel('exhibition-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'restock_requests' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restock_requests' }, load)
      .subscribe();

    const scheduleChannel = supabase
      .channel('exhibition-schedule')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_entries' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedule_entries' }, load)
      .subscribe();

    const refreshId = window.setInterval(load, 5000);
    const clockId = window.setInterval(() => setClock(formatClock()), 1000);

    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(clockId);
      supabase.removeChannel(requestChannel);
      supabase.removeChannel(scheduleChannel);
    };
  }, [load]);

  const groupedSchedule = useMemo(() => {
    return scheduleEntries.reduce<Record<string, ScheduleEntry[]>>((groups, entry) => {
      groups[entry.day] = [...(groups[entry.day] || []), entry];
      return groups;
    }, {});
  }, [scheduleEntries]);

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 px-safe-screen pt-safe-header pb-4 flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-orange-300 text-sm uppercase font-black tracking-widest">Utställningsservice</p>
          <h1 className="text-3xl xl:text-5xl font-black leading-tight tracking-normal">Översikt</h1>
          <p className="text-gray-400 text-lg">{currentUser?.name || 'TV-skärm'}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden lg:flex items-center gap-2 rounded-xl bg-gray-950 border border-gray-800 px-4 h-12 text-2xl font-black tabular-nums">
            <Clock className="w-6 h-6 text-gray-500" />
            {clock}
          </div>
          <button
            onClick={load}
            className="h-12 w-12 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-center"
            aria-label="Uppdatera"
            title="Uppdatera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <RoleMenuButton />
          <button
            onClick={logout}
            className="h-12 w-12 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-center"
            aria-label="Logga ut"
            title="Logga ut"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-3 gap-4 p-4 pb-safe-screen">
        <section className="min-h-0 rounded-xl border border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          <ColumnHeader icon={<Package className="w-7 h-7 text-orange-300" />} title="Plockordrar" count={pickRequests.length} />
          <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-3">
            {loading ? <LoadingRows /> : pickRequests.length === 0 ? <EmptyState text="Inga aktiva plockordrar" /> : pickRequests.slice(0, 8).map(request => (
              <article key={request.id} className={`rounded-lg border p-3 ${requestAccent(request)}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xl font-black truncate">{request.locations?.name || 'Okänd plats'}</p>
                    <p className="text-sm text-gray-400 truncate">{REQUEST_TYPE_LABELS[request.request_type ?? 'restock']}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-gray-950/70 px-2 py-1 text-xs font-black uppercase whitespace-nowrap">
                    {deadlineLabel(request)}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-white line-clamp-2">{requestItems(request)}</p>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                  <span>{STATUS_LABELS[request.status]}</span>
                  <span>{timeAgo(request.created_at)} sedan</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="min-h-0 rounded-xl border border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          <ColumnHeader icon={<ShieldAlert className="w-7 h-7 text-red-300" />} title="Tillkalla personal" count={staffRequests.length} />
          <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-3">
            {loading ? <LoadingRows /> : staffRequests.length === 0 ? <EmptyState text="Inga aktiva personalärenden" /> : staffRequests.slice(0, 8).map(request => (
              <article
                key={request.id}
                className={`rounded-lg border p-3 ${
                  request.status === 'kan_ej_levereras'
                    ? 'border-orange-500/60 bg-orange-500/15'
                    : request.priority === 'akut'
                      ? 'border-red-500/70 bg-red-500/15'
                      : 'border-gray-700 bg-gray-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xl font-black truncate">{request.locations?.name || 'Okänd plats'}</p>
                    <p className="text-base text-gray-300 truncate">{REQUEST_TYPE_LABELS[request.request_type ?? 'security_call']}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-gray-950/70 px-2 py-1 text-xs font-black uppercase whitespace-nowrap">
                    {staffStatusLabel(request)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-400 line-clamp-2">{request.note || requestItems(request) || 'Inget meddelande'}</p>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                  <span>{PRIORITY_LABELS[request.priority]}</span>
                  <span>{timeAgo(request.created_at)} sedan</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="min-h-0 rounded-xl border border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          <ColumnHeader icon={<Users className="w-7 h-7 text-green-300" />} title="Schema" count={scheduleEntries.length} />
          <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-3">
            {loading ? <LoadingRows /> : scheduleEntries.length === 0 ? <EmptyState text="Inget schema upplagt" /> : Object.entries(groupedSchedule).slice(0, 2).map(([day, entries]) => (
              <div key={day} className="space-y-2">
                <h2 className="text-orange-300 text-lg font-black uppercase tracking-wide">{day}</h2>
                {entries.slice(0, 6).map(entry => {
                  const status = scheduleStatus(entry);
                  return (
                    <article key={entry.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-lg font-black truncate">{entry.position}</p>
                          <p className="text-gray-400 text-sm">{scheduleTime(entry)} · {entry.assigned_names.length}/{entry.required_count}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-black whitespace-nowrap ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-300 line-clamp-2">
                        {entry.assigned_names.length > 0 ? entry.assigned_names.join(', ') : 'Ingen bokad'}
                      </p>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ColumnHeader({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return (
    <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-2xl font-black truncate">{title}</h2>
      </div>
      <span className="h-10 min-w-10 rounded-full bg-gray-950 border border-gray-800 flex items-center justify-center px-3 text-xl font-black">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <p className="text-2xl font-black text-gray-700">{text}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map(row => (
        <div key={row} className="h-28 rounded-lg bg-gray-950 border border-gray-800 animate-pulse" />
      ))}
    </>
  );
}
