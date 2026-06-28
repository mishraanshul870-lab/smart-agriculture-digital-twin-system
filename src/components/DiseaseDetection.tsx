import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, X, CheckCircle2, Loader2, Sparkles, Image as ImageIcon, 
  AlertTriangle, History, Camera, Activity, Leaf, ShieldCheck, 
  Droplets, FileText, Download, Search, 
  BarChart2, TrendingUp, AlertCircle, RefreshCw, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Farm, User } from '../types';
import { CROP_TYPES } from '../utils/simData';
import { fetch } from '../utils/api';

interface DiseaseDetectionProps {
  user: User;
  farms: Farm[];
  activeFarm: Farm | null;
}

// REMOVED: generateExtendedReport() hash-based faker and MOCK_IMAGES — fields now come directly from Gemini Vision API.

export default function DiseaseDetection({ user, farms, activeFarm }: DiseaseDetectionProps) {
  // UI State
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'statistics'>('scan');
  const [selectedCrop, setSelectedCrop] = useState(activeFarm?.cropType || CROP_TYPES[0]);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  
  // Scan State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrop, setFilterCrop] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
 
  useEffect(() => {
    fetchHistory();
  }, [user.id]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/disease-history?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        // Use real fields from API — no fake data generation
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch diagnosis history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (file: File) => {
    setError('');
    setResult(null);

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5 MB limit. Please choose a smaller image.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Unsupported file format. Please upload an image.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setError('');
  };

  const triggerDiagnostic = async () => {
    if (!imagePreview) return;
    setLoading(true);
    setError('');

    try {
      const base64Data = imagePreview.split(',')[1];
      const mimeType = imageFile?.type || 'image/png';

      const response = await fetch('/api/disease-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          farmId: activeFarm?.id,
          base64Image: base64Data,
          mimeType,
          cropType: selectedCrop,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Diagnostics failed.');
      }

      // Use fields directly from Gemini response — no local fake data generation
      setResult({
        diseaseName: data.prediction.diseaseName,
        confidence: data.prediction.confidence,
        treatment: data.prediction.treatment,
        cropType: data.prediction.cropType || selectedCrop,
        severity: data.prediction.severity || 'Unknown',
        symptoms: data.prediction.symptoms || '',
        causes: data.prediction.causes || '',
        prevention: data.prediction.prevention || '',
        estimatedRecovery: data.prediction.estimatedRecovery || 'N/A',
        detectionTime: new Date().toLocaleTimeString()
      });
      
      fetchHistory();
    } catch (err: any) {
      setError(err.message || 'An error occurred during AI analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(h => 
    (filterCrop === 'All' || h.cropType === filterCrop) &&
    (h.diseaseName.toLowerCase().includes(searchQuery.toLowerCase()) || 
     new Date(h.createdAt).toLocaleDateString().includes(searchQuery))
  );
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportCSV = () => {
    const headers = ['Date', 'Crop', 'Disease', 'Confidence', 'Severity'];
    const rows = history.map(h => [
      new Date(h.createdAt).toLocaleDateString(),
      h.cropType,
      h.diseaseName,
      `${(h.confidence * 100).toFixed(1)}%`,
      h.severity
    ].map(val => `"${String(val ?? '').replace(/"/g, '""')}"`));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(",")].concat(rows.map(e => e.join(","))).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `disease_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const exportPDF = () => window.print();

  const totalScans = history.length;
  const healthyCount = history.filter(h => h.diseaseName.toLowerCase().includes('healthy')).length;
  const diseasedCount = totalScans - healthyCount;
  const accuracy = totalScans > 0 ? (history.reduce((acc, h) => acc + h.confidence, 0) / totalScans * 100).toFixed(1) : '0';
  
  const diseaseCounts: Record<string, number> = {};
  history.forEach(h => {
    if (!h.diseaseName.toLowerCase().includes('healthy')) {
      diseaseCounts[h.diseaseName] = (diseaseCounts[h.diseaseName] || 0) + 1;
    }
  });
  const mostCommon = Object.entries(diseaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const chartData = useMemo(() => {
    const months: Record<string, { healthy: number, diseased: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months[d.toLocaleString('default', { month: 'short' })] = { healthy: 0, diseased: 0 };
    }
    history.forEach(h => {
      const m = new Date(h.createdAt).toLocaleString('default', { month: 'short' });
      if (months[m]) {
        if (h.diseaseName.toLowerCase().includes('healthy')) months[m].healthy++;
        else months[m].diseased++;
      }
    });
    return Object.keys(months).map(k => ({ name: k, ...months[k] }));
  }, [history]);

  const pieData = useMemo(() => {
    const crops: Record<string, number> = {};
    history.forEach(h => crops[h.cropType] = (crops[h.cropType] || 0) + 1);
    return Object.keys(crops).map(k => ({ name: k, value: crops[k] }));
  }, [history]);
  const COLORS = ['#9333EA', '#D946EF', '#6366F1', '#3B82F6', '#10B981'];

  if (farms.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-center py-20 shadow-2xl">
        <AlertCircle className="h-12 w-12 text-[#9333EA] mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Farms Registered</h3>
        <p className="text-sm text-[#E9D5FF] mb-6">Please register a farm to run disease diagnostics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* 1. Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-white tracking-tight">AI Disease Detection</h2>
          </div>
          <p className="text-[#E9D5FF] max-w-2xl">
            Leverage Gemini Vision to identify pathogens, analyze severity, and generate actionable treatment plans instantly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-gray-400 font-medium items-center">
          Supported Crops:
          {CROP_TYPES.slice(0, 3).map(c => (
            <span key={c} className="text-white bg-white/10 px-2 py-0.5 rounded-md">{c}</span>
          ))}
          {CROP_TYPES.length > 3 && <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">+{CROP_TYPES.length - 3}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar">
        {[
          { id: 'scan', label: 'New Scan', icon: Camera },
          { id: 'history', label: 'History & Gallery', icon: History },
          { id: 'statistics', label: 'Statistics', icon: BarChart2 }
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
          {/* SCAN TAB */}
          {activeTab === 'scan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Upload */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#9333EA] to-[#C026D3]" />
                  <h3 className="text-lg font-bold text-white mb-4">Input Data</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Target Crop</label>
                      <select
                        value={selectedCrop}
                        onChange={(e) => setSelectedCrop(e.target.value)}
                        className="w-full h-12 bg-black/20 border border-white/10 rounded-xl text-white px-4 focus:outline-none focus:border-[#9333EA] transition-colors appearance-none"
                      >
                        {CROP_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
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

                    <div>
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Crop Image</label>
                      
                      {!imagePreview ? (
                        <div
                          onDragOver={onDragOver}
                          onDrop={onDrop}
                          className="border-2 border-dashed border-white/20 hover:border-[#9333EA]/50 bg-black/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all group h-[280px]"
                        >
                          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} className="hidden" accept="image/*" />
                          <input type="file" ref={cameraInputRef} onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} className="hidden" accept="image/*" capture="environment" />
                          
                          <div className="flex gap-4 mb-4">
                            <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-transform hover:scale-105 border border-white/10 focus:outline-none">
                              <Upload className="h-6 w-6 text-[#D946EF]" />
                            </button>
                            <button onClick={() => cameraInputRef.current?.click()} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-transform hover:scale-105 border border-white/10 focus:outline-none">
                              <Camera className="h-6 w-6 text-[#9333EA]" />
                            </button>
                          </div>
                          <p className="text-sm font-bold text-white mb-1">Upload or capture an image</p>
                          <p className="text-xs text-gray-500">Drag & drop PNG or JPG up to 5MB</p>
                        </div>
                      ) : (
                        <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-black/40 h-[280px] flex items-center justify-center group">
                          <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                          
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold text-white flex items-center gap-2 backdrop-blur-md transition-colors focus:outline-none">
                              <RefreshCw className="h-4 w-4" /> Replace
                            </button>
                            <button onClick={removeImage} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 rounded-lg text-sm font-bold text-red-100 flex items-center gap-2 backdrop-blur-md transition-colors focus:outline-none">
                              <X className="h-4 w-4" /> Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p>{error}</p>
                      </div>
                    )}

                    <button
                      onClick={triggerDiagnostic}
                      disabled={loading || !imagePreview}
                      className="w-full h-14 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:opacity-90 disabled:opacity-50 disabled:grayscale text-white font-bold rounded-xl text-base transition-all flex items-center justify-center gap-2 focus:outline-none shadow-lg shadow-[#9333EA]/20"
                    >
                      {loading ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing via Gemini Vision...</>
                      ) : (
                        <><Sparkles className="h-5 w-5" /> Analyze Image</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Analysis & Report */}
              <div className="lg:col-span-7">
                {result ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-[#121024] to-[#1a1736] p-6 sm:p-8 rounded-3xl border border-[#9333EA]/30 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#9333EA]/10 blur-[80px] rounded-full" />
                    
                    {/* Header Banner */}
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-8 relative z-10">
                      <div>
                        <span className="text-xs text-[#D946EF] font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                          <Activity className="h-4 w-4" /> AI Diagnostics Result
                        </span>
                        <h2 className="text-3xl font-black text-white">{result.diseaseName}</h2>
                      </div>
                      
                      <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${
                        result.diseaseName.toLowerCase().includes('healthy') 
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}>
                        {result.diseaseName.toLowerCase().includes('healthy') ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        <span className="font-bold">
                          {result.diseaseName.toLowerCase().includes('healthy') ? 'Healthy Plant' : 'Infection Detected'}
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative z-10">
                      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 block">Confidence</span>
                        <span className="text-2xl font-black text-white">{(result.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 block">Severity</span>
                        <span className={`text-xl font-bold ${
                          result.severity === 'Critical' || result.severity === 'High' ? 'text-red-400' : 
                          result.severity === 'Moderate' ? 'text-yellow-400' : 'text-green-400'
                        }`}>{result.severity}</span>
                      </div>
                      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 block">Crop</span>
                        <span className="text-lg font-bold text-white truncate">{result.cropType}</span>
                      </div>
                      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 block">Detection Time</span>
                        <span className="text-base font-bold text-white truncate">{result.detectionTime}</span>
                      </div>
                    </div>

                    {/* Actionable Report */}
                    <div className="space-y-4 relative z-10">
                      <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                        <h4 className="text-sm font-bold text-[#D946EF] flex items-center gap-2 mb-2"><Leaf className="h-4 w-4" /> Symptoms & Causes</h4>
                        <p className="text-sm text-gray-300 mb-2"><strong className="text-white">Symptoms:</strong> {result.symptoms}</p>
                        <p className="text-sm text-gray-300"><strong className="text-white">Causes:</strong> {result.causes}</p>
                      </div>

                      <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 p-5 rounded-2xl">
                        <h4 className="text-sm font-bold text-[#E9D5FF] flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4" /> Treatment Plan</h4>
                        <p className="text-sm text-white font-medium leading-relaxed">{result.treatment}</p>
                        <p className="text-xs text-[#E9D5FF] mt-2 border-t border-white/10 pt-2"><strong className="text-white">Prevention:</strong> {result.prevention}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                          <h4 className="text-xs font-bold text-blue-400 flex items-center gap-2 mb-2"><Droplets className="h-4 w-4" /> Irrigation Advice</h4>
                          <p className="text-xs text-gray-300">{result.irrigation}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                          <h4 className="text-xs font-bold text-green-400 flex items-center gap-2 mb-2"><Activity className="h-4 w-4" /> Fertilizer</h4>
                          <p className="text-xs text-gray-300">{result.fertilizer}</p>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estimated Recovery</span>
                        <span className="text-sm font-bold text-white">{result.recoveryTime}</span>
                      </div>
                    </div>

                    {/* Similar Diseases (if any) */}
                    {result.similar && result.similar.length > 0 && (
                      <div className="mt-8 relative z-10 border-t border-white/10 pt-6">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Visually Similar Pathogens</h4>
                        <div className="flex flex-wrap gap-3">
                          {result.similar.map((sim: any, i: number) => (
                            <div key={i} className="px-3 py-1.5 bg-black/40 border border-white/5 rounded-lg flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-300">{sim.name}</span>
                              <span className="text-xs font-mono text-gray-500">{sim.conf}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl h-full min-h-[500px] flex flex-col items-center justify-center text-center shadow-lg">
                    {loading ? (
                      <>
                        <div className="relative w-24 h-24 mb-6">
                           <div className="absolute inset-0 border-4 border-[#9333EA]/30 rounded-full border-t-[#D946EF] animate-spin" />
                           <div className="absolute inset-2 border-4 border-[#3B82F6]/30 rounded-full border-b-[#3B82F6] animate-[spin_2s_linear_reverse]" />
                           <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-[#E9D5FF] animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Analyzing Biomarkers</h3>
                        <p className="text-sm text-gray-400 max-w-sm">Gemini Vision is extracting features and identifying potential pathogens in real-time...</p>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 bg-black/20 rounded-full flex items-center justify-center mb-6">
                          <ImageIcon className="h-8 w-8 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-300 mb-2">Waiting for Image</h3>
                        <p className="text-sm text-gray-500 max-w-sm">Upload a high-quality image of the affected plant leaf to generate a comprehensive AI report.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="h-6 w-6 text-[#9333EA]" /> Scan History Gallery
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search diseases..." 
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="h-10 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] w-full md:w-48"
                    />
                  </div>
                  <select
                    value={filterCrop}
                    onChange={(e) => { setFilterCrop(e.target.value); setCurrentPage(1); }}
                    className="h-10 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] w-full md:w-auto"
                  >
                    <option value="All">All Crops</option>
                    {CROP_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={exportCSV} className="flex-1 md:flex-none justify-center px-4 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors focus:outline-none">
                    <Download className="h-4 w-4" /> CSV
                  </button>
                  <button onClick={exportPDF} className="flex-1 md:flex-none justify-center px-4 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors focus:outline-none">
                    <FileText className="h-4 w-4" /> PDF
                  </button>
                </div>
              </div>

              {loadingHistory ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-64 flex flex-col justify-between p-4">
                      <div className="h-32 bg-white/10 rounded-xl w-full" />
                      <div className="space-y-2 mt-4">
                        <div className="h-4 bg-white/10 rounded w-2/3" />
                        <div className="h-3 bg-white/10 rounded w-1/2" />
                      </div>
                      <div className="h-6 bg-white/10 rounded-lg w-1/3 self-end mt-4" />
                    </div>
                  ))}
                </div>
              ) : paginatedHistory.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {paginatedHistory.map((h, i) => (
                      <div key={i} className="group bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-[#9333EA]/50 transition-colors">
                        <div className="h-40 relative overflow-hidden bg-black/60">
                          {h.imageUrl ? (
                            <img src={h.imageUrl} alt={h.diseaseName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-white/20" /></div>
                          )}
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded-md border border-white/10 text-xs font-bold text-white flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-[#D946EF]" /> {(h.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="p-4">
                          <h4 className="text-base font-bold text-white mb-1 truncate">{h.diseaseName}</h4>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">{h.cropType}</span>
                            <span className="text-gray-500">{new Date(h.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                              h.diseaseName.toLowerCase().includes('healthy') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {h.severity || (h.diseaseName.toLowerCase().includes('healthy') ? 'None' : 'Detected')}
                            </span>
                            <button
                              onClick={() => {
                                setResult({
                                  diseaseName: h.diseaseName,
                                  confidence: h.confidence,
                                  treatment: h.treatment,
                                  cropType: h.cropType,
                                  severity: h.severity || 'Unknown',
                                  symptoms: h.symptoms || '',
                                  causes: h.causes || '',
                                  prevention: h.prevention || '',
                                  estimatedRecovery: h.estimatedRecovery || 'N/A',
                                  irrigation: h.irrigation || '',
                                  fertilizer: h.fertilizer || '',
                                  detectionTime: new Date(h.createdAt).toLocaleTimeString()
                                });
                                setImagePreview(h.imageUrl || null);
                                setSelectedCrop(h.cropType);
                                setActiveTab('scan');
                              }}
                              className="text-[#9333EA] hover:text-[#D946EF] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3" /> Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 flex-wrap">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all focus:outline-none ${
                            currentPage === i + 1 
                              ? 'bg-gradient-to-r from-[#9333EA] to-[#C026D3] text-white shadow-lg shadow-[#9333EA]/30' 
                              : 'bg-black/20 border border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center">
                  <ImageIcon className="h-12 w-12 text-white/10 mx-auto mb-4" />
                  <p className="text-gray-500">No historical scans match your criteria.</p>
                </div>
              )}
            </div>
          )}

          {/* STATISTICS TAB */}
          {activeTab === 'statistics' && (
            <div className="space-y-6">
              {/* Top Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Total Scans</span>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-white">{totalScans}</span>
                    <TrendingUp className="h-6 w-6 text-[#9333EA] mb-1" />
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Detection Accuracy</span>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-[#D946EF]">{accuracy}%</span>
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Healthy Plants</span>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-green-400">{healthyCount}</span>
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg flex flex-col justify-center">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Most Common</span>
                  <span className="text-lg font-bold text-red-400 leading-tight mt-1 truncate block">{mostCommon}</span>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <h3 className="text-sm font-bold text-white mb-6">Monthly Detection Trends</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorDiseased" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorHealthy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#ffffff50" tick={{fontSize: 12}} />
                        <YAxis stroke="#ffffff50" tick={{fontSize: 12}} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px' }} />
                        <Area type="monotone" dataKey="diseased" stroke="#EF4444" fillOpacity={1} fill="url(#colorDiseased)" name="Diseased" />
                        <Area type="monotone" dataKey="healthy" stroke="#10B981" fillOpacity={1} fill="url(#colorHealthy)" name="Healthy" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-lg">
                  <h3 className="text-sm font-bold text-white mb-6">Scans by Crop Type</h3>
                  <div className="h-72 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
