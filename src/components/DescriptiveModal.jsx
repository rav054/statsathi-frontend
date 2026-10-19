import { apiFetch } from '../utils/apiFetch';
import { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, Download, RefreshCw, Eye, Calculator } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import FigurePresetSelect from './FigurePresetSelect';
import { PALETTE_OPTIONS, themedLayout } from '../utils/figureStyle';
import { exportPlotlyFigure } from '../utils/plotlyExport';
import { useFigurePreferences } from '../utils/figurePreferences';

const CHART_THEMES = {
  indigo: {
    name: 'Indigo Theme',
    primary: '#4F46E5',
    secondary: '#818CF8',
    accent: '#F97316',
    colors: ['#4F46E5', '#818CF8', '#C7D2FE', '#6366F1', '#4338CA']
  },
  emerald: {
    name: 'Emerald Green',
    primary: '#059669',
    secondary: '#34D399',
    accent: '#D97706',
    colors: ['#059669', '#34D399', '#A7F3D0', '#10B981', '#065F46']
  },
  ocean: {
    name: 'Ocean Breeze',
    primary: '#0284C7',
    secondary: '#38BDF8',
    accent: '#F59E0B',
    colors: ['#0284C7', '#38BDF8', '#BAE6FD', '#0EA5E9', '#075985']
  },
  autumn: {
    name: 'Autumn Gold',
    primary: '#D97706',
    secondary: '#FBBF24',
    accent: '#EF4444',
    colors: ['#D97706', '#FBBF24', '#FEF3C7', '#F59E0B', '#92400E']
  },
  lavender: {
    name: 'Lavender Dusk',
    primary: '#7C3AED',
    secondary: '#C084FC',
    accent: '#EC4899',
    colors: ['#7C3AED', '#C084FC', '#E9D5FF', '#8B5CF6', '#5B21B6']
  },
  slate: {
    name: 'Slate Stone',
    primary: '#475569',
    secondary: '#94A3B8',
    accent: '#0EA5E9',
    colors: ['#475569', '#94A3B8', '#F1F5F9', '#64748B', '#334155']
  }
};

// Publication palettes shared with every chart (figure_style.json)
PALETTE_OPTIONS.forEach(p => {
  CHART_THEMES[p.value] = { name: p.label, primary: p.colors[0], secondary: p.colors[4], accent: p.colors[1], colors: p.colors };
});

const DescriptiveModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token } = useAuth();
  
  // File upload state
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: () => {
      setSelectedCols([]);
      setResults(null);
    },
    onCleared: () => {
      setSelectedCols([]);
      setGroupVar('');
      setResults(null);
      setError(null);
    },
  });
  const { file, columns, numericColumns } = dataset;

  // Parameters state
  const [selectedCols, setSelectedCols] = useState([]);
  const [groupVar, setGroupVar] = useState('');
  
  // Analysis results & UI state
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
      setGroupVar(saved.group_var || '');
    }
  };
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'quality', 'normality', 'distribution'
  
  // Chart variable selection & export state
  const [activeChartVar, setActiveChartVar] = useState('');
  const [downloadDpi, setDownloadDpi] = useState(300);
  const [figurePrefs, setFigurePrefs] = useFigurePreferences();
  const [chartTheme, setChartTheme] = useState(figurePrefs.palette);

  // Chart DOM refs
  const qqChartRef = useRef(null);
  const boxChartRef = useRef(null);
  const histChartRef = useRef(null);

  // Auto-select first variable for chart tabs when results load
  useEffect(() => {
    if (results && Object.keys(results.variables).length > 0) {
      setActiveChartVar(Object.keys(results.variables)[0]);
    } else {
      setActiveChartVar('');
    }
  }, [results]);

  // Render Plotly Charts dynamically when tab, active chart variable, chart theme, or results change
  useEffect(() => {
    if (!results || !activeChartVar) return;

    const colData = results.variables[activeChartVar];
    if (!colData) return;

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d']
    };

    const currentTheme = CHART_THEMES[chartTheme] || CHART_THEMES.indigo;

    // 1. Q-Q Plot rendering
    if (activeTab === 'normality' && qqChartRef.current && colData.overall.qq) {
      const qq = colData.overall.qq;
      const minX = Math.min(...qq.theoretical);
      const maxX = Math.max(...qq.theoretical);
      const minY = qq.slope * minX + qq.intercept;
      const maxY = qq.slope * maxX + qq.intercept;

      const scatterTrace = {
        x: qq.theoretical,
        y: qq.ordered,
        mode: 'markers',
        type: 'scatter',
        name: 'Observed Quantiles',
        marker: {
          color: currentTheme.primary,
          size: 7,
          opacity: 0.8,
          line: { color: '#ffffff', width: 1 }
        }
      };

      const lineTrace = {
        x: [minX, maxX],
        y: [minY, maxY],
        mode: 'lines',
        type: 'scatter',
        name: 'Normal Fit Reference Line',
        line: {
          color: currentTheme.accent,
          width: 2,
          dash: 'dash'
        }
      };

      const layout = {
        title: {
          text: `Normal Q-Q Plot: ${activeChartVar}`
        },
        xaxis: {
          title: { text: 'Theoretical Normal Quantiles' },
        },
        yaxis: {
          title: { text: 'Sample Ordered Values' },
        },
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: true,
        legend: { x: 0, y: 1 }
      };

      Plotly.newPlot(qqChartRef.current, [scatterTrace, lineTrace], themedLayout(layout, { palette: chartTheme }), config);
    }

    // 2. Boxplot rendering
    if (activeTab === 'distribution' && boxChartRef.current) {
      let traces;
      if (results.group_var && Object.keys(colData.groups).length > 0) {
        // Grouped Boxplot
        traces = Object.keys(colData.groups).map((g, idx) => {
          const gData = colData.groups[g];
          const color = currentTheme.colors[idx % currentTheme.colors.length];
          return {
            y: gData.raw_data,
            type: 'box',
            name: g,
            boxpoints: 'suspectedoutliers',
            marker: {
              color: color,
              outliercolor: '#EF4444',
              line: { width: 1.5 }
            }
          };
        });
      } else {
        // Overall Boxplot
        traces = [{
          y: colData.overall.raw_data,
          type: 'box',
          name: 'Overall',
          boxpoints: 'suspectedoutliers',
          marker: {
            color: currentTheme.primary,
            outliercolor: '#EF4444',
            line: { width: 1.5 }
          }
        }];
      }

      const layout = {
        title: {
          text: `Box & Whisker Plot: ${activeChartVar} ${results.group_var ? `by ${results.group_var}` : ''}`
        },
        xaxis: {
          title: { text: results.group_var || 'All Data' },
        },
        yaxis: {
          title: { text: activeChartVar },
        },
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: results.group_var ? true : false
      };

      Plotly.newPlot(boxChartRef.current, traces, themedLayout(layout, { palette: chartTheme }), config);
    }

    // 3. Histogram rendering
    if (activeTab === 'distribution' && histChartRef.current) {
      let traces;
      if (results.group_var && Object.keys(colData.groups).length > 0) {
        // Grouped overlay histograms
        traces = Object.keys(colData.groups).map((g, idx) => {
          const gData = colData.groups[g];
          const color = currentTheme.colors[idx % currentTheme.colors.length];
          return {
            x: gData.raw_data,
            type: 'histogram',
            name: g,
            opacity: 0.6,
            marker: {
              color: color,
              line: { color: '#ffffff', width: 0.5 }
            }
          };
        });
      } else {
        // Overall histogram
        traces = [{
          x: colData.overall.raw_data,
          type: 'histogram',
          name: 'Frequency',
          marker: {
            color: currentTheme.primary,
            line: { color: '#ffffff', width: 1 }
          }
        }];
      }

      const layout = {
        title: {
          text: `Frequency Histogram: ${activeChartVar} ${results.group_var ? `by ${results.group_var}` : ''}`
        },
        xaxis: {
          title: { text: activeChartVar },
        },
        yaxis: {
          title: { text: 'Observation Frequency' },
        },
        barmode: 'overlay',
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: results.group_var ? true : false
      };

      Plotly.newPlot(histChartRef.current, traces, themedLayout(layout, { palette: chartTheme }), config);
    }

  }, [results, activeChartVar, activeTab, chartTheme]);

  if (!isOpen) return null;

  // File Drag-and-Drop Handlers
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
    e.preventDefault();
    if (selectedCols.length === 0) {
      setError("Please select at least one numeric variable for descriptive statistics.");
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('columns_str', selectedCols.join(','));
    if (groupVar) {
      formData.append('group_var', groupVar);
    }

    try {
      const response = await apiFetch(`${API_URL}/analyze/descriptive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to execute descriptive statistics.');
      }

      setResults(data);
      setActiveTab('summary');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleAnalyzeNew = () => {
    setResults(null);
    setError(null);
  };

  // Compile and Save TXT Report
  const handleDownloadReport = (format) => {
    if (!results) return;

    let report = `================================================================================\n`;
    report += `                      STAT SATHI DESCRIPTIVE STATISTICS REPORT                  \n`;
    report += `================================================================================\n`;
    report += `Generated on: ${new Date().toLocaleString()}\n`;
    report += `Dataset File: ${file.name}\n`;
    if (results.group_var) {
      report += `Grouping Factor: ${results.group_var}\n`;
    }
    report += `--------------------------------------------------------------------------------\n\n`;

    Object.keys(results.variables).forEach((col) => {
      const colData = results.variables[col];
      report += `VARIABLE: ${col}\n`;
      report += `================================================================================\n`;
      
      const o = colData.overall;
      report += `1. Overall Summary Statistics (N = ${o.n}):\n`;
      if (o.error) {
        report += `   Error: ${o.error}\n\n`;
      } else {
        report += `   Mean:                 ${o.mean.toFixed(4)}\n`;
        report += `   Median:               ${o.median.toFixed(4)}\n`;
        report += `   Mode:                 ${o.mode !== null && o.mode !== undefined ? o.mode.toFixed(4) : 'N/A'}\n`;
        report += `   Std Deviation (SD):   ${o.sd.toFixed(4)}\n`;
        report += `   Std Error (SE):       ${o.se.toFixed(4)}\n`;
        report += `   Variance (Var):       ${o.var.toFixed(4)}\n`;
        report += `   Minimum:              ${o.min.toFixed(4)}\n`;
        report += `   Maximum:              ${o.max.toFixed(4)}\n`;
        report += `   Range:                ${o.range.toFixed(4)}\n`;
        report += `   IQR:                  ${o.iqr.toFixed(4)}\n`;
        report += `   Skewness:             ${o.skewness.toFixed(4)}\n`;
        report += `   Kurtosis:             ${o.kurtosis.toFixed(4)}\n`;
        report += `   C.V. %:               ${o.cv == null ? 'N/A' : o.cv.toFixed(2) + '%'}\n\n`;

        // Normality
        report += `2. Shapiro-Wilk Normality Check:\n`;
        if (o.shapiro.error) {
          report += `   ${o.shapiro.error}\n\n`;
        } else {
          report += `   W Statistic:          ${o.shapiro.stat.toFixed(4)}\n`;
          report += `   p-value:              ${o.shapiro.p_value < 0.001 ? 'p < 0.001' : o.shapiro.p_value.toFixed(4)}\n`;
          report += `   Status:               ${o.shapiro.normal ? 'Normally Distributed (p >= 0.05)' : 'Not Normally Distributed (p < 0.05)'}\n\n`;
        }
      }

      // Quality & Outliers
      report += `3. Data Quality & Outliers Summary:\n`;
      report += `   Missing Values:       ${o.missing.count} (${o.missing.percentage.toFixed(2)}%)\n`;
      report += `   Outliers (1.5*IQR):   ${o.outliers.length} point(s) detected\n`;
      if (o.outliers.length > 0) {
        report += `   Outliers Listing:\n`;
        report += `     Excel Row      Value\n`;
        report += `     --------------------\n`;
        o.outliers.forEach(out => {
          report += `     ${out.row.toString().padEnd(14, ' ')}${out.val.toFixed(4)}\n`;
        });
      }
      report += `\n`;

      // Group statistics if grouping is enabled
      if (results.group_var && Object.keys(colData.groups).length > 0) {
        report += `4. Grouped Statistics by Level of ${results.group_var}:\n`;
        report += `   -----------------------------------------------------------------------------\n`;
        let groupHeaders = `   Level`.padEnd(18, ' ') + `N`.padStart(6, ' ') + `Mean`.padStart(12, ' ') + `SD`.padStart(12, ' ') + `C.V. %`.padStart(12, ' ') + `Median`.padStart(12, ' ') + `Missing`.padStart(10, ' ');
        report += groupHeaders + '\n';
        report += `   -----------------------------------------------------------------------------\n`;
        Object.keys(colData.groups).forEach(g => {
          const gData = colData.groups[g];
          if (gData.error) {
            report += `   ${g.padEnd(15, ' ')} Error: ${gData.error}\n`;
          } else {
            const level = g.substring(0, 14).padEnd(15, ' ');
            const gn = gData.n.toString().padStart(6, ' ');
            const gMean = gData.mean.toFixed(4).padStart(12, ' ');
            const gSd = gData.sd.toFixed(4).padStart(12, ' ');
            const gCv = (gData.cv == null ? 'N/A' : gData.cv.toFixed(2) + '%').padStart(13, ' ');
            const gMed = gData.median.toFixed(4).padStart(12, ' ');
            const gMiss = `${gData.missing.count} (${gData.missing.percentage.toFixed(0)}%)`.padStart(10, ' ');
            report += `   ${level}${gn}${gMean}${gSd}${gCv}${gMed}${gMiss}\n`;
          }
        });
        report += `   -----------------------------------------------------------------------------\n\n`;
      }
      
      report += `--------------------------------------------------------------------------------\n\n`;
    });

    const fileName = `StatSathi_Descriptive_Report_${file.name.split('.')[0]}`;

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
    const variablesList = Object.keys(results.variables);
    const overallOf = (col) => results.variables[col].overall;
    const sections = [{
      heading: 'Overview',
      paragraphs: [
        `Variables analysed: ${variablesList.join(', ')}.`,
        ...(results.group_var ? [`Grouping factor: ${results.group_var}.`] : [])
      ]
    }, {
      heading: '1. Overall Summary Statistics',
      tables: [{
        columns: ['Statistic', ...variablesList],
        rows: metricsConfig.map(m => [m.label, ...variablesList.map(col => {
          const overall = overallOf(col);
          if (overall.error) return 'Error';
          const val = overall[m.key];
          return val !== undefined && val !== null ? (m.format ? m.format(val) : String(val)) : 'N/A';
        })])
      }, {
        columns: ['Variable', 'P10', 'P25', 'P50', 'P75', 'P90'],
        rows: variablesList.filter(col => overallOf(col).percentiles).map(col => [col, ...['p10', 'p25', 'p50', 'p75', 'p90'].map(p => overallOf(col).percentiles[p].toFixed(4))]),
        caption: 'Percentiles'
      }]
    }, {
      heading: '2. Data Quality and Normality Checks',
      tables: [{
        columns: ['Variable', 'Valid N', 'Missing', 'Missing %', 'Shapiro-Wilk W', 'p-value', 'Normality'],
        rows: variablesList.map(col => {
          const o = overallOf(col);
          const sw = o.shapiro;
          const ok = sw && !sw.error;
          return [col, o.n ?? 0, o.missing?.count ?? 0, `${(o.missing?.percentage || 0).toFixed(2)}%`,
            ok ? sw.stat.toFixed(4) : 'N/A', ok ? formatP(sw.p_value) : 'N/A', ok ? (sw.normal ? 'Normal' : 'Not normal') : (sw?.error || 'N/A')];
        })
      }, {
        columns: ['Variable', 'Lilliefors D', 'Lilliefors p', "D'Agostino K²", "D'Agostino p"],
        rows: variablesList.map(col => {
          const o = overallOf(col);
          return [col, o.lilliefors ? o.lilliefors.stat.toFixed(4) : 'N/A', o.lilliefors ? formatP(o.lilliefors.p_value) : 'N/A',
            o.dagostino_pearson ? o.dagostino_pearson.stat.toFixed(4) : 'N/A', o.dagostino_pearson ? formatP(o.dagostino_pearson.p_value) : 'N/A'];
        }),
        caption: 'Additional normality tests',
        note: 'Lilliefors is the Kolmogorov-Smirnov test with estimated mean and SD; D\'Agostino-Pearson needs n ≥ 8.'
      }]
    }];

    const outlierRows = variablesList.flatMap(col => (overallOf(col).outliers || []).map(out => [col, out.row, out.val.toFixed(4)]));
    const zRows = variablesList.flatMap(col => (overallOf(col).z_outliers || []).map(out => [col, out.val.toFixed(4), out.z.toFixed(2)]));
    sections.push({
      heading: '3. Outliers',
      paragraphs: outlierRows.length === 0 ? ['No outliers were flagged by the 1.5 × IQR rule.'] : [],
      tables: [
        ...(outlierRows.length > 0 ? [{ columns: ['Variable', 'Excel row', 'Value'], rows: outlierRows, caption: 'Tukey fences (1.5 × IQR)' }] : []),
        ...(zRows.length > 0 ? [{ columns: ['Variable', 'Value', 'z'], rows: zRows, caption: '|z| > 3' }] : [])
      ]
    });

    if (results.group_var) {
      const groupTables = variablesList.map(col => {
        const groups = results.variables[col].groups;
        const keys = Object.keys(groups);
        if (keys.length === 0) return null;
        return {
          columns: ['Group level', 'N', 'Mean', 'SD', 'SE', 'Median', 'C.V. %'],
          rows: keys.map(g => {
            const gData = groups[g];
            if (gData.error) return [g, '–', gData.error, '–', '–', '–', '–'];
            return [g, gData.n, gData.mean.toFixed(4), gData.sd.toFixed(4), gData.se.toFixed(4), gData.median.toFixed(4), gData.cv == null ? 'N/A' : `${gData.cv.toFixed(2)}%`];
          }),
          caption: `${col} by ${results.group_var}`
        };
      }).filter(Boolean);
      if (groupTables.length > 0) sections.push({ heading: `4. Grouped Statistics by ${results.group_var}`, tables: groupTables });
    }

    return {
      title: 'Descriptive Statistics Report',
      test_applied: 'Descriptive statistics and normality checks',
      dataset_name: file?.name,
      filename: fileName,
      sections
    };
  };

  // High-Resolution Plot Downloader
  const handleDownloadPlot = (chartType, format) => {
    let targetRef;
    let titleStr = '';
    if (chartType === 'qq') {
      targetRef = qqChartRef.current;
      titleStr = 'QQ_Plot';
    } else if (chartType === 'box') {
      targetRef = boxChartRef.current;
      titleStr = 'Boxplot';
    } else if (chartType === 'hist') {
      targetRef = histChartRef.current;
      titleStr = 'Histogram';
    }

    if (!targetRef) return;

    const filename = `StatSathi_Descriptive_${titleStr}_${activeChartVar}_${downloadDpi}dpi`;

    exportPlotlyFigure(targetRef, { format, preset: figurePrefs.preset, dpi: downloadDpi, filename: filename }).catch(err => setError(err.message));
  };

  // Utility to format p-value according to scientific requirements
  const formatPValue = (p) => {
    if (typeof p !== 'number') return 'N/A';
    if (p < 0.001) return 'p < 0.001';
    return `p = ${p.toFixed(4)}`;
  };

  // Metric Definition Table Config
  const metricsConfig = [
    { key: 'n', label: 'Observations (N)' },
    { key: 'mean', label: 'Mean', format: (v) => v.toFixed(4) },
    { key: 'median', label: 'Median', format: (v) => v.toFixed(4) },
    { key: 'mode', label: 'Mode', format: (v) => v !== null && v !== undefined ? v.toFixed(4) : 'N/A' },
    { key: 'sd', label: 'Std Deviation (SD)', format: (v) => v.toFixed(4) },
    { key: 'se', label: 'Std Error (SE)', format: (v) => v.toFixed(4) },
    { key: 'var', label: 'Variance (S²)', format: (v) => v.toFixed(4) },
    { key: 'min', label: 'Minimum', format: (v) => v.toFixed(4) },
    { key: 'max', label: 'Maximum', format: (v) => v.toFixed(4) },
    { key: 'range', label: 'Range', format: (v) => v.toFixed(4) },
    { key: 'iqr', label: 'Interquartile Range (IQR)', format: (v) => v.toFixed(4) },
    { key: 'skewness', label: 'Skewness', format: (v) => v.toFixed(4) },
    { key: 'se_skewness', label: 'Std Error of Skewness', format: (v) => (v === null || v === undefined ? 'N/A' : v.toFixed(4)) },
    { key: 'kurtosis', label: 'Kurtosis (excess)', format: (v) => v.toFixed(4) },
    { key: 'se_kurtosis', label: 'Std Error of Kurtosis', format: (v) => (v === null || v === undefined ? 'N/A' : v.toFixed(4)) },
    // C.V. is undefined when the mean is zero
    { key: 'cv', label: 'C.V. % (Coef of Var)', format: (v) => (v === null || v === undefined ? 'N/A' : `${v.toFixed(2)}%`) }
  ];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-brand-indigo">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold text-slate-800">
                Descriptive Statistics
              </h2>
              <p className="font-sans text-[13px] text-slate-400 mt-0.5">
                Calculate central tendency, dispersion, shape, missing values, outliers, and test normality.
              </p>
            </div>
          </div>
          <button data-dialog-close aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
          {error && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 flex items-start space-x-3 text-red-700 animate-shake">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-sans text-xs font-semibold">Error Occurred</p>
                <p className="font-sans text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Step 2: Parameter Configuration Form */}
          {!results && !loadingAnalysis && (
            <div className="space-y-6">
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a dataset to summarise"
                hint="Any table with numeric columns (CSV or Excel). An optional grouping column splits the summary by group."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (
              <form onSubmit={runAnalysis} className="space-y-6">
              {/* Select inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Numeric Columns checklist */}
                <div className="space-y-2 col-span-1 border border-slate-100 rounded-2xl p-4 bg-white shadow-xs">
                  <label className="font-sans text-xs font-bold text-slate-500 block mb-1">
                    Select Numeric Variables
                  </label>
                  {numericColumns.length === 0 ? (
                    <p className="font-sans text-xs text-slate-400">No numeric variables found in dataset.</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {numericColumns.map(col => (
                        <label key={col} className="flex items-center space-x-2.5 cursor-pointer font-sans text-xs text-slate-700 hover:text-slate-900 py-0.5">
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

                {/* Grouping variable */}
                <div className="space-y-4 col-span-1">
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Grouping Factor (Optional)</label>
                    <select
                      value={groupVar}
                      onChange={(e) => setGroupVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">-- No Grouping --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="font-sans text-[13px] text-slate-400 mt-1">
                      Select a categorical column to partition the summary metrics.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Compute Descriptive Statistics
              </button>
              </form>
              )}
            </div>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Generating statistical summary arrays...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Panel */}
          {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 pb-px space-x-6 overflow-x-auto">
                {[
                  { id: 'summary', label: 'Summary Stats' },
                  { id: 'quality', label: 'Quality & Outliers' },
                  { id: 'normality', label: 'Normality & Q-Q' },
                  { id: 'distribution', label: 'Distributions' }
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

              {/* Active Chart Variable Selector for Normality and Distributions Tabs */}
              {(activeTab === 'normality' || activeTab === 'distribution') && (
                <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                  <div className="flex items-center space-x-2">
                    <label className="font-sans text-xs font-bold text-slate-500">Active Variable:</label>
                    <select
                      value={activeChartVar}
                      onChange={(e) => setActiveChartVar(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo transition-all animate-fade-in"
                    >
                      {Object.keys(results.variables).map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="font-sans text-xs font-bold text-slate-500">Chart Theme:</label>
                    <select
                      value={chartTheme}
                      onChange={(e) => { setChartTheme(e.target.value); setFigurePrefs({ palette: e.target.value }); }}
                      className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo transition-all"
                    >
                      {Object.keys(CHART_THEMES).map(themeKey => (
                        <option key={themeKey} value={themeKey}>
                          {CHART_THEMES[themeKey].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Tab 1: Summary Statistics (Comparative Grid + Table of Means) */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Overall stats comparative grid */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                    <h4 className="font-display text-xs font-bold text-slate-700 mb-3">Overall Summary Statistics</h4>
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                          <th className="p-3">Statistic</th>
                          {Object.keys(results.variables).map(col => (
                            <th key={col} className="p-3 text-right">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metricsConfig.map(m => (
                          <tr key={m.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-slate-700">{m.label}</td>
                            {Object.keys(results.variables).map(col => {
                              const overall = results.variables[col].overall;
                              if (overall.error) {
                                return (
                                  <td key={col} className="p-3 text-right text-red-500 italic font-medium">
                                    N/A (Error)
                                  </td>
                                );
                              }
                              const val = overall[m.key];
                              return (
                                <td key={col} className="p-3 text-right font-mono text-slate-800">
                                  {val !== undefined && val !== null ? (m.format ? m.format(val) : val) : 'N/A'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Grouped statistics "Tables of Means" */}
                  {results.group_var && (
                    <div className="space-y-6 mt-6">
                      <h4 className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">Grouped Tables of Means (by {results.group_var})</h4>
                      {Object.keys(results.variables).map(col => {
                        const colData = results.variables[col];
                        const groupKeys = Object.keys(colData.groups);
                        return (
                          <div key={col} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                            <h5 className="font-display text-xs font-bold text-brand-indigo mb-3 uppercase tracking-wider">{col} Group Statistics</h5>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse font-sans text-xs text-left">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                                    <th className="py-2.5 px-3">Group Level</th>
                                    <th className="py-2.5 px-3 text-right">N</th>
                                    <th className="py-2.5 px-3 text-right">Mean</th>
                                    <th className="py-2.5 px-3 text-right">SD</th>
                                    <th className="py-2.5 px-3 text-right">SE</th>
                                    <th className="py-2.5 px-3 text-right">Median</th>
                                    <th className="py-2.5 px-3 text-right">C.V. %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {groupKeys.map(g => {
                                    const gData = colData.groups[g];
                                    return (
                                      <tr key={g} className="border-b border-slate-100 hover:bg-slate-50/30">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800">{g}</td>
                                        {gData.error ? (
                                          <td colSpan="6" className="py-2.5 px-3 text-slate-400 text-center italic">{gData.error}</td>
                                        ) : (
                                          <>
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.n}</td>
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.mean.toFixed(4)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.sd.toFixed(4)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.se.toFixed(4)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.median.toFixed(4)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.cv == null ? 'N/A' : gData.cv.toFixed(2) + '%'}</td>
                                          </>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Quality & Outliers */}
              {activeTab === 'quality' && (
                <div className="space-y-6">
                  {/* Missing values summary */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                    <h4 className="font-display text-xs font-bold text-slate-700 mb-3">Data Quality (Missing Observations)</h4>
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                          <th className="py-2.5 px-3">Variable</th>
                          <th className="py-2.5 px-3 text-right">Valid Observations</th>
                          <th className="py-2.5 px-3 text-right">Missing Count (NaN)</th>
                          <th className="py-2.5 px-3 text-right">Missing Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(results.variables).map(col => {
                          const o = results.variables[col].overall;
                          return (
                            <tr key={col} className="border-b border-slate-50 text-slate-700">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{col}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{o.n}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-red-500 font-semibold">{o.missing?.count || 0}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-red-500 font-semibold">{(o.missing?.percentage || 0).toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Outliers detected summary */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-display text-xs font-bold text-slate-700">Flagged Outliers (1.5 * IQR Rule)</h4>
                      <p className="font-sans text-[12px] text-slate-400 italic bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                        Note: Row indices match physical sheet row numbers (with header as row 1)
                      </p>
                    </div>
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                          <th className="py-2.5 px-3">Variable</th>
                          <th className="py-2.5 px-3 text-right">Excel Row Index</th>
                          <th className="py-2.5 px-3 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let rows = [];
                          Object.keys(results.variables).forEach(col => {
                            const o = results.variables[col].overall;
                            if (o.outliers && o.outliers.length > 0) {
                              o.outliers.forEach((out, idx) => {
                                rows.push(
                                  <tr key={`${col}-${idx}`} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/30">
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">{col}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-amber-600 font-bold">{out.row}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-red-500">{out.val.toFixed(4)}</td>
                                  </tr>
                                );
                              });
                            }
                          });
                          if (rows.length === 0) {
                            return (
                              <tr>
                                <td colSpan="3" className="py-6 text-center text-emerald-600 font-medium font-sans">
                                  🎉 No outliers detected in any of the selected variables.
                                </td>
                              </tr>
                            );
                          }
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Percentiles and |z| > 3 outliers */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                    <h4 className="font-display text-xs font-bold text-slate-700 mb-3">Percentiles & Z-Score Outliers (|z| &gt; 3)</h4>
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                          <th className="py-2.5 px-3">Variable</th>
                          {['P10', 'P25', 'P50', 'P75', 'P90'].map(p => <th key={p} className="py-2.5 px-3 text-right">{p}</th>)}
                          <th className="py-2.5 px-3 text-right">|z| &gt; 3 Values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(results.variables).map(col => {
                          const o = results.variables[col].overall;
                          if (!o.percentiles) return null;
                          return (
                            <tr key={col} className="border-b border-slate-50 text-slate-700">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{col}</td>
                              {['p10', 'p25', 'p50', 'p75', 'p90'].map(p => (
                                <td key={p} className="py-2.5 px-3 text-right font-mono">{o.percentiles[p].toFixed(4)}</td>
                              ))}
                              <td className="py-2.5 px-3 text-right font-mono text-red-500">
                                {o.z_outliers && o.z_outliers.length > 0
                                  ? o.z_outliers.map(z => `${z.val.toFixed(3)} (z = ${z.z.toFixed(2)})`).join(', ')
                                  : 'None'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Normality & Q-Q Plot */}
              {activeTab === 'normality' && (
                <div className="space-y-6">
                  {/* Shapiro Wilk Stat Details */}
                  {(() => {
                    const colData = results.variables[activeChartVar];
                    if (!colData || colData.overall.error) return null;
                    const shapiro = colData.overall.shapiro;
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                          <p className="font-sans text-[13px] font-bold text-slate-400 uppercase tracking-wider">Normality Test</p>
                          <p className="font-display text-sm font-bold text-slate-700 mt-1">Shapiro-Wilk W Test</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                          <p className="font-sans text-[13px] font-bold text-slate-400 uppercase tracking-wider">Test Statistic (W)</p>
                          <p className="font-display text-sm font-bold text-slate-700 mt-1 font-mono">{shapiro.stat !== undefined ? shapiro.stat.toFixed(4) : 'N/A'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                          <p className="font-sans text-[13px] font-bold text-slate-400 uppercase tracking-wider">Significance (p-value)</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-display text-sm font-bold text-slate-700 font-mono">{shapiro.p_value !== undefined ? formatPValue(shapiro.p_value) : 'N/A'}</span>
                            {shapiro.p_value !== undefined && (
                              <span className={`px-2 py-0.5 rounded-lg text-[13px] font-bold ${
                                shapiro.normal
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-red-50 text-red-600'
                              }`}>
                                {shapiro.normal ? 'Normally Distributed' : 'Not Normal'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Additional normality tests */}
                  {(() => {
                    const o = results.variables[activeChartVar]?.overall;
                    if (!o || o.error || (!o.lilliefors && !o.dagostino_pearson)) return null;
                    const tests = [
                      ["Lilliefors (Kolmogorov-Smirnov, estimated mean & SD)", o.lilliefors, 'D'],
                      ["D'Agostino-Pearson Omnibus (n ≥ 8)", o.dagostino_pearson, 'K²']
                    ].filter(([, t]) => t);
                    return (
                      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                        <h4 className="font-display text-xs font-bold text-slate-700 mb-3">Additional Normality Tests</h4>
                        <table className="w-full border-collapse font-sans text-xs text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50">
                              <th className="py-2.5 px-3">Test</th>
                              <th className="py-2.5 px-3 text-right">Statistic</th>
                              <th className="py-2.5 px-3 text-right">p-value</th>
                              <th className="py-2.5 px-3 text-right">Conclusion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tests.map(([name, t, symbol]) => (
                              <tr key={name} className="border-b border-slate-50 text-slate-700">
                                <td className="py-2.5 px-3 font-semibold">{name}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{symbol} = {t.stat.toFixed(4)}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{formatPValue(t.p_value)}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-lg text-[13px] font-bold ${t.normal ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                    {t.normal ? 'Normally Distributed' : 'Not Normal'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Q-Q Plot Card with High-Res Download Actions */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center space-x-2">
                        <FigurePresetSelect value={figurePrefs.preset} onChange={(preset) => setFigurePrefs({ preset })} className="mr-2" />
                        <span className="font-sans text-[13px] font-bold text-slate-400 uppercase">Export DPI:</span>
                        {[150, 300, 600].map(dpiVal => (
                          <button
                            key={dpiVal}
                            onClick={() => setDownloadDpi(dpiVal)}
                            className={`px-2 py-1 font-sans text-[12px] font-bold rounded-lg cursor-pointer ${
                              downloadDpi === dpiVal
                                ? 'bg-brand-indigo text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
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
                            onClick={() => handleDownloadPlot('qq', fmt)}
                            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[12px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Download className="h-3 w-3" />
                            <span>{fmt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
                      <div ref={qqChartRef} className="w-full h-[400px]"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Distributions (Boxplot & Histogram) */}
              {activeTab === 'distribution' && (
                <div className="space-y-6">
                  {/* Share DPI controls at the top of charts panel */}
                  <div className="flex items-center space-x-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <FigurePresetSelect value={figurePrefs.preset} onChange={(preset) => setFigurePrefs({ preset })} className="mr-2" />
                    <span className="font-sans text-[13px] font-bold text-slate-400 uppercase">Global Export DPI:</span>
                    {[150, 300, 600].map(dpiVal => (
                      <button
                        key={dpiVal}
                        onClick={() => setDownloadDpi(dpiVal)}
                        className={`px-2 py-1 font-sans text-[12px] font-bold rounded-lg cursor-pointer ${
                          downloadDpi === dpiVal
                            ? 'bg-brand-indigo text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {dpiVal === 150 ? '150 Standard' : dpiVal === 300 ? '300 Print' : '600 Pub'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Boxplot Card */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                        <h5 className="font-display text-xs font-bold text-slate-600 uppercase">Box & Whisker Plot</h5>
                        <div className="flex space-x-1">
                          {['png', 'jpeg', 'svg'].map(fmt => (
                            <button
                              key={fmt}
                              onClick={() => handleDownloadPlot('box', fmt)}
                              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[12px] font-bold uppercase transition-colors flex items-center space-x-0.5 cursor-pointer"
                            >
                              <Download className="h-2.5 w-2.5" />
                              <span>{fmt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-xs">
                        <div ref={boxChartRef} className="w-full h-[350px]"></div>
                      </div>
                    </div>

                    {/* Histogram Card */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                        <h5 className="font-display text-xs font-bold text-slate-600 uppercase">Frequency Histogram</h5>
                        <div className="flex space-x-1">
                          {['png', 'jpeg', 'svg'].map(fmt => (
                            <button
                              key={fmt}
                              onClick={() => handleDownloadPlot('hist', fmt)}
                              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[12px] font-bold uppercase transition-colors flex items-center space-x-0.5 cursor-pointer"
                            >
                              <Download className="h-2.5 w-2.5" />
                              <span>{fmt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-xs">
                        <div ref={histChartRef} className="w-full h-[350px]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {results ? (
            <div className="flex space-x-2">
              <div className="flex items-center space-x-1 bg-emerald-50/50 p-1 rounded-xl border border-emerald-100 mr-2">
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
              <SaveToProjectButton
                module="descriptive"
                report={() => buildDocxReport('report')}
                source={dataset.source}
                defaultTitle={`Descriptive statistics – ${file?.name || 'dataset'}`}
                parameters={{ variables: Object.keys(results?.variables || {}), group_var: results?.group_var || null, dataset: file?.name }}
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
            {file && results && (
              <button
                onClick={handleAnalyzeNew}
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

export default DescriptiveModal;
