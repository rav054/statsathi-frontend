import { apiFetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, Download, RefreshCw, ZoomIn, ZoomOut, Eye } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';

const CorrelationModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token } = useAuth();
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ numericColumns: numeric }) => {
      setSelectedCols(numeric);
      setImageUrl(null);
      setMatrix(null);
    },
    onCleared: () => {
      setImageUrl(null);
      setMatrix(null);
    },
  });
  const { file, numericColumns } = dataset;





  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(initialAnalysis?.result?.heatmap_png || null);
  const [matrix, setMatrix] = useState(initialAnalysis?.result?.matrix || null);

  // Fetch the dataset this analysis was run on, then restore its settings so it can be run again
  const restoreSaved = async () => {
    setReopened(false);
    setImageUrl(null);
    setMatrix(null);
    const loaded = await dataset.selectProjectDataset(initialAnalysis.dataset, initialAnalysis.projectName);
    if (loaded) {
      setMethod(saved.method || 'pearson');
      setPlotType(saved.plot_type || 'full');
      setPalette(saved.palette || 'RdBu_r');
      setSelectedCols(saved.variables || []);
    }
  };
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [palette, setPalette] = useState('RdBu_r');
  const [plotType, setPlotType] = useState('full');
  const [method, setMethod] = useState('pearson');
  const methodLabel = method === 'spearman' ? 'Spearman' : 'Pearson';
  const [downloadDpi, setDownloadDpi] = useState(300);
  const [selectedCols, setSelectedCols] = useState([]);
  const [order, setOrder] = useState('original'); // 'original' or 'clustered'
  const [target, setTarget] = useState('');
  const [threshold, setThreshold] = useState(0.3);

  const colormaps = [
    { value: 'YlOrRd', label: 'Classic Thermal (Yellow-Orange-Red)' },
    { value: 'YlGnBu', label: 'Classic Aquatic (Yellow-Green-Blue)' },
    { value: 'coolwarm', label: 'Divergent (Red-Blue)' },
    { value: 'RdBu_r', label: 'Classic Red-White-Blue' },
    { value: 'inferno', label: 'Inferno Thermal Flame' },
    { value: 'plasma', label: 'Plasma Thermal' },
    { value: 'viridis', label: 'Viridis Sequential' },
    { value: 'cividis', label: 'Cividis (colour-blind safe)' },
    { value: 'magma', label: 'Magma Purple-Pink' },
    { value: 'Spectral', label: 'Spectral Rainbow' },
    { value: 'vlag', label: 'Divergent (Blue-Red)' }
  ];

  const plotTypes = [
    { value: 'full', label: 'Heatmap: full matrix' },
    { value: 'lower', label: 'Heatmap: lower triangle' },
    { value: 'upper', label: 'Heatmap: upper triangle' },
    { value: 'pairs', label: 'Scatter matrix: scatter + histogram + coefficients' },
    { value: 'mixed', label: 'Correlogram: circles + coefficients' },
    { value: 'target', label: 'Correlation with one target (with 95% CI)' },
    { value: 'network', label: 'Correlation network' }
  ];
  const targetChoices = selectedCols.length > 0 ? selectedCols : numericColumns;
  const effectiveTarget = targetChoices.includes(target) ? target : (targetChoices[0] || '');
  const plotLabel = plotTypes.find(pt => pt.value === plotType)?.label || 'Heatmap';
  const MAX_PAIRS_VARIABLES = 12; // must match backend/app/modules/correlation.py






  // Numeric columns of the dataset; all are selected by default

  const toggleColumn = (col) => {
    setSelectedCols(prev => (prev.includes(col)
      ? prev.filter(c => c !== col)
      : numericColumns.filter(c => prev.includes(c) || c === col)));
  };

  const handleSaveEditedData = async (editedFile) => {
    setImageUrl(null);
    setMatrix(null);
    setError(null);
    if (editedFile) {
      await dataset.selectFile(editedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (numericColumns.length > 0 && selectedCols.length < 2) {
      setError('Select at least 2 variables.');
      return;
    }
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setMatrix(null);
    setZoomLevel(1);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('palette', palette);
    formData.append('plot_type', plotType);
    formData.append('method', method);
    formData.append('dpi', downloadDpi.toString());
    if (selectedCols.length > 0 && selectedCols.length < numericColumns.length) {
      formData.append('columns_str', selectedCols.join(','));
    }
    formData.append('order', order);
    if (plotType === 'target') formData.append('target', effectiveTarget);
    if (plotType === 'network') formData.append('threshold', threshold);

    try {
      const res = await apiFetch(`${API_URL}/analyze/correlation`, {
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
      setMatrix({ ...data.matrix, p_values: data.p_values, n: data.n, method: data.method });
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
  }, [palette, plotType, downloadDpi, method, selectedCols, order, target, threshold]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `correlation_${plotType}_${file.name.replace(/\.[^/.]+$/, "")}.png`;
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

    if (format === 'txt') {
      let report = `==================================================\n`;
      report += `              STAT SATHI CORRELATION REPORT       \n`;
      report += `==================================================\n\n`;
      report += `Test Applied: ${methodLabel} Correlation Analysis (${plotLabel})\n`;
      report += `Dataset: ${file.name}\n`;
      report += `Description:\n`;
      report += `  This report indicates that a ${methodLabel} correlation matrix heatmap was generated \n`;
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
      downloadDocxReport(token, buildDocxReport(fileName)).catch(err => setError(err.message));
    }
  };

  // Structured content for the server-side Word (.docx) report
  const buildDocxReport = (fileName) => {
    const label = matrix?.method === 'spearman' ? 'Spearman' : 'Pearson';
    const symbol = matrix?.method === 'spearman' ? '\u03c1' : 'r';
    const sections = [{
      heading: 'Overview',
      paragraphs: [
        `${label} correlation coefficients between the numeric columns of the dataset, using pairwise-complete observations. Coefficients range from -1 (perfect negative) to +1 (perfect positive); 0 means no ${matrix?.method === 'spearman' ? 'monotonic' : 'linear'} relationship.`
      ],
      images: imageUrl ? [{ data: imageUrl, caption: `Figure 1. ${label} correlation (${plotLabel.toLowerCase()})` }] : []
    }];

    if (matrix) {
      const vars = matrix.columns;
      const stars = (p) => (p == null ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '');
      const cell = (i, j) => {
        const r = matrix.values[i][j];
        if (r == null) return 'n/a';
        return i === j ? r.toFixed(3) : `${r.toFixed(3)}${stars(matrix.p_values?.[i]?.[j])}`;
      };
      sections.push({
        heading: 'Correlation Matrix',
        tables: [{
          columns: ['Variable', ...vars],
          rows: vars.map((v, i) => [v, ...vars.map((_, j) => cell(i, j))]),
          caption: `Table 1. ${label} correlation coefficients (${symbol})`,
          note: '* p < 0.05, ** p < 0.01, *** p < 0.001 (two-tailed).'
        }]
      });

      const pairs = vars.flatMap((a, i) => vars.slice(i + 1).map((b, offset) => {
        const j = i + 1 + offset;
        const p = matrix.p_values?.[i]?.[j];
        return [`${a} \u00d7 ${b}`, matrix.values[i][j] == null ? 'n/a' : matrix.values[i][j].toFixed(3), formatP(p), matrix.n?.[i]?.[j] ?? '\u2013'];
      }));
      if (pairs.length > 0 && pairs.length <= 300) {
        sections.push({
          heading: 'Pairwise Tests',
          tables: [{ columns: ['Variable pair', symbol, 'p-value', 'n'], rows: pairs, caption: 'Table 2. Significance of each correlation' }]
        });
      }
    }

    sections.push({
      heading: 'Interpretation Guide',
      bullets: [
        `|${symbol}| \u2265 0.70: strong correlation`,
        `0.40 \u2264 |${symbol}| < 0.70: moderate correlation`,
        `|${symbol}| < 0.40: weak correlation`,
        'Correlation does not imply causation; check scatter plots for outliers and non-linear patterns.'
      ]
    });

    return {
      title: 'Correlation Analysis Report',
      test_applied: `${label} correlation analysis`,
      dataset_name: file?.name,
      filename: fileName,
      sections
    };
  };

  const handleReset = () => {
    dataset.clear();
    setImageUrl(null);
    setMatrix(null);
    setError(null);
    setZoomLevel(1);
    setPalette('coolwarm');
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
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
          <button data-dialog-close aria-label="Close"
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
          {(error || dataset.error) && (
            <div className="mb-6 flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error || dataset.error}</span>
            </div>
          )}

          {!imageUrl && !loading && (
            <DatasetPicker
              dataset={dataset}
              title="Select or drop a dataset to correlate"
              hint="Numeric columns measured on the same observations (CSV or Excel)."
              onViewData={() => setViewerOpen(true)}
            />
          )}

          {file && !loading && (
            <div className="mb-4 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="font-sans text-xs font-bold text-slate-500">Coefficient:</span>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
                >
                  <option value="pearson">Pearson (linear)</option>
                  <option value="spearman">Spearman (rank)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-sans text-xs font-bold text-slate-500">Plot Type:</span>
                <select
                  value={plotType}
                  onChange={(e) => setPlotType(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
                >
                  {plotTypes.map(pt => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-sans text-xs font-bold text-slate-500">Color Theme:</span>
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

              {plotType !== 'target' && (
                <div className="flex items-center space-x-2">
                  <span className="font-sans text-xs font-bold text-slate-500">Variable Order:</span>
                  <select
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
                  >
                    <option value="original">As in the dataset</option>
                    <option value="clustered">Clustered (related variables together)</option>
                  </select>
                </div>
              )}

              {plotType === 'target' && (
                <div className="flex items-center space-x-2">
                  <span className="font-sans text-xs font-bold text-slate-500">Target Variable:</span>
                  <select
                    value={effectiveTarget}
                    onChange={(e) => setTarget(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
                  >
                    {targetChoices.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {plotType === 'network' && (
                <div className="flex items-center space-x-2">
                  <span className="font-sans text-xs font-bold text-slate-500">Show |coefficient| ≥</span>
                  <input
                    type="number"
                    min="0.05"
                    max="0.95"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-20 rounded-lg border border-slate-200 bg-white py-1.5 px-2 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
                  />
                </div>
              )}

              {numericColumns.length > 0 && (
                <div className="w-full">
                  <span className="font-sans text-xs font-bold text-slate-500">
                    Variables ({selectedCols.length} of {numericColumns.length} selected):
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {numericColumns.map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => toggleColumn(col)}
                        className={`rounded-full border px-2.5 py-1 font-sans text-[14px] font-semibold transition-colors cursor-pointer ${
                          selectedCols.includes(col)
                            ? 'border-brand-indigo bg-indigo-50 text-brand-indigo'
                            : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                  {plotType === 'pairs' && selectedCols.length > MAX_PAIRS_VARIABLES && (
                    <p className="mt-1.5 font-sans text-[14px] text-amber-600">
                      The scatter matrix shows at most {MAX_PAIRS_VARIABLES} variables. Deselect some, or use a heatmap or correlogram.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">
                Parsing dataset & generating publication-ready chart...
              </p>
            </div>
          )}

          {/* Heatmap Result View */}
          {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

          {imageUrl && (
            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <div className="text-center mb-4">
                <h4 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Statistical Report
                </h4>
                <p className="text-xs text-brand-indigo font-semibold mt-0.5">
                  Test Applied: {methodLabel} Correlation Analysis ({plotLabel})
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
                  <span className="font-sans text-[12px] font-bold text-brand-indigo px-2 uppercase shrink-0">DPI:</span>
                  {[150, 300, 600].map(dpiVal => (
                    <button
                      key={dpiVal}
                      onClick={() => setDownloadDpi(dpiVal)}
                      className={`px-1.5 py-0.5 font-sans text-[11px] font-bold rounded-md cursor-pointer transition-colors ${
                        downloadDpi === dpiVal ? 'bg-brand-indigo text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {dpiVal}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-1 bg-emerald-50/50 p-1 rounded-xl border border-emerald-100">
                  <span className="font-sans text-[12px] font-bold text-emerald-600 px-2 uppercase shrink-0">Report:</span>
                  <button
                    onClick={() => handleDownloadReport('txt')}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-[13px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
                    title="Save as Text"
                  >
                    TXT
                  </button>
                  <button
                    onClick={() => handleDownloadReport('doc')}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-[13px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
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
                  <>
                    <button
                      onClick={handleDownloadCSV}
                      className="flex items-center space-x-1.5 rounded-lg bg-amber-600 p-1.5 px-3 hover:bg-amber-700 text-white font-sans text-xs font-semibold transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download CSV</span>
                    </button>
                    <SaveToProjectButton
                      module="correlation"
                      report={() => buildDocxReport('report')}
                      source={dataset.source}
                      defaultTitle={`${matrix.method === 'spearman' ? 'Spearman' : 'Pearson'} correlation – ${file?.name || 'dataset'}`}
                      parameters={{ method: matrix.method, plot_type: plotType, palette, variables: matrix.columns }}
                      result={{ matrix, heatmap_png: imageUrl }}
                    />
                  </>
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
                  alt={`${methodLabel} Correlation Heatmap`}
                  style={{ transform: `scale(${zoomLevel})` }}
                  className="max-h-[330px] w-auto object-contain transition-transform duration-200"
                />
              </div>

              {/* Pairwise coefficients with p-values and n */}
              {matrix?.p_values && (
                <div className="mt-4 w-full rounded-2xl border border-slate-200/50 bg-white p-4 shadow-xs">
                  <h5 className="font-display text-xs font-bold text-slate-700 mb-1">
                    {matrix.method === 'spearman' ? "Spearman's ρ" : "Pearson's r"} with significance
                  </h5>
                  <p className="font-sans text-[13px] text-slate-400 mb-3">Two-tailed tests on pairwise-complete observations. * p &lt; 0.05, ** p &lt; 0.01, *** p &lt; 0.001</p>
                  <div className="max-h-[260px] overflow-auto">
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2 pr-4">Variable Pair</th>
                          <th className="py-2 text-right">Coefficient</th>
                          <th className="py-2 text-right">p-value</th>
                          <th className="py-2 text-right">n</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.columns.flatMap((a, i) => matrix.columns.slice(i + 1).map((b, offset) => {
                          const j = i + 1 + offset;
                          const r = matrix.values[i][j];
                          const p = matrix.p_values[i][j];
                          const stars = p == null ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
                          return (
                            <tr key={`${a}-${b}`} className="border-b border-slate-50 text-slate-700">
                              <td className="py-2 pr-4 font-semibold">{a} × {b}</td>
                              <td className="py-2 text-right font-mono">{r == null ? 'n/a' : `${r.toFixed(3)}${stars}`}</td>
                              <td className="py-2 text-right font-mono">{p == null ? 'n/a' : p < 0.001 ? '< 0.001' : p.toFixed(4)}</td>
                              <td className="py-2 text-right font-mono">{matrix.n?.[i]?.[j] ?? '-'}</td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
