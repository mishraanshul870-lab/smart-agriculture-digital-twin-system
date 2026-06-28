import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { 
  Plus, Loader2, CheckCircle2, AlertCircle, Sprout, Layers, 
  MapPin, Wifi, Activity, Droplets, Microscope, Sun, Thermometer, Wind,
  Trash2, Edit3, Search, RefreshCw, X
} from 'lucide-react';
import { Farm, User } from '../types';
import { fetch } from '../utils/api';
import { CROP_TYPES } from '../utils/simData';

interface DataEntryProps {
  user: User;
  farms: Farm[];
  onRefreshFarms: () => Promise<void>;
}

type RecordType = 
  | 'farm' 
  | 'field' 
  | 'crop' 
  | 'sensor' 
  | 'reading' 
  | 'irrigation' 
  | 'fertilizer' 
  | 'disease' 
  | 'weather';

const RECORD_TYPES: { id: RecordType; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'farm', label: 'Add Farm', icon: MapPin, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { id: 'field', label: 'Add Field', icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'crop', label: 'Add Crop', icon: Sprout, color: 'text-green-400', bg: 'bg-green-500/10' },
  { id: 'sensor', label: 'Add Sensor', icon: Wifi, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { id: 'reading', label: 'Sensor Reading', icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'irrigation', label: 'Irrigation Event', icon: Droplets, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { id: 'fertilizer', label: 'Fertilizer Record', icon: Microscope, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'disease', label: 'Disease Report', icon: Sprout, color: 'text-red-400', bg: 'bg-red-500/10' },
  { id: 'weather', label: 'Weather Record', icon: Sun, color: 'text-yellow-400', bg: 'bg-yellow-500/10' }
];

export default function DataEntry({ user, farms, onRefreshFarms }: DataEntryProps) {
  const [activeForm, setActiveForm] = useState<RecordType>('farm');
  const [activeView, setActiveView] = useState<'create' | 'manage'>('create');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Dynamic state stores
  const [fields, setFields] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);

  // Form fields
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [selectedSensorId, setSelectedSensorId] = useState('');

  // 1. Farm Form
  const [farmName, setFarmName] = useState('');
  const [farmArea, setFarmArea] = useState('');
  const [farmCropType, setFarmCropType] = useState(CROP_TYPES[0]);
  const [farmLocation, setFarmLocation] = useState('');

  // 2. Field Form
  const [fieldName, setFieldName] = useState('');
  const [fieldArea, setFieldArea] = useState('');
  const [fieldCropType, setFieldCropType] = useState(CROP_TYPES[0]);

  // 3. Crop Form
  const [cropName, setCropName] = useState('');
  const [cropVariety, setCropVariety] = useState('');
  const [cropPlantedDate, setCropPlantedDate] = useState('');

  // 4. Sensor Form
  const [sensorName, setSensorName] = useState('');
  const [sensorType, setSensorType] = useState('temperature');

  // 5. Sensor Reading Form
  const [readingValue, setReadingValue] = useState('');

  // 6. Irrigation Form
  const [irrigationDuration, setIrrigationDuration] = useState('');
  const [irrigationWaterAmount, setIrrigationWaterAmount] = useState('');
  const [irrigationStatus, setIrrigationStatus] = useState('Completed');

  // 7. Fertilizer Form
  const [fertilizerType, setFertilizerType] = useState('');
  const [fertilizerQuantity, setFertilizerQuantity] = useState('');

  // 8. Disease Report Form
  const [diseaseCropType, setDiseaseCropType] = useState(CROP_TYPES[0]);
  const [diseaseName, setDiseaseName] = useState('');
  const [diseaseConfidence, setDiseaseConfidence] = useState('90');
  const [diseaseTreatment, setDiseaseTreatment] = useState('');

  // 9. Weather Form
  const [weatherTemp, setWeatherTemp] = useState('');
  const [weatherHumidity, setWeatherHumidity] = useState('');
  const [weatherWind, setWeatherWind] = useState('');
  const [weatherRain, setWeatherRain] = useState('');
  const [weatherCondition, setWeatherCondition] = useState('Sunny');

  // --- Manage Records States ---
  const [manageCategory, setManageCategory] = useState<RecordType>('farm');
  const [records, setRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<any>({});

  // Fetch fields and sensors for the selected farm when it changes
  useEffect(() => {
    if (selectedFarmId) {
      fetchFields(selectedFarmId);
      fetchSensors(selectedFarmId);
    } else {
      setFields([]);
      setSensors([]);
    }
  }, [selectedFarmId]);

  // Set default farm selected
  useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  // Load records whenever view transitions to 'manage' or category selector switches
  useEffect(() => {
    if (activeView === 'manage') {
      fetchRecords();
    }
  }, [activeView, manageCategory]);

  const fetchFields = async (farmId: string) => {
    try {
      const res = await fetch(`/api/fields?farmId=${farmId}`);
      const data = await res.json();
      if (data.success) setFields(data.fields);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSensors = async (farmId: string) => {
    try {
      const res = await fetch(`/api/sensors?farmId=${farmId}`);
      const data = await res.json();
      if (data.success) setSensors(data.sensors);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    let endpoint = '';
    if (manageCategory === 'farm') endpoint = '/api/farms';
    else if (manageCategory === 'field') endpoint = '/api/fields';
    else if (manageCategory === 'crop') endpoint = '/api/crops';
    else if (manageCategory === 'sensor') endpoint = '/api/sensors';
    else if (manageCategory === 'reading') endpoint = '/api/sensor-readings';
    else if (manageCategory === 'irrigation') endpoint = '/api/irrigation-records';
    else if (manageCategory === 'fertilizer') endpoint = '/api/fertilizer-records';
    else if (manageCategory === 'disease') endpoint = '/api/disease-history';
    else if (manageCategory === 'weather') endpoint = '/api/weather-records';

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) {
        const list = data.records || data.farms || data.fields || data.crops || data.sensors || data.readings || data.history || [];
        setRecords(list);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load records from database.', 'error');
    } finally {
      setRecordsLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let endpoint = '';
      let payload = {};

      if (activeForm === 'farm') {
        endpoint = '/api/farms';
        payload = {
          name: farmName,
          area: parseFloat(farmArea),
          cropType: farmCropType,
          location: farmLocation
        };
      } else if (activeForm === 'field') {
        endpoint = '/api/fields';
        payload = {
          farmId: selectedFarmId,
          name: fieldName,
          area: parseFloat(fieldArea),
          cropType: fieldCropType
        };
      } else if (activeForm === 'crop') {
        endpoint = '/api/crops';
        payload = {
          farmId: selectedFarmId,
          fieldId: selectedFieldId || undefined,
          name: cropName,
          variety: cropVariety,
          plantedDate: cropPlantedDate
        };
      } else if (activeForm === 'sensor') {
        endpoint = '/api/sensors';
        payload = {
          farmId: selectedFarmId,
          fieldId: selectedFieldId || undefined,
          name: sensorName,
          type: sensorType
        };
      } else if (activeForm === 'reading') {
        endpoint = '/api/sensor-readings';
        payload = {
          farmId: selectedFarmId,
          sensorId: selectedSensorId,
          value: parseFloat(readingValue)
        };
      } else if (activeForm === 'irrigation') {
        endpoint = '/api/irrigation-records';
        payload = {
          farmId: selectedFarmId,
          duration: parseFloat(irrigationDuration),
          waterAmount: parseFloat(irrigationWaterAmount),
          status: irrigationStatus
        };
      } else if (activeForm === 'fertilizer') {
        endpoint = '/api/fertilizer-records';
        payload = {
          farmId: selectedFarmId,
          type: fertilizerType,
          quantity: parseFloat(fertilizerQuantity)
        };
      } else if (activeForm === 'disease') {
        endpoint = '/api/disease-reports';
        payload = {
          farmId: selectedFarmId || undefined,
          cropType: diseaseCropType,
          diseaseName,
          confidence: parseFloat(diseaseConfidence),
          treatment: diseaseTreatment
        };
      } else if (activeForm === 'weather') {
        endpoint = '/api/weather-records';
        payload = {
          farmId: selectedFarmId || undefined,
          temperature: parseFloat(weatherTemp),
          humidity: parseFloat(weatherHumidity),
          windSpeed: parseFloat(weatherWind),
          rainfall: parseFloat(weatherRain),
          condition: weatherCondition
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Saving record failed');
      }

      showToast(`${RECORD_TYPES.find(r => r.id === activeForm)?.label} saved successfully!`, 'success');
      
      // Reset forms
      if (activeForm === 'farm') {
        setFarmName(''); setFarmArea(''); setFarmLocation('');
      } else if (activeForm === 'field') {
        setFieldName(''); setFieldArea('');
      } else if (activeForm === 'crop') {
        setCropName(''); setCropVariety(''); setCropPlantedDate('');
      } else if (activeForm === 'sensor') {
        setSensorName('');
      } else if (activeForm === 'reading') {
        setReadingValue('');
      } else if (activeForm === 'irrigation') {
        setIrrigationDuration(''); setIrrigationWaterAmount('');
      } else if (activeForm === 'fertilizer') {
        setFertilizerType(''); setFertilizerQuantity('');
      } else if (activeForm === 'disease') {
        setDiseaseName(''); setDiseaseTreatment('');
      } else if (activeForm === 'weather') {
        setWeatherTemp(''); setWeatherHumidity(''); setWeatherWind(''); setWeatherRain('');
      }

      // Refresh global states
      await onRefreshFarms();
      if (selectedFarmId) {
        await fetchFields(selectedFarmId);
        await fetchSensors(selectedFarmId);
      }
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (record: any) => {
    setEditingRecordId(record._id || record.id);
    setEditPayload({ ...record });
  };

  const handleEditSave = async (recordId: string) => {
    let endpoint = '';
    if (manageCategory === 'farm') endpoint = `/api/farms/${recordId}`;
    else if (manageCategory === 'field') endpoint = `/api/fields/${recordId}`;
    else if (manageCategory === 'crop') endpoint = `/api/crops/${recordId}`;
    else if (manageCategory === 'sensor') endpoint = `/api/sensors/${recordId}`;
    else if (manageCategory === 'reading') endpoint = `/api/sensor-readings/${recordId}`;
    else if (manageCategory === 'irrigation') endpoint = `/api/irrigation-records/${recordId}`;
    else if (manageCategory === 'fertilizer') endpoint = `/api/fertilizer-records/${recordId}`;
    else if (manageCategory === 'disease') endpoint = `/api/disease-reports/${recordId}`;
    else if (manageCategory === 'weather') endpoint = `/api/weather-records/${recordId}`;

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Record updated successfully', 'success');
        setEditingRecordId(null);
        fetchRecords();
        onRefreshFarms();
      } else {
        showToast(data.message || 'Failed to update record', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error occurred', 'error');
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    let endpoint = '';
    if (manageCategory === 'farm') endpoint = `/api/farms/${recordId}`;
    else if (manageCategory === 'field') endpoint = `/api/fields/${recordId}`;
    else if (manageCategory === 'crop') endpoint = `/api/crops/${recordId}`;
    else if (manageCategory === 'sensor') endpoint = `/api/sensors/${recordId}`;
    else if (manageCategory === 'reading') endpoint = `/api/sensor-readings/${recordId}`;
    else if (manageCategory === 'irrigation') endpoint = `/api/irrigation-records/${recordId}`;
    else if (manageCategory === 'fertilizer') endpoint = `/api/fertilizer-records/${recordId}`;
    else if (manageCategory === 'disease') endpoint = `/api/disease-reports/${recordId}`;
    else if (manageCategory === 'weather') endpoint = `/api/weather-records/${recordId}`;

    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Record deleted successfully', 'success');
        fetchRecords();
        onRefreshFarms();
      } else {
        showToast(data.message || 'Failed to delete record', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error occurred', 'error');
    }
  };

  const filteredRecords = records.filter(rec => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    
    // Custom properties checks
    return (
      (rec.name && rec.name.toLowerCase().includes(q)) ||
      (rec.cropType && rec.cropType.toLowerCase().includes(q)) ||
      (rec.variety && rec.variety.toLowerCase().includes(q)) ||
      (rec.type && rec.type.toLowerCase().includes(q)) ||
      (rec.diseaseName && rec.diseaseName.toLowerCase().includes(q)) ||
      (rec.location && rec.location.toLowerCase().includes(q)) ||
      (rec.condition && rec.condition.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header section with toggle */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Agricultural Record Registry</h2>
          <p className="text-sm text-gray-400 mt-1">Configure and manage agricultural twin records securely inside your live database.</p>
        </div>
        <div className="flex bg-black/30 p-1 rounded-xl border border-white/10 self-start">
          <button
            onClick={() => setActiveView('create')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
              activeView === 'create' ? 'bg-[#9333EA] text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Records
          </button>
          <button
            onClick={() => setActiveView('manage')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
              activeView === 'manage' ? 'bg-[#9333EA] text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            Manage Records
          </button>
        </div>
      </div>

      {activeView === 'create' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Navigation Sidebar */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg space-y-2 h-fit">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Record Selection</p>
            {RECORD_TYPES.map((type) => {
              const Icon = type.icon;
              const isActive = activeForm === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setActiveForm(type.id)}
                  className={`w-full h-11 flex items-center gap-3 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#9333EA] to-[#C026D3] text-white shadow-md'
                      : 'text-[#A78BFA] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Container */}
          <div className="md:col-span-2 bg-[#121024] border border-white/10 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#9333EA]/10 blur-[80px] rounded-full pointer-events-none"></div>

            <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-3 flex items-center gap-2">
              {React.createElement(RECORD_TYPES.find(r => r.id === activeForm)?.icon, { className: `h-5 w-5 ${RECORD_TYPES.find(r => r.id === activeForm)?.color}` })}
              {RECORD_TYPES.find(r => r.id === activeForm)?.label} Form
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {activeForm !== 'farm' && activeForm !== 'weather' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Select Farm</label>
                    <select
                      required
                      value={selectedFarmId}
                      onChange={(e) => setSelectedFarmId(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="bg-[#121024]">-- Choose Farm --</option>
                      {farms.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#121024]">{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {(activeForm === 'crop' || activeForm === 'sensor') && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Select Field (Optional)</label>
                      <select
                        value={selectedFieldId}
                        onChange={(e) => setSelectedFieldId(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#121024]">-- None / Farm Level --</option>
                        {fields.map((f) => (
                          <option key={f._id} value={f._id} className="bg-[#121024]">{f.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeForm === 'reading' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Select Sensor</label>
                      <select
                        required
                        value={selectedSensorId}
                        onChange={(e) => setSelectedSensorId(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="bg-[#121024]">-- Choose Sensor --</option>
                        {sensors.map((s) => (
                          <option key={s._id} value={s._id} className="bg-[#121024]">{s.name} ({s.type})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Farm Form Fields */}
              {activeForm === 'farm' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Farm Name</label>
                    <input
                      type="text" required placeholder="e.g. North Valley Farm" value={farmName} onChange={(e) => setFarmName(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Area (Acres)</label>
                      <input
                        type="number" step="any" required placeholder="e.g. 50" value={farmArea} onChange={(e) => setFarmArea(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Crop Type</label>
                      <select
                        value={farmCropType} onChange={(e) => setFarmCropType(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        {CROP_TYPES.map(c => <option key={c} value={c} className="bg-[#121024]">{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Location</label>
                    <input
                      type="text" required placeholder="e.g. Sacramento, California" value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                </div>
              )}

              {/* Field Form Fields */}
              {activeForm === 'field' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Field Name</label>
                    <input
                      type="text" required placeholder="e.g. Sector 1 Vineyard" value={fieldName} onChange={(e) => setFieldName(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Area (Acres)</label>
                      <input
                        type="number" step="any" required placeholder="e.g. 12" value={fieldArea} onChange={(e) => setFieldArea(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Crop Type</label>
                      <select
                        value={fieldCropType} onChange={(e) => setFieldCropType(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        {CROP_TYPES.map(c => <option key={c} value={c} className="bg-[#121024]">{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Crop Form Fields */}
              {activeForm === 'crop' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Crop Name</label>
                    <input
                      type="text" required placeholder="e.g. Organic Winter Wheat" value={cropName} onChange={(e) => setCropName(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Crop Variety</label>
                      <input
                        type="text" required placeholder="e.g. Hard Red Winter" value={cropVariety} onChange={(e) => setCropVariety(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Planted Date</label>
                      <input
                        type="date" required value={cropPlantedDate} onChange={(e) => setCropPlantedDate(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sensor Form Fields */}
              {activeForm === 'sensor' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Sensor Name</label>
                    <input
                      type="text" required placeholder="e.g. Moisture Sensor Node 1" value={sensorName} onChange={(e) => setSensorName(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Sensor Type</label>
                    <select
                      value={sensorType} onChange={(e) => setSensorType(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                    >
                      <option value="temperature" className="bg-[#121024]">Temperature</option>
                      <option value="moisture" className="bg-[#121024]">Moisture</option>
                      <option value="humidity" className="bg-[#121024]">Humidity</option>
                      <option value="ph" className="bg-[#121024]">pH Level</option>
                      <option value="ec" className="bg-[#121024]">EC Conductivity</option>
                      <option value="light" className="bg-[#121024]">Light Intensity</option>
                      <option value="rainfall" className="bg-[#121024]">Rainfall</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Sensor Reading Form Fields */}
              {activeForm === 'reading' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Reading Value</label>
                    <input
                      type="number" step="any" required placeholder="e.g. 45" value={readingValue} onChange={(e) => setReadingValue(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                </div>
              )}

              {/* Irrigation Form Fields */}
              {activeForm === 'irrigation' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Duration (Minutes)</label>
                    <input
                      type="number" required placeholder="e.g. 45" value={irrigationDuration} onChange={(e) => setIrrigationDuration(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Water Used (Liters)</label>
                    <input
                      type="number" required placeholder="e.g. 1500" value={irrigationWaterAmount} onChange={(e) => setIrrigationWaterAmount(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Status</label>
                    <select
                      value={irrigationStatus} onChange={(e) => setIrrigationStatus(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                    >
                      <option value="Completed" className="bg-[#121024]">Completed</option>
                      <option value="Scheduled" className="bg-[#121024]">Scheduled</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Fertilizer Form Fields */}
              {activeForm === 'fertilizer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Fertilizer Type / Mix</label>
                    <input
                      type="text" required placeholder="e.g. NPK 10-10-10 or Organic Compost" value={fertilizerType} onChange={(e) => setFertilizerType(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Quantity Applied (kg)</label>
                    <input
                      type="number" required placeholder="e.g. 250" value={fertilizerQuantity} onChange={(e) => setFertilizerQuantity(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                </div>
              )}

              {/* Disease Report Form Fields */}
              {activeForm === 'disease' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Target Crop Type</label>
                      <select
                        value={diseaseCropType} onChange={(e) => setDiseaseCropType(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        {CROP_TYPES.map(c => <option key={c} value={c} className="bg-[#121024]">{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Disease Name</label>
                      <input
                        type="text" required placeholder="e.g. Wheat Rust or Tomato Early Blight" value={diseaseName} onChange={(e) => setDiseaseName(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Confidence Level (%)</label>
                    <input
                      type="number" min="0" max="100" required placeholder="e.g. 94" value={diseaseConfidence} onChange={(e) => setDiseaseConfidence(e.target.value)}
                      className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Recommended Treatment Action</label>
                    <textarea
                      required placeholder="e.g. Apply copper fungicide, prune bottom leaves, and restrict watering." rows={3} value={diseaseTreatment} onChange={(e) => setDiseaseTreatment(e.target.value)}
                      className="w-full p-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                    />
                  </div>
                </div>
              )}

              {/* Weather Form Fields */}
              {activeForm === 'weather' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Select Farm (Optional)</label>
                      <select
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#121024]">-- Region Level --</option>
                        {farms.map((f) => (
                          <option key={f.id} value={f.id} className="bg-[#121024]">{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">Condition</label>
                      <select
                        value={weatherCondition} onChange={(e) => setWeatherCondition(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
                      >
                        <option value="Sunny" className="bg-[#121024]">Sunny</option>
                        <option value="Cloudy" className="bg-[#121024]">Cloudy</option>
                        <option value="Rainy" className="bg-[#121024]">Rainy</option>
                        <option value="Stormy" className="bg-[#121024]">Stormy</option>
                        <option value="Windy" className="bg-[#121024]">Windy</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temp (°C)</label>
                      <input
                        type="number" step="any" required placeholder="e.g. 24.5" value={weatherTemp} onChange={(e) => setWeatherTemp(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider flex items-center gap-1 flex-nowrap"><Droplets className="h-3 w-3" /> Humidity (%)</label>
                      <input
                        type="number" step="any" required placeholder="e.g. 60" value={weatherHumidity} onChange={(e) => setWeatherHumidity(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider flex items-center gap-1"><Wind className="h-3 w-3" /> Wind (km/h)</label>
                      <input
                        type="number" step="any" required placeholder="e.g. 15.2" value={weatherWind} onChange={(e) => setWeatherWind(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider flex items-center gap-1 flex-nowrap"><Sun className="h-3 w-3" /> Rain (mm)</label>
                      <input
                        type="number" step="any" required placeholder="e.g. 0.0" value={weatherRain} onChange={(e) => setWeatherRain(e.target.value)}
                        className="w-full h-11 px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-4 mt-6 border-t border-white/5">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#9333EA]"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* --- MANAGE RECORDS VIEW --- */
        <div className="bg-[#121024] border border-white/10 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#9333EA]/10 blur-[80px] rounded-full pointer-events-none"></div>

          {/* Controls bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6 z-10 relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-gray-300">Category:</span>
              <select
                value={manageCategory}
                onChange={(e) => {
                  setManageCategory(e.target.value as RecordType);
                  setEditingRecordId(null);
                  setSearchQuery('');
                }}
                className="h-10 px-4 bg-black/40 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-[#9333EA] appearance-none cursor-pointer"
              >
                {RECORD_TYPES.map(rt => (
                  <option key={rt.id} value={rt.id} className="bg-[#121024]">{rt.label.replace('Add ', '')}</option>
                ))}
              </select>

              <button
                onClick={fetchRecords}
                disabled={recordsLoading}
                className="h-10 w-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
                title="Refresh database entries"
              >
                <RefreshCw className={`h-4 w-4 ${recordsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-black/40 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-[#9333EA] placeholder-gray-500"
              />
            </div>
          </div>

          {/* Grid/Table Area */}
          <div className="z-10 relative">
            {recordsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-[#9333EA] animate-spin" />
                <p className="text-sm text-gray-400">Loading saved entries from MongoDB...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-xl">
                <p className="text-sm text-gray-400">No records found matching current query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/10">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[#E9D5FF] font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Entity Details</th>
                      <th className="p-4">Attributes</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.map((rec) => {
                      const id = rec._id || rec.id;
                      const isEditing = editingRecordId === id;

                      return (
                        <tr key={id} className="hover:bg-white/5 transition-colors">
                          {/* Column 1: Primary identifiers */}
                          <td className="p-4">
                            {isEditing ? (
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 block">NAME/IDENTIFIER</label>
                                <input
                                  type="text"
                                  value={editPayload.name || editPayload.type || editPayload.diseaseName || ''}
                                  onChange={(e) => {
                                    const key = editPayload.name !== undefined ? 'name' : editPayload.diseaseName !== undefined ? 'diseaseName' : 'type';
                                    setEditPayload({ ...editPayload, [key]: e.target.value });
                                  }}
                                  className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full focus:outline-none focus:border-[#9333EA]"
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-white block">
                                  {rec.name || rec.type || rec.diseaseName || 'Regional Record'}
                                </span>
                                <span className="text-xs text-gray-400 mt-0.5 block">
                                  ID: {id.substring(Math.max(0, id.length - 8))}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Column 2: Parameters & Attributes */}
                          <td className="p-4">
                            {isEditing ? (
                              <div className="grid grid-cols-2 gap-2">
                                {editPayload.area !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">AREA (ACRES)</label>
                                    <input
                                      type="number"
                                      value={editPayload.area}
                                      onChange={(e) => setEditPayload({ ...editPayload, area: parseFloat(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.cropType !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">CROP TYPE</label>
                                    <input
                                      type="text"
                                      value={editPayload.cropType}
                                      onChange={(e) => setEditPayload({ ...editPayload, cropType: e.target.value })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.value !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">VALUE</label>
                                    <input
                                      type="number"
                                      value={editPayload.value}
                                      onChange={(e) => setEditPayload({ ...editPayload, value: parseFloat(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.duration !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">DURATION (MINS)</label>
                                    <input
                                      type="number"
                                      value={editPayload.duration}
                                      onChange={(e) => setEditPayload({ ...editPayload, duration: parseInt(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.waterAmount !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">WATER (L)</label>
                                    <input
                                      type="number"
                                      value={editPayload.waterAmount}
                                      onChange={(e) => setEditPayload({ ...editPayload, waterAmount: parseInt(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.quantity !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">QUANTITY (KG)</label>
                                    <input
                                      type="number"
                                      value={editPayload.quantity}
                                      onChange={(e) => setEditPayload({ ...editPayload, quantity: parseFloat(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.temperature !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">TEMP (°C)</label>
                                    <input
                                      type="number"
                                      value={editPayload.temperature}
                                      onChange={(e) => setEditPayload({ ...editPayload, temperature: parseFloat(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                                {editPayload.humidity !== undefined && (
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 block">HUMIDITY (%)</label>
                                    <input
                                      type="number"
                                      value={editPayload.humidity}
                                      onChange={(e) => setEditPayload({ ...editPayload, humidity: parseFloat(e.target.value) })}
                                      className="h-8 px-2 bg-black/40 border border-white/20 rounded text-white text-xs w-full"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1 font-mono text-xs text-gray-300">
                                {rec.area !== undefined && <div>Area: {rec.area} acres</div>}
                                {rec.cropType && <div>Crop: {rec.cropType}</div>}
                                {rec.variety && <div>Variety: {rec.variety}</div>}
                                {rec.location && <div>Loc: {rec.location}</div>}
                                {rec.value !== undefined && <div>Value: {rec.value}</div>}
                                {rec.duration !== undefined && <div>Duration: {rec.duration} mins</div>}
                                {rec.waterAmount !== undefined && <div>Water: {rec.waterAmount} L</div>}
                                {rec.quantity !== undefined && <div>Qty: {rec.quantity} kg</div>}
                                {rec.temperature !== undefined && <div>Temp: {rec.temperature}°C</div>}
                                {rec.humidity !== undefined && <div>Humid: {rec.humidity}%</div>}
                                {rec.windSpeed !== undefined && <div>Wind: {rec.windSpeed} km/h</div>}
                                {rec.rainfall !== undefined && <div>Rain: {rec.rainfall} mm</div>}
                                {rec.status && <div className="font-semibold text-[#A78BFA]">{rec.status}</div>}
                              </div>
                            )}
                          </td>

                          {/* Column 3: Timing */}
                          <td className="p-4 font-mono text-xs text-gray-400">
                            {new Date(rec.createdAt || rec.date || rec.plantedDate || rec.timestamp || Date.now()).toLocaleDateString()}<br/>
                            {new Date(rec.createdAt || rec.date || rec.plantedDate || rec.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          {/* Column 4: Controls (Edit/Save/Delete/Cancel) */}
                          <td className="p-4 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEditSave(id)}
                                  className="h-8 px-3 bg-green-600 hover:bg-green-500 rounded text-xs font-bold text-white cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingRecordId(null)}
                                  className="h-8 w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white cursor-pointer"
                                >
                                  <X className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEditStart(rec)}
                                  className="h-8 w-8 flex items-center justify-center bg-white/5 border border-white/10 hover:border-white/20 hover:bg-[#9333EA]/20 text-[#A78BFA] hover:text-white rounded transition-colors cursor-pointer"
                                  title="Edit entry"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(id)}
                                  className="h-8 w-8 flex items-center justify-center bg-white/5 border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 rounded transition-colors cursor-pointer"
                                  title="Delete entry"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast popup */}
      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border bg-black/80 backdrop-blur-xl border-white/10 text-white">
            {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
