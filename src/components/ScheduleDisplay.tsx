import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, LogOut, RefreshCw } from 'lucide-react';
import { ScheduleEntry, SchedulePerson, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import RoleMenuButton from './RoleMenuButton';

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function entryRange(entry: ScheduleEntry) {
  const start = timeToMinutes(entry.start_time);
  let end = timeToMinutes(entry.end_time);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function availabilityForDay(person: SchedulePerson, day: string) {
  if (day === 'Fredag') return { start: person.friday_start || null, end: person.friday_end || null };
  if (day === 'Lördag') return { start: person.saturday_start || null, end: person.saturday_end || null };
  if (person.preferred_day === day) return { start: person.available_start || null, end: person.available_end || null };
  return { start: null, end: null };
}

function isWithinAvailability(entry: ScheduleEntry, person: SchedulePerson) {
  const availability = availabilityForDay(person, entry.day);
  if (!availability.start || !availability.end) return false;
  const shift = entryRange(entry);
  const available = scheduleRange(availability.start, availability.end);
  return shift.start >= available.start && shift.end <= available.end;
}

function scheduleRange(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function hourLabel(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return String(Math.floor(normalized / 60)).padStart(2, '0');
}

function statusFor(entry: ScheduleEntry) {
  const booked = entry.assigned_names.length;
  const balance = booked - entry.required_count;
  if (balance < 0) return { label: `Saknas ${Math.abs(balance)}`, className: 'bg-red-500/20 text-red-200 border-red-500/40' };
  if (balance > 0) return { label: `Överbemannad ${balance}`, className: 'bg-amber-500/20 text-amber-200 border-amber-500/40' };
  return { label: 'OK', className: 'bg-green-500/20 text-green-200 border-green-500/40' };
}

export default function ScheduleDisplay() {
  const { logout } = useApp();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [people, setPeople] = useState<SchedulePerson[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [entriesResult, peopleResult] = await Promise.all([
      supabase
        .from('schedule_entries')
        .select('*')
        .eq('active', true)
        .order('day')
        .order('sort_order'),
      supabase.from('schedule_people').select('*').eq('active', true).order('sort_order'),
    ]);
    const rows = entriesResult.data || [];
    setEntries(rows);
    setPeople(peopleResult.data || []);
    setSelectedDay(current => current || rows[0]?.day || '');
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('schedule-display')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_entries' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedule_entries' }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const days = useMemo(() => Array.from(new Set(entries.map(entry => entry.day))), [entries]);
  const visibleEntries = entries.filter(entry => entry.day === selectedDay);
  const grouped = useMemo(() => {
    const groups = new Map<string, ScheduleEntry[]>();
    visibleEntries.forEach(entry => {
      const group = groups.get(entry.position) || [];
      group.push(entry);
      groups.set(entry.position, group);
    });
    return Array.from(groups.entries()).map(([position, rows]) => ({
      position,
      rows: rows.sort((a, b) => entryRange(a).start - entryRange(b).start),
    }));
  }, [visibleEntries]);

  const ranges = visibleEntries.map(entryRange);
  const minStart = ranges.length ? Math.floor(Math.min(...ranges.map(range => range.start)) / 60) * 60 : 10 * 60;
  const maxEnd = ranges.length ? Math.ceil(Math.max(...ranges.map(range => range.end)) / 60) * 60 : 26 * 60;
  const totalMinutes = Math.max(maxEnd - minStart, 60);
  const hours = Array.from({ length: Math.floor(totalMinutes / 60) + 1 }, (_, index) => minStart + index * 60);

  return (
    <div className="min-h-screen bg-gray-950 text-white safe-area-inset-top">
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/40 bg-orange-500/15">
            <CalendarDays className="h-6 w-6 text-orange-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">Personalschema</h1>
            <p className="text-sm text-gray-400">Tidslinje per position</p>
          </div>
          <button
            onClick={load}
            className="h-11 w-11 rounded-xl bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white flex items-center justify-center"
            aria-label="Uppdatera schema"
            title="Uppdatera"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <RoleMenuButton />
          <button
            onClick={logout}
            className="h-11 w-11 rounded-xl bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white flex items-center justify-center"
            aria-label="Logga ut"
            title="Logga ut"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {days.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`h-10 flex-shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors ${
                selectedDay === day ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-lg font-semibold">Inget schema inlagt</p>
            <p className="mt-1 text-sm text-gray-400">Skapa schemarader i adminläget.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="min-w-[920px]">
              <div className="ml-44 grid border-b border-gray-800 pb-2" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
                {hours.map(hour => (
                  <div key={hour} className="text-xs font-semibold text-gray-500">
                    {hourLabel(hour)}
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-3">
                {grouped.map(group => (
                  <div key={group.position} className="grid grid-cols-[11rem_1fr] items-stretch gap-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
                      <p className="text-lg font-bold leading-tight">{group.position}</p>
                      <p className="mt-1 text-xs text-gray-500">{group.rows.length} pass</p>
                    </div>

                    <div className="relative min-h-24 rounded-xl border border-gray-800 bg-gray-900/70 p-3">
                      <div
                        className="absolute inset-x-3 top-0 bottom-0 grid pointer-events-none"
                        style={{ gridTemplateColumns: `repeat(${hours.length - 1}, minmax(0, 1fr))` }}
                      >
                        {hours.slice(0, -1).map(hour => (
                          <div key={hour} className="border-l border-gray-800/70 first:border-l-0" />
                        ))}
                      </div>

                      <div className="relative space-y-2">
                        {group.rows.map(entry => {
                          const range = entryRange(entry);
                          const left = ((range.start - minStart) / totalMinutes) * 100;
                          const width = ((range.end - range.start) / totalMinutes) * 100;
                          const status = statusFor(entry);
                          const outsideNames = (entry.assigned_staff_ids || [])
                            .map(id => people.find(person => person.id === id))
                            .filter((person): person is SchedulePerson => Boolean(person))
                            .filter(person => !isWithinAvailability(entry, person))
                            .map(person => person.name);
                          return (
                            <div
                              key={entry.id}
                              className="relative min-h-16 overflow-hidden rounded-xl border border-orange-500/30 bg-orange-500/20 px-3 py-2 shadow-lg shadow-black/10"
                              style={{ marginLeft: `${left}%`, width: `${Math.max(width, 8)}%` }}
                            >
                              <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                                <span className="min-w-0 max-w-full break-words text-sm font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-base">
                                  {entry.start_time}-{entry.end_time}
                                </span>
                                <span className={`max-w-full rounded-full border px-2 py-0.5 text-[11px] font-bold leading-tight ${status.className}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="mt-1 min-w-0 break-words text-xs leading-tight text-orange-100 [overflow-wrap:anywhere]">
                                Behov {entry.required_count} · Bokade {entry.assigned_names.length}
                              </p>
                              <p className="mt-1 min-w-0 break-words text-sm font-medium leading-tight text-white/90 line-clamp-2 [overflow-wrap:anywhere]">
                                {entry.assigned_names.length ? entry.assigned_names.join(', ') : 'Inga bokade'}
                              </p>
                              {outsideNames.length > 0 && (
                                <p className="mt-1 flex min-w-0 items-start gap-1 text-xs font-semibold leading-tight text-amber-200">
                                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">Utanför tid: {outsideNames.join(', ')}</span>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
