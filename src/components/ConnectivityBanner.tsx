import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';

export default function ConnectivityBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [dismissed, setDismissed] = useState(false);
  const [reloadBlocked, setReloadBlocked] = useState(false);

  useEffect(() => {
    function handleOffline() {
      setOffline(true);
      setDismissed(false);
      setReloadBlocked(false);
    }

    function handleOnline() {
      setOffline(false);
      setDismissed(false);
      setReloadBlocked(false);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!offline || dismissed) return null;

  function reloadWhenOnline() {
    if (!navigator.onLine) {
      setReloadBlocked(true);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="fixed inset-x-3 top-safe-toast z-50 rounded-xl border border-red-500/40 bg-red-950/95 shadow-2xl shadow-red-950/30 backdrop-blur">
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
          <WifiOff className="w-5 h-5 text-red-200" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold">Ingen uppkoppling</p>
          <p className="text-red-100/80 text-sm leading-snug">
            Appen försöker behålla aktuell vy, men nya order och statusändringar kan inte hämtas förrän internet är tillbaka.
          </p>
          {reloadBlocked && (
            <p className="mt-2 text-red-100 text-sm font-semibold">
              Vänta tills internet är tillbaka innan du laddar om.
            </p>
          )}
          <button
            onClick={reloadWhenOnline}
            className="mt-3 h-10 px-3 rounded-lg bg-white/70 text-red-950 font-semibold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Försök ladda om
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-9 h-9 rounded-lg text-red-100/70 hover:text-white hover:bg-red-500/20 flex items-center justify-center flex-shrink-0"
          aria-label="Stäng varning"
          title="Stäng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
