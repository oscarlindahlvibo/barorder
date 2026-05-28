import { useEffect, useState } from 'react';
import { ClipboardList, LogOut, MapPin, MessageSquare, PackagePlus, ShieldAlert } from 'lucide-react';
import { Location, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import { useUnreadChatCount } from '../lib/chatUnread';
import ChatPanel from './ChatPanel';
import Dashboard from './Dashboard';
import RequestForm from './RequestForm';
import StaffDashboard from './StaffDashboard';

type ServingTab = 'orders' | 'staff' | 'request' | 'chat';

export default function ServingManagerDashboard() {
  const { currentUser, currentLocation, setCurrentLocation, logout } = useApp();
  const [tab, setTab] = useState<ServingTab>('orders');
  const [locations, setLocations] = useState<Location[]>([]);
  const unreadChatCount = useUnreadChatCount(currentUser);

  useEffect(() => {
    supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }: { data: Location[] | null }) => setLocations(data || []));
  }, []);

  const tabs: { id: ServingTab; label: string; Icon: typeof ClipboardList; badge?: number }[] = [
    { id: 'orders', label: 'Ordrar', Icon: ClipboardList },
    { id: 'staff', label: 'Tillkalla', Icon: ShieldAlert },
    { id: 'request', label: 'Beställ', Icon: PackagePlus },
    { id: 'chat', label: 'Chatt', Icon: MessageSquare, badge: unreadChatCount },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10 safe-area-inset-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">Serveringsansvarig</h1>
            <p className="text-gray-400 text-xs">{currentUser?.name}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
          {tabs.map(({ id, label, Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`h-11 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                tab === id
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              <span className="relative">
                <Icon className="w-4 h-4" />
                {badge ? (
                  <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-bold">
                    {badge > 9 ? '9+' : badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'orders' && <Dashboard embedded />}
        {tab === 'staff' && <StaffDashboard embedded />}
        {tab === 'chat' && <ChatPanel embedded />}
        {tab === 'request' && (
          currentLocation ? (
            <RequestForm onBack={() => setCurrentLocation(null, 'serving-dashboard')} />
          ) : (
            <div className="p-4 space-y-3">
              {locations.map(location => (
                <button
                  key={location.id}
                  onClick={() => setCurrentLocation(location, 'serving-dashboard')}
                  className="w-full h-16 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/50 text-white text-lg font-semibold text-left px-5 transition-all flex items-center gap-3"
                >
                  <MapPin className="w-5 h-5 text-orange-500" />
                  {location.name}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
