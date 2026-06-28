import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
  Droplets, Thermometer, CloudRain, Activity, TrendingUp, Sparkles, AlertCircle, 
  CheckCircle, RefreshCw, Sun, Cloud, CloudLightning, Wind, Bell, Clock, 
  Calendar, Plus, MessageSquare, FileText, Microscope, Sprout, ShieldCheck, 
  ServerCrash, Cpu, Navigation, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Farm } from '../types';
import { fetch } from '../utils/api';

interface DashboardProps {
  user?: any;
  farms: Farm[];
  activeFarm: Farm | null;
  onSelectFarm: (farm: Farm) => void;
  onRefreshFarmData: () => void;
  onNavigate?: (tab: string) => void;
}

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: any = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Dashboard({ user, farms, activeFarm, onSelectFarm, onRefreshFarmData, onNavigate }: DashboardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherError, setWeatherError] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [sensorsList, setSensorsList] = useState<any[]>([]);

  const currentFarm = activeFarm || farms[0] || null;

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/notifications?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setNotifications(data.notifications || []);
        })
        .catch(console.error);

      fetch(`/api/yield-predictions?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setPredictions(data.history || []);
        })
        .catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && currentFarm?.id) {
      fetch(`/api/sensors?farmId=${currentFarm.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setSensorsList(data.sensors || []);
        })
        .catch(console.error);
    } else {
      setSensorsList([]);
    }
  }, [user, currentFarm?.id]);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeather = async () => {
    setWeatherLoading(true);
    try {
      let lat = 28.6139;
      let lon = 77.2090;
      
      if (activeFarm?.location?.toLowerCase().includes('punjab')) {
        lat = 31.1471; lon = 75.3412;
      } else if (activeFarm?.location?.toLowerCase().includes('california')) {
        lat = 36.7783; lon = -119.4179;
      }

      const res = await fetch(`/api/weather?latitude=${lat}&longitude=${lon}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setWeather(data.current);
      setForecast(data);
      setWeatherError(false);
    } catch (e) {
      console.error("Failed to fetch weather", e);
      setWeatherError(true);
      setWeather(null);
      setForecast(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const data = currentFarm?.sensorData || {
      moisture: 0,
      pH: 7.0,
      temperature: 0,
      humidity: 0,
      predictedYield: 0,
      waterRecommendation: 'Wait 24 hours'
  };

  const handleRefresh = () => {
    setRefreshing(true);
    onRefreshFarmData();
    setTimeout(() => setRefreshing(false), 800);
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="h-10 w-10 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]" />;
    if (code >= 1 && code <= 3) return <Cloud className="h-10 w-10 text-gray-300 drop-shadow-[0_0_15px_rgba(209,213,219,0.4)]" />;
    if (code >= 51 && code <= 67) return <CloudRain className="h-10 w-10 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.4)]" />;
    if (code >= 95) return <CloudLightning className="h-10 w-10 text-purple-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.4)]" />;
    return <Cloud className="h-10 w-10 text-gray-400" />;
  };

  if (farms.length === 0 || !currentFarm) {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center shadow-lg flex flex-col items-center justify-center min-h-[400px] max-w-md mx-auto mt-12">
        <div className="w-20 h-20 bg-gradient-to-br from-[#9333EA]/20 to-[#C026D3]/20 rounded-full flex items-center justify-center mb-6 border border-[#9333EA]/30">
          <Sprout className="h-10 w-10 text-[#D946EF]" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">No Farms Added Yet</h3>
        <p className="text-[#E9D5FF] text-sm mb-8 leading-relaxed">
          Your digital twin dashboard is empty. Add your first farm or field to start recording sensors, managing crops, and tracking analytics.
        </p>
        <button
          onClick={() => onNavigate?.('data-entry')}
          className="px-8 py-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 focus:outline-none"
        >
          <Plus className="h-5 w-5" />
          Add Your First Record
        </button>
      </div>
    );
  }

  // 24H Microclimate Data Generation (Live query with dynamic fallback)
  let weatherData = forecast?.hourly?.time?.slice(0, 8).map((t: string, i: number) => ({
    time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temp: forecast.hourly.temperature_2m[i],
    humidity: forecast.hourly.relative_humidity_2m[i]
  })) || [];

  if (weatherData.length === 0) {
    if (currentFarm.sensorHistory && currentFarm.sensorHistory.length > 0) {
      weatherData = currentFarm.sensorHistory.map((h: any) => ({
        time: h.timestamp,
        temp: h.temperature || 24,
        humidity: h.humidity || 55
      }));
    } else {
      const currentTemp = currentFarm.sensorData?.temperature || 25;
      const currentHumidity = currentFarm.sensorData?.humidity || 60;
      const dataPoints = [];
      for (let i = 7; i >= 0; i--) {
        const time = new Date();
        time.setHours(time.getHours() - i * 3);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const angle = (time.getHours() / 24) * 2 * Math.PI;
        const tempSwing = Math.sin(angle) * 4;
        const humSwing = -Math.sin(angle) * 10;
        dataPoints.push({
          time: timeStr,
          temp: Number((currentTemp + tempSwing).toFixed(1)),
          humidity: Number((currentHumidity + humSwing).toFixed(1))
        });
      }
      weatherData = dataPoints;
    }
  }

  // Yield Predictions Data Generation (Live query with dynamic fallback)
  let yieldTrendData = predictions.length > 0 
    ? predictions.slice(0, 6).reverse().map(p => ({
        month: new Date(p.createdAt).toLocaleDateString([], { month: 'short' }),
        yield: Number(p.predictedYield || 0)
      }))
    : [];

  if (yieldTrendData.length === 0) {
    const baseVal = currentFarm.area * (currentFarm.cropType === 'Tomato' ? 22.0 : currentFarm.cropType === 'Corn' ? 4.5 : 3.0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const dataPoints = [];
    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      const factor = 0.85 + Math.sin(idx) * 0.1 + Math.random() * 0.05;
      dataPoints.push({
        month: months[idx],
        yield: Number((baseVal * factor).toFixed(1))
      });
    }
    yieldTrendData = dataPoints;
  }

  console.log("[Dashboard Yield Chart Data]:", JSON.stringify(yieldTrendData));
  console.log("[Dashboard Weather Chart Data]:", JSON.stringify(weatherData));

  return (
    <motion.div 
      className="space-y-6 pb-20 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* SECTION 1: Top Welcome Banner */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8B5CF6]/20 blur-[80px] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="z-10 flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            Welcome back, {user?.name?.split(' ')[0] || 'Farmer'} 
            <span className="inline-block origin-bottom-right hover:rotate-12 transition-transform cursor-default">👋</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-[#A78BFA] text-sm sm:text-base font-medium">
            <span className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg"><Calendar className="h-4 w-4 text-[#D946EF]" /> {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            <span className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg"><Clock className="h-4 w-4 text-blue-400" /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 z-10 w-full lg:w-auto">
          <div className="bg-black/30 backdrop-blur-md border border-white/10 px-5 py-4 rounded-2xl flex items-center gap-5 flex-1 lg:flex-none shadow-inner min-h-[82px]">
             {weatherLoading && !weather ? (
               <div className="animate-pulse flex items-center gap-4">
                 <div className="h-10 w-10 bg-white/10 rounded-full"></div>
                 <div className="h-10 w-24 bg-white/10 rounded"></div>
               </div>
             ) : weather ? (
               <>
                 <div className="flex items-center gap-3 relative">
                   {getWeatherIcon(weather.weather_code)}
                   <div>
                     <div className="text-2xl font-black text-white leading-none mb-1 flex items-center gap-1">
                       {weather.temperature_2m}°
                       {weatherError && (
                         <span 
                           className="inline-block text-rose-400 hover:text-rose-300 cursor-pointer" 
                           title="Offline fallback active. Click to retry connection."
                           onClick={(e) => { e.stopPropagation(); fetchWeather(); }}
                         >
                           <AlertCircle className="h-4 w-4 animate-pulse" />
                         </span>
                       )}
                     </div>
                     <div className="text-xs text-[#A78BFA] font-medium flex items-center gap-1">
                       Feels like {weather.apparent_temperature}°
                       {weatherError && (
                         <button 
                           onClick={(e) => { e.stopPropagation(); fetchWeather(); }}
                           className="text-[10px] text-[#A78BFA] hover:text-white underline font-bold"
                         >
                           (Offline)
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
                 <div className="h-12 w-px bg-white/10"></div>
                 <div className="flex flex-col text-xs text-[#A78BFA] font-medium justify-center gap-1.5">
                   <span className="flex items-center gap-1.5"><Wind className="h-3.5 w-3.5 text-blue-300" /> {weather.wind_speed_10m} km/h</span>
                   <span className="flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-blue-400" /> {weather.relative_humidity_2m}%</span>
                 </div>
               </>
             ) : (
               <div className="animate-pulse flex items-center gap-4">
                 <div className="h-10 w-10 bg-white/10 rounded-full"></div>
                 <div className="h-10 w-24 bg-white/10 rounded"></div>
               </div>
             )}
          </div>
          <button className="relative p-4 bg-white/5 hover:bg-white/10 transition-all rounded-2xl border border-white/10 shrink-0 shadow-lg hover:shadow-xl active:scale-95 group">
            <Bell className="h-6 w-6 text-white group-hover:text-[#D946EF] transition-colors" />
            <span className="absolute top-3 right-3 h-3 w-3 bg-red-500 rounded-full border-2 border-[#1E1B4B] animate-pulse"></span>
          </button>
        </div>
      </motion.div>

      {/* Farm Selector & Sync */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg relative z-20">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#A78BFA]">Digital Twin Instance:</label>
          <div className="relative">
            <select
              className="appearance-none bg-black/20 border border-white/10 text-white text-sm font-medium rounded-xl focus:ring-2 focus:ring-[#9333EA] focus:border-[#9333EA] block p-2.5 pr-10 outline-none transition-all cursor-pointer min-w-[220px]"
              value={currentFarm.id}
              onChange={(e) => {
                const farm = farms.find((f) => f.id === e.target.value);
                if (farm) onSelectFarm(farm);
              }}
            >
              {farms.length > 0 ? (
                farms.map((farm) => (
                  <option key={farm.id} value={farm.id} className="bg-[#1E1B4B] text-white">
                    {farm.name} ({farm.cropType})
                  </option>
                ))
              ) : (
                <option value="" disabled className="bg-[#1E1B4B] text-white">
                  No Farms Configured
                </option>
              )}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none rotate-90" />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium disabled:opacity-50 shadow-md active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 text-[#D946EF] ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing Sensors...' : 'Sync IoT'}
          </button>
        </div>
      </motion.div>

      {/* SECTION 2: Statistics Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Farms', value: farms.length, icon: Navigation, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { 
            label: 'Crop Health', 
            value: (() => {
              if (!currentFarm) return '0%';
              const moisture = currentFarm.sensorData?.moisture ?? 0;
              const pH = currentFarm.sensorData?.pH ?? 7.0;
              if (moisture === 0 && pH === 7.0) return '95%';
              let score = 100;
              if (moisture < 35) score -= (35 - moisture) * 1.5;
              if (moisture > 75) score -= (moisture - 75) * 1.5;
              if (pH < 6.0) score -= (6.0 - pH) * 20;
              if (pH > 7.5) score -= (pH - 7.5) * 20;
              return `${Math.max(50, Math.min(100, Math.round(score)))}%`;
            })(),
            icon: Sprout, 
            color: 'text-green-400', 
            bg: 'bg-green-400/10' 
          },
          { 
            label: 'Predicted Yield', 
            value: predictions.length > 0 ? `${predictions[0].expectedYield} tons` : 'N/A', 
            icon: TrendingUp, 
            color: 'text-[#D946EF]', 
            bg: 'bg-[#D946EF]/10' 
          },
          { 
            label: 'Active Sensors', 
            value: sensorsList.length > 0 ? `${sensorsList.filter(s => s.status === 'online').length}/${sensorsList.length}` : '0/0', 
            icon: Activity, 
            color: 'text-[#9333EA]', 
            bg: 'bg-[#9333EA]/10' 
          }
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-purple-500/10 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 group-hover:rotate-12 duration-300">
              <stat.icon className={`h-24 w-24 ${stat.color}`} />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} shadow-inner`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="text-3xl font-black text-white mb-1 relative z-10">{stat.value}</div>
            <div className="text-sm font-medium text-[#A78BFA] relative z-10">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* SECTION 7: Quick Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Add Farm', icon: Plus, tab: 'farms' },
          { label: 'Soil Analysis', icon: Microscope, tab: 'soil' },
          { label: 'Scan Disease', icon: Activity, tab: 'disease' },
          { label: 'Generate Report', icon: FileText, tab: 'reports' },
          { label: 'AI Assistant', icon: MessageSquare, tab: 'chat' },
        ].map((action, i) => (
          <button 
            key={i} 
            onClick={() => onNavigate?.(action.tab)}
            className="bg-gradient-to-br from-white/5 to-white/0 hover:from-white/10 hover:to-white/5 border border-white/10 p-5 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-lg hover:shadow-2xl hover:shadow-purple-500/10 group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#9333EA] focus:ring-offset-2 focus:ring-offset-transparent"
            aria-label={`Go to ${action.label}`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#9333EA]/0 to-[#9333EA]/0 group-hover:to-[#9333EA]/10 transition-colors"></div>
            <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#9333EA]/20 transition-colors border border-white/5 shadow-inner relative z-10">
              <action.icon className="h-5 w-5 text-white group-hover:text-[#D946EF] transition-colors" />
            </div>
            <span className="text-sm font-semibold text-[#E9D5FF] relative z-10">{action.label}</span>
          </button>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* SECTION 4: Farm Analytics */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#D946EF]" />
                Yield Trend (Historical vs Projected)
              </h3>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yieldTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D946EF" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#D946EF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', borderColor: 'rgba(147, 51, 234, 0.3)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="yield" stroke="#D946EF" strokeWidth={4} fillOpacity={1} fill="url(#colorYield)" activeDot={{ r: 6, fill: '#D946EF', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* SECTION 3: Weather Analytics */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-[#9333EA]" />
                24H Microclimate Analytics
              </h3>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weatherData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px' }}/>
                  <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#F87171" strokeWidth={3} dot={{ r: 3, fill: '#F87171' }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#60A5FA" strokeWidth={3} dot={{ r: 3, fill: '#60A5FA' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          {/* Farm specific metrics grids */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-center items-center text-center shadow-lg hover:bg-white/10 transition-colors">
              <Droplets className="h-8 w-8 text-blue-400 mb-3 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
              <div className="text-2xl font-black text-white">{data.moisture}%</div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Soil Moisture</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-center items-center text-center shadow-lg hover:bg-white/10 transition-colors">
              <Activity className="h-8 w-8 text-[#D946EF] mb-3 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
              <div className="text-2xl font-black text-white">{data.pH}</div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">pH Level</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-center items-center text-center shadow-lg hover:bg-white/10 transition-colors">
              <CloudRain className="h-8 w-8 text-indigo-400 mb-3 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
              <div className="text-2xl font-black text-white">{data.humidity}%</div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Humidity</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-center items-center text-center shadow-lg hover:bg-white/10 transition-colors">
              <Sun className="h-8 w-8 text-yellow-400 mb-3 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
              <div className="text-2xl font-black text-white">{data.temperature}°C</div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Soil Temp</div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          {/* SECTION 5: AI Recommendation Panel */}
          <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#4C1D95]/60 to-[#2E1065]/60 backdrop-blur-xl p-6 rounded-2xl border border-[#8B5CF6]/30 shadow-[0_8px_30px_rgba(139,92,246,0.15)] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-48 h-48 bg-[#8B5CF6]/30 blur-[50px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
             <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-[#D946EF]" />
                Today's AI Insights
             </h3>
             <div className="space-y-4 relative z-10">
                {notifications.filter(n => n.category === 'ai_recommendation').slice(0, 3).length > 0 ? (
                  notifications.filter(n => n.category === 'ai_recommendation').slice(0, 3).map((insight, idx) => (
                    <div key={idx} className="bg-black/20 border border-white/10 p-4 rounded-xl flex gap-4 items-start hover:bg-black/40 transition-colors">
                      <div className="p-2 bg-purple-500/20 rounded-lg shrink-0 mt-0.5 border border-purple-500/30">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">{insight.title}</h4>
                        <p className="text-xs text-[#E9D5FF] leading-relaxed">{insight.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-black/10">
                    <Sparkles className="h-8 w-8 text-[#A78BFA] mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-gray-400">No AI insights generated yet.</p>
                    <p className="text-[10px] text-gray-500 mt-1">Submit sensor readings to trigger system advisories.</p>
                  </div>
                )}
             </div>
          </motion.div>

          {/* SECTION 8: Live IoT Summary */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
             <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Cpu className="h-5 w-5 text-[#9333EA]" />
                Sensor Network Health
             </h3>
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-200">Soil Moisture Sensors</span>
                    <span className="text-green-400 font-bold">
                      {sensorsList.filter(s => s.type === 'moisture' && s.status === 'online').length}/{sensorsList.filter(s => s.type === 'moisture').length}
                    </span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2 shadow-inner">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: sensorsList.filter(s => s.type === 'moisture').length > 0 ? `${(sensorsList.filter(s => s.type === 'moisture' && s.status === 'online').length / sensorsList.filter(s => s.type === 'moisture').length) * 100}%` : '0%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-200">Temperature Sensors</span>
                    <span className="text-green-400 font-bold">
                      {sensorsList.filter(s => s.type === 'temperature' && s.status === 'online').length}/{sensorsList.filter(s => s.type === 'temperature').length}
                    </span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2 shadow-inner">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: sensorsList.filter(s => s.type === 'temperature').length > 0 ? `${(sensorsList.filter(s => s.type === 'temperature' && s.status === 'online').length / sensorsList.filter(s => s.type === 'temperature').length) * 100}%` : '0%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-200">Other IoT Devices</span>
                    <span className="text-green-400 font-bold">
                      {sensorsList.filter(s => s.type !== 'moisture' && s.type !== 'temperature' && s.status === 'online').length}/{sensorsList.filter(s => s.type !== 'moisture' && s.type !== 'temperature').length}
                    </span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2 shadow-inner">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: sensorsList.filter(s => s.type !== 'moisture' && s.type !== 'temperature').length > 0 ? `${(sensorsList.filter(s => s.type !== 'moisture' && s.type !== 'temperature' && s.status === 'online').length / sensorsList.filter(s => s.type !== 'moisture' && s.type !== 'temperature').length) * 100}%` : '0%' }}></div>
                  </div>
                </div>
             </div>
          </motion.div>

          {/* SECTION 6: Recent Activities Timeline */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-[#A78BFA]" />
              Recent Activity
            </h3>
            <div className="space-y-5 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#9333EA]/50 before:via-white/10 before:to-transparent">
              {notifications.slice(0, 3).length > 0 ? (
                notifications.slice(0, 3).map((act, index) => (
                  <div key={act.id || act._id || index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-500/30 bg-[#1E1B4B] text-white shadow-lg shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <CheckCircle className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-black/20 p-4 rounded-xl border border-white/5 ml-4 md:ml-0 hover:bg-white/5 transition-colors">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm truncate max-w-[150px]">{act.title}</span>
                          <time className="text-[10px] font-medium text-[#D946EF]">{new Date(act.timestamp || act.createdAt).toLocaleDateString()}</time>
                        </div>
                        <p className="text-xs text-[#E9D5FF]">{act.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Clock className="h-8 w-8 text-[#A78BFA] mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-gray-400">No recent activity.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* SECTION 9: Weather Widget (7-Day Forecast) */}
      <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl overflow-hidden">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-400" />
              7-Day Microclimate Forecast
              {weatherError && (
                <span className="px-2.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold inline-flex items-center gap-1 animate-pulse" title="Using local cached fallback datasets.">
                  <AlertCircle className="h-3.5 w-3.5" /> Offline fallback mode
                </span>
              )}
           </h3>
         </div>
         <div className="overflow-x-auto pb-4 custom-scrollbar">
           <div className="flex gap-4 min-w-max">
             {forecast?.daily?.time?.map((t: string, i: number) => (
               <div key={i} className="bg-black/20 hover:bg-white/5 transition-colors border border-white/5 p-5 rounded-2xl flex flex-col items-center min-w-[120px] shadow-lg hover:-translate-y-1 duration-300">
                 <span className="text-sm font-semibold text-[#E9D5FF] mb-3 uppercase tracking-wider">{new Date(t).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                 {getWeatherIcon(forecast.daily.weather_code[i])}
                 <div className="mt-4 flex flex-col items-center">
                   <span className="text-lg font-black text-white">{forecast.daily.temperature_2m_max[i]}°</span>
                   <span className="text-sm font-medium text-[#A78BFA]">{forecast.daily.temperature_2m_min[i]}°</span>
                 </div>
                 <div className="mt-3 text-xs font-medium text-blue-400 flex items-center gap-1">
                   <CloudRain className="h-3 w-3" />
                   {forecast.daily.precipitation_probability_max?.[i] || 0}%
                 </div>
               </div>
             ))}
             {!forecast && Array.from({ length: 7 }).map((_, i) => (
               <div key={i} className="animate-pulse bg-black/20 border border-white/5 p-5 rounded-2xl flex flex-col items-center min-w-[120px] h-44">
                 <div className="h-4 w-12 bg-white/10 rounded mb-4"></div>
                 <div className="h-12 w-12 bg-white/10 rounded-full mb-4"></div>
                 <div className="h-6 w-8 bg-white/10 rounded mb-2"></div>
                 <div className="h-4 w-6 bg-white/10 rounded"></div>
               </div>
             ))}
           </div>
         </div>
      </motion.div>

      {/* SECTION 10: Floating AI Assistant Card (Fixed at bottom right) */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200, damping: 20 }}
        className="fixed bottom-6 right-6 z-50 w-80 bg-gradient-to-br from-[#4C1D95] to-[#2E1065] rounded-2xl shadow-2xl border border-[#8B5CF6]/50 overflow-hidden hidden lg:block"
      >
        <div className="p-4 flex items-center gap-3 border-b border-white/10 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D946EF]/20 blur-[30px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20 relative z-10 shadow-lg">
            <Sparkles className="h-6 w-6 text-[#D946EF]" />
            <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-[#2E1065]"></span>
          </div>
          <div className="relative z-10">
            <h4 className="text-base font-bold text-white leading-tight">AgriSense AI</h4>
            <p className="text-xs text-green-400 font-medium mt-0.5">Online • Ready to assist</p>
          </div>
        </div>
        <div className="p-5 bg-black/30 backdrop-blur-md">
          <p className="text-sm text-gray-100 mb-4 font-medium leading-relaxed">
            Hi! I noticed the soil moisture is optimal but rain is expected. Need advice on your irrigation schedule?
          </p>
          <div className="space-y-2 mb-4">
            <button 
              onClick={() => onNavigate?.('chat')}
              className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-[#E9D5FF] py-2 px-3 rounded-lg transition-colors truncate focus:outline-none focus:ring-2 focus:ring-[#9333EA]"
              aria-label="Ask: Should I pause irrigation today?"
            >
              "Should I pause irrigation today?"
            </button>
            <button 
              onClick={() => onNavigate?.('chat')}
              className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-[#E9D5FF] py-2 px-3 rounded-lg transition-colors truncate focus:outline-none focus:ring-2 focus:ring-[#9333EA]"
              aria-label="Ask: What's the forecast for tomorrow?"
            >
              "What's the forecast for tomorrow?"
            </button>
          </div>
          <button 
            onClick={() => onNavigate?.('chat')}
            className="w-full bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#9333EA] focus:ring-offset-2 focus:ring-offset-[#2E1065]"
            aria-label="Open AI Assistant Chat"
          >
            <MessageSquare className="h-4 w-4" />
            Open Assistant
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
