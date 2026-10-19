import { apiFetch } from '../utils/apiFetch';
import { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, RefreshCw, Eye, Layers, Play, Plus, Trash2, HelpCircle } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import SemModeSwitch from './SemModeSwitch';

const SemModal = ({ isOpen, onClose, onModeChange, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token } = useAuth();

  // Wizard state
  const [wizardStep, setWizardStep] = useState(!initialAnalysis?.result); // true = show wizard, false = show canvas workspace
  const [semType, setSemType] = useState(saved.type || ''); // 'pls' (Prediction) or 'cb' (Theory Testing)

  // Dataset state
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: () => {
      setLatents([]);
      setPaths([]);
      setResults(null);
    },
    onCleared: () => {
      setLatents([]);
      setPaths([]);
      setResults(null);
    },
  });
  const { file, numericColumns } = dataset;

  // Path Builder States
  const [latents, setLatents] = useState(saved.latents || []); // Array of { id, name, x, y, indicators: [] }
  const [paths, setPaths] = useState(saved.paths || []); // Array of { from, to }
  const [selectedLatentId, setSelectedLatentId] = useState(null);
  const [canvasMode, setCanvasMode] = useState('select'); // 'select' or 'draw_path'
  const [pathSourceId, setPathSourceId] = useState(null);
  
  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Edit latent state
  const [editingLatentId, setEditingLatentId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Results & UI states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));

  // Fetch the dataset this model was fitted on, so the indicators can be bound and it can be run again
  const restoreSaved = async () => {
    setReopened(false);
    setResults(null);
    const loaded = await dataset.selectProjectDataset(initialAnalysis.dataset, initialAnalysis.projectName);
    if (loaded) {
      setSemType(saved.type || 'pls');
      setLatents(saved.latents || []);
      setPaths(saved.paths || []);
      setWizardStep(false);
    }
  };
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('paths'); // 'paths', 'loadings', 'reliability', 'validity', 'fit'
  const [viewerOpen, setViewerOpen] = useState(false);

  // Initialize canvas defaults on file load
  useEffect(() => {
    if (file) {
      // Create two default latent variables to get started
      setLatents([
        { id: 'L1', name: 'Predictor_Latent', x: 200, y: 240, indicators: [] },
        { id: 'L2', name: 'Outcome_Latent', x: 500, y: 240, indicators: [] }
      ]);
      setPaths([
        { from: 'L1', to: 'L2' }
      ]);
      setSelectedLatentId('L1');
      setResults(null);
      setError(null);
    }
  }, [file]);

  if (!isOpen) return null;

  // Wizard Handlers
  const handleSelectGoal = (goal) => {
    if (goal === 'prediction') {
      setSemType('pls');
    } else {
      setSemType('cb');
    }
    setWizardStep(false);
  };

  const handleSaveEditedData = async (editedFile) => {
    setResults(null);
    setError(null);
    if (editedFile) {
      await dataset.selectFile(editedFile);
    }
  };

  // Canvas Actions
  const handleAddLatent = () => {
    const newId = `L${latents.length + 1}_${Date.now().toString().slice(-4)}`;
    const newLatent = {
      id: newId,
      name: `Latent_${latents.length + 1}`,
      x: 350 + (Math.random() - 0.5) * 100,
      y: 200 + (Math.random() - 0.5) * 100,
      indicators: []
    };
    setLatents([...latents, newLatent]);
    setSelectedLatentId(newId);
    setResults(null);
  };

  const handleDeleteLatent = (nodeId) => {
    setLatents(latents.filter(l => l.id !== nodeId));
    setPaths(paths.filter(p => p.from !== nodeId && p.to !== nodeId));
    if (selectedLatentId === nodeId) {
      setSelectedLatentId(null);
    }
    setResults(null);
  };

  const handleNodeMouseDown = (e, nodeId) => {
    if (canvasMode === 'draw_path') {
      if (!pathSourceId) {
        setPathSourceId(nodeId);
      } else {
        if (pathSourceId !== nodeId) {
          // Check if path already exists
          const exists = paths.some(p => p.from === pathSourceId && p.to === nodeId);
          if (!exists) {
            setPaths([...paths, { from: pathSourceId, to: nodeId }]);
            setResults(null);
          }
        }
        setPathSourceId(null);
        setCanvasMode('select');
      }
    } else {
      setSelectedLatentId(nodeId);
      setDraggingNodeId(nodeId);
      const node = latents.find(l => l.id === nodeId);
      if (node && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left - node.x,
          y: e.clientY - rect.top - node.y
        });
      }
    }
    e.stopPropagation();
  };

  const handleCanvasMouseMove = (e) => {
    if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.max(50, Math.min(rect.width - 50, e.clientX - rect.left - dragOffset.x));
      const newY = Math.max(50, Math.min(rect.height - 50, e.clientY - rect.top - dragOffset.y));
      
      setLatents(latents.map(l => l.id === draggingNodeId ? { ...l, x: newX, y: newY } : l));
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleOpenEditNode = (node) => {
    setEditingLatentId(node.id);
    setEditingName(node.name);
  };

  const handleSaveNodeName = () => {
    setLatents(latents.map(l => l.id === editingLatentId ? { ...l, name: editingName } : l));
    setEditingLatentId(null);
    setResults(null);
  };

  const handleIndicatorToggle = (latentId, indicator) => {
    setLatents(latents.map(l => {
      if (l.id === latentId) {
        const exists = l.indicators.includes(indicator);
        return {
          ...l,
          indicators: exists 
            ? l.indicators.filter(ind => ind !== indicator)
            : [...l.indicators, indicator]
        };
      }
      // Make sure the same indicator is not bound to other latents
      return {
        ...l,
        indicators: l.indicators.filter(ind => ind !== indicator)
      };
    }));
    setResults(null);
  };

  const handleDeletePath = (from, to) => {
    setPaths(paths.filter(p => !(p.from === from && p.to === to)));
    setResults(null);
  };

  const runAnalysis = async () => {
    // Validations
    if (latents.length < 1) {
      setError("Please add at least one latent variable.");
      return;
    }
    
    // Check if all latents have indicators
    const unbound = latents.filter(l => l.indicators.length === 0);
    if (unbound.length > 0) {
      setError(`Latent variable(s) without indicators: ${unbound.map(u => u.name).join(', ')}. Please assign indicators.`);
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setResults(null);

    const spec = {
      latent_variables: latents.map(l => ({
        id: l.id,
        name: l.name,
        indicators: l.indicators
      })),
      paths: paths
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sem_type', semType);
    formData.append('specification', JSON.stringify(spec));

    try {
      const response = await apiFetch(`${API_URL}/analyze/sem`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'SEM path execution failed.');

      setResults(data);
      setActiveTab('paths');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Document downloads
  const handleDownloadReport = (format) => {
    if (!results) return;

    const fileName = `StatSathi_SEM_Report_${file.name.split('.')[0]}`;

    let report = `================================================================================\n`;
    report += `                     STAT SATHI STRUCTURAL EQUATION MODELING                    \n`;
    report += `================================================================================\n`;
    report += `Engine Used: ${results.engine}\n`;
    report += `Generated on: ${new Date().toLocaleString()}\n`;
    report += `Dataset File: ${file.name}\n`;
    report += `--------------------------------------------------------------------------------\n\n`;

    report += `1. INNER STRUCTURAL MODEL (PATH COEFFICIENTS)\n`;
    report += `--------------------------------------------------------------------------------\n`;
    report += `From Latent             To Latent               Path Coefficient        p-value         Significant\n`;
    report += `--------------------------------------------------------------------------------\n`;
    results.path_coefficients.forEach(p => {
      const fromName = latents.find(l => l.id === p.from)?.name || p.from;
      const toName = latents.find(l => l.id === p.to)?.name || p.to;
      const sig = p.significant ? 'Yes (p < 0.05)' : 'No';
      report += `${fromName.padEnd(24, ' ')}${toName.padEnd(24, ' ')}${p.coefficient.toFixed(4).padEnd(24, ' ')}${p.p_value.toFixed(6).padEnd(16, ' ')}${sig}\n`;
    });
    report += `--------------------------------------------------------------------------------\n\n`;

    if (results.r2_values) {
      report += `Endogenous R-Square Values:\n`;
      Object.keys(results.r2_values).forEach(lvId => {
        const name = latents.find(l => l.id === lvId)?.name || lvId;
        report += `  - ${name}: R² = ${results.r2_values[lvId].toFixed(4)}\n`;
      });
      report += `\n`;
    }

    report += `2. OUTER MEASUREMENT MODEL (LOADINGS & WEIGHTS)\n`;
    report += `--------------------------------------------------------------------------------\n`;
    report += `Latent Variable         Observed Indicator      Loading                 Weight\n`;
    report += `--------------------------------------------------------------------------------\n`;
    results.outer_loadings.forEach(l => {
      const name = latents.find(lv => lv.id === l.latent)?.name || l.latent;
      const wVal = results.outer_weights?.find(w => w.latent === l.latent && w.indicator === l.indicator)?.weight;
      report += `${name.padEnd(24, ' ')}${l.indicator.padEnd(24, ' ')}${l.loading.toFixed(4).padEnd(24, ' ')}${wVal === undefined ? 'n/a' : wVal.toFixed(4)}\n`;
    });
    report += `--------------------------------------------------------------------------------\n\n`;

    if (results.reliability_indices) {
      report += `3. MEASUREMENT CONSTRUCT RELIABILITY & VALIDITY\n`;
      report += `--------------------------------------------------------------------------------\n`;
      report += `Latent Variable         Cronbach's Alpha        Composite Reliability   AVE\n`;
      report += `--------------------------------------------------------------------------------\n`;
      results.reliability_indices.forEach(r => {
        report += `${r.latent_name.padEnd(24, ' ')}${r.cronbach_alpha.toFixed(4).padEnd(24, ' ')}${r.composite_reliability.toFixed(4).padEnd(24, ' ')}${r.ave.toFixed(4)}\n`;
      });
      report += `--------------------------------------------------------------------------------\n\n`;
    }

    if (format === 'txt') {
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
    const nameOf = (id) => latents.find(l => l.id === id)?.name || id;
    const fixed = (v, digits = 4) => (v === null || v === undefined ? 'N/A' : v.toFixed(digits));
    const isPls = (results.sem_type || semType) === 'pls';
    const sections = [{
      heading: 'Model',
      paragraphs: [
        `Estimation: ${results.engine}.`,
        ...(results.n_obs ? [`Observations used: ${results.n_obs}.`] : []),
        ...(results.bootstrap ? [`Bootstrap: ${results.bootstrap.samples} successful resamples (seed ${results.bootstrap.seed}); standard errors, t values and confidence intervals come from the bootstrap distribution.`] : [])
      ],
      bullets: results.notes || []
    }, {
      heading: '1. Structural Model (Path Coefficients)',
      tables: [{
        columns: ['From', 'To', 'Standardized β', 'Std. error', isPls ? 't' : 'z', 'p-value', ...(isPls ? ['95% CI'] : []), 'Significant'],
        rows: results.path_coefficients.map(p => [
          nameOf(p.from), nameOf(p.to), fixed(p.coefficient), fixed(p.std_error), fixed(isPls ? p.t_value : p.z_value, 3), formatP(p.p_value),
          ...(isPls ? [p.ci_lower !== undefined && p.ci_lower !== null ? `[${p.ci_lower.toFixed(3)}, ${p.ci_upper.toFixed(3)}]` : 'N/A'] : []),
          p.significant ? 'Yes' : 'No'
        ])
      }]
    }];

    if (results.r2_values && Object.keys(results.r2_values).length > 0) {
      const adjusted = results.adjusted_r2_values;
      sections.push({
        heading: '2. Explained Variance of Endogenous Constructs',
        tables: [{
          columns: ['Construct', 'R²', ...(adjusted ? ['Adjusted R²'] : [])],
          rows: Object.entries(results.r2_values).map(([id, r2]) => [nameOf(id), fixed(r2), ...(adjusted ? [fixed(adjusted[id])] : [])])
        }]
      });
    }

    sections.push({
      heading: '3. Measurement Model',
      tables: [{
        columns: ['Construct', 'Indicator', 'Standardized loading', ...(isPls ? ['Outer weight'] : ['p-value'])],
        rows: results.outer_loadings.map(l => [nameOf(l.latent), l.indicator, fixed(l.loading),
          isPls ? fixed(results.outer_weights?.find(w => w.latent === l.latent && w.indicator === l.indicator)?.weight) : formatP(l.p_value)]),
        note: 'Loadings of 0.70 or higher are generally considered adequate.'
      }, ...(results.reliability_indices ? [{
        columns: ['Construct', "Cronbach's α", 'Composite reliability', 'AVE'],
        rows: results.reliability_indices.map(r => [r.latent_name, fixed(r.cronbach_alpha), fixed(r.composite_reliability), fixed(r.ave)]),
        caption: 'Construct reliability and convergent validity',
        note: "Guides: Cronbach's α and composite reliability ≥ 0.70; AVE ≥ 0.50."
      }] : [])]
    });

    const validity = results.discriminant_validity;
    if (validity?.htmt?.length || validity?.fornell_larcker) {
      const tables = [];
      if (validity.htmt?.length) {
        tables.push({
          columns: ['Construct 1', 'Construct 2', 'HTMT', 'Discriminant validity'],
          rows: validity.htmt.map(h => [nameOf(h.latent1), nameOf(h.latent2), fixed(h.htmt), h.htmt < 0.85 ? 'Established (< 0.85)' : 'At risk (≥ 0.85)']),
          caption: 'Heterotrait-monotrait ratio (HTMT)'
        });
      }
      const fl = validity.fornell_larcker;
      if (fl) {
        tables.push({
          columns: ['Construct', ...fl.latents.map(nameOf)],
          rows: fl.latents.map((id, i) => [nameOf(id), ...fl.matrix[i].map((v, j) => (j <= i ? v.toFixed(3) : ''))]),
          caption: 'Fornell-Larcker criterion',
          note: fl.violations.length > 0
            ? `Diagonal = √AVE. Not established for: ${fl.violations.map(v => `${nameOf(v.latent1)} – ${nameOf(v.latent2)}`).join('; ')}.`
            : 'Diagonal = √AVE; every √AVE exceeds the correlations in its row and column.'
        });
      }
      sections.push({ heading: '4. Discriminant Validity', tables });
    }

    if (results.fit_indices) {
      const fit = results.fit_indices;
      sections.push({
        heading: '5. Model Fit',
        tables: [{
          columns: ['Index', 'Value', 'Guide'],
          rows: [
            ['χ²', fit.chi_square === null || fit.chi_square === undefined ? 'N/A' : `${fit.chi_square.toFixed(3)} (df = ${fit.df}, p = ${formatP(fit.p_value)})`, 'Non-significant p suggests exact fit; sensitive to sample size'],
            ['CFI', fixed(fit.cfi, 3), '≥ 0.90 acceptable, ≥ 0.95 good'],
            ['TLI', fixed(fit.tli, 3), '≥ 0.90 acceptable, ≥ 0.95 good'],
            ['RMSEA', fixed(fit.rmsea, 3), '≤ 0.08 acceptable, ≤ 0.05 good'],
            ['SRMR', fixed(fit.srmr, 3), '≤ 0.08 acceptable'],
            ['AIC', fixed(fit.aic, 2), 'Lower is better when comparing models'],
            ['BIC', fixed(fit.bic, 2), 'Lower is better when comparing models']
          ]
        }]
      });
    } else if (results.fit_error) {
      sections.push({ heading: '5. Model Fit', paragraphs: [results.fit_error] });
    }

    return {
      title: 'Structural Equation Modeling (SEM) Report',
      test_applied: isPls ? 'Partial least squares SEM (PLS-SEM)' : 'Covariance-based SEM (CB-SEM)',
      dataset_name: file?.name,
      filename: fileName,
      sections
    };
  };

  // Helper: calculate boundary coordinates for path arrow endings
  const getArrowCoords = (source, target) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const r = 38; // Radius of latent oval
    if (dist < r * 2) return { x1: source.x, y1: source.y, x2: target.x, y2: target.y };

    const x1 = source.x + (dx / dist) * r;
    const y1 = source.y + (dy / dist) * r;
    const x2 = target.x - (dx / dist) * r;
    const y2 = target.y - (dy / dist) * r;

    return { x1, y1, x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-brand-indigo">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold text-slate-800">
                SEM Structural Equation Modeling Workspace
              </h2>
              <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                Visually construct and analyze complex statistical path pathways using CB-SEM or PLS-SEM engines.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {onModeChange && <SemModeSwitch mode="canvas" onChange={onModeChange} />}
            <button data-dialog-close aria-label="Close"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Wizard step guardrail */}
        {wizardStep ? (
          <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center justify-center bg-slate-50/20">
            <div className="max-w-xl text-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo mx-auto shadow-xs">
                <HelpCircle className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-800">What is the Primary Objective of Your Research Model?</h3>
                <p className="font-sans text-xs text-slate-400 mt-2 leading-relaxed">
                  Select a research goal to align Stat Sathi with the correct statistical path modeling methodology (CB-SEM vs PLS-SEM) to ensure analytical validity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <button
                  onClick={() => handleSelectGoal('theory')}
                  className="p-5 bg-white border border-slate-200 hover:border-brand-indigo text-left rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <span className="font-display text-xs font-bold text-brand-indigo uppercase">Theory Testing & Confirmation</span>
                    <h4 className="font-display text-sm font-bold text-slate-800 mt-1">Covariance-Based SEM (CB-SEM)</h4>
                    <p className="font-sans text-[11px] text-slate-400 mt-2 leading-normal">
                      Best for confirming established theories, testing prior structural hypotheses, and validating model fit indices (CFI, TLI, RMSEA). Powered by lavaan.
                    </p>
                  </div>
                  <span className="mt-4 text-[10px] font-bold text-brand-indigo group-hover:translate-x-1 transition-transform inline-flex items-center space-x-1">
                    <span>Select CB-SEM</span> <span>&rarr;</span>
                  </span>
                </button>

                <button
                  onClick={() => handleSelectGoal('prediction')}
                  className="p-5 bg-white border border-slate-200 hover:border-brand-indigo text-left rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <span className="font-display text-xs font-bold text-brand-orange uppercase">Prediction & Exploratory Modeling</span>
                    <h4 className="font-display text-sm font-bold text-slate-800 mt-1">Partial Least Squares (PLS-SEM)</h4>
                    <p className="font-sans text-[11px] text-slate-400 mt-2 leading-normal">
                      Best for predictive modeling, exploratory analysis, environmental risk zoning, and handling complex indicators with non-normal data. Powered by seminr.
                    </p>
                  </div>
                  <span className="mt-4 text-[10px] font-bold text-brand-orange group-hover:translate-x-1 transition-transform inline-flex items-center space-x-1">
                    <span>Select PLS-SEM</span> <span>&rarr;</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Canvas & Workspace Body */
          <div className="flex-1 overflow-hidden flex flex-col bg-white">
            
            {/* Toolbar status */}
            <div className="border-b border-slate-100 px-6 py-2.5 bg-slate-50 flex items-center justify-between text-xs font-medium text-slate-500">
              <div className="flex items-center space-x-4">
                <span className="bg-indigo-50 border border-indigo-100 text-brand-indigo px-2.5 py-1 rounded-lg font-bold">
                  Engine: {semType === 'pls' ? 'PLS-SEM (Exploratory/Predictive)' : 'CB-SEM (Confirmatory/Fit)'}
                </span>
                {file && (
                  <span className="truncate max-w-[200px] text-slate-400">
                    Dataset: {file.name}
                  </span>
                )}
              </div>
              <div className="flex space-x-1.5">
                <button
                  onClick={() => setWizardStep(true)}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600"
                >
                  Change Methodology
                </button>
              </div>
            </div>

            {/* Main Workspace split */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Settings Sidebar */}
              <div className="w-[280px] border-r border-slate-100 flex flex-col bg-slate-50/30 overflow-y-auto p-4 space-y-4 shrink-0">
                {/* Dataset uploader if not uploaded */}
                {!file ? (
                  <DatasetPicker
                    dataset={dataset}
                    title="Select or drop a dataset"
                    hint="Its columns become the indicators you bind to each latent construct."
                  />
                ) : (
                  <div className="space-y-4">
                    <DatasetPicker dataset={dataset} onViewData={() => setViewerOpen(true)} />
                    
                    {/* Visual canvas controls card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-xs space-y-2.5">
                      <h4 className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canvas Tools</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleAddLatent}
                          className="p-2 bg-indigo-50 border border-indigo-100 text-brand-indigo rounded-xl flex items-center justify-center space-x-1 font-sans text-[10px] font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Latent</span>
                        </button>
                        <button
                          onClick={() => {
                            setCanvasMode(canvasMode === 'draw_path' ? 'select' : 'draw_path');
                            setPathSourceId(null);
                          }}
                          className={`p-2 border rounded-xl flex items-center justify-center space-x-1 font-sans text-[10px] font-bold transition-all cursor-pointer ${
                            canvasMode === 'draw_path'
                              ? 'bg-brand-orange border-brand-orange text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>Draw Path</span>
                        </button>
                      </div>
                      <button
                        onClick={runAnalysis}
                        disabled={loadingAnalysis}
                        className="w-full py-2.5 rounded-xl bg-brand-indigo text-white font-sans text-xs font-bold flex items-center justify-center space-x-1 shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Run SEM Analysis</span>
                      </button>
                    </div>

                    {/* Latent variable editor */}
                    {selectedLatentId && (
                      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-xs space-y-3">
                        {(() => {
                          const node = latents.find(l => l.id === selectedLatentId);
                          if (!node) return null;
                          const isEditing = editingLatentId === node.id;
                          return (
                            <>
                              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                <span className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Variable</span>
                                <button
                                  onClick={() => handleDeleteLatent(node.id)}
                                  className="text-red-500 hover:text-red-700 p-0.5 rounded-md hover:bg-red-50 transition-colors"
                                  title="Delete Node"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {isEditing ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1 font-sans text-xs outline-hidden focus:border-brand-indigo"
                                  />
                                  <button
                                    onClick={handleSaveNodeName}
                                    className="px-2.5 py-1 bg-brand-indigo text-white text-[9px] font-bold rounded-md"
                                  >
                                    Save Name
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-display text-xs font-bold text-slate-800">{node.name}</p>
                                  <button
                                    onClick={() => handleOpenEditNode(node)}
                                    className="text-[9px] text-brand-indigo font-bold underline mt-0.5"
                                  >
                                    Rename Variable
                                  </button>
                                </div>
                              )}

                              {/* Indicators binding list */}
                              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                                <label className="font-sans text-[10px] font-bold text-slate-500 block">Bind Indicators</label>
                                {numericColumns.length === 0 ? (
                                  <span className="text-[10px] text-slate-400">No numeric variables.</span>
                                ) : (
                                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                    {numericColumns.map(col => {
                                      const isBound = node.indicators.includes(col);
                                      const isBoundElsewhere = latents.some(l => l.id !== node.id && l.indicators.includes(col));
                                      return (
                                        <label key={col} className={`flex items-center space-x-2.5 cursor-pointer font-sans text-[10px] py-0.5 ${isBoundElsewhere ? 'opacity-40 pointer-events-none' : ''}`}>
                                          <input
                                            type="checkbox"
                                            checked={isBound}
                                            onChange={() => handleIndicatorToggle(node.id, col)}
                                            className="rounded-md border-slate-300 text-brand-indigo focus:ring-brand-indigo h-3.5 w-3.5"
                                          />
                                          <span className="truncate text-slate-700">{col}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Visual SVG Canvas Area */}
              <div className="flex-1 relative bg-slate-50/50 flex flex-col">
                {error && (
                  <div className="absolute top-4 left-4 right-4 z-10 bg-red-50 border border-red-100 p-3 rounded-xl flex items-start space-x-2 text-red-600 font-sans text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {loadingAnalysis && (
                  <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
                    <p className="font-display text-xs font-bold text-slate-500 mt-3">Fitting Structural Models...</p>
                  </div>
                )}

                {/* SVG Canvas Workspace */}
                <div className="flex-1 min-h-[360px] relative">
                  {!file ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <HelpCircle className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="font-display text-xs font-bold text-slate-400">Please upload your dataset file to open the builder canvas.</p>
                    </div>
                  ) : (
                    <svg
                      ref={canvasRef}
                      className="w-full h-full bg-white select-none cursor-crosshair"
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                    >
                      <defs>
                        {/* Define arrow marker for path relationships */}
                        <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4F46E5" />
                        </marker>
                      </defs>

                      {/* Render structural paths (arrows between ovals) */}
                      {paths.map((p, idx) => {
                        const source = latents.find(l => l.id === p.from);
                        const target = latents.find(l => l.id === p.to);
                        if (!source || !target) return null;

                        const coords = getArrowCoords(source, target);
                        const isDrawing = canvasMode === 'draw_path';

                        // Check if result exists
                        const resPath = results?.path_coefficients?.find(rc => rc.from === p.from && rc.to === p.to);

                        return (
                          <g key={`path-${idx}`}>
                            <line
                              x1={coords.x1}
                              y1={coords.y1}
                              x2={coords.x2}
                              y2={coords.y2}
                              stroke={resPath ? '#4F46E5' : '#94A3B8'}
                              strokeWidth={resPath ? 2.5 : 2}
                              markerEnd="url(#arrow)"
                              className="transition-all"
                            />
                            {/* Midpoint coefficient tag overlay */}
                            {resPath ? (
                              <g transform={`translate(${coords.mx}, ${coords.my})`}>
                                <rect
                                  x="-24"
                                  y="-9"
                                  width="48"
                                  height="18"
                                  rx="4"
                                  fill="#ffffff"
                                  stroke="#4F46E5"
                                  strokeWidth="1"
                                />
                                <text
                                  textAnchor="middle"
                                  y="3"
                                  className="font-sans text-[9px] font-bold text-indigo-700"
                                >
                                  {resPath.coefficient.toFixed(3)}{resPath.significant ? '*' : ''}
                                </text>
                              </g>
                            ) : (
                              // Small delete trigger in select mode
                              !isDrawing && (
                                <g
                                  transform={`translate(${coords.mx}, ${coords.my})`}
                                  className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeletePath(p.from, p.to)}
                                >
                                  <circle r="7" fill="#EF4444" />
                                  <text textAnchor="middle" y="2" fill="#ffffff" className="font-sans text-[8px] font-bold">&times;</text>
                                </g>
                              )
                            )}
                          </g>
                        );
                      })}

                      {/* Render indicator indicators (rectangles attached to ovals) */}
                      {latents.map(lv => {
                        return lv.indicators.map((ind, idx) => {
                          const N = lv.indicators.length;
                          const offsetIdx = idx - (N - 1) / 2;
                          // Draw rectangles on the left of latent
                          const indX = lv.x - 130;
                          const indY = lv.y + offsetIdx * 34;

                          // Loadings result
                          const resLoad = results?.outer_loadings?.find(l => l.latent === lv.id && l.indicator === ind);

                          return (
                            <g key={`ind-${lv.id}-${ind}`}>
                              {/* Connector line */}
                              <line
                                x1={indX + 60}
                                y1={indY + 11}
                                x2={lv.x}
                                y2={lv.y}
                                stroke="#CBD5E1"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                              />
                              {/* Indicator Box */}
                              <rect
                                x={indX}
                                y={indY}
                                width="70"
                                height="22"
                                rx="4"
                                fill="#ffffff"
                                stroke="#475569"
                                strokeWidth="1"
                              />
                              <text
                                x={indX + 35}
                                y={indY + 14}
                                textAnchor="middle"
                                className="font-sans text-[9px] text-slate-700 truncate"
                                style={{ width: '60px' }}
                              >
                                {ind.length > 11 ? ind.slice(0, 10) + '..' : ind}
                              </text>
                              {/* Loading overlay text */}
                              {resLoad && (
                                <text
                                  x={indX + 85}
                                  y={indY + 10}
                                  textAnchor="middle"
                                  className="font-sans text-[8px] font-bold text-slate-400"
                                >
                                  {resLoad.loading.toFixed(2)}
                                </text>
                              )}
                            </g>
                          );
                        });
                      })}

                      {/* Render latent variables (ovals) */}
                      {latents.map(lv => {
                        const isSelected = selectedLatentId === lv.id;
                        const r2Val = results?.r2_values?.[lv.id];
                        
                        return (
                          <g
                            key={lv.id}
                            transform={`translate(${lv.x}, ${lv.y})`}
                            className="cursor-grab active:cursor-grabbing"
                            onMouseDown={(e) => handleNodeMouseDown(e, lv.id)}
                          >
                            <ellipse
                              cx="0"
                              cy="0"
                              rx="38"
                              ry="28"
                              fill={isSelected ? '#EEF2FF' : '#ffffff'}
                              stroke={isSelected ? '#4F46E5' : '#475569'}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            {/* Latent variable name */}
                            <text
                              textAnchor="middle"
                              y={r2Val ? -4 : 4}
                              className="font-display text-[9px] font-bold text-slate-700"
                            >
                              {lv.name.length > 12 ? lv.name.slice(0, 10) + '..' : lv.name}
                            </text>
                            {/* R-square overlay indicator */}
                            {r2Val !== undefined && (
                              <text
                                textAnchor="middle"
                                y="10"
                                className="font-sans text-[8px] font-bold text-brand-indigo"
                              >
                                R² = {r2Val.toFixed(3)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>

                {reopened && (
                  <div className="border-t border-slate-100 bg-white px-4 py-3">
                    <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />
                  </div>
                )}

                {/* Tabular Analysis Results at bottom of canvas */}
                {results && (
                  <div className="h-[200px] border-t border-slate-100 bg-white flex flex-col">
                    <div className="flex border-b border-slate-100 px-4 bg-slate-50">
                      {[
                        { id: 'paths', label: 'Path Coefficients' },
                        { id: 'loadings', label: 'Outer Loadings' },
                        { id: 'reliability', label: 'Reliability & AVE' },
                        ...(results.discriminant_validity?.htmt?.length ? [{ id: 'validity', label: 'HTMT Discriminant' }] : []),
                        ...(results.fit_indices ? [{ id: 'fit', label: 'Model Fit Index' }] : [])
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTab(t.id)}
                          className={`py-2 px-4 font-display text-[11px] font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
                            activeTab === t.id ? 'border-brand-indigo text-brand-indigo' : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                      {results.fit_error && (
                        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-sans text-[11px] text-amber-800">
                          {results.fit_error}
                        </div>
                      )}
                      {results.notes && results.notes.length > 0 && (
                        <ul className="mb-2 list-disc space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 font-sans text-[11px] text-slate-600">
                          {results.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                        </ul>
                      )}
                      {/* Paths Tab */}
                      {activeTab === 'paths' && (
                        <table className="w-full border-collapse font-sans text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="pb-1.5">From Construct</th>
                              <th className="pb-1.5">To Construct</th>
                              <th className="pb-1.5 text-right">{results.sem_type === 'cb' ? 'Std. Estimate' : 'Path Coefficient'}</th>
                              <th className="pb-1.5 text-right">Std. Error</th>
                              <th className="pb-1.5 text-right">{results.sem_type === 'cb' ? 'z' : 't'}</th>
                              {results.sem_type === 'pls' && <th className="pb-1.5 text-right">95% CI</th>}
                              <th className="pb-1.5 text-right">p-value</th>
                              <th className="pb-1.5 text-center">Significant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.path_coefficients.map((p, idx) => {
                              const fromName = latents.find(l => l.id === p.from)?.name || p.from;
                              const toName = latents.find(l => l.id === p.to)?.name || p.to;
                              const fmt = (v, digits) => (v === null || v === undefined ? 'n/a' : v.toFixed(digits));
                              return (
                                <tr key={idx} className="border-b border-slate-50 text-slate-700">
                                  <td className="py-1 font-bold text-slate-800">{fromName}</td>
                                  <td className="py-1 font-bold text-slate-800">{toName}</td>
                                  <td className="py-1 text-right font-mono text-indigo-600 font-semibold">{fmt(p.coefficient, 4)}</td>
                                  <td className="py-1 text-right font-mono">{fmt(p.std_error, 4)}</td>
                                  <td className="py-1 text-right font-mono">{fmt(results.sem_type === 'cb' ? p.z_value : p.t_value, 3)}</td>
                                  {results.sem_type === 'pls' && (
                                    <td className="py-1 text-right font-mono">[{fmt(p.ci_lower, 3)}, {fmt(p.ci_upper, 3)}]</td>
                                  )}
                                  <td className="py-1 text-right font-mono">{p.p_value === null || p.p_value === undefined ? 'n/a' : p.p_value < 0.001 ? '< 0.001' : p.p_value.toFixed(4)}</td>
                                  <td className="py-1 text-center">
                                    <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${p.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                      {p.significant ? 'Significant' : 'No'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {/* Loadings Tab */}
                      {activeTab === 'loadings' && (
                        <table className="w-full border-collapse font-sans text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="pb-1.5">Construct</th>
                              <th className="pb-1.5">Indicator</th>
                              <th className="pb-1.5 text-right">Outer Loading</th>
                              <th className="pb-1.5 text-right">Weight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.outer_loadings.map((l, idx) => {
                              const name = latents.find(lv => lv.id === l.latent)?.name || l.latent;
                              const wVal = results.outer_weights?.find(w => w.latent === l.latent && w.indicator === l.indicator)?.weight;
                              return (
                                <tr key={idx} className="border-b border-slate-50 text-slate-700">
                                  <td className="py-1 font-bold text-slate-800">{name}</td>
                                  <td className="py-1 text-slate-600">{l.indicator}</td>
                                  <td className="py-1 text-right font-mono font-semibold">{l.loading.toFixed(4)}</td>
                                  <td className="py-1 text-right font-mono text-slate-400">{wVal === undefined ? 'n/a' : wVal.toFixed(4)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {/* Reliability Tab */}
                      {activeTab === 'reliability' && results.reliability_indices && (
                        <table className="w-full border-collapse font-sans text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="pb-1.5">Construct</th>
                              <th className="pb-1.5 text-right">Cronbach's Alpha</th>
                              <th className="pb-1.5 text-right">Composite Reliability</th>
                              <th className="pb-1.5 text-right">AVE (Var Extracted)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.reliability_indices.map((r, idx) => (
                              <tr key={idx} className="border-b border-slate-50 text-slate-700">
                                  <td className="py-1 font-bold text-slate-800">{r.latent_name}</td>
                                  <td className="py-1 text-right font-mono">{r.cronbach_alpha.toFixed(4)}</td>
                                  <td className="py-1 text-right font-mono">{r.composite_reliability.toFixed(4)}</td>
                                  <td className="py-1 text-right font-mono text-indigo-600 font-semibold">{r.ave.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Validity Tab */}
                      {activeTab === 'validity' && results.discriminant_validity && (
                        <table className="w-full border-collapse font-sans text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="pb-1.5">Construct 1</th>
                              <th className="pb-1.5">Construct 2</th>
                              <th className="pb-1.5 text-right">HTMT Ratio</th>
                              <th className="pb-1.5 text-center">Discriminant Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.discriminant_validity.htmt.map((h, idx) => {
                              const l1Name = latents.find(lv => lv.id === h.latent1)?.name || h.latent1;
                              const l2Name = latents.find(lv => lv.id === h.latent2)?.name || h.latent2;
                              const valid = h.htmt < 0.85; // Standard HTMT threshold is 0.85 (strict) or 0.90
                              return (
                                <tr key={idx} className="border-b border-slate-50 text-slate-700">
                                  <td className="py-1 font-bold text-slate-800">{l1Name}</td>
                                  <td className="py-1 font-bold text-slate-800">{l2Name}</td>
                                  <td className="py-1 text-right font-mono font-semibold">{h.htmt.toFixed(4)}</td>
                                  <td className="py-1 text-center">
                                    <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${valid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                      {valid ? 'Established (HTMT < 0.85)' : 'Validity Risk (>= 0.85)'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {/* Fornell-Larcker criterion: diagonal = sqrt(AVE), off-diagonal = construct correlations */}
                      {activeTab === 'validity' && results.discriminant_validity?.fornell_larcker && (() => {
                        const fl = results.discriminant_validity.fornell_larcker;
                        const nameOf = (id) => latents.find(lv => lv.id === id)?.name || id;
                        return (
                          <div className="mt-3">
                            <p className="mb-1 font-sans text-[11px] font-bold text-slate-600">
                              Fornell-Larcker Criterion <span className="font-normal text-slate-400">(diagonal = √AVE; each should exceed the correlations in its row and column)</span>
                            </p>
                            <table className="w-full border-collapse font-sans text-[11px] text-left">
                              <thead>
                                <tr className="border-b border-slate-100 text-slate-400 font-bold">
                                  <th className="pb-1.5">Construct</th>
                                  {fl.latents.map(id => <th key={id} className="pb-1.5 text-right">{nameOf(id)}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {fl.latents.map((rowId, i) => (
                                  <tr key={rowId} className="border-b border-slate-50 text-slate-700">
                                    <td className="py-1 font-bold text-slate-800">{nameOf(rowId)}</td>
                                    {fl.matrix[i].map((val, j) => {
                                      const violated = i !== j && fl.violations.some(v => (v.latent1 === rowId && v.latent2 === fl.latents[j]) || (v.latent2 === rowId && v.latent1 === fl.latents[j]));
                                      return (
                                        <td key={j} className={`py-1 text-right font-mono ${i === j ? 'font-bold text-indigo-600' : violated ? 'font-bold text-red-600' : ''}`}>
                                          {j <= i ? val.toFixed(3) : ''}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {fl.violations.length > 0 && (
                              <p className="mt-1 font-sans text-[10px] text-red-600">Red values: correlation is not below √AVE, so discriminant validity is not established for that pair.</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Fit Tab */}
                      {activeTab === 'fit' && results.fit_indices && (
                        <table className="w-full border-collapse font-sans text-[11px] text-left max-w-md">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="pb-1.5">Goodness-of-Fit Metric</th>
                              <th className="pb-1.5 text-right">Model Value</th>
                              <th className="pb-1.5 text-center">Reference Threshold</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-1 font-bold text-slate-700">Model Chi-Square (&chi;²)</td>
                              <td className="py-1 text-right font-mono">{results.fit_indices.chi_square.toFixed(3)} (df = {results.fit_indices.df})</td>
                              <td className="py-1 text-center text-slate-400">Lower is better</td>
                            </tr>
                            <tr>
                              <td className="py-1 font-bold text-slate-700">CFI (Comparative Fit Index)</td>
                              <td className="py-1 text-right font-mono font-bold text-indigo-600">{results.fit_indices.cfi.toFixed(4)}</td>
                              <td className="py-1 text-center text-slate-500 font-bold">&ge; 0.90 (Good)</td>
                            </tr>
                            <tr>
                              <td className="py-1 font-bold text-slate-700">TLI (Tucker-Lewis Index)</td>
                              <td className="py-1 text-right font-mono font-bold text-indigo-600">{results.fit_indices.tli.toFixed(4)}</td>
                              <td className="py-1 text-center text-slate-500 font-bold">&ge; 0.90 (Good)</td>
                            </tr>
                            <tr>
                              <td className="py-1 font-bold text-slate-700">RMSEA</td>
                              <td className="py-1 text-right font-mono font-bold text-emerald-600">{results.fit_indices.rmsea.toFixed(4)}</td>
                              <td className="py-1 text-center text-slate-500 font-bold">&le; 0.08 (Acceptable)</td>
                            </tr>
                            <tr>
                              <td className="py-1 font-bold text-slate-700">SRMR</td>
                              <td className="py-1 text-right font-mono font-bold text-emerald-600">{results.fit_indices.srmr.toFixed(4)}</td>
                              <td className="py-1 text-center text-slate-500 font-bold">&le; 0.08 (Acceptable)</td>
                            </tr>
                          </tbody>
                        </table>
                      )}

                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {results && !wizardStep ? (
            <div className="flex space-x-2">
              <div className="flex items-center space-x-1 bg-emerald-50/50 p-1 rounded-xl border border-emerald-100 mr-2">
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
              <SaveToProjectButton
                module="sem"
                report={() => buildDocxReport('report')}
                source={dataset.source}
                defaultTitle={`SEM (${semType === 'pls' ? 'PLS' : 'CB'}) – ${file?.name || 'dataset'}`}
                parameters={{ type: semType, latents, paths, dataset: file?.name }}
                result={results}
              />
              <button
                onClick={() => setViewerOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <Eye className="h-4 w-4 text-brand-orange" />
                <span>View Data</span>
              </button>
            </div>
          ) : (
            <div />
          )}
          <div className="flex space-x-2">
            {!wizardStep && file && (
              <button
                onClick={() => {
                  setWizardStep(true);
                  setResults(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Methodology Wizard
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

export default SemModal;
