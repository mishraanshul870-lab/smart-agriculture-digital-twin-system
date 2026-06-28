import React, { useState, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, MapPin, Layers, Sprout, Check, X, AlertTriangle, 
  Loader2, Search, ArrowUpDown, Droplets, CloudRain,
  Thermometer, Activity, ArrowLeft, Image as ImageIcon,
  Map as MapIcon, Calendar, CheckCircle2, AlertCircle, Wind, ChevronRight, Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Farm, User } from '../types';
import { CROP_TYPES } from '../utils/simData';

interface FarmManagementProps {
  user: User;
  farms: Farm[];
  onAddFarm: (name: string, area: number, cropType: string, location: string) => Promise<void>;
  onEditFarm: (farmId: string, name: string, area: number, cropType: string, location: string) => Promise<void>;
  onDeleteFarm: (farmId: string) => Promise<void>;
}

export default function FarmManagement({ user, farms, onAddFarm, onEditFarm, onDeleteFarm }: FarmManagementProps) {
  // State for view toggling
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [cropType, setCropType] = useState(CROP_TYPES[0]);
  const [location, setLocation] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'area' | 'newest'>('newest');
  const [filterCrop, setFilterCrop] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setName('');
    setArea('');
    setCropType(CROP_TYPES[0]);
    setLocation('');
    setImagePreview(null);
  };

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (farm: Farm) => {
    setName(farm.name);
    setArea(farm.area.toString());
    setCropType(farm.cropType);
    setLocation(farm.location);
    setImagePreview(null); // Assuming image isn't saved to DB yet per data model constraints
    setEditingId(farm.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !area || !cropType || !location) {
      showToast('Please fill in all fields.', 'error');
      return;
    }
    const areaVal = parseFloat(area);
    if (isNaN(areaVal) || areaVal <= 0) {
      showToast('Area must be a positive number.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await onEditFarm(editingId, name, areaVal, cropType, location);
        showToast('Farm updated successfully!', 'success');
      } else {
        await onAddFarm(name, areaVal, cropType, location);
        showToast('Farm added successfully!', 'success');
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err: any) {
      showToast(err.message || 'Operation failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await onDeleteFarm(id);
      showToast('Farm deleted successfully.', 'success');
      setDeleteConfirmId(null);
      if (selectedFarm?.id === id) {
        setSelectedFarm(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete farm.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getFarmImage = (crop: string) => {
    const map: Record<string, string> = {
      'Wheat': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&q=80',
      'Rice': 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=500&q=80',
      'Maize': 'https://images.unsplash.com/photo-1601002361660-f00e57c6b5b5?w=500&q=80',
      'Cotton': 'https://images.unsplash.com/photo-1596739343725-780829875e53?w=500&q=80',
      'Sugarcane': 'https://images.unsplash.com/photo-1626084050212-094191d4e414?w=500&q=80'
    };
    return map[crop] || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=500&q=80';
  };

  const filteredAndSortedFarms = useMemo(() => {
    let result = farms.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filterCrop !== 'all') {
      result = result.filter(f => f.cropType === filterCrop);
    }
    
    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'area') {
      result.sort((a, b) => b.area - a.area);
    } else {
      // Keep existing array order (newest typically matches list order from backend if returned like that)
    }
    return result;
  }, [farms, searchQuery, sortBy, filterCrop]);

  // Reset to page 1 on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterCrop]);

  const paginatedFarms = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedFarms.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedFarms, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedFarms.length / itemsPerPage);

  const totalArea = farms.reduce((sum, f) => sum + f.area, 0);
  const uniqueCrops = new Set(farms.map(f => f.cropType)).size;

  // Modals Render
  const renderModals = () => (
    <AnimatePresence>
      {/* Add/Edit Modal */}
      {isFormOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#121024] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingId ? 'Edit Field Digital Twin' : 'Register New Field'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white transition-colors focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Image Upload Placeholder */}
              <label className="flex items-center gap-4 p-4 border border-dashed border-white/20 rounded-xl bg-black/20 group hover:border-[#9333EA]/50 transition-colors cursor-pointer relative overflow-hidden">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                ) : null}
                <div className="w-12 h-12 rounded-full bg-[#9333EA]/20 flex items-center justify-center group-hover:bg-[#9333EA]/40 transition-colors relative z-10">
                  <ImageIcon className="h-5 w-5 text-[#D946EF]" />
                </div>
                <div className="relative z-10">
                  <p className="text-sm font-semibold text-white">Field Cover Image</p>
                  <p className="text-xs text-gray-400">{imagePreview ? 'Image selected. Click to change.' : 'Click to upload or drag and drop (Optional)'}</p>
                </div>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Farm Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. North Valley Plot"
                    className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Area (Acres)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. 15.5"
                    className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Crop Type</label>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all appearance-none cursor-pointer"
                  >
                    {CROP_TYPES.map((c) => (
                      <option key={c} value={c} className="bg-[#121024]">{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Sacramento, CA"
                      className="w-full h-11 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 focus:outline-none"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Farm'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#121024] border border-red-500/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Delete Farm?</h3>
            <p className="text-sm text-gray-400 mb-6">
              This action cannot be undone. All telemetry, history, and AI insights for this farm will be permanently erased.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/20 text-white rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {renderModals()}
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl ${
              toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedFarm ? (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg">
              <button 
                onClick={() => setSelectedFarm(null)}
                className="flex items-center gap-2 text-[#E9D5FF] hover:text-white transition-colors focus:outline-none px-2 py-1 rounded-lg hover:bg-white/5"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-semibold">Back to Dashboard</span>
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenEdit(farms.find(f => f.id === selectedFarm.id) || selectedFarm)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors focus:outline-none border border-white/5"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirmId(selectedFarm.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium transition-colors focus:outline-none"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>

            {/* Hero Banner */}
            <div className="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
              <img src={getFarmImage(selectedFarm.cropType)} alt={selectedFarm.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A1A] via-[#0B0A1A]/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8 w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#9333EA]/30 text-[#E9D5FF] border border-[#9333EA]/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                      Active Twin
                    </span>
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Healthy
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{selectedFarm.name}</h1>
                  <div className="flex items-center gap-4 text-gray-300 font-medium">
                    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#D946EF]" /> {selectedFarm.location}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    <span className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-blue-400" /> {selectedFarm.area} Acres</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    <span className="flex items-center gap-1.5"><Sprout className="h-4 w-4 text-green-400" /> {selectedFarm.cropType}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Main Info Column */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Real-time Telemetry */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-lg">
                  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#9333EA]" /> Sensor Status
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center hover:bg-black/40 transition-colors">
                      <Droplets className="h-6 w-6 text-blue-400 mb-2" />
                      <span className="text-2xl font-bold text-white">{selectedFarm.sensorData.moisture}%</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Moisture</span>
                    </div>
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center hover:bg-black/40 transition-colors">
                      <Thermometer className="h-6 w-6 text-red-400 mb-2" />
                      <span className="text-2xl font-bold text-white">{selectedFarm.sensorData.temperature}°C</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Temperature</span>
                    </div>
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center hover:bg-black/40 transition-colors">
                      <CloudRain className="h-6 w-6 text-indigo-400 mb-2" />
                      <span className="text-2xl font-bold text-white">{(selectedFarm.sensorData as any).rainfall || 0}mm</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Rainfall</span>
                    </div>
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center hover:bg-black/40 transition-colors">
                      <Wind className="h-6 w-6 text-green-400 mb-2" />
                      <span className="text-2xl font-bold text-white">{selectedFarm.sensorData.pH}</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Soil pH</span>
                    </div>
                  </div>
                </div>

                {/* AI Recommendation */}
                <div className="bg-gradient-to-br from-[#9333EA]/10 to-[#C026D3]/10 backdrop-blur-xl p-6 rounded-2xl border border-[#9333EA]/20 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#9333EA]/20 blur-3xl rounded-full" />
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                    <AlertCircle className="h-5 w-5 text-[#D946EF]" /> AI Recommendation
                  </h2>
                  <div className="bg-black/20 border border-white/10 p-4 rounded-xl relative z-10">
                    <p className="text-sm text-[#E9D5FF] leading-relaxed">
                      Based on current sensor data and {selectedFarm.cropType} growth patterns, conditions are optimal. 
                      Moisture is at {selectedFarm.sensorData.moisture}% which is ideal. Consider applying standard nitrogen fertilizer 
                      in the next 48 hours to capitalize on the upcoming mild temperatures ({selectedFarm.sensorData.temperature}°C).
                    </p>
                  </div>
                </div>

                {/* Historical Records */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-lg">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#9333EA]" /> Historical Records
                  </h2>
                  <div className="space-y-3">
                    {[1, 2, 3].map((_, i) => (
                      <div key={i} className="bg-black/20 p-3 rounded-xl border border-white/5 flex justify-between items-center hover:bg-white/5 transition-colors cursor-default">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg">
                            <Activity className="h-4 w-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">Daily Telemetry Sync</p>
                            <p className="text-xs text-gray-500">{new Date(Date.now() - i * 86400000).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-md">Success</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Side Info Column */}
              <div className="space-y-6">
                
                {/* Google Maps Location Visual */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-lg">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <MapIcon className="h-5 w-5 text-[#9333EA]" /> Location
                  </h2>
                  <div className="w-full h-40 bg-[#121024] rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center group cursor-pointer">
                    {/* Fake Map Grid Background */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#9333EA 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121024] to-transparent opacity-80" />
                    <div className="flex flex-col items-center justify-center z-10 transition-transform duration-300 group-hover:scale-110">
                      <MapPin className="h-8 w-8 text-[#D946EF] drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]" />
                      <span className="text-xs font-bold text-white mt-2 bg-black/50 px-2 py-1 rounded-md border border-white/10 backdrop-blur-md">{selectedFarm.location}</span>
                    </div>
                  </div>
                </div>

                {/* General Info */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-lg">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-[#9333EA]" /> General Info
                  </h2>
                  <ul className="space-y-4">
                    <li className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-sm text-gray-400">Crop Type</span>
                      <span className="text-sm font-bold text-white">{selectedFarm.cropType}</span>
                    </li>
                    <li className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-sm text-gray-400">Total Area</span>
                      <span className="text-sm font-bold text-white">{selectedFarm.area} Acres</span>
                    </li>
                    <li className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-sm text-gray-400">Status</span>
                      <span className="text-sm font-bold text-green-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Active
                      </span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Last Sync</span>
                      <span className="text-sm font-bold text-white">Just now</span>
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Farms', value: farms.length, icon: Layers, color: 'text-blue-400' },
                { label: 'Active Twins', value: farms.length, icon: Activity, color: 'text-green-400' },
                { label: 'Crop Types', value: uniqueCrops, icon: Sprout, color: 'text-[#D946EF]' },
                { label: 'Total Area', value: `${totalArea} ac`, icon: MapIcon, color: 'text-[#9333EA]' }
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-xl p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors shadow-lg flex items-center justify-between group">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                    <h4 className="text-2xl font-black text-white">{stat.value}</h4>
                  </div>
                  <div className={`p-3 rounded-xl bg-black/20 border border-white/5 group-hover:scale-110 transition-transform duration-300 ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="flex-1 flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search farms by name or location..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                  />
                </div>
                {/* Sort & Filter */}
                <div className="flex gap-2">
                  <select 
                    value={filterCrop}
                    onChange={(e) => setFilterCrop(e.target.value)}
                    className="h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] transition-all appearance-none cursor-pointer min-w-[120px]"
                  >
                    <option value="all" className="bg-[#121024]">All Crops</option>
                    {CROP_TYPES.map(c => <option key={c} value={c} className="bg-[#121024]">{c}</option>)}
                  </select>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] transition-all appearance-none cursor-pointer min-w-[120px]"
                  >
                    <option value="newest" className="bg-[#121024]">Newest</option>
                    <option value="name" className="bg-[#121024]">Name (A-Z)</option>
                    <option value="area" className="bg-[#121024]">Largest Area</option>
                  </select>
                </div>
              </div>
              
              {/* Add Farm Button */}
              <button
                onClick={handleOpenAdd}
                disabled={farms.length >= 10}
                className="h-11 px-6 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale focus:outline-none"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            </div>

            {/* Farms Grid */}
            {farms.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                  {paginatedFarms.map((farm) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      key={farm.id}
                      className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-lg hover:shadow-[#9333EA]/20 transition-shadow duration-300 group flex flex-col cursor-pointer"
                      onClick={() => setSelectedFarm(farm)}
                    >
                      {/* Card Image Header */}
                      <div className="h-40 relative overflow-hidden">
                        <img src={getFarmImage(farm.cropType)} alt={farm.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121024] to-transparent opacity-90" />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <span className="bg-green-500/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Healthy
                          </span>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-xl font-bold text-white mb-1 truncate">{farm.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-[#E9D5FF] font-medium">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {farm.location}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-[#121024] to-transparent">
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Crop</p>
                            <p className="text-sm font-bold text-white flex items-center gap-1.5"><Sprout className="h-3.5 w-3.5 text-green-400" />{farm.cropType}</p>
                          </div>
                          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Area</p>
                            <p className="text-sm font-bold text-white flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-blue-400" />{farm.area} ac</p>
                          </div>
                          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Moisture</p>
                            <p className="text-sm font-bold text-white flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-indigo-400" />{farm.sensorData.moisture}%</p>
                          </div>
                          <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Temp</p>
                            <p className="text-sm font-bold text-white flex items-center gap-1.5"><Thermometer className="h-3.5 w-3.5 text-red-400" />{farm.sensorData.temperature}°C</p>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div className="text-[#D946EF] text-sm font-bold flex items-center gap-1 group/btn">
                            View Details <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenEdit(farm)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none"
                              title="Edit Farm"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(farm.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors focus:outline-none"
                              title="Delete Farm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-8">
                    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-lg">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none"
                      >
                        <ChevronRight className="h-5 w-5 rotate-180" />
                      </button>
                      
                      <div className="flex gap-1 px-2">
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all focus:outline-none ${
                              currentPage === i + 1 
                                ? 'bg-gradient-to-r from-[#9333EA] to-[#C026D3] text-white shadow-lg shadow-[#9333EA]/30' 
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Empty State */
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center shadow-lg flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 bg-gradient-to-br from-[#9333EA]/20 to-[#C026D3]/20 rounded-full flex items-center justify-center mb-6 border border-[#9333EA]/30">
                  <Leaf className="h-10 w-10 text-[#D946EF]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No Farms Registered</h3>
                <p className="text-[#E9D5FF] max-w-md mx-auto mb-8">
                  Create your first digital twin to start monitoring crop health, predicting yields, and receiving AI insights.
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="px-8 py-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 focus:outline-none"
                >
                  <Plus className="h-5 w-5" />
                  Add Your First Field
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
