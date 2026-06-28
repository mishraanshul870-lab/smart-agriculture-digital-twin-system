import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplets, Compass, ShieldCheck, AlertCircle, Loader2, History,
  Activity, Thermometer, Wind, Leaf, TrendingUp, AlertTriangle, 
  CheckCircle2, Download, Search, FileText, BarChart2, Sparkles,
  Calendar, Info, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { Farm, User } from '../types';
import { fetch } from '../utils/api';

interface SoilAnalysisProps {
  user: User;
  farms: Farm[];
  activeFarm: Farm | null;
}

export default function SoilAnalysis({ user, farms, activeFarm }: SoilAnalysisProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRecs, setCurrentRecs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'recommendations' | 'history' | 'new-test'>('overview');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  // Form Fields State
  const [pH, setPh] = useState('6.5');
  const [moisture, setMoisture] = useState('45');
  const [nitrogen, setNitrogen] = useState('80');
  const [phosphorus, setPhosphorus] = useState('40');
  const [potassium, setPotassium] = useState('150');
  const [organicCarbon, setOrganicCarbon] = useState('2.5');
  const [temperature, setTemperature] = useState('24');
  const [humidity, setHumidity] = useState('55');

  // History Table State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const currentFarm = activeFarm || farms[0] || null;

  useEffect(() => {
    if (currentFarm) {
      fetchHistory(currentFarm.id);
    }
  }, [currentFarm?.id]);

  // Adjust active tab if no records exist
  useEffect(() => {
    if (history.length === 0 && activeTab !== 'new-test') {
      setActiveTab('new-test');
    }
  }, [history]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchHistory = async (farmId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/soil-analysis?farmId=${farmId}`);
      const data = await res.json();
      if (data.success) {
        const sorted = (data.history || []).sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setHistory(sorted);
        if (sorted.length > 0) {
          const latest = sorted[sorted.length - 1];
          setCurrentRecs(latest.recommendations || []);
        } else {
          setCurrentRecs([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch soil history', err);
      showToast('Failed to fetch soil history logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFarm) return;

    setSaving(true);
    try {
      const res = await fetch('/api/soil-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: currentFarm.id,
          pH: parseFloat(pH),
          moisture: parseFloat(moisture),
          nitrogen: parseFloat(nitrogen),
          phosphorus: parseFloat(phosphorus),
          potassium: parseFloat(potassium),
          organicCarbon: parseFloat(organicCarbon),
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          language
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Soil test recorded and analyzed successfully!', 'success');
        await fetchHistory(currentFarm.id);
        setActiveTab('overview');
      } else {
        showToast(data.message || 'Failed to save soil test', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred during save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const latestRecord = useMemo(() => {
    if (history.length === 0) return null;
    return history[history.length - 1];
  }, [history]);

  const computedHealthScore = useMemo(() => {
    if (!latestRecord) return 0;
    const moisture = latestRecord.moisture || 0;
    const pH = latestRecord.pH || 7.0;
    const nitrogen = latestRecord.nitrogen || 0;
    
    let score = 98;
    score -= Math.abs(pH - 6.5) * 12;
    if (moisture < 35) score -= (35 - moisture) * 1.0;
    if (moisture > 75) score -= (moisture - 75) * 1.0;
    if (nitrogen < 50) score -= (50 - nitrogen) * 0.3;
    
    return Math.max(50, Math.min(100, Math.round(score)));
  }, [latestRecord]);

  // Export Functions
  const exportCSV = () => {
    if (history.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }
    const headers = ['Date', 'Moisture (%)', 'pH Level', 'Nitrogen (mg/kg)', 'Phosphorus (mg/kg)', 'Potassium (mg/kg)', 'Organic Carbon (%)', 'Temp (°C)', 'Humidity (%)'];
    const rows = history.map(h => [
      new Date(h.createdAt).toLocaleDateString(),
      h.moisture,
      h.pH,
      h.nitrogen || 0,
      h.phosphorus || 0,
      h.potassium || 0,
      h.organicCarbon || 0,
      h.temperature || 0,
      h.humidity || 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `soil_history_${currentFarm?.name || 'farm'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  if (farms.length === 0 || !currentFarm) {
    return (
      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-center py-20 shadow-2xl">
        <AlertCircle className="h-12 w-12 text-[#9333EA] mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Farms Registered</h3>
        <p className="text-sm text-[#E9D5FF] mb-6">Please register a farm twin first to perform soil analysis.</p>
      </div>
    );
  }

  // Table pagination
  const filteredHistory = [...history].reverse().filter(h => 
    new Date(h.createdAt).toLocaleDateString().includes(searchQuery) ||
    (h.pH && h.pH.toString().includes(searchQuery))
  );
  
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const chartData = history.map(h => ({
    date: new Date(h.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    moisture: h.moisture,
    pH: h.pH,
    health: 70 + (h.nitrogen % 30), // computed trend score
    N: h.nitrogen || 0,
    P: h.phosphorus || 0,
    K: h.potassium || 0,
    temp: h.temperature || 0
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">Soil Analysis Panel</h2>
          <p className="text-[#E9D5FF]">
            Dynamic chemical test indicators and AI recommendations for <strong>{currentFarm.name}</strong>
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Language Toggle */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden bg-black/20">
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-2 text-xs font-bold transition-all focus:outline-none cursor-pointer ${
                language === 'en'
                  ? 'bg-[#9333EA]/20 text-[#D946EF] border-r border-[#9333EA]/30'
                  : 'text-gray-400 hover:text-white border-r border-white/10'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`px-3 py-2 text-xs font-bold transition-all focus:outline-none cursor-pointer ${
                language === 'hi'
                  ? 'bg-[#9333EA]/20 text-[#D946EF]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              हिन्दी
            </button>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold transition-colors focus:outline-none cursor-pointer">
            <Download className="h-4 w-4 text-[#D946EF]" /> CSV
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold transition-colors focus:outline-none cursor-pointer">
            <FileText className="h-4 w-4 text-[#9333EA]" /> PDF
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar">
        {[
          { id: 'overview', label: 'AI Overview', icon: Activity, disabled: history.length === 0 },
          { id: 'charts', label: 'Trends & Charts', icon: BarChart2, disabled: history.length === 0 },
          { id: 'recommendations', label: 'Recommendations', icon: ShieldCheck, disabled: history.length === 0 },
          { id: 'history', label: 'Historical Reports', icon: History, disabled: history.length === 0 },
          { id: 'new-test', label: 'Perform Soil Test', icon: Plus, disabled: false }
        ].map(tab => (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap focus:outline-none ${
              tab.disabled 
                ? 'opacity-30 cursor-not-allowed text-gray-600'
                : activeTab === tab.id 
                  ? 'bg-[#9333EA]/20 text-[#D946EF] border border-[#9333EA]/30' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent cursor-pointer'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Decker */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && latestRecord && (
            <div className="space-y-6">
              {/* Dashboard Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-center"><Droplets className="h-3.5 w-3.5 text-blue-400" /> Moisture</p>
                  <p className="text-xl font-black text-white">{latestRecord.moisture}%</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-center"><Compass className="h-3.5 w-3.5 text-yellow-400" /> pH Level</p>
                  <p className="text-xl font-black text-white">{latestRecord.pH}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-center"><Leaf className="h-3.5 w-3.5 text-green-400" /> Nitrogen</p>
                  <p className="text-xl font-black text-white">{latestRecord.nitrogen || 0} <span className="text-[10px] text-gray-500">mg/kg</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-center"><TrendingUp className="h-3.5 w-3.5 text-purple-400" /> Potassium</p>
                  <p className="text-xl font-black text-white">{latestRecord.potassium || 0} <span className="text-[10px] text-gray-500">mg/kg</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 justify-center">Phosphorus</p>
                  <p className="text-xl font-black text-white">{latestRecord.phosphorus || 0} <span className="text-[10px] text-gray-500">mg/kg</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 justify-center">Org Carbon</p>
                  <p className="text-xl font-black text-white">{latestRecord.organicCarbon || 0}%</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-center"><Thermometer className="h-3.5 w-3.5 text-rose-400" /> Temp</p>
                  <p className="text-xl font-black text-white">{latestRecord.temperature || 0}°C</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-center"><Wind className="h-3.5 w-3.5 text-cyan-400" /> Humidity</p>
                  <p className="text-xl font-black text-white">{latestRecord.humidity || 0}%</p>
                </div>
              </div>

              {/* Main Summary Block */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-br from-[#121024] to-[#1a1736] p-6 rounded-3xl border border-[#9333EA]/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#9333EA]/10 blur-[80px] rounded-full" />
                  
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                    <Activity className="h-6 w-6 text-[#D946EF]" /> AI Soil Quality Index
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                    <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Gemini Soil Health Score</span>
                      <span className="text-3xl font-black text-green-400">
                        {latestRecord.soilHealth ? `${latestRecord.soilHealth}` : computedHealthScore / 10}
                        <span className="text-sm font-bold text-white/50">/10</span>
                      </span>
                    </div>

                    <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Risk Level</span>
                      <span className={`text-lg font-bold ${
                        latestRecord.riskLevel === 'High' ? 'text-red-400' :
                        latestRecord.riskLevel === 'Moderate' ? 'text-yellow-400' :
                        latestRecord.riskLevel ? 'text-green-400' :
                        latestRecord.moisture > 75 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {latestRecord.riskLevel || (latestRecord.moisture > 75 ? 'High' : 'Low')}
                      </span>
                    </div>

                    <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Nutrient Deficiencies</span>
                      {latestRecord.deficiencies && latestRecord.deficiencies.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {latestRecord.deficiencies.map((d: string) => (
                            <span key={d} className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">{d}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-green-400">No deficiencies detected</span>
                      )}
                    </div>

                    <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Suitable Crops</span>
                      {latestRecord.suitableCrops && latestRecord.suitableCrops.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {latestRecord.suitableCrops.slice(0, 4).map((c: string) => (
                            <span key={c} className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-white">{currentFarm.cropType}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                      <Sparkles className="h-5 w-5 text-[#D946EF]" /> Gemini AI Analysis
                    </h3>
                    <p className="text-xs text-gray-400 mb-6">Latest advisory compiled based on real chemical values logged for crop variety: {currentFarm.cropType}</p>
                  </div>
                  
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {currentRecs.map((rec, idx) => (
                      <div key={idx} className="bg-black/20 p-3.5 rounded-xl border border-white/5 flex gap-2">
                        <span className="text-[#D946EF] font-bold text-xs">0{idx + 1}</span>
                        <p className="text-xs text-gray-300 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CHARTS TAB */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* NPK Values */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-green-400" /> NPK Indices Over Time (mg/kg)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="date" stroke="#ffffff50" tick={{fontSize: 11}} />
                        <YAxis stroke="#ffffff50" tick={{fontSize: 11}} />
                        <Tooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="N" stroke="#4ADE80" strokeWidth={2.5} name="Nitrogen (N)" />
                        <Line type="monotone" dataKey="P" stroke="#FBBF24" strokeWidth={2.5} name="Phosphorus (P)" />
                        <Line type="monotone" dataKey="K" stroke="#A78BFA" strokeWidth={2.5} name="Potassium (K)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Moisture Trend */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-400" /> Moisture Log History (%)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorMoistSoil" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="date" stroke="#ffffff50" tick={{fontSize: 11}} />
                        <YAxis stroke="#ffffff50" tick={{fontSize: 11}} />
                        <Tooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px' }} />
                        <Area type="monotone" dataKey="moisture" stroke="#60A5FA" strokeWidth={2} fillOpacity={1} fill="url(#colorMoistSoil)" name="Moisture %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. RECOMMENDATIONS TAB */}
          {activeTab === 'recommendations' && latestRecord && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestRecord.fertilizerRecommendation && (
                <div className="p-6 rounded-3xl border border-green-500/20 bg-green-500/5 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300">
                  <Leaf className="h-8 w-8 text-green-400 mb-4" />
                  <h4 className="text-lg font-bold text-white mb-2">Fertilizer Advice</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{latestRecord.fertilizerRecommendation}</p>
                </div>
              )}
              {latestRecord.irrigationRecommendation && (
                <div className="p-6 rounded-3xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300">
                  <Droplets className="h-8 w-8 text-blue-400 mb-4" />
                  <h4 className="text-lg font-bold text-white mb-2">Irrigation Management</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{latestRecord.irrigationRecommendation}</p>
                </div>
              )}
              {currentRecs.map((rec, i) => (
                <div key={i} className="p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300">
                  <Activity className="h-8 w-8 text-cyan-400 mb-4" />
                  <h4 className="text-lg font-bold text-white mb-2">AI Insight {i + 1}</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{rec}</p>
                </div>
              ))}
              {/* Fallback if no structured recs */}
              {!latestRecord.fertilizerRecommendation && !latestRecord.irrigationRecommendation && currentRecs.length === 0 && [
                { title: 'Fertilizer Advice', desc: 'Maintain balanced nutrition levels.', icon: Leaf, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                { title: 'Irrigation Management', desc: 'Schedule water cycles matching humidity index.', icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { title: 'Crop Suitability', desc: 'Optimal for target variety growth.', icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                { title: 'Pathology & Risks', desc: 'No physical anomalies spotted.', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
                { title: 'Soil Quality', desc: 'Soil chemistry parsed.', icon: Info, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' }
              ].map((rec, i) => (
                <div key={i} className="p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300">
                  <rec.icon className={`h-8 w-8 ${rec.color} mb-4`} />
                  <h4 className="text-lg font-bold text-white mb-2">{rec.title}</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{rec.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* 4. HISTORY LOGS */}
          {activeTab === 'history' && (
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg overflow-hidden">
              <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-[#9333EA]" /> Past Soil Tests
                </h3>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search by date..." 
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full h-10 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="p-4">Date Logged</th>
                      <th className="p-4">pH</th>
                      <th className="p-4">Moisture</th>
                      <th className="p-4">N-P-K (mg/kg)</th>
                      <th className="p-4">Carbon (%)</th>
                      <th className="p-4">Microclimate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedHistory.map((h, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-sm text-white font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#9333EA]" />
                          {new Date(h.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-sm text-white">{h.pH}</td>
                        <td className="p-4 text-sm text-gray-300">{h.moisture}%</td>
                        <td className="p-4 text-xs font-mono text-gray-400">
                          <span className="text-green-400">{h.nitrogen || 0}</span> - <span className="text-yellow-400">{h.phosphorus || 0}</span> - <span className="text-purple-400">{h.potassium || 0}</span>
                        </td>
                        <td className="p-4 text-sm text-gray-300">{h.organicCarbon || 0}%</td>
                        <td className="p-4 text-xs text-gray-400">
                          Temp: {h.temperature || 0}°C / Humid: {h.humidity || 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. LOG SOIL TEST FORM TAB */}
          {activeTab === 'new-test' && (
            <div className="max-w-3xl mx-auto bg-[#121024]/90 border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#9333EA]/10 blur-[80px] rounded-full pointer-events-none" />
              
              <h3 className="text-xl font-bold text-white mb-6 border-b border-white/5 pb-3 flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-400" /> Log New Soil Test
              </h3>

              <form onSubmit={handleFormSubmit} className="space-y-6 relative z-10">
                {history.length === 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3 text-yellow-300">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold">No Soil Test Data Logged Yet</h4>
                      <p className="text-xs text-yellow-400/80 leading-relaxed mt-1">This farm site does not have any soil records. Please enter values from your chemical soil test below to calibrate recommendations.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* pH */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Soil pH Level</label>
                    <input 
                      type="number" step="any" required min="0" max="14" value={pH} onChange={e => setPh(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Moisture */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Moisture Content (%)</label>
                    <input 
                      type="number" step="any" required min="0" max="100" value={moisture} onChange={e => setMoisture(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Nitrogen */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Nitrogen (N) - mg/kg</label>
                    <input 
                      type="number" required min="0" value={nitrogen} onChange={e => setNitrogen(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Phosphorus */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Phosphorus (P) - mg/kg</label>
                    <input 
                      type="number" required min="0" value={phosphorus} onChange={e => setPhosphorus(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Potassium */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Potassium (K) - mg/kg</label>
                    <input 
                      type="number" required min="0" value={potassium} onChange={e => setPotassium(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Organic Carbon */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Organic Carbon (%)</label>
                    <input 
                      type="number" step="any" required min="0" max="100" value={organicCarbon} onChange={e => setOrganicCarbon(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Soil Temp (°C)</label>
                    <input 
                      type="number" step="any" required value={temperature} onChange={e => setTemperature(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>

                  {/* Humidity */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Ambient Humidity (%)</label>
                    <input 
                      type="number" step="any" required min="0" max="100" value={humidity} onChange={e => setHumidity(e.target.value)}
                      className="w-full h-11 px-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] text-white font-bold rounded-xl flex items-center gap-2 hover:shadow-lg disabled:opacity-50 active:scale-95 transition-all cursor-pointer focus:outline-none"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit Soil Test
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border bg-black/85 backdrop-blur-xl border-white/10 text-white">
            {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
