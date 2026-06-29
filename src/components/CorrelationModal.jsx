import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, ZoomIn, ZoomOut, Eye } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';

const CorrelationModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [palette, setPalette] = useState('coolwarm');
  const [downloadDpi, setDownloadDpi] = useState(300);
  const fileInputRef = useRef(null);

  const colormaps = [
    { value: 'coolwarm', label: 'Divergent (Red-Blue)' },
    { value: 'viridis', label: 'Sequential (Yellow-Green-Blue)' },
    { value: 'magma', label: 'Sequential (Purple-Orange-Pink)' },
    { value: 'Spectral', label: 'Spectral Rainbow' },
    { value: 'RdYlBu', label: 'Divergent (Red-Yellow-Blue)' },
    { value: 'vlag', label: 'Divergent (Blue-Red)' }
  ];


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
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError("Supported formats: CSV or Excel (.xlsx, .xls) only.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleSaveEditedData = async (editedFile) => {
    setImageUrl(null);
    setMatrix(null);
    setError(null);
    if (editedFile) {
      validateAndSetFile(editedFile);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setMatrix(null);
    setZoomLevel(1);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('palette', palette);
    formData.append('dpi', downloadDpi.toString());

    try {
      const res = await fetch(`${API_URL}/analyze/correlation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to analyze dataset.");
      }

      setImageUrl(`data:image/png;base64,${data.plot}`);
      setMatrix(data.matrix);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (file && imageUrl) {
      handleUpload();
    }
  }, [palette, downloadDpi]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `correlation_heatmap_${file.name.replace(/\.[^/.]+$/, "")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadCSV = () => {
    if (!matrix) return;
    
    let csvContent = "";
    csvContent += "," + matrix.columns.map(c => `"${c.replace(/"/g, '""')}"`).join(",") + "\n";
    
    matrix.index.forEach((rowLabel, idx) => {
      const rowValues = matrix.values[idx].map(v => v !== null && v !== undefined ? v.toFixed(6) : "");
      csvContent += `"${rowLabel.replace(/"/g, '""')}"` + "," + rowValues.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `CorrelationMatrix_${file.name.replace(/\.[^/.]+$/, "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnalyzeNew = () => {
    setImageUrl(null);
    setMatrix(null);
    setError(null);
    setZoomLevel(1);
  };

  const handleDownloadReport = (format) => {
    if (!file) return;

    const fileName = `StatSathi_CorrelationReport_${file.name.replace(/\.[^/.]+$/, "")}`;
    const title = "Stat Sathi Correlation Report";

    if (format === 'txt') {
      let report = `==================================================\n`;
      report += `              STAT SATHI CORRELATION REPORT       \n`;
      report += `==================================================\n\n`;
      report += `Test Applied: Pearson Correlation Analysis (Heatmap Matrix)\n`;
      report += `Dataset: ${file.name}\n`;
      report += `Description:\n`;
      report += `  This report indicates that a Pearson correlation matrix heatmap was generated \n`;
      report += `  for all numeric variables in the dataset.\n\n`;
      report += `Interpretation Guide:\n`;
      report += `  - The coefficient (r) ranges from -1 to +1.\n`;
      report += `  - r close to +1: Strong positive linear relationship.\n`;
      report += `  - r close to -1: Strong negative linear relationship.\n`;
      report += `  - r close to 0: No linear relationship.\n`;
      report += `\n==================================================\n`;
      report += `Report generated on ${new Date().toLocaleString()}\n`;
      report += `Stat Sathi - Your Trustworthy Research Analytics Companion\n`;
      report += `Curated by Ravi, PhD Scholar ICAR-IISS\n`;
      report += `==================================================\n`;

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      let matrixTable = '';
      if (matrix) {
        const vars = Object.keys(matrix);
        matrixTable = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Correlation Coefficient Matrix</h2>
          <div align="center">
          <table align="center" style="border-collapse: collapse; width: 95%; font-family: Arial, sans-serif; font-size: 10pt; margin-left: auto; margin-right: auto; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Variable</th>
                ${vars.map(v => `<th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">${v}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${vars.map(v => `
                <tr>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${v}</td>
                  ${vars.map(v2 => `<td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: Courier New, monospace; color: #334155;">${matrix[v][v2].toFixed(4)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        `;
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
            ul { margin-bottom: 15px; padding-left: 20px; }
            li { margin-bottom: 5px; }
            .meta-table { border-collapse: collapse; width: 95%; margin-left: auto; margin-right: auto; margin-bottom: 25px; }
            .meta-table td { padding: 8px; border: 1px solid #E2E8F0; }
            .meta-label { font-weight: bold; background-color: #F8FAFC; width: 30%; }
          </style>
        </head>
        <body>
          <h1>Stat Sathi Correlation Analysis Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table">
            <tr>
              <td class="meta-label">Test Applied</td>
              <td>Pearson Correlation Analysis (Heatmap Matrix)</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file.name}</td>
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

          <p>This report presents the correlation coefficients calculated between numeric columns in the uploaded dataset. Values range from -1.00 (perfect negative correlation) to +1.00 (perfect positive correlation), with 0.00 representing no linear relationship.</p>

          ${matrixTable}

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Correlation Coefficient Interpretation Guide</h2>
          <ul>
            <li><strong>r &gt; 0.7:</strong> Strong positive correlation.</li>
            <li><strong>r &lt; -0.7:</strong> Strong negative correlation.</li>
            <li><strong>0.3 &lt; r &lt; 0.7:</strong> Moderate positive correlation.</li>
            <li><strong>-0.7 &lt; r &lt; -0.3:</strong> Moderate negative correlation.</li>
            <li><strong>-0.3 &lt; r &lt; 0.3:</strong> Weak or no linear correlation.</li>
          </ul>
          
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

  const handleReset = () => {
    setFile(null);
    setImageUrl(null);
    setMatrix(null);
    setError(null);
    setZoomLevel(1);
    setPalette('coolwarm');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[600px] w-full max-w-4xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-800">
              Correlation Analysis
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Upload CSV or Excel dataset to render publication-ready Pearson matrices.
            </p>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error}</span>
            </div>
          )}

          {!imageUrl && !loading && (
            /* Drag and Drop Area */
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-12 px-6 text-center cursor-pointer transition-all duration-200 ${
                dragActive 
                  ? 'border-brand-indigo bg-indigo-50/30' 
                  : file 
                  ? 'border-emerald-300 bg-emerald-50/10' 
                  : 'border-slate-300 hover:border-brand-indigo hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleChange}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              
              {file ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4 animate-bounce">
                  <Check className="h-6 w-6" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
                  <Upload className="h-6 w-6 text-slate-400" />
                </div>
              )}

              <p className="font-sans text-sm font-semibold text-slate-700">
                {file ? file.name : "Select or drag and drop your dataset"}
              </p>
              <p className="font-sans text-xs text-slate-400 mt-1">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports CSV, XLSX, and XLS formats"}
              </p>
            </div>
          )}

          {file && !loading && (
            <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs max-w-xs mx-auto flex items-center justify-between">
              <span className="font-sans text-xs font-bold text-slate-500">Heatmap Colormap:</span>
              <select
                value={palette}
                onChange={(e) => setPalette(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
              >
                {colormaps.map(cmap => (
                  <option key={cmap.value} value={cmap.value}>{cmap.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">
                Parsing dataset & generating publication-ready heatmap...
              </p>
            </div>
          )}

          {/* Heatmap Result View */}
          {imageUrl && (
            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <div className="text-center mb-4">
                <h4 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Statistical Report
                </h4>
                <p className="text-xs text-brand-indigo font-semibold mt-0.5">
                  Test Applied: Pearson Correlation Analysis (Heatmap Matrix)
                </p>
              </div>
              <div className="mb-4 flex flex-wrap gap-2 items-center">
                <div className="flex space-x-1.5">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                    className="rounded-lg bg-white border border-slate-200 p-1.5 hover:bg-slate-50 text-slate-600 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.25))}
                    className="rounded-lg bg-white border border-slate-200 p-1.5 hover:bg-slate-50 text-slate-600 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-1 bg-brand-indigo/10 p-1 rounded-xl border border-brand-indigo/20">
                  <span className="font-sans text-[9px] font-bold text-brand-indigo px-2 uppercase shrink-0">DPI:</span>
                  {[150, 300, 600].map(dpiVal => (
                    <button
                      key={dpiVal}
                      onClick={() => setDownloadDpi(dpiVal)}
                      className={`px-1.5 py-0.5 font-sans text-[8px] font-bold rounded-md cursor-pointer transition-colors ${
                        downloadDpi === dpiVal ? 'bg-brand-indigo text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {dpiVal}
                    </button>
                  ))}
                </div>
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
                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-1.5 rounded-lg bg-brand-indigo p-1.5 px-3 hover:bg-indigo-700 text-white font-sans text-xs font-semibold transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Chart</span>
                </button>
                {matrix && (
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center space-x-1.5 rounded-lg bg-amber-600 p-1.5 px-3 hover:bg-amber-700 text-white font-sans text-xs font-semibold transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download CSV</span>
                  </button>
                )}
                <button
                  onClick={handleAnalyzeNew}
                  className="flex items-center space-x-1.5 rounded-lg bg-white border border-slate-200 p-1.5 px-3 hover:bg-slate-50 text-slate-600 font-sans text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Analyze New Test</span>
                </button>
                <button
                  onClick={() => setViewerOpen(true)}
                  className="flex items-center space-x-1.5 rounded-lg bg-white border border-slate-200 p-1.5 px-3 hover:bg-slate-50 text-slate-600 font-sans text-xs font-semibold transition-colors"
                >
                  <Eye className="h-4 w-4 text-brand-orange" />
                  <span>View Data</span>
                </button>
              </div>
              <div className="w-full overflow-auto max-h-[350px] border border-slate-200/50 rounded-2xl bg-white flex items-center justify-center p-2 shadow-inner">
                <img 
                  src={imageUrl} 
                  alt="Pearson Correlation Heatmap" 
                  style={{ transform: `scale(${zoomLevel})` }}
                  className="max-h-[330px] w-auto object-contain transition-transform duration-200"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          
          {file && !loading && (
            <button
              onClick={() => setViewerOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center space-x-1"
            >
              <Eye className="h-4 w-4 text-brand-orange" />
              <span>View Data</span>
            </button>
          )}

          {file && !imageUrl && !loading && (
            <button
              onClick={handleUpload}
              className="rounded-xl bg-brand-indigo px-5 py-2.5 font-sans text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              Analyze Dataset
            </button>
          )}
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

export default CorrelationModal;
