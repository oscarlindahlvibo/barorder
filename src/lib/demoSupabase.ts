import type { AdminChatMessage, AppUser, Location, Product, RestockRequest, RestockRequestItem } from './supabase';

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

type TableName = 'users' | 'locations' | 'products' | 'restock_requests' | 'restock_request_items' | 'push_subscriptions' | 'admin_chat_messages';
type Row = AppUser | Location | Product | RestockRequest | RestockRequestItem | PushSubscriptionRow | AdminChatMessage;
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
  admin_chat_messages: AdminChatMessage[];
}

const now = new Date().toISOString();

const seedDb: DemoDb = {
  users: [
    { id: 'user-admin', name: 'Admin', pin: '0000', role: 'admin', active: true, created_at: now },
    { id: 'user-bar', name: 'Barpersonal', pin: '1234', role: 'barpersonal', active: true, created_at: now },
    { id: 'user-personal', name: 'Personalansvarig', pin: '5555', role: 'personal', active: true, created_at: now },
    { id: 'user-serving', name: 'Serveringsansvarig', pin: '4444', role: 'serveringsansvarig', active: true, created_at: now },
    { id: 'user-lager', name: 'Lager', pin: '6789', role: 'lager', active: true, created_at: now },
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
  admin_chat_messages: [],
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
  if (!db.users.some(user => user.pin === '5555')) {
    db.users.push({ id: 'user-personal', name: 'Personalansvarig', pin: '5555', role: 'personal', active: true, created_at: now });
    saveDb(db);
  }
  if (!db.users.some(user => user.pin === '4444')) {
    db.users.push({ id: 'user-serving', name: 'Serveringsansvarig', pin: '4444', role: 'serveringsansvarig', active: true, created_at: now });
    saveDb(db);
  }
  if (!db.push_subscriptions) {
    db.push_subscriptions = [];
    saveDb(db);
  }
  if (!db.admin_chat_messages) {
    db.admin_chat_messages = [];
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
    if (this.table === 'admin_chat_messages') return { user_id: null, target_role: 'all', message: '', ...base } as AdminChatMessage;
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
