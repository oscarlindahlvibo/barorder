import { useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { supabase, Location } from '../lib/supabase';
import { useApp } from '../lib/store';

export default function LocationSelect() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, setCurrentLocation } = useApp();

  useEffect(() => {
    supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }: { data: Location[] | null }) => {
        setLocations(data || []);
        setLoading(false);
      });
  }, []);

  function selectLocation(loc: Location) {
    setCurrentLocation(loc, 'request');
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="px-4 pt-8 pb-4">
        <p className="text-orange-400 text-sm font-medium">Inloggad som</p>
        <h2 className="text-white text-2xl font-bold">{currentUser?.name}</h2>
      </div>

      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-5 h-5 text-orange-500" />
          <h3 className="text-white text-xl font-semibold">Välj din plats</h3>
        </div>
        <p className="text-gray-400 text-sm">Vilken bar eller plats jobbar du på just nu?</p>
      </div>

      <div className="flex-1 px-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => selectLocation(loc)}
                className="w-full h-16 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-700 active:scale-98 border border-gray-700 hover:border-orange-500/50 text-white text-lg font-semibold text-left px-5 transition-all duration-150 flex items-center gap-3 group"
              >
                <MapPin className="w-5 h-5 text-gray-500 group-hover:text-orange-500 transition-colors" />
                {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
