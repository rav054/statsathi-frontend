import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Eye, Info, Layers, Play, Plus, Trash2, HelpCircle } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';

const SemModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();

  // Wizard state
  const [wizardStep, setWizardStep] = useState(true); // true = show wizard, false = show canvas workspace
  const [semType, setSemType] = useState(''); // 'pls' (Prediction) or 'cb' (Theory Testing)

  // Dataset states
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Path Builder States
  const [latents, setLatents] = useState([]); // Array of { id, name, x, y, indicators: [] }
  const [paths, setPaths] = useState([]); // Array of { from, to }
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
  const [results, setResults] = useState(null);
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

  // Uploader Drag & Drop
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
    setLatents([]);
    setPaths([]);
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
      const response = await fetch(`${API_URL}/analyze/sem`, {
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
    const title = `Stat Sathi SEM Report (${semType === 'pls' ? 'PLS-SEM' : 'CB-SEM'})`;

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
      const name = latents.find(l => l.id === l.latent)?.name || l.latent;
      const wVal = results.outer_weights?.find(w => w.latent === l.latent && w.indicator === l.indicator)?.weight || 0.0;
      report += `${name.padEnd(24, ' ')}${l.indicator.padEnd(24, ' ')}${l.loading.toFixed(4).padEnd(24, ' ')}${wVal.toFixed(4)}\n`;
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
      // Styled word tables
      const pathRows = results.path_coefficients.map(p => {
        const fromName = latents.find(l => l.id === p.from)?.name || p.from;
        const toName = latents.find(l => l.id === p.to)?.name || p.to;
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${fromName}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; color: #1E293B;">${toName}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #4F46E5;">${p.coefficient.toFixed(4)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${p.p_value.toFixed(6)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; font-weight: bold; color: ${p.significant ? '#10B981' : '#64748B'};">${p.significant ? 'Significant' : 'Not Significant'}</td>
          </tr>
        `;
      }).join('');

      const loadingRows = results.outer_loadings.map(l => {
        const name = latents.find(l => l.id === l.latent)?.name || l.latent;
        const wVal = results.outer_weights?.find(w => w.latent === l.latent && w.indicator === l.indicator)?.weight || 0.0;
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${name}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px;">${l.indicator}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${l.loading.toFixed(4)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${wVal.toFixed(4)}</td>
          </tr>
        `;
      }).join('');

      let reliabilityRows = '';
      if (results.reliability_indices) {
        reliabilityRows = results.reliability_indices.map(r => `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${r.latent_name}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.cronbach_alpha.toFixed(4)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.composite_reliability.toFixed(4)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #4F46E5;">${r.ave.toFixed(4)}</td>
          </tr>
        `).join('');
      }

      let fitRows = '';
      if (results.fit_indices) {
        const fit = results.fit_indices;
        fitRows = `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">Model Chi-Square (&chi;²)</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${fit.chi_square.toFixed(4)} (df = ${fit.df})</td>
          </tr>
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">CFI (Comparative Fit Index)</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: ${fit.cfi >= 0.90 ? '#10B981' : '#F59E0B'}">${fit.cfi.toFixed(4)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">TLI (Tucker-Lewis Index)</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: ${fit.tli >= 0.90 ? '#10B981' : '#F59E0B'}">${fit.tli.toFixed(4)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">RMSEA</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: ${fit.rmsea <= 0.08 ? '#10B981' : '#EF4444'}">${fit.rmsea.toFixed(4)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">SRMR</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: ${fit.srmr <= 0.08 ? '#10B981' : '#EF4444'}">${fit.srmr.toFixed(4)}</td>
          </tr>
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
            .meta-table { border-collapse: collapse; width: 95%; margin-left: auto; margin-right: auto; margin-bottom: 25px; }
            .meta-table td { padding: 8px; border: 1px solid #E2E8F0; }
            .meta-label { font-weight: bold; background-color: #F8FAFC; width: 30%; }
          </style>
        </head>
        <body>
          <h1>Structural Equation Modeling (SEM) Analysis Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table">
            <tr>
              <td class="meta-label">Analysis Engine</td>
              <td>${results.engine}</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file.name}</td>
            </tr>
            <tr>
              <td class="meta-label">Model Methodology</td>
              <td>${semType === 'pls' ? 'Partial Least Squares SEM (PLS-SEM)' : 'Covariance-Based SEM (CB-SEM)'}</td>
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

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">1. Inner Structural Model (Path Coefficients)</h2>
          <div align="center">
          <table align="center" style="border-collapse: collapse; width: 95%; font-family: Arial, sans-serif; font-size: 10pt; margin-left: auto; margin-right: auto; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">From Latent</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">To Latent</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Path Coefficient</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">p-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; font-weight: bold;">Result</th>
              </tr>
            </thead>
            <tbody>
              ${pathRows}
            </tbody>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">2. Outer Measurement Model (Loadings & Weights)</h2>
          <div align="center">
          <table align="center" style="border-collapse: collapse; width: 95%; font-family: Arial, sans-serif; font-size: 10pt; margin-left: auto; margin-right: auto; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Latent Variable</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Observed Indicator</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Loading</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Weight</th>
              </tr>
            </thead>
            <tbody>
              ${loadingRows}
            </tbody>
          </table>
          </div>

          ${reliabilityRows ? `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">3. Construct Reliability & Validity Summary</h2>
          <div align="center">
          <table align="center" style="border-collapse: collapse; width: 95%; font-family: Arial, sans-serif; font-size: 10pt; margin-left: auto; margin-right: auto; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Latent Construct</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Cronbach's Alpha</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Composite Reliability</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">AVE (Variance Extracted)</th>
              </tr>
            </thead>
            <tbody>
              ${reliabilityRows}
            </tbody>
          </table>
          </div>
          ` : ''}

          ${fitRows ? `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">4. Goodness-of-Fit Model Fit Indices</h2>
          <div align="center">
          <table align="center" style="border-collapse: collapse; width: 95%; font-family: Arial, sans-serif; font-size: 10pt; margin-left: auto; margin-right: auto; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Fit Index</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Model Value</th>
              </tr>
            </thead>
            <tbody>
              ${fitRows}
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
      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
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
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
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
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-8 px-4 text-center cursor-pointer transition-all ${
                      dragActive ? 'border-brand-indigo bg-indigo-50/10' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                    />
                    <Upload className="h-5 w-5 text-slate-400 mb-2" />
                    <span className="font-display text-xs font-bold text-slate-700">Upload dataset first</span>
                    <span className="text-[9px] text-slate-400 mt-1">Excel/CSV required to bind indicators.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    
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

                {/* Tabular Analysis Results at bottom of canvas */}
                {results && (
                  <div className="h-[200px] border-t border-slate-100 bg-white flex flex-col">
                    <div className="flex border-b border-slate-100 px-4 bg-slate-50">
                      {[
                        { id: 'paths', label: 'Path Coefficients' },
                        { id: 'loadings', label: 'Outer Loadings' },
                        { id: 'reliability', label: 'Reliability & AVE' },
                        ...(semType === 'pls' ? [{ id: 'validity', label: 'HTMT Discriminant' }] : []),
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
                      {/* Paths Tab */}
                      {activeTab === 'paths' && (
                        <table className="w-full border-collapse font-sans text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="pb-1.5">From Construct</th>
                              <th className="pb-1.5">To Construct</th>
                              <th className="pb-1.5 text-right">Estimate</th>
                              <th className="pb-1.5 text-right">p-value</th>
                              <th className="pb-1.5 text-center">Significant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.path_coefficients.map((p, idx) => {
                              const fromName = latents.find(l => l.id === p.from)?.name || p.from;
                              const toName = latents.find(l => l.id === p.to)?.name || p.to;
                              return (
                                <tr key={idx} className="border-b border-slate-50 text-slate-700">
                                  <td className="py-1 font-bold text-slate-800">{fromName}</td>
                                  <td className="py-1 font-bold text-slate-800">{toName}</td>
                                  <td className="py-1 text-right font-mono text-indigo-600 font-semibold">{p.coefficient.toFixed(4)}</td>
                                  <td className="py-1 text-right font-mono">{p.p_value.toFixed(6)}</td>
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
                              const wVal = results.outer_weights?.find(w => w.latent === l.latent && w.indicator === l.indicator)?.weight || 0.0;
                              return (
                                <tr key={idx} className="border-b border-slate-50 text-slate-700">
                                  <td className="py-1 font-bold text-slate-800">{name}</td>
                                  <td className="py-1 text-slate-600">{l.indicator}</td>
                                  <td className="py-1 text-right font-mono font-semibold">{l.loading.toFixed(4)}</td>
                                  <td className="py-1 text-right font-mono text-slate-400">{wVal.toFixed(4)}</td>
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
