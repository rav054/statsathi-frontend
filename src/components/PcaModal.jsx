import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Layers, Eye } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';

const pcaPalettes = [
  { value: 'Oranges', label: 'Sunset Orange' },
  { value: 'Blues', label: 'Ocean Blue' },
  { value: 'Greens', label: 'Forest Green' },
  { value: 'coolwarm', label: 'Divergent Red-Blue' },
  { value: 'Purples', label: 'Deep Purple' },
  { value: 'magma', label: 'Magma Pink-Black' }
];

const PcaModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  
  // File state
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // PCA Parameters
  const [selectedCols, setSelectedCols] = useState([]);
  const [hueVar, setHueVar] = useState('');
  const [scale, setScale] = useState(true);
  const [palette, setPalette] = useState('Oranges');

  // Results & UI state
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('eigenvalues'); // 'eigenvalues', 'loadings', 'scores', 'biplot'

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
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
    setSelectedCols([]);
    setHueVar('');
    setResults(null);
    setError(null);
    setLoadingCols(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/analyze/columns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to parse columns from dataset.');
      }

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

  const handleCheckboxChange = (col) => {
    if (selectedCols.includes(col)) {
      setSelectedCols(selectedCols.filter(c => c !== col));
    } else {
      setSelectedCols([...selectedCols, col]);
    }
  };

  const runAnalysis = async (e) => {
    if (e) e.preventDefault();
    if (selectedCols.length < 2) {
      setError("Please select at least 2 numeric variables for PCA analysis.");
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('columns_str', selectedCols.join(','));
    formData.append('scale', scale ? 'true' : 'false');
    if (hueVar) {
      formData.append('hue_var', hueVar);
    }
    formData.append('palette', palette);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/analyze/pca`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to complete PCA analysis.');
      }

      setResults(data);
      setActiveTab('eigenvalues');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    if (file && results) {
      runAnalysis(null);
    }
  }, [palette]);

  const handleReset = () => {
    setFile(null);
    setColumns([]);
    setNumericColumns([]);
    setSelectedCols([]);
    setHueVar('');
    setResults(null);
    setError(null);
  };

  const handleDownloadReport = (format) => {
    if (!results) return;

    const fileName = `StatSathi_PCA_Report_${file.name.split('.')[0]}`;
    const title = "Stat Sathi PCA Report";

    if (format === 'txt') {
      let report = `================================================================================\n`;
      report += `MULTIVARIATE PRINCIPAL COMPONENT ANALYSIS (PCA) REPORT\n`;
      report += `================================================================================\n`;
      report += `Generated on: ${new Date().toLocaleString()}\n`;
      report += `Dataset File: ${file.name}\n`;
      report += `Selected Variables: ${selectedCols.join(', ')}\n`;
      report += `Standardization Applied: ${scale ? 'Yes' : 'No'}\n`;
      if (hueVar) {
        report += `Grouping Variable: ${hueVar}\n`;
      }
      report += `--------------------------------------------------------------------------------\n\n`;

      report += `1. EIGENVALUES AND EXPLAINED VARIANCE\n`;
      report += `--------------------------------------------------------------------------------\n`;
      report += `Component   Eigenvalue   Explained Variance (%)   Cumulative Variance (%)\n`;
      report += `--------------------------------------------------------------------------------\n`;
      results.pc_names.forEach((name, i) => {
        const eig = results.eigenvalues[i].toFixed(4).padStart(12, ' ');
        const varExp = (results.explained_variance_ratio[i] * 100).toFixed(2).padStart(24, ' ');
        const cumExp = (results.cumulative_variance_ratio[i] * 100).toFixed(2).padStart(25, ' ');
        report += `${name.padEnd(11, ' ')}${eig}${varExp}${cumExp}\n`;
      });
      report += `--------------------------------------------------------------------------------\n\n`;

      report += `2. EIGENVECTORS (LOADINGS / COMPONENT MATRIX)\n`;
      report += `--------------------------------------------------------------------------------\n`;
      // Header row for loadings
      let headersRow = `Variable`.padEnd(20, ' ');
      results.pc_names.forEach(name => {
        headersRow += name.padStart(10, ' ');
      });
      report += headersRow + '\n';
      report += `-`.repeat(20 + results.pc_names.length * 10) + '\n';

      results.variable_names.forEach(col => {
        let row = col.substring(0, 19).padEnd(20, ' ');
        const loadingsArray = results.loadings[col];
        loadingsArray.forEach(val => {
          row += val.toFixed(4).padStart(10, ' ');
        });
        report += row + '\n';
      });
      report += `-`.repeat(20 + results.pc_names.length * 10) + '\n\n';

      report += `================================================================================\n`;
      report += `Stat Sathi - Your Trustworthy Research Analytics Companion\n`;
      report += `Curated by Ravi, PhD Scholar ICAR-IISS\n`;
      report += `================================================================================\n`;

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      const eigenvalueRows = results.pc_names.map((name, i) => `
        <tr>
          <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${name}</td>
          <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${results.eigenvalues[i].toFixed(4)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${(results.explained_variance_ratio[i] * 100).toFixed(2)}%</td>
          <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #4F46E5;">${(results.cumulative_variance_ratio[i] * 100).toFixed(2)}%</td>
        </tr>
      `).join('');

      const loadingsRows = results.variable_names.map(col => {
        const loadingsArray = results.loadings[col];
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${col}</td>
            ${loadingsArray.map(val => `<td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${val.toFixed(4)}</td>`).join('')}
          </tr>
        `;
      }).join('');

      let scoresRows = '';
      if (results.sample_scores && results.sample_scores.length > 0) {
        scoresRows = results.sample_scores.slice(0, 100).map((row, idx) => `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; text-align: center; background-color: #F8FAFC; color: #64748B;">${idx + 1}</td>
            ${row.map(val => `<td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${val.toFixed(4)}</td>`).join('')}
          </tr>
        `).join('');
      }

      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <title>${title}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1E293B; margin: 1in; }
            h1 { color: #4F46E5; font-size: 18pt; border-bottom: 2px solid #4F46E5; padding-bottom: 6px; margin-bottom: 20px; }
            h2 { color: #1E293B; font-size: 14pt; margin-top: 25px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
            p { margin-bottom: 15px; }
            .meta-table { border-collapse: collapse; width: 95%; margin-left: auto; margin-right: auto; margin-bottom: 25px; }
            .meta-table td { padding: 8px; border: 1px solid #E2E8F0; }
            .meta-label { font-weight: bold; background-color: #F8FAFC; width: 30%; }
          </style>
        </head>
        <body>
          <h1>Principal Component Analysis (PCA) Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table">
            <tr>
              <td class="meta-label">Analysis Type</td>
              <td>Multivariate Principal Component Analysis (PCA)</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file.name}</td>
            </tr>
            <tr>
              <td class="meta-label">Standardization Applied</td>
              <td>${scale ? 'Yes (Z-score Scaling)' : 'No'}</td>
            </tr>
            ${hueVar ? `
            <tr>
              <td class="meta-label">Grouping Variable</td>
              <td>${hueVar}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="meta-label">Selected Variables</td>
              <td>${selectedCols.join(', ')}</td>
            </tr>
            <tr>
              <td class="meta-label">Report Date</td>
              <td>${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td class="meta-label">Curator</td>
              <td>Ravi, PhD Scholar ICAR-IISS</td>
            </tr>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">1. Eigenvalues and Explained Variance</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Principal Component</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Eigenvalue</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Explained Variance Ratio</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Cumulative Variance</th>
              </tr>
            </thead>
            <tbody>
              ${eigenvalueRows}
            </tbody>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">2. Eigenvectors (Loadings / Component Matrix)</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Variable</th>
                ${results.pc_names.map(name => `<th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">${name}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${loadingsRows}
            </tbody>
          </table>
          </div>

          ${scoresRows ? `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">3. Projected Observation PC Scores (First 100 Rows)</h2>
          <p style="font-size: 9.5pt; color: #64748B;">Total observations in dataset: ${results.sample_scores.length}</p>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 9.5pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; font-weight: bold;">Row Index</th>
                ${results.pc_names.map(name => `<th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">${name}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${scoresRows}
            </tbody>
          </table>
          </div>
          ` : ''}

          <p style="margin-top: 40px; font-size: 9pt; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; text-align: center;">
            Stat Sathi &copy; 2026 - Your Trustworthy Research Analytics Companion
          </p>
        </body>
        </html>
      `;
      const centeredHtml = htmlContent
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
      const blob = new Blob(['\ufeff' + centeredHtml], { type: 'application/msword;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadPlot = () => {
    if (!results || !results.plot) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${results.plot}`;
    link.download = `StatSathi_PCA_Biplot_${file.name.split('.')[0]}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[680px] w-full max-w-4xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-800">
                PCA Multivariate Analysis
              </h2>
              <p className="font-sans text-xs text-slate-400">
                Eigenvalue decomposition, component loadings, and scores mapping.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 flex items-start space-x-3 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-600 border border-red-100 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Upload File */}
          {!file && !loadingCols && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-16 px-6 cursor-pointer transition-all ${
                dragActive
                  ? 'border-brand-orange bg-orange-50/20'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-brand-orange">
                <Upload className="h-6 w-6" />
              </div>
              <p className="font-display text-sm font-bold text-slate-700 text-center">
                Drag and drop your dataset here, or <span className="text-brand-orange">browse</span>
              </p>
              <p className="font-sans text-[10px] text-slate-400 mt-2 text-center">
                Supports Microsoft Excel (.xls, .xlsx) or CSV files
              </p>
            </div>
          )}

          {loadingCols && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Parsing Columns...</p>
            </div>
          )}

          {/* Step 2: Parameter Configuration Form */}
          {file && !loadingCols && !results && !loadingAnalysis && (
            <form onSubmit={runAnalysis} className="space-y-6">
              {/* Selected File Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex justify-between items-center">
                <div>
                  <p className="font-sans text-xs font-bold text-slate-400 uppercase">Selected Dataset</p>
                  <p className="font-sans text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-brand-orange" />
                    <span>View Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
              </div>

              {/* Grid selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Numeric Columns checklist */}
                <div className="space-y-2 col-span-1 border border-slate-100 rounded-2xl p-4 bg-white shadow-xs max-h-[300px] overflow-y-auto">
                  <label className="font-sans text-xs font-bold text-slate-500 block mb-1">
                    Select Variables for PCA Analysis
                  </label>
                  {numericColumns.length === 0 ? (
                    <p className="font-sans text-xs text-slate-400">No numeric variables found in dataset.</p>
                  ) : (
                    <div className="space-y-2">
                      {numericColumns.map(col => (
                        <label key={col} className="flex items-center space-x-2 cursor-pointer font-sans text-xs text-slate-700 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={selectedCols.includes(col)}
                            onChange={() => handleCheckboxChange(col)}
                            className="rounded-md border-slate-300 text-brand-indigo focus:ring-brand-indigo h-4 w-4"
                          />
                          <span>{col}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional controls */}
                <div className="space-y-6 col-span-1">
                  {/* Group Hue Select */}
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Group / Hue Variable (Optional)</label>
                    <select
                      value={hueVar}
                      onChange={(e) => setHueVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">-- No Grouping --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="font-sans text-[10px] text-slate-400">Used for color-coding points in the PCA Biplot.</p>
                  </div>

                  {/* Standardize Toggle */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-sans text-xs font-bold text-slate-700">Standardize Variables</p>
                      <p className="font-sans text-[10px] text-slate-400 mt-0.5">Scale data to unit variance before PCA.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={scale}
                      onChange={(e) => setScale(e.target.checked)}
                      className="rounded-md border-slate-300 text-brand-indigo focus:ring-brand-indigo h-5 w-5 cursor-pointer"
                    />
                  </div>

                  {/* Biplot Color Palette */}
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">Biplot Color Palette</label>
                    <select
                      value={palette}
                      onChange={(e) => setPalette(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      {pcaPalettes.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Run Multivariate PCA
              </button>
            </form>
          )}

          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Running Eigenvalue Decomposition...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Dashboard */}
          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              {/* Tab selector bar */}
              <div className="flex border-b border-slate-200 pb-px space-x-6 overflow-x-auto">
                {[
                  { id: 'eigenvalues', label: 'Eigenvalues' },
                  { id: 'loadings', label: 'Eigenvectors / Loadings' },
                  { id: 'scores', label: 'PC Scores Matrix' },
                  { id: 'biplot', label: 'Biplot Graphic' }
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

              {/* Tab 1: Eigenvalues Table */}
              {activeTab === 'eigenvalues' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                  <h4 className="font-display text-xs font-bold text-slate-700 mb-3">Eigenvalues and Variance Explanation</h4>
                  <table className="w-full border-collapse font-sans text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2 pr-4">Principal Component</th>
                        <th className="py-2 text-right">Eigenvalue</th>
                        <th className="py-2 text-right">Explained Variance (%)</th>
                        <th className="py-2 text-right">Cumulative Variance (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.pc_names.map((name, i) => (
                        <tr key={name} className="border-b border-slate-50 text-slate-700">
                          <td className="py-2.5 font-bold text-slate-800">{name}</td>
                          <td className="py-2.5 text-right font-mono">{results.eigenvalues[i].toFixed(4)}</td>
                          <td className="py-2.5 text-right font-mono">{(results.explained_variance_ratio[i] * 100).toFixed(2)}%</td>
                          <td className="py-2.5 text-right font-mono">{(results.cumulative_variance_ratio[i] * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Loadings Matrix */}
              {activeTab === 'loadings' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                  <h4 className="font-display text-xs font-bold text-slate-700 mb-3">Component Loadings (Eigenvectors Matrix)</h4>
                  <table className="w-full border-collapse font-sans text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2 pr-4">Variable Name</th>
                        {results.pc_names.map(name => (
                          <th key={name} className="py-2 text-right">{name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.variable_names.map(col => (
                        <tr key={col} className="border-b border-slate-50 text-slate-700">
                          <td className="py-2.5 font-semibold text-slate-800">{col}</td>
                          {results.loadings[col].map((val, idx) => (
                            <td key={idx} className="py-2.5 text-right font-mono">
                              {val >= 0 ? ` ${val.toFixed(4)}` : val.toFixed(4)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Sample Scores Matrix */}
              {activeTab === 'scores' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-display text-xs font-bold text-slate-700">Projected Observation PC Scores (First 100 Rows)</h4>
                    <p className="font-sans text-[10px] text-slate-400">Total Observations: {results.sample_scores.length}</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full border-collapse font-sans text-[11px] text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                          <th className="py-2 pl-3 pr-4">Row Index</th>
                          {results.pc_names.map(name => (
                            <th key={name} className="py-2 text-right">{name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.sample_scores.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/30">
                            <td className="py-2 pl-3 font-bold text-slate-400">{idx + 1}</td>
                            {row.map((val, pcIdx) => (
                              <td key={pcIdx} className="py-2 text-right font-mono">
                                {val.toFixed(4)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: Biplot Graphic */}
              {activeTab === 'biplot' && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col items-center justify-center">
                  <div className="w-full flex justify-between items-center mb-3">
                    <h4 className="font-display text-xs font-bold text-slate-700">PCA Biplot Chart</h4>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1.5 mr-2">
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Palette:</label>
                        <select
                          value={palette}
                          onChange={(e) => setPalette(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all animate-fade-in"
                        >
                          {pcaPalettes.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleDownloadPlot}
                        className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Save Plot</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-xs max-w-full overflow-hidden flex justify-center items-center">
                    <img
                      src={`data:image/png;base64,${results.plot}`}
                      alt="PCA Biplot"
                      className="max-w-[500px] h-auto rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {results ? (
            <div className="flex items-center space-x-1 bg-emerald-50/50 p-1 rounded-xl border border-emerald-100">
              <span className="font-sans text-[9px] font-bold text-emerald-600 px-2 uppercase shrink-0">Report:</span>
              <button
                onClick={() => handleDownloadReport('txt')}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-[10px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
                title="Save as Text"
              >
                TXT
              </button>
              <button
                onClick={() => handleDownloadReport('doc')}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-[10px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
                title="Export to Word"
              >
                Word
              </button>
            </div>
          ) : (
            <div />
          )}
          <div className="flex space-x-2">
            {file && results && (
              <button
                onClick={handleReset}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Analyze New Variables
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
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

export default PcaModal;
