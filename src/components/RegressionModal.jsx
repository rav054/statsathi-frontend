import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Eye, Info, TrendingUp, ChevronRight } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import DatasetViewerModal from './DatasetViewerModal';

const RegressionModal = ({ isOpen, onClose, sharedFile, setSharedFile }) => {
  const { token, user } = useAuth();

  // Dataset states
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (isOpen && sharedFile && (!file || sharedFile.name !== file.name || sharedFile.size !== file.size)) {
      if (typeof processFile === 'function') {
        processFile(sharedFile);
      }
    } else if (isOpen && !sharedFile && file) {
      handleReset();
    }
  }, [isOpen, sharedFile]);

  useEffect(() => {
    if (isOpen && file !== sharedFile && setSharedFile) {
      setSharedFile(file);
    }
  }, [isOpen, file, sharedFile, setSharedFile]);
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Parameter states
  const [regressionType, setRegressionType] = useState('simple'); // 'simple', 'multiple', 'plsr'
  const [depVars, setDepVars] = useState([]); // List of Y variables
  const [indVars, setIndVars] = useState([]); // List of X variables
  const [nComponents, setNComponents] = useState(2);

  // Results & UI states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'plot', 'plsr_details', 'data'
  const [viewerOpen, setViewerOpen] = useState(false);
  const [downloadDpi, setDownloadDpi] = useState(150);

  // Plotly chart ref
  const plotRef = useRef(null);

  // Variable helper states for PLSR target plotting
  const [selectedPlsTarget, setSelectedPlsTarget] = useState('');

  // Reset variables when type changes
  useEffect(() => {
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

    if (results.regression_type === 'simple') {
      const xVar = indVars[0];
      const yVar = depVars[0];
      const actualX = results.actual || []; // Simple regression only has 1 predictor, let's map actual X values
      // Wait, in OLS backend actual is Y, predicted is Y_pred.
      // To get X values, we need to extract from df_clean or records in frontend!
      // Let's get X values from results records or the actual independent variable.
      // Let's see: results doesn't return X list directly but we have records!
      // Wait, let's look at the OLS return dictionary in backend:
      // it doesn't return X. But wait, we can pass X or reconstruct it.
      // Actually, we can get X from results or we can add it to backend return, OR
      // we can extract it from the data grid records which are not returned by default in regression.
      // Wait! Let's check: does `/analyze/regression` return records? No, it returns coefficients, actual Y, predicted Y, residuals.
      // Since it returns actual Y and predicted Y, we can plot actual Y vs predicted Y for Simple Regression as well, OR
      // we can easily update the backend `/regression` return to include the X values list for simple regression!
      // Yes! Or even better, we can plot Predicted vs. Actual values for all regression types!
      // Plotting Predicted vs. Actual is standard, clean, and works perfectly for Simple, Multiple, and PLSR!
      // But for simple regression, plotting actual X vs actual Y with the fitted line is also nice. Let's see:
      // If we plot Actual Y (Y-axis) vs Predicted Y (X-axis), it forms a scatter plot around the 1:1 line.
      // Let's do a Predicted vs Actual scatter plot for all types: Simple, Multiple, and PLSR. It is standard, beautiful, and completely consistent.
      // Wait! Let's check: for simple regression, we can also reconstruct X by finding the values in the file if we want, but Predicted vs. Actual is mathematically robust and tells us the fit instantly!
      // Let's draw a Predicted vs. Actual scatter plot for all types, which has:
      // - Scatter points of Predicted (X) vs. Actual (Y)
      // - A 45-degree diagonal dashed line (Y = X) representing a perfect fit!
      // This is clean, modern, and mathematically rigorous.
      
      // Let's implement Predicted vs. Actual plot:
      const actual = results.actual; // 1D list for OLS
      const predicted = results.predicted; // 1D list for OLS
      
      traces.push({
        x: predicted,
        y: actual,
        mode: 'markers',
        type: 'scatter',
        name: 'Observations',
        marker: { color: '#4F46E5', size: 8, line: { color: '#ffffff', width: 0.5 } },
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
        line: { color: '#F97316', width: 2, dash: 'dash' }
      });
      
      layout = {
        title: {
          text: `Fit Plot (Predicted vs. Actual): ${depVars[0]}`,
          font: { family: 'Outfit, sans-serif', size: 14, color: '#1E293B', weight: 'bold' }
        },
        xaxis: {
          title: { text: 'Predicted Values', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        yaxis: {
          title: { text: 'Actual Values', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
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
        marker: { color: '#4F46E5', size: 8, line: { color: '#ffffff', width: 0.5 } },
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
        line: { color: '#F97316', width: 2, dash: 'dash' }
      });
      
      layout = {
        title: {
          text: `Fit Plot (Predicted vs. Actual): ${depVars[0]}`,
          font: { family: 'Outfit, sans-serif', size: 14, color: '#1E293B', weight: 'bold' }
        },
        xaxis: {
          title: { text: 'Predicted Values', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        yaxis: {
          title: { text: 'Actual Values', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
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
          marker: { color: '#10B981', size: 8, line: { color: '#ffffff', width: 0.5 } },
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
          line: { color: '#F97316', width: 2, dash: 'dash' }
        });
        
        layout = {
          title: {
            text: `PLSR Fit Plot (Predicted vs. Actual): ${selectedPlsTarget || depVars[0]}`,
            font: { family: 'Outfit, sans-serif', size: 14, color: '#1E293B', weight: 'bold' }
          },
          xaxis: {
            title: { text: 'Predicted Values', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
            gridcolor: '#F1F5F9'
          },
          yaxis: {
            title: { text: 'Actual Values', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
            gridcolor: '#F1F5F9'
          },
          plot_bgcolor: '#ffffff',
          paper_bgcolor: '#ffffff',
          margin: { t: 50, r: 40, l: 60, b: 50 },
          showlegend: true,
          legend: { x: 0, y: 1 }
        };
      }
    }

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot(plotRef.current, traces, layout, config);

  }, [results, activeTab, selectedPlsTarget, indVars, depVars]);

  if (!isOpen) return null;

  // File Upload Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleSaveEditedData = async (editedFile) => {
    setResults(null);
    setError(null);
    if (editedFile) {
      await processFile(editedFile);
    }
  };

  const processFile = async (selectedFile) => {
    setFile(selectedFile);
    setColumns([]);
    setNumericColumns([]);
    setDepVars([]);
    setIndVars([]);
    setResults(null);
    setError(null);
    setLoadingCols(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/analyze/columns`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to parse columns from dataset.');

      const data = await response.json();
      setColumns(data.columns || []);
      setNumericColumns(data.numeric_columns || []);
    } catch (err) {
      setError(err.message || 'An error occurred while loading the dataset.');
      setFile(null);
    } finally {
      setLoadingCols(false);
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
      const response = await fetch(`${API_URL}/analyze/regression`, {
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
    setFile(null);
    setColumns([]);
    setNumericColumns([]);
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
    const scale = downloadDpi / 96;
    Plotly.downloadImage(plotRef.current, {
      format: format,
      width: 800,
      height: 600,
      scale: scale,
      filename: `statsathi_regression_plot_${downloadDpi}dpi`
    });
  };

  // Word Report export
  const handleDownloadReport = () => {
    if (!results) return;

    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Regression Analysis Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; }
          h2 { text-align: center; color: #4f46e5; font-size: 18pt; margin-bottom: 5px; }
          h3 { color: #0f172a; border-bottom: 1.5pt solid #4f46e5; padding-bottom: 3px; font-size: 14pt; margin-top: 25px; }
          table { width: 100%; border-collapse: collapse; margin: 15px auto; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 10pt; text-align: center; }
          th { background-color: #4f46e5; color: #ffffff; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary-info { margin: 10px 0; font-size: 10pt; line-height: 1.5; }
          .footer { text-align: center; font-size: 9pt; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h2>STAT SATHI REGRESSION REPORT</h2>
        <div style="text-align: center; font-size: 9pt; color: #64748b; margin-top: -5px;">
          Your Trustworthy Research Analytics Companion
        </div>
        <br/>
        
        <div class="summary-info">
          <strong>Date Generated:</strong> ${new Date().toLocaleString()}<br/>
          <strong>Dataset File:</strong> ${file.name}<br/>
          <strong>Regression Model Type:</strong> ${
            results.regression_type === 'simple' ? 'Simple Linear Regression' :
            results.regression_type === 'multiple' ? 'Multiple Linear Regression' :
            'Partial Least Squares Regression (PLSR)'
          }<br/>
          <strong>Dependent Variable(s):</strong> ${depVars.join(', ')}<br/>
          <strong>Independent Variable(s):</strong> ${indVars.join(', ')}<br/>
        </div>
    `;

    if (results.regression_type !== 'plsr') {
      html += `
        <h3>Model Fit Summary</h3>
        <table align="center" style="margin-left:auto; margin-right:auto;">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>R-Squared (R&sup2;)</td><td>${results.r2.toFixed(4)}</td></tr>
            <tr><td>Adjusted R-Squared</td><td>${results.adj_r2.toFixed(4)}</td></tr>
            <tr><td>F-Statistic</td><td>${results.f_statistic.toFixed(4)} (df: ${results.df_model}, ${results.df_resid})</td></tr>
            <tr><td>F-Statistic p-value</td><td>${results.f_pvalue < 0.001 ? 'p &lt; 0.001' : results.f_pvalue.toFixed(4)}</td></tr>
          </tbody>
        </table>

        <h3>Coefficients Estimates</h3>
        <table align="center" style="margin-left:auto; margin-right:auto;">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Estimate (Beta)</th>
              <th>Std. Error</th>
              <th>t-Statistic</th>
              <th>p-value</th>
            </tr>
          </thead>
          <tbody>
            ${results.coefficients.map(coef => `
              <tr>
                <td><strong>${coef.variable}</strong></td>
                <td>${coef.coefficient.toFixed(4)}</td>
                <td>${coef.std_err.toFixed(4)}</td>
                <td>${coef.t_stat.toFixed(4)}</td>
                <td>${coef.p_value < 0.001 ? 'p &lt; 0.001' : coef.p_value.toFixed(4)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      html += `
        <h3>PLSR Components & R&sup2; Summary</h3>
        <div class="summary-info">
          <strong>Components Used:</strong> ${results.n_components_used}
        </div>
        <table align="center" style="margin-left:auto; margin-right:auto;">
          <thead>
            <tr>
              <th>Dependent Variable</th>
              <th>R&sup2; Value</th>
            </tr>
          </thead>
          <tbody>
            ${depVars.map((dep, idx) => `
              <tr>
                <td><strong>${dep}</strong></td>
                <td>${results.r2_values[idx].toFixed(4)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>Explained Variance in X (Predictors)</h3>
        <table align="center" style="margin-left:auto; margin-right:auto;">
          <thead>
            <tr>
              <th>Component</th>
              <th>Explained Variance Proportion</th>
              <th>Cumulative Explained Variance</th>
            </tr>
          </thead>
          <tbody>
            ${results.explained_variance_x.map((val, idx) => {
              const cum = results.explained_variance_x.slice(0, idx + 1).reduce((a, b) => a + b, 0);
              return `
                <tr>
                  <td>Component ${idx + 1}</td>
                  <td>${val.toFixed(4)} (${(val * 100).toFixed(2)}%)</td>
                  <td>${cum.toFixed(4)} (${(cum * 100).toFixed(2)}%)</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <h3>Beta Coefficients Matrix</h3>
        <table align="center" style="margin-left:auto; margin-right:auto;">
          <thead>
            <tr>
              <th>Predictor (X)</th>
              ${depVars.map(dep => `<th>${dep}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${results.coefficients.map(row => `
              <tr>
                <td><strong>${row.variable}</strong></td>
                ${depVars.map(dep => `<td>${row.coefficients[dep].toFixed(4)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    html += `
        <div class="footer">
          Stat Sathi &copy; 2026 - Your Trustworthy Research Analytics Companion - developed by Ravi, PhD Scholar in IISS Bhopal<br/>
          <em>Curated by ${user ? user.full_name : 'Guest Researcher'}</em>
        </div>
      </body>
      </html>
    `;

    const centeredHtml = html
      .replace(/<table([^>]*)>/gi, (match, attrs) => {
        let newAttrs = attrs;
        if (/style="/i.test(newAttrs)) {
          newAttrs = newAttrs.replace(/style="/i, 'style="mso-table-align: center; margin-left: auto; margin-right: auto; ');
        } else {
          newAttrs = ' style="mso-table-align: center; margin-left: auto; margin-right: auto;"' + newAttrs;
        }
        if (!/align=/i.test(newAttrs)) {
          newAttrs = ' align="center"' + newAttrs;
        }
        return `<center><table${newAttrs}>`;
      })
      .replace(/<\/table>/gi, '</table></center>');

    const blob = new Blob([centeredHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statsathi_regression_report.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl border border-slate-100 bg-brand-slate shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/50 bg-white px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-800">Regression Workspace</h2>
              <p className="font-sans text-[10px] text-slate-400">Perform Simple, Multiple OLS, or Partial Least Squares Regression.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!file ? (
            /* Upload Screen */
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-12 bg-white transition-all ${
                dragActive ? 'border-brand-orange bg-orange-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="h-16 w-16 bg-orange-50 text-brand-orange rounded-full flex items-center justify-center mb-4">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="font-display text-sm font-bold text-slate-700 mb-1">Drag and drop your dataset here</h3>
              <p className="font-sans text-xs text-slate-400 mb-6">Supports CSV and Excel (.xlsx, .xls) files</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-brand-indigo hover:bg-indigo-700 text-white font-sans text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : loadingCols ? (
            /* Loading columns */
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-slate-100">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin mb-4" />
              <p className="font-sans text-xs text-slate-400">Reading dataset variables...</p>
            </div>
          ) : !results ? (
            /* Configuration Panel */
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sidebar Settings */}
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-display text-xs font-bold text-slate-700">Model Configuration</span>
                  <button type="button" onClick={handleReset} className="font-sans text-[10px] font-bold text-brand-orange hover:text-orange-600 transition-colors">Reset File</button>
                </div>

                <div className="space-y-1">
                  <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Regression Type</label>
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
                    <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">PLS Components</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, indVars.length)}
                      value={nComponents}
                      onChange={(e) => setNComponents(parseInt(e.target.value) || 2)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                    />
                    <p className="font-sans text-[9px] text-slate-400">Maximum components cannot exceed the number of selected predictors.</p>
                  </div>
                )}

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/50 space-y-1">
                  <span className="font-display text-[11px] font-bold text-slate-600">Dataset Loaded:</span>
                  <div className="font-sans text-[10px] text-slate-400 truncate">{file.name}</div>
                  <button type="button" onClick={() => setViewerOpen(true)} className="mt-2 text-brand-indigo hover:text-indigo-700 font-sans text-[10px] font-bold flex items-center space-x-1">
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
                      <label className="font-sans text-[10px] text-slate-400">Select target outcome</label>
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
                      <p className="font-sans text-[10px] text-slate-400 mb-2">Select one or more target outcomes (Y)</p>
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
                      <label className="font-sans text-[10px] text-slate-400">Select single predictor</label>
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
                      <p className="font-sans text-[10px] text-slate-400 mb-2">Select predictor variables (X)</p>
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
          ) : (
            /* Results Screen */
            <div className="space-y-6 animate-fade-in">
              
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 pb-px space-x-6 overflow-x-auto">
                {[
                  { id: 'summary', label: 'Model Summary' },
                  { id: 'plot', label: 'Diagnostic Fit Plot' },
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
                            <div key={idx} className="flex justify-between text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg">
                              <span>Component {idx + 1}</span>
                              <span className="font-mono font-bold">{(val * 100).toFixed(2)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100 flex flex-col space-y-2">
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
                          <div className="font-sans text-[10px] text-slate-500 leading-relaxed">
                            Partial Least Squares (PLS) Beta Coefficients represent regression weights for each independent variable across each outcome target. Target R&sup2; measures variance explained for each.
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-display text-[11px] font-bold text-slate-700">Target R-Squared (R&sup2;)</h4>
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
                          <h4 className="font-display text-[11px] font-bold text-slate-700">Regression Coefficients Matrix</h4>
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
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Target Variable:</label>
                        <select
                          value={selectedPlsTarget}
                          onChange={(e) => setSelectedPlsTarget(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
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
                      <span className="font-sans text-[10px] font-bold text-slate-400 uppercase">Export Resolution:</span>
                      {[150, 300, 600].map(dpiVal => (
                        <button
                          key={dpiVal}
                          onClick={() => setDownloadDpi(dpiVal)}
                          className={`px-2 py-1 font-sans text-[9px] font-bold rounded-lg cursor-pointer ${
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
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[9px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
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
                        <tr className="bg-slate-100 text-slate-600 text-[10px]">
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
                    <div className="p-3 text-center text-slate-400 font-sans text-[10px]">
                      Showing first 100 observations. Export to Word to download all.
                    </div>
                  )}

                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200/50 bg-white px-6 py-4 flex justify-between items-center text-[10px] text-slate-400 font-sans">
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
