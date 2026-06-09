import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, LogOut, Plus, RefreshCw, Shield, UserCheck, UserX } from 'lucide-react';
import { ScheduleEntry, SchedulePerson, StaffLedgerEntry, StaffLedgerRole, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import RoleMenuButton from './RoleMenuButton';

const ROLE_LABELS: Record<StaffLedgerRole, string> = {
  scheduled: 'Schemalagd',
  security: 'Ordningsvakt',
  extra: 'Extra personal',
};

function daySortValue(day: string) {
  const normalized = day.trim().toLowerCase();
  if (normalized === 'fredag') return 1;
  if (normalized === 'lördag' || normalized === 'lordag') return 2;
  return 10;
}

function formatTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function activeForShift(entries: StaffLedgerEntry[], schedulePersonId: string, scheduleEntryId: string) {
  return entries.find(entry => (
    entry.schedule_person_id === schedulePersonId &&
    entry.schedule_entry_id === scheduleEntryId &&
    !entry.check_out_at
  ));
}

function activeManual(entries: StaffLedgerEntry[], name: string, role: StaffLedgerRole, day: string) {
  return entries.find(entry => (
    !entry.schedule_person_id &&
    entry.name.trim().toLowerCase() === name.trim().toLowerCase() &&
    entry.role === role &&
    entry.day === day &&
    !entry.check_out_at
  ));
}

interface StaffLedgerPanelProps {
  embedded?: boolean;
}

export function StaffLedgerPanel({ embedded = false }: StaffLedgerPanelProps) {
  const { currentUser, logout } = useApp();
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [people, setPeople] = useState<SchedulePerson[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StaffLedgerEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState<StaffLedgerRole>('security');
  const [manualNote, setManualNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function formatSupabaseError(errorValue: unknown) {
    if (!errorValue || typeof errorValue !== 'object') return 'Något gick fel. Försök igen.';
    const maybeError = errorValue as { message?: string; details?: string; code?: string };
    if (maybeError.message?.includes('staff_ledger_entries')) {
      return 'Personalliggaren saknar databastabellen. Kör senaste Supabase-migrationen och försök igen.';
    }
    return maybeError.message || maybeError.details || maybeError.code || 'Något gick fel. Försök igen.';
  }

  const load = useCallback(async () => {
    const [scheduleResult, peopleResult, ledgerResult] = await Promise.all([
      supabase.from('schedule_entries').select('*').eq('active', true).order('day').order('sort_order'),
      supabase.from('schedule_people').select('*').eq('active', true).order('sort_order'),
      supabase.from('staff_ledger_entries').select('*').order('check_in_at', { ascending: false }),
    ]);
    if (scheduleResult.error || peopleResult.error || ledgerResult.error) {
      setError(formatSupabaseError(scheduleResult.error || peopleResult.error || ledgerResult.error));
      setLedgerEntries([]);
    } else {
      setError('');
      setLedgerEntries((ledgerResult.data || []) as StaffLedgerEntry[]);
    }
    const schedules = (scheduleResult.data || []) as ScheduleEntry[];
    setScheduleEntries(schedules);
    setPeople((peopleResult.data || []) as SchedulePerson[]);
    setSelectedDay(current => current || schedules[0]?.day || 'Fredag');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('staff-ledger')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_ledger_entries' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff_ledger_entries' }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [load]);

  const days = useMemo(() => (
    Array.from(new Set([
      ...scheduleEntries.map(entry => entry.day),
      ...ledgerEntries.map(entry => entry.day),
    ])).sort((a, b) => daySortValue(a) - daySortValue(b) || a.localeCompare(b, 'sv'))
  ), [scheduleEntries, ledgerEntries]);

  const visibleSchedules = useMemo(() => (
    scheduleEntries
      .filter(entry => entry.day === selectedDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.position.localeCompare(b.position, 'sv'))
  ), [scheduleEntries, selectedDay]);

  const visibleLedger = ledgerEntries
    .filter(entry => entry.day === selectedDay)
    .sort((a, b) => {
      const activeSort = Number(Boolean(a.check_out_at)) - Number(Boolean(b.check_out_at));
      if (activeSort !== 0) return activeSort;
      const manualSort = Number(Boolean(a.schedule_person_id)) - Number(Boolean(b.schedule_person_id));
      if (manualSort !== 0) return manualSort;
      return new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime();
    });
  const activeLedger = visibleLedger.filter(entry => !entry.check_out_at);
  const manualActive = activeLedger.filter(entry => !entry.schedule_person_id);

  const scheduledStaffIds = new Set(visibleSchedules.flatMap(entry => entry.assigned_staff_ids || []));
  const checkedScheduledIds = new Set(activeLedger.filter(entry => entry.schedule_person_id).map(entry => entry.schedule_person_id));
  const missingPeople = people.filter(person => scheduledStaffIds.has(person.id) && !checkedScheduledIds.has(person.id));

  async function checkInScheduled(person: SchedulePerson, entry: ScheduleEntry) {
    setSavingId(`${entry.id}-${person.id}`);
    setError('');
    setNotice('');
    const { error: insertError } = await supabase.from('staff_ledger_entries').insert({
      schedule_person_id: person.id,
      schedule_entry_id: entry.id,
      name: person.name,
      role: 'scheduled',
      day: entry.day,
      position: entry.position,
      check_in_at: new Date().toISOString(),
      check_out_at: null,
      note: null,
      created_by: currentUser?.id || null,
    });
    if (insertError) {
      setError(formatSupabaseError(insertError));
      setSavingId(null);
      return;
    }
    setNotice(`${person.name} är incheckad.`);
    await load();
    setSavingId(null);
  }

  async function checkOut(entry: StaffLedgerEntry) {
    setSavingId(entry.id);
    setError('');
    setNotice('');
    const { error: updateError } = await supabase
      .from('staff_ledger_entries')
      .update({ check_out_at: new Date().toISOString() })
      .eq('id', entry.id);
    if (updateError) {
      setError(formatSupabaseError(updateError));
      setSavingId(null);
      return;
    }
    setNotice(`${entry.name} är utstämplad.`);
    await load();
    setSavingId(null);
  }

  async function addManual() {
    const name = manualName.trim();
    if (!name) return;
    const existing = activeManual(ledgerEntries, name, manualRole, selectedDay);
    if (existing) {
      await checkOut(existing);
      return;
    }
    setSavingId('manual');
    setError('');
    setNotice('');
    const { error: insertError } = await supabase.from('staff_ledger_entries').insert({
      schedule_person_id: null,
      schedule_entry_id: null,
      name,
      role: manualRole,
      day: selectedDay,
      position: manualRole === 'security' ? 'Ordningsvakt' : 'Extra personal',
      check_in_at: new Date().toISOString(),
      check_out_at: null,
      note: manualNote.trim() || null,
      created_by: currentUser?.id || null,
    });
    if (insertError) {
      setError(formatSupabaseError(insertError));
      setSavingId(null);
      return;
    }
    setNotice(`${name} är incheckad som ${ROLE_LABELS[manualRole].toLowerCase()}.`);
    setManualName('');
    setManualNote('');
    await load();
    setSavingId(null);
  }

  return (
    <div className={embedded ? 'space-y-4' : 'min-h-screen bg-gray-950 text-white safe-area-inset-top'}>
      {!embedded && (
        <header className="sticky top-0 z-20 bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl border border-orange-500/40 bg-orange-500/15 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-orange-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">Personalliggare</h1>
              <p className="text-sm text-gray-400">Stämpla in och ut personal</p>
            </div>
            <button onClick={load} className="h-11 w-11 rounded-xl bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center" aria-label="Uppdatera">
              <RefreshCw className="w-5 h-5" />
            </button>
            <RoleMenuButton />
            <button onClick={logout} className="h-11 w-11 rounded-xl bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center" aria-label="Logga ut">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      <main className={embedded ? 'space-y-4' : 'p-4 space-y-4'}>
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white">Närvaro {selectedDay}</h2>
              <p className="text-sm text-gray-400">
                {checkedScheduledIds.size}/{scheduledStaffIds.size} schemalagda incheckade · {activeLedger.length} inne totalt
              </p>
            </div>
            <select
              value={selectedDay}
              onChange={event => setSelectedDay(event.target.value)}
              className="h-11 rounded-xl border border-gray-700 bg-gray-800 px-3 text-white focus:outline-none focus:border-orange-500"
            >
              {(days.length ? days : ['Fredag', 'Lördag']).map(day => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>

          {missingPeople.length > 0 && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-sm font-bold text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Saknas från schemat
              </p>
              <p className="mt-1 text-sm text-red-200">{missingPeople.map(person => person.name).join(', ')}</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-sm font-bold text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Personalliggaren kunde inte sparas/läsas
              </p>
              <p className="mt-1 text-sm text-red-200">{error}</p>
            </div>
          )}

          {notice && !error && (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3">
              <p className="text-sm font-bold text-green-200">{notice}</p>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {loading ? (
            <div className="xl:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-8 flex justify-center">
              <LoaderIcon />
            </div>
          ) : visibleSchedules.length === 0 ? (
            <div className="xl:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-500">
              Inga schemalagda pass för vald dag.
            </div>
          ) : visibleSchedules.map(entry => {
            const assignedPeople = (entry.assigned_staff_ids || [])
              .map(id => people.find(person => person.id === id))
              .filter((person): person is SchedulePerson => Boolean(person));
            const checkedCount = assignedPeople.filter(person => activeForShift(ledgerEntries, person.id, entry.id)).length;
            const expectedCount = assignedPeople.length || entry.required_count;
            const missingForShift = assignedPeople.filter(person => !activeForShift(ledgerEntries, person.id, entry.id));

            return (
              <div key={entry.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-white font-black">{entry.position}</h3>
                    <p className="text-sm text-gray-400">{entry.day} {entry.start_time}-{entry.end_time}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-sm font-black ${
                    checkedCount >= expectedCount ? 'border-green-500/40 bg-green-500/15 text-green-300' : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  }`}>
                    {checkedCount}/{expectedCount}
                  </span>
                </div>

                {missingForShift.length > 0 && (
                  <p className="text-xs text-red-300 flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" />
                    Saknas: {missingForShift.map(person => person.name).join(', ')}
                  </p>
                )}

                <div className="space-y-2">
                  {assignedPeople.map(person => {
                    const open = activeForShift(ledgerEntries, person.id, entry.id);
                    const isSaving = savingId === `${entry.id}-${person.id}` || savingId === open?.id;
                    return (
                      <div key={person.id} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white">{person.name}</p>
                          <p className="text-xs text-gray-500">{open ? `In ${formatTime(open.check_in_at)}` : 'Ej incheckad'}</p>
                        </div>
                        <button
                          onClick={() => open ? checkOut(open) : checkInScheduled(person, entry)}
                          disabled={isSaving}
                          className={`h-10 px-3 rounded-lg text-sm font-bold flex items-center gap-1.5 ${
                            open ? 'bg-red-500/15 text-red-300 border border-red-500/40' : 'bg-green-600 text-white'
                          }`}
                        >
                          {open ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          {open ? 'Stämpla ut' : 'Stämpla in'}
                        </button>
                      </div>
                    );
                  })}
                  {assignedPeople.length === 0 && <p className="text-sm text-gray-500">Inga namngivna personer på passet.</p>}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-300" />
            <h2 className="text-lg font-black text-white">Ej schemalagd personal</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_12rem_1fr_auto] gap-2">
            <input
              value={manualName}
              onChange={event => setManualName(event.target.value)}
              placeholder="Namn"
              className="h-11 rounded-xl border border-gray-700 bg-gray-800 px-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <select
              value={manualRole}
              onChange={event => setManualRole(event.target.value as StaffLedgerRole)}
              className="h-11 rounded-xl border border-gray-700 bg-gray-800 px-3 text-white focus:outline-none focus:border-orange-500"
            >
              <option value="security">Ordningsvakt</option>
              <option value="extra">Extra personal</option>
            </select>
            <input
              value={manualNote}
              onChange={event => setManualNote(event.target.value)}
              placeholder="Anteckning, t.ex. bolag"
              className="h-11 rounded-xl border border-gray-700 bg-gray-800 px-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={addManual}
              disabled={!manualName.trim() || savingId === 'manual'}
              className="h-11 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Stämpla
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {manualActive.map(entry => (
              <div key={entry.id} className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{entry.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_LABELS[entry.role]} · In {formatTime(entry.check_in_at)}{entry.note ? ` · ${entry.note}` : ''}</p>
                </div>
                <button onClick={() => checkOut(entry)} className="h-9 px-3 rounded-lg border border-red-500/40 bg-red-500/15 text-sm font-bold text-red-300">
                  Stämpla ut
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <h2 className="text-lg font-black text-white">Kontrollvy personalliggare</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-gray-500">
                <tr className="border-b border-gray-800">
                  <th className="py-2 pr-3">Namn</th>
                  <th className="py-2 pr-3">Typ</th>
                  <th className="py-2 pr-3">Dag/pass</th>
                  <th className="py-2 pr-3">In</th>
                  <th className="py-2 pr-3">Ut</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {visibleLedger.map(entry => (
                  <tr key={entry.id} className="text-gray-300">
                    <td className="py-2 pr-3 font-semibold text-white">{entry.name}</td>
                    <td className="py-2 pr-3">{ROLE_LABELS[entry.role]}</td>
                    <td className="py-2 pr-3">{entry.day}{entry.position ? ` · ${entry.position}` : ''}</td>
                    <td className="py-2 pr-3">{formatTime(entry.check_in_at)}</td>
                    <td className="py-2 pr-3">{formatTime(entry.check_out_at)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                        entry.check_out_at ? 'border-gray-700 text-gray-400' : 'border-green-500/40 bg-green-500/15 text-green-300'
                      }`}>
                        {entry.check_out_at ? 'Utstämplad' : 'Inne'}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleLedger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">Inga registreringar för vald dag.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function LoaderIcon() {
  return <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />;
}

export default function StaffLedgerDashboard() {
  return <StaffLedgerPanel />;
}
