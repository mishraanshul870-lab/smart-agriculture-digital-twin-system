import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, AlertTriangle, CheckCircle2, Info, Search, Filter, Trash2, 
  Archive, CheckCircle, Download, FileText, Loader2, RefreshCw,
  TrendingUp, ShieldAlert, CloudLightning, Sprout, Droplets, MapPin,
  Calendar, BarChart2, Zap, Sparkles, Clock, ShieldCheck, ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { User, Farm } from '../types';
import { fetch } from '../utils/api';

interface NotificationCenterProps {
  user: User;
  farms: Farm[];
  activeFarm: Farm | null;
}

type Priority = 'high' | 'medium' | 'low';
type Category = 
  | 'disease' 
  | 'soil' 
  | 'weather' 
  | 'market' 
  | 'government' 
  | 'iot' 
  | 'irrigation' 
  | 'security' 
  | 'ai_recommendation';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: Category;
  priority: Priority;
  isRead: boolean;
  timestamp: string;
  farmId?: string;
  isArchived: boolean;
}

const CATEGORIES: { id: Category; label: string; icon: any; color: string; bg: string; border: string }[] = [
  { id: 'disease', label: 'Disease Alerts', icon: Sprout, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  { id: 'soil', label: 'Soil Alerts', icon: MapPin, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { id: 'weather', label: 'Weather Alerts', icon: CloudLightning, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'market', label: 'Market Prices', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { id: 'government', label: 'Gov Schemes', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { id: 'iot', label: 'IoT Devices', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { id: 'irrigation', label: 'Irrigation', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-600/10', border: 'border-blue-600/20' },
  { id: 'security', label: 'Security', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { id: 'ai_recommendation', label: 'AI Insights', icon: Sparkles, color: 'text-[#D946EF]', bg: 'bg-[#D946EF]/10', border: 'border-[#D946EF]/20' }
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  { 
    id: 'n1', 
    title: 'Critical Soil Moisture Drop', 
    message: 'Zone 3 moisture level dropped below 20%. Immediate automatic irrigation cycle recommended.', 
    category: 'irrigation', 
    priority: 'high', 
    isRead: false, 
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n2', 
    title: 'Blight Risk Warning', 
    message: 'Climatic patterns indicate optimal humidity for Late Blight development. Preventative spraying advised.', 
    category: 'disease', 
    priority: 'high', 
    isRead: false, 
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n3', 
    title: 'Organic Soybeans Market Surge', 
    message: 'Wholesale Soybean prices increased by 14.5% across national commodity exchanges. Inventory liquidation favorable.', 
    category: 'market', 
    priority: 'medium', 
    isRead: true, 
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n4', 
    title: 'IoT Gateway Offline', 
    message: 'Primary soil sensor gateway (GT-992) lost ping telemetry. Re-establishing secure handshake protocol.', 
    category: 'iot', 
    priority: 'high', 
    isRead: false, 
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n5', 
    title: 'Solar Pump Subsidies Launched', 
    message: 'Ministry of Agriculture opens PM-KUSUM applications. Secure up to 60% reimbursement on off-grid systems.', 
    category: 'government', 
    priority: 'low', 
    isRead: true, 
    timestamp: new Date(Date.now() - 1000 * 60 * 1440).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n6', 
    title: 'Heavy Storm Forecast', 
    message: 'Adverse weather warning: High winds (>45 km/h) and hail expected. Secure greenhouse structural curtains.', 
    category: 'weather', 
    priority: 'high', 
    isRead: true, 
    timestamp: new Date(Date.now() - 1000 * 60 * 1800).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n7', 
    title: 'Perimeter Intrusion Detected', 
    message: 'Motion trigger alert: Unscheduled access registered at secondary equipment barn door.', 
    category: 'security', 
    priority: 'medium', 
    isRead: false, 
    timestamp: new Date(Date.now() - 1000 * 60 * 2880).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n8', 
    title: 'AI Harvesting Windows', 
    message: 'Yield model estimates that postponing Wheat Sector B harvesting by 4 days optimizes moisture grain density by 4.2%.', 
    category: 'ai_recommendation', 
    priority: 'medium', 
    isRead: false, 
    timestamp: new Date(Date.now() - 1000 * 60 * 4320).toISOString(), 
    isArchived: false 
  },
  { 
    id: 'n9', 
    title: 'Soil Acidification Warning', 
    message: 'Chemical sensors reported pH level of 5.3 in Orchard sector. Neutralizing lime application required.', 
    category: 'soil', 
    priority: 'medium', 
    isRead: true, 
    timestamp: new Date(Date.now() - 1000 * 60 * 5760).toISOString(), 
    isArchived: false 
  },
];

export default function NotificationCenter({ user, farms, activeFarm }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  
  // Filtering & Selected states
  const [activeTab, setActiveTab] = useState<'overview' | 'all' | 'unread' | 'timeline' | 'archived' | 'analytics'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedCategory, selectedPriority]);

  // Fetch real notifications from database
  const fetchRealNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        if (data.notifications && data.notifications.length > 0) {
          const normalized = data.notifications.map((n: any) => ({
            id: n._id || n.id,
            title: n.title,
            message: n.message,
            category: n.category || 'ai_recommendation',
            priority: n.priority || 'medium',
            isRead: !!n.isRead,
            timestamp: n.createdAt || n.timestamp,
            isArchived: !!n.isArchived
          }));
          setNotifications(normalized);
          setDemoMode(false);
        } else {
          // Empty DB. Let's seed with default notifications.
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(INITIAL_NOTIFICATIONS)
          });
          // Re-fetch now that we seeded
          const seedRes = await fetch('/api/notifications');
          const seedData = await seedRes.json();
          if (seedData.success && seedData.notifications) {
            const normalized = seedData.notifications.map((n: any) => ({
              id: n._id || n.id,
              title: n.title,
              message: n.message,
              category: n.category || 'ai_recommendation',
              priority: n.priority || 'medium',
              isRead: !!n.isRead,
              timestamp: n.createdAt || n.timestamp,
              isArchived: !!n.isArchived
            }));
            setNotifications(normalized);
          } else {
            setNotifications(INITIAL_NOTIFICATIONS);
          }
          setDemoMode(false);
        }
      } else {
        setNotifications(INITIAL_NOTIFICATIONS);
        setDemoMode(true);
      }
    } catch (e) {
      console.warn("Using offline mode for notifications:", e);
      setNotifications(INITIAL_NOTIFICATIONS);
      setDemoMode(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealNotifications();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        if (activeTab === 'unread') return !n.isRead && !n.isArchived;
        if (activeTab === 'archived') return n.isArchived;
        if (activeTab === 'overview' || activeTab === 'timeline') return !n.isArchived;
        return !n.isArchived; // 'all' shows non-archived
      })
      .filter(n => selectedCategory === 'all' || n.category === selectedCategory)
      .filter(n => selectedPriority === 'all' || n.priority === selectedPriority)
      .filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, activeTab, searchQuery, selectedCategory, selectedPriority]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead && !n.isArchived).length;
  }, [notifications]);

  const highPriorityCount = useMemo(() => {
    return notifications.filter(n => n.priority === 'high' && !n.isRead && !n.isArchived).length;
  }, [notifications]);

  const paginatedNotifications = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredNotifications.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredNotifications, currentPage]);

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);

  const handleToggleRead = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target) return;
    
    // Optimistic update
    const newIsRead = !target.isRead;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: newIsRead } : n));
    showToast('Alert status updated', 'success');

    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: newIsRead })
      });
    } catch (err) {
      console.error("Failed to update read state in DB:", err);
    }
  };

  const handleToggleArchive = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target) return;
    
    // Optimistic update
    const newIsArchived = !target.isArchived;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isArchived: newIsArchived } : n));
    showToast(newIsArchived ? 'Alert archived successfully' : 'Alert restored to Inbox', 'info');

    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newIsArchived })
      });
    } catch (err) {
      console.error("Failed to update archive state in DB:", err);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast('Alert deleted', 'error');

    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error("Failed to delete notification in DB:", err);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    showToast('All notifications marked as read', 'success');

    if (unreadIds.length > 0) {
      try {
        await fetch('/api/notifications/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: unreadIds, action: 'read' })
        });
      } catch (err) {
        console.error("Failed to mark all read in DB:", err);
      }
    }
  };

  const handleBulkAction = async (action: 'read' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return;
    const selectedIdsArray = Array.from(selectedIds);
    
    setNotifications(prev => {
      if (action === 'delete') {
        return prev.filter(n => !selectedIds.has(n.id));
      }
      return prev.map(n => {
        if (selectedIds.has(n.id)) {
          if (action === 'read') return { ...n, isRead: true };
          if (action === 'archive') return { ...n, isArchived: true };
        }
        return n;
      });
    });
    
    setSelectedIds(new Set());
    showToast(`Successfully processed bulk action for ${selectedIdsArray.length} alerts`, 'success');

    try {
      await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIdsArray, action })
      });
    } catch (err) {
      console.error("Failed to process bulk action in DB:", err);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPriorityColor = (p: Priority) => {
    if (p === 'high') return 'text-rose-400 bg-rose-400/10 border-rose-500/20';
    if (p === 'medium') return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
  };

  const getCategoryDetails = (c: Category) => {
    return CATEGORIES.find(cat => cat.id === c) || CATEGORIES[0];
  };

  // Recharts Data preparation
  const volumeData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      name: day,
      Critical: Math.floor(Math.random() * 4) + 1,
      Warning: Math.floor(Math.random() * 8) + 3,
      Info: Math.floor(Math.random() * 12) + 6
    }));
  }, []);

  const distributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach(c => {
      counts[c.label] = 0;
    });
    notifications.forEach(n => {
      const label = getCategoryDetails(n.category).label;
      if (counts[label] !== undefined) counts[label]++;
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => {
        const cat = CATEGORIES.find(c => c.label === name);
        return {
          name,
          value,
          color: cat ? cat.color.replace('text-', '#').replace('rose-400', 'f43f5e').replace('amber-400', 'fbbf24').replace('blue-400', '60a5fa').replace('emerald-400', '34d399').replace('purple-400', 'a78bfa').replace('cyan-400', '22d3ee').replace('blue-500', '3b82f6').replace('red-500', 'ef4444').replace('[#D946EF]', 'd946ef') : '#9333EA'
        };
      });
  }, [notifications]);

  const handleExportCSV = () => {
    const headers = 'ID,Title,Message,Category,Priority,IsRead,Timestamp\n';
    const rows = notifications
      .map(n => `"${n.id}","${n.title}","${n.message}","${n.category}","${n.priority}",${n.isRead},"${n.timestamp}"`)
      .join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `smart_agriculture_alerts_${new Date().toISOString().slice(0,10)}.csv`);
    a.click();
    showToast('CSV report downloaded successfully', 'success');
  };

  const handleExportPDF = () => {
    // Elegant simulation of generating standard PDF document
    showToast('Compiling secure PDF telemetry document...', 'info');
    setTimeout(() => {
      const content = `SMART AGRICULTURE DIGITAL TWIN - ALERTS REPORT\nGenerated: ${new Date().toLocaleString()}\n\n` +
        notifications.map((n, i) => `${i+1}. [${n.priority.toUpperCase()}] ${n.title} - ${new Date(n.timestamp).toLocaleString()}\n   ${n.message}\n`).join('\n');
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `smart_agriculture_report_${new Date().toISOString().slice(0,10)}.pdf`);
      a.click();
      showToast('PDF compiled and downloaded successfully', 'success');
    }, 1200);
  };

  // Custom alert simulators for complete Demo Mode interactivity
  const simulateNotification = (type: Category) => {
    let title = '';
    let message = '';
    let priority: Priority = 'low';

    switch (type) {
      case 'disease':
        title = 'Wheat Rust Detected';
        message = 'AI Image scanner registered Puccinia graminis spores in Sector B. Isolated spraying advised.';
        priority = 'high';
        break;
      case 'soil':
        title = 'Nitrogen Deficit Alert';
        message = 'IoT Soil Spectrometer registered N-P-K depletion in Tomato greenhouse. Nitrogen top dressing required.';
        priority = 'medium';
        break;
      case 'weather':
        title = 'Sudden Heat Warning';
        message = 'Micro-climate sensors report rapid temperature rise to 39.5°C in high-tunnel greenhouses.';
        priority = 'high';
        break;
      case 'market':
        title = 'Grain Supply Spike';
        message = 'Heavy bumper harvests in neighboring states are putting downward pressure on spot Wheat pricing.';
        priority = 'low';
        break;
      case 'government':
        title = 'Organic Farming Incentives';
        message = 'State agriculture bureau announces direct income support schemes for bio-certified farmlands.';
        priority = 'low';
        break;
      case 'iot':
        title = 'Sensor Node Battery Critically Low';
        message = 'Battery level of Moisture Sensor #B14-Zone3 fell below 5%. Power cycle or cell swap recommended.';
        priority = 'medium';
        break;
      case 'irrigation':
        title = 'Water Valve Fault';
        message = 'Telemetry anomaly: Valve #3 remains closed despite irrigation system signal trigger.';
        priority = 'high';
        break;
      case 'security':
        title = 'Fence Boundary Anomaly';
        message = 'Infrared barrier alert: Laser grid interrupted along Sector C perimeter fencing.';
        priority = 'high';
        break;
      case 'ai_recommendation':
        title = 'Optimal Pest Spraying Window';
        message = 'Predictive models show high pest vulnerability over the next 48 hours. Wind conditions are optimal today.';
        priority = 'medium';
        break;
    }

    const newNotif: AppNotification = {
      id: 'n_sim_' + Math.random().toString(36).substr(2, 9),
      title,
      message,
      category: type,
      priority,
      isRead: false,
      timestamp: new Date().toISOString(),
      isArchived: false
    };

    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        message,
        category: type,
        priority
      })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
          fetchRealNotifications(true);
        } else {
          setNotifications(prev => [newNotif, ...prev]);
        }
      })
      .catch(err => {
        console.error("Failed to post simulated notification:", err);
        setNotifications(prev => [newNotif, ...prev]);
      });

    showToast(`New ${getCategoryDetails(type).label} simulated!`, 'success');
  };

  // Safe grouping by Date for Timeline view
  const timelineGroups = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    filteredNotifications.forEach(n => {
      const date = new Date(n.timestamp);
      const todayStr = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
      
      let key = date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
      if (date.toDateString() === todayStr) key = 'Today';
      else if (date.toDateString() === yesterdayStr) key = 'Yesterday';

      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return Object.entries(groups);
  }, [filteredNotifications]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 relative">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border backdrop-blur-xl ${
              toast.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 shadow-rose-900/40' : 
              toast.type === 'info' ? 'bg-blue-500/20 border-blue-500/50 text-blue-200 shadow-blue-900/40' :
              'bg-[#9333EA]/20 border-[#9333EA]/50 text-[#E9D5FF] shadow-purple-950/50'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : 
             toast.type === 'info' ? <Info className="h-5 w-5" /> :
             <CheckCircle2 className="h-5 w-5" />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-white tracking-tight">Notification Center</h2>
            <span className="px-2.5 py-1 bg-[#D946EF]/20 text-[#D946EF] border border-[#D946EF]/30 rounded-lg text-xs font-bold uppercase tracking-wider">
              Smart Agronomic Alerting
            </span>
          </div>
          <p className="text-[#E9D5FF] max-w-2xl">
            Real-time digital twin monitoring dashboard, featuring automated disease, soil, weather, IoT, and AI-driven agricultural notifications.
          </p>
        </div>
        
        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="h-10 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-2 text-white transition-colors text-sm font-bold">
              <Download className="h-4 w-4 text-[#D946EF]" /> Export Data
            </button>
            <div className="absolute right-0 top-full mt-2 w-36 bg-[#121024] border border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <button 
                onClick={handleExportCSV} 
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4 text-emerald-400" /> Export CSV
              </button>
              <button 
                onClick={handleExportPDF} 
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4 text-rose-400" /> Export PDF
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600); }}
            className="h-10 w-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center text-[#E9D5FF] transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Indicators / KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#121024]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Bell className="h-16 w-16 text-[#9333EA]" /></div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Unread Alerts</p>
          <p className="text-3xl font-black text-white">{unreadCount}</p>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle className="h-16 w-16 text-rose-500" /></div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Critical Priority</p>
          <p className="text-3xl font-black text-rose-400">{highPriorityCount}</p>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="h-16 w-16 text-[#D946EF]" /></div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">AI Recommendation Hub</p>
          <p className="text-3xl font-black text-[#D946EF]">{notifications.filter(n => n.category === 'ai_recommendation').length}</p>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 className="h-16 w-16 text-emerald-500" /></div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Processed Telemetry</p>
          <p className="text-3xl font-black text-emerald-400">{notifications.length}</p>
        </div>
      </div>

      {/* Main Structural Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#121024]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#9333EA]" /> Application Views
            </h3>
            <div className="space-y-1">
              {[
                { id: 'overview', label: 'Overview Dashboard', icon: Sparkles, badge: 'Insights' },
                { id: 'all', label: 'All Notifications', icon: Bell, count: notifications.filter(n => !n.isArchived).length },
                { id: 'unread', label: 'Unread Feed', icon: Info, count: unreadCount },
                { id: 'timeline', label: 'Chronological Timeline', icon: Clock },
                { id: 'archived', label: 'Archived Storage', icon: Archive, count: notifications.filter(n => n.isArchived).length },
                { id: 'analytics', label: 'Analytics Summary', icon: BarChart2 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedIds(new Set());
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-[#9333EA]/20 text-[#D946EF] border border-[#9333EA]/30' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className="h-4 w-4" /> 
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs font-mono text-gray-300">
                      {tab.count}
                    </span>
                  )}
                  {tab.badge !== undefined && (
                    <span className="bg-[#D946EF]/20 text-[#D946EF] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <hr className="border-white/10 my-6" />
            
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Priority Level Filter</h3>
            <div className="space-y-2">
              <select 
                value={selectedPriority} 
                onChange={e => setSelectedPriority(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9333EA]"
              >
                <option value="all">All Priorities</option>
                <option value="high">🔥 High Priority</option>
                <option value="medium">⚡ Medium Priority</option>
                <option value="low">🌱 Low Priority</option>
              </select>
            </div>

            <hr className="border-white/10 my-6" />
            
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Categories Filter</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                  selectedCategory === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-purple-400" /> All Categories
              </button>
              {CATEGORIES.map(cat => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                      selectedCategory === cat.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <CatIcon className={`h-4 w-4 ${cat.color}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content View Router */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Active Tab: OVERVIEW DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* AI Recommendations Hub Header */}
              <div className="bg-gradient-to-r from-[#1A0B2E] via-[#2A124D] to-[#121024] p-6 rounded-3xl border border-[#9333EA]/30 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Sparkles className="h-32 w-32 text-[#D946EF]" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#D946EF] animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-[#D946EF]">AI RECOMMENDATION REPORT</span>
                  </div>
                  <h3 className="text-xl font-black text-white">Aggregated Farm Safety Analysis</h3>
                  <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                    Our digital twin models have analyzed the agricultural system. Ambient blight conditions are high in tomato sectors, and Zone 3 is critical for soil water. Re-routing automation protocols is strongly recommended.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold">1 Blight Risk</span>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold">1 Irrigation Action</span>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold">1 Sensor Telemetry Alarm</span>
                  </div>
                </div>
              </div>

              {/* Demo Mode Interactive Control Center */}
              <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400" /> Agronomic Alert Simulator (Demo Mode)
                  </h3>
                  <span className="text-xs text-gray-400">Click any trigger below to push instant realistic telemetry alerts</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CATEGORIES.map(cat => {
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => simulateNotification(cat.id)}
                        className={`p-3 rounded-2xl border ${cat.border} ${cat.bg} hover:bg-white/5 transition-all text-left space-y-2 group`}
                      >
                        <div className="flex items-center justify-between">
                          <CatIcon className={`h-5 w-5 ${cat.color}`} />
                          <ChevronRight className="h-3 w-3 text-gray-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-xs font-bold text-white">{cat.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Latest Alerts Stream & Mini Recharts overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Active Alerts Stream */}
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col h-[350px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#D946EF]" /> Critical Bulletins Feed
                    </h3>
                    <button 
                      onClick={() => setActiveTab('all')} 
                      className="text-xs font-bold text-[#D946EF] hover:underline"
                    >
                      View All Alerts
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {notifications.filter(n => !n.isArchived).slice(0, 4).map(notif => {
                      const catInfo = getCategoryDetails(notif.category);
                      const CatIcon = catInfo.icon;
                      return (
                        <div 
                          key={notif.id} 
                          onClick={() => handleToggleRead(notif.id)}
                          className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                            notif.isRead ? 'bg-white/5 border-transparent' : 'bg-[#9333EA]/10 border-[#9333EA]/30'
                          }`}
                        >
                          <div className={`p-2 rounded-xl bg-black/40 border border-white/5 shrink-0 ${catInfo.color}`}>
                            <CatIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                            <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{notif.message}</p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${getPriorityColor(notif.priority)} shrink-0`}>
                            {notif.priority}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Severity Breakdown PieChart */}
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl h-[350px] flex flex-col">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-[#9333EA]" /> Distribution Analytics
                  </h3>
                  <div className="flex-1 relative min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          cx="50%" cy="45%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Active Tab: CHRONOLOGICAL TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl min-h-[550px]">
              <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#9333EA]" /> Agronomic Timeline History
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Sequential audit log of active farm notifications & events</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleMarkAllRead} className="text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-white transition-colors">
                    Mark All Read
                  </button>
                </div>
              </div>

              {filteredNotifications.length === 0 ? (
                <div className="py-24 text-center">
                  <Clock className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No events logged in the selected view.</p>
                </div>
              ) : (
                <div className="relative border-l border-[#9333EA]/30 ml-4 pl-8 space-y-8">
                  {timelineGroups.map(([dateGroup, items]) => (
                    <div key={dateGroup} className="relative space-y-4">
                      {/* Date Marker Node */}
                      <div className="absolute -left-[45px] top-1 bg-[#130722] border border-[#9333EA]/50 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#D946EF] shadow-lg">
                        {dateGroup}
                      </div>

                      <div className="space-y-4 pt-8">
                        {items.map(item => {
                          const catInfo = getCategoryDetails(item.category);
                          const CatIcon = catInfo.icon;
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`p-4 rounded-2xl border transition-all relative ${
                                item.isRead ? 'bg-white/5 border-transparent' : 'bg-[#9333EA]/10 border-[#9333EA]/20'
                              }`}
                            >
                              {/* Left Connected Line Node Icon */}
                              <div className={`absolute -left-[45px] top-4 w-7 h-7 rounded-full bg-[#121024] border-2 border-current ${catInfo.color} flex items-center justify-center shadow-md`}>
                                <CatIcon className="h-3.5 w-3.5" />
                              </div>

                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                                    {!item.isRead && <span className="w-2 h-2 rounded-full bg-[#D946EF]"></span>}
                                  </div>
                                  <p className="text-xs text-gray-300 leading-relaxed">{item.message}</p>
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getPriorityColor(item.priority)}`}>
                                  {item.priority} Priority
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  Category: {catInfo.label}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Tab: LIST VIEWS (All, Unread, Archived) */}
          {(activeTab === 'all' || activeTab === 'unread' || activeTab === 'archived') && (
            <div className="bg-[#121024]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col min-h-[550px]">
              
              {/* Action Filters Bar */}
              <div className="p-4 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search alerts by title or description..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-2 bg-[#9333EA]/20 px-3 py-1.5 rounded-xl border border-[#9333EA]/30 animate-pulse">
                      <span className="text-xs font-bold text-[#D946EF] mr-2">{selectedIds.size} Selected</span>
                      <button 
                        onClick={() => handleBulkAction('read')} 
                        className="p-1.5 hover:bg-white/10 rounded-md text-white transition-colors" 
                        title="Mark Read"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleBulkAction('archive')} 
                        className="p-1.5 hover:bg-white/10 rounded-md text-white transition-colors" 
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleBulkAction('delete')} 
                        className="p-1.5 hover:bg-rose-500/20 rounded-md text-rose-400 transition-colors" 
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleMarkAllRead} 
                        className="text-xs font-bold text-gray-400 hover:text-white transition-colors px-3 py-2"
                      >
                        Mark All Read
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Feed List Container */}
              <div className="flex-1 overflow-y-auto p-3">
                {loading ? (
                  <div className="space-y-3 p-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-4 rounded-2xl border border-white/5 bg-white/5 animate-pulse flex items-start gap-4">
                        <div className="w-5 h-5 rounded border border-white/10 mt-1 shrink-0"></div>
                        <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0"></div>
                        <div className="flex-1 space-y-3 py-1">
                          <div className="h-4 bg-white/10 rounded w-1/3"></div>
                          <div className="h-3 bg-white/10 rounded w-3/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="py-24 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Bell className="h-8 w-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No Alerts Discovered</h3>
                    <p className="text-sm text-gray-400 max-w-sm">No active agricultural telemetry alerts match the selected filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <AnimatePresence>
                        {paginatedNotifications.map((notif) => {
                          const catInfo = getCategoryDetails(notif.category);
                          const CatIcon = catInfo.icon;
                          const isSelected = selectedIds.has(notif.id);

                          return (
                            <motion.div
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              key={notif.id}
                              className={`p-4 rounded-2xl border transition-all ${
                                notif.isRead 
                                  ? 'bg-white/5 border-transparent hover:border-white/10' 
                                  : 'bg-[#9333EA]/10 border-[#9333EA]/20 shadow-md'
                              } ${isSelected ? 'ring-2 ring-[#9333EA] bg-[#9333EA]/20' : ''}`}
                            >
                              <div className="flex items-start gap-4">
                                <button 
                                  onClick={() => toggleSelection(notif.id)}
                                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-[#9333EA] border-[#9333EA]' : 'border-gray-500 hover:border-white'
                                  }`}
                                  aria-label="Select alert"
                                >
                                  {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                                </button>
                                
                                <div className={`p-2.5 rounded-xl bg-black/30 border border-white/5 flex-shrink-0 ${catInfo.color}`}>
                                  <CatIcon className="h-5 w-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className={`text-sm font-bold truncate ${notif.isRead ? 'text-gray-200' : 'text-white'}`}>
                                        {notif.title}
                                      </h4>
                                      {!notif.isRead && <span className="w-2 h-2 rounded-full bg-[#D946EF]"></span>}
                                    </div>
                                    <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                                      {new Date(notif.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className={`text-sm mb-3 ${notif.isRead ? 'text-gray-400' : 'text-gray-300'}`}>
                                    {notif.message}
                                  </p>
                                  
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getPriorityColor(notif.priority)}`}>
                                      {notif.priority} Priority
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                      • {catInfo.label}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleToggleRead(notif.id)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    title={notif.isRead ? "Mark unread" : "Mark read"}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleToggleArchive(notif.id)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    title={notif.isArchived ? "Restore to Inbox" : "Archive alert"}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(notif.id)}
                                    className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                                    title="Delete permanently"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/5 pt-4 px-2 gap-3 text-xs">
                        <span className="text-gray-400">
                          Showing <span className="text-white font-medium">{Math.min(filteredNotifications.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-white font-medium">{Math.min(filteredNotifications.length, currentPage * itemsPerPage)}</span> of <span className="text-white font-medium">{filteredNotifications.length}</span> alerts
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 text-white transition-all font-medium cursor-pointer"
                          >
                            Prev
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }).map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setCurrentPage(index + 1)}
                                className={`w-7 h-7 rounded-lg text-center transition-all flex items-center justify-center font-medium ${
                                  currentPage === index + 1
                                    ? 'bg-[#9333EA] text-white'
                                    : 'hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer'
                                }`}
                              >
                                {index + 1}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 text-white transition-all font-medium cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Tab: ANALYTICS SUMMARY */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-6">Historical Alert Volume Trend</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeData}>
                      <defs>
                        <linearGradient id="colorCrit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorWarn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff50" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#ffffff50" tick={{ fontSize: 12 }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                      <Area type="monotone" dataKey="Critical" stackId="1" stroke="#F43F5E" fill="url(#colorCrit)" name="Critical" />
                      <Area type="monotone" dataKey="Warning" stackId="1" stroke="#F59E0B" fill="url(#colorWarn)" name="Warning" />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Extra Summary Cards */}
              <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center gap-6 justify-between">
                <div>
                  <h4 className="text-base font-bold text-white mb-2">Automated Alert Reports and Diagnostics</h4>
                  <p className="text-sm text-gray-400">Download formatted reports containing total alert breakdowns, response metrics, and agronomic performance audits.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={handleExportCSV} className="px-4 py-2 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Export CSV Data
                  </button>
                  <button onClick={handleExportPDF} className="px-4 py-2 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                    <Download className="h-4 w-4" /> Export PDF Report
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
