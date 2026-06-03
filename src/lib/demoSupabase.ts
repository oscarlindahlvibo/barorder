import type { AdminChatMessage, AppUser, KitchenOrder, Location, Product, RestockRequest, RestockRequestItem, ScheduleEntry, SchedulePerson, SchedulePosition } from './supabase';

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  role: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface NativePushTokenRow {
  id: string;
  user_id: string;
  role: string;
  platform: string;
  token: string;
  user_agent: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type TableName = 'users' | 'locations' | 'products' | 'restock_requests' | 'restock_request_items' | 'push_subscriptions' | 'native_push_tokens' | 'admin_chat_messages' | 'kitchen_orders' | 'schedule_entries' | 'schedule_positions' | 'schedule_people';
type Row = AppUser | Location | Product | RestockRequest | RestockRequestItem | PushSubscriptionRow | NativePushTokenRow | AdminChatMessage | KitchenOrder | ScheduleEntry | SchedulePosition | SchedulePerson;
type Filter = { field: string; op: 'eq' | 'in' | 'neq' | 'not_is'; value: unknown };
type Order = { field: string; ascending: boolean };
type ChangePayload = { new: Row };
type Listener = { table: TableName; event: 'INSERT' | 'UPDATE'; callback: (payload: ChangePayload) => void };

const STORAGE_KEY = 'truckmeet_demo_db';

interface DemoDb {
  users: AppUser[];
  locations: Location[];
  products: Product[];
  restock_requests: RestockRequest[];
  restock_request_items: RestockRequestItem[];
  push_subscriptions: PushSubscriptionRow[];
  native_push_tokens: NativePushTokenRow[];
  admin_chat_messages: AdminChatMessage[];
  kitchen_orders: KitchenOrder[];
  schedule_entries: ScheduleEntry[];
  schedule_positions: SchedulePosition[];
  schedule_people: SchedulePerson[];
}

const now = new Date().toISOString();

const seedDb: DemoDb = {
  users: [
    { id: 'user-admin', name: 'Admin', username: 'admin', password_hash: null, pin: '0000', role: 'admin', roles: ['admin', 'barpersonal', 'lager', 'personal', 'serveringsansvarig', 'kitchen', 'kitchen_display', 'schedule_display'], active: true, created_at: now },
    { id: 'user-bar', name: 'Barpersonal', username: 'bar', password_hash: null, pin: '1234', role: 'barpersonal', roles: ['barpersonal', 'lager'], active: true, created_at: now },
    { id: 'user-personal', name: 'Personalansvarig', username: 'personal', password_hash: null, pin: '5555', role: 'personal', roles: ['personal'], active: true, created_at: now },
    { id: 'user-serving', name: 'Serveringsansvarig', username: 'servering', password_hash: null, pin: '4444', role: 'serveringsansvarig', roles: ['serveringsansvarig', 'barpersonal', 'lager', 'personal'], active: true, created_at: now },
    { id: 'user-lager', name: 'Lager', username: 'lager', password_hash: null, pin: '6789', role: 'lager', roles: ['lager'], active: true, created_at: now },
    { id: 'user-kitchen', name: 'Kök', username: 'kok', password_hash: null, pin: '2468', role: 'kitchen', roles: ['kitchen'], active: true, created_at: now },
    { id: 'user-kitchen-display', name: 'Köksskärm gäster', username: 'gastskarm', password_hash: null, pin: '1357', role: 'kitchen_display', roles: ['kitchen_display'], active: true, created_at: now },
    { id: 'user-schedule-display', name: 'Schemaskärm', username: 'schema', password_hash: null, pin: '8642', role: 'schedule_display', roles: ['schedule_display'], active: true, created_at: now },
  ],
  locations: [
    { id: 'loc-main', name: 'Stora baren', active: true, sort_order: 1, created_at: now },
    { id: 'loc-stage', name: 'Scenbaren', active: true, sort_order: 2, created_at: now },
    { id: 'loc-vip', name: 'VIP', active: true, sort_order: 3, created_at: now },
  ],
  products: [
    { id: 'prod-lager', name: 'Ljus lager', category: 'Öl', unit: 'krt', active: true, sort_order: 1, created_at: now },
    { id: 'prod-ipa', name: 'IPA', category: 'Öl', unit: 'krt', active: true, sort_order: 2, created_at: now },
    { id: 'prod-cider-apple', name: 'Äppelcider', category: 'Cider', unit: 'krt', active: true, sort_order: 1, created_at: now },
    { id: 'prod-red-wine', name: 'Rött vin', category: 'Vin', unit: 'fl', active: true, sort_order: 1, created_at: now },
    { id: 'prod-vodka', name: 'Vodka', category: 'Sprit', unit: 'fl', active: true, sort_order: 1, created_at: now },
    { id: 'prod-tonic', name: 'Tonic', category: 'Drinkmix', unit: 'krt', active: true, sort_order: 1, created_at: now },
    { id: 'prod-water', name: 'Mineralvatten', category: 'Alkoholfria drycker', unit: 'krt', active: true, sort_order: 1, created_at: now },
    { id: 'prod-ice', name: 'Is', category: 'Is', unit: 'påse', active: true, sort_order: 1, created_at: now },
    { id: 'prod-cups', name: 'Plastmuggar', category: 'Muggar', unit: 'rör', active: true, sort_order: 1, created_at: now },
    { id: 'prod-napkins', name: 'Servetter', category: 'Servetter', unit: 'pkt', active: true, sort_order: 1, created_at: now },
  ],
  restock_requests: [
    {
      id: 'req-demo-1',
      user_id: 'user-bar',
      location_id: 'loc-main',
      request_type: 'restock',
      priority: 'akut',
      note: 'Kön växer snabbt vid entrén.',
      status: 'mottagen',
      created_at: new Date(Date.now() - 7 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 60000).toISOString(),
    },
    {
      id: 'req-demo-2',
      user_id: 'user-bar',
      location_id: 'loc-stage',
      request_type: 'crate_pickup',
      priority: 'inom_20',
      note: null,
      status: 'pa_vag',
      created_at: new Date(Date.now() - 26 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 12 * 60000).toISOString(),
    },
  ],
  restock_request_items: [
    { id: 'item-demo-1', request_id: 'req-demo-1', product_id: 'prod-ice', product_name: 'Is', quantity: 4, unit: 'påse', created_at: now },
    { id: 'item-demo-2', request_id: 'req-demo-1', product_id: 'prod-lager', product_name: 'Ljus lager', quantity: 2, unit: 'krt', created_at: now },
    { id: 'item-demo-3', request_id: 'req-demo-2', product_id: null, product_name: 'Tömning av tombackar', quantity: 6, unit: 'hämtning', created_at: now },
  ],
  push_subscriptions: [],
  native_push_tokens: [],
  admin_chat_messages: [],
  kitchen_orders: [],
  schedule_positions: [
    { id: 'pos-stora-baren', name: 'Stora baren', active: true, sort_order: 1, created_at: now },
    { id: 'pos-entre', name: 'Entré', active: true, sort_order: 2, created_at: now },
    { id: 'pos-mat', name: 'Mat', active: true, sort_order: 3, created_at: now },
    { id: 'pos-buffe', name: 'Buffé', active: true, sort_order: 4, created_at: now },
    { id: 'pos-plock', name: 'Plock', active: true, sort_order: 5, created_at: now },
  ],
  schedule_people: [
    { id: 'staff-anna', name: 'Anna', preferred_day: 'Fredag', available_start: '18:00', available_end: '02:00', note: null, active: true, sort_order: 1, created_at: now, updated_at: now },
    { id: 'staff-erik', name: 'Erik', preferred_day: 'Fredag', available_start: '18:00', available_end: '02:00', note: null, active: true, sort_order: 2, created_at: now, updated_at: now },
    { id: 'staff-malin', name: 'Malin', preferred_day: 'Fredag', available_start: '12:00', available_end: '19:00', note: null, active: true, sort_order: 3, created_at: now, updated_at: now },
    { id: 'staff-kalle', name: 'Kalle', preferred_day: 'Fredag', available_start: '12:00', available_end: '19:00', note: null, active: true, sort_order: 4, created_at: now, updated_at: now },
    { id: 'staff-nora', name: 'Nora', preferred_day: 'Lördag', available_start: '14:00', available_end: '20:00', note: null, active: true, sort_order: 5, created_at: now, updated_at: now },
    { id: 'staff-sam', name: 'Sam', preferred_day: 'Lördag', available_start: '14:00', available_end: '20:00', note: null, active: true, sort_order: 6, created_at: now, updated_at: now },
    { id: 'staff-tom', name: 'Tom', preferred_day: 'Lördag', available_start: '19:00', available_end: '02:00', note: null, active: true, sort_order: 7, created_at: now, updated_at: now },
    { id: 'staff-alicia', name: 'Alicia', preferred_day: 'Lördag', available_start: '19:00', available_end: '02:00', note: null, active: true, sort_order: 8, created_at: now, updated_at: now },
  ],
  schedule_entries: [
    { id: 'schedule-1', day: 'Fredag', position_id: 'pos-stora-baren', position: 'Stora baren', start_time: '19:00', end_time: '02:00', required_count: 10, assigned_staff_ids: ['staff-anna', 'staff-erik'], assigned_names: ['Anna', 'Erik'], note: null, active: true, sort_order: 1, created_at: now, updated_at: now },
    { id: 'schedule-2', day: 'Fredag', position_id: 'pos-stora-baren', position: 'Stora baren', start_time: '12:00', end_time: '19:00', required_count: 3, assigned_staff_ids: ['staff-malin', 'staff-kalle'], assigned_names: ['Malin', 'Kalle'], note: null, active: true, sort_order: 2, created_at: now, updated_at: now },
    { id: 'schedule-5', day: 'Lördag', position_id: 'pos-buffe', position: 'Buffé', start_time: '14:00', end_time: '20:00', required_count: 5, assigned_staff_ids: ['staff-nora', 'staff-sam'], assigned_names: ['Nora', 'Sam'], note: 'Fyll på med extrapersonal', active: true, sort_order: 5, created_at: now, updated_at: now },
    { id: 'schedule-6', day: 'Lördag', position_id: 'pos-plock', position: 'Plock', start_time: '19:00', end_time: '02:00', required_count: 3, assigned_staff_ids: ['staff-tom', 'staff-alicia'], assigned_names: ['Tom', 'Alicia'], note: null, active: true, sort_order: 6, created_at: now, updated_at: now },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function loadDb(): DemoDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDb));
    return clone(seedDb);
  }
  const db = JSON.parse(raw) as DemoDb;
  const defaults: Record<string, Partial<AppUser>> = {
    '0000': { username: 'admin', roles: ['admin', 'barpersonal', 'lager', 'personal', 'serveringsansvarig', 'kitchen', 'kitchen_display', 'schedule_display'] },
    '1234': { username: 'bar', roles: ['barpersonal', 'lager'] },
    '5555': { username: 'personal', roles: ['personal'] },
    '4444': { username: 'servering', roles: ['serveringsansvarig', 'barpersonal', 'lager', 'personal'] },
    '6789': { username: 'lager', roles: ['lager'] },
    '2468': { username: 'kok', roles: ['kitchen'] },
    '1357': { username: 'gastskarm', roles: ['kitchen_display'] },
    '8642': { username: 'schema', roles: ['schedule_display'] },
  };
  let changedUsers = false;
  db.users.forEach(user => {
    const defaultsForPin = defaults[user.pin];
    if (!user.username && defaultsForPin?.username) {
      user.username = defaultsForPin.username;
      changedUsers = true;
    }
    if (!user.roles || user.roles.length === 0) {
      user.roles = (defaultsForPin?.roles as AppUser['roles']) ?? [user.role];
      changedUsers = true;
    }
    if (user.role === 'admin' && !user.roles?.includes('schedule_display')) {
      user.roles = [...(user.roles || ['admin']), 'schedule_display'];
      changedUsers = true;
    }
  });
  if (changedUsers) saveDb(db);
  if (!db.users.some(user => user.pin === '5555')) {
    db.users.push({ id: 'user-personal', name: 'Personalansvarig', username: 'personal', password_hash: null, pin: '5555', role: 'personal', roles: ['personal'], active: true, created_at: now });
    saveDb(db);
  }
  if (!db.users.some(user => user.pin === '4444')) {
    db.users.push({ id: 'user-serving', name: 'Serveringsansvarig', username: 'servering', password_hash: null, pin: '4444', role: 'serveringsansvarig', roles: ['serveringsansvarig', 'barpersonal', 'lager', 'personal'], active: true, created_at: now });
    saveDb(db);
  }
  if (!db.users.some(user => user.pin === '2468')) {
    db.users.push({ id: 'user-kitchen', name: 'Kök', username: 'kok', password_hash: null, pin: '2468', role: 'kitchen', roles: ['kitchen'], active: true, created_at: now });
    saveDb(db);
  }
  if (!db.users.some(user => user.pin === '1357')) {
    db.users.push({ id: 'user-kitchen-display', name: 'Köksskärm gäster', username: 'gastskarm', password_hash: null, pin: '1357', role: 'kitchen_display', roles: ['kitchen_display'], active: true, created_at: now });
    saveDb(db);
  }
  if (!db.users.some(user => user.pin === '8642')) {
    db.users.push({ id: 'user-schedule-display', name: 'Schemaskärm', username: 'schema', password_hash: null, pin: '8642', role: 'schedule_display', roles: ['schedule_display'], active: true, created_at: now });
    saveDb(db);
  }
  if (!db.push_subscriptions) {
    db.push_subscriptions = [];
    saveDb(db);
  }
  if (!db.native_push_tokens) {
    db.native_push_tokens = [];
    saveDb(db);
  }
  if (!db.admin_chat_messages) {
    db.admin_chat_messages = [];
    saveDb(db);
  }
  if (!db.kitchen_orders) {
    db.kitchen_orders = [];
    saveDb(db);
  }
  if (!db.schedule_entries) {
    db.schedule_entries = clone(seedDb.schedule_entries);
    saveDb(db);
  }
  if (!db.schedule_positions) {
    db.schedule_positions = clone(seedDb.schedule_positions);
    saveDb(db);
  }
  if (!db.schedule_people) {
    db.schedule_people = clone(seedDb.schedule_people);
    saveDb(db);
  }
  return db;
}

function saveDb(db: DemoDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withRelations(row: RestockRequest, db: DemoDb): RestockRequest {
  return {
    ...row,
    users: db.users.find(user => user.id === row.user_id),
    locations: db.locations.find(location => location.id === row.location_id),
    restock_request_items: db.restock_request_items.filter(item => item.request_id === row.id),
  };
}

class DemoQuery {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private insertRows: Record<string, unknown>[] | null = null;
  private upsertRows: Record<string, unknown>[] | null = null;
  private upsertConflict = 'id';
  private updateValues: Record<string, unknown> | null = null;
  private deleting = false;
  private wantsSingle = false;
  private wantsMaybeSingle = false;

  constructor(
    private table: TableName,
    private notify: (table: TableName, event: 'INSERT' | 'UPDATE', row: Row) => void,
  ) {}

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: 'eq', value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, op: 'in', value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, op: 'neq', value });
    return this;
  }

  not(field: string, operator: 'is', value: unknown) {
    this.filters.push({ field, op: operator === 'is' ? 'not_is' : 'neq', value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orders.push({ field, ascending: options?.ascending ?? true });
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.insertRows = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.upsertRows = Array.isArray(values) ? values : [values];
    this.upsertConflict = options?.onConflict ?? 'id';
    return this;
  }

  update(values: Record<string, unknown>) {
    this.updateValues = values;
    return this;
  }

  delete() {
    this.deleting = true;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }

  then(resolve: (value: { data: unknown; error: null }) => void, reject?: (reason?: unknown) => void) {
    try {
      resolve(this.run());
    } catch (error) {
      reject?.(error);
    }
  }

  private run() {
    const db = loadDb();

    if (this.upsertRows) {
      const rows = db[this.table] as Row[];
      const changed: Row[] = [];

      this.upsertRows.forEach(values => {
        const existing = rows.find(row => (
          row as unknown as Record<string, unknown>
        )[this.upsertConflict] === values[this.upsertConflict]);

        if (existing) {
          Object.assign(existing, values);
          if ('updated_at' in existing) existing.updated_at = new Date().toISOString();
          changed.push(existing);
          this.notify(this.table, 'UPDATE', existing);
        } else {
          const inserted = this.createRow(values);
          rows.push(inserted);
          changed.push(inserted);
          this.notify(this.table, 'INSERT', inserted);
        }
      });

      saveDb(db);
      return this.format(changed, db);
    }

    if (this.insertRows) {
      const inserted = this.insertRows.map(values => this.createRow(values));
      const rows = db[this.table] as Row[];
      rows.push(...inserted);
      saveDb(db);
      inserted.forEach(row => this.notify(this.table, 'INSERT', row));
      return this.format(inserted, db);
    }

    if (this.updateValues) {
      const rows = db[this.table] as Row[];
      const updated: Row[] = [];
      rows.forEach(row => {
        if (!this.matches(row)) return;
        Object.assign(row, this.updateValues);
        if ('updated_at' in row) {
          row.updated_at = new Date().toISOString();
        }
        updated.push(row);
      });
      saveDb(db);
      updated.forEach(row => this.notify(this.table, 'UPDATE', row));
      return this.format(updated, db);
    }

    if (this.deleting) {
      const rows = db[this.table] as Row[];
      const deleted = rows.filter(row => this.matches(row));
      db[this.table] = rows.filter(row => !this.matches(row)) as never;

      if (this.table === 'restock_requests') {
        const deletedIds = new Set((deleted as RestockRequest[]).map(row => row.id));
        db.restock_request_items = db.restock_request_items.filter(item => !deletedIds.has(item.request_id));
      }

      saveDb(db);
      return this.format(deleted, db);
    }

    const selected = (db[this.table] as Row[]).filter(row => this.matches(row));
    this.orders.forEach(order => {
      selected.sort((a, b) => {
        const aValue = String((a as unknown as Record<string, unknown>)[order.field] ?? '');
        const bValue = String((b as unknown as Record<string, unknown>)[order.field] ?? '');
        return order.ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      });
    });

    return this.format(selected, db);
  }

  private createRow(values: Record<string, unknown>): Row {
    const createdAt = new Date().toISOString();
    const idPrefix = this.table.replace(/s$/, '');
    const base = { id: createId(idPrefix), created_at: createdAt, ...values };

    if (this.table === 'users') return { active: true, role: 'barpersonal', ...base } as AppUser;
    if (this.table === 'locations') return { active: true, sort_order: 0, ...base } as Location;
    if (this.table === 'products') return { active: true, sort_order: 0, ...base } as Product;
    if (this.table === 'restock_requests') return { updated_at: createdAt, status: 'mottagen', request_type: 'restock', priority: 'inom_20', ...base } as RestockRequest;
    if (this.table === 'push_subscriptions') return { active: true, updated_at: createdAt, ...base } as PushSubscriptionRow;
    if (this.table === 'native_push_tokens') return { active: true, updated_at: createdAt, ...base } as NativePushTokenRow;
    if (this.table === 'admin_chat_messages') return { user_id: null, target_role: 'all', message: '', ...base } as AdminChatMessage;
    if (this.table === 'kitchen_orders') return { status: 'ready', created_by: null, updated_at: createdAt, dismissed_at: null, ...base } as KitchenOrder;
    if (this.table === 'schedule_entries') return { day: '', position: '', start_time: '19:00', end_time: '02:00', active: true, required_count: 1, assigned_names: [], note: null, sort_order: 0, updated_at: createdAt, ...base } as ScheduleEntry;
    if (this.table === 'schedule_positions') return { active: true, sort_order: 0, ...base } as SchedulePosition;
    if (this.table === 'schedule_people') return { active: true, preferred_day: 'Fredag', available_start: '19:00', available_end: '02:00', note: null, sort_order: 0, updated_at: createdAt, ...base } as SchedulePerson;
    return base as RestockRequestItem;
  }

  private matches(row: Row) {
    return this.filters.every(filter => {
      const value = (row as unknown as Record<string, unknown>)[filter.field];
      if (filter.op === 'eq') return value === filter.value;
      if (filter.op === 'neq') return value !== filter.value;
      if (filter.op === 'not_is') return value !== filter.value;
      return Array.isArray(filter.value) && filter.value.includes(value);
    });
  }

  private format(rows: Row[], db: DemoDb) {
    let data: unknown = rows;
    if (this.table === 'restock_requests') {
      data = (rows as RestockRequest[]).map(row => withRelations(row, db));
    }
    if (this.table === 'admin_chat_messages') {
      data = (rows as AdminChatMessage[]).map(row => ({
        ...row,
        users: db.users.find(user => user.id === row.user_id) ?? null,
      }));
    }
    if (this.table === 'kitchen_orders') {
      data = (rows as KitchenOrder[]).map(row => ({
        ...row,
        users: db.users.find(user => user.id === row.created_by) ?? null,
      }));
    }

    if (this.wantsSingle || this.wantsMaybeSingle) {
      data = Array.isArray(data) ? data[0] ?? null : data;
    }

    return { data: clone(data), error: null };
  }
}

export function createDemoSupabaseClient() {
  const listeners: Listener[] = [];

  return {
    from(table: TableName) {
      return new DemoQuery(table, (changedTable, event, row) => {
        listeners
          .filter(listener => listener.table === changedTable && listener.event === event)
          .forEach(listener => listener.callback({ new: row }));
      });
    },
    channel() {
      return {
        on(_type: string, config: { event: 'INSERT' | 'UPDATE'; table: TableName }, callback: (payload: ChangePayload) => void) {
          listeners.push({ table: config.table, event: config.event, callback });
          return this;
        },
        subscribe() {
          return this;
        },
      };
    },
    removeChannel() {},
    functions: {
      async invoke() {
        return { data: null, error: null };
      },
    },
  };
}
