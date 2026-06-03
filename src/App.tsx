import { AppProvider, useApp } from './lib/store';
import PinLogin from './components/PinLogin';
import RoleSelect from './components/RoleSelect';
import LocationSelect from './components/LocationSelect';
import RequestForm from './components/RequestForm';
import Dashboard from './components/Dashboard';
import StaffDashboard from './components/StaffDashboard';
import ServingManagerDashboard from './components/ServingManagerDashboard';
import KitchenDashboard from './components/KitchenDashboard';
import KitchenDisplay from './components/KitchenDisplay';
import ScheduleDisplay from './components/ScheduleDisplay';
import ExhibitionDisplay from './components/ExhibitionDisplay';
import History from './components/History';
import AdminPanel from './components/AdminPanel';
import BarNav from './components/BarNav';
import ChatPanel from './components/ChatPanel';
import ConnectivityBanner from './components/ConnectivityBanner';
import AppErrorBoundary from './components/AppErrorBoundary';
import NativePushBootstrap from './components/NativePushBootstrap';

function AppContent() {
  const { view, currentUser } = useApp();

  const isBarStaff = currentUser?.role === 'barpersonal';
  const showBarNav = isBarStaff && (view === 'request' || view === 'chat' || view === 'history');

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-gray-950">
        <ConnectivityBanner />
        <NativePushBootstrap user={currentUser} />
        {view === 'login' && <PinLogin />}
        {view === 'role-select' && <RoleSelect />}
        {view === 'location-select' && <LocationSelect />}
        {view === 'request' && (
          <div className={showBarNav ? 'pb-safe-nav' : ''}>
            <RequestForm />
          </div>
        )}
        {view === 'dashboard' && <Dashboard />}
        {view === 'staff-dashboard' && <StaffDashboard />}
        {view === 'serving-dashboard' && <ServingManagerDashboard />}
        {view === 'kitchen-dashboard' && <KitchenDashboard />}
        {view === 'kitchen-display' && <KitchenDisplay />}
        {view === 'schedule-display' && <ScheduleDisplay />}
        {view === 'exhibition-display' && <ExhibitionDisplay />}
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
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
