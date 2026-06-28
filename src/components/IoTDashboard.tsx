import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wifi, WifiOff, Thermometer, Droplets, Droplet, Sun, CloudRain,
  Activity, Zap, Map as MapIcon, Settings, Settings2, Sliders, Bell, AlertTriangle,
  CheckCircle2, Battery, BatteryCharging, Search, Download, FileText,
  Loader2, RefreshCw, Server, Plus, Edit2, Trash2, Maximize, Play, Square,
  BarChart2, Radio, LayoutDashboard
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Farm, User } from '../types';
import { fetch } from '../utils/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom glowing map marker for Leaflet
const customMarkerIcon = typeof window !== 'undefined' ? L.divIcon({
  className: 'custom-gps-marker',
  html: `<div class="relative flex items-center justify-center">
    <div class="absolute h-6 w-6 rounded-full bg-[#D946EF] animate-ping opacity-75"></div>
    <div class="relative h-4 w-4 rounded-full bg-[#9333EA] border-2 border-white shadow-[0_0_10px_rgba(147,51,234,0.8)]"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
}) : null as any;

// Helper to parse location string to [lat, lon] coordinates
const parseCoordinates = (location: string, index: number): [number, number] => {
  if (!location) return [37.7749, -122.4194]; // Default to California central
  const regex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  const match = location.match(regex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) return [lat, lon];
  }

  const lower = location.toLowerCase();
  if (lower.includes('california') || lower.includes('sacramento')) {
    return [38.5816 - (index * 0.02), -121.4944 + (index * 0.02)];
  }
  if (lower.includes('valley') || lower.includes('green valley')) {
    return [37.7749 - (index * 0.02), -122.4194 + (index * 0.02)];
  }
  if (lower.includes('texas') || lower.includes('austin')) {
    return [30.2672 - (index * 0.02), -97.7431 + (index * 0.02)];
  }
  if (lower.includes('india') || lower.includes('delhi')) {
    return [28.6139 - (index * 0.02), 77.209 + (index * 0.02)];
  }

  // Fallback hash mapping to distribute markers deterministically
  let hash = 0;
  for (let i = 0; i < location.length; i++) {
    hash = location.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = 36.0 + (Math.abs(hash % 100) / 100) * 8.0;
  const lon = -118.0 + (Math.abs((hash >> 8) % 100) / 100) * 30.0;
  return [lat, lon];
};

// Component to dynamically pan the Leaflet map view
function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface IoTDashboardProps {
  user: User;
  farms: Farm[];
  activeFarm: Farm | null;
  onRefreshFarms?: () => void;
}

interface SensorData {
  id: string;
  name: string;
  type: 'temperature' | 'moisture' | 'humidity' | 'ph' | 'ec' | 'light' | 'rainfall' | 'tank';
  value: number;
  unit: string;
  status: 'online' | 'offline' | 'warning';
  battery: number;
  lastUpdate: string;
  trend: 'up' | 'down' | 'stable';
}

interface ActuatorData {
  id: string;
  name: string;
  type: 'valve' | 'pump';
  state: 'on' | 'off' | 'error';
  lastAction: string;
}

// NOTE: generateHistoricalData() has been removed - charts now use live MongoDB sensor readings.

export default function IoTDashboard({ user, farms, activeFarm, onRefreshFarms }: IoTDashboardProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'devices' | 'alerts'>('overview');
  const [selectedFarmId, setSelectedFarmId] = useState<string>(activeFarm?.id || (farms.length > 0 ? farms[0].id : ''));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real-time Data States
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [actuators, setActuators] = useState<ActuatorData[]>([]);
  // Telemetry keyed by sensor type from MongoDB readings
  const [telemetry, setTelemetry] = useState<Record<string, { time: string; value: number }[]>>({});

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Network connection restored. Syncing IoT Gateway...', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Network connection lost. Operating in local mode.', 'error');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (activeFarm) setSelectedFarmId(activeFarm.id);
  }, [activeFarm]);

  // Load IoT Data from Database
  const loadData = async (farmId: string) => {
    const currentFarm = farms.find(f => f.id === farmId);
    if (!currentFarm) { setLoading(false); return; }

    setLoading(true);
    try {
      // Fetch sensor devices
      const res = await fetch(`/api/sensors?farmId=${farmId}`);
      const data = await res.json();
      if (data.success) {
        const mappedSensors: SensorData[] = data.sensors.map((s: any) => ({
          id: s._id || s.id,
          name: s.name,
          type: s.type,
          value: 0, // will be updated from readings below
          unit: s.type === 'temperature' ? '°C' : s.type === 'moisture' ? '%' : s.type === 'humidity' ? '%' : s.type === 'ph' ? 'pH' : s.type === 'ec' ? 'dS/m' : s.type === 'light' ? 'lux' : s.type === 'rainfall' ? 'mm/h' : '%',
          status: s.status || 'online',
          battery: s.battery !== undefined ? s.battery : 100,
          lastUpdate: 'Just now',
          trend: 'stable'
        }));

        // Fetch real sensor readings from MongoDB
        const readingsRes = await fetch(`/api/sensors/readings?farmId=${farmId}&limit=100`);
        const readingsData = await readingsRes.json();
        const readings: any[] = readingsData.success ? readingsData.readings : [];

        // Group readings by sensor type for charts
        const telemetryByType: Record<string, { time: string; value: number }[]> = {};
        // Also calculate latest value per sensor
        const latestBySensor: Record<string, number> = {};
        for (const r of readings) {
          const type = r.sensorType || 'unknown';
          if (!telemetryByType[type]) telemetryByType[type] = [];
          telemetryByType[type].push({
            time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: r.value
          });
          // Track latest value for each sensor device
          const sId = String(r.sensorId);
          if (!(sId in latestBySensor)) latestBySensor[sId] = r.value;
        }

        // Populate sensor current values from readings
        const enriched = mappedSensors.map(s => ({
          ...s,
          value: latestBySensor[s.id] ?? (currentFarm.sensorData?.[s.type as keyof typeof currentFarm.sensorData] as number ?? 0)
        }));

        setSensors(enriched);
        setTelemetry(telemetryByType);
      }

      // Load actuators from farm
      const farmActuators = ((currentFarm as any).actuators || []).map((a: any) => ({
        id: a.id || a._id,
        name: a.name,
        type: a.type as 'valve' | 'pump',
        state: a.state as 'on' | 'off' | 'error',
        lastAction: a.lastAction || 'No history'
      }));
      setActuators(farmActuators);
    } catch (err) {
      console.error('Failed to load IoT sensors', err);
      showToast('Failed to load sensor data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedFarmId) { setLoading(false); return; }
    loadData(selectedFarmId);
    // 5-minute polling for live updates
    const interval = setInterval(() => loadData(selectedFarmId), 300000);
    return () => clearInterval(interval);
  }, [selectedFarmId, farms]);



  const toggleActuator = async (id: string) => {
    const targetActuator = actuators.find(a => a.id === id);
    if (!targetActuator) return;
    if (targetActuator.state === 'error') {
      showToast(`Cannot control ${targetActuator.name}. Device in error state.`, 'error');
      return;
    }

    const oldState = targetActuator.state;
    const newState = oldState === 'on' ? 'off' : 'on';

    // Optimistic UI state change
    setActuators(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, state: newState, lastAction: `${newState === 'on' ? 'Started' : 'Closed'} just now` };
      }
      return a;
    }));

    showToast(`${targetActuator.name} turning ${newState}...`, 'info');

    const currentFarm = farms.find(f => f.id === selectedFarmId);
    if (currentFarm && currentFarm.id && selectedFarmId !== 'demo') {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/farms/actuator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            farmId: currentFarm.id,
            actuatorId: id,
            state: newState
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`${targetActuator.name} turned ${newState} successfully`, 'success');
          if (onRefreshFarms) {
            onRefreshFarms();
          }
        } else {
          throw new Error(data.message || 'Failed to toggle actuator');
        }
      } catch (err: any) {
        // Rollback state on error
        setActuators(prev => prev.map(a => {
          if (a.id === id) {
            return { ...a, state: oldState, lastAction: `${oldState === 'on' ? 'Started' : 'Closed'} previously` };
          }
          return a;
        }));
        showToast(err.message || 'Error executing command. Operating in offline/fallback mode.', 'error');
      }
    } else {
      setTimeout(() => {
        showToast(`${targetActuator.name} turned ${newState} (Demo Mode)`, 'success');
      }, 400);
    }
  };

  const addDevice = async () => {
    if (!selectedFarmId || selectedFarmId === 'demo') return;
    try {
      const type = prompt('Enter sensor type (temperature, moisture, humidity, ph, ec, light, rainfall):', 'moisture') || 'moisture';
      const name = prompt('Enter sensor name:', `Sensor ${sensors.length + 1}`) || `Sensor ${sensors.length + 1}`;
      
      const res = await fetch('/api/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: selectedFarmId,
          name,
          type
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Sensor added to database successfully', 'success');
        if (onRefreshFarms) onRefreshFarms();
      } else {
        showToast(data.message || 'Failed to add sensor', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to add sensor', 'error');
    }
  };

  const removeDevice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sensor?')) return;
    try {
      const res = await fetch(`/api/sensors/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Sensor deleted from database successfully', 'success');
        if (onRefreshFarms) onRefreshFarms();
      } else {
        showToast(data.message || 'Failed to delete sensor', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to delete sensor', 'error');
    }
  };

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temperature': return Thermometer;
      case 'moisture': return Droplets;
      case 'humidity': return CloudRain;
      case 'ph': return Activity;
      case 'ec': return Zap;
      case 'light': return Sun;
      case 'rainfall': return CloudRain;
      case 'tank': return Server;
      default: return Radio;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-emerald-400 bg-emerald-400/20 border-emerald-400/30';
      case 'offline': return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
      case 'warning': return 'text-amber-400 bg-amber-400/20 border-amber-400/30';
      case 'error': return 'text-rose-400 bg-rose-400/20 border-rose-400/30';
      default: return 'text-blue-400 bg-blue-400/20 border-blue-400/30';
    }
  };

  const filteredSensors = sensors.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.type.includes(searchQuery.toLowerCase()));

  const warningSensors = sensors.filter(s => s.status === 'warning');
  const offlineSensors = sensors.filter(s => s.status === 'offline');
  const alertCount = warningSensors.length + offlineSensors.length;
  const lowBatteryCount = sensors.filter(s => s.battery <= 25).length;

  const exportCSV = () => {
    const headers = ['Device ID', 'Device Name', 'Type', 'Value', 'Unit', 'Status', 'Battery', 'Last Update'];
    const rows = sensors.map(s => [
      s.id,
      s.name,
      s.type,
      s.value,
      s.unit,
      s.status,
      `${s.battery}%`,
      s.lastUpdate
    ].map(val => `"${String(val ?? '').replace(/"/g, '""')}"`));
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(",")].concat(rows.map(e => e.join(","))).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `iot_telemetry_${selectedFarmId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Telemetry data exported to CSV', 'success');
  };

  if (farms.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center shadow-lg flex flex-col items-center justify-center min-h-[400px] max-w-md mx-auto mt-12">
        <div className="w-20 h-20 bg-gradient-to-br from-[#9333EA]/20 to-[#C026D3]/20 rounded-full flex items-center justify-center mb-6 border border-[#9333EA]/30">
          <Wifi className="h-10 w-10 text-[#D946EF]" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">No Farms Found</h3>
        <p className="text-[#E9D5FF] text-sm mb-8 leading-relaxed">
          No farms are configured yet. Please add a farm first to monitor IoT sensor telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 relative">
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border backdrop-blur-xl ${
              toast.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-200' : 
              toast.type === 'info' ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' :
              'bg-[#9333EA]/20 border-[#9333EA]/50 text-[#E9D5FF]'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : 
             toast.type === 'info' ? <Bell className="h-5 w-5" /> :
             <CheckCircle2 className="h-5 w-5 text-[#9333EA]" />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-white tracking-tight">IoT Command Center</h2>
            <div className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <Radio className="h-3 w-3 animate-pulse" /> Production Sync
            </div>
          </div>
          <p className="text-[#E9D5FF] max-w-2xl">
            Real-time sensor arrays, actuator controls, and network health monitoring across all deployments.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={selectedFarmId} 
            onChange={e => setSelectedFarmId(e.target.value)}
            className="h-10 bg-[#121024]/80 backdrop-blur-md border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-[#9333EA] shadow-lg"
          >
            {farms.map(f => <option key={f.id} value={f.id} className="bg-[#121024]">{f.name}</option>)}
            {farms.length === 0 && <option value="" disabled className="bg-[#121024]">No Farms Configured</option>}
          </select>
          <button 
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 800); }}
            className="h-10 w-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#121024]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4 shadow-lg">
          <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            {isOnline ? <Wifi className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-rose-400 animate-pulse" />}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Network Status</p>
            <p className="text-base font-black text-white">
              {isOnline ? 'Gateway' : 'Offline'} <span className={`text-[10px] font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>{isOnline ? 'ONLINE' : 'DISCONNECTED'}</span>
            </p>
          </div>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4 shadow-lg">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${alertCount > 0 ? 'bg-rose-500/20 border-rose-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
            <AlertTriangle className={`h-5 w-5 ${alertCount > 0 ? 'text-rose-400 animate-bounce' : 'text-emerald-400'}`} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Active Alerts</p>
            <p className="text-lg font-black text-white">{alertCount} <span className={`text-sm font-medium ${alertCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{alertCount === 1 ? 'Alert' : 'Alerts'}</span></p>
          </div>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4 shadow-lg">
          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Data Packets</p>
            <p className="text-lg font-black text-white">{isOnline ? '1.2k' : '0'} <span className="text-sm font-medium text-blue-400">/min</span></p>
          </div>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4 shadow-lg">
          <div className="h-10 w-10 rounded-full bg-[#9333EA]/20 flex items-center justify-center border border-[#9333EA]/30">
            <Server className="h-5 w-5 text-[#D946EF]" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Gateway Node</p>
            <p className="text-lg font-black text-white">GT-992 <span className="text-sm font-medium text-[#D946EF]">Synced</span></p>
          </div>
        </div>
        <div className="bg-[#121024]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4 shadow-lg">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${lowBatteryCount > 0 ? 'bg-rose-500/20 border-rose-500/30 animate-pulse' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
            <Battery className={`h-5 w-5 ${lowBatteryCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Low Battery</p>
            <p className="text-lg font-black text-white">{lowBatteryCount} <span className={`text-sm font-medium ${lowBatteryCount > 0 ? 'text-rose-400' : 'text-gray-400'}`}>{lowBatteryCount === 1 ? 'Device' : 'Devices'}</span></p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar">
        {[
          { id: 'overview', label: 'Sensor Array', icon: LayoutDashboard },
          { id: 'devices', label: 'Device Management', icon: Settings2 },
          { id: 'map', label: 'Geospatial View', icon: MapIcon },
          { id: 'alerts', label: 'System Alerts', icon: Bell }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap focus:outline-none ${
              activeTab === tab.id 
                ? 'bg-[#9333EA]/20 text-[#D946EF] border border-[#9333EA]/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          {/* Actuators Control Panel Skeleton */}
          <div className="bg-[#121024]/80 p-6 rounded-3xl border border-white/10 h-56">
            <div className="h-6 bg-white/10 rounded w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 h-36 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="h-8 w-8 rounded-lg bg-white/10" />
                    <div className="h-6 w-12 rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-white/10 rounded w-2/3" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Telemetry Sensor Grid Skeleton */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 bg-white/10 rounded w-32" />
              <div className="h-10 bg-white/10 rounded-xl w-64" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#121024]/80 p-5 rounded-3xl border border-white/10 h-48 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white/10" />
                      <div className="space-y-2">
                        <div className="h-4 bg-white/10 rounded w-24" />
                        <div className="h-3 bg-white/10 rounded w-12" />
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded bg-white/10" />
                  </div>
                  <div className="h-8 bg-white/10 rounded w-16 my-4" />
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-white/10 rounded w-16" />
                    <div className="h-5 bg-white/10 rounded-full w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                
                {/* Control Panel */}
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sliders className="h-5 w-5 text-[#9333EA]" /> Actuator Control Panel</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {actuators.map(actuator => (
                      <div key={actuator.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
                        {actuator.state === 'on' && <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />}
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div className={`p-2 rounded-xl ${actuator.state === 'on' ? 'bg-blue-500/20 text-blue-400' : actuator.state === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-800 text-gray-400'}`}>
                            {actuator.type === 'pump' ? <Zap className="h-5 w-5" /> : <Droplet className="h-5 w-5" />}
                          </div>
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${getStatusColor(actuator.state)}`}>
                            {actuator.state}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1 relative z-10">{actuator.name}</h4>
                        <p className="text-xs text-gray-500 mb-4 relative z-10">{actuator.lastAction}</p>
                        
                        <button
                          onClick={() => toggleActuator(actuator.id)}
                          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${
                            actuator.state === 'on' 
                              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/50' 
                              : actuator.state === 'error'
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                          }`}
                        >
                          {actuator.state === 'on' ? <><Square className="h-4 w-4 fill-current" /> Stop</> : actuator.state === 'error' ? 'Error Locked' : <><Play className="h-4 w-4 fill-current" /> Start</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensor Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Live Telemetry</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" placeholder="Filter sensors..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="h-10 pl-10 pr-4 bg-[#121024]/80 backdrop-blur-md border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] w-64"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSensors.map(sensor => {
                      const Icon = getSensorIcon(sensor.type);
                      return (
                        <div key={sensor.id} className="bg-[#121024]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-lg group hover:border-[#9333EA]/50 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl ${getStatusColor(sensor.status)}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white line-clamp-1">{sensor.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {sensor.status === 'offline' ? (
                                    <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider font-bold"><WifiOff className="h-3 w-3" /> Offline</span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-500 uppercase tracking-wider font-bold"><Wifi className="h-3 w-3" /> Online</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                               {sensor.battery <= 25 ? <Battery className="h-4 w-4 text-rose-400 mb-1" /> : sensor.battery === 100 ? <BatteryCharging className="h-4 w-4 text-emerald-400 mb-1" /> : <Battery className="h-4 w-4 text-gray-400 mb-1" />}
                               <span className="text-[10px] font-mono text-gray-500">{sensor.battery}%</span>
                            </div>
                          </div>
                          
                          <div className="my-6 flex items-baseline gap-2">
                            <span className={`text-4xl font-black font-mono ${sensor.status === 'offline' ? 'text-gray-600' : 'text-white'}`}>
                              {sensor.status === 'offline' ? '--' : sensor.value}
                            </span>
                            <span className="text-sm text-gray-400 font-bold">{sensor.unit}</span>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {sensor.lastUpdate}</span>
                            {sensor.status !== 'offline' && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                sensor.trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
                                sensor.trend === 'down' ? 'bg-rose-500/20 text-rose-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {sensor.trend === 'up' ? '↑ Rising' : sensor.trend === 'down' ? '↓ Falling' : '→ Stable'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Telemetry Charts — Live MongoDB Sensor Readings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                  <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-white flex items-center gap-2"><Thermometer className="h-4 w-4 text-rose-400" /> Temperature Trend (Live)
                          <span className="ml-2 text-xs font-normal text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{(telemetry['temperature'] || []).length} pts</span>
                        </h3>
                        <button className="text-gray-400 hover:text-white"><Maximize className="h-4 w-4" /></button>
                     </div>
                     <div className="h-64">
                        {(telemetry['temperature'] || []).length === 0 ? (
                          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No temperature readings yet. Add a temperature sensor.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={telemetry['temperature'] || []}>
                              <defs>
                                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                              <XAxis dataKey="time" stroke="#ffffff50" tick={{fontSize: 10}} minTickGap={30} />
                              <YAxis stroke="#ffffff50" tick={{fontSize: 10}} domain={['dataMin - 2', 'dataMax + 2']} />
                              <Tooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                              <Area type="monotone" dataKey="value" stroke="#F43F5E" fillOpacity={1} fill="url(#tempGradient)" name="Temp °C" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                     </div>
                  </div>

                  <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-white flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-400" /> Soil Moisture Trend (Live)
                          <span className="ml-2 text-xs font-normal text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{(telemetry['moisture'] || []).length} pts</span>
                        </h3>
                        <button className="text-gray-400 hover:text-white"><Maximize className="h-4 w-4" /></button>
                     </div>
                     <div className="h-64">
                        {(telemetry['moisture'] || []).length === 0 ? (
                          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No moisture readings yet. Add a moisture sensor.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={telemetry['moisture'] || []}>
                              <defs>
                                <linearGradient id="moistGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                              <XAxis dataKey="time" stroke="#ffffff50" tick={{fontSize: 10}} minTickGap={30} />
                              <YAxis stroke="#ffffff50" tick={{fontSize: 10}} domain={['dataMin - 5', 'dataMax + 5']} />
                              <Tooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                              <Area type="monotone" dataKey="value" stroke="#3B82F6" fillOpacity={1} fill="url(#moistGradient)" name="Moisture %" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                     </div>
                  </div>

                  <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-white flex items-center gap-2"><CloudRain className="h-4 w-4 text-teal-400" /> Humidity Trend (Live)
                          <span className="ml-2 text-xs font-normal text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{(telemetry['humidity'] || []).length} pts</span>
                        </h3>
                        <button className="text-gray-400 hover:text-white"><Maximize className="h-4 w-4" /></button>
                     </div>
                     <div className="h-64">
                        {(telemetry['humidity'] || []).length === 0 ? (
                          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No humidity readings yet.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={telemetry['humidity'] || []}>
                              <defs>
                                <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                              <XAxis dataKey="time" stroke="#ffffff50" tick={{fontSize: 10}} minTickGap={30} />
                              <YAxis stroke="#ffffff50" tick={{fontSize: 10}} domain={['dataMin - 5', 'dataMax + 5']} />
                              <Tooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                              <Area type="monotone" dataKey="value" stroke="#14B8A6" fillOpacity={1} fill="url(#humGradient)" name="Humidity %" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                     </div>
                  </div>
                </div>

              </div>
            )}

            {/* DEVICES TAB */}
            {activeTab === 'devices' && (
              <div className="bg-[#121024]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Device Configuration</h3>
                  <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                      <Download className="h-4 w-4" /> Export Config
                    </button>
                    <button onClick={addDevice} className="px-4 py-2 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:opacity-90 rounded-xl text-sm font-bold flex items-center gap-2 transition-opacity">
                      <Plus className="h-4 w-4" /> Add Device
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400 bg-black/20">
                        <th className="p-5 font-bold">Device ID & Name</th>
                        <th className="p-5 font-bold">Type</th>
                        <th className="p-5 font-bold">Network</th>
                        <th className="p-5 font-bold">Battery</th>
                        <th className="p-5 font-bold">Last Sync</th>
                        <th className="p-5 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sensors.map((s) => (
                        <tr key={s.id} className="hover:bg-white/5 transition-colors text-sm text-gray-200">
                          <td className="p-5">
                            <div className="font-bold text-white">{s.name}</div>
                            <div className="text-[10px] font-mono text-gray-500">{s.id.toUpperCase()}-NODE-881</div>
                          </td>
                          <td className="p-5 uppercase tracking-wider text-xs font-bold">{s.type}</td>
                          <td className="p-5">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(s.status)}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-5 font-mono">{s.battery}%</td>
                          <td className="p-5 text-xs text-gray-400">{s.lastUpdate}</td>
                          <td className="p-5">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  showToast(`Calibrating ${s.name}...`, 'info');
                                  setTimeout(() => showToast(`${s.name} calibration complete.`, 'success'), 1200);
                                }}
                                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" 
                                title="Calibrate"
                              >
                                <Settings className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={async () => {
                                  const newName = prompt('Enter new device name:', s.name);
                                  if (!newName) return;
                                  try {
                                    const res = await fetch(`/api/sensors/${s.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ name: newName, type: s.type })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      showToast('Device renamed in database successfully', 'success');
                                      if (onRefreshFarms) onRefreshFarms();
                                    } else {
                                      showToast(data.message || 'Failed to rename sensor', 'error');
                                    }
                                  } catch (e: any) {
                                    showToast(e.message || 'Error occurred', 'error');
                                  }
                                }}
                                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" 
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => removeDevice(s.id)} className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-colors" title="Remove"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MAP TAB */}
            {activeTab === 'map' && (() => {
              const selectedFarm = farms.find(f => f.id === selectedFarmId) || farms[0] || null;
              const defaultCenter: [number, number] = selectedFarm 
                ? parseCoordinates(selectedFarm.location, farms.indexOf(selectedFarm))
                : [37.7749, -122.4194];

              return (
                <div className="bg-[#121024]/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl h-[600px] flex flex-col shadow-2xl relative overflow-hidden group">
                  <div className="w-full h-full min-h-[450px] rounded-2xl overflow-hidden border border-white/10 relative z-10">
                    <MapContainer 
                      center={defaultCenter} 
                      zoom={8} 
                      style={{ height: '100%', width: '100%', background: '#121024' }}
                    >
                      <ChangeMapView center={defaultCenter} />
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      />
                      {farms.map((farm, idx) => {
                        const coords = parseCoordinates(farm.location, idx);
                        const moisture = farm.sensorData?.moisture ?? 50;
                        const pH = farm.sensorData?.pH ?? 6.5;
                        const temp = farm.sensorData?.temperature ?? 22;
                        const humidity = farm.sensorData?.humidity ?? 60;
                        
                        return (
                          <Marker 
                            key={farm.id} 
                            position={coords} 
                            icon={customMarkerIcon}
                            eventHandlers={{
                              click: () => {
                                setSelectedFarmId(farm.id);
                              }
                            }}
                          >
                            <Popup className="custom-leaflet-popup">
                              <div className="text-white font-sans p-1 min-w-[180px]">
                                <h4 className="font-bold text-base text-[#D946EF] border-b border-white/10 pb-1 mb-2">{farm.name}</h4>
                                <div className="text-xs space-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="text-[#E9D5FF]">🌾 Crop Type:</span>
                                    <span className="font-semibold text-white">{farm.cropType}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#E9D5FF]">📐 Area:</span>
                                    <span className="font-semibold text-white">{farm.area} acres</span>
                                  </div>
                                  <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1.5">
                                    <span className="text-[#E9D5FF] font-medium">💧 Soil Moisture:</span>
                                    <span className="font-semibold text-blue-400">{moisture}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#E9D5FF] font-medium">🧪 Soil pH:</span>
                                    <span className="font-semibold text-amber-400">{pH}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#E9D5FF] font-medium">🌡️ Soil Temp:</span>
                                    <span className="font-semibold text-rose-400">{temp}°C</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#E9D5FF] font-medium">☁️ Humidity:</span>
                                    <span className="font-semibold text-teal-400">{humidity}%</span>
                                  </div>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </MapContainer>
                  </div>
                </div>
              );
            })()}

            {/* ALERTS TAB */}
            {activeTab === 'alerts' && (
              <div className="bg-[#121024]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /> Active System Alerts</h3>
                
                <div className="space-y-4">
                  {sensors.filter(s => s.status === 'warning' || s.status === 'offline').map(sensor => (
                    <div key={sensor.id} className={`p-5 rounded-2xl border flex items-start gap-4 ${sensor.status === 'offline' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                      <div className={`p-3 rounded-xl mt-0.5 ${sensor.status === 'offline' ? 'bg-rose-500/20' : 'bg-amber-500/20'}`}>
                        {sensor.status === 'offline' ? <WifiOff className="h-6 w-6 text-rose-400" /> : <AlertTriangle className="h-6 w-6 text-amber-400" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-white mb-1">
                          {sensor.status === 'offline' ? 'Device Connection Lost' : 'Abnormal Reading Detected'}
                        </h4>
                        <p className="text-sm text-gray-400 mb-3">
                          {sensor.status === 'offline' 
                            ? `"${sensor.name}" (${sensor.id.toUpperCase()}) has missed consecutive heartbeat signals. Battery is at ${sensor.battery}%.`
                            : `"${sensor.name}" (${sensor.id.toUpperCase()}) is reporting values outside optimal levels: ${sensor.value}${sensor.unit}.`
                          }
                        </p>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              showToast(`Pinging ${sensor.name}...`, 'info');
                              setTimeout(() => {
                                showToast(`${sensor.name} responded successfully.`, 'success');
                              }, 1000);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${sensor.status === 'offline' ? 'text-rose-400 bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/30' : 'text-amber-400 bg-amber-500/20 border-amber-500/30 hover:bg-amber-500/30'}`}
                          >
                            Ping Device
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {sensors.filter(s => s.status === 'warning' || s.status === 'offline').length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-4 animate-bounce" />
                      <h4 className="text-lg font-bold text-white mb-1">All Systems Optimal</h4>
                      <p className="text-sm text-gray-400">All field gateways and sensor nodes are reporting normal levels.</p>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl flex items-start gap-4 opacity-70">
                    <div className="p-3 bg-blue-500/20 rounded-xl mt-0.5"><CheckCircle2 className="h-6 w-6 text-blue-400" /></div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-1">Firmware Update Complete</h4>
                      <p className="text-sm text-gray-400">All Zone 1 nodes successfully updated to v2.4.1</p>
                      <span className="text-xs text-gray-500 font-mono mt-2 block">2 hours ago</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
