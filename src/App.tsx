import { useState, useEffect } from 'react';
import { LayoutDashboard, Sprout, Compass, HelpCircle, User as UserIcon, Settings, Menu, X, Activity, FileText, MessageSquare, Bell, Wifi, Plus } from 'lucide-react';
import { User, Farm } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SoilAnalysis from './components/SoilAnalysis';
import DiseaseDetection from './components/DiseaseDetection';
import YieldCalculator from './components/YieldCalculator';
import FarmManagement from './components/FarmManagement';
import Profile from './components/Profile';
import Reports from './components/Reports';
import AssistantChat from './components/AssistantChat';
import IoTDashboard from './components/IoTDashboard';
import NotificationCenter from './components/NotificationCenter';
import DataEntry from './components/DataEntry';
import { fetch } from './utils/api';

type Tab = 'dashboard' | 'iot' | 'soil' | 'disease' | 'yield' | 'farms' | 'reports' | 'chat' | 'profile' | 'notifications' | 'data-entry';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarm, setActiveFarm] = useState<Farm | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Attempt to restore user from localStorage on load to make user experience fantastic
  useEffect(() => {
    const storedUser = localStorage.getItem('twin_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
    }

    const handleAuthError = () => {
      setUser(null);
      localStorage.removeItem('twin_user');
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, []);

  // Fetch data when user logs in
  useEffect(() => {
    if (user) {
      fetchFarms(user.id);
      fetchNotifications(user.id);
    } else {
      setFarms([]);
      setActiveFarm(null);
      setNotifications([]);
    }
  }, [user]);

  const fetchNotifications = async (userId: string) => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFarms = async (userId: string) => {
    try {
      const response = await fetch(`/api/farms?userId=${userId}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setFarms(data.farms);
        if (data.farms.length > 0) {
          // If we had an active farm, find the updated version in the new array.
          // Otherwise, select the first farm in the list.
          const currentActive = activeFarm ? data.farms.find((f: any) => f.id === activeFarm.id) : null;
          setActiveFarm(currentActive || data.farms[0]);
        } else {
          setActiveFarm(null);
        }
      }
    } catch (error) {
      console.error("Error fetching farms:", error);
    }
  };

  // Add a new farm
  const handleAddFarm = async (name: string, area: number, cropType: string, location: string) => {
    if (!user) return;
    const response = await fetch('/api/farms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name, area, cropType, location }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      await fetchFarms(user.id);
      await fetchNotifications(user.id);
    } else {
      throw new Error(data.message || 'Failed to add farm');
    }
  };

  // Edit a farm
  const handleEditFarm = async (farmId: string, name: string, area: number, cropType: string, location: string) => {
    if (!user) return;
    const response = await fetch(`/api/farms/${farmId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, area, cropType, location }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      // Create a temporary active farm version to avoid flickering while fetching
      if (activeFarm?.id === farmId) {
        setActiveFarm(prev => prev ? { ...prev, name, area, cropType, location } : null);
      }
      await fetchFarms(user.id);
      await fetchNotifications(user.id);
    } else {
      throw new Error(data.message || 'Failed to update farm');
    }
  };

  // Delete a farm
  const handleDeleteFarm = async (farmId: string) => {
    if (!user) return;
    const response = await fetch(`/api/farms/${farmId}`, {
      method: 'DELETE',
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      if (activeFarm?.id === farmId) {
        setActiveFarm(null);
      }
      await fetchFarms(user.id);
      await fetchNotifications(user.id);
    } else {
      throw new Error(data.message || 'Failed to delete farm');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('twin_user');
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => { setUser(u); localStorage.setItem('twin_user', JSON.stringify(u)); }} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'iot', label: 'IoT Sensors', icon: Wifi },
    { id: 'soil', label: 'Soil Analysis', icon: Compass },
    { id: 'disease', label: 'Leaf Diagnostics', icon: Sprout },
    { id: 'yield', label: 'Yield Projection', icon: Activity },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
    { id: 'farms', label: 'Field Config', icon: Settings },
    { id: 'data-entry', label: 'Add Records', icon: Plus },
    { id: 'profile', label: 'My Account', icon: UserIcon },
  ];

  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  return (
    <div id="app-root" className="min-h-screen bg-[#0B0410] text-white flex flex-col md:flex-row font-sans selection:bg-[#D946EF]/30">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-64 bg-[#130722] border-r border-white/5 flex-col shadow-2xl relative z-10">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#D946EF] to-[#9333EA] tracking-tight">
            Smart Ag
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-[#9333EA] mt-1 font-semibold opacity-80">Digital Twin Platform</p>
        </div>

        {/* Navigation lists */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`w-full h-11 flex items-center gap-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D946EF] to-[#9333EA] text-white shadow-lg shadow-[#9333EA]/20'
                    : 'text-[#A78BFA] hover:text-white hover:bg-white/5 hover:translate-x-1'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[#A78BFA]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        
        {/* User preview */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D946EF] to-[#9333EA] flex items-center justify-center shrink-0">
               <UserIcon className="h-4 w-4 text-white" />
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[#A78BFA] truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0410] relative">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-[#9333EA]/10 blur-[120px] pointer-events-none rounded-full transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D946EF]/5 blur-[150px] pointer-events-none rounded-full transform translate-y-1/4"></div>

        {/* Top Header */}
        <header className="h-16 bg-[#130722]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 lg:px-8 z-20 relative sticky top-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-[#A78BFA] hover:text-white transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-white tracking-wide">
              {navItems.find(i => i.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Active Field summary */}
            {activeFarm && (
              <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-[#D946EF] bg-[#D946EF]/10 border border-[#D946EF]/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.15)]">
                <span className="w-1.5 h-1.5 bg-[#D946EF] rounded-full animate-ping"></span>
                <span className="font-semibold tracking-wide">{activeFarm.name}</span>
              </div>
            )}
            
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => { setActiveTab('notifications'); setMobileMenuOpen(false); }} 
                className={`p-2 transition-colors relative bg-white/5 rounded-full border ${activeTab === 'notifications' ? 'text-white border-white/20 bg-white/10' : 'text-[#A78BFA] hover:text-white border-white/5 hover:border-white/10'}`}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#D946EF] rounded-full border-2 border-[#130722]"></span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile slide-down drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-[#0B0410]/80 backdrop-blur-xl">
            <div className="w-64 h-full bg-[#130722] border-r border-white/10 shadow-2xl flex flex-col">
              <div className="p-4 flex justify-between items-center border-b border-white/10">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#D946EF] to-[#9333EA]">Smart Ag</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-[#A78BFA] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as Tab);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full h-11 flex items-center gap-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                        isActive ? 'bg-gradient-to-r from-[#D946EF] to-[#9333EA] text-white shadow-lg shadow-[#9333EA]/20' : 'text-[#A78BFA] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Dynamic Content Area */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto relative z-10 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <Dashboard 
              user={user}
              farms={farms} 
              activeFarm={activeFarm} 
              onSelectFarm={(f) => setActiveFarm(f)} 
              onRefreshFarmData={() => fetchFarms(user.id)}
              onNavigate={(tab: string) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'iot' && (
            <IoTDashboard
              user={user}
              farms={farms}
              activeFarm={activeFarm}
              onRefreshFarms={() => fetchFarms(user.id)}
            />
          )}

          {activeTab === 'soil' && (
            <SoilAnalysis
              user={user}
              farms={farms}
              activeFarm={activeFarm}
            />
          )}

          {activeTab === 'disease' && (
            <DiseaseDetection
              user={user}
              farms={farms}
              activeFarm={activeFarm}
            />
          )}

          {activeTab === 'yield' && (
            <YieldCalculator
              user={user}
              farms={farms}
              activeFarm={activeFarm}
            />
          )}
          
          {activeTab === 'reports' && (
            <Reports
              user={user}
              farms={farms}
            />
          )}
          
          {activeTab === 'chat' && (
            <AssistantChat user={user} />
          )}

          {activeTab === 'farms' && (
            <FarmManagement
              user={user}
              farms={farms}
              onAddFarm={handleAddFarm}
              onEditFarm={handleEditFarm}
              onDeleteFarm={handleDeleteFarm}
            />
          )}

          {activeTab === 'profile' && (
            <Profile 
              user={user}
              farms={farms}
              onLogout={handleLogout}
              onUpdateUser={(updatedUser) => {
                setUser(updatedUser);
                localStorage.setItem('twin_user', JSON.stringify(updatedUser));
              }}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationCenter 
              user={user}
              farms={farms}
              activeFarm={activeFarm}
            />
          )}

          {activeTab === 'data-entry' && (
            <DataEntry 
              user={user}
              farms={farms}
              onRefreshFarms={async () => { await fetchFarms(user.id); }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
