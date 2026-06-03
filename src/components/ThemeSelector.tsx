import { Monitor, Moon, Sun } from 'lucide-react';
import { ThemeMode, useApp } from '../lib/store';

const OPTIONS: { id: ThemeMode; label: string; Icon: typeof Monitor }[] = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'dark', label: 'Mörkt', Icon: Moon },
  { id: 'light', label: 'Ljust', Icon: Sun },
];

export default function ThemeSelector() {
  const { themeMode, setThemeMode } = useApp();

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setThemeMode(id)}
          className={`h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            themeMode === id
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          aria-pressed={themeMode === id}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
