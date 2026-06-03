import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Edit2, Trash2, Check, X, BarChart2, Users, MapPin, Package, Loader2, RotateCcw, MessageSquare, CalendarDays } from 'lucide-react';
import { supabase, AppUser, Location, Product, CATEGORIES, ALL_USER_ROLES, ROLE_LABELS, ScheduleEntry, SchedulePerson, SchedulePosition, UserRole } from '../lib/supabase';
import { useApp } from '../lib/store';
import ChatPanel from './ChatPanel';
import { getUserRoles, hashPassword } from '../lib/auth';

type AdminTab = 'stats' | 'chat' | 'users' | 'schedule' | 'locations' | 'products';

export default function AdminPanel() {
  const { setView } = useApp();
  const [tab, setTab] = useState<AdminTab>('stats');

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 safe-area-inset-top">
        <button
          onClick={() => setView('dashboard')}
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg">Admin</h1>
      </div>

      {/* Tab bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex gap-1 overflow-x-auto">
        {([
          { id: 'stats', label: 'Statistik', Icon: BarChart2 },
          { id: 'chat', label: 'Chatt', Icon: MessageSquare },
          { id: 'users', label: 'Personal', Icon: Users },
          { id: 'schedule', label: 'Schema', Icon: CalendarDays },
          { id: 'locations', label: 'Platser', Icon: MapPin },
          { id: 'products', label: 'Produkter', Icon: Package },
        ] as { id: AdminTab; label: string; Icon: typeof BarChart2 }[]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'stats' && <StatsTab />}
        {tab === 'chat' && <ChatPanel embedded />}
        {tab === 'users' && <UsersTab />}
        {tab === 'schedule' && <ScheduleTab />}
        {tab === 'locations' && <LocationsTab />}
        {tab === 'products' && <ProductsTab />}
      </div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<{
    byLocation: { name: string; count: number }[];
    topProducts: { name: string; count: number }[];
    openCount: number;
    avgDelivery: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  async function load() {
    const { data: requests } = await supabase
      .from('restock_requests')
      .select(`*, locations(name), restock_request_items(product_name, quantity)`)
      .order('created_at', { ascending: false });

    if (!requests) return;

    const byLocation: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    let openCount = 0;
    const deliveredWithTime: number[] = [];

    for (const req of requests) {
      const locName = req.locations?.name || 'Okänd';
      byLocation[locName] = (byLocation[locName] || 0) + 1;
      if (req.status === 'mottagen' || req.status === 'pa_vag') openCount++;
      if (req.status === 'levererad') {
        const ms = new Date(req.updated_at).getTime() - new Date(req.created_at).getTime();
        deliveredWithTime.push(ms / 60000);
      }
      for (const item of req.restock_request_items || []) {
        byProduct[item.product_name] = (byProduct[item.product_name] || 0) + item.quantity;
      }
    }

    const avg = deliveredWithTime.length
      ? Math.round(deliveredWithTime.reduce((a, b) => a + b, 0) / deliveredWithTime.length)
      : null;

    setStats({
      byLocation: Object.entries(byLocation).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      topProducts: Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
      openCount,
      avgDelivery: avg !== null ? `${avg} min` : '—',
    });
  }

  async function resetStats() {
    if (!window.confirm('Nollställ all statistik och ta bort alla beställningar inför kvällen?')) return;
    setResetting(true);
    await supabase.from('restock_request_items').delete().not('id', 'is', null);
    await supabase.from('restock_requests').delete().not('id', 'is', null);
    await load();
    setResetting(false);
  }

  useEffect(() => { load(); }, []);

  if (!stats) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>;

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={resetStats}
        disabled={resetting}
        className="w-full h-12 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        Återställ statistik inför kvällen
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-amber-400 text-3xl font-bold">{stats.openCount}</p>
          <p className="text-gray-400 text-sm mt-1">Öppna beställningar</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-green-400 text-3xl font-bold">{stats.avgDelivery}</p>
          <p className="text-gray-400 text-sm mt-1">Snittleveranstid</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">Beställningar per plats</h3>
        <div className="space-y-2">
          {stats.byLocation.length === 0 && (
            <p className="text-gray-500 text-sm">Ingen statistik än</p>
          )}
          {stats.byLocation.map(({ name, count }) => {
            const max = stats.byLocation[0]?.count || 1;
            return (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{name}</span>
                  <span className="text-gray-400">{count}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">Mest efterfrågat</h3>
        <div className="space-y-2">
          {stats.topProducts.length === 0 && (
            <p className="text-gray-500 text-sm">Ingen statistik än</p>
          )}
          {stats.topProducts.map(({ name, count }, i) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-gray-600 text-xs w-5 text-right">{i + 1}.</span>
              <span className="text-gray-300 text-sm flex-1">{name}</span>
              <span className="text-orange-400 text-sm font-medium">{count} st</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    roles: ['barpersonal'] as UserRole[],
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('users').select('*').order('created_at');
    setUsers(data || []);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name || !form.username || (!editing && !form.password) || form.roles.length === 0) return;
    setSaving(true);
    const primaryRole = form.roles[0];
    const passwordPatch = form.password
      ? { password_hash: await hashPassword(form.password), pin: form.password }
      : {};
    const values = {
      name: form.name,
      username: form.username.trim().toLowerCase(),
      role: primaryRole,
      roles: form.roles,
      ...passwordPatch,
    };
    if (editing) {
      await supabase.from('users').update(values).eq('id', editing);
    } else {
      await supabase.from('users').insert(values);
    }
    setSaving(false);
    setEditing(null);
    setAdding(false);
    setForm({ name: '', username: '', password: '', roles: ['barpersonal'] });
    load();
  }

  async function toggleActive(user: AppUser) {
    await supabase.from('users').update({ active: !user.active }).eq('id', user.id);
    load();
  }

  async function deleteUser(user: AppUser) {
    if (!window.confirm(`Radera ${user.name}? Historiska beställningar behålls men kopplas inte längre till personen.`)) return;
    await supabase.from('restock_requests').update({ user_id: null }).eq('user_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
    load();
  }

  function startEdit(user: AppUser) {
    setEditing(user.id);
    setAdding(false);
    setForm({
      name: user.name,
      username: user.username || '',
      password: '',
      roles: getUserRoles(user),
    });
  }

  function toggleRole(role: UserRole) {
    setForm(current => {
      const hasRole = current.roles.includes(role);
      const roles = hasRole
        ? current.roles.filter(item => item !== role)
        : [...current.roles, role];
      return { ...current, roles: roles.length > 0 ? roles : [role] };
    });
  }

  const showForm = adding || editing !== null;

  return (
    <div className="p-4 space-y-3">
      {showForm ? (
        <div className="bg-gray-900 border border-orange-500/40 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">{editing ? 'Redigera personal' : 'Lägg till personal'}</h3>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Namn"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
          />
          <input
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            placeholder="Användarnamn"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
          />
          <input
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder={editing ? 'Nytt lösenord (lämna tomt för att behålla)' : 'Lösenord'}
            type="password"
            autoComplete="new-password"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
          />
          <div className="space-y-2">
            <p className="text-gray-300 text-sm font-medium">Behörigheter</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_USER_ROLES.map(role => (
                <label
                  key={role}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    form.roles.includes(role)
                      ? 'bg-orange-500/15 border-orange-500/50 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 h-11 bg-orange-500 hover:bg-orange-400 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Spara
            </button>
            <button
              onClick={() => { setEditing(null); setAdding(false); setForm({ name: '', username: '', password: '', roles: ['barpersonal'] }); }}
              className="flex-1 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-semibold flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setEditing(null); }}
          className="w-full h-12 bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Lägg till personal
        </button>
      )}

      {users.map(user => (
        <div key={user.id} className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-3 ${user.active ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium">{user.name}</p>
            <p className="text-gray-500 text-sm">
              {user.username || 'Saknar användarnamn'} · {getUserRoles(user).map(role => ROLE_LABELS[role]).join(', ')}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => startEdit(user)} aria-label={`Redigera ${user.name}`} title="Redigera" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => toggleActive(user)} aria-label={user.active ? `Inaktivera ${user.name}` : `Aktivera ${user.name}`} title={user.active ? 'Inaktivera' : 'Aktivera'} className={`p-2 rounded-lg transition-colors ${user.active ? 'text-green-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-800 hover:text-gray-400'}`}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => deleteUser(user)} aria-label={`Radera ${user.name}`} title="Radera" className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_SCHEDULE_FORM = {
  day: 'Fredag',
  position_id: '',
  start_time: '19:00',
  end_time: '02:00',
  required_count: 1,
  assigned_staff_ids: [] as string[],
  note: '',
};

const DEFAULT_SCHEDULE_PERSON_FORM = {
  name: '',
  preferred_day: 'Fredag',
  available_start: '19:00',
  available_end: '02:00',
  note: '',
};

function scheduleTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function scheduleRange(startTime: string, endTime: string) {
  const start = scheduleTimeToMinutes(startTime);
  let end = scheduleTimeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function isWithinAvailability(entry: Pick<ScheduleEntry, 'start_time' | 'end_time'>, person: SchedulePerson) {
  const shift = scheduleRange(entry.start_time, entry.end_time);
  const available = scheduleRange(person.available_start, person.available_end);
  return shift.start >= available.start && shift.end <= available.end;
}

function overlapsSchedule(
  candidate: Pick<ScheduleEntry, 'id' | 'day' | 'start_time' | 'end_time'>,
  entry: Pick<ScheduleEntry, 'id' | 'day' | 'start_time' | 'end_time'>,
) {
  if (candidate.id === entry.id || candidate.day !== entry.day) return false;
  const candidateRange = scheduleRange(candidate.start_time, candidate.end_time);
  const entryRange = scheduleRange(entry.start_time, entry.end_time);
  return candidateRange.start < entryRange.end && entryRange.start < candidateRange.end;
}

function ScheduleTab() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [positions, setPositions] = useState<SchedulePosition[]>([]);
  const [people, setPeople] = useState<SchedulePerson[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [positionName, setPositionName] = useState('');
  const [personForm, setPersonForm] = useState(DEFAULT_SCHEDULE_PERSON_FORM);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPerson, setSavingPerson] = useState(false);
  const [form, setForm] = useState(DEFAULT_SCHEDULE_FORM);

  async function load() {
    const [entriesResult, positionsResult, peopleResult] = await Promise.all([
      supabase.from('schedule_entries').select('*').order('day').order('sort_order'),
      supabase.from('schedule_positions').select('*').order('sort_order'),
      supabase.from('schedule_people').select('*').order('sort_order'),
    ]);
    setEntries(entriesResult.data || []);
    setPositions(positionsResult.data || []);
    setPeople(peopleResult.data || []);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditing(null);
    setAdding(false);
    setForm(DEFAULT_SCHEDULE_FORM);
  }

  function resetPersonForm() {
    setEditingPerson(null);
    setPersonForm(DEFAULT_SCHEDULE_PERSON_FORM);
  }

  function startEdit(entry: ScheduleEntry) {
    setEditing(entry.id);
    setAdding(false);
    setForm({
      day: entry.day,
      position_id: entry.position_id || positions.find(position => position.name === entry.position)?.id || '',
      start_time: entry.start_time,
      end_time: entry.end_time,
      required_count: entry.required_count,
      assigned_staff_ids: entry.assigned_staff_ids || [],
      note: entry.note || '',
    });
  }

  function startEditPerson(person: SchedulePerson) {
    setEditingPerson(person.id);
    setPersonForm({
      name: person.name,
      preferred_day: person.preferred_day,
      available_start: person.available_start,
      available_end: person.available_end,
      note: person.note || '',
    });
  }

  async function savePosition() {
    const name = positionName.trim();
    if (!name) return;
    await supabase.from('schedule_positions').insert({ name, sort_order: positions.length + 1 });
    setPositionName('');
    load();
  }

  async function togglePosition(position: SchedulePosition) {
    await supabase.from('schedule_positions').update({ active: !position.active }).eq('id', position.id);
    load();
  }

  async function deletePosition(position: SchedulePosition) {
    const used = entries.some(entry => entry.position_id === position.id || entry.position === position.name);
    if (used) {
      window.alert('Arbetsstället används i schemat. Ta bort eller ändra passen först.');
      return;
    }
    if (!window.confirm(`Radera arbetsstället ${position.name}?`)) return;
    await supabase.from('schedule_positions').delete().eq('id', position.id);
    load();
  }

  async function savePerson() {
    if (!personForm.name.trim()) return;
    setSavingPerson(true);
    const values = {
      name: personForm.name.trim(),
      preferred_day: personForm.preferred_day.trim(),
      available_start: personForm.available_start,
      available_end: personForm.available_end,
      note: personForm.note.trim() || null,
      sort_order: editingPerson ? people.find(person => person.id === editingPerson)?.sort_order ?? people.length + 1 : people.length + 1,
    };
    if (editingPerson) {
      await supabase.from('schedule_people').update(values).eq('id', editingPerson);
    } else {
      await supabase.from('schedule_people').insert(values);
    }
    setSavingPerson(false);
    resetPersonForm();
    load();
  }

  async function togglePerson(person: SchedulePerson) {
    await supabase.from('schedule_people').update({ active: !person.active }).eq('id', person.id);
    load();
  }

  async function deletePerson(person: SchedulePerson) {
    const used = entries.some(entry => entry.assigned_staff_ids?.includes(person.id));
    if (used) {
      window.alert('Personen är redan schemalagd. Ta bort personen från passen först.');
      return;
    }
    if (!window.confirm(`Radera ${person.name} från schemapersonalen?`)) return;
    await supabase.from('schedule_people').delete().eq('id', person.id);
    load();
  }

  async function save() {
    const position = positions.find(item => item.id === form.position_id);
    if (!form.day || !position || !form.start_time || !form.end_time || form.required_count < 0) return;
    setSaving(true);
    const assignedNames = form.assigned_staff_ids
      .map(id => people.find(person => person.id === id)?.name)
      .filter(Boolean) as string[];
    const values = {
      day: form.day.trim(),
      position_id: position.id,
      position: position.name,
      start_time: form.start_time,
      end_time: form.end_time,
      required_count: Number(form.required_count),
      assigned_staff_ids: form.assigned_staff_ids,
      assigned_names: assignedNames,
      note: form.note.trim() || null,
      sort_order: editing ? entries.find(entry => entry.id === editing)?.sort_order ?? entries.length + 1 : entries.length + 1,
    };

    if (editing) {
      await supabase.from('schedule_entries').update(values).eq('id', editing);
    } else {
      await supabase.from('schedule_entries').insert(values);
    }

    setSaving(false);
    resetForm();
    load();
  }

  function toggleAssignedStaff(personId: string) {
    setForm(current => ({
      ...current,
      assigned_staff_ids: current.assigned_staff_ids.includes(personId)
        ? current.assigned_staff_ids.filter(id => id !== personId)
        : [...current.assigned_staff_ids, personId],
    }));
  }

  async function toggleActive(entry: ScheduleEntry) {
    await supabase.from('schedule_entries').update({ active: !entry.active }).eq('id', entry.id);
    load();
  }

  async function deleteEntry(entry: ScheduleEntry) {
    if (!window.confirm(`Radera schemaraden ${entry.day} ${entry.position} ${entry.start_time}-${entry.end_time}?`)) return;
    await supabase.from('schedule_entries').delete().eq('id', entry.id);
    load();
  }

  const showForm = adding || editing !== null;
  const candidateEntry = {
    id: editing || 'new-entry',
    day: form.day,
    start_time: form.start_time,
    end_time: form.end_time,
  };
  const activePeople = people.filter(person => person.active);
  const selectablePeople = activePeople.map(person => {
    const available = person.preferred_day === form.day && isWithinAvailability(candidateEntry, person);
    const conflictingEntry = entries.find(entry => (
      entry.assigned_staff_ids?.includes(person.id) && overlapsSchedule(candidateEntry, entry)
    ));
    const selected = form.assigned_staff_ids.includes(person.id);
    return { person, available, conflictingEntry, selected, selectable: selected || (available && !conflictingEntry) };
  });

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">Arbetsställen</h3>
          <div className="flex gap-2">
            <input
              value={positionName}
              onChange={e => setPositionName(e.target.value)}
              placeholder="Nytt arbetsställe, t.ex. Entré"
              className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <button onClick={savePosition} className="h-11 px-4 bg-orange-500 hover:bg-orange-400 rounded-xl text-white font-semibold">
              Lägg till
            </button>
          </div>
          <div className="space-y-2">
            {positions.map(position => (
              <div key={position.id} className={`flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 ${position.active ? '' : 'opacity-50'}`}>
                <span className="flex-1 text-sm text-white">{position.name}</span>
                <button onClick={() => togglePosition(position)} title={position.active ? 'Inaktivera' : 'Aktivera'} className="p-1.5 rounded text-green-400 hover:bg-gray-800">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => deletePosition(position)} title="Radera" className="p-1.5 rounded text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">{editingPerson ? 'Redigera schemapersonal' : 'Lägg till schemapersonal'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={personForm.name}
              onChange={e => setPersonForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Namn"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <input
              value={personForm.preferred_day}
              onChange={e => setPersonForm(f => ({ ...f, preferred_day: e.target.value }))}
              placeholder="Dag"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <input
              value={personForm.available_start}
              onChange={e => setPersonForm(f => ({ ...f, available_start: e.target.value }))}
              type="time"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
            <input
              value={personForm.available_end}
              onChange={e => setPersonForm(f => ({ ...f, available_end: e.target.value }))}
              type="time"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <input
            value={personForm.note}
            onChange={e => setPersonForm(f => ({ ...f, note: e.target.value }))}
            placeholder="Önskemål/anteckning"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <button
              onClick={savePerson}
              disabled={savingPerson}
              className="flex-1 h-11 bg-orange-500 hover:bg-orange-400 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingPerson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Spara personal
            </button>
            {editingPerson && (
              <button onClick={resetPersonForm} className="h-11 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-semibold">
                Avbryt
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {people.map(person => (
              <div key={person.id} className={`flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 ${person.active ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{person.name}</p>
                  <p className="text-xs text-gray-500">{person.preferred_day} {person.available_start}-{person.available_end}</p>
                </div>
                <button onClick={() => startEditPerson(person)} title="Redigera" className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => togglePerson(person)} title={person.active ? 'Inaktivera' : 'Aktivera'} className="p-1.5 rounded text-green-400 hover:bg-gray-800">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => deletePerson(person)} title="Radera" className="p-1.5 rounded text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="bg-gray-900 border border-orange-500/40 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">{editing ? 'Redigera schemarad' : 'Lägg till schemarad'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.day}
              onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
              placeholder="Dag, t.ex. Fredag"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <select
              value={form.position_id}
              onChange={e => setForm(f => ({ ...f, position_id: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            >
              <option value="">Välj arbetsställe</option>
              {positions.filter(position => position.active).map(position => (
                <option key={position.id} value={position.id}>{position.name}</option>
              ))}
            </select>
            <input
              value={form.start_time}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              type="time"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
            <input
              value={form.end_time}
              onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
              type="time"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
            <input
              value={form.required_count}
              onChange={e => setForm(f => ({ ...f, required_count: Number(e.target.value) }))}
              type="number"
              min={0}
              placeholder="Behov"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="space-y-2">
            <p className="text-gray-300 text-sm font-medium">Välj personal</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectablePeople.map(({ person, selected, selectable, conflictingEntry, available }) => (
                <label
                  key={person.id}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    selected
                      ? 'bg-orange-500/15 border-orange-500/50 text-white'
                      : selectable
                      ? 'bg-gray-800 border-gray-700 text-gray-300'
                      : 'bg-gray-950 border-gray-800 text-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selectable}
                      onChange={() => toggleAssignedStaff(person.id)}
                      className="mt-1 accent-orange-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{person.name}</p>
                      <p className="text-xs">
                        {person.preferred_day} {person.available_start}-{person.available_end}
                      </p>
                      {!available && !selected && <p className="text-xs text-red-300">Ej tillgänglig för tiden</p>}
                      {conflictingEntry && !selected && <p className="text-xs text-red-300">Dubbelbokning: {conflictingEntry.position} {conflictingEntry.start_time}-{conflictingEntry.end_time}</p>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <textarea
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="Anteckning"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 h-11 bg-orange-500 hover:bg-orange-400 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Spara
            </button>
            <button
              onClick={resetForm}
              className="flex-1 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-semibold flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setEditing(null); }}
          className="w-full h-12 bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Lägg till schemarad
        </button>
      )}

      {entries.map(entry => {
        const booked = entry.assigned_names.length;
        const balance = booked - entry.required_count;
        const status = balance < 0 ? `Saknas ${Math.abs(balance)}` : balance > 0 ? `Överbemannad ${balance}` : 'OK';
        const statusClass = balance < 0
          ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : balance > 0
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-green-500/15 text-green-300 border-green-500/30';

        return (
          <div key={entry.id} className={`bg-gray-900 border rounded-xl p-4 flex items-start gap-3 ${entry.active ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-white font-semibold">{entry.day} · {entry.position}</p>
                <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${statusClass}`}>{status}</span>
              </div>
              <p className="text-gray-400 text-sm mt-1">{entry.start_time}-{entry.end_time} · Behov {entry.required_count} · Bokade {booked}</p>
              <p className="text-gray-500 text-sm mt-1 truncate">{entry.assigned_names.length ? entry.assigned_names.join(', ') : 'Inga bokade namn'}</p>
              {entry.note && <p className="text-orange-300 text-xs mt-2">{entry.note}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => startEdit(entry)} aria-label={`Redigera ${entry.position}`} title="Redigera" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => toggleActive(entry)} aria-label={entry.active ? `Inaktivera ${entry.position}` : `Aktivera ${entry.position}`} title={entry.active ? 'Inaktivera' : 'Aktivera'} className={`p-2 rounded-lg transition-colors ${entry.active ? 'text-green-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-800 hover:text-gray-400'}`}>
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => deleteEntry(entry)} aria-label={`Radera ${entry.position}`} title="Radera" className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LocationsTab() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('locations').select('*').order('sort_order');
    setLocations(data || []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) return;
    setSaving(true);
    if (editing) {
      await supabase.from('locations').update({ name: form.name }).eq('id', editing);
    } else {
      await supabase.from('locations').insert({ name: form.name, sort_order: locations.length + 1 });
    }
    setSaving(false);
    setEditing(null);
    setAdding(false);
    setForm({ name: '' });
    load();
  }

  async function toggleActive(loc: Location) {
    await supabase.from('locations').update({ active: !loc.active }).eq('id', loc.id);
    load();
  }

  async function deleteLocation(loc: Location) {
    if (!window.confirm(`Radera platsen ${loc.name}? Historiska beställningar behålls men kopplas inte längre till platsen.`)) return;
    await supabase.from('restock_requests').update({ location_id: null }).eq('location_id', loc.id);
    await supabase.from('locations').delete().eq('id', loc.id);
    load();
  }

  return (
    <div className="p-4 space-y-3">
      {(adding || editing) ? (
        <div className="bg-gray-900 border border-orange-500/40 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">{editing ? 'Redigera plats' : 'Lägg till plats'}</h3>
          <input
            value={form.name}
            onChange={e => setForm({ name: e.target.value })}
            placeholder="Platsnamn"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 h-11 bg-orange-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Spara
            </button>
            <button onClick={() => { setEditing(null); setAdding(false); setForm({ name: '' }); }} className="flex-1 h-11 bg-gray-800 rounded-xl text-gray-300 font-semibold flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditing(null); }} className="w-full h-12 bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          Lägg till plats
        </button>
      )}

      {locations.map(loc => (
        <div key={loc.id} className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-3 ${loc.active ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
          <div className="flex-1">
            <p className="text-white font-medium">{loc.name}</p>
            <p className="text-gray-500 text-xs">{loc.active ? 'Aktiv' : 'Inaktiv'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditing(loc.id); setAdding(false); setForm({ name: loc.name }); }} aria-label={`Redigera ${loc.name}`} title="Redigera" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => toggleActive(loc)} aria-label={loc.active ? `Inaktivera ${loc.name}` : `Aktivera ${loc.name}`} title={loc.active ? 'Inaktivera' : 'Aktivera'} className={`p-2 rounded-lg transition-colors ${loc.active ? 'text-green-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-800'}`}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => deleteLocation(loc)} aria-label={`Radera ${loc.name}`} title="Radera" className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', category: CATEGORIES[0] as string, unit: 'krt' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('products').select('*').order('category').order('sort_order');
    setProducts(data || []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) return;
    setSaving(true);
    if (editing) {
      await supabase.from('products').update({ name: form.name, category: form.category, unit: form.unit }).eq('id', editing);
    } else {
      await supabase.from('products').insert({ name: form.name, category: form.category, unit: form.unit });
    }
    setSaving(false);
    setEditing(null);
    setAdding(false);
    setForm({ name: '', category: CATEGORIES[0], unit: 'krt' });
    load();
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    load();
  }

  async function deleteProduct(p: Product) {
    if (!window.confirm(`Radera produkten ${p.name}? Historiska orderrader behåller namn och antal.`)) return;
    await supabase.from('restock_request_items').update({ product_id: null }).eq('product_id', p.id);
    await supabase.from('products').delete().eq('id', p.id);
    load();
  }

  const filtered = filterCat === 'all' ? products : products.filter(p => p.category === filterCat);

  return (
    <div className="p-4 space-y-3">
      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterCat('all')} className={`flex-shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition-all ${filterCat === 'all' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>Alla</button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} className={`flex-shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition-all ${filterCat === cat ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>{cat}</button>
        ))}
      </div>

      {(adding || editing) ? (
        <div className="bg-gray-900 border border-orange-500/40 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">{editing ? 'Redigera produkt' : 'Lägg till produkt'}</h3>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Produktnamn" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500">
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Enhet (krt, fl, påse...)" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 h-11 bg-orange-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Spara
            </button>
            <button onClick={() => { setEditing(null); setAdding(false); setForm({ name: '', category: CATEGORIES[0], unit: 'krt' }); }} className="flex-1 h-11 bg-gray-800 rounded-xl text-gray-300 font-semibold flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditing(null); }} className="w-full h-12 bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          Lägg till produkt
        </button>
      )}

      {filtered.map(p => (
        <div key={p.id} className={`bg-gray-900 border rounded-xl p-3 flex items-center gap-3 ${p.active ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{p.name}</p>
            <p className="text-gray-500 text-xs">{p.category} · {p.unit}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditing(p.id); setAdding(false); setForm({ name: p.name, category: p.category, unit: p.unit }); }} aria-label={`Redigera ${p.name}`} title="Redigera" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => toggleActive(p)} aria-label={p.active ? `Inaktivera ${p.name}` : `Aktivera ${p.name}`} title={p.active ? 'Inaktivera' : 'Aktivera'} className={`p-2 rounded-lg transition-colors ${p.active ? 'text-green-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-800'}`}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => deleteProduct(p)} aria-label={`Radera ${p.name}`} title="Radera" className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
