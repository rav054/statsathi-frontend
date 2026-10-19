import { apiFetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import { downloadDocxReport } from '../utils/reportApi';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import ResultChartPanel from './ResultChartPanel';
import { PALETTE_OPTIONS } from '../utils/figureStyle';
import { useFigurePreferences } from '../utils/figurePreferences';

const pcaPalettes = [
  { value: 'Oranges', label: 'Sunset Orange' },
  { value: 'Blues', label: 'Ocean Blue' },
  { value: 'Greens', label: 'Forest Green' },
  { value: 'coolwarm', label: 'Divergent Red-Blue' },
  { value: 'Purples', label: 'Deep Purple' },
  { value: 'magma', label: 'Magma Pink-Black' },
  ...PALETTE_OPTIONS.map(p => ({ value: p.value, label: p.label }))
];

const PcaModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { user, token } = useAuth();
  
  // File state
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: () => {
      setSelectedCols([]);
      setHueVar('');
      setLabelCol('');
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { file, columns, numericColumns } = dataset;

  // PCA Parameters
  const [selectedCols, setSelectedCols] = useState([]);
  const [hueVar, setHueVar] = useState('');
  const [scale, setScale] = useState(true);
  const [figurePrefs, setFigurePrefs] = useFigurePreferences();
  const [palette, setPalette] = useState(figurePrefs.palette);

  // Results & UI state
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));

  // Fetch the dataset this analysis was run on, then restore its settings so it can be run again
  const restoreSaved = async () => {
    setReopened(false);
    setResults(null);
    const loaded = await dataset.selectProjectDataset(initialAnalysis.dataset, initialAnalysis.projectName);
    if (loaded) {
      setSelectedCols(saved.variables || []);
      setScale(saved.scale !== false);
      setHueVar(saved.hue || '');
      setXComponent(saved.biplot?.x || 1);
      setYComponent(saved.biplot?.y || 2);
      setBiplotType(saved.biplot?.type || 'distance');
      setEllipse(saved.biplot?.ellipse || 'confidence');
      setLabelCol(saved.biplot?.labels || '');
      setRotateComponents(saved.varimax === 'auto' ? '' : (saved.varimax || ''));
    }
  };
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('eigenvalues'); // 'eigenvalues', 'loadings', 'scores', 'biplot'
  const [loadingView, setLoadingView] = useState('eigenvectors'); // 'eigenvectors' or 'correlation'

  // Biplot and rotation options
  const [xComponent, setXComponent] = useState(1);
  const [yComponent, setYComponent] = useState(2);
  const [biplotType, setBiplotType] = useState('distance');
  const [ellipse, setEllipse] = useState('confidence');
  const [labelCol, setLabelCol] = useState('');
  const [rotateComponents, setRotateComponents] = useState('');

  const handleSaveEditedData = async (editedFile) => {
    setResults(null);
    setError(null);
    if (editedFile) {
      await dataset.selectFile(editedFile);
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
    formData.append('x_component', String(xComponent));
    formData.append('y_component', String(yComponent));
    formData.append('biplot_type', biplotType);
    formData.append('ellipse', ellipse);
    if (labelCol) formData.append('label_col', labelCol);
    if (rotateComponents) formData.append('rotate_components', rotateComponents);

    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${API_URL}/analyze/pca`, {
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
    dataset.clear();
    setSelectedCols([]);
    setHueVar('');
    setLabelCol('');
    setResults(null);
    setError(null);
  };

  const handleDownloadReport = (format) => {
    if (!results) return;

    const fileName = `StatSathi_PCA_Report_${file.name.split('.')[0]}`;

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
      report += `Curated by ${user ? user.full_name : 'Guest Researcher'}\n`;
      report += `================================================================================\n`;

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
    const matrixRows = (loadings) => results.variable_names.map(col => [col, ...loadings[col].map(v => v.toFixed(4))]);
    const [planeX, planeY] = results.biplot ? [results.biplot.x_component, results.biplot.y_component] : [1, 2];
    const sections = [{
      heading: 'Overview',
      paragraphs: [
        `Variables: ${selectedCols.join(', ')}.`,
        scale ? 'Variables were standardized, so the analysis uses the correlation matrix.' : 'Variables were centered but not standardized (covariance matrix).',
        ...(hueVar ? [`Grouping variable for the biplot: ${hueVar}.`] : []),
        ...(results.biplot ? [`Biplot: PC${results.biplot.x_component} vs PC${results.biplot.y_component}, ${results.biplot.type === 'correlation' ? 'correlation biplot (standardized scores, correlation loadings)' : 'distance biplot (scores and eigenvectors)'}.`] : []),
        ...(results.kaiser_retained !== undefined && results.kaiser_retained !== null ? [`Kaiser criterion (eigenvalue ≥ 1): retain ${results.kaiser_retained} component(s).`] : [])
      ]
    }, {
      heading: '1. Eigenvalues and Explained Variance',
      tables: [{
        columns: ['Component', 'Eigenvalue', 'Explained variance (%)', 'Cumulative (%)'],
        rows: results.pc_names.map((name, i) => [name, results.eigenvalues[i].toFixed(4), (results.explained_variance_ratio[i] * 100).toFixed(2), (results.cumulative_variance_ratio[i] * 100).toFixed(2)])
      }]
    }, {
      heading: '2. Eigenvectors (Component Loadings)',
      tables: [{ columns: ['Variable', ...results.pc_names], rows: matrixRows(results.loadings) }]
    }];
    if (results.correlation_loadings) {
      sections.push({
        heading: '3. Correlation Loadings',
        paragraphs: ['Correlation between each original variable and each principal component.'],
        tables: [{ columns: ['Variable', ...results.pc_names], rows: matrixRows(results.correlation_loadings) }]
      });
    }
    if (results.plot) {
      sections.push({ heading: 'Biplot', images: [{ data: `data:image/png;base64,${results.plot}`, caption: `Figure 1. PCA biplot (PC${planeX} vs PC${planeY})` }] });
    }
    if (results.charts) {
      const extra = [
        ['scree', 'Scree plot with parallel analysis'],
        ['correlation_circle', `Correlation circle (PC${planeX} vs PC${planeY})`],
        ['contributions', `Variable contributions to PC${planeX} and PC${planeY}`],
        ['loadings_heatmap', 'Correlation loadings heatmap'],
        ['varimax_heatmap', 'Varimax-rotated loadings']
      ].filter(([key]) => results.charts[key]);
      sections.push({
        heading: 'Component Charts',
        images: extra.map(([key, caption], i) => ({ data: `data:image/png;base64,${results.charts[key]}`, caption: `Figure ${i + 2}. ${caption}` }))
      });
    }
    if (results.varimax) {
      const v = results.varimax;
      sections.push({
        heading: 'Varimax-Rotated Loadings',
        paragraphs: [`Correlation loadings of the first ${v.components} components rotated by varimax (Kaiser normalization). Communalities (h²) are unchanged by the rotation.`],
        tables: [{
          columns: ['Variable', ...v.names, 'h²'],
          rows: [
            ...results.variable_names.map(col => [col, ...v.loadings[col].map(x => x.toFixed(3)), v.communalities[col].toFixed(3)]),
            ['% of variance', ...v.percent.map(x => x.toFixed(2)), '']
          ]
        }]
      });
    }
    if (results.sample_scores && results.sample_scores.length > 0) {
      sections.push({
        heading: 'Observation Scores (first 100 rows)',
        paragraphs: [`Total observations: ${results.sample_scores.length}.`],
        tables: [{ columns: ['Row', ...results.pc_names], rows: results.sample_scores.slice(0, 100).map((row, idx) => [idx + 1, ...row.map(v => v.toFixed(4))]) }]
      });
    }
    return {
      title: 'Principal Component Analysis (PCA) Report',
      test_applied: 'Principal component analysis',
      dataset_name: file?.name,
      filename: fileName,
      sections
    };
  };

  if (!isOpen) return null;

  const componentOptions = Array.from({ length: Math.max(2, selectedCols.length) }, (_, i) => i + 1);
  const optionSelect = 'w-full rounded-xl border border-slate-200 bg-white py-2 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo disabled:bg-slate-50 disabled:text-slate-400';
  const quality = results?.observation_quality;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
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
          <button data-dialog-close aria-label="Close"
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

          {/* Step 2: Parameter Configuration Form */}
          {!results && !loadingAnalysis && (
            <div className="space-y-6">
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a dataset for PCA"
                hint="Numeric variables measured on the same observations (CSV or Excel). An optional grouping column can colour the biplot."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (
              <form onSubmit={runAnalysis} className="space-y-6">
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
                      onChange={(e) => { setPalette(e.target.value); setFigurePrefs({ palette: e.target.value }); }}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      {pcaPalettes.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs space-y-3">
                <p className="font-sans text-xs font-bold text-slate-500">Biplot and rotation options</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="font-sans text-[11px] font-semibold text-slate-500">Horizontal axis</span>
                    <select value={xComponent} onChange={(e) => setXComponent(Number(e.target.value))} className={optionSelect}>
                      {componentOptions.map(n => <option key={n} value={n}>PC{n}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-sans text-[11px] font-semibold text-slate-500">Vertical axis</span>
                    <select value={yComponent} onChange={(e) => setYComponent(Number(e.target.value))} className={optionSelect}>
                      {componentOptions.map(n => <option key={n} value={n}>PC{n}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-sans text-[11px] font-semibold text-slate-500">Biplot type</span>
                    <select value={biplotType} onChange={(e) => setBiplotType(e.target.value)} className={optionSelect}>
                      <option value="distance">Distance (compare observations)</option>
                      <option value="correlation">Correlation (compare variables)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-sans text-[11px] font-semibold text-slate-500">Group outline</span>
                    <select value={ellipse} onChange={(e) => setEllipse(e.target.value)} disabled={!hueVar} className={optionSelect}>
                      <option value="confidence">95% confidence ellipse of the mean</option>
                      <option value="data">95% data ellipse</option>
                      <option value="hull">Convex hull</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-sans text-[11px] font-semibold text-slate-500">Label points by</span>
                    <select value={labelCol} onChange={(e) => setLabelCol(e.target.value)} className={optionSelect}>
                      <option value="">No labels</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-sans text-[11px] font-semibold text-slate-500">Varimax components</span>
                    <select value={rotateComponents} onChange={(e) => setRotateComponents(e.target.value)} className={optionSelect}>
                      <option value="">Automatic{scale ? ' (parallel analysis)' : ''}</option>
                      {componentOptions.filter(n => n >= 2).map(n => <option key={n} value={n}>{n} components</option>)}
                    </select>
                  </label>
                </div>
                <p className="font-sans text-[10px] text-slate-400">
                  Distance biplots keep distances between observations; correlation biplots show correlations between variables as angles. Group outlines need a grouping variable. With more than 40 observations only the 12 furthest from the centre are labelled.
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Run Multivariate PCA
              </button>
              </form>
              )}
            </div>
          )}

          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Running Eigenvalue Decomposition...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Dashboard */}
          {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              {/* Tab selector bar */}
              <div className="flex border-b border-slate-200 pb-px space-x-6 overflow-x-auto">
                {[
                  { id: 'eigenvalues', label: 'Eigenvalues' },
                  { id: 'loadings', label: 'Eigenvectors / Loadings' },
                  { id: 'scores', label: 'PC Scores Matrix' },
                  ...(results.varimax ? [{ id: 'rotation', label: 'Varimax Rotation' }] : []),
                  { id: 'biplot', label: 'Charts' }
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
                  {results.kaiser_retained != null && (
                    <p className="mt-3 font-sans text-[11px] text-slate-500">
                      Kaiser criterion (eigenvalue ≥ 1): retain <span className="font-bold text-brand-indigo">{results.kaiser_retained}</span> component{results.kaiser_retained === 1 ? '' : 's'}.
                      Eigenvalues are from the sample correlation matrix, so they sum to the number of variables.
                    </p>
                  )}
                  {results.parallel_analysis && (
                    <p className="mt-1 font-sans text-[11px] text-slate-500">
                      Parallel analysis ({results.parallel_analysis.iterations} random datasets, 95th percentile): retain{' '}
                      <span className="font-bold text-brand-indigo">{results.parallel_analysis.retained}</span> component{results.parallel_analysis.retained === 1 ? '' : 's'}.
                      This is usually more reliable than the Kaiser rule; see the scree plot under Charts.
                    </p>
                  )}
                  {results.scaled === false && (
                    <p className="mt-3 font-sans text-[11px] text-slate-500">Covariance-matrix PCA (variables not standardized): the Kaiser criterion does not apply.</p>
                  )}
                </div>
              )}

              {/* Tab 2: Loadings Matrix */}
              {activeTab === 'loadings' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="font-display text-xs font-bold text-slate-700">
                      {loadingView === 'correlation' && results.correlation_loadings
                        ? 'Correlation Loadings (variable–component correlations)'
                        : 'Component Loadings (Eigenvectors Matrix)'}
                    </h4>
                    {results.correlation_loadings && (
                      <div className="flex space-x-1">
                        {[['eigenvectors', 'Eigenvectors'], ['correlation', 'Correlations']].map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => setLoadingView(id)}
                            className={`rounded-lg px-2.5 py-1 font-sans text-[10px] font-bold transition-all ${loadingView === id ? 'bg-brand-indigo text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                          {((loadingView === 'correlation' && results.correlation_loadings) ? results.correlation_loadings[col] : results.loadings[col]).map((val, idx) => (
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
                          {quality && <th className="py-2 pr-3 text-right">cos² (PC{quality.components[0]}+PC{quality.components[1]})</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {results.sample_scores.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/30">
                            <td className="py-2 pl-3 font-bold text-slate-400">{idx + 1}{quality?.labels?.[idx] ? <span className="ml-1.5 font-semibold text-slate-600">{quality.labels[idx]}</span> : null}</td>
                            {row.map((val, pcIdx) => (
                              <td key={pcIdx} className="py-2 text-right font-mono">
                                {val.toFixed(4)}
                              </td>
                            ))}
                            {quality && <td className="py-2 pr-3 text-right font-mono">{quality.cos2_plane[idx].toFixed(3)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'rotation' && results.varimax && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                  <h4 className="font-display text-xs font-bold text-slate-700 mb-1">Varimax-Rotated Loadings ({results.varimax.components} components)</h4>
                  <p className="mb-3 font-sans text-[11px] text-slate-500">
                    Correlation loadings rotated by varimax (Kaiser normalization), so each variable loads mainly on one component and the components are easier to name.
                    The rotation redistributes variance among the retained components; each variable&apos;s communality (h²) is unchanged. Bold: |loading| ≥ 0.5.
                  </p>
                  <table className="w-full border-collapse font-sans text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2 pr-4">Variable</th>
                        {results.varimax.names.map(name => <th key={name} className="py-2 text-right">{name}</th>)}
                        <th className="py-2 text-right">h²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.variable_names.map(col => (
                        <tr key={col} className="border-b border-slate-50 text-slate-700">
                          <td className="py-2.5 font-semibold text-slate-800">{col}</td>
                          {results.varimax.loadings[col].map((val, idx) => (
                            <td key={idx} className={`py-2.5 text-right font-mono ${Math.abs(val) >= 0.5 ? 'font-bold text-brand-indigo' : ''}`}>{val.toFixed(3)}</td>
                          ))}
                          <td className="py-2.5 text-right font-mono">{results.varimax.communalities[col].toFixed(3)}</td>
                        </tr>
                      ))}
                      <tr className="text-slate-500">
                        <td className="py-2.5 font-semibold">% of variance</td>
                        {results.varimax.percent.map((val, idx) => <td key={idx} className="py-2.5 text-right font-mono">{val.toFixed(2)}%</td>)}
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 4: Charts (biplot, scree plot, correlation circle, contributions) */}
              {activeTab === 'biplot' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-end space-x-1.5">
                    <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Palette:</label>
                    <select
              value={palette}
              onChange={(e) => { setPalette(e.target.value); setFigurePrefs({ palette: e.target.value }); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all animate-fade-in"
              >
              {pcaPalettes.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              </select>
                  </div>
                  <ResultChartPanel
                    key={results.plot.slice(-32)}
                    token={token}
                    file={file}
                    classicPlot={results.plot}
                    initialImages={results.charts || {}}
                    options={[
                      { value: 'classic', label: 'Biplot', hint: `${results.biplot?.type === 'correlation' ? 'Correlation biplot' : 'Distance biplot'}: observations on PC${results.biplot?.x_component ?? 1} and PC${results.biplot?.y_component ?? 2} with variable arrows${hueVar && results.biplot?.ellipse !== 'none' ? ' and group outlines' : ''}.` },
                      ...(results.charts?.scree ? [{ value: 'scree', label: 'Scree plot', hint: 'Eigenvalues with the parallel-analysis threshold and the Kaiser line.' }] : []),
                      ...(results.charts?.correlation_circle ? [{ value: 'correlation_circle', label: 'Correlation circle', hint: 'Correlations of each variable with the biplot components, coloured by quality of representation (cos²).' }] : []),
                      ...(results.charts?.contributions ? [{ value: 'contributions', label: 'Contributions', hint: 'How much each variable contributes to the biplot components.' }] : []),
                      ...(results.charts?.loadings_heatmap ? [{ value: 'loadings_heatmap', label: 'Loadings heatmap', hint: 'Correlation of every variable with each retained component.' }] : []),
                      ...(results.charts?.varimax_heatmap ? [{ value: 'varimax_heatmap', label: 'Varimax loadings', hint: 'Rotated loadings: each variable loads mainly on one component.' }] : [])
                    ]}
                    filenameBase="statsathi_pca"
                  />
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
            <SaveToProjectButton
              module="pca"
              report={() => buildDocxReport('report')}
              source={dataset.source}
              defaultTitle={`PCA – ${file?.name || 'dataset'}`}
              parameters={{ variables: selectedCols, scale, hue: hueVar || null, biplot: { x: xComponent, y: yComponent, type: biplotType, ellipse, labels: labelCol || null }, varimax: rotateComponents || 'auto', dataset: file?.name }}
              result={results}
            />
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
