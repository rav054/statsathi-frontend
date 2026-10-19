import { apiFetch } from '../utils/apiFetch';
import { useState, useEffect, useCallback } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, Download, RefreshCw, Eye, Sliders } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';

import FigurePresetSelect from './FigurePresetSelect';
import { PALETTE_OPTIONS, isStylePalette, paletteColors } from '../utils/figureStyle';
import { useFigurePreferences } from '../utils/figurePreferences';

// What each chart needs from the form.
//   x: 'numeric' | 'category' | 'any' | null (hidden)   y: 'optional' | 'required' | 'multi' | null
//   hue: 'optional' | 'required' | null                 multiToggle: single/multiple variable switches (classic charts)
const PLOT_GROUPS = ['Classic charts', 'Distributions', 'Comparisons', 'Relationships', 'Composition'];
const PLOT_SPECS = {
  boxplot: { label: 'Box Plot (Grouped/Single)', group: 'Classic charts', x: 'any', y: 'optional', hue: 'optional', multiToggle: true, yLabel: true, legend: true },
  barplot: { label: 'Bar Chart (with Error Bars)', group: 'Classic charts', x: 'any', y: 'required', hue: 'optional', multiToggle: true, errorBars: true },
  line: { label: 'Line Graph (with Error Bars)', group: 'Classic charts', x: 'any', y: 'required', hue: 'optional', multiToggle: true, errorBars: true, yLabel: true, legend: true },
  violin: { label: 'Violin Plot (Grouped Split)', group: 'Classic charts', x: 'any', y: 'required', hue: 'optional', multiToggle: true },
  histogram: { label: 'Histogram / Density', group: 'Classic charts', x: 'numeric', y: null, hue: 'optional', multiToggle: true, bins: true, legend: true },
  qqplot: { label: 'Normal Q-Q Plot', group: 'Classic charts', x: 'numeric', y: null, hue: null, multiToggle: true, yLabel: true },
  scatter: { label: 'Scatter Plot (with Trendline)', group: 'Classic charts', x: 'numeric', y: 'required', hue: 'optional', multiToggle: true, fitReg: true, yLabel: true, legend: true },
  pie: { label: 'Pie Chart (Category Shares)', group: 'Classic charts', x: 'category', y: null, hue: null, multiToggle: true },
  multiline: { label: 'High-Density Multi-Line Plot', group: 'Classic charts', x: 'numeric', y: 'multi', hue: null, multiToggle: true },
  pcabiplot: { label: 'PCA Biplot (PC1 vs PC2)', group: 'Classic charts', x: null, y: 'multi', hue: 'optional', multiToggle: true },

  raincloud: {
    label: 'Raincloud plot', group: 'Distributions', x: 'category', y: 'required', hue: null, yLabel: true,
    labels: { x: 'Group (X axis)', y: 'Numeric variable (Y axis)' },
    hint: 'Half violin (cloud), box plot and every observation (rain) for each group.'
  },
  boxswarm: {
    label: 'Box plot + beeswarm', group: 'Distributions', x: 'category', y: 'required', hue: 'optional', yLabel: true, legend: true,
    labels: { x: 'Group (X axis)', y: 'Numeric variable (Y axis)' },
    hint: 'Box plots with every observation spread out so no points overlap.'
  },
  ridgeline: {
    label: 'Ridgeline plot', group: 'Distributions', x: 'numeric', y: null, hue: 'required',
    labels: { x: 'Numeric variable', hue: 'Group (one ridge each)' },
    hint: 'Overlapping density curves, one per group; readable even with many groups.'
  },
  ecdf: {
    label: 'ECDF (cumulative distribution)', group: 'Distributions', x: 'numeric', y: null, hue: 'optional', yLabel: true, legend: true,
    labels: { x: 'Numeric variable' },
    hint: 'Share of observations at or below each value; compares whole distributions without choosing bins.'
  },
  meanci: {
    label: 'Mean ± 95% CI dot plot', group: 'Comparisons', x: 'category', y: 'required', hue: 'optional', yLabel: true, legend: true,
    labels: { x: 'Group (X axis)', y: 'Numeric variable (Y axis)' },
    hint: 'Group means with t-based 95% confidence intervals over the raw observations; a clearer alternative to bar charts.'
  },
  lollipop: {
    label: 'Lollipop chart (sorted means)', group: 'Comparisons', x: 'category', y: 'required', hue: null,
    labels: { x: 'Category', y: 'Numeric variable' },
    hint: 'Group means as dots on stems, sorted from lowest to highest.'
  },
  dumbbell: {
    label: 'Dumbbell chart (two conditions)', group: 'Comparisons', x: 'category', y: 'required', hue: 'required', legend: true,
    labels: { x: 'Category (one row each)', y: 'Numeric variable', hue: 'Two-level factor (e.g. Control / Treated)' },
    hint: 'Means under two conditions for every category, joined by a line and sorted by the difference.'
  },
  paired: {
    label: 'Paired before/after lines', group: 'Comparisons', x: 'numeric', y: 'required', hue: 'optional', yLabel: true, legend: true,
    labels: { x: 'First measurement (e.g. Before)', y: 'Second measurement (e.g. After)', hue: 'Colour lines by group (optional)' },
    hint: 'One line per row from the first to the second measurement, with means ± 95% CI and a paired t-test.'
  },
  meanheatmap: {
    label: 'Two-factor means heatmap', group: 'Comparisons', x: 'category', y: 'required', hue: 'required',
    labels: { x: 'Column factor', y: 'Value (mean shown in each cell)', hue: 'Row factor' },
    hint: 'Mean for every combination of two factors, for example variety × location.'
  },
  estimation: {
    label: 'Estimation plot (two groups)', group: 'Comparisons', x: 'category', y: 'required', hue: null,
    labels: { x: 'Group (exactly 2 levels)', y: 'Numeric variable' },
    hint: 'Observations of two groups plus the difference in means and its 95% CI on a floating axis (Gardner-Altman).'
  },
  paired_estimation: {
    label: 'Paired estimation plot', group: 'Comparisons', x: 'numeric', y: 'required', hue: null,
    labels: { x: 'First measurement (e.g. Before)', y: 'Second measurement (e.g. After)' },
    hint: 'Paired lines plus the mean paired difference and its 95% CI on a floating axis.'
  },
  joint: {
    label: 'Scatter + marginal distributions', group: 'Relationships', x: 'numeric', y: 'required', hue: 'optional', fitReg: true, yLabel: true, legend: true,
    hint: 'Scatter plot with histograms and density curves on both axes, r and p, and an optional regression line with 95% band.'
  },
  density2d: {
    label: '2-D density contours', group: 'Relationships', x: 'numeric', y: 'required', hue: null, yLabel: true,
    hint: 'Shaded contours showing where observations concentrate; useful for large datasets.'
  },
  hexbin: {
    label: 'Hexbin plot', group: 'Relationships', x: 'numeric', y: 'required', hue: null, fitReg: true, yLabel: true,
    hint: 'Counts of observations in hexagonal cells; keeps thousands of points readable.'
  },
  mosaic: {
    label: 'Mosaic plot', group: 'Composition', x: 'category', y: null, hue: 'required',
    labels: { x: 'First categorical variable', hue: 'Second categorical variable' },
    hint: 'Tile sizes show the cross-tabulation; colour shows where counts differ from independence (with a chi-square test).'
  },
  radar: {
    label: 'Radar chart (group profiles)', group: 'Composition', x: null, y: 'multi', hue: 'required', legend: true,
    labels: { y: 'Variables (select 3 or more)', hue: 'Group (one outline each)' },
    hint: 'Means of each group across several variables, every axis scaled from the lowest to the highest group.'
  }
};

const PlotsModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  
  // State for dataset selection
  const dataset = useDataset({
    active: isOpen,
    onLoaded: () => {
      setXVar('');
      setYVar('');
      setSelectedXVars([]);
      setSelectedYVars([]);
      setHueVar('');
      setPlotB64(null);
    },
    onCleared: () => setPlotB64(null),
  });
  const { clear } = dataset;
  const { file, columns, numericColumns } = dataset;

  // State for plot configurations
  const [plotType, setPlotType] = useState('boxplot');
  const [xSelectionMode, setXSelectionMode] = useState('single');
  const [ySelectionMode, setYSelectionMode] = useState('single');
  const [xVar, setXVar] = useState('');
  const [yVar, setYVar] = useState('');
  const [selectedXVars, setSelectedXVars] = useState([]);
  const [selectedYVars, setSelectedYVars] = useState([]);
  const [hueVar, setHueVar] = useState('');
  
  // Customization settings
  const [title, setTitle] = useState('');
  const [xlabel, setXlabel] = useState('');
  const [ylabel, setYlabel] = useState('');
  const [figurePrefs, setFigurePrefs] = useFigurePreferences();
  const [palette, setPalette] = useState(figurePrefs.palette);
  const [legendLoc, setLegendLoc] = useState('best');
  const [showGrid, setShowGrid] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('standard');
  const [textColor, setTextColor] = useState('#0F172A');

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

  // Download export settings
  const [downloadDpi, setDownloadDpi] = useState(300);
  
  // State for results
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [plotB64, setPlotB64] = useState(null);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const spec = PLOT_SPECS[plotType] || PLOT_SPECS.boxplot;

  const handleReset = useCallback(() => {
    clear();
    setPlotType('boxplot');
    setXSelectionMode('single');
    setYSelectionMode('single');
    setXVar('');
    setYVar('');
    setSelectedXVars([]);
    setSelectedYVars([]);
    setHueVar('');
    setTitle('');
    setXlabel('');
    setYlabel('');
    setPalette(figurePrefs.palette);
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
    setDownloadDpi(300);
    setPlotB64(null);
    setError(null);
    setShowDesignPanel(false);
  }, [clear]);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen, handleReset]);

  if (!isOpen) return null;




  const handleSaveEditedData = async (editedFile) => {
    setPlotB64(null);
    setError(null);
    if (editedFile) {
      await dataset.selectFile(editedFile);
    }
  };


  // Adjust inputs based on plotType selection
  const handlePlotTypeChange = (type) => {
    const next = PLOT_SPECS[type];
    setPlotType(type);
    setError(null);
    if (!next.multiToggle) {
      setXSelectionMode('single');
      setSelectedXVars([]);
      setYSelectionMode(next.y === 'multi' ? 'multiple' : 'single');
      if (next.y !== 'multi') setSelectedYVars([]);
    }
    let nextX = xVar;
    const categorical = columns.filter(c => !numericColumns.includes(c));
    if (next.x === 'category' && categorical.length > 0 && !categorical.includes(xVar)) {
      nextX = categorical[0];
    } else if (next.x === 'numeric' && numericColumns.length > 0 && !numericColumns.includes(xVar)) {
      nextX = numericColumns[0];
    }
    setXVar(nextX);
    if (next.hue === 'required' && (!hueVar || hueVar === nextX)) {
      const candidates = categorical.filter(c => c !== nextX);
      if (candidates.length > 0) setHueVar(candidates[0]);
    }
  };

  // Form fields shared by the preview and the download requests
  const buildPlotFormData = () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('plot_type', plotType);
    formData.append('x_var', xVar);
    if (spec.y && spec.y !== 'multi' && yVar) formData.append('y_var', yVar);
    if (spec.hue && hueVar) formData.append('hue_var', hueVar);
    if (spec.bins) {
      formData.append('bins', bins);
      formData.append('kde', kde);
    }
    if (spec.fitReg) formData.append('fit_reg', fitReg);
    if (spec.errorBars) {
      formData.append('errorbar_toggle', errorbarToggle);
      formData.append('errorbar_type', errorbarType);
    }
    if (spec.multiToggle && selectedXVars.length > 0) formData.append('x_vars_str', selectedXVars.join(','));
    if ((spec.multiToggle || spec.y === 'multi') && selectedYVars.length > 0) formData.append('y_vars_str', selectedYVars.join(','));

    if (title) formData.append('title', title);
    if (xlabel) formData.append('xlabel', xlabel);
    if (ylabel) formData.append('ylabel', ylabel);
    formData.append('palette', palette);
    formData.append('legend_loc', legendLoc);
    formData.append('show_grid', showGrid);
    formData.append('aspect_ratio', aspectRatio);
    formData.append('preset', figurePrefs.preset);
    formData.append('text_color', textColor);

    formData.append('title_font_size', titleFontSize.toString());
    formData.append('title_font_family', titleFontFamily);
    formData.append('label_font_size', labelFontSize.toString());
    formData.append('label_font_family', labelFontFamily);
    formData.append('tick_font_size', tickFontSize.toString());
    formData.append('tick_font_family', tickFontFamily);

    if (xlimMin) formData.append('xlim_min', xlimMin);
    if (xlimMax) formData.append('xlim_max', xlimMax);
    if (ylimMin) formData.append('ylim_min', ylimMin);
    if (ylimMax) formData.append('ylim_max', ylimMax);
    if (xInterval) formData.append('x_interval', xInterval);
    if (yInterval) formData.append('y_interval', yInterval);
    return formData;
  };

  const runAnalysis = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setError(null);

    if (!file) {
      setError("Please upload a dataset first.");
      return;
    }
    if (!xVar) {
      setError("Please select the primary variable (X-axis).");
      return;
    }

    if (spec.y === 'required' && !yVar) {
      setError('Choose the Y variable for this chart.');
      return;
    }
    const minimumY = plotType === 'radar' ? 3 : 1;
    if (spec.y === 'multi' && selectedYVars.length < minimumY) {
      setError(minimumY > 1 ? `Select at least ${minimumY} numeric variables for this chart.` : 'Please select at least one numeric variable.');
      return;
    }
    if (spec.hue === 'required' && !hueVar) {
      setError(`Choose the ${(spec.labels?.hue || 'grouping variable').toLowerCase()}.`);
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setPlotB64(null);

    const formData = buildPlotFormData();

    try {
      const res = await apiFetch(`${API_URL}/analyze/plot`, {
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
      const formData = buildPlotFormData();
      formData.append('download_format', format);
      formData.append('dpi', downloadDpi.toString());

      const res = await apiFetch(`${API_URL}/analyze/plot/download`, {
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
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
          <button data-dialog-close aria-label="Close"
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
          {!plotB64 && !loadingAnalysis && (
            <div className="space-y-6">
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a dataset to chart"
                hint="Any table with the variables you want to plot (CSV or Excel)."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (
              <form onSubmit={runAnalysis} className="space-y-6">
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
                    {PLOT_GROUPS.map(group => (
                      <optgroup key={group} label={group}>
                        {Object.entries(PLOT_SPECS).filter(([, s]) => s.group === group).map(([value, s]) => (
                          <option key={value} value={value}>{s.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {spec.hint && <p className="font-sans text-[11px] leading-snug text-slate-400">{spec.hint}</p>}
                </div>

                {/* Variable X selection (Hidden for PCA Biplot) */}
                {spec.x && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-sans text-xs font-bold text-slate-500">
                        {spec.labels?.x || (spec.x === 'numeric' ? 'Variable X (Numeric)' : spec.x === 'category' ? 'Categorical Variable X' : 'X Axis Variable')}
                      </label>
                      {spec.multiToggle && (
                      <div className="flex items-center rounded-xl bg-slate-200/60 p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => { setXSelectionMode('single'); setSelectedXVars([]); }}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            xSelectionMode === 'single' ? 'bg-white text-brand-indigo shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Single Variable
                        </button>
                        <button
                          type="button"
                          onClick={() => setXSelectionMode('multiple')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            xSelectionMode === 'multiple' ? 'bg-white text-brand-indigo shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Multiple Variables
                        </button>
                      </div>
                      )}
                    </div>

                    {xSelectionMode === 'single' ? (
                      <select
                        value={xVar}
                        onChange={(e) => setXVar(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                      >
                        <option value="">-- Select Variable X --</option>
                        {spec.x === 'numeric' 
                          ? numericColumns.map(c => <option key={c} value={c}>{c}</option>)
                          : columns.map(c => <option key={c} value={c}>{c}</option>)
                        }
                      </select>
                    ) : (
                      <div className="space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-semibold">{selectedXVars.length} X variables selected</span>
                          <div className="flex items-center space-x-2">
                            <button type="button" onClick={() => { setSelectedXVars([...numericColumns]); if (numericColumns.length > 0) setXVar(numericColumns[0]); }} className="font-bold text-brand-indigo hover:underline cursor-pointer">
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button type="button" onClick={() => setSelectedXVars([])} className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                              Deselect All
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 max-h-[140px] overflow-y-auto">
                          {numericColumns.map(col => (
                            <label key={col} className="flex items-center space-x-2 rounded-lg bg-white p-2 border border-slate-200/50 hover:bg-slate-50 cursor-pointer shadow-xs">
                              <input
                                type="checkbox"
                                checked={selectedXVars.includes(col)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const updated = [...selectedXVars, col];
                                    setSelectedXVars(updated);
                                    if (!xVar) setXVar(updated[0]);
                                  } else {
                                    const updated = selectedXVars.filter(v => v !== col);
                                    setSelectedXVars(updated);
                                    if (xVar === col) setXVar(updated[0] || '');
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
                  </div>
                )}

                {/* Variable Y selection */}
                {spec.y && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <label className="font-sans text-xs font-bold text-slate-500">
                        {spec.labels?.y || (plotType === 'boxplot' ? 'Y Axis Variable(s)' : 'Y Axis Variable(s) (Numeric)')}
                      </label>
                      {spec.multiToggle && (
                      <div className="flex items-center rounded-xl bg-slate-200/60 p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => { setYSelectionMode('single'); setSelectedYVars([]); }}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            ySelectionMode === 'single' ? 'bg-white text-brand-indigo shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Single Variable
                        </button>
                        <button
                          type="button"
                          onClick={() => setYSelectionMode('multiple')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            ySelectionMode === 'multiple' ? 'bg-white text-brand-indigo shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Multiple Variables
                        </button>
                      </div>
                      )}
                    </div>

                    {ySelectionMode === 'single' ? (
                      <select
                        value={yVar}
                        onChange={(e) => setYVar(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                      >
                        <option value="">{plotType === 'boxplot' ? '-- Single Variable (No Grouping) --' : '-- Select Variable Y --'}</option>
                        {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <div className="space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-semibold">{selectedYVars.length} Y variables selected</span>
                          <div className="flex items-center space-x-2">
                            <button type="button" onClick={() => { setSelectedYVars([...numericColumns]); if (numericColumns.length > 0) setYVar(numericColumns[0]); }} className="font-bold text-brand-indigo hover:underline cursor-pointer">
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button type="button" onClick={() => setSelectedYVars([])} className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                              Deselect All
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 max-h-[140px] overflow-y-auto">
                          {numericColumns.map(col => (
                            <label key={col} className="flex items-center space-x-2 rounded-lg bg-white p-2 border border-slate-200/50 hover:bg-slate-50 cursor-pointer shadow-xs">
                              <input
                                type="checkbox"
                                checked={selectedYVars.includes(col)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const updated = [...selectedYVars, col];
                                    setSelectedYVars(updated);
                                    if (!yVar) setYVar(updated[0]);
                                  } else {
                                    const updated = selectedYVars.filter(v => v !== col);
                                    setSelectedYVars(updated);
                                    if (yVar === col) setYVar(updated[0] || '');
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
                  </div>
                )}

                {/* Grouping Variable / Hue (boxplot, histogram, scatter, line, barplot, violin, pcabiplot) */}
                {spec.hue && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">{spec.labels?.hue || (spec.hue === 'required' ? 'Grouping Variable' : 'Grouping Variable / Hue (Optional)')}</label>
                    <select
                      value={hueVar}
                      onChange={(e) => setHueVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">{spec.hue === 'required' ? '-- Select Variable --' : '-- No Grouping Factor --'}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Error Bars Option Panel (barplot & line only) */}
                {spec.errorBars && (
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
                {spec.bins && (
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
                {spec.fitReg && (
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
                        onChange={(e) => { setPalette(e.target.value); setFigurePrefs({ palette: e.target.value }); }}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      >
                        <optgroup label="Publication palettes (shared with every chart)">
                          {PALETTE_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}{p.colorblindSafe && !/colour-blind/i.test(p.label) ? ' · colour-blind safe' : ''}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Single colour">
                          <option value="indigo">Indigo</option>
                          <option value="sunset">Orange</option>
                          <option value="teal">Teal</option>
                          <option value="emerald">Emerald</option>
                          <option value="forest">Forest green</option>
                          <option value="skyblue">Sky blue</option>
                          <option value="navy">Navy</option>
                          <option value="crimson">Crimson</option>
                          <option value="rose">Rose</option>
                          <option value="amber">Amber</option>
                          <option value="charcoal">Charcoal grey</option>
                        </optgroup>
                        <optgroup label="Colour ramps">
                          <option value="coolwarm">Cool-warm (diverging)</option>
                          <option value="viridis">Viridis</option>
                          <option value="spring">Spring</option>
                          <option value="summer">Summer</option>
                          <option value="autumn">Autumn</option>
                          <option value="winter">Winter</option>
                        </optgroup>
                      </select>
                      {isStylePalette(palette) && (
                        <span className="flex gap-1 pt-0.5" aria-hidden="true">
                          {paletteColors(palette).map(colour => (
                            <span key={colour} className="h-3 flex-1 rounded-sm" style={{ background: colour }} />
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Text & Label Color */}
                    <div className="space-y-1.5">
                      <label className="font-sans text-xs font-medium text-slate-500">Text & Label Color</label>
                      <select
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all"
                      >
                        <option value="#0F172A">Charcoal (default)</option>
                        <option value="#1E293B">Slate dark</option>
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
                    {spec.yLabel && (
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
                    {spec.legend && (
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
            </div>
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
                    Chart: {spec.label}
                  </p>
                </div>
                <div className="flex flex-col gap-3 max-w-sm w-full">
                  <FigurePresetSelect value={figurePrefs.preset} onChange={(preset) => setFigurePrefs({ preset })} />
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
                    {['tiff', 'pdf', 'eps'].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => triggerDownload(fmt)}
                        className="flex-1 min-w-[50px] flex items-center justify-center space-x-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white p-1 px-2 font-sans text-xs font-semibold transition-colors"
                        title={`Download ${fmt.toUpperCase()} for journal submission`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{fmt.toUpperCase()}</span>
                      </button>
                    ))}
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
        onSave={handleSaveEditedData}
      />
    </div>
  );
};

export default PlotsModal;
