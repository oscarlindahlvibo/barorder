import { useCallback, useEffect, useState } from 'react';
import { Minus, Plus, Send, ChevronLeft, Loader2, Check, AlertTriangle, Package, Trash2, Clock, Wrench, UserCheck, X } from 'lucide-react';
import { supabase, Product, CATEGORIES, RequestPriority, RequestType, RestockRequest } from '../lib/supabase';
import { useApp } from '../lib/store';
import { notifyRequestCreated } from '../lib/pushNotifications';

interface CartItem {
  product: Product;
  quantity: number;
}

type StaffCallType = Extract<RequestType, 'security_call' | 'it_support' | 'serving_manager'>;

const CATEGORY_ICONS: Record<string, string> = {
  'Öl': '🍺',
  'Cider': '🍏',
  'Vin': '🍷',
  'Sprit': '🥃',
  'Drinkmix': '🥤',
  'Alkoholfria drycker': '💧',
  'Is': '🧊',
  'Muggar': '🥤',
  'Servetter': '🧻',
  'Övrigt': '📦',
};

const REQUEST_TYPES: { id: RequestType; label: string; Icon: typeof Package }[] = [
  { id: 'restock', label: 'Påfyllning', Icon: Package },
  { id: 'crate_pickup', label: 'Tombackar', Icon: Package },
  { id: 'waste_pickup', label: 'Avfall', Icon: Trash2 },
];

const PRIORITIES: { id: Exclude<RequestPriority, 'normal'>; label: string; Icon?: typeof Clock }[] = [
  { id: 'kan_vanta', label: 'När tid finns' },
  { id: 'inom_20', label: 'Inom 20 min', Icon: Clock },
  { id: 'akut', label: 'Akut', Icon: AlertTriangle },
];

const SERVICE_COPY: Record<Exclude<RequestType, 'restock'>, { title: string; unit: string; note: string }> = {
  crate_pickup: {
    title: 'Tömning av tombackar',
    unit: 'hämtning',
    note: 'Hur många backar eller var de står?',
  },
  waste_pickup: {
    title: 'Tömning av avfall',
    unit: 'hämtning',
    note: 'Vilken typ av avfall eller var det står?',
  },
  security_call: {
    title: 'Tillkalla ordningsvakt',
    unit: 'tillkallning',
    note: 'Ordningsvakt behövs till platsen.',
  },
  it_support: {
    title: 'Tillkalla IT-support',
    unit: 'tillkallning',
    note: 'IT-support behövs till platsen.',
  },
  serving_manager: {
    title: 'Tillkalla serveringsansvarig',
    unit: 'tillkallning',
    note: 'Serveringsansvarig behövs till platsen.',
  },
};

const STAFF_CALL_TYPES: StaffCallType[] = [
  'security_call',
  'it_support',
  'serving_manager',
];

export default function RequestForm() {
  const { currentUser, currentLocation, setView } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [requestType, setRequestType] = useState<RequestType>('restock');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [priority, setPriority] = useState<Exclude<RequestPriority, 'normal'>>('inom_20');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingCall, setSendingCall] = useState<RequestType | null>(null);
  const [cancellingCall, setCancellingCall] = useState<RequestType | null>(null);
  const [activeStaffCalls, setActiveStaffCalls] = useState<RestockRequest[]>([]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }: { data: Product[] | null }) => setProducts(data || []));
  }, []);

  const loadActiveStaffCalls = useCallback(async () => {
    if (!currentLocation) return;

    const { data } = await supabase
      .from('restock_requests')
      .select('*')
      .eq('location_id', currentLocation.id)
      .in('request_type', STAFF_CALL_TYPES)
      .in('status', ['mottagen', 'pa_vag']) as { data: RestockRequest[] | null };

    setActiveStaffCalls(data || []);
  }, [currentLocation]);

  useEffect(() => {
    loadActiveStaffCalls();

    const channel = supabase
      .channel('bar-staff-calls')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restock_requests',
      }, () => {
        loadActiveStaffCalls();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restock_requests',
      }, () => {
        loadActiveStaffCalls();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentLocation, loadActiveStaffCalls]);

  useEffect(() => {
    const refreshWhenActive = () => {
      loadActiveStaffCalls();
    };

    const intervalId = window.setInterval(() => {
      loadActiveStaffCalls();
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
  }, [loadActiveStaffCalls]);

  const categoriesWithProducts = CATEGORIES.filter(cat =>
    products.some(p => p.category === cat)
  );

  const filteredProducts = products.filter(p => p.category === selectedCategory);

  function getCartQty(productId: string): number {
    return cart.find(i => i.product.id === productId)?.quantity ?? 0;
  }

  function adjust(product: Product, delta: number) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { product, quantity: delta }];
      }
      const newQty = existing.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.product.id !== product.id);
      return prev.map(i => i.product.id === product.id ? { ...i, quantity: newQty } : i);
    });
  }

  const totalItems = requestType === 'restock'
    ? cart.reduce((s, i) => s + i.quantity, 0)
    : serviceQuantity;
  const canSend = requestType === 'restock' ? cart.length > 0 : serviceQuantity > 0;
  const service = requestType === 'restock' ? null : SERVICE_COPY[requestType];
  const getStaffCall = (type: StaffCallType) =>
    activeStaffCalls.find(call => call.request_type === type);
  const isStaffCalled = (type: StaffCallType) =>
    getStaffCall(type)?.status === 'pa_vag';
  const isStaffWaiting = (type: StaffCallType) =>
    getStaffCall(type)?.status === 'mottagen';
  const hasActiveStaffCall = (type: StaffCallType) =>
    Boolean(getStaffCall(type));

  async function sendRequest() {
    if (!canSend || !currentUser || !currentLocation) return;
    setSending(true);

    const { data: req, error: reqErr } = await supabase
      .from('restock_requests')
      .insert({
        user_id: currentUser.id,
        location_id: currentLocation.id,
        request_type: requestType,
        priority,
        note: note.trim() || null,
        status: 'mottagen',
      })
      .select()
      .single();

    if (reqErr || !req) {
      setSending(false);
      return;
    }

    const items = requestType === 'restock'
      ? cart.map(item => ({
          request_id: req.id,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
        }))
      : [{
          request_id: req.id,
          product_id: null,
          product_name: service?.title ?? 'Serviceärende',
          quantity: serviceQuantity,
          unit: service?.unit ?? 'st',
        }];

    await supabase.from('restock_request_items').insert(items);
    await notifyRequestCreated(req.id);

    setSending(false);
    setSent(true);

    setTimeout(() => {
      setCart([]);
      setServiceQuantity(1);
      setNote('');
      setPriority('inom_20');
      setSent(false);
    }, 2000);
  }

  async function sendStaffCall(type: StaffCallType) {
    if (!currentUser || !currentLocation || sendingCall) return;
    setSendingCall(type);

    const call = SERVICE_COPY[type];
    const { data: req, error: reqErr } = await supabase
      .from('restock_requests')
      .insert({
        user_id: currentUser.id,
        location_id: currentLocation.id,
        request_type: type,
        priority: type === 'security_call' ? 'akut' : 'inom_20',
        note: null,
        status: 'mottagen',
      })
      .select()
      .single();

    if (reqErr || !req) {
      setSendingCall(null);
      return;
    }

    await supabase.from('restock_request_items').insert({
      request_id: req.id,
      product_id: null,
      product_name: call.title,
      quantity: 1,
      unit: call.unit,
    });
    await notifyRequestCreated(req.id);

    setSendingCall(null);
    await loadActiveStaffCalls();
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }

  async function cancelStaffCall(type: StaffCallType) {
    const activeCall = getStaffCall(type);
    if (!activeCall || cancellingCall) return;

    setCancellingCall(type);
    await supabase
      .from('restock_requests')
      .update({ status: 'kan_ej_levereras' })
      .eq('id', activeCall.id);
    await loadActiveStaffCalls();
    setCancellingCall(null);
  }

  function staffCallLabel(type: StaffCallType, defaultLabel: string) {
    if (isStaffCalled(type)) {
      if (type === 'security_call') return 'ORDNINGSVAKT TILLKALLAD';
      if (type === 'it_support') return 'IT TILLKALLAD';
      return 'SERVERINGSANSVARIG TILLKALLAD';
    }
    if (isStaffWaiting(type)) return 'VÄNTAR PÅ BEKRÄFTELSE';
    return defaultLabel;
  }

  function staffCallClasses(type: StaffCallType, variant: 'primary' | 'secondary') {
    if (isStaffCalled(type)) {
      return variant === 'primary'
        ? 'bg-green-600 hover:bg-green-500 border-green-400 text-white shadow-green-950/30'
        : 'bg-green-600/20 border-green-500/50 text-green-300';
    }
    if (isStaffWaiting(type)) {
      return variant === 'primary'
        ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-gray-950 shadow-amber-950/20'
        : 'bg-amber-500/15 border-amber-500/50 text-amber-300';
    }
    return variant === 'primary'
      ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-red-950/30'
      : 'bg-gray-900 hover:bg-gray-800 border-gray-700 text-gray-300';
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-white text-2xl font-bold">Beställning skickad!</h2>
        <p className="text-gray-400 text-center">Lagerteamet har fått din beställning.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 safe-area-inset-top">
        <button
          onClick={() => setView('location-select')}
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-lg leading-tight">Skicka ärende</h1>
          <p className="text-orange-400 text-sm">{currentLocation?.name}</p>
        </div>
        {canSend && (
          <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {requestType === 'restock' ? `${totalItems} valda` : 'Redo'}
          </div>
        )}
      </div>

      {/* Staff calls */}
      <div className="px-4 pt-4 space-y-2">
        <div className="space-y-2">
          <button
            onClick={() => sendStaffCall('security_call')}
            disabled={sendingCall !== null || hasActiveStaffCall('security_call')}
            className={`w-full h-14 rounded-xl border font-black tracking-wide flex items-center justify-center gap-2 shadow-lg disabled:opacity-90 ${staffCallClasses('security_call', 'primary')}`}
          >
            {sendingCall === 'security_call' ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
            {staffCallLabel('security_call', 'TILLKALLA ORDNINGSVAKT')}
          </button>
          {hasActiveStaffCall('security_call') && (
            <button
              onClick={() => cancelStaffCall('security_call')}
              disabled={cancellingCall !== null}
              className="w-full h-9 rounded-lg bg-gray-900 hover:bg-gray-800 border border-red-500/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {cancellingCall === 'security_call' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Återkalla ordningsvakt
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            { type: 'serving_manager' as StaffCallType, label: 'Tillkalla serveringsansvarig', Icon: UserCheck },
            { type: 'it_support' as StaffCallType, label: 'Tillkalla IT-support', Icon: Wrench },
          ]).map(({ type, label, Icon }) => (
            <div key={type} className="space-y-1">
              <button
                onClick={() => sendStaffCall(type)}
                disabled={sendingCall !== null || hasActiveStaffCall(type)}
                className={`w-full min-h-12 rounded-lg border px-2 py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-90 ${staffCallClasses(type, 'secondary')}`}
              >
                {sendingCall === type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4 flex-shrink-0" />}
                <span className="leading-tight">{staffCallLabel(type, label)}</span>
              </button>
              {hasActiveStaffCall(type) && (
                <button
                  onClick={() => cancelStaffCall(type)}
                  disabled={cancellingCall !== null}
                  className="w-full h-8 rounded-lg bg-gray-900 hover:bg-gray-800 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {cancellingCall === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Återkalla
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Request type */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {REQUEST_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setRequestType(id)}
              className={`h-12 rounded-xl font-semibold text-sm border transition-all flex items-center justify-center gap-1.5 ${
                requestType === id
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="px-4 pt-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {PRIORITIES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPriority(id)}
              className={`h-12 rounded-xl font-semibold text-xs border transition-all flex items-center justify-center gap-1.5 ${
                priority === id
                  ? id === 'akut'
                    ? 'bg-red-500/30 border-red-500 text-red-300'
                    : id === 'inom_20'
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-gray-600 border-gray-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {requestType === 'restock' ? (
        <>
          {/* Category tabs */}
          <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {categoriesWithProducts.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex-shrink-0 px-4 h-10 rounded-full text-sm font-medium border transition-all ${
                    selectedCategory === cat
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="flex-1 px-4 pb-4 overflow-y-auto">
            <div className="space-y-2">
              {filteredProducts.map(product => {
                const qty = getCartQty(product.id);
                return (
                  <div
                    key={product.id}
                    className={`rounded-xl border p-3 transition-all ${
                      qty > 0
                        ? 'bg-orange-500/10 border-orange-500/40'
                        : 'bg-gray-900 border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{product.name}</p>
                        <p className="text-gray-500 text-xs">{product.unit}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => adjust(product, -1)}
                          disabled={qty === 0}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all active:scale-95 ${
                            qty > 0
                              ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                              : 'bg-gray-900 border-gray-800 text-gray-700'
                          }`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className={`w-8 text-center font-bold text-lg ${qty > 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                          {qty}
                        </span>
                        <button
                          onClick={() => adjust(product, 1)}
                          className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-500 hover:bg-orange-400 active:bg-orange-600 active:scale-95 border border-orange-500 text-white transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 px-4 pb-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-white font-semibold">{service?.title}</p>
            <p className="text-gray-500 text-sm mt-1">{service?.note}</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-gray-400 text-sm">Antal</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setServiceQuantity(q => Math.max(1, q - 1))}
                  className="w-11 h-11 rounded-lg flex items-center justify-center bg-gray-800 border border-gray-700 text-white active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-bold text-xl text-orange-400">{serviceQuantity}</span>
                <button
                  onClick={() => setServiceQuantity(q => q + 1)}
                  className="w-11 h-11 rounded-lg flex items-center justify-center bg-orange-500 border border-orange-500 text-white active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart summary + note + send */}
      {canSend && (
        <div className="bg-gray-900 border-t border-gray-800 p-4 pb-safe-panel space-y-3">
          {/* Selected items summary */}
          <div className="space-y-1">
            {requestType === 'restock' ? cart.map(item => (
              <div key={item.product.id} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-300 truncate">{item.product.name}</span>
                <span className="text-orange-400 font-medium flex-shrink-0">{item.quantity} {item.product.unit}</span>
              </div>
            )) : (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-300 truncate">{service?.title}</span>
                <span className="text-orange-400 font-medium flex-shrink-0">{serviceQuantity} {service?.unit}</span>
              </div>
            )}
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anteckning (valfritt)..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500"
          />

          <button
            onClick={sendRequest}
            disabled={sending}
            className={`w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-98 ${
              priority === 'akut'
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
            } disabled:opacity-50`}
          >
            {sending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Skicka ärende
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
