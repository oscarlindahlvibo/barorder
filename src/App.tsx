import { AppProvider, useApp } from './lib/store';
import PinLogin from './components/PinLogin';
import LocationSelect from './components/LocationSelect';
import RequestForm from './components/RequestForm';
import Dashboard from './components/Dashboard';
import StaffDashboard from './components/StaffDashboard';
import History from './components/History';
import AdminPanel from './components/AdminPanel';
import BarNav from './components/BarNav';
import ChatPanel from './components/ChatPanel';

function AppContent() {
  const { view, currentUser } = useApp();

  const isBarStaff = currentUser?.role === 'barpersonal';
  const showBarNav = isBarStaff && (view === 'request' || view === 'chat' || view === 'history');

  return (
    <div className="min-h-screen bg-gray-950">
      {view === 'login' && <PinLogin />}
      {view === 'location-select' && <LocationSelect />}
      {view === 'request' && (
        <div className={showBarNav ? 'pb-safe-nav' : ''}>
          <RequestForm />
        </div>
      )}
      {view === 'dashboard' && <Dashboard />}
      {view === 'staff-dashboard' && <StaffDashboard />}
      {view === 'chat' && (
        <div className={showBarNav ? 'pb-safe-nav' : ''}>
          <ChatPanel />
        </div>
      )}
      {view === 'history' && (
        <div className={showBarNav ? 'pb-safe-nav' : ''}>
          <History />
        </div>
      )}
      {view === 'admin' && <AdminPanel />}
      {showBarNav && <BarNav />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
