import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Eye, Sliders, Layout } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';

const PlotsModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  
  // State for dataset selection
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // State for plot configurations
  const [plotType, setPlotType] = useState('boxplot');
  const [xVar, setXVar] = useState('');
  const [yVar, setYVar] = useState('');
  const [hueVar, setHueVar] = useState('');
  
  // Customization settings
  const [title, setTitle] = useState('');
  const [xlabel, setXlabel] = useState('');
  const [ylabel, setYlabel] = useState('');
  const [palette, setPalette] = useState('sunset');
  const [legendLoc, setLegendLoc] = useState('best');
  const [showGrid, setShowGrid] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('standard');
  const [textColor, setTextColor] = useState('#1E293B');

  // Specific settings
  const [bins, setBins] = useState(10);
  const [kde, setKde] = useState(true);
  const [fitReg, setFitReg] = useState(false);

  // Error bar settings
  const [errorbarToggle, setErrorbarToggle] = useState(false);
  const [errorbarType, setErrorbarType] = useState('sd');

  // Typography Settings
  const [titleFontSize, setTitleFontSize] = useState(12);
  const [titleFontFamily, setTitleFontFamily] = useState('sans-serif');
  const [labelFontSize, setLabelFontSize] = useState(10);
  const [labelFontFamily, setLabelFontFamily] = useState('sans-serif');
  const [tickFontSize, setTickFontSize] = useState(9);
  const [tickFontFamily, setTickFontFamily] = useState('sans-serif');

  // Axis scale settings
  const [xlimMin, setXlimMin] = useState('');
  const [xlimMax, setXlimMax] = useState('');
  const [ylimMin, setYlimMin] = useState('');
  const [ylimMax, setYlimMax] = useState('');
  const [xInterval, setXInterval] = useState('');
  const [yInterval, setYInterval] = useState('');

  // Selected Y variables for multiline and pcabiplot
  const [selectedYVars, setSelectedYVars] = useState([]);

  // Download export settings
  const [downloadDpi, setDownloadDpi] = useState(300);
  
  // State for results
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [plotB64, setPlotB64] = useState(null);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);

  const handleReset = () => {
    setFile(null);
    setColumns([]);
    setNumericColumns([]);
    setPlotType('boxplot');
    setXVar('');
    setYVar('');
    setHueVar('');
    setTitle('');
    setXlabel('');
    setYlabel('');
    setPalette('sunset');
    setLegendLoc('best');
    setShowGrid(true);
    setAspectRatio('standard');
    setTextColor('#1E293B');
    setBins(10);
    setKde(true);
    setFitReg(false);
    setErrorbarToggle(false);
    setErrorbarType('sd');
    setTitleFontSize(12);
    setTitleFontFamily('sans-serif');
    setLabelFontSize(10);
    setLabelFontFamily('sans-serif');
    setTickFontSize(9);
    setTickFontFamily('sans-serif');
    setXlimMin('');
    setXlimMax('');
    setYlimMin('');
    setYlimMax('');
    setXInterval('');
    setYInterval('');
    setSelectedYVars([]);
    setDownloadDpi(300);
    setPlotB64(null);
    setError(null);
    setShowDesignPanel(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (selectedFile) => {
    setError(null);
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError("Supported formats: CSV or Excel (.xlsx, .xls) only.");
      return;
    }

    setFile(selectedFile);
    setLoadingCols(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_URL}/analyze/columns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to read columns.");
      }

      setColumns(data.columns || []);
      setNumericColumns(data.numeric_columns || []);

      // Set default variables
      if (data.numeric_columns && data.numeric_columns.length > 0) {
        setXVar(data.numeric_columns[0]);
        if (data.numeric_columns.length > 1) {
          setYVar(data.numeric_columns[1]);
        }
      } else if (data.columns && data.columns.length > 0) {
        setXVar(data.columns[0]);
        if (data.columns.length > 1) {
          setYVar(data.columns[1]);
        }
      }
    } catch (err) {
      setError(err.message);
      setFile(null);
    } finally {
      setLoadingCols(false);
    }
  };

  // Adjust inputs based on plotType selection
  const handlePlotTypeChange = (type) => {
    setPlotType(type);
    setError(null);
    // Adjust defaults if necessary
    if (type === 'pie') {
      // Prefer categorical for X
      const categorical = columns.filter(c => !numericColumns.includes(c));
      if (categorical.length > 0) {
        setXVar(categorical[0]);
      }
    } else if (['histogram', 'qqplot'].includes(type)) {
      // Require numeric for X
      if (numericColumns.length > 0 && !numericColumns.includes(xVar)) {
        setXVar(numericColumns[0]);
      }
    }
  };

  const runAnalysis = async (e) => {
    e.preventDefault();
    if (!file || !xVar) return;

    if (['scatter', 'line', 'barplot', 'violin'].includes(plotType) && !yVar) {
      setError(`Y Variable is required for ${plotType} charts.`);
      return;
    }

    if (['multiline', 'pcabiplot'].includes(plotType) && selectedYVars.length < 1) {
      setError("Please select at least one numeric variable.");
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setPlotB64(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('plot_type', plotType);
    formData.append('x_var', xVar);
    if (['boxplot', 'scatter', 'line', 'barplot', 'violin'].includes(plotType) && yVar) {
      formData.append('y_var', yVar);
    }
    if (['boxplot', 'histogram', 'scatter', 'line', 'barplot', 'violin', 'pcabiplot'].includes(plotType) && hueVar) {
      formData.append('hue_var', hueVar);
    }
    if (plotType === 'histogram') {
      formData.append('bins', bins);
      formData.append('kde', kde);
    }
    if (plotType === 'scatter') {
      formData.append('fit_reg', fitReg);
    }

    // Error bars
    if (['barplot', 'line'].includes(plotType)) {
      formData.append('errorbar_toggle', errorbarToggle);
      formData.append('errorbar_type', errorbarType);
    }

    // Selected Y variables list
    if (['multiline', 'pcabiplot'].includes(plotType)) {
      formData.append('y_vars_str', selectedYVars.join(','));
    }

    // Customization
    if (title) formData.append('title', title);
    if (xlabel) formData.append('xlabel', xlabel);
    if (ylabel) formData.append('ylabel', ylabel);
    formData.append('palette', palette);
    formData.append('legend_loc', legendLoc);
    formData.append('show_grid', showGrid);
    formData.append('aspect_ratio', aspectRatio);
    formData.append('text_color', textColor);

    // Font Customization
    formData.append('title_font_size', titleFontSize.toString());
    formData.append('title_font_family', titleFontFamily);
    formData.append('label_font_size', labelFontSize.toString());
    formData.append('label_font_family', labelFontFamily);
    formData.append('tick_font_size', tickFontSize.toString());
    formData.append('tick_font_family', tickFontFamily);

    // Axis Limits & Intervals
    if (xlimMin) formData.append('xlim_min', xlimMin);
    if (xlimMax) formData.append('xlim_max', xlimMax);
    if (ylimMin) formData.append('ylim_min', ylimMin);
    if (ylimMax) formData.append('ylim_max', ylimMax);
    if (xInterval) formData.append('x_interval', xInterval);
    if (yInterval) formData.append('y_interval', yInterval);

    try {
      const res = await fetch(`${API_URL}/analyze/plot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Plot generation execution failed.");
      }
      setPlotB64(data.plot);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const triggerDownload = async (format) => {
    if (!file || !xVar) return;
    try {
      setError(null);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('plot_type', plotType);
      formData.append('x_var', xVar);
      
      if (['boxplot', 'scatter', 'line', 'barplot', 'violin'].includes(plotType) && yVar) {
        formData.append('y_var', yVar);
      }
      if (['boxplot', 'histogram', 'scatter', 'line', 'barplot', 'violin', 'pcabiplot'].includes(plotType) && hueVar) {
        formData.append('hue_var', hueVar);
      }
      if (plotType === 'histogram') {
        formData.append('bins', bins);
        formData.append('kde', kde);
      }
      if (plotType === 'scatter') {
        formData.append('fit_reg', fitReg);
      }
      
      // Error bars
      if (['barplot', 'line'].includes(plotType)) {
        formData.append('errorbar_toggle', errorbarToggle);
        formData.append('errorbar_type', errorbarType);
      }

      // Selected Y vars
      if (['multiline', 'pcabiplot'].includes(plotType)) {
        formData.append('y_vars_str', selectedYVars.join(','));
      }

      // Customization
      if (title) formData.append('title', title);
      if (xlabel) formData.append('xlabel', xlabel);
      if (ylabel) formData.append('ylabel', ylabel);
      formData.append('palette', palette);
      formData.append('legend_loc', legendLoc);
      formData.append('show_grid', showGrid);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('text_color', textColor);

      // Fonts
      formData.append('title_font_size', titleFontSize.toString());
      formData.append('title_font_family', titleFontFamily);
      formData.append('label_font_size', labelFontSize.toString());
      formData.append('label_font_family', labelFontFamily);
      formData.append('tick_font_size', tickFontSize.toString());
      formData.append('tick_font_family', tickFontFamily);

      // Limits
      if (xlimMin) formData.append('xlim_min', xlimMin);
      if (xlimMax) formData.append('xlim_max', xlimMax);
      if (ylimMin) formData.append('ylim_min', ylimMin);
      if (ylimMax) formData.append('ylim_max', ylimMax);
      if (xInterval) formData.append('x_interval', xInterval);
      if (yInterval) formData.append('y_interval', yInterval);

      // Download format & resolution
      formData.append('download_format', format);
      formData.append('dpi', downloadDpi.toString());

      const res = await fetch(`${API_URL}/analyze/plot/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Direct download endpoint execution failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statsathi_${plotType}_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAnalyzeNew = () => {
    setPlotB64(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[640px] w-full max-w-4xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-800">
              Data Visualization & Plots
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Generate publication-grade custom charts, plots, and figures styled in your research palette.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error}</span>
            </div>
          )}

          {/* Step 1: File Upload */}
          {!file && !loadingCols && (
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-16 px-6 text-center cursor-pointer transition-all duration-200 ${
                dragActive ? 'border-brand-indigo bg-indigo-50/30' : 'border-slate-300 hover:border-brand-indigo hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleChange}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
                <Upload className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-sans text-sm font-semibold text-slate-700">Select or drop dataset for visualization</p>
              <p className="font-sans text-xs text-slate-400 mt-1">Supports CSV, XLSX, and XLS formats</p>
            </div>
          )}

          {/* Loading columns indicator */}
          {loadingCols && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Reading dataset columns...</p>
            </div>
          )}

          {/* Step 2: Configure Plot Form */}
          {file && !loadingCols && !plotB64 && !loadingAnalysis && (
            <form onSubmit={runAnalysis} className="space-y-6">
              {/* Dataset Banner */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex justify-between items-center">
                <div className="truncate">
                  <p className="font-sans text-xs font-bold text-slate-400 uppercase">Selected Dataset</p>
                  <p className="font-sans text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1"
                  >
                    <Eye className="h-3.5 w-3.5 text-brand-orange" />
                    <span>View Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
              </div>

              {/* Core Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Select Plot Type */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Visualization Type</label>
                  <select
                    value={plotType}
                    onChange={(e) => handlePlotTypeChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    <option value="boxplot">Box Plot (Grouped/Single)</option>
                    <option value="barplot">Bar Chart (with Error Bars)</option>
                    <option value="line">Line Graph (with Error Bars)</option>
                    <option value="violin">Violin Plot (Grouped Split)</option>
                    <option value="histogram">Histogram / Density</option>
                    <option value="qqplot">Normal Q-Q Plot</option>
                    <option value="scatter">Scatter Plot (with Trendline)</option>
                    <option value="pie">Pie Chart (Category Shares)</option>
                    <option value="multiline">High-Density Multi-Line Plot</option>
                    <option value="pcabiplot">PCA Biplot (PC1 vs PC2)</option>
                  </select>
                </div>

                {/* Variable X selection (Hidden for PCA Biplot) */}
                {plotType !== 'pcabiplot' && (
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      {['histogram', 'qqplot', 'multiline'].includes(plotType) ? 'Variable (Numeric)' : plotType === 'pie' ? 'Categorical Variable' : 'X Axis Variable'}
                    </label>
                    <select
                      value={xVar}
                      onChange={(e) => setXVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">-- Select Variable X --</option>
                      {['histogram', 'qqplot', 'scatter', 'multiline'].includes(plotType) 
                        ? numericColumns.map(c => <option key={c} value={c}>{c}</option>)
                        : columns.map(c => <option key={c} value={c}>{c}</option>)
                      }
                    </select>
                  </div>
                )}

                {/* Variable Y selection (boxplot, scatter, line, barplot, violin) */}
                {['boxplot', 'scatter', 'line', 'barplot', 'violin'].includes(plotType) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      {plotType === 'boxplot' ? 'Y Axis Variable (Numeric, Optional)' : 'Y Axis Variable (Numeric)'}
                    </label>
                    <select
                      value={yVar}
                      onChange={(e) => setYVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">{plotType === 'boxplot' ? '-- Single Variable (No Grouping) --' : '-- Select Variable Y --'}</option>
                      {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Checklist variables for multiline and pcabiplot */}
                {['multiline', 'pcabiplot'].includes(plotType) && (
                  <div className="col-span-1 md:col-span-2 space-y-2 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      Select Numeric Columns ({selectedYVars.length} selected)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 max-h-[160px] overflow-y-auto">
                      {numericColumns.map(col => (
                        <label key={col} className="flex items-center space-x-2 rounded-lg bg-white p-2 border border-slate-200/50 hover:bg-slate-50 cursor-pointer shadow-xs">
                          <input
                            type="checkbox"
                            checked={selectedYVars.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedYVars([...selectedYVars, col]);
                              } else {
                                setSelectedYVars(selectedYVars.filter(v => v !== col));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
                          />
                          <span className="font-sans text-xs text-slate-700 truncate">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grouping Variable / Hue (boxplot, histogram, scatter, line, barplot, violin, pcabiplot) */}
                {['boxplot', 'histogram', 'scatter', 'line', 'barplot', 'violin', 'pcabiplot'].includes(plotType) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">Grouping Variable / Hue (Optional)</label>
                    <select
                      value={hueVar}
                      onChange={(e) => setHueVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">-- No Grouping Factor --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Error Bars Option Panel (barplot & line only) */}
                {['barplot', 'line'].includes(plotType) && (
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-indigo-50/20 border border-brand-indigo/10 p-4 animate-fade-in">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="err_bar_chk"
                        checked={errorbarToggle}
                        onChange={(e) => setErrorbarToggle(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
                      />
                      <label htmlFor="err_bar_chk" className="font-sans text-xs font-bold text-slate-700 cursor-pointer">
                        Enable Error Bars
                      </label>
                    </div>
                    {errorbarToggle && (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Error Bars Represent</label>
                        <select
                          value={errorbarType}
                          onChange={(e) => setErrorbarType(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo"
                        >
                          <option value="sd">Standard Deviation (SD)</option>
                          <option value="se">Standard Error (SE)</option>
                          <option value="ci">95% Confidence Interval (CI)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Histogram Settings */}
                {plotType === 'histogram' && (
                  <>
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="font-sans text-xs font-bold text-slate-500">Bins count: {bins}</label>
                      <input 
                        type="range" 
                        min="5" 
                        max="50" 
                        value={bins} 
                        onChange={(e) => setBins(parseInt(e.target.value))}
                        className="w-full accent-brand-indigo h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6 animate-fade-in">
                      <input
                        type="checkbox"
                        id="kde_chk"
                        checked={kde}
                        onChange={(e) => setKde(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
                      />
                      <label htmlFor="kde_chk" className="font-sans text-xs font-semibold text-slate-600 cursor-pointer">
                        Overlay Normal Density Curve (KDE)
                      </label>
                    </div>
                  </>
                )}

                {/* Scatter Settings */}
                {plotType === 'scatter' && (
                  <div className="flex items-center space-x-2 pt-6 animate-fade-in">
                    <input
                      type="checkbox"
                      id="reg_chk"
                      checked={fitReg}
                      onChange={(e) => setFitReg(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
                    />
                    <label htmlFor="reg_chk" className="font-sans text-xs font-semibold text-slate-600 cursor-pointer">
                      Fit Regression Trend Line
                    </label>
                  </div>
                )}
              </div>

              {/* Design Customizations Expandable Panel */}
              <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowDesignPanel(!showDesignPanel)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border-b border-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Sliders className="h-4 w-4 text-brand-indigo" />
                    <span className="font-display text-xs font-bold text-slate-700">Design Customizations & Labels</span>
                  </div>
                  <span className="font-sans text-[10px] font-bold text-brand-indigo">{showDesignPanel ? 'Hide Controls' : 'Show Controls'}</span>
                </button>
                
                {showDesignPanel && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in bg-white">
                    {/* Palette */}
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-medium text-slate-500">Color Palette</label>
                      <select
                        value={palette}
                        onChange={(e) => setPalette(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      >
                        <option value="sunset">Sunset Orange (Default)</option>
                        <option value="indigo">Indigo Blue</option>
                        <option value="teal">Teal Green</option>
                        <option value="crimson">Crimson Red</option>
                        <option value="charcoal">Charcoal Grey</option>
                        <option value="emerald">Emerald Green</option>
                        <option value="amber">Amber Gold</option>
                        <option value="rose">Rose Pink</option>
                        <option value="skyblue">Sky Blue</option>
                        <option value="forest">Forest Green</option>
                        <option value="navy">Dark Navy</option>
                        <option value="spring">Spring Breeze</option>
                        <option value="summer">Summer Heat</option>
                        <option value="autumn">Autumn Gold</option>
                        <option value="winter">Winter Ice</option>
                        <option value="coolwarm">Scientific Cool-Warm</option>
                        <option value="viridis">Scientific Viridis</option>
                      </select>
                    </div>

                    {/* Text & Label Color */}
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-medium text-slate-500">Text & Label Color</label>
                      <select
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      >
                        <option value="#1E293B">Slate Dark (Default)</option>
                        <option value="#0F172A">Charcoal Black</option>
                        <option value="#64748B">Muted Slate</option>
                        <option value="#312E81">Indigo Blue</option>
                        <option value="#064E3B">Forest Green</option>
                        <option value="#1E3A8A">Dark Navy</option>
                        <option value="#4C0519">Crimson Red</option>
                      </select>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-medium text-slate-500">Dimensions Ratio</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      >
                        <option value="standard">Standard (4:3)</option>
                        <option value="wide">Wide (16:9)</option>
                        <option value="square">Square (1:1)</option>
                      </select>
                    </div>

                    {/* Custom Title */}
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-medium text-slate-500">Custom Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Leave blank for automatic title"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      />
                    </div>

                    {/* Custom X Label */}
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-medium text-slate-500">X-Axis Label</label>
                      <input
                        type="text"
                        value={xlabel}
                        onChange={(e) => setXlabel(e.target.value)}
                        placeholder="Leave blank for default"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      />
                    </div>

                    {/* Custom Y Label */}
                    {['boxplot', 'scatter', 'line', 'qqplot'].includes(plotType) && (
                      <div className="space-y-1.5">
                        <label className="font-sans text-xs font-medium text-slate-500">Y-Axis Label</label>
                        <input
                          type="text"
                          value={ylabel}
                          onChange={(e) => setYlabel(e.target.value)}
                          placeholder="Leave blank for default"
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                        />
                      </div>
                    )}

                    {/* Legend Location */}
                    {['boxplot', 'histogram', 'scatter', 'line'].includes(plotType) && (
                      <div className="space-y-1.5">
                        <label className="font-sans text-xs font-medium text-slate-500">Legend Position</label>
                        <select
                          value={legendLoc}
                          onChange={(e) => setLegendLoc(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                        >
                          <option value="best">Auto (Best Fit)</option>
                          <option value="upper right">Top Right</option>
                          <option value="upper left">Top Left</option>
                          <option value="lower right">Bottom Right</option>
                          <option value="lower left">Bottom Left</option>
                          <option value="none">Hide Legend</option>
                        </select>
                      </div>
                    )}

                    {/* Gridlines */}
                    {plotType !== 'pie' && (
                      <div className="flex items-center space-x-2 pt-5">
                        <input
                          type="checkbox"
                          id="grid_chk"
                          checked={showGrid}
                          onChange={(e) => setShowGrid(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
                        />
                        <label htmlFor="grid_chk" className="font-sans text-xs font-semibold text-slate-600 cursor-pointer">
                          Draw Subtle Gridlines
                        </label>
                      </div>
                    )}

                    {/* Font controls block */}
                    <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-4 mt-2 space-y-4">
                      <h5 className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider">Typography Controls</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Title Font */}
                        <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                          <label className="font-sans text-xs font-bold text-slate-600 block">Chart Title</label>
                          <div className="space-y-1.5">
                            <label className="font-sans text-[10px] text-slate-400 uppercase">Family</label>
                            <select
                              value={titleFontFamily}
                              onChange={(e) => setTitleFontFamily(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs outline-hidden focus:border-brand-indigo"
                            >
                              <option value="sans-serif">Sans-Serif (Inter)</option>
                              <option value="serif">Serif (Times New Roman)</option>
                              <option value="monospace">Monospace (Courier)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="font-sans text-[10px] text-slate-400 uppercase">Size: {titleFontSize}px</label>
                            <input
                              type="range"
                              min="8"
                              max="24"
                              value={titleFontSize}
                              onChange={(e) => setTitleFontSize(parseInt(e.target.value))}
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo"
                            />
                          </div>
                        </div>

                        {/* Axis Labels Font */}
                        <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                          <label className="font-sans text-xs font-bold text-slate-600 block">Axis Labels</label>
                          <div className="space-y-1.5">
                            <label className="font-sans text-[10px] text-slate-400 uppercase">Family</label>
                            <select
                              value={labelFontFamily}
                              onChange={(e) => setLabelFontFamily(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs outline-hidden focus:border-brand-indigo"
                            >
                              <option value="sans-serif">Sans-Serif (Inter)</option>
                              <option value="serif">Serif (Times New Roman)</option>
                              <option value="monospace">Monospace (Courier)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="font-sans text-[10px] text-slate-400 uppercase">Size: {labelFontSize}px</label>
                            <input
                              type="range"
                              min="7"
                              max="18"
                              value={labelFontSize}
                              onChange={(e) => setLabelFontSize(parseInt(e.target.value))}
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo"
                            />
                          </div>
                        </div>

                        {/* Axis Ticks Font */}
                        <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                          <label className="font-sans text-xs font-bold text-slate-600 block">Axis Ticks</label>
                          <div className="space-y-1.5">
                            <label className="font-sans text-[10px] text-slate-400 uppercase">Family</label>
                            <select
                              value={tickFontFamily}
                              onChange={(e) => setTickFontFamily(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs outline-hidden focus:border-brand-indigo"
                            >
                              <option value="sans-serif">Sans-Serif (Inter)</option>
                              <option value="serif">Serif (Times New Roman)</option>
                              <option value="monospace">Monospace (Courier)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="font-sans text-[10px] text-slate-400 uppercase">Size: {tickFontSize}px</label>
                            <input
                              type="range"
                              min="6"
                              max="14"
                              value={tickFontSize}
                              onChange={(e) => setTickFontSize(parseInt(e.target.value))}
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manual Scale Limits & Intervals block */}
                    {plotType !== 'pie' && (
                      <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-4 mt-2 space-y-4">
                        <h5 className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider">Manual Axis Limits & Ticks</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {/* X Limits */}
                          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                            <label className="font-sans text-xs font-bold text-slate-600 block">X-Axis Range</label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="font-sans text-[9px] text-slate-400 uppercase block">Min</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={xlimMin}
                                  onChange={(e) => setXlimMin(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs focus:border-brand-indigo"
                                />
                              </div>
                              <div>
                                <label className="font-sans text-[9px] text-slate-400 uppercase block">Max</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={xlimMax}
                                  onChange={(e) => setXlimMax(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs focus:border-brand-indigo"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Y Limits */}
                          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                            <label className="font-sans text-xs font-bold text-slate-600 block">Y-Axis Range</label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="font-sans text-[9px] text-slate-400 uppercase block">Min</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={ylimMin}
                                  onChange={(e) => setYlimMin(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs focus:border-brand-indigo"
                                />
                              </div>
                              <div>
                                <label className="font-sans text-[9px] text-slate-400 uppercase block">Max</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={ylimMax}
                                  onChange={(e) => setYlimMax(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs focus:border-brand-indigo"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Intervals */}
                          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-3 col-span-2 sm:col-span-1">
                            <label className="font-sans text-xs font-bold text-slate-600 block">Interval Ticks</label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="font-sans text-[9px] text-slate-400 uppercase block">X Step</label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={xInterval}
                                  onChange={(e) => setXInterval(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs focus:border-brand-indigo"
                                />
                              </div>
                              <div>
                                <label className="font-sans text-[9px] text-slate-400 uppercase block">Y Step</label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={yInterval}
                                  onChange={(e) => setYInterval(e.target.value)}
                                  placeholder="Auto"
                                  className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 font-sans text-xs focus:border-brand-indigo"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
              >
                Generate Custom Visualization
              </button>
            </form>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Generating chart preview...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Output */}
          {plotB64 && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Visualization Preview
                  </h4>
                  <p className="text-xs text-brand-indigo font-semibold mt-0.5">
                    Chart: {plotType.toUpperCase()} ({xVar} {yVar ? `vs ${yVar}` : ''})
                  </p>
                </div>
                <div className="flex flex-col gap-3 max-w-sm w-full">
                  {/* DPI Toggle */}
                  <div className="flex items-center space-x-1 rounded-xl bg-slate-50 border border-slate-100 p-1">
                    <span className="font-sans text-[9px] font-bold text-slate-400 px-2 uppercase shrink-0">DPI:</span>
                    {[150, 300, 600].map(dpiVal => (
                      <button
                        key={dpiVal}
                        type="button"
                        onClick={() => setDownloadDpi(dpiVal)}
                        className={`flex-1 rounded-lg py-1 text-center font-sans text-[10px] font-bold transition-all ${
                          downloadDpi === dpiVal 
                            ? 'bg-brand-indigo text-white shadow-xs' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {dpiVal === 150 ? '150 Standard' : dpiVal === 300 ? '300 Print' : '600 Pub'}
                      </button>
                    ))}
                  </div>

                  {/* Format Download Buttons */}
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => triggerDownload('png')}
                      className="flex-1 min-w-[50px] flex items-center justify-center space-x-1 rounded-lg bg-brand-indigo hover:bg-indigo-700 text-white p-1 px-2 font-sans text-xs font-semibold transition-colors"
                      title="Download PNG image"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>PNG</span>
                    </button>
                    <button
                      onClick={() => triggerDownload('jpeg')}
                      className="flex-1 min-w-[50px] flex items-center justify-center space-x-1 rounded-lg bg-brand-indigo hover:bg-indigo-700 text-white p-1 px-2 font-sans text-xs font-semibold transition-colors"
                      title="Download JPEG image"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>JPEG</span>
                    </button>
                    <button
                      onClick={() => triggerDownload('svg')}
                      className="flex-1 min-w-[50px] flex items-center justify-center space-x-1 rounded-lg bg-brand-orange hover:bg-orange-600 text-white p-1 px-2 font-sans text-xs font-semibold transition-colors"
                      title="Download vector SVG"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>SVG</span>
                    </button>
                  </div>

                  {/* Utilities */}
                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      onClick={handleAnalyzeNew}
                      className="flex items-center space-x-1 rounded-lg bg-white border border-slate-200 p-1 px-2 hover:bg-slate-50 text-slate-600 font-sans text-xs font-semibold transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Configure New Plot</span>
                    </button>
                    <button
                      onClick={() => setViewerOpen(true)}
                      className="flex items-center space-x-1 rounded-lg bg-white border border-slate-200 p-1 px-2 hover:bg-slate-50 text-slate-600 font-sans text-xs font-semibold transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 text-brand-orange" />
                      <span>View Data</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Base64 Plot View */}
              <div className="flex flex-col items-center justify-center bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-inner">
                <img
                  src={`data:image/png;base64,${plotB64}`}
                  alt="Custom Chart Figure"
                  className="max-h-[350px] w-auto object-contain rounded-2xl border border-slate-200/50 bg-white p-2 shadow-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {file && (
            <button
              onClick={() => setViewerOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center space-x-1"
            >
              <Eye className="h-4 w-4 text-brand-orange" />
              <span>View Data</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <DatasetViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={file}
        onSave={(newFile) => setFile(newFile)}
      />
    </div>
  );
};

export default PlotsModal;
