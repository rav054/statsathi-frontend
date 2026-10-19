import { apiFetch } from '../utils/apiFetch';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, Download, RefreshCw, Eye, Info, TrendingUp } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import FigurePresetSelect from './FigurePresetSelect';
import FigurePaletteSelect from './FigurePaletteSelect';
import { paletteColors, themedLayout } from '../utils/figureStyle';
import { exportPlotlyFigure } from '../utils/plotlyExport';
import { useFigurePreferences } from '../utils/figurePreferences';
import RegressionExtraChart from './RegressionExtraChart';

const RegressionModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  // Starting a new model type clears the old one - but only when the type really changes, never on the first
  // render, which would throw away an analysis that was just reopened
  const lastType = useRef(null);
  const { token, user } = useAuth();

  // Dataset states
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: () => {
      setDepVars([]);
      setIndVars([]);
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { file, numericColumns } = dataset;

  // Parameter states
  const [regressionType, setRegressionType] = useState('simple'); // 'simple', 'multiple', 'plsr'
  const [depVars, setDepVars] = useState([]); // List of Y variables
  const [indVars, setIndVars] = useState([]); // List of X variables
  const [nComponents, setNComponents] = useState(2);

  // Results & UI states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));

  // Fetch the dataset this analysis was run on, then restore its settings so it can be run again
  const restoreSaved = async () => {
    setReopened(false);
    setResults(null);
    const loaded = await dataset.selectProjectDataset(initialAnalysis.dataset, initialAnalysis.projectName);
    if (loaded) {
      setRegressionType(saved.type || 'simple');
      setDepVars(saved.dependent || []);
      setIndVars(saved.independent || []);
      setNComponents(saved.components || 2);
    }
  };
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'plot', 'plsr_details', 'data'
  const [viewerOpen, setViewerOpen] = useState(false);
  const [downloadDpi, setDownloadDpi] = useState(150);
  const [figurePrefs, setFigurePrefs] = useFigurePreferences();

  // Plotly chart ref
  const plotRef = useRef(null);

  // Variable helper states for PLSR target plotting
  const [selectedPlsTarget, setSelectedPlsTarget] = useState('');

  // Reset variables when type changes
  useEffect(() => {
    if (lastType.current === null || lastType.current === regressionType) {
      lastType.current = regressionType;
      return;
    }
    lastType.current = regressionType;
    setDepVars([]);
    setIndVars([]);
    setResults(null);
    setError(null);
  }, [regressionType]);

  // Set default target for PLSR plots
  useEffect(() => {
    if (results && results.regression_type === 'plsr' && depVars.length > 0) {
      setSelectedPlsTarget(depVars[0]);
    }
  }, [results, depVars]);

  // Trigger charts rendering when activeTab, results, or target changes
  useEffect(() => {
    if (!results || activeTab !== 'plot' || !plotRef.current) return;

    const traces = [];
    let layout = {};
    const chartColors = paletteColors(figurePrefs.palette);

    if (results.regression_type === 'simple') {
      // Predicted against actual values, with the 1:1 line of a perfect fit
      const actual = results.actual; // 1D list for OLS
      const predicted = results.predicted; // 1D list for OLS
      
      traces.push({
        x: predicted,
        y: actual,
        mode: 'markers',
        type: 'scatter',
        name: 'Observations',
        marker: { color: chartColors[0], size: 8, opacity: 0.85, line: { color: '#ffffff', width: 0.5 } },
        hovertemplate: 'Predicted: %{x:.3f}<br>Actual: %{y:.3f}<extra></extra>'
      });
      
      const minVal = Math.min(...actual, ...predicted);
      const maxVal = Math.max(...actual, ...predicted);
      
      // Diagonal perfect-fit line
      traces.push({
        x: [minVal, maxVal],
        y: [minVal, maxVal],
        mode: 'lines',
        type: 'scatter',
        name: 'Perfect Fit (1:1)',
        line: { color: chartColors[1], width: 2, dash: 'dash' }
      });
      
      layout = {
        title: {
          text: `Fit Plot (Predicted vs. Actual): ${depVars[0]}`
        },
        xaxis: {
          title: { text: 'Predicted Values' },
        },
        yaxis: {
          title: { text: 'Actual Values' },
        },
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: true,
        legend: { x: 0, y: 1 }
      };
    } else if (results.regression_type === 'multiple') {
      const actual = results.actual;
      const predicted = results.predicted;
      
      traces.push({
        x: predicted,
        y: actual,
        mode: 'markers',
        type: 'scatter',
        name: 'Observations',
        marker: { color: chartColors[0], size: 8, opacity: 0.85, line: { color: '#ffffff', width: 0.5 } },
        hovertemplate: 'Predicted: %{x:.3f}<br>Actual: %{y:.3f}<extra></extra>'
      });
      
      const minVal = Math.min(...actual, ...predicted);
      const maxVal = Math.max(...actual, ...predicted);
      
      traces.push({
        x: [minVal, maxVal],
        y: [minVal, maxVal],
        mode: 'lines',
        type: 'scatter',
        name: 'Perfect Fit (1:1)',
        line: { color: chartColors[1], width: 2, dash: 'dash' }
      });
      
      layout = {
        title: {
          text: `Fit Plot (Predicted vs. Actual): ${depVars[0]}`
        },
        xaxis: {
          title: { text: 'Predicted Values' },
        },
        yaxis: {
          title: { text: 'Actual Values' },
        },
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: true,
        legend: { x: 0, y: 1 }
      };
    } else if (results.regression_type === 'plsr') {
      // PLSR actual and predicted are 2D arrays (list of lists). We need to map by selected PLSR target
      const targetIdx = depVars.indexOf(selectedPlsTarget || depVars[0]);
      if (targetIdx !== -1 && results.actual && results.predicted) {
        const actual = results.actual.map(row => row[targetIdx]);
        const predicted = results.predicted.map(row => row[targetIdx]);
        
        traces.push({
          x: predicted,
          y: actual,
          mode: 'markers',
          type: 'scatter',
          name: 'Observations',
          marker: { color: chartColors[0], size: 8, opacity: 0.85, line: { color: '#ffffff', width: 0.5 } },
          hovertemplate: 'Predicted: %{x:.3f}<br>Actual: %{y:.3f}<extra></extra>'
        });
        
        const minVal = Math.min(...actual, ...predicted);
        const maxVal = Math.max(...actual, ...predicted);
        
        traces.push({
          x: [minVal, maxVal],
          y: [minVal, maxVal],
          mode: 'lines',
          type: 'scatter',
          name: 'Perfect Fit (1:1)',
          line: { color: chartColors[1], width: 2, dash: 'dash' }
        });
        
        layout = {
          title: {
            text: `PLSR Fit Plot (Predicted vs. Actual): ${selectedPlsTarget || depVars[0]}`
          },
          xaxis: {
            title: { text: 'Predicted Values' },
          },
          yaxis: {
            title: { text: 'Actual Values' },
          },
          margin: { t: 50, r: 40, l: 60, b: 50 },
          showlegend: true,
          legend: { x: 0, y: 1 }
        };
      }
    }

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot(plotRef.current, traces, themedLayout(layout, { palette: figurePrefs.palette }), config);

  }, [results, activeTab, selectedPlsTarget, indVars, depVars, figurePrefs.palette]);

  if (!isOpen) return null;

  // File Upload Handlers



  const handleSaveEditedData = async (editedFile) => {
    setResults(null);
    setError(null);
    if (editedFile) {
      await dataset.selectFile(editedFile);
    }
  };


  // Selection toggles
  const handleToggleIndVar = (col) => {
    if (indVars.includes(col)) {
      setIndVars(indVars.filter(v => v !== col));
    } else {
      if (regressionType === 'simple') {
        setIndVars([col]);
      } else {
        setIndVars([...indVars, col]);
      }
    }
  };

  const handleToggleDepVar = (col) => {
    if (depVars.includes(col)) {
      setDepVars(depVars.filter(v => v !== col));
    } else {
      if (regressionType === 'plsr') {
        setDepVars([...depVars, col]);
      } else {
        setDepVars([col]);
      }
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setError(null);

    if (!file) {
      setError("Please upload a dataset first.");
      return;
    }
    if (depVars.length === 0) {
      setError("Please select at least one Dependent Variable.");
      return;
    }
    if (indVars.length === 0) {
      setError("Please select at least one Independent Variable.");
      return;
    }

    setLoadingAnalysis(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('regression_type', regressionType);
    formData.append('dep_vars_str', depVars.join(','));
    formData.append('ind_vars_str', indVars.join(','));
    formData.append('n_components', nComponents);

    try {
      const response = await apiFetch(`${API_URL}/analyze/regression`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to execute regression.');

      setResults(data);
      setActiveTab('summary');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleReset = () => {
    dataset.clear();
    setDepVars([]);
    setIndVars([]);
    setResults(null);
    setError(null);
  };

  const handleAnalyzeNew = () => {
    setResults(null);
    setError(null);
  };

  // Plot download helper
  const handleDownloadPlot = (format) => {
    if (!plotRef.current) return;
    exportPlotlyFigure(plotRef.current, { format, preset: figurePrefs.preset, dpi: downloadDpi, filename: `statsathi_regression_plot_${downloadDpi}dpi` }).catch(err => setError(err.message));
  };

  // Word report: server-side .docx including the interactive chart as an image
  const handleDownloadReport = async () => {
    if (!results) return;
    let chartImage = null;
    try {
      if (plotRef.current) chartImage = await Plotly.toImage(plotRef.current, { format: 'png', width: 900, height: 600 });
    } catch {
      chartImage = null; // chart not rendered on the current tab
    }
    downloadDocxReport(token, buildDocxReport(chartImage)).catch(err => setError(err.message));
  };

  const buildDocxReport = (chartImage) => {
    const typeLabel = results.regression_type === 'simple' ? 'Simple linear regression'
      : results.regression_type === 'multiple' ? 'Multiple linear regression' : 'Partial least squares regression (PLSR)';
    const sections = [{
      heading: 'Model',
      paragraphs: [`Dependent variable(s): ${depVars.join(', ')}.`, `Independent variable(s): ${indVars.join(', ')}.`]
    }];

    if (results.regression_type !== 'plsr') {
      sections.push({
        heading: '1. Model Fit',
        tables: [{
          columns: ['Metric', 'Value'],
          rows: [
            ['R²', results.r2.toFixed(4)],
            ['Adjusted R²', results.adj_r2.toFixed(4)],
            ['F statistic', `${results.f_statistic.toFixed(4)} (df = ${results.df_model}, ${results.df_resid})`],
            ['p-value (F test)', formatP(results.f_pvalue)]
          ]
        }]
      }, {
        heading: '2. Coefficients',
        tables: [{
          columns: ['Variable', 'Estimate', 'Std. error', 't', 'p-value', '95% CI'],
          rows: results.coefficients.map(c => [c.variable, c.coefficient.toFixed(4), c.std_err.toFixed(4), c.t_stat.toFixed(4), formatP(c.p_value),
            c.ci_lower !== undefined && c.ci_lower !== null ? `[${c.ci_lower.toFixed(4)}, ${c.ci_upper.toFixed(4)}]` : 'N/A'])
        }]
      });
    } else {
      const cumulative = (values, i) => values.slice(0, i + 1).reduce((a, b) => a + b, 0);
      const hasY = Array.isArray(results.explained_variance_y);
      sections.push({
        heading: '1. Model Summary',
        paragraphs: [`Components used: ${results.n_components_used}.`],
        tables: [{
          columns: ['Dependent variable', 'R²'],
          rows: depVars.map((dep, i) => [dep, results.r2_values[i].toFixed(4)])
        }, {
          columns: ['Component', 'X variance (%)', 'Cumulative X (%)', ...(hasY ? ['Y variance (%)', 'Cumulative Y (%)'] : [])],
          rows: results.explained_variance_x.map((v, i) => [`Component ${i + 1}`, (v * 100).toFixed(2), (cumulative(results.explained_variance_x, i) * 100).toFixed(2),
            ...(hasY ? [(results.explained_variance_y[i] * 100).toFixed(2), (cumulative(results.explained_variance_y, i) * 100).toFixed(2)] : [])]),
          caption: 'Explained variance per component (standardized variables)'
        }]
      }, {
        heading: '2. Coefficients (original units)',
        tables: [{
          columns: ['Predictor', ...depVars],
          rows: [
            ...results.coefficients.map(row => [row.variable, ...depVars.map(dep => row.coefficients[dep].toFixed(4))]),
            ...(results.intercepts ? [['Intercept', ...depVars.map(dep => (results.intercepts[dep] !== undefined ? results.intercepts[dep].toFixed(4) : 'N/A'))]] : [])
          ]
        }]
      });
      if (results.vip) {
        sections.push({
          heading: '3. Variable Importance in Projection (VIP)',
          tables: [{ columns: ['Predictor', 'VIP', 'Important (VIP > 1)'], rows: [...results.vip].sort((a, b) => b.vip - a.vip).map(r => [r.variable, r.vip.toFixed(3), r.vip > 1 ? 'Yes' : 'No']) }]
        });
      }
    }
    if (chartImage) sections.push({ heading: 'Predicted vs. Actual', images: [{ data: chartImage, caption: 'Figure 1. Predicted versus observed values' }] });

    return {
      title: 'Regression Analysis Report',
      test_applied: typeLabel,
      dataset_name: file?.name,
      filename: `StatSathi_Regression_Report_${(file?.name || 'dataset').split('.')[0]}`,
      sections
    };
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl border border-slate-100 bg-brand-slate shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/50 bg-white px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-800">Regression Workspace</h2>
              <p className="font-sans text-[13px] text-slate-400">Perform Simple, Multiple OLS, or Partial Least Squares Regression.</p>
            </div>
          </div>
          <button data-dialog-close aria-label="Close" onClick={onClose} className="rounded-xl p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {(error || dataset.error) && (
            <div className="mb-4 flex items-start space-x-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium">{error || dataset.error}</span>
            </div>
          )}

          {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

          {!file && !results ? (
            <DatasetPicker
              dataset={dataset}
              title="Select or drop a dataset for regression"
              hint="One row per observation, with the response and the predictors in numeric columns (CSV or Excel)."
            />
          ) : !results ? (
            /* Configuration Panel */
            <div className="space-y-5">
              <DatasetPicker dataset={dataset} onViewData={() => setViewerOpen(true)} />
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sidebar Settings */}
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-display text-xs font-bold text-slate-700">Model Configuration</span>
                  <button type="button" onClick={handleReset} className="font-sans text-[13px] font-bold text-brand-orange hover:text-orange-600 transition-colors">Reset File</button>
                </div>

                <div className="space-y-1">
                  <label className="font-sans text-[13px] font-bold text-slate-400 uppercase">Regression Type</label>
                  <select
                    value={regressionType}
                    onChange={(e) => setRegressionType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                  >
                    <option value="simple">Simple Linear Regression</option>
                    <option value="multiple">Multiple Linear Regression</option>
                    <option value="plsr">Partial Least Squares (PLSR)</option>
                  </select>
                </div>

                {regressionType === 'plsr' && (
                  <div className="space-y-1">
                    <label className="font-sans text-[13px] font-bold text-slate-400 uppercase">PLS Components</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, indVars.length)}
                      value={nComponents}
                      onChange={(e) => setNComponents(parseInt(e.target.value) || 2)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                    <p className="font-sans text-[12px] text-slate-400">Maximum components cannot exceed the number of selected predictors.</p>
                  </div>
                )}

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/50 space-y-1">
                  <span className="font-display text-[14px] font-bold text-slate-600">Dataset Loaded:</span>
                  <div className="font-sans text-[13px] text-slate-400 truncate">{file.name}</div>
                  <button type="button" onClick={() => setViewerOpen(true)} className="mt-2 text-brand-indigo hover:text-indigo-700 font-sans text-[13px] font-bold flex items-center space-x-1">
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Data Grid</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loadingAnalysis || depVars.length === 0 || indVars.length === 0}
                  className="w-full py-3 bg-brand-indigo hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 font-sans text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loadingAnalysis ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Estimating Model...</span>
                    </>
                  ) : (
                    <span>Run Regression</span>
                  )}
                </button>
              </div>

              {/* Variable Selectors */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Dependent variable Y */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                  <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">
                    Dependent Variable (Y)
                  </h3>
                  
                  {regressionType !== 'plsr' ? (
                    /* Simple / Multiple: Single Y Dropdown */
                    <div className="space-y-1 max-w-xs">
                      <label className="font-sans text-[13px] text-slate-400">Select target outcome</label>
                      <select
                        value={depVars[0] || ''}
                        onChange={(e) => setDepVars(e.target.value ? [e.target.value] : [])}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                      >
                        <option value="">-- Choose Dependent (Y) --</option>
                        {numericColumns.map(col => (
                          <option key={col} value={col} disabled={indVars.includes(col)}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    /* PLSR: Multi-select Checkboxes */
                    <div className="space-y-2">
                      <p className="font-sans text-[13px] text-slate-400 mb-2">Select one or more target outcomes (Y)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[140px] overflow-y-auto pr-2">
                        {numericColumns.map(col => (
                          <label
                            key={col}
                            className={`flex items-center space-x-2 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                              depVars.includes(col) ? 'bg-indigo-50 border-brand-indigo text-brand-indigo' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={depVars.includes(col)}
                              disabled={indVars.includes(col)}
                              onChange={() => handleToggleDepVar(col)}
                              className="rounded-sm border-slate-300 text-brand-indigo focus:ring-brand-indigo h-3.5 w-3.5"
                            />
                            <span className="truncate">{col}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Independent variables X */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                  <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">
                    Independent Variable(s) (X)
                  </h3>
                  
                  {regressionType === 'simple' ? (
                    /* Simple: Single X Dropdown */
                    <div className="space-y-1 max-w-xs">
                      <label className="font-sans text-[13px] text-slate-400">Select single predictor</label>
                      <select
                        value={indVars[0] || ''}
                        onChange={(e) => setIndVars(e.target.value ? [e.target.value] : [])}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                      >
                        <option value="">-- Choose Predictor (X) --</option>
                        {numericColumns.map(col => (
                          <option key={col} value={col} disabled={depVars.includes(col)}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    /* Multiple / PLSR: Multi-select Checkboxes */
                    <div className="space-y-2">
                      <p className="font-sans text-[13px] text-slate-400 mb-2">Select predictor variables (X)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[180px] overflow-y-auto pr-2">
                        {numericColumns.map(col => (
                          <label
                            key={col}
                            className={`flex items-center space-x-2 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                              indVars.includes(col) ? 'bg-orange-50 border-brand-orange text-brand-orange' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={indVars.includes(col)}
                              disabled={depVars.includes(col)}
                              onChange={() => handleToggleIndVar(col)}
                              className="rounded-sm border-slate-300 text-brand-orange focus:ring-brand-orange h-3.5 w-3.5"
                            />
                            <span className="truncate">{col}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </form>
            </div>
          ) : (
            /* Results Screen */
            <div className="space-y-6 animate-fade-in">
              
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 pb-px space-x-6 overflow-x-auto">
                {[
                  { id: 'summary', label: 'Model Summary' },
                  { id: 'plot', label: 'Predicted vs Actual' },
                  ...(results.fit_band ? [{ id: 'line', label: 'Regression Line & Bands' }] : []),
                  ...(results.diagnostics ? [{ id: 'diagnostics', label: 'Residual Diagnostics' }, { id: 'coefficients', label: 'Coefficient Plot' }] : []),
                  ...(results.regression_type === 'plsr' ? [{ id: 'plsr_details', label: 'PLSR Matrix Details' }] : []),
                  { id: 'data', label: 'Residuals Data' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`pb-3 font-display text-xs font-bold transition-all border-b-2 cursor-pointer ${
                      activeTab === t.id
                        ? 'border-brand-indigo text-brand-indigo'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Model Summary */}
              {activeTab === 'summary' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Diagnostics Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-1 space-y-4">
                    <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">Regression Statistics</h3>
                    
                    {results.regression_type !== 'plsr' ? (
                      /* OLS Summary */
                      <div className="space-y-3 font-sans text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">R-Squared (R&sup2;)</span>
                          <span className="font-bold text-slate-700">{results.r2.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">Adjusted R&sup2;</span>
                          <span className="font-bold text-slate-700">{results.adj_r2.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">F-Statistic</span>
                          <span className="font-bold text-slate-700">{results.f_statistic.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">F-p-value</span>
                          <span className="font-bold text-slate-700">
                            {results.f_pvalue < 0.001 ? 'p < 0.001' : results.f_pvalue.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">Degrees of Freedom</span>
                          <span className="font-bold text-slate-700">{results.df_model} (model) / {results.df_resid} (resid)</span>
                        </div>
                      </div>
                    ) : (
                      /* PLSR Summary */
                      <div className="space-y-3 font-sans text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">PLS Components Used</span>
                          <span className="font-bold text-slate-700">{results.n_components_used}</span>
                        </div>
                        <div className="py-2 space-y-1.5">
                          <span className="text-slate-400 block font-bold">Explained Variance (X):</span>
                          {results.explained_variance_x.map((val, idx) => (
                            <div key={idx} className="flex justify-between text-[14px] text-slate-600 bg-slate-50 p-1.5 rounded-lg">
                              <span>Component {idx + 1}</span>
                              <span className="font-mono font-bold">{(val * 100).toFixed(2)}%</span>
                            </div>
                          ))}
                        </div>
                        {results.explained_variance_y && (
                          <div className="py-2 space-y-1.5">
                            <span className="text-slate-400 block font-bold">Explained Variance (Y):</span>
                            {results.explained_variance_y.map((val, idx) => (
                              <div key={idx} className="flex justify-between text-[14px] text-slate-600 bg-slate-50 p-1.5 rounded-lg">
                                <span>Component {idx + 1}</span>
                                <span className="font-mono font-bold">{(val * 100).toFixed(2)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {results.vip && (
                          <div className="py-2 space-y-1.5">
                            <span className="text-slate-400 block font-bold">VIP Scores (VIP &gt; 1 = important):</span>
                            {[...results.vip].sort((a, b) => b.vip - a.vip).map(row => (
                              <div key={row.variable} className={`flex justify-between text-[14px] p-1.5 rounded-lg ${row.vip > 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
                                <span>{row.variable}</span>
                                <span className="font-mono font-bold">{row.vip.toFixed(3)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100 flex flex-col space-y-2">
                      <SaveToProjectButton
                        module="regression"
                        report={() => buildDocxReport(null)}
                        source={dataset.source}
                        defaultTitle={`Regression – ${depVars.join(', ')}`}
                        parameters={{ type: regressionType, dependent: depVars, independent: indVars, components: nComponents, dataset: file?.name }}
                        result={results}
                      />
                      <button onClick={handleDownloadReport} className="w-full py-2 bg-brand-indigo hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl transition-colors cursor-pointer text-center">
                        Export Report to Word
                      </button>
                      <button onClick={handleAnalyzeNew} className="w-full py-2 border border-slate-200 text-slate-600 font-sans text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-center">
                        Analyze New Variables
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Coefficients Matrix */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2 overflow-x-auto">
                    <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">Model Estimations</h3>
                    
                    {results.regression_type !== 'plsr' ? (
                      /* OLS Table */
                      <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700">
                            <th className="border border-slate-100 p-2 text-left">Variable</th>
                            <th className="border border-slate-100 p-2">Estimate</th>
                            <th className="border border-slate-100 p-2">Std. Error</th>
                            <th className="border border-slate-100 p-2">t-value</th>
                            <th className="border border-slate-100 p-2">95% CI</th>
                            <th className="border border-slate-100 p-2">p-value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.coefficients.map(coef => (
                            <tr key={coef.variable} className="hover:bg-slate-50/50">
                              <td className="border border-slate-100 p-2 text-left font-bold text-slate-700">{coef.variable}</td>
                              <td className="border border-slate-100 p-2">{coef.coefficient.toFixed(4)}</td>
                              <td className="border border-slate-100 p-2">{coef.std_err.toFixed(4)}</td>
                              <td className="border border-slate-100 p-2">{coef.t_stat.toFixed(4)}</td>
                              <td className="border border-slate-100 p-2 font-mono whitespace-nowrap">
                                {coef.ci_lower != null ? `[${coef.ci_lower.toFixed(4)}, ${coef.ci_upper.toFixed(4)}]` : 'n/a'}
                              </td>
                              <td className={`border border-slate-100 p-2 font-bold ${coef.p_value < 0.05 ? 'text-green-600' : 'text-slate-600'}`}>
                                {coef.p_value < 0.001 ? 'p < 0.001' : coef.p_value.toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      /* PLSR Coefficients */
                      <div className="space-y-4">
                        <div className="bg-orange-50/20 border border-orange-100 rounded-xl p-3 flex items-start space-x-2.5">
                          <Info className="h-4.5 w-4.5 text-brand-orange shrink-0 mt-0.5" />
                          <div className="font-sans text-[13px] text-slate-500 leading-relaxed">
                            Partial Least Squares (PLS) Beta Coefficients represent regression weights for each independent variable across each outcome target. Target R&sup2; measures variance explained for each.
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-display text-[14px] font-bold text-slate-700">Target R-Squared (R&sup2;)</h4>
                          <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700">
                                <th className="border border-slate-100 p-2 text-left">Dependent Target</th>
                                <th className="border border-slate-100 p-2">R&sup2; Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {depVars.map((dep, idx) => (
                                <tr key={dep}>
                                  <td className="border border-slate-100 p-2 text-left font-bold text-slate-700">{dep}</td>
                                  <td className="border border-slate-100 p-2 font-mono font-bold text-slate-700">
                                    {results.r2_values[idx].toFixed(4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-display text-[14px] font-bold text-slate-700">Regression Coefficients Matrix</h4>
                          <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700">
                                <th className="border border-slate-100 p-2 text-left">Predictor (X)</th>
                                {depVars.map(dep => <th key={dep} className="border border-slate-100 p-2">{dep}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {results.coefficients.map(row => (
                                <tr key={row.variable}>
                                  <td className="border border-slate-100 p-2 text-left font-bold text-slate-700">{row.variable}</td>
                                  {depVars.map(dep => (
                                    <td key={dep} className="border border-slate-100 p-2 font-mono">
                                      {row.coefficients[dep].toFixed(4)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {results.intercepts && (
                                <tr className="bg-slate-50/50">
                                  <td className="border border-slate-100 p-2 text-left font-bold text-slate-500">Intercept</td>
                                  {depVars.map(dep => (
                                    <td key={dep} className="border border-slate-100 p-2 font-mono text-slate-500">
                                      {results.intercepts[dep]?.toFixed(4) ?? 'n/a'}
                                    </td>
                                  ))}
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}

              {/* Tab 2: Fit Plot */}
              {activeTab === 'plot' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 gap-3">
                    
                    {results.regression_type === 'plsr' ? (
                      /* Pls target selector */
                      <div className="flex items-center space-x-1.5">
                        <label className="font-sans text-[13px] font-bold text-slate-400 uppercase">Target Variable:</label>
                        <select
                          value={selectedPlsTarget}
                          onChange={(e) => setSelectedPlsTarget(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[14px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                        >
                          {depVars.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center space-x-2">
                      <FigurePaletteSelect value={figurePrefs.palette} onChange={(palette) => setFigurePrefs({ palette })} className="mr-2" />
                      <FigurePresetSelect value={figurePrefs.preset} onChange={(preset) => setFigurePrefs({ preset })} className="mr-2" />
                      <span className="font-sans text-[13px] font-bold text-slate-400 uppercase">Export Resolution:</span>
                      {[150, 300, 600].map(dpiVal => (
                        <button
                          key={dpiVal}
                          onClick={() => setDownloadDpi(dpiVal)}
                          className={`px-2 py-1 font-sans text-[12px] font-bold rounded-lg cursor-pointer ${
                            downloadDpi === dpiVal ? 'bg-brand-indigo text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {dpiVal === 150 ? '150 Standard' : dpiVal === 300 ? '300 Print' : '600 Pub'}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex space-x-1.5">
                      {['png', 'jpeg', 'svg'].map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => handleDownloadPlot(fmt)}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[12px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          <span>{fmt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
                    <div ref={plotRef} className="w-full h-[450px]"></div>
                  </div>
                </div>
              )}

              {/* Regression line with bands, residual diagnostics, coefficient plot */}
              {['line', 'diagnostics', 'coefficients'].includes(activeTab) && (
                <RegressionExtraChart
                  kind={activeTab}
                  results={results}
                  depVar={depVars[0]}
                  figurePrefs={figurePrefs}
                  setFigurePrefs={setFigurePrefs}
                  onError={setError}
                />
              )}

              {/* Tab 3: PLSR Details */}
              {activeTab === 'plsr_details' && results.regression_type === 'plsr' && (
                <div className="space-y-6">
                  
                  {/* Loadings */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                    <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">Predictor (X) Loadings</h3>
                    <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-100 p-2 text-left">Variable</th>
                          {Array.from({ length: results.n_components_used }).map((_, idx) => (
                            <th key={idx} className="border border-slate-100 p-2">Comp {idx + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.x_loadings.map(row => (
                          <tr key={row.variable}>
                            <td className="border border-slate-100 p-2 text-left font-bold text-slate-700">{row.variable}</td>
                            {row.loadings.map((val, idx) => (
                              <td key={idx} className="border border-slate-100 p-2 font-mono">{val.toFixed(4)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Outcome Loadings */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                    <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">Outcome (Y) Loadings</h3>
                    <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-100 p-2 text-left">Variable</th>
                          {Array.from({ length: results.n_components_used }).map((_, idx) => (
                            <th key={idx} className="border border-slate-100 p-2">Comp {idx + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.y_loadings.map(row => (
                          <tr key={row.variable}>
                            <td className="border border-slate-100 p-2 text-left font-bold text-slate-700">{row.variable}</td>
                            {row.loadings.map((val, idx) => (
                              <td key={idx} className="border border-slate-100 p-2 font-mono">{val.toFixed(4)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

              {/* Tab 4: Residuals Data */}
              {activeTab === 'data' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs overflow-x-auto max-h-[450px]">
                  <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">
                    Fitted and Residual Values
                  </h3>
                  
                  {results.regression_type !== 'plsr' ? (
                    <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-100 p-2">Obs. Row</th>
                          <th className="border border-slate-100 p-2">Actual Y</th>
                          <th className="border border-slate-100 p-2">Predicted Y</th>
                          <th className="border border-slate-100 p-2">Residual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.actual.slice(0, 100).map((act, idx) => {
                          const pred = results.predicted[idx];
                          const resid = results.residuals[idx];
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="border border-slate-100 p-2 font-mono">{idx + 1}</td>
                              <td className="border border-slate-100 p-2 font-mono">{act.toFixed(4)}</td>
                              <td className="border border-slate-100 p-2 font-mono">{pred.toFixed(4)}</td>
                              <td className={`border border-slate-100 p-2 font-mono ${resid >= 0 ? 'text-slate-600' : 'text-red-500'}`}>
                                {resid.toFixed(4)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    /* PLSR multi-target data grid */
                    <table className="w-full border-collapse font-sans text-xs text-slate-600 text-center">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-100 p-2" rowspan="2">Obs. Row</th>
                          {depVars.map(dep => (
                            <th key={dep} className="border border-slate-100 p-2" colspan="2">{dep}</th>
                          ))}
                        </tr>
                        <tr className="bg-slate-100 text-slate-600 text-[13px]">
                          {depVars.map(dep => (
                            <React.Fragment key={dep}>
                              <th className="border border-slate-100 p-1">Actual</th>
                              <th className="border border-slate-100 p-1">Predicted</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.actual.slice(0, 100).map((rowY, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="border border-slate-100 p-2 font-mono">{idx + 1}</td>
                            {rowY.map((actVal, depIdx) => (
                              <React.Fragment key={depIdx}>
                                <td className="border border-slate-100 p-2 font-mono">{actVal.toFixed(4)}</td>
                                <td className="border border-slate-100 p-2 font-mono">
                                  {results.predicted[idx][depIdx].toFixed(4)}
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {results.actual.length > 100 && (
                    <div className="p-3 text-center text-slate-400 font-sans text-[13px]">
                      Showing first 100 observations. Export to Word to download all.
                    </div>
                  )}

                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200/50 bg-white px-6 py-4 flex justify-between items-center text-[13px] text-slate-400 font-sans">
          <span>Curated by ${user ? user.full_name : 'Guest Researcher'}</span>
          {file && (
            <div className="flex items-center space-x-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="font-bold text-slate-600 uppercase">Dataset Active</span>
            </div>
          )}
        </div>

      </div>

      {/* Dataset Viewer Modal */}
      <DatasetViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={file}
        onSave={handleSaveEditedData}
      />

    </div>
  );
};

export default RegressionModal;
