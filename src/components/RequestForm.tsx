import { useEffect, useState } from 'react';
import { Minus, Plus, Send, ChevronLeft, Loader2, Check, AlertTriangle, Package, Trash2, Clock } from 'lucide-react';
import { supabase, Product, CATEGORIES, RequestPriority, RequestType } from '../lib/supabase';
import { useApp } from '../lib/store';

interface CartItem {
  product: Product;
  quantity: number;
}

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
};

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
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }: { data: Product[] | null }) => setProducts(data || []));
  }, []);

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
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
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
        <div className="bg-gray-900 border-t border-gray-800 p-4 pb-24 space-y-3">
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
