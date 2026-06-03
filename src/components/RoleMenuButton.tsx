import { Grid3X3 } from 'lucide-react';
import { getUserRoles } from '../lib/auth';
import { useApp } from '../lib/store';

interface RoleMenuButtonProps {
  variant?: 'top' | 'bottom';
}

export default function RoleMenuButton({ variant = 'top' }: RoleMenuButtonProps) {
  const { currentUser, setView, view } = useApp();
  const roles = currentUser ? getUserRoles(currentUser) : [];

  if (!currentUser || roles.length < 2 || view === 'login' || view === 'role-select') {
    return null;
  }

  if (variant === 'bottom') {
    return (
      <button
        onClick={() => setView('role-select')}
        className="flex-1 min-h-16 flex flex-col items-center justify-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Tillbaka till rollmenyn"
        title="Tillbaka till rollmenyn"
      >
        <Grid3X3 className="w-6 h-6" />
        <span className="text-xs font-medium">Roller</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setView('role-select')}
      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      aria-label="Tillbaka till rollmenyn"
      title="Tillbaka till rollmenyn"
    >
      <Grid3X3 className="w-5 h-5" />
    </button>
  );
}
