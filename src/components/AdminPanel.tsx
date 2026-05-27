import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Edit2, Trash2, Check, X, BarChart2, Users, MapPin, Package, Loader2, RotateCcw } from 'lucide-react';
import { supabase, AppUser, Location, Product, CATEGORIES } from '../lib/supabase';
import { useApp } from '../lib/store';

type AdminTab = 'stats' | 'users' | 'locations' | 'products';

export default function AdminPanel() {
  const { setView } = useApp();
  const [tab, setTab] = useState<AdminTab>('stats');

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
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
          { id: 'users', label: 'Personal', Icon: Users },
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
        {tab === 'users' && <UsersTab />}
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
        <h3 className="text-white font-semibold mb-3">Mest beställda produkter</h3>
        <div className="space-y-2">
          {stats.topProducts.length === 0 && (
            <p className="text-gray-500 text-sm">Ingen produktstatistik än</p>
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
  const [form, setForm] = useState({ name: '', pin: '', role: 'barpersonal' as AppUser['role'] });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('users').select('*').order('created_at');
    setUsers(data || []);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name || !form.pin) return;
    setSaving(true);
    if (editing) {
      await supabase.from('users').update({ name: form.name, pin: form.pin, role: form.role }).eq('id', editing);
    } else {
      await supabase.from('users').insert({ name: form.name, pin: form.pin, role: form.role });
    }
    setSaving(false);
    setEditing(null);
    setAdding(false);
    setForm({ name: '', pin: '', role: 'barpersonal' });
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
    setForm({ name: user.name, pin: user.pin, role: user.role });
  }

  const ROLE_LABELS: Record<string, string> = { barpersonal: 'Barpersonal', lager: 'Lager', admin: 'Admin' };

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
            value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
            placeholder="PIN-kod (4 siffror)"
            maxLength={4}
            inputMode="numeric"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
          />
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as AppUser['role'] }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="barpersonal">Barpersonal</option>
            <option value="lager">Lager</option>
            <option value="admin">Admin</option>
          </select>
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
              onClick={() => { setEditing(null); setAdding(false); setForm({ name: '', pin: '', role: 'barpersonal' }); }}
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
            <p className="text-gray-500 text-sm">PIN: {user.pin} · {ROLE_LABELS[user.role]}</p>
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
