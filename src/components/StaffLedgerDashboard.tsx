import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Download, Loader2, LogOut, Plus, RefreshCw, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { ScheduleEntry, SchedulePerson, StaffLedgerEntry, StaffLedgerRole, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import { passwordMatches } from '../lib/auth';
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

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('sv-SE');
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return `${formatDate(value)} ${formatTime(value)}`;
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(csvValue).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function activeForPerson(entries: StaffLedgerEntry[], schedulePersonId: string, day: string) {
  return entries.find(entry => (
    entry.schedule_person_id === schedulePersonId &&
    entry.day === day &&
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearingLedger, setClearingLedger] = useState(false);

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
  const activeScheduledCount = new Set(activeLedger.filter(entry => entry.schedule_person_id).map(entry => entry.schedule_person_id)).size;
  const activeTotalCount = activeScheduledCount + manualActive.length;

  const scheduledStaffIds = new Set(visibleSchedules.flatMap(entry => entry.assigned_staff_ids || []));
  const checkedScheduledIds = new Set(activeLedger.filter(entry => entry.schedule_person_id).map(entry => entry.schedule_person_id));
  const missingPeople = people.filter(person => scheduledStaffIds.has(person.id) && !checkedScheduledIds.has(person.id));
  const scheduledPeople = people
    .filter(person => scheduledStaffIds.has(person.id))
    .map(person => ({
      person,
      shifts: visibleSchedules.filter(entry => (entry.assigned_staff_ids || []).includes(person.id)),
      open: activeForPerson(ledgerEntries, person.id, selectedDay),
    }))
    .sort((a, b) => a.person.name.localeCompare(b.person.name, 'sv'));

  function shiftSummary(shifts: ScheduleEntry[]) {
    return shifts
      .map(entry => `${entry.position} ${entry.start_time}-${entry.end_time}`)
      .join(' · ');
  }

  function exportLedger(entries: StaffLedgerEntry[], scope: 'all' | 'day') {
    const sortedEntries = [...entries].sort((a, b) => new Date(a.check_in_at).getTime() - new Date(b.check_in_at).getTime());
    const rows = [
      ['Namn', 'Typ', 'Dag', 'Pass/roll', 'In datum', 'In tid', 'Ut datum', 'Ut tid', 'Status', 'Anteckning'],
      ...sortedEntries.map(entry => [
        entry.name,
        ROLE_LABELS[entry.role],
        entry.day,
        entry.position || '',
        formatDate(entry.check_in_at),
        formatTime(entry.check_in_at),
        formatDate(entry.check_out_at),
        formatTime(entry.check_out_at),
        entry.check_out_at ? 'Utstämplad' : 'Inne',
        entry.note || '',
      ]),
    ];
    const datePart = new Date().toISOString().slice(0, 10);
    const dayPart = scope === 'day' ? `-${selectedDay.toLowerCase().replace(/\s+/g, '-')}` : '-alla';
    downloadCsv(`personalliggare${dayPart}-${datePart}.csv`, rows);
  }

  async function clearLedger() {
    if (!currentUser || clearingLedger) return;
    setClearError('');
    const allowed = await passwordMatches(currentUser, clearPassword);
    if (!allowed) {
      setClearError('Fel lösenord.');
      return;
    }
    if (!window.confirm('Rensa hela personalliggaren? Exportera rapport först om du behöver spara underlaget.')) return;

    setClearingLedger(true);
    const { error: deleteError } = await supabase
      .from('staff_ledger_entries')
      .delete()
      .not('id', 'is', null);
    if (deleteError) {
      setClearError(formatSupabaseError(deleteError));
      setClearingLedger(false);
      return;
    }
    setClearingLedger(false);
    setShowClearConfirm(false);
    setClearPassword('');
    setNotice('Personalliggaren är rensad.');
    await load();
  }

  async function checkInScheduled(person: SchedulePerson, shifts: ScheduleEntry[]) {
    setSavingId(`scheduled-${person.id}`);
    setError('');
    setNotice('');
    const { error: insertError } = await supabase.from('staff_ledger_entries').insert({
      schedule_person_id: person.id,
      schedule_entry_id: null,
      name: person.name,
      role: 'scheduled',
      day: selectedDay,
      position: shiftSummary(shifts) || 'Schemalagd',
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

  async function checkOutScheduled(person: SchedulePerson) {
    const openEntries = ledgerEntries.filter(entry => (
      entry.schedule_person_id === person.id &&
      entry.day === selectedDay &&
      !entry.check_out_at
    ));
    if (openEntries.length === 0) return;
    setSavingId(`scheduled-${person.id}`);
    setError('');
    setNotice('');
    const checkedOutAt = new Date().toISOString();
    const results = await Promise.all(openEntries.map(entry => (
      supabase
        .from('staff_ledger_entries')
        .update({ check_out_at: checkedOutAt })
        .eq('id', entry.id)
    )));
    const updateError = results.find(result => result.error)?.error;
    if (updateError) {
      setError(formatSupabaseError(updateError));
      setSavingId(null);
      return;
    }
    setNotice(`${person.name} är utstämplad.`);
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
                {checkedScheduledIds.size}/{scheduledStaffIds.size} schemalagda incheckade · {activeTotalCount} inne totalt
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

        {embedded && (
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-white">Rapporter och rensning</h2>
                <p className="text-sm text-gray-400">Exportera personalliggaren innan du rensar inför nästa kväll.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => exportLedger(visibleLedger, 'day')}
                  disabled={visibleLedger.length === 0}
                  className="h-10 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportera vald dag
                </button>
                <button
                  onClick={() => exportLedger(ledgerEntries, 'all')}
                  disabled={ledgerEntries.length === 0}
                  className="h-10 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportera allt
                </button>
                <button
                  onClick={() => {
                    setShowClearConfirm(value => !value);
                    setClearError('');
                    setClearPassword('');
                  }}
                  disabled={ledgerEntries.length === 0}
                  className="h-10 px-3 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-300 font-semibold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Rensa flödet
                </button>
              </div>
            </div>

            {showClearConfirm && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 space-y-3">
                <div>
                  <p className="text-red-200 font-semibold">Rensa hela personalliggaren?</p>
                  <p className="text-red-200/80 text-sm mt-1">
                    Detta tar bort alla in- och utstämplingar i kontrollvyn. Exportera rapport först om den ska sparas.
                  </p>
                </div>
                <input
                  value={clearPassword}
                  onChange={event => setClearPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Ditt lösenord"
                  className="w-full bg-gray-950 border border-red-500/30 rounded-xl px-3 py-2.5 text-white placeholder-red-200/40 focus:outline-none focus:border-red-400"
                />
                {clearError && <p className="text-red-300 text-sm">{clearError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={clearLedger}
                    disabled={clearingLedger || !clearPassword}
                    className="flex-1 h-10 bg-red-600 hover:bg-red-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {clearingLedger ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Rensa personalliggaren
                  </button>
                  <button
                    onClick={() => {
                      setShowClearConfirm(false);
                      setClearPassword('');
                      setClearError('');
                    }}
                    disabled={clearingLedger}
                    className="h-10 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-semibold disabled:opacity-50"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <h2 className="text-lg font-black text-white">Schemalagd personal</h2>
          {loading ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-8 flex justify-center">
              <LoaderIcon />
            </div>
          ) : scheduledPeople.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-8 text-center text-gray-500">
              Ingen namngiven personal schemalagd för vald dag.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {scheduledPeople.map(({ person, shifts, open }) => {
                const isSaving = savingId === `scheduled-${person.id}` || savingId === open?.id;
                return (
                  <div key={person.id} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{person.name}</p>
                      <p className="text-xs text-gray-500">
                        {open ? `In ${formatDateTime(open.check_in_at)}` : 'Ej incheckad'}
                        {shifts.length > 0 ? ` · ${shiftSummary(shifts)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => open ? checkOutScheduled(person) : checkInScheduled(person, shifts)}
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
            </div>
          )}
        </section>

        {embedded && (
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
            <h2 className="text-lg font-black text-white">Passkontroll</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {visibleSchedules.map(entry => {
                const assignedPeople = (entry.assigned_staff_ids || [])
                  .map(id => people.find(person => person.id === id))
                  .filter((person): person is SchedulePerson => Boolean(person));
                const checkedCount = assignedPeople.filter(person => activeForPerson(ledgerEntries, person.id, selectedDay)).length;
                const expectedCount = assignedPeople.length || entry.required_count;
                const missingForShift = assignedPeople.filter(person => !activeForPerson(ledgerEntries, person.id, selectedDay));

                return (
                  <div key={entry.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-3">
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

                    {missingForShift.length > 0 ? (
                      <p className="text-xs text-red-300 flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5" />
                        Saknas: {missingForShift.map(person => person.name).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-green-300 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Alla namngivna på passet är incheckade.
                      </p>
                    )}
                    {assignedPeople.length === 0 && <p className="text-sm text-gray-500">Inga namngivna personer på passet.</p>}
                  </div>
                );
              })}
              {visibleSchedules.length === 0 && (
                <div className="xl:col-span-2 rounded-xl border border-gray-800 bg-gray-950 p-8 text-center text-gray-500">
                  Inga schemalagda pass för vald dag.
                </div>
              )}
            </div>
          </section>
        )}

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
                  <p className="text-xs text-gray-500">{ROLE_LABELS[entry.role]} · In {formatDateTime(entry.check_in_at)}{entry.note ? ` · ${entry.note}` : ''}</p>
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
                  <th className="py-2 pr-3">In datum</th>
                  <th className="py-2 pr-3">In tid</th>
                  <th className="py-2 pr-3">Ut datum</th>
                  <th className="py-2 pr-3">Ut tid</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {visibleLedger.map(entry => (
                  <tr key={entry.id} className="text-gray-300">
                    <td className="py-2 pr-3 font-semibold text-white">{entry.name}</td>
                    <td className="py-2 pr-3">{ROLE_LABELS[entry.role]}</td>
                    <td className="py-2 pr-3">{entry.day}{entry.position ? ` · ${entry.position}` : ''}</td>
                    <td className="py-2 pr-3">{formatDate(entry.check_in_at)}</td>
                    <td className="py-2 pr-3">{formatTime(entry.check_in_at)}</td>
                    <td className="py-2 pr-3">{formatDate(entry.check_out_at)}</td>
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
                    <td colSpan={8} className="py-8 text-center text-gray-500">Inga registreringar för vald dag.</td>
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
