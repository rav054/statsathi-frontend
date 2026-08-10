import React, { useState, useEffect, useRef } from 'react';
import { X, Network } from 'lucide-react';
import { API_URL } from '../context/AuthContext';

const API_BASE_URL = API_URL;

export default function SemDemoApp({ isOpen, onClose, initialFile = null }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (initialFile && (!file || file !== initialFile)) {
      setFile(initialFile);
      setFileName(initialFile.name);
      parseCSVHeaders(initialFile);
    }
  }, [initialFile]);
  
  // Builder Mode: 'interactive' or 'syntax'
  const [builderMode, setBuilderMode] = useState('interactive');

  // Interactive Variable Selection State
  const [outcomeVar, setOutcomeVar] = useState('');
  const [predictorVars, setPredictorVars] = useState([]);
  const [mediatorVar, setMediatorVar] = useState('');
  const [enableLatent, setEnableLatent] = useState(false);
  const [latentName, setLatentName] = useState('Latent1');
  const [latentIndicators, setLatentIndicators] = useState([]);

  // Lavaan Syntax State
  const [modelSyntax, setModelSyntax] = useState('Y ~ X1 + X2 + X3');
  const [templates, setTemplates] = useState({
    simple_regression: "Y ~ X1 + X2 + X3",
    mediation: "Y ~ X + M\nM ~ X",
    latent_factor: "Latent =~ Item1 + Item2 + Item3\nY ~ Latent + X1",
    full_sem: "Latent1 =~ A1 + A2 + A3\nLatent2 =~ B1 + B2\nY ~ Latent1 + Latent2 + Control"
  });
  const [selectedTemplate, setSelectedTemplate] = useState('simple_regression');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fitResult, setFitResult] = useState(null);
  
  // Diagram Customization State
  const [diagramTheme, setDiagramTheme] = useState('academic');
  const [diagramFont, setDiagramFont] = useState('Times New Roman');
  const [diagramFontSize, setDiagramFontSize] = useState(13);
  const [showPValues, setShowPValues] = useState(true);
  const [curvePaths, setCurvePaths] = useState(true);

  // Interactive Node & Legend Dragging State
  const [customPositions, setCustomPositions] = useState({});
  const [legendPos, setLegendPos] = useState({ x: 30, y: 30 });
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const diagramSvgRef = useRef(null);

  // Sort state for Path Coefficients table
  const [sortField, setSortField] = useState('p-value');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sem/templates`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTemplates(data);
      })
      .catch(() => {});
  }, []);

  const parseCSVHeaders = (fileObj) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r\n|\n/);
      if (lines.length > 0 && lines[0].trim()) {
        const headerCols = lines[0]
          .split(',')
          .map((c) => c.trim().replace(/^["']|["']$/g, ''))
          .filter((c) => c.length > 0);

        setColumns(headerCols);

        if (headerCols.length > 0) {
          const defaultY = headerCols[0];
          const defaultXs = headerCols.slice(1);
          setOutcomeVar(defaultY);
          setPredictorVars(defaultXs);
          if (defaultXs.length > 0) {
            setModelSyntax(`${defaultY} ~ ${defaultXs.join(' + ')}`);
          }
        }
      }
    };
    reader.readAsText(fileObj);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setFileName(f.name);
      parseCSVHeaders(f);
    }
  };

  const handleLoadDemoDataset = () => {
    const demoCols = ['Y', 'X1', 'X2', 'X3'];
    setColumns(demoCols);
    setOutcomeVar('Y');
    setPredictorVars(['X1', 'X2', 'X3']);
    setModelSyntax('Y ~ X1 + X2 + X3');

    let csvStr = 'Y,X1,X2,X3\n';
    for (let i = 0; i < 120; i++) {
      const x1 = (Math.random() * 4 + 8).toFixed(2);
      const x2 = (Math.random() * 2 + 4).toFixed(2);
      const x3 = (Math.random() * 1 + 1.5).toFixed(2);
      const y = (0.5 * x1 + 0.8 * x2 - 0.3 * x3 + (Math.random() - 0.5)).toFixed(2);
      csvStr += `${y},${x1},${x2},${x3}\n`;
    }

    const demoBlob = new Blob([csvStr], { type: 'text/csv' });
    const demoFile = new File([demoBlob], 'sample_sem_dataset.csv', { type: 'text/csv' });
    setFile(demoFile);
    setFileName('sample_sem_dataset.csv (120 observations)');
  };

  useEffect(() => {
    if (builderMode !== 'interactive') return;

    const lines = [];
    if (enableLatent && latentName.trim() && latentIndicators.length > 0) {
      lines.push(`${latentName.trim()} =~ ${latentIndicators.join(' + ')}`);
    }

    let currentPredictors = [...predictorVars];
    if (enableLatent && latentName.trim() && !currentPredictors.includes(latentName.trim())) {
      currentPredictors.push(latentName.trim());
    }

    if (outcomeVar && currentPredictors.length > 0) {
      lines.push(`${outcomeVar} ~ ${currentPredictors.join(' + ')}`);
    }

    if (mediatorVar && mediatorVar !== outcomeVar) {
      const medPredictors = predictorVars.filter((p) => p !== mediatorVar);
      if (medPredictors.length > 0) {
        lines.push(`${mediatorVar} ~ ${medPredictors.join(' + ')}`);
      }
    }

    if (lines.length > 0) {
      setModelSyntax(lines.join('\n'));
    }
  }, [outcomeVar, predictorVars, mediatorVar, enableLatent, latentName, latentIndicators, builderMode]);

  const togglePredictor = (col) => {
    if (predictorVars.includes(col)) {
      setPredictorVars(predictorVars.filter((p) => p !== col));
    } else {
      setPredictorVars([...predictorVars, col]);
    }
  };

  const toggleLatentIndicator = (col) => {
    if (latentIndicators.includes(col)) {
      setLatentIndicators(latentIndicators.filter((i) => i !== col));
    } else {
      setLatentIndicators([...latentIndicators, col]);
    }
  };

  const handleTemplateChange = (e) => {
    const key = e.target.value;
    setSelectedTemplate(key);
    if (templates[key]) {
      setModelSyntax(templates[key]);
    }
  };

  const handleFitModel = async () => {
    if (!file) {
      setError('Please select a dataset or click "Load Sample Dataset".');
      return;
    }
    if (!modelSyntax.trim()) {
      setError('Select at least one dependent and independent variable.');
      return;
    }

    setLoading(true);
    setError(null);
    setFitResult(null);
    setCustomPositions({});
    setLegendPos({ x: 30, y: 30 });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', modelSyntax);

      const fitRes = await fetch(`${API_BASE_URL}/api/sem/fit`, {
        method: 'POST',
        body: formData,
      });

      if (!fitRes.ok) {
        const errJson = await fitRes.json().catch(() => ({ detail: 'SEM analysis failed' }));
        throw new Error(errJson.detail || `Server error ${fitRes.status}`);
      }

      const fitData = await fitRes.json();
      setFitResult(fitData);
    } catch (err) {
      setError(err.message || 'An error occurred during SEM estimation.');
    } finally {
      setLoading(false);
    }
  };

  const getSigStars = (pVal) => {
    if (pVal === null || pVal === undefined) return '';
    if (pVal < 0.001) return '***';
    if (pVal < 0.01) return '**';
    if (pVal < 0.05) return '*';
    return 'ns';
  };

  const getFitEvaluation = (index, value) => {
    if (value === null || value === undefined) return { status: 'N/A', pass: null, threshold: '-' };
    const num = parseFloat(value);

    switch (index) {
      case 'CFI':
        return {
          threshold: '> 0.90',
          pass: num >= 0.90,
          label: num >= 0.90 ? 'Acceptable Fit' : 'Unacceptable Fit',
        };
      case 'RMSEA':
        return {
          threshold: '< 0.08',
          pass: num <= 0.08,
          label: num <= 0.08 ? 'Acceptable Fit' : 'Suboptimal Fit',
        };
      case 'SRMR':
        return {
          threshold: '< 0.08',
          pass: num <= 0.08,
          label: num <= 0.08 ? 'Acceptable Fit' : 'Suboptimal Fit',
        };
      case 'AIC':
        return { threshold: 'Relative measure', pass: true, label: 'Calculated' };
      case 'BIC':
        return { threshold: 'Relative measure', pass: true, label: 'Calculated' };
      default:
        return { threshold: '-', pass: true, label: 'Calculated' };
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedParameters = React.useMemo(() => {
    if (!fitResult || !fitResult.parameters) return [];
    return [...fitResult.parameters].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'path') {
        valA = `${a.rval} -> ${a.lval}`;
        valB = `${b.rval} -> ${b.lval}`;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [fitResult, sortField, sortDirection]);

  // Color Themes Definition (Background remains pure white #FFFFFF for all themes except Dark Obsidian)
  const themeStyles = {
    academic: {
      name: 'Academic Slate (APA Standard)',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#F8FAFC',
      obsBorder: '#334155',
      obsText: '#0F172A',
      latentBg: '#F1F5F9',
      latentBorder: '#475569',
      latentText: '#0F172A',
      posSigPath: '#059669',
      negSigPath: '#E11D48',
      nonSigPath: '#94A3B8',
      labelBg: '#FFFFFF',
      labelBorder: '#CBD5E1',
      labelText: '#0F172A',
    },
    pastel: {
      name: 'Pastel Rainbow (Multicolor)',
      bg: '#FFFFFF',
      isMulticolor: true,
      colStyles: {
        left: { bg: '#FFD1DC', border: '#B33951', text: '#5C1D2A' },
        middle: { bg: '#E2F0CB', border: '#4B7F52', text: '#214026' },
        right: { bg: '#FFDAC1', border: '#C75D2C', text: '#592209' },
        latent: { bg: '#C7CEEA', border: '#4A5376', text: '#1E2338' },
      },
      posSigPath: '#10B981',
      negSigPath: '#EF4444',
      nonSigPath: '#94A3B8',
      labelBg: '#FFFFFF',
      labelBorder: '#CBD5E1',
      labelText: '#1E293B',
    },
    macaron: {
      name: 'Gelato Soft Pastel',
      bg: '#FFFFFF',
      isMulticolor: true,
      colStyles: {
        left: { bg: '#B5EAD7', border: '#2C7A60', text: '#124031' },
        middle: { bg: '#FF9AA2', border: '#B33B44', text: '#54151A' },
        right: { bg: '#FFB7B2', border: '#C24D46', text: '#591C18' },
        latent: { bg: '#E2F0CB', border: '#5C802B', text: '#2B3D12' },
      },
      posSigPath: '#059669',
      negSigPath: '#D946EF',
      nonSigPath: '#94A3B8',
      labelBg: '#FFFFFF',
      labelBorder: '#CBD5E1',
      labelText: '#1E293B',
    },
    sakura: {
      name: 'Sakura Warm Pastel',
      bg: '#FFFFFF',
      isMulticolor: true,
      colStyles: {
        left: { bg: '#FDE2E4', border: '#C94A68', text: '#5E1B2C' },
        middle: { bg: '#FFCAD4', border: '#D44D6C', text: '#61192A' },
        right: { bg: '#B5E2FA', border: '#2A6F97', text: '#0A2E45' },
        latent: { bg: '#EDDCD2', border: '#8A5A44', text: '#40261A' },
      },
      posSigPath: '#059669',
      negSigPath: '#E01E5A',
      nonSigPath: '#94A3B8',
      labelBg: '#FFFFFF',
      labelBorder: '#CBD5E1',
      labelText: '#1E293B',
    },
    ocean: {
      name: 'Ocean Teal',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#F0FDFA',
      obsBorder: '#0D9488',
      obsText: '#134E4A',
      latentBg: '#CCFBF1',
      latentBorder: '#0F766E',
      latentText: '#134E4A',
      posSigPath: '#0284C7',
      negSigPath: '#E11D48',
      nonSigPath: '#94A3B8',
      labelBg: '#FFFFFF',
      labelBorder: '#99F6E4',
      labelText: '#134E4A',
    },
    forest: {
      name: 'Forest Green',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#F0FDF4',
      obsBorder: '#16A34A',
      obsText: '#14532D',
      latentBg: '#DCFCE7',
      latentBorder: '#15803D',
      latentText: '#14532D',
      posSigPath: '#15803D',
      negSigPath: '#DC2626',
      nonSigPath: '#9CA3AF',
      labelBg: '#FFFFFF',
      labelBorder: '#BBF7D0',
      labelText: '#14532D',
    },
    sunset: {
      name: 'Sunset Amber',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#FFFBEB',
      obsBorder: '#D97706',
      obsText: '#78350F',
      latentBg: '#FEF3C7',
      latentBorder: '#B45309',
      latentText: '#78350F',
      posSigPath: '#D97706',
      negSigPath: '#DC2626',
      nonSigPath: '#A8A29E',
      labelBg: '#FFFFFF',
      labelBorder: '#FDE68A',
      labelText: '#78350F',
    },
    ruby: {
      name: 'Crimson Red',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#FFF0F0',
      obsBorder: '#9B1C1C',
      obsText: '#771D1D',
      latentBg: '#FDE8E8',
      latentBorder: '#C81E1E',
      latentText: '#771D1D',
      posSigPath: '#047857',
      negSigPath: '#E02424',
      nonSigPath: '#9CA3AF',
      labelBg: '#FFFFFF',
      labelBorder: '#FBD5D5',
      labelText: '#771D1D',
    },
    indigo: {
      name: 'Royal Indigo',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#EEF2FF',
      obsBorder: '#4338CA',
      obsText: '#312E81',
      latentBg: '#E0E7FF',
      latentBorder: '#3730A3',
      latentText: '#312E81',
      posSigPath: '#4F46E5',
      negSigPath: '#E11D48',
      nonSigPath: '#94A3B8',
      labelBg: '#FFFFFF',
      labelBorder: '#C7D2FE',
      labelText: '#312E81',
    },
    monochrome: {
      name: 'Monochrome High-Contrast',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#FFFFFF',
      obsBorder: '#000000',
      obsText: '#000000',
      latentBg: '#F3F4F6',
      latentBorder: '#000000',
      latentText: '#000000',
      posSigPath: '#000000',
      negSigPath: '#000000',
      nonSigPath: '#9CA3AF',
      labelBg: '#FFFFFF',
      labelBorder: '#000000',
      labelText: '#000000',
    },
    sage: {
      name: 'Nature Sage',
      bg: '#FFFFFF',
      isMulticolor: false,
      obsBg: '#F4F7F4',
      obsBorder: '#52796F',
      obsText: '#2F3E46',
      latentBg: '#E8EFE9',
      latentBorder: '#354F52',
      latentText: '#2F3E46',
      posSigPath: '#2F3E46',
      negSigPath: '#C0392B',
      nonSigPath: '#95A5A6',
      labelBg: '#FFFFFF',
      labelBorder: '#CAD2C5',
      labelText: '#2F3E46',
    },
    dark: {
      name: 'Dark Obsidian',
      bg: '#0F172A',
      isMulticolor: false,
      obsBg: '#1E293B',
      obsBorder: '#38BDF8',
      obsText: '#F8FAFC',
      latentBg: '#334155',
      latentBorder: '#818CF8',
      latentText: '#F8FAFC',
      posSigPath: '#38BDF8',
      negSigPath: '#F43F5E',
      nonSigPath: '#64748B',
      labelBg: '#1E293B',
      labelBorder: '#475569',
      labelText: '#F8FAFC',
    },
  };

  const currentTheme = themeStyles[diagramTheme] || themeStyles.academic;

  // High-Resolution Export Handler
  const handleExportDiagram = (format, dpi = 300) => {
    const svgElement = diagramSvgRef.current;
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);

    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sem_path_diagram.svg`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const bbox = diagramLayout ? diagramLayout.bounds : { width: 1150, height: 650 };
    const scale = dpi / 96;
    const width = bbox.width * scale;
    const height = bbox.height * scale;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = currentTheme.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `sem_path_diagram_${dpi}dpi.png`;
      link.click();
    };
    img.src = url;
  };

  // Node & Legend Dragging Mouse Handlers
  const handleMouseDown = (targetId, e) => {
    e.preventDefault();
    if (!diagramSvgRef.current) return;
    const svgRect = diagramSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;

    if (targetId === '__LEGEND__') {
      setDraggingNode('__LEGEND__');
      setDragOffset({
        x: mouseX - legendPos.x,
        y: mouseY - legendPos.y,
      });
      return;
    }

    const currentPos = diagramLayout.positions[targetId];
    if (!currentPos) return;

    setDraggingNode(targetId);
    setDragOffset({
      x: mouseX - currentPos.x,
      y: mouseY - currentPos.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!draggingNode || !diagramSvgRef.current) return;
    const svgRect = diagramSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;

    if (draggingNode === '__LEGEND__') {
      const newX = Math.max(10, Math.min(diagramLayout.bounds.width - 290, mouseX - dragOffset.x));
      const newY = Math.max(10, Math.min(diagramLayout.bounds.height - 85, mouseY - dragOffset.y));
      setLegendPos({ x: newX, y: newY });
      return;
    }

    const newX = Math.max(80, Math.min(diagramLayout.bounds.width - 80, mouseX - dragOffset.x));
    const newY = Math.max(50, Math.min(diagramLayout.bounds.height - 50, mouseY - dragOffset.y));

    setCustomPositions((prev) => ({
      ...prev,
      [draggingNode]: { x: newX, y: newY },
    }));
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  const handleResetLayout = () => {
    setCustomPositions({});
    setLegendPos({ x: 30, y: 30 });
  };

  // Shape Boundary Intersections
  const calculateTargetIntersection = (toPos, ctrlX, ctrlY) => {
    const nodeX = toPos.x;
    const nodeY = toPos.y;
    const dx = nodeX - ctrlX;
    const dy = nodeY - ctrlY;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: nodeX, y: nodeY };

    if (toPos.isLatent) {
      const a = toPos.width / 2 + 12;
      const b = 34;
      const angle = Math.atan2(dy, dx);
      return {
        x: nodeX - a * Math.cos(angle),
        y: nodeY - b * Math.sin(angle),
      };
    } else {
      const halfW = toPos.width / 2 + 3;
      const halfH = toPos.height / 2 + 3;
      const scale = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
      return {
        x: nodeX - dx * scale,
        y: nodeY - dy * scale,
      };
    }
  };

  const calculateSourceIntersection = (fromPos, ctrlX, ctrlY) => {
    const nodeX = fromPos.x;
    const nodeY = fromPos.y;
    const dx = ctrlX - nodeX;
    const dy = ctrlY - nodeY;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: nodeX, y: nodeY };

    if (fromPos.isLatent) {
      const a = fromPos.width / 2 + 12;
      const b = 34;
      const angle = Math.atan2(dy, dx);
      return {
        x: nodeX + a * Math.cos(angle),
        y: nodeY + b * Math.sin(angle),
      };
    } else {
      const halfW = fromPos.width / 2 + 3;
      const halfH = fromPos.height / 2 + 3;
      const scale = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
      return {
        x: nodeX + dx * scale,
        y: nodeY + dy * scale,
      };
    }
  };

  // SEM Diagram Layout Engine
  const diagramLayout = React.useMemo(() => {
    if (!fitResult || !fitResult.parameters) return null;

    const params = fitResult.parameters.filter((p) => p.op === '~' || p.op === '=~');
    if (params.length === 0) return null;

    const nodeSet = new Set();
    const latentSet = new Set();
    const leftNodes = new Set();
    const rightNodes = new Set();

    params.forEach((p) => {
      if (p.op === '=~') {
        latentSet.add(p.lval);
        nodeSet.add(p.lval);
        nodeSet.add(p.rval);
      } else {
        nodeSet.add(p.lval);
        nodeSet.add(p.rval);
        leftNodes.add(p.rval);
        rightNodes.add(p.lval);
      }
    });

    const nodes = Array.from(nodeSet);

    const leftList = nodes.filter((n) => leftNodes.has(n) && !rightNodes.has(n));
    const rightList = nodes.filter((n) => rightNodes.has(n) && !leftNodes.has(n));
    const middleList = nodes.filter((n) => !leftList.includes(n) && !rightList.includes(n));

    if (leftList.length === 0 && middleList.length === 0) {
      nodes.forEach((n, idx) => {
        if (idx < Math.ceil(nodes.length / 2)) leftList.push(n);
        else rightList.push(n);
      });
    }

    const maxColNodes = Math.max(leftList.length, middleList.length, rightList.length, 1);
    const canvasWidth = 1150;
    const canvasHeight = Math.max(620, maxColNodes * 115 + 140);

    const colX = { left: 160, middle: 575, right: 980 };

    const positions = {};
    const assignYCoords = (list, xPos, colGroup) => {
      const step = Math.min((canvasHeight - 160) / (list.length + 1), 125);
      const startY = canvasHeight / 2 - ((list.length - 1) * step) / 2;
      list.forEach((name, i) => {
        if (customPositions[name]) {
          positions[name] = {
            ...customPositions[name],
            width: Math.max(110, Math.max(name.length, 6) * 11),
            height: 48,
            isLatent: latentSet.has(name),
            colGroup,
          };
        } else {
          const charLen = Math.max(name.length, 6);
          const nodeW = Math.max(110, charLen * 11);
          positions[name] = {
            x: xPos,
            y: startY + i * step,
            width: nodeW,
            height: 48,
            isLatent: latentSet.has(name),
            colGroup,
          };
        }
      });
    };

    assignYCoords(leftList, colX.left, 'left');
    assignYCoords(middleList, colX.middle, 'middle');
    assignYCoords(rightList, colX.right, 'right');

    const targetGroups = {};
    params.forEach((p) => {
      if (!targetGroups[p.lval]) targetGroups[p.lval] = [];
      targetGroups[p.lval].push(p);
    });

    const computedPaths = [];

    Object.keys(targetGroups).forEach((targetName) => {
      const incoming = targetGroups[targetName];
      incoming.sort((a, b) => {
        const yA = positions[a.rval] ? positions[a.rval].y : 0;
        const yB = positions[b.rval] ? positions[b.rval].y : 0;
        return yA - yB;
      });

      const totalInc = incoming.length;

      incoming.forEach((p, idx) => {
        const fromPos = positions[p.rval];
        const toPos = positions[p.lval];
        if (!fromPos || !toPos) return;

        const t = totalInc === 1 ? 0.5 : 0.32 + 0.36 * (idx / (totalInc - 1));
        const curveOffset = curvePaths ? (idx - (totalInc - 1) / 2) * 55 : 0;

        const rawMidX = (fromPos.x + toPos.x) / 2;
        const rawMidY = (fromPos.y + toPos.y) / 2;

        const controlX = rawMidX;
        const controlY = rawMidY + curveOffset;

        const startPt = calculateSourceIntersection(fromPos, controlX, controlY);
        const endPt = calculateTargetIntersection(toPos, controlX, controlY);

        const px = (1 - t) * (1 - t) * startPt.x + 2 * (1 - t) * t * controlX + t * t * endPt.x;
        const py = (1 - t) * (1 - t) * startPt.y + 2 * (1 - t) * t * controlY + t * t * endPt.y;

        const dx = endPt.x - startPt.x;
        const dy = endPt.y - startPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;

        const perpDistance = (idx % 2 === 0 ? -26 : 26) * (1 + Math.floor(idx / 2) * 0.4);

        const labelX = px + nx * perpDistance;
        const labelY = py + ny * perpDistance;

        const isSig = p['p-value'] < 0.05;
        const isNegative = p.Estimate !== null && p.Estimate < 0;

        let strokeColor = currentTheme.nonSigPath;
        if (isSig) {
          strokeColor = isNegative ? currentTheme.negSigPath : currentTheme.posSigPath;
        }

        const stars = getSigStars(p['p-value']);
        const estText = p.Estimate !== null ? p.Estimate.toFixed(2) : '0.00';
        const pText = showPValues && p['p-value'] !== null ? ` (p=${p['p-value'] < 0.001 ? '<.001' : p['p-value'].toFixed(3)})` : '';
        const labelStr = `β = ${estText}${stars}${pText}`;

        computedPaths.push({
          param: p,
          startX: startPt.x,
          startY: startPt.y,
          endX: endPt.x,
          endY: endPt.y,
          controlX,
          controlY,
          labelX,
          labelY,
          labelStr,
          isSig,
          isNegative,
          strokeColor,
        });
      });
    });

    return {
      nodes,
      positions,
      paths: computedPaths,
      bounds: { width: canvasWidth, height: canvasHeight },
    };
  }, [fitResult, showPValues, curvePaths, customPositions, currentTheme]);

  const mainContent = (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', width: '100%' }}>

      {/* STEP 1: Data Input & Variable Selection */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px', marginBottom: '28px' }}>
        
        {/* Dataset Header & Quick Loader */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
            1. Data Input and Variable Selection
          </h2>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleLoadDemoDataset}
              style={{
                background: '#F3F4F6',
                color: '#374151',
                border: '1px solid #D1D5DB',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Load Sample Dataset
            </button>

            <label
              htmlFor="sem-file-upload"
              style={{
                background: '#2563EB',
                color: '#FFFFFF',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {fileName ? 'Change CSV' : 'Select CSV File'}
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="sem-file-upload"
            />
          </div>
        </div>

        {fileName && (
          <div style={{ marginBottom: '16px', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', color: '#065F46', fontWeight: '500' }}>
            Active Dataset: <strong>{fileName}</strong> ({columns.length} columns detected: {columns.join(', ')})
          </div>
        )}

        {/* Builder Mode Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '20px' }}>
          <button
            onClick={() => setBuilderMode('interactive')}
            style={{
              padding: '10px 20px',
              fontWeight: '600',
              fontSize: '14px',
              border: 'none',
              background: 'transparent',
              borderBottom: builderMode === 'interactive' ? '3px solid #2563EB' : '3px solid transparent',
              color: builderMode === 'interactive' ? '#2563EB' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            Interactive Variable Selector
          </button>
          <button
            onClick={() => setBuilderMode('syntax')}
            style={{
              padding: '10px 20px',
              fontWeight: '600',
              fontSize: '14px',
              border: 'none',
              background: 'transparent',
              borderBottom: builderMode === 'syntax' ? '3px solid #2563EB' : '3px solid transparent',
              color: builderMode === 'syntax' ? '#2563EB' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            Direct Lavaan Syntax Editor
          </button>
        </div>

        {/* MODE 1: INTERACTIVE VARIABLE SELECTOR */}
        {builderMode === 'interactive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {columns.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#F9FAFB', borderRadius: '8px', border: '1px dashed #D1D5DB', color: '#6B7280' }}>
                Select a CSV file or click <strong>"Load Sample Dataset"</strong> to populate variables.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Column 1: Outcome & Predictors */}
                <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', marginTop: 0, marginBottom: '12px' }}>
                    Direct Structural Paths
                  </h3>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', color: '#374151', fontSize: '13px', marginBottom: '6px' }}>
                      Dependent / Outcome Variable (Y)
                    </label>
                    <select
                      value={outcomeVar}
                      onChange={(e) => setOutcomeVar(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', background: '#FFFFFF' }}
                    >
                      <option value="">-- Select Outcome Variable --</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: '600', color: '#374151', fontSize: '13px', marginBottom: '6px' }}>
                      Independent / Predictor Variables (X)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {columns
                        .filter((col) => col !== outcomeVar)
                        .map((col) => {
                          const isSelected = predictorVars.includes(col);
                          return (
                            <button
                              key={col}
                              onClick={() => togglePredictor(col)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '16px',
                                fontSize: '13px',
                                fontWeight: '600',
                                border: '1px solid',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isSelected ? '#DBEAFE' : '#FFFFFF',
                                color: isSelected ? '#1E40AF' : '#4B5563',
                                borderColor: isSelected ? '#93C5FD' : '#D1D5DB',
                              }}
                            >
                              {col}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Column 2: Mediators & Latent Factor Settings */}
                <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', marginTop: 0, marginBottom: '12px' }}>
                    Mediation & Latent Factors
                  </h3>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', color: '#374151', fontSize: '13px', marginBottom: '6px' }}>
                      Optional Mediator Variable (M)
                    </label>
                    <select
                      value={mediatorVar}
                      onChange={(e) => setMediatorVar(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', background: '#FFFFFF' }}
                    >
                      <option value="">-- None (No Mediation) --</option>
                      {columns
                        .filter((col) => col !== outcomeVar)
                        .map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={enableLatent}
                        onChange={(e) => setEnableLatent(e.target.checked)}
                      />
                      Include Latent Variable
                    </label>
                  </div>

                  {enableLatent && (
                    <div style={{ padding: '12px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '4px' }}>
                          Latent Construct Name
                        </label>
                        <input
                          type="text"
                          value={latentName}
                          onChange={(e) => setLatentName(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #D1D5DB', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '4px' }}>
                          Indicator Items (=~)
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {columns.map((col) => {
                            const isInd = latentIndicators.includes(col);
                            return (
                              <button
                                key={col}
                                onClick={() => toggleLatentIndicator(col)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  background: isInd ? '#FEF3C7' : '#F3F4F6',
                                  color: isInd ? '#92400E' : '#4B5563',
                                  borderColor: isInd ? '#FDE68A' : '#E5E7EB',
                                }}
                              >
                                {col}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* MODE 2: DIRECT SYNTAX EDITOR */}
        {builderMode === 'syntax' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                Lavaan Model Syntax Editor
              </label>
              <div>
                <span style={{ fontSize: '13px', color: '#6B7280', marginRight: '8px' }}>Template:</span>
                <select
                  value={selectedTemplate}
                  onChange={handleTemplateChange}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', background: '#FFFFFF' }}
                >
                  <option value="simple_regression">Simple Regression (Y ~ X1 + X2)</option>
                  <option value="mediation">Mediation Model (M ~ X; Y ~ M + X)</option>
                  <option value="latent_factor">Latent Factor (Factor =~ X1 + X2 + X3)</option>
                  <option value="full_sem">Full SEM Model</option>
                </select>
              </div>
            </div>

            <textarea
              rows={5}
              value={modelSyntax}
              onChange={(e) => setModelSyntax(e.target.value)}
              placeholder="e.g., Y ~ X1 + X2 + X3"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontFamily: 'monospace',
                fontSize: '13px',
                background: '#F9FAFB',
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {/* Model Syntax Bar */}
        <div style={{ marginTop: '20px', background: '#1E293B', padding: '12px 16px', borderRadius: '8px', color: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', tracking: 'wider', color: '#94A3B8', fontWeight: '700', marginRight: '10px' }}>
              Model Syntax:
            </span>
            <code style={{ fontFamily: 'monospace', fontSize: '14px', color: '#38BDF8' }}>
              {modelSyntax || '(No variables selected)'}
            </code>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {error && (
              <span style={{ color: '#FCA5A5', fontSize: '13px', fontWeight: '500' }}>
                {error}
              </span>
            )}
            <button
              onClick={handleFitModel}
              disabled={loading}
              style={{
                background: loading ? '#64748B' : '#0EA5E9',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              {loading ? 'Estimating Model...' : 'Run SEM Analysis'}
            </button>
          </div>
        </div>

      </div>

      {/* Results Container (3 Mandatory Panels) */}
      {fitResult && fitResult.success && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* PANEL 1: MODEL FIT PANEL */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
                1. Model Fit Indices
              </h3>
              <span style={{ fontSize: '13px', background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }}>
                N = {fitResult.n_obs} Observations
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>Index</th>
                  <th style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>Value</th>
                  <th style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>Threshold</th>
                  <th style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {['CFI', 'RMSEA', 'SRMR', 'AIC', 'BIC'].map((idxKey) => {
                  const val = fitResult.fit_indices ? fitResult.fit_indices[idxKey] : null;
                  const evalRes = getFitEvaluation(idxKey, val);
                  return (
                    <tr key={idxKey} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1F2937' }}>{idxKey}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '14px' }}>
                        {val !== null && val !== undefined ? val : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6B7280' }}>{evalRes.threshold}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {evalRes.pass === null ? (
                          <span style={{ color: '#9CA3AF' }}>N/A</span>
                        ) : evalRes.pass ? (
                          <span style={{ background: '#DEF7EC', color: '#03543F', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                            {evalRes.label}
                          </span>
                        ) : (
                          <span style={{ background: '#FDE8E8', color: '#9B1C1C', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                            {evalRes.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PANEL 2: PATH COEFFICIENTS PANEL */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginTop: 0, marginBottom: '16px' }}>
              2. Path Coefficients
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB', cursor: 'pointer' }}>
                    <th onClick={() => handleSort('path')} style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>
                      Predictor (rval) → Outcome (lval) {sortField === 'path' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('Estimate')} style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>
                      Estimate {sortField === 'Estimate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('Std.Err')} style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>
                      Std.Error {sortField === 'Std.Err' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('p-value')} style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>
                      p-value {sortField === 'p-value' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '10px 14px', color: '#374151', fontWeight: '600' }}>
                      Significance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParameters.map((param, index) => {
                    const isSig = param['p-value'] < 0.05;
                    const stars = getSigStars(param['p-value']);
                    return (
                      <tr
                        key={index}
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          background: isSig ? '#E6F4EA' : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1F2937' }}>
                          {param.rval} <span style={{ color: '#6B7280' }}>{param.op || '→'}</span> {param.lval}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '500' }}>
                          {param.Estimate !== null ? param.Estimate.toFixed(4) : 'N/A'}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#4B5563' }}>
                          {param['Std.Err'] !== null ? param['Std.Err'].toFixed(4) : 'N/A'}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: isSig ? '700' : '400', color: isSig ? '#047857' : '#1F2937' }}>
                          {param['p-value'] !== null ? (param['p-value'] < 0.001 ? '< 0.001' : param['p-value'].toFixed(4)) : 'N/A'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: '#059669' }}>
                          {stars}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#6B7280' }}>
              * p &lt; 0.05, ** p &lt; 0.01, *** p &lt; 0.001. Highlighted rows indicate significant paths (p &lt; 0.05).
            </div>
          </div>

          {/* PANEL 3: PATH DIAGRAM PANEL */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
            
            {/* Header & DPI Exporters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
                  3. Structural Path Diagram
                </h3>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  Observed variables in rectangles, Latent variables in ovals. Drag nodes or legend box to reposition layout.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleResetLayout}
                  style={{
                    background: '#F3F4F6',
                    color: '#4B5563',
                    border: '1px solid #D1D5DB',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Reset Layout
                </button>
                <button
                  onClick={() => handleExportDiagram('svg')}
                  style={{
                    background: '#F3F4F6',
                    color: '#374151',
                    border: '1px solid #D1D5DB',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Export SVG
                </button>
                <button
                  onClick={() => handleExportDiagram('png', 300)}
                  style={{
                    background: '#0D9488',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Download 300 DPI PNG
                </button>
                <button
                  onClick={() => handleExportDiagram('png', 600)}
                  style={{
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Download 600 DPI PNG
                </button>
              </div>
            </div>

            {/* Customization Toolbar */}
            <div style={{ background: '#F8FAFC', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' }}>
              
              {/* Theme Selector */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Color Theme
                </label>
                <select
                  value={diagramTheme}
                  onChange={(e) => setDiagramTheme(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFFFFF' }}
                >
                  {Object.keys(themeStyles).map((themeKey) => (
                    <option key={themeKey} value={themeKey}>
                      {themeStyles[themeKey].name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Family Selector */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Font Family
                </label>
                <select
                  value={diagramFont}
                  onChange={(e) => setDiagramFont(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFFFFF', fontFamily: diagramFont }}
                >
                  <option value="Times New Roman">Times New Roman (APA)</option>
                  <option value="Inter">Inter (Modern)</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>

              {/* Font Size Selector */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Font Size ({diagramFontSize}px)
                </label>
                <select
                  value={diagramFontSize}
                  onChange={(e) => setDiagramFontSize(Number(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFFFFF' }}
                >
                  <option value={11}>Compact (11px)</option>
                  <option value={13}>Standard (13px)</option>
                  <option value={15}>Large (15px)</option>
                  <option value={17}>Extra Large (17px)</option>
                </select>
              </div>

              {/* Path Style Toggle */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={curvePaths}
                    onChange={(e) => setCurvePaths(e.target.checked)}
                  />
                  Curved Paths (Fan Out)
                </label>
              </div>

              {/* Toggle p-values display */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showPValues}
                    onChange={(e) => setShowPValues(e.target.checked)}
                  />
                  Show p-values on path arrows
                </label>
              </div>
            </div>

            {/* Visual SVG Path Diagram Container */}
            {diagramLayout ? (
              <div
                style={{
                  overflowX: 'auto',
                  padding: '24px',
                  background: currentTheme.bg,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: draggingNode ? 'grabbing' : 'default',
                  userSelect: 'none',
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <svg
                  ref={diagramSvgRef}
                  width={diagramLayout.bounds.width}
                  height={diagramLayout.bounds.height}
                  viewBox={`0 0 ${diagramLayout.bounds.width} ${diagramLayout.bounds.height}`}
                  style={{ fontFamily: diagramFont, background: currentTheme.bg }}
                >
                  <defs>
                    <marker
                      id="arrow-pos"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={currentTheme.posSigPath} />
                    </marker>

                    <marker
                      id="arrow-neg"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={currentTheme.negSigPath} />
                    </marker>

                    <marker
                      id="arrow-nonsig"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={currentTheme.nonSigPath} />
                    </marker>
                  </defs>

                  {/* Movable Movable Diagram Legend */}
                  <g
                    transform={`translate(${legendPos.x}, ${legendPos.y})`}
                    onMouseDown={(e) => handleMouseDown('__LEGEND__', e)}
                    style={{ cursor: draggingNode === '__LEGEND__' ? 'grabbing' : 'grab' }}
                  >
                    <rect x="0" y="0" width="300" height="96" rx="6" fill={currentTheme.labelBg} stroke={currentTheme.labelBorder} strokeWidth="1" />
                    <text x="12" y="18" fontSize="12" fontWeight="bold" fill={currentTheme.labelText}>
                      SEM Path Diagram Legend:
                    </text>
                    
                    <line x1="12" y1="36" x2="45" y2="36" stroke={currentTheme.posSigPath} strokeWidth="2.5" />
                    <text x="52" y="40" fontSize="11" fill={currentTheme.labelText}>
                      Solid Line: Positive Sig (p &lt; 0.05)
                    </text>

                    <line x1="12" y1="54" x2="45" y2="54" stroke={currentTheme.negSigPath} strokeWidth="2.5" />
                    <text x="52" y="58" fontSize="11" fill={currentTheme.labelText}>
                      Solid Line: Negative Sig (p &lt; 0.05)
                    </text>

                    <line x1="12" y1="72" x2="45" y2="72" stroke={currentTheme.nonSigPath} strokeWidth="1.5" strokeDasharray="4 3" />
                    <text x="52" y="76" fontSize="11" fill={currentTheme.labelText}>
                      Dotted Line: Non-Significant (p &ge; 0.05)
                    </text>
                  </g>

                  {/* Render Curved Edges */}
                  {diagramLayout.paths.map((p, idx) => {
                    const strokeWidth = p.isSig ? 2.5 : 1.5;
                    const markerId = !p.isSig ? 'url(#arrow-nonsig)' : p.isNegative ? 'url(#arrow-neg)' : 'url(#arrow-pos)';

                    const d = `M ${p.startX} ${p.startY} Q ${p.controlX} ${p.controlY} ${p.endX} ${p.endY}`;

                    return (
                      <g key={idx}>
                        <path
                          d={d}
                          fill="none"
                          stroke={p.strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={p.isSig ? 'none' : '6 4'}
                          markerEnd={markerId}
                        />

                        {/* Parameter Label Pill */}
                        <g transform={`translate(${p.labelX}, ${p.labelY})`}>
                          <rect
                            x={-(p.labelStr.length * (diagramFontSize * 0.3) + 8)}
                            y={-diagramFontSize}
                            width={p.labelStr.length * (diagramFontSize * 0.6) + 16}
                            height={diagramFontSize + 8}
                            rx="5"
                            ry="5"
                            fill={currentTheme.labelBg}
                            stroke={p.strokeColor}
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fontSize={diagramFontSize - 1}
                            fontWeight={p.isSig ? 'bold' : 'normal'}
                            fill={p.isSig && p.isNegative ? currentTheme.negSigPath : currentTheme.labelText}
                          >
                            {p.labelStr}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* Render Nodes */}
                  {diagramLayout.nodes.map((nodeName) => {
                    const pos = diagramLayout.positions[nodeName];
                    if (!pos) return null;

                    let nodeColors = {
                      bg: pos.isLatent ? currentTheme.latentBg : currentTheme.obsBg,
                      border: pos.isLatent ? currentTheme.latentBorder : currentTheme.obsBorder,
                      text: pos.isLatent ? currentTheme.latentText : currentTheme.obsText,
                    };

                    if (currentTheme.isMulticolor && currentTheme.colStyles) {
                      if (pos.isLatent) {
                        nodeColors = currentTheme.colStyles.latent;
                      } else if (currentTheme.colStyles[pos.colGroup]) {
                        nodeColors = currentTheme.colStyles[pos.colGroup];
                      }
                    }

                    const isBeingDragged = draggingNode === nodeName;

                    return (
                      <g
                        key={nodeName}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onMouseDown={(e) => handleMouseDown(nodeName, e)}
                        style={{ cursor: isBeingDragged ? 'grabbing' : 'grab' }}
                      >
                        {pos.isLatent ? (
                          <ellipse
                            rx={pos.width / 2 + 12}
                            ry="34"
                            fill={nodeColors.bg}
                            stroke={nodeColors.border}
                            strokeWidth="2.5"
                          />
                        ) : (
                          <rect
                            x={-pos.width / 2}
                            y={-pos.height / 2}
                            width={pos.width}
                            height={pos.height}
                            rx="6"
                            ry="6"
                            fill={nodeColors.bg}
                            stroke={nodeColors.border}
                            strokeWidth="2.2"
                          />
                        )}

                        <text
                          textAnchor="middle"
                          dy="5"
                          fontSize={diagramFontSize + (pos.isLatent ? 1 : 0)}
                          fontWeight="bold"
                          fill={nodeColors.text}
                          pointerEvents="none"
                        >
                          {nodeName}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div style={{ padding: '20px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FCD34D', color: '#92400E' }}>
                Fit an SEM model to render the structural path diagram.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl overflow-y-auto">
        {/* StatSathi Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-800">
                Structural Equation Modeling (SEM)
              </h2>
              <p className="font-sans text-xs font-medium text-slate-400">
                Fit structural path models, latent constructs, mediation models, fit indices (CFI, RMSEA, SRMR), and publication diagrams.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {mainContent}
      </div>
    </div>
  );
}
