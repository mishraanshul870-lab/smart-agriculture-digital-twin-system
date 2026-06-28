import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Download, Loader2, Calendar, Search, Filter, 
  ChevronDown, ArrowUpRight, BarChart2, PieChart as PieChartIcon,
  Activity, Leaf, Droplets, Target, Sparkles, Printer, Share2, 
  Star, MoreVertical, ShieldCheck, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, X, AlertTriangle, Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { User, Farm } from '../types';
import { fetch } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  user: User;
  farms: Farm[];
}

const REPORT_TYPES = ['All', 'Soil Analysis', 'Disease Diagnosis', 'Yield Prediction', 'AI Insights'];
const STATUSES = ['All', 'Completed', 'Processing', 'Failed', 'Archived', 'Favorites'];
const COLORS = ['#9333EA', '#D946EF', '#8B5CF6', '#10B981', '#3B82F6', '#EF4444'];

export default function Reports({ user, farms }: ReportsProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterFarm, setFilterFarm] = useState('All');
  const [filterDate, setFilterDate] = useState('All Time');
  
  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  
  // UI State
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user.id, farms]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [soilRes, diseaseRes, yieldRes, notificationsRes] = await Promise.all([
        fetch(`/api/soil-analysis`),
        fetch(`/api/disease-history?userId=${user.id}`),
        fetch(`/api/yield-predictions?userId=${user.id}`),
        fetch(`/api/notifications?userId=${user.id}`)
      ]);
      
      const soilData = await soilRes.json();
      const diseaseData = await diseaseRes.json();
      const yieldData = await yieldRes.json();
      const notificationsData = await notificationsRes.json();
      
      const combined = [
        ...(soilData.history || []).map((i: any) => ({ 
          ...i, 
          type: 'Soil Analysis', 
          status: i.isArchived ? 'Archived' : 'Completed', 
          farmName: farms.find(f => f.id === i.farmId)?.name || 'Unknown Farm Site',
          isFavorite: !!i.isFavorite,
          isArchived: !!i.isArchived
        })),
        ...(diseaseData.history || []).map((i: any) => ({ 
          ...i, 
          type: 'Disease Diagnosis', 
          status: i.isArchived ? 'Archived' : 'Completed', 
          farmName: farms.find(f => f.id === i.farmId)?.name || 'Unknown Farm Site',
          isFavorite: !!i.isFavorite,
          isArchived: !!i.isArchived
        })),
        ...(yieldData.history || []).map((i: any) => ({ 
          ...i, 
          type: 'Yield Prediction', 
          status: i.isArchived ? 'Archived' : 'Completed', 
          farmName: farms.find(f => f.id === i.farmId)?.name || 'Unknown Farm Site',
          isFavorite: !!i.isFavorite,
          isArchived: !!i.isArchived
        })),
        ...(notificationsData.notifications || [])
          .filter((n: any) => n.category === 'ai_recommendation')
          .map((n: any) => ({
            _id: n._id,
            type: 'AI Insights',
            status: n.isArchived ? 'Archived' : 'Completed',
            createdAt: n.createdAt,
            farmName: 'All Farm Sites',
            summary: n.message,
            isFavorite: !!n.isFavorite,
            isArchived: !!n.isArchived
          }))
      ];
      
      setHistory(combined);
    } catch (e) {
      console.error(e);
      setHistory([]);
      showToast('Failed to load live reports data.', 'error');
    } finally {
      setTimeout(() => setLoading(false), 800); // For smooth skeleton transition
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = history.find(h => h._id === id);
    if (!target) return;

    const newIsFavorite = !target.isFavorite;

    // Optimistically update local state
    setHistory(prev => prev.map(h => h._id === id ? { ...h, isFavorite: newIsFavorite } : h));
    showToast(newIsFavorite ? 'Added to Favorites' : 'Removed from Favorites', 'success');

    if (selectedReport?._id === id) {
      setSelectedReport(prev => prev ? { ...prev, isFavorite: newIsFavorite } : null);
    }

    try {
      await fetch('/api/reports/toggle-favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: target.type })
      });
    } catch (err) {
      console.error("Failed to persist favorite toggle on server:", err);
    }
  };

  const toggleArchive = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = history.find(h => h._id === id);
    if (!target) return;

    const newIsArchived = !target.isArchived;

    // Optimistically update local state
    setHistory(prev => prev.map(h => h._id === id ? { ...h, isArchived: newIsArchived, status: newIsArchived ? 'Archived' : 'Completed' } : h));
    showToast(newIsArchived ? 'Report archived successfully' : 'Report restored from archive', 'success');

    if (selectedReport?._id === id) {
      setSelectedReport(prev => prev ? { ...prev, isArchived: newIsArchived, status: newIsArchived ? 'Archived' : 'Completed' } : null);
    }

    try {
      await fetch('/api/reports/toggle-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: target.type })
      });
    } catch (err) {
      console.error("Failed to persist archive toggle on server:", err);
    }
  };

  const handleSingleDelete = async (id: string) => {
    const targetReport = history.find(h => h._id === id);
    if (!targetReport) return;

    // Optimistically update
    setHistory(prev => prev.filter(h => h._id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    
    if (selectedReport?._id === id) {
      setSelectedReport(null);
    }
    
    showToast('Report deleted successfully', 'success');

    try {
      let endpoint = '';
      if (targetReport.type === 'Soil Analysis') endpoint = `/api/soil-analysis/${id}`;
      else if (targetReport.type === 'Disease Diagnosis') endpoint = `/api/disease-history/${id}`;
      else if (targetReport.type === 'Yield Prediction') endpoint = `/api/yield-predictions/${id}`;
      else if (targetReport.type === 'AI Insights') endpoint = `/api/notifications/${id}`;
      
      if (endpoint) {
        const res = await fetch(endpoint, { method: 'DELETE' });
        const data = await res.json();
        if (!data.success) {
          console.error("Failed to delete report on server:", data.message);
        }
      }
    } catch (err) {
      console.error("Failed to delete report on server:", err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    
    // Optimistic update
    setHistory(prev => prev.filter(h => !selectedIds.has(h._id)));
    setSelectedIds(new Set());
    
    if (selectedReport && selectedIds.has(selectedReport._id)) {
      setSelectedReport(null);
    }
    
    showToast(`Deleted ${idsToDelete.length} reports`, 'success');

    try {
      await Promise.all(idsToDelete.map(async (id) => {
        const targetReport = history.find(h => h._id === id);
        if (!targetReport) return;
        
        let endpoint = '';
        if (targetReport.type === 'Soil Analysis') endpoint = `/api/soil-analysis/${id}`;
        else if (targetReport.type === 'Disease Diagnosis') endpoint = `/api/disease-history/${id}`;
        else if (targetReport.type === 'Yield Prediction') endpoint = `/api/yield-predictions/${id}`;
        else if (targetReport.type === 'AI Insights') endpoint = `/api/notifications/${id}`;
        
        if (endpoint) {
          await fetch(endpoint, { method: 'DELETE' });
        }
      }));
    } catch (err) {
      console.error("Failed to delete reports on server:", err);
    }
  };

  const handleShare = (item: any) => {
    let detailsStr = "";
    if (item.type === 'Soil Analysis') detailsStr = `Moisture: ${item.moisture}%, pH: ${item.pH}`;
    if (item.type === 'Disease Diagnosis') detailsStr = `Disease: ${item.diseaseName} (Confidence: ${(item.confidence * 100).toFixed(0)}%)`;
    if (item.type === 'Yield Prediction') detailsStr = `Predicted Yield: ${item.predictedYield} tons of ${item.cropType}`;
    if (item.type === 'AI Insights') detailsStr = item.summary;

    const shareText = `Agricultural Report - ${item.type}\nFarm: ${item.farmName}\nDate: ${new Date(item.createdAt).toLocaleString()}\nFindings: ${detailsStr}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      showToast('Report copied to clipboard!', 'success');
    } else {
      showToast('Sharing not supported on this browser', 'error');
    }
  };

  const generateAIReport = async () => {
    if (farms.length === 0) {
      showToast('Please add at least one farm site to generate AI Insights.', 'error');
      return;
    }
    setGeneratingAI(true);
    showToast('Consulting Gemini AI agronomist...', 'info');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Please generate a comprehensive, highly detailed professional agronomist health and telemetry executive report for my farm sites based on current conditions. Keep the summary under 3 sentences."
        })
      });
      const data = await response.json();
      if (data.success) {
        // Save as a notification on the server so that it becomes a real AI Insights report!
        const notifResponse = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'AI Executive Health Report',
            message: data.reply || 'All crop vitals are operating within optimal range.',
            category: 'ai_recommendation',
            priority: 'medium'
          })
        });
        const notifData = await notifResponse.json();
        if (notifData.success) {
          showToast('AI Insights report generated successfully!', 'success');
          await fetchData();
        } else {
          showToast('Failed to save generated report.', 'error');
        }
      } else {
        showToast('AI generation failed: ' + (data.message || 'Offline'), 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error generating AI report', 'error');
    } finally {
      setGeneratingAI(false);
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map(d => d._id)));
    }
  };

  const handleExportCSV = () => {
    const dataToExport = selectedIds.size > 0 ? history.filter(h => selectedIds.has(h._id)) : history;
    const csvHeaders = "Date,Type,Status,Farm,Details\n";
    const csvRows = dataToExport.map(h => {
      let details = "";
      if (h.type === 'Soil Analysis') details = `Moisture: ${h.moisture}% pH: ${h.pH}`;
      if (h.type === 'Disease Diagnosis') details = `Disease: ${h.diseaseName} (${(h.confidence*100 || 0).toFixed(0)}%)`;
      if (h.type === 'Yield Prediction') details = `Crop: ${h.cropType} Yield: ${h.predictedYield}t`;
      if (h.type === 'AI Insights') details = h.summary || 'Insight report';
      
      const cleanDetails = (details || '').replace(/"/g, '""');
      const cleanFarmName = (h.farmName || '').replace(/"/g, '""');
      const cleanType = (h.type || '').replace(/"/g, '""');
      const cleanStatus = (h.status || '').replace(/"/g, '""');
      
      return `${new Date(h.createdAt).toLocaleDateString()},"${cleanType}","${cleanStatus}","${cleanFarmName}","${cleanDetails}"`;
    }).join("\n");
    
    const blob = new Blob([csvHeaders + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `enterprise_reports_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Exported successfully');
  };

  const handleDownloadSingleReport = async (item: any) => {
    showToast('Generating PDF report...', 'info');
    try {
      const doc = new jsPDF();
      const farmName = item.farmName || 'Farm Report';
      const date = new Date(item.createdAt).toLocaleString();

      // Header gradient bar
      doc.setFillColor(147, 51, 234); // purple
      doc.rect(0, 0, 210, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Smart Agriculture Digital Twin', 14, 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.type} Report`, 14, 17);

      // Reset text color
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.text(`Farm: ${farmName}`, 14, 32);
      doc.text(`Generated: ${date}`, 14, 39);
      doc.text(`Status: ${item.status}`, 14, 46);

      let yPos = 56;

      if (item.type === 'Soil Analysis') {
        autoTable(doc, {
          startY: yPos,
          head: [['Parameter', 'Value']],
          body: [
            ['pH', item.pH ?? 'N/A'],
            ['Moisture', `${item.moisture ?? 'N/A'}%`],
            ['Nitrogen', `${item.nitrogen ?? 'N/A'} mg/kg`],
            ['Phosphorus', `${item.phosphorus ?? 'N/A'} mg/kg`],
            ['Potassium', `${item.potassium ?? 'N/A'} mg/kg`],
            ['Organic Carbon', `${item.organicCarbon ?? 'N/A'}%`],
            ['Temperature', `${item.temperature ?? 'N/A'}°C`],
            ['Humidity', `${item.humidity ?? 'N/A'}%`],
            ['Soil Health Score', item.soilHealth ? `${item.soilHealth}/10` : 'N/A'],
            ['Risk Level', item.riskLevel ?? 'N/A'],
          ],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [147, 51, 234] }
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
        if (item.recommendations?.length > 0) {
          doc.setFontSize(11); doc.setFont('helvetica', 'bold');
          doc.text('AI Recommendations:', 14, yPos); yPos += 7;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          item.recommendations.forEach((r: string) => {
            const lines = doc.splitTextToSize(`• ${r}`, 180);
            doc.text(lines, 14, yPos); yPos += lines.length * 5 + 2;
          });
        }
      } else if (item.type === 'Disease Diagnosis') {
        autoTable(doc, {
          startY: yPos,
          head: [['Field', 'Value']],
          body: [
            ['Crop Type', item.cropType ?? 'N/A'],
            ['Disease Detected', item.diseaseName ?? 'N/A'],
            ['Confidence', `${((item.confidence || 0) * 100).toFixed(1)}%`],
          ],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [147, 51, 234] }
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('Treatment Plan:', 14, yPos); yPos += 7;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        const treatLines = doc.splitTextToSize(item.treatment || 'N/A', 180);
        doc.text(treatLines, 14, yPos);
      } else if (item.type === 'Yield Prediction') {
        autoTable(doc, {
          startY: yPos,
          head: [['Metric', 'Value']],
          body: [
            ['Crop Type', item.cropType ?? 'N/A'],
            ['Area', `${item.area ?? 'N/A'} acres`],
            ['Predicted Yield', `${item.predictedYield ?? 'N/A'} tons`],
            ['Confidence Margin', `${item.errorMargin ?? 'N/A'}%`],
          ],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [147, 51, 234] }
        });
      } else if (item.type === 'AI Insights') {
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(item.summary || 'No details available.', 180);
        doc.text(lines, 14, yPos);
      }

      // Footer
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('Generated by Smart Agriculture Digital Twin — Powered by Gemini AI', 14, 285);

      doc.save(`${item.type.toLowerCase().replace(/\s+/g, '_')}_report_${item._id}.pdf`);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    }
  };

  const generateFullFarmPDF = async (farmId: string, farmName: string) => {
    showToast('Generating comprehensive farm PDF...', 'info');
    try {
      const res = await fetch(`/api/reports/full-summary?farmId=${farmId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to fetch farm data');

      const doc = new jsPDF();

      // Cover header
      doc.setFillColor(147, 51, 234);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('Farm Intelligence Report', 14, 13);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(`${farmName} — ${new Date().toLocaleDateString()}`, 14, 23);

      let yPos = 42;
      doc.setTextColor(30, 30, 30);

      // Farm overview
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('Farm Overview', 14, yPos); yPos += 8;
      autoTable(doc, {
        startY: yPos,
        body: [
          ['Name', data.farm.name],
          ['Location', data.farm.location || 'N/A'],
          ['Area', `${data.farm.area} acres`],
          ['Primary Crop', data.farm.cropType],
        ],
        styles: { fontSize: 10 },
        theme: 'striped'
      });
      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Latest Soil Analysis
      if (data.soilAnalyses?.length > 0) {
        const soil = data.soilAnalyses[0];
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('Latest Soil Analysis', 14, yPos); yPos += 8;
        autoTable(doc, {
          startY: yPos,
          head: [['Parameter', 'Value']],
          body: [
            ['pH', soil.pH], ['Moisture', `${soil.moisture}%`],
            ['N / P / K', `${soil.nitrogen} / ${soil.phosphorus} / ${soil.potassium} mg/kg`],
            ['Soil Health', soil.soilHealth ? `${soil.soilHealth}/10` : 'N/A'],
            ['Risk Level', soil.riskLevel || 'N/A'],
          ],
          headStyles: { fillColor: [147, 51, 234] },
          styles: { fontSize: 9 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // Disease Reports
      if (data.diseaseReports?.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('Disease Diagnostics', 14, yPos); yPos += 8;
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Crop', 'Disease', 'Confidence']],
          body: data.diseaseReports.map((d: any) => [
            new Date(d.createdAt).toLocaleDateString(),
            d.cropType, d.diseaseName,
            `${((d.confidence || 0) * 100).toFixed(1)}%`
          ]),
          headStyles: { fillColor: [239, 68, 68] },
          styles: { fontSize: 9 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // Yield Predictions
      if (data.yieldPredictions?.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('Yield Predictions', 14, yPos); yPos += 8;
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Crop', 'Area (ac)', 'Yield (t)', 'Accuracy']],
          body: data.yieldPredictions.map((y: any) => [
            new Date(y.createdAt).toLocaleDateString(),
            y.cropType, y.area, y.predictedYield,
            `${(100 - (y.errorMargin || 0)).toFixed(1)}%`
          ]),
          headStyles: { fillColor: [16, 185, 129] },
          styles: { fontSize: 9 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // Irrigation Records
      if (data.irrigationRecords?.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('Irrigation History', 14, yPos); yPos += 8;
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Duration (min)', 'Water (L)', 'Status']],
          body: data.irrigationRecords.map((r: any) => [
            new Date(r.date).toLocaleDateString(), r.duration, r.waterAmount, r.status
          ]),
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 }
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text(`Smart Agriculture Digital Twin — Powered by Gemini AI — Page ${i}/${pageCount}`, 14, 290);
      }

      doc.save(`farm_report_${farmName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`);
      showToast('Full farm PDF exported successfully!', 'success');
    } catch (err: any) {
      console.error('Full farm PDF error:', err);
      showToast('Failed to generate full PDF: ' + err.message, 'error');
    }
  };


  const handlePrint = () => {
    window.print();
  };

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // Filtering & Sorting
  const filteredData = useMemo(() => {
    let filtered = history.filter(item => {
      const matchesSearch = 
        item.type?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.farmName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.diseaseName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.cropType?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'All' || item.type === filterType;
      
      const matchesStatus = 
        filterStatus === 'All' 
          ? !item.isArchived
          : filterStatus === 'Archived'
            ? !!item.isArchived
            : filterStatus === 'Favorites'
              ? !!item.isFavorite && !item.isArchived
              : item.status === filterStatus && !item.isArchived;

      const matchesFarm = filterFarm === 'All' || item.farmName === filterFarm;
      
      let matchesDate = true;
      if (filterDate !== 'All Time') {
        const itemDate = new Date(item.createdAt);
        const now = new Date();
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (filterDate === 'Last 7 Days') matchesDate = diffDays <= 7;
        if (filterDate === 'Last 30 Days') matchesDate = diffDays <= 30;
        if (filterDate === 'This Year') matchesDate = itemDate.getFullYear() === now.getFullYear();
      }

      return matchesSearch && matchesType && matchesStatus && matchesFarm && matchesDate;
    });

    filtered.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (sortConfig.key === 'createdAt') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = valA !== undefined ? String(valA).toLowerCase() : '';
        valB = valB !== undefined ? String(valB).toLowerCase() : '';
      }
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [history, searchQuery, filterType, filterStatus, filterFarm, filterDate, sortConfig]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Analytics Data
  const reportTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach(h => { counts[h.type] = (counts[h.type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [history]);

  const reportsTimeline = useMemo(() => {
    const timeline: Record<string, number> = {};
    history.forEach(h => {
      const month = new Date(h.createdAt).toLocaleString('default', { month: 'short' });
      timeline[month] = (timeline[month] || 0) + 1;
    });
    return Object.entries(timeline).reverse().map(([name, count]) => ({ name, count })).slice(0, 6).reverse();
  }, [history]);

  const summaryStats = {
    total: history.length,
    soil: history.filter(h => h.type === 'Soil Analysis').length,
    disease: history.filter(h => h.type === 'Disease Diagnosis').length,
    yield: history.filter(h => h.type === 'Yield Prediction').length,
    ai: history.filter(h => h.type === 'AI Insights').length,
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Processing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'Soil Analysis': return <Droplets className="h-4 w-4 text-blue-400" />;
      case 'Disease Diagnosis': return <Activity className="h-4 w-4 text-red-400" />;
      case 'Yield Prediction': return <Target className="h-4 w-4 text-emerald-400" />;
      case 'AI Insights': return <Sparkles className="h-4 w-4 text-[#D946EF]" />;
      default: return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 relative">
      <style>{`
        @media print {
          header, nav, aside, .no-print, button, input, select, .fixed, .absolute {
            display: none !important;
          }
          body, .min-h-screen {
            background: white !important;
            color: black !important;
          }
          .space-y-6 {
            margin: 0 !important;
            padding: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            background: white !important;
            color: black !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            padding: 12px !important;
            color: black !important;
            background: white !important;
          }
          tr {
            background: white !important;
          }
          text, span, div {
            color: black !important;
          }
        }
      `}</style>
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
            <h2 className="text-3xl font-black text-white tracking-tight">Reports Center</h2>
          </div>
          <p className="text-[#E9D5FF] max-w-2xl">
            Comprehensive analytics, historical data, and AI-generated insights across your farming operations.
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={generateAIReport} 
            disabled={generatingAI}
            className="px-4 py-2.5 bg-gradient-to-r from-[#D946EF] to-[#8B5CF6] hover:opacity-90 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#D946EF]/20 disabled:opacity-50"
            title="Generate custom AI Agronomist Analysis"
          >
            {generatingAI ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generatingAI ? 'Consulting AI...' : 'Generate AI Insights'}
          </button>
          <button onClick={handlePrint} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={handleExportCSV} className="px-4 py-2.5 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:opacity-90 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#9333EA]/20">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          {farms.length > 0 && (
            <button 
              onClick={() => generateFullFarmPDF(farms[0].id, farms[0].name)} 
              className="px-4 py-2.5 bg-gradient-to-r from-[#10B981] to-[#3B82F6] hover:opacity-90 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#10B981]/20"
              title="Download a comprehensive multi-page PDF with all farm data"
            >
              <FileText className="h-4 w-4" /> Full Farm PDF
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Reports', value: summaryStats.total, icon: FileText, color: 'text-purple-400' },
          { label: 'Soil Analysis', value: summaryStats.soil, icon: Droplets, color: 'text-blue-400' },
          { label: 'Disease Scans', value: summaryStats.disease, icon: Activity, color: 'text-red-400' },
          { label: 'Yield Est.', value: summaryStats.yield, icon: Target, color: 'text-emerald-400' },
          { label: 'AI Insights', value: summaryStats.ai, icon: Sparkles, color: 'text-[#D946EF]' },
        ].map((stat, i) => (
          <div key={i} className="bg-gradient-to-br from-[#121024] to-[#1E1B4B] p-5 rounded-2xl border border-white/10 flex flex-col justify-between group hover:bg-white/5 transition-colors shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color} opacity-80`} />
            </div>
            <span className="text-3xl font-black text-white">{loading ? '-' : stat.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-4 no-scrollbar">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap focus:outline-none ${
            activeTab === 'list' 
              ? 'bg-[#9333EA]/20 text-[#D946EF] border border-[#9333EA]/30' 
              : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <FileText className="h-4 w-4" /> Document Archive
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap focus:outline-none ${
            activeTab === 'analytics' 
              ? 'bg-[#9333EA]/20 text-[#D946EF] border border-[#9333EA]/30' 
              : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <BarChart2 className="h-4 w-4" /> Visual Analytics
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-16 bg-white/5 animate-pulse rounded-2xl"></div>
          <div className="h-64 bg-white/5 animate-pulse rounded-3xl"></div>
        </div>
      ) : activeTab === 'list' ? (
        <div className="bg-[#121024]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
          
          {/* Advanced Toolbar */}
          <div className="p-4 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" placeholder="Search reports, crops, findings..." value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#9333EA] transition-colors"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 border border-white/10 rounded-xl p-1 bg-black/40">
                <Filter className="h-4 w-4 text-gray-400 ml-2" />
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }} className="h-9 bg-transparent text-sm text-white focus:outline-none px-2 appearance-none">
                  {REPORT_TYPES.map(t => <option key={t} value={t} className="bg-[#121024]">{t}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 border border-white/10 rounded-xl p-1 bg-black/40">
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="h-9 bg-transparent text-sm text-white focus:outline-none px-3 appearance-none">
                  {STATUSES.map(s => <option key={s} value={s} className="bg-[#121024]">{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 border border-white/10 rounded-xl p-1 bg-black/40 hidden md:flex">
                <select value={filterDate} onChange={e => { setFilterDate(e.target.value); setCurrentPage(1); }} className="h-9 bg-transparent text-sm text-white focus:outline-none px-3 appearance-none">
                  <option className="bg-[#121024]">All Time</option>
                  <option className="bg-[#121024]">Last 7 Days</option>
                  <option className="bg-[#121024]">Last 30 Days</option>
                  <option className="bg-[#121024]">This Year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-[#9333EA]/20 border-b border-[#9333EA]/30 px-6 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-[#E9D5FF]">{selectedIds.size} items selected</span>
              <div className="flex items-center gap-3">
                <button onClick={handleExportCSV} className="text-xs font-bold text-white bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-lg flex items-center gap-2"><Download className="h-3 w-3" /> Export Selected</button>
                <button onClick={handleBulkDelete} className="text-xs font-bold text-red-200 bg-red-500/20 hover:bg-red-500/40 px-3 py-1.5 rounded-lg flex items-center gap-2"><Trash2 className="h-3 w-3" /> Delete</button>
              </div>
            </motion.div>
          )}

          {/* Table */}
          <div className="overflow-x-auto min-h-[400px]">
            {filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4"><Search className="h-8 w-8 text-gray-500" /></div>
                <h3 className="text-lg font-bold text-white mb-2">No Reports Found</h3>
                <p className="text-gray-400 text-sm">Adjust your filters or search query to find what you're looking for.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400 bg-black/20">
                    <th className="p-4 w-12 text-center">
                      <input type="checkbox" checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-white/20 bg-black/40 accent-[#9333EA] cursor-pointer" />
                    </th>
                    <th className="p-4 w-12"></th>
                    <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('createdAt')}>
                      <div className="flex items-center gap-2">Date {sortConfig.key === 'createdAt' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}</div>
                    </th>
                    <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('type')}>
                      <div className="flex items-center gap-2">Report Type {sortConfig.key === 'type' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}</div>
                    </th>
                    <th className="p-4 font-bold">Details</th>
                    <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>Status</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedData.map((item) => (
                    <tr 
                      key={item._id} 
                      onClick={() => setSelectedReport(item)}
                      className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedIds.has(item._id) ? 'bg-[#9333EA]/10' : ''}`}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(item._id)} onChange={(e) => toggleSelection(item._id, e as any)} className="w-4 h-4 rounded border-white/20 bg-black/40 accent-[#9333EA] cursor-pointer" />
                      </td>
                      <td className="p-4" onClick={(e) => toggleFavorite(item._id, e as any)}>
                        <Star className={`h-4 w-4 cursor-pointer transition-colors ${item.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-gray-500 hover:text-yellow-500'}`} />
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold text-gray-200">{new Date(item.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            {getTypeIcon(item.type)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{item.type}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[150px]">{item.farmName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-300 max-w-xs truncate">
                          {item.type === 'Soil Analysis' && `Moisture: ${item.moisture}%, pH: ${item.pH}`}
                          {item.type === 'Disease Diagnosis' && `Identified: ${item.diseaseName} (${(item.confidence*100 || 0).toFixed(0)}%)`}
                          {item.type === 'Yield Prediction' && `Est: ${item.predictedYield} tons of ${item.cropType}`}
                          {item.type === 'AI Insights' && item.summary}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={(e) => toggleArchive(item._id, e)}
                            className="p-1.5 text-gray-400 hover:text-[#D946EF] hover:bg-white/5 rounded-lg transition-colors"
                            title={item.isArchived ? "Restore to active" : "Archive report"}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleSingleDelete(item._id)}
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                            title="Delete report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
              <span className="text-sm text-gray-400">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries</span>
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><Activity className="h-5 w-5 text-[#9333EA]" /> Report Generation Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportsTimeline}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D946EF" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#D946EF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff50" tick={{fontSize: 12}} />
                  <YAxis stroke="#ffffff50" tick={{fontSize: 12}} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                  <Area type="monotone" dataKey="count" stroke="#D946EF" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" name="Reports Generated" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#121024]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-[#10B981]" /> Reports by Category</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {reportTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#121024', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#ccc' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Report Details Drawer */}
      <AnimatePresence>
        {selectedReport && (
          <React.Fragment>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSelectedReport(null)}
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#121024] border-l border-white/10 shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gradient-to-br from-white/5 to-transparent">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(selectedReport.type)}
                    <span className="text-xs font-bold text-[#E9D5FF] uppercase tracking-wider">{selectedReport.type}</span>
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedReport.farmName} Report</h2>
                  <p className="text-sm text-gray-400 mt-1">{new Date(selectedReport.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => toggleArchive(selectedReport._id, e)} 
                    className="p-2 text-gray-400 hover:text-[#D946EF] bg-black/40 rounded-full transition-colors animate-all"
                    title={selectedReport.isArchived ? "Restore report to active" : "Archive report"}
                  >
                    <Archive className="h-5 w-5" />
                  </button>
                  <button onClick={() => setSelectedReport(null)} className="p-2 text-gray-400 hover:text-white bg-black/40 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(selectedReport.status)}`}>
                    {selectedReport.status}
                  </span>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white border-b border-white/10 pb-2">Analysis Findings</h4>
                  
                  {selectedReport.type === 'Soil Analysis' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                        <span className="text-xs text-gray-400 font-bold uppercase block mb-1">Moisture Level</span>
                        <span className="text-2xl font-black text-blue-400">{selectedReport.moisture}%</span>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                        <span className="text-xs text-gray-400 font-bold uppercase block mb-1">pH Level</span>
                        <span className="text-2xl font-black text-emerald-400">{selectedReport.pH}</span>
                      </div>
                      {selectedReport.recommendations && (
                        <div className="col-span-2 bg-white/5 p-4 rounded-2xl border border-white/10 mt-2">
                           <span className="text-xs text-gray-400 font-bold uppercase block mb-2">Recommendations</span>
                           <ul className="list-disc pl-4 space-y-1 text-sm text-gray-200">
                             {selectedReport.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                           </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedReport.type === 'Disease Diagnosis' && (
                    <div className="space-y-4">
                      <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                        <span className="text-xs text-red-400 font-bold uppercase block mb-1">Pathogen Detected</span>
                        <span className="text-2xl font-black text-white">{selectedReport.diseaseName}</span>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-400">AI Confidence:</span>
                          <span className="text-sm font-bold text-emerald-400">{(selectedReport.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                         <span className="text-xs text-gray-400 font-bold uppercase block mb-2">Treatment Plan</span>
                         <p className="text-sm text-gray-200">{selectedReport.treatment || 'No specific treatment logged. Consult agronomist.'}</p>
                      </div>
                    </div>
                  )}

                  {selectedReport.type === 'Yield Prediction' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 col-span-2 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-gray-400 font-bold uppercase block mb-1">Crop Type</span>
                          <span className="text-xl font-bold text-white">{selectedReport.cropType}</span>
                        </div>
                        <Leaf className="h-8 w-8 text-emerald-500 opacity-50" />
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                        <span className="text-xs text-gray-400 font-bold uppercase block mb-1">Planted Area</span>
                        <span className="text-xl font-bold text-gray-200">{selectedReport.area || '--'} acres</span>
                      </div>
                      <div className="bg-[#10B981]/10 p-4 rounded-2xl border border-[#10B981]/30">
                        <span className="text-xs text-[#34D399] font-bold uppercase block mb-1">Est. Yield</span>
                        <span className="text-2xl font-black text-white">{selectedReport.predictedYield}t</span>
                      </div>
                    </div>
                  )}

                  {selectedReport.type === 'AI Insights' && (
                    <div className="bg-[#9333EA]/10 p-5 rounded-2xl border border-[#9333EA]/30">
                      <Sparkles className="h-6 w-6 text-[#D946EF] mb-3" />
                      <p className="text-sm text-gray-200 leading-relaxed">{selectedReport.summary}</p>
                    </div>
                  )}

                  {/* ID Reference */}
                  <div className="pt-8">
                     <p className="text-[10px] text-gray-600 font-mono text-center">REF: {selectedReport._id}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3">
                <button onClick={() => handleDownloadSingleReport(selectedReport)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <Download className="h-4 w-4" /> Download
                </button>
                <button onClick={() => handleShare(selectedReport)} className="flex-1 py-3 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:opacity-90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}
