import { ShoppingCart, MessageSquare, History, LogOut } from 'lucide-react';
import { useApp } from '../lib/store';

export default function BarNav() {
  const { view, setView, logout } = useApp();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-20 safe-area-inset-bottom">
      <button
        onClick={() => setView('request')}
        className={`flex-1 min-h-16 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          view === 'request' ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <ShoppingCart className="w-6 h-6" />
        <span className="text-xs font-medium">Beställ</span>
      </button>
      <button
        onClick={() => setView('chat')}
        className={`flex-1 min-h-16 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          view === 'chat' ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <MessageSquare className="w-6 h-6" />
        <span className="text-xs font-medium">Chatt</span>
      </button>
      <button
        onClick={() => setView('history')}
        className={`flex-1 min-h-16 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          view === 'history' ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <History className="w-6 h-6" />
        <span className="text-xs font-medium">Historik</span>
      </button>
      <button
        onClick={logout}
        className="flex-1 min-h-16 flex flex-col items-center justify-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <LogOut className="w-6 h-6" />
        <span className="text-xs font-medium">Logga ut</span>
      </button>
    </div>
  );
}
