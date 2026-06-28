import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Sprout, Droplets, Thermometer, TrendingUp, Sparkles, AlertCircle, RefreshCw, 
  History, Loader2, Save, CloudRain, Sun, Wind, DollarSign, Target, ShieldCheck, FileText, 
  Download, Search, BarChart2, PieChart as PieChartIcon, Activity, Leaf, CheckCircle2,
  AlertTriangle, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Farm, User } from '../types';
import { CROP_TYPES } from '../utils/simData';
import { fetch } from '../utils/api';

interface YieldCalculatorProps {
  user: User;
  farms: Farm[];
  activeFarm: Farm | null;
}

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SOIL_TYPES = ['Loam', 'Clay', 'Sandy', 'Silt', 'Peaty'];
const WEATHER_CONDITIONS = ['Sunny', 'Rainy', 'Cloudy', 'Extreme', 'Moderate'];
const IRRIGATION_TYPES = ['Drip', 'Sprinkler', 'Flood', 'Manual'];
const FERTILIZER_TYPES = ['Organic', 'NPK Synthetic', 'Mixed', 'None'];

export default function YieldCalculator({ user, farms, activeFarm }: YieldCalculatorProps) {
  const [activeTab, setActiveTab] = useState<'predict' | 'charts' | 'history'>('predict');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  
  // Inputs
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [cropType, setCropType] = useState(activeFarm?.cropType || CROP_TYPES[0]);
  const [area, setArea] = useState<number>(activeFarm?.area || 10);
  const [season, setSeason] = useState(SEASONS[0]);
  const [soilType, setSoilType] = useState(SOIL_TYPES[0]);
  const [irrigation, setIrrigation] = useState(IRRIGATION_TYPES[0]);
  const [fertilizer, setFertilizer] = useState(FERTILIZER_TYPES[0]);
  const [historicalYield, setHistoricalYield] = useState<number>(50);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
 
  // Prediction State
  const [isPredicting, setIsPredicting] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  
  // History
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrop, setFilterCrop] = useState('All');
  const [sortOrder, setSortOrder] = useState('Newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
 
  useEffect(() => {
    if (activeFarm) {
      setSelectedFarmId(activeFarm.id);
      setCropType(activeFarm.cropType);
      setArea(activeFarm.area);
    } else if (farms.length > 0) {
      setSelectedFarmId(farms[0].id);
      setCropType(farms[0].cropType);
      setArea(farms[0].area);
    }
  }, [activeFarm, farms]);
 
  useEffect(() => {
    if (user?.id) {
      fetchHistory();
    }
  }, [user?.id]);
 
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
 
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/yield-predictions?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to fetch prediction history', err);
      showToast('Failed to load history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };
 
  const handleFarmSelect = (id: string) => {
    setSelectedFarmId(id);
    const farm = farms.find(f => f.id === id);
    if (farm) {
      setCropType(farm.cropType);
      setArea(farm.area);
    }
  };
 
  const generatePrediction = async () => {
    if (!selectedFarmId) {
      showToast('Please select a farm first.', 'error');
      return;
    }
    setIsPredicting(true);
    try {
      const res = await fetch('/api/yield-predictions/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: selectedFarmId,
          cropType,
          area,
          season,
          soilType,
          irrigation,
          fertilizer,
          historicalYield,
          language
        })
      });
      const data = await res.json();
      if (data.success && data.prediction) {
        setPrediction(data.prediction);
        showToast('AI Prediction Generated Successfully Using Live Farm Data');
        savePredictionToDB(data.prediction);
        setIsPredicting(false);
        return;
      } else {
        throw new Error(data.message || 'Prediction failed');
      }
    } catch (err: any) {
      console.error("Prediction error", err);
      showToast(err.message || 'Prediction failed. Please check connection.', 'error');
      setIsPredicting(false);
    }
  };
 
  const savePredictionToDB = async (result: any) => {
    try {
      const res = await fetch('/api/yield-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          farmId: selectedFarmId,
          cropType,
          area,
          predictedYield: parseFloat(result.expectedYield),
          errorMargin: parseFloat((100 - parseFloat(result.accuracy)).toFixed(1))
        })
      });
      const data = await res.json();
      if (data.success) fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };
 
  // History filtering and pagination
  const sortedHistory = [...history].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (sortOrder === 'Newest') return timeB - timeA;
    if (sortOrder === 'Oldest') return timeA - timeB;
    const yieldA = parseFloat(a.predictedYield) || 0;
    const yieldB = parseFloat(b.predictedYield) || 0;
    if (sortOrder === 'Highest Yield') return yieldB - yieldA;
    return yieldA - yieldB;
  });
  
  const filteredHistory = sortedHistory.filter(h => {
    const matchCrop = filterCrop === 'All' || h.cropType === filterCrop;
    const cropStr = (h.cropType || '').toLowerCase();
    const dateStr = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '';
    const matchSearch = cropStr.includes(searchQuery.toLowerCase()) || dateStr.includes(searchQuery);
    return matchCrop && matchSearch;
  });
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
 
  const exportCSV = () => {
    const headers = ['Date', 'Crop', 'Area', 'Predicted Yield', 'Error Margin'];
    const rows = history.map(h => [
      new Date(h.createdAt).toLocaleDateString(),
      h.cropType,
      `${h.area} acres`,
      `${h.predictedYield} tons`,
      `${h.errorMargin}%`
    ]);
    const csvContent = [headers.join(",")].concat(rows.map(e => e.join(","))).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `yield_predictions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Exported Successfully');
  };
 
  const exportPDF = () => {
    window.print();
  };
 
  // Chart Data Generation
  const revenueChartData = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const month = new Date();
      month.setMonth(month.getMonth() - (5 - i));
      return {
        name: month.toLocaleString('default', { month: 'short' }),
        revenue: Math.floor(Math.random() * 50000 + 10000),
        cost: Math.floor(Math.random() * 20000 + 5000)
      };
    });
  }, []);
 
  const cropComparisonData = useMemo(() => {
    const crops = ['Wheat', 'Corn', 'Rice', 'Tomato', 'Soybean'];
    return crops.map(c => ({
      name: c,
      yield: Math.floor(Math.random() * 200 + 50)
    }));
  }, []);
 
  if (farms.length === 0) {
    return (
      <div className="bg-[#121024]/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-center py-20 shadow-2xl">
        <AlertCircle className="h-12 w-12 text-[#9333EA] mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Farms Registered</h3>
        <p className="text-sm text-[#E9D5FF] mb-6">Register a farm to perform yield predictions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border backdrop-blur-xl ${
              toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'bg-[#9333EA]/20 border-[#9333EA]/50 text-[#E9D5FF]'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-white tracking-tight">AI Yield Prediction</h2>

          </div>
          <p className="text-[#E9D5FF] max-w-2xl">
            Advanced machine learning models predicting crop yields, optimizing resources, and forecasting revenue.
          </p>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Predicted Yield', value: prediction ? `${prediction.expectedYield}t` : '--', icon: Layers, color: 'text-[#D946EF]' },
          { label: 'Expected Revenue', value: prediction ? `$${Number(prediction.revenue).toLocaleString()}` : '--', icon: DollarSign, color: 'text-blue-400' },
          { label: 'Accuracy Score', value: prediction ? `${prediction.accuracy}%` : '--', icon: Target, color: 'text-purple-400' },
          { label: 'Confidence', value: prediction ? prediction.confidenceLevel : '--', icon: ShieldCheck, color: 'text-amber-400' },
          { label: 'Production Cost', value: prediction ? `$${Number(prediction.cost).toLocaleString()}` : '--', icon: Activity, color: 'text-rose-400' },
          { label: 'Profit Est.', value: prediction ? `$${Number(prediction.profit).toLocaleString()}` : '--', icon: TrendingUp, color: 'text-emerald-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-gradient-to-br from-[#121024] to-[#1E1B4B] p-5 rounded-2xl border border-white/10 flex flex-col justify-between group hover:bg-white/5 transition-colors shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color} opacity-80`} />
            </div>
            <span className="text-2xl font-black text-white truncate">{isPredicting ? '-' : stat.value}</span>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar">
        {[
          { id: 'predict', label: 'Prediction Engine', icon: Sparkles },
          { id: 'charts', label: 'Analytics & Charts', icon: BarChart2 },
          { id: 'history', label: 'History Logs', icon: History }
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

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* PREDICT TAB */}
          {activeTab === 'predict' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Inputs */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#9333EA] to-[#C026D3]" />
                  <h3 className="text-lg font-bold text-white mb-6">Simulation Parameters</h3>
                  
                  <div className="space-y-4">
                    {/* Farm & Crop */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Farm Location</label>
                        <select
                          value={selectedFarmId}
                          onChange={(e) => handleFarmSelect(e.target.value)}
                          className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 focus:outline-none focus:border-[#9333EA] text-sm transition-colors"
                        >
                          {farms.map((f) => <option key={f.id} value={f.id} className="bg-[#121024]">{f.name}</option>)}

                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Target Crop</label>
                        <select
                          value={cropType}
                          onChange={(e) => setCropType(e.target.value)}
                          className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 focus:outline-none focus:border-[#9333EA] text-sm transition-colors"
                        >
                          {CROP_TYPES.map((c) => <option key={c} value={c} className="bg-[#121024]">{c}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Area Slider */}
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Planted Area</label>
                        <span className="text-sm font-bold text-[#D946EF]">{area} Acres</span>
                      </div>
                      <input
                        type="range" min="1" max="500" value={area}
                        onChange={(e) => setArea(parseInt(e.target.value))}
                        className="w-full accent-[#9333EA] h-2 bg-black/40 rounded-lg cursor-pointer appearance-none"
                      />
                    </div>

                    {/* Season & Soil */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Growing Season</label>
                        <select value={season} onChange={(e) => setSeason(e.target.value)} className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 text-sm focus:outline-none focus:border-[#9333EA] transition-colors">
                          {SEASONS.map(s => <option key={s} value={s} className="bg-[#121024]">{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Soil Composition</label>
                        <select value={soilType} onChange={(e) => setSoilType(e.target.value)} className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 text-sm focus:outline-none focus:border-[#9333EA] transition-colors">
                          {SOIL_TYPES.map(s => <option key={s} value={s} className="bg-[#121024]">{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Irrigation & Fertilizer */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Irrigation System</label>
                        <select value={irrigation} onChange={(e) => setIrrigation(e.target.value)} className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 text-sm focus:outline-none focus:border-[#9333EA] transition-colors">
                          {IRRIGATION_TYPES.map(i => <option key={i} value={i} className="bg-[#121024]">{i}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Fertilizer Regimen</label>
                        <select value={fertilizer} onChange={(e) => setFertilizer(e.target.value)} className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 text-sm focus:outline-none focus:border-[#9333EA] transition-colors">
                          {FERTILIZER_TYPES.map(f => <option key={f} value={f} className="bg-[#121024]">{f}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Historic Yield */}
                    <div>
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Hist. Yield (t)</label>
                      <input type="number" value={historicalYield} onChange={(e) => setHistoricalYield(Number(e.target.value))} className="w-full h-11 bg-black/40 border border-white/10 rounded-xl text-white px-3 text-sm focus:outline-none focus:border-[#9333EA] transition-colors" />
                    </div>

                    {/* Language Toggle */}
                    <div>
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">AI Response Language</label>
                      <div className="flex rounded-xl border border-white/10 overflow-hidden bg-black/20">
                        <button
                          type="button"
                          onClick={() => setLanguage('en')}
                          className={`flex-1 py-2.5 text-xs font-bold transition-all focus:outline-none cursor-pointer ${
                            language === 'en'
                              ? 'bg-[#9333EA]/20 text-[#D946EF] border-r border-[#9333EA]/30'
                              : 'text-gray-400 hover:text-white border-r border-white/10'
                          }`}
                        >
                          English
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguage('hi')}
                          className={`flex-1 py-2.5 text-xs font-bold transition-all focus:outline-none cursor-pointer ${
                            language === 'hi'
                              ? 'bg-[#9333EA]/20 text-[#D946EF]'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          हिन्दी
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => generatePrediction()}
                      disabled={isPredicting}
                      className="w-full h-14 mt-6 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 focus:outline-none shadow-lg shadow-[#9333EA]/20"
                    >
                      {isPredicting ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Simulating Outcomes...</>
                      ) : (
                        <><Sparkles className="h-5 w-5" /> Generate AI Prediction</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Prediction Results */}
              <div className="lg:col-span-7 h-full">
                {isPredicting ? (
                  <div className="bg-[#121024]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl h-full min-h-[600px] flex flex-col items-center justify-center text-center shadow-2xl">
                    <Loader2 className="h-12 w-12 text-[#D946EF] animate-spin mb-6" />
                    <h3 className="text-xl font-bold text-white mb-2">Simulating Neural Grid...</h3>
                    <p className="text-gray-400 max-w-sm">Evaluating multi-variable environmental, historical metadata, and crop characteristics.</p>
                    <div className="mt-8 w-64 h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: '100%' }} 
                        transition={{ duration: 1.5, ease: "linear" }}
                        className="h-full bg-gradient-to-r from-[#9333EA] to-[#D946EF]"
                      />
                    </div>
                  </div>
                ) : prediction ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-[#1E1B4B] to-[#121024] p-8 rounded-3xl border border-[#9333EA]/30 shadow-2xl space-y-8 h-full"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs text-[#D946EF] font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Prediction Complete
                        </span>
                        <h2 className="text-5xl font-black text-white">{prediction.expectedYield} <span className="text-2xl text-gray-400 font-medium tracking-normal">tons</span></h2>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Est. Revenue</span>
                        <div className="text-3xl font-black text-[#10B981]">${Number(prediction.revenue).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* AI Impact Factors */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-2"><CloudRain className="h-4 w-4" /> Weather</div>
                        <div className={`text-base font-bold ${prediction.weatherImpact === 'Positive' ? 'text-green-400' : 'text-red-400'}`}>{prediction.weatherImpact}</div>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-2"><ShieldCheck className="h-4 w-4" /> Disease Risk</div>
                        <div className={`text-base font-bold ${prediction.diseaseRisk === 'Low' ? 'text-green-400' : 'text-yellow-400'}`}>{prediction.diseaseRisk}</div>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-2"><Leaf className="h-4 w-4" /> Fertilizer</div>
                        <div className={`text-base font-bold ${prediction.fertilizerImpact === 'Optimal' ? 'text-green-400' : 'text-amber-400'}`}>{prediction.fertilizerImpact}</div>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-2"><Droplets className="h-4 w-4" /> Water Needs</div>
                        <div className={`text-base font-bold text-blue-400`}>{prediction.waterRequirement}</div>
                      </div>
                    </div>

                    {/* AI Recommendations */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                      <h4 className="text-base font-bold text-white flex items-center gap-2 mb-5"><Sparkles className="h-5 w-5 text-[#D946EF]" /> AI Action Plan</h4>
                      <ul className="space-y-4">
                        <li className="flex items-start gap-4">
                          <div className="bg-emerald-500/20 p-2 rounded-lg shrink-0 mt-0.5"><TrendingUp className="h-4 w-4 text-emerald-400" /></div>
                          <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Increase Yield</span><p className="text-sm text-gray-200">{prediction.recommendations?.increaseYield || 'N/A'}</p></div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="bg-blue-500/20 p-2 rounded-lg shrink-0 mt-0.5"><Droplets className="h-4 w-4 text-blue-400" /></div>
                          <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Water Optimization</span><p className="text-sm text-gray-200">{prediction.recommendations?.waterOpt || 'N/A'}</p></div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="bg-amber-500/20 p-2 rounded-lg shrink-0 mt-0.5"><Leaf className="h-4 w-4 text-amber-400" /></div>
                          <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Nutrient Care</span><p className="text-sm text-gray-200">{prediction.recommendations?.nutrient || 'N/A'}</p></div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="bg-rose-500/20 p-2 rounded-lg shrink-0 mt-0.5"><ShieldCheck className="h-4 w-4 text-rose-400" /></div>
                          <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Disease Prevention</span><p className="text-sm text-gray-200">{prediction.recommendations?.disease || 'N/A'}</p></div>
                        </li>
                      </ul>
                      <div className="mt-6 pt-5 border-t border-white/10">
                        <div className="flex items-start gap-4">
                          <div className="bg-purple-500/20 p-2 rounded-lg shrink-0 mt-0.5"><AlertTriangle className="h-4 w-4 text-purple-400" /></div>
                          <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Risk Analysis</span><p className="text-sm text-gray-200">{prediction.riskAnalysis || 'N/A'}</p></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-[#121024]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl h-full min-h-[600px] flex flex-col items-center justify-center text-center shadow-2xl">
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                      <BarChart2 className="h-10 w-10 text-gray-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Awaiting Parameters</h3>
                    <p className="text-gray-400 max-w-md">Adjust the simulation inputs and generate an AI prediction to view the forecasted yield, revenue, and actionable recommendations.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHARTS TAB */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Forecast */}
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                  <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><DollarSign className="h-5 w-5 text-emerald-400" /> Revenue vs Cost Forecast</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#ffffff50" tick={{fontSize: 12}} />
                        <YAxis stroke="#ffffff50" tick={{fontSize: 12}} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                        <Area type="monotone" dataKey="revenue" stroke="#10B981" fillOpacity={1} fill="url(#colorRev)" name="Revenue ($)" />
                        <Area type="monotone" dataKey="cost" stroke="#EF4444" fillOpacity={1} fill="url(#colorCost)" name="Cost ($)" />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Crop Comparison */}
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                  <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><BarChart2 className="h-5 w-5 text-blue-400" /> Regional Crop Comparison (Avg Tons)</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cropComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#ffffff50" tick={{fontSize: 12}} />
                        <YAxis stroke="#ffffff50" tick={{fontSize: 12}} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} cursor={{fill: '#ffffff05'}} />
                        <Bar dataKey="yield" fill="#9333EA" radius={[6, 6, 0, 0]} name="Average Yield (t)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Historical vs Predicted */}
                <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl lg:col-span-2">
                  <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-purple-400" /> Historic vs Predicted Trend</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueChartData.map((d, i) => ({ name: d.name, historic: d.cost / 200, predicted: d.revenue / 300 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#ffffff50" tick={{fontSize: 12}} />
                        <YAxis stroke="#ffffff50" tick={{fontSize: 12}} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="historic" stroke="#8B5CF6" strokeWidth={3} dot={{r: 4}} name="Historic Yield (t)" />
                        <Line type="monotone" dataKey="predicted" stroke="#10B981" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} name="Predicted Yield (t)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="bg-[#121024]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="h-6 w-6 text-[#9333EA]" /> Prediction Archive
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" placeholder="Search crops..." value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full h-10 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2 border border-white/10 rounded-xl p-1 bg-black/40">
                    <select value={filterCrop} onChange={e => { setFilterCrop(e.target.value); setCurrentPage(1); }} className="h-8 bg-transparent text-sm text-white focus:outline-none px-3 appearance-none">
                      <option value="All" className="bg-[#121024]">All Crops</option>
                      {CROP_TYPES.map(c => <option key={c} value={c} className="bg-[#121024]">{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 border border-white/10 rounded-xl p-1 bg-black/40">
                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="h-8 bg-transparent text-sm text-white focus:outline-none px-3 appearance-none">
                      <option className="bg-[#121024]">Newest</option>
                      <option className="bg-[#121024]">Oldest</option>
                      <option className="bg-[#121024]">Highest Yield</option>
                      <option className="bg-[#121024]">Lowest Yield</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button onClick={exportCSV} className="px-3 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                      <Download className="h-4 w-4" /> CSV
                    </button>
                    <button onClick={exportPDF} className="px-3 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                      <FileText className="h-4 w-4" /> PDF
                    </button>
                  </div>
                </div>
              </div>

              {loadingHistory ? (
                <div className="overflow-x-auto min-h-[400px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400 bg-black/20">
                        <th className="p-5 font-bold">Date</th>
                        <th className="p-5 font-bold">Crop Type</th>
                        <th className="p-5 font-bold">Planted Area</th>
                        <th className="p-5 font-bold">Predicted Yield</th>
                        <th className="p-5 font-bold">Accuracy</th>
                        <th className="p-5 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="p-5"><div className="h-4 w-20 bg-white/10 rounded" /></td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/10" />
                              <div className="h-4 w-24 bg-white/10 rounded" />
                            </div>
                          </td>
                          <td className="p-5"><div className="h-4 w-16 bg-white/10 rounded" /></td>
                          <td className="p-5"><div className="h-4 w-16 bg-white/10 rounded" /></td>
                          <td className="p-5"><div className="h-4 w-12 bg-white/10 rounded" /></td>
                          <td className="p-5"><div className="h-6 w-16 bg-white/10 rounded-full" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : paginatedHistory.length > 0 ? (
                <div className="overflow-x-auto min-h-[400px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400 bg-black/20">
                        <th className="p-5 font-bold">Date</th>
                        <th className="p-5 font-bold">Crop Type</th>
                        <th className="p-5 font-bold">Planted Area</th>
                        <th className="p-5 font-bold">Predicted Yield</th>
                        <th className="p-5 font-bold">Accuracy</th>
                        <th className="p-5 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {paginatedHistory.map((row, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors text-sm text-gray-200">
                          <td className="p-5 whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString()}</td>
                          <td className="p-5 font-bold text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                              <Sprout className="h-4 w-4 text-[#10B981]" />
                            </div>
                            {row.cropType}
                          </td>
                          <td className="p-5">{row.area} Acres</td>
                          <td className="p-5 font-black text-[#34D399]">{row.predictedYield} t</td>
                          <td className="p-5 font-mono text-gray-400">{(100 - row.errorMargin).toFixed(1)}%</td>
                          <td className="p-5">
                            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold uppercase tracking-wider rounded-full">Saved</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-24 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="h-8 w-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No Predictions Found</h3>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto">Generate some AI yield predictions or adjust your filters to see historical data.</p>
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
                  <span className="text-sm text-gray-400">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length} entries</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white transition-colors"
                    ><ChevronLeft className="h-4 w-4" /></button>
                    <div className="text-sm font-bold text-white px-4">{currentPage} / {totalPages}</div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white transition-colors"
                    ><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
