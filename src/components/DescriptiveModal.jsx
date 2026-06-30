import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Eye, Info, Calculator } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import DatasetViewerModal from './DatasetViewerModal';

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

const DescriptiveModal = ({ isOpen, onClose, sharedFile, setSharedFile }) => {
  const { token, user } = useAuth();
  
  // File upload state
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
    if (file !== sharedFile && setSharedFile) {
      setSharedFile(file);
    }
  }, [file, sharedFile, setSharedFile]);
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Parameters state
  const [selectedCols, setSelectedCols] = useState([]);
  const [groupVar, setGroupVar] = useState('');
  
  // Analysis results & UI state
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'quality', 'normality', 'distribution'
  
  // Chart variable selection & export state
  const [activeChartVar, setActiveChartVar] = useState('');
  const [downloadDpi, setDownloadDpi] = useState(300);
  const [chartTheme, setChartTheme] = useState('indigo');

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
          text: `Normal Q-Q Plot: ${activeChartVar}`,
          font: { family: 'Outfit, sans-serif', size: 15, color: '#1E293B', weight: 'bold' }
        },
        xaxis: {
          title: { text: 'Theoretical Normal Quantiles', font: { family: 'Outfit, sans-serif', size: 12, color: '#475569' } },
          gridcolor: '#F1F5F9',
          zerolinecolor: '#E2E8F0'
        },
        yaxis: {
          title: { text: 'Sample Ordered Values', font: { family: 'Outfit, sans-serif', size: 12, color: '#475569' } },
          gridcolor: '#F1F5F9',
          zerolinecolor: '#E2E8F0'
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: true,
        legend: { x: 0, y: 1 }
      };

      Plotly.newPlot(qqChartRef.current, [scatterTrace, lineTrace], layout, config);
    }

    // 2. Boxplot rendering
    if (activeTab === 'distribution' && boxChartRef.current) {
      let traces = [];
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
          text: `Box & Whisker Plot: ${activeChartVar} ${results.group_var ? `by ${results.group_var}` : ''}`,
          font: { family: 'Outfit, sans-serif', size: 15, color: '#1E293B', weight: 'bold' }
        },
        xaxis: {
          title: { text: results.group_var || 'All Data', font: { family: 'Outfit, sans-serif', size: 12, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        yaxis: {
          title: { text: activeChartVar, font: { family: 'Outfit, sans-serif', size: 12, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: results.group_var ? true : false
      };

      Plotly.newPlot(boxChartRef.current, traces, layout, config);
    }

    // 3. Histogram rendering
    if (activeTab === 'distribution' && histChartRef.current) {
      let traces = [];
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
          text: `Frequency Histogram: ${activeChartVar} ${results.group_var ? `by ${results.group_var}` : ''}`,
          font: { family: 'Outfit, sans-serif', size: 15, color: '#1E293B', weight: 'bold' }
        },
        xaxis: {
          title: { text: activeChartVar, font: { family: 'Outfit, sans-serif', size: 12, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        yaxis: {
          title: { text: 'Observation Frequency', font: { family: 'Outfit, sans-serif', size: 12, color: '#475569' } },
          gridcolor: '#F1F5F9'
        },
        barmode: 'overlay',
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: results.group_var ? true : false
      };

      Plotly.newPlot(histChartRef.current, traces, layout, config);
    }

  }, [results, activeChartVar, activeTab, chartTheme]);

  if (!isOpen) return null;

  // File Drag-and-Drop Handlers
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
    setError(null);
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError("Supported formats: CSV or Excel (.xlsx, .xls) only.");
      return;
    }

    setFile(selectedFile);
    setColumns([]);
    setNumericColumns([]);
    setSelectedCols([]);
    setGroupVar('');
    setResults(null);
    setLoadingCols(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/analyze/columns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to read columns from file.');
      }

      setColumns(data.columns || []);
      setNumericColumns(data.numeric_columns || []);
    } catch (err) {
      setError(err.message || 'An error occurred while loading columns.');
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
      const response = await fetch(`${API_URL}/analyze/descriptive`, {
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

  const handleReset = () => {
    setFile(null);
    setColumns([]);
    setNumericColumns([]);
    setSelectedCols([]);
    setGroupVar('');
    setResults(null);
    setError(null);
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
        report += `   C.V. %:               ${o.cv.toFixed(2)}%\n\n`;

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
            const gCv = gData.cv.toFixed(2).padStart(12, ' ') + '%';
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
    const title = "Stat Sathi Descriptive Statistics Report";

    if (format === 'txt') {
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      const variablesList = Object.keys(results.variables);
      const overallStatsRows = metricsConfig.map(m => {
        const valCols = variablesList.map(col => {
          const overall = results.variables[col].overall;
          if (overall.error) {
            return `<td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; color: #EF4444; font-style: italic;">Error</td>`;
          }
          const val = overall[m.key];
          const formattedVal = val !== undefined && val !== null ? (m.format ? m.format(val) : val) : 'N/A';
          return `<td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${formattedVal}</td>`;
        }).join('');

        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${m.label}</td>
            ${valCols}
          </tr>
        `;
      }).join('');

      const dataQualityNormalityRows = variablesList.map(col => {
        const overall = results.variables[col].overall;
        const missingCount = overall.missing?.count || 0;
        const missingPct = (overall.missing?.percentage || 0).toFixed(2) + '%';
        const shapiro = overall.shapiro;
        
        let shapiroW = 'N/A';
        let shapiroP = 'N/A';
        let shapiroStatus = 'N/A';
        if (shapiro) {
          if (shapiro.error) {
            shapiroStatus = shapiro.error;
          } else {
            shapiroW = shapiro.stat !== undefined ? shapiro.stat.toFixed(4) : 'N/A';
            shapiroP = shapiro.p_value !== undefined ? (shapiro.p_value < 0.001 ? 'p < 0.001' : `p = ${shapiro.p_value.toFixed(4)}`) : 'N/A';
            shapiroStatus = shapiro.normal ? 'Normally Distributed' : 'Not Normal';
          }
        }

        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${col}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; color: #334155;">${overall.n}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; color: ${missingCount > 0 ? '#EF4444' : '#334155'}; font-weight: ${missingCount > 0 ? 'bold' : 'normal'};">${missingCount}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; color: ${missingCount > 0 ? '#EF4444' : '#334155'}; font-weight: ${missingCount > 0 ? 'bold' : 'normal'};">${missingPct}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${shapiroW}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${shapiroP}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; color: ${shapiro.normal ? '#10B981' : '#EF4444'};">${shapiroStatus}</td>
          </tr>
        `;
      }).join('');

      let outlierRows = [];
      variablesList.forEach(col => {
        const overall = results.variables[col].overall;
        if (overall.outliers && overall.outliers.length > 0) {
          overall.outliers.forEach(out => {
            outlierRows.push(`
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; color: #1E293B;">${col}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold; color: #D97706;">${out.row}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #EF4444;">${out.val.toFixed(4)}</td>
              </tr>
            `);
          });
        }
      });
      const hasOutliers = outlierRows.length > 0;

      let groupedTablesHtml = '';
      if (results.group_var) {
        groupedTablesHtml = variablesList.map(col => {
          const colData = results.variables[col];
          const groupKeys = Object.keys(colData.groups);
          if (groupKeys.length === 0) return '';

          const groupRows = groupKeys.map(g => {
            const gData = colData.groups[g];
            if (gData.error) {
              return `
                <tr>
                  <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${g}</td>
                  <td colSpan="6" style="border: 1px solid #CBD5E1; padding: 8px; text-align: center; color: #EF4444; font-style: italic;">${gData.error}</td>
                </tr>
              `;
            }
            return `
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${g}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; color: #334155;">${gData.n}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${gData.mean.toFixed(4)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${gData.sd.toFixed(4)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${gData.se.toFixed(4)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${gData.median.toFixed(4)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #4F46E5; font-weight: bold;">${gData.cv.toFixed(2)}%</td>
              </tr>
            `;
          }).join('');

          return `
            <h3 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 12pt; margin-top: 15px; margin-bottom: 5px;">${col} Group Statistics</h3>
            <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #4F46E5; color: white;">
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Group Level</th>
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">N</th>
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Mean</th>
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">SD</th>
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">SE</th>
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Median</th>
                  <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">C.V. %</th>
                </tr>
              </thead>
              <tbody>
                ${groupRows}
              </tbody>
            </table>
          </div>
          `;
        }).join('');
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
            .meta-table { border-collapse: collapse; width: 75%; margin-left: auto; margin-right: auto; margin-bottom: 25px; }
            .meta-table td { padding: 8px; border: 1px solid #E2E8F0; }
            .meta-label { font-weight: bold; background-color: #F8FAFC; width: 30%; }
          </style>
        </head>
        <body>
          <h1>Descriptive Statistics Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table" style="width: 75%;">
            <tr>
              <td class="meta-label">Analysis Type</td>
              <td>Descriptive Statistics Summary</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file.name}</td>
            </tr>
            ${results.group_var ? `
            <tr>
              <td class="meta-label">Grouping Factor</td>
              <td>${results.group_var}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="meta-label">Selected Variables</td>
              <td>${variablesList.join(', ')}</td>
            </tr>
            <tr>
              <td class="meta-label">Report Date</td>
              <td>${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td class="meta-label">Curator</td>
              <td>${user ? user.full_name : 'Guest Researcher'}</td>
            </tr>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">1. Overall Summary Statistics</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Statistic</th>
                ${variablesList.map(col => `<th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${overallStatsRows}
            </tbody>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">2. Data Quality and Normality Checks</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Variable</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Valid N</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Missing Count</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Missing %</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Shapiro W</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">SW p-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Normality Status</th>
              </tr>
            </thead>
            <tbody>
              ${dataQualityNormalityRows}
            </tbody>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">3. Flagged Outliers (1.5 * IQR Rule)</h2>
          ${hasOutliers ? `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Variable</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Excel Row Index</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Value</th>
              </tr>
            </thead>
            <tbody>
              ${outlierRows.join('')}
            </tbody>
          </table>
          </div>
          ` : '<p style="color: #10B981; font-weight: bold;">No outliers detected in any of the selected variables.</p>'}

          ${results.group_var && groupedTablesHtml ? `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 25px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">4. Grouped Statistics by Level of ${results.group_var}</h2>
          ${groupedTablesHtml}
          ` : ''}

          <p style="margin-top: 40px; font-size: 9pt; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; text-align: center;">
            Stat Sathi &copy; 2026 - Your Trustworthy Research Analytics Companion - developed by Ravi, PhD Scholar in IISS Bhopal
          </p>
        </body>
        </html>
      `;
      const centeredHtml = htmlContent
        .replace(/width:\s*100%/gi, 'width: 80%')
        .replace(/width:\s*95%/gi, 'width: 80%')
        .replace(/class="meta-table"/gi, 'class="meta-table" style="width: 75%;"')
        .replace(/<table([^>]*)>/gi, (match, attrs) => {
          let newAttrs = attrs;
          if (/width:\s*100%/i.test(newAttrs)) {
            newAttrs = newAttrs.replace(/width:\s*100%/i, 'width: 80%');
          }
          if (/width:\s*95%/i.test(newAttrs)) {
            newAttrs = newAttrs.replace(/width:\s*95%/i, 'width: 80%');
          }
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

    // Apply scale multiplier based on target print DPI
    // Standard screen is ~96 DPI. Scale factor is downloadDpi / 96.
    const scale = downloadDpi / 96;
    const filename = `StatSathi_Descriptive_${titleStr}_${activeChartVar}_${downloadDpi}dpi`;

    Plotly.downloadImage(targetRef, {
      format: format,
      width: 800,
      height: 600,
      scale: scale,
      filename: filename
    });
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
    { key: 'kurtosis', label: 'Kurtosis', format: (v) => v.toFixed(4) },
    { key: 'cv', label: 'C.V. % (Coef of Var)', format: (v) => `${v.toFixed(2)}%` }
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
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
              <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                Calculate central tendency, dispersion, shape, missing values, outliers, and test normality.
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

          {/* Step 1: File Uploader */}
          {!file && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 transition-all duration-300 ${
                dragActive
                  ? 'border-brand-indigo bg-indigo-50/20'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo shadow-xs">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="font-display text-sm font-bold text-slate-800">
                Upload your dataset
              </h3>
              <p className="font-sans text-[11px] text-slate-400 mt-1 leading-relaxed text-center max-w-sm">
                Drag and drop your spreadsheet file here, or click to browse. Supports CSV, Excel (.xlsx, .xls) files.
              </p>
              
              <button
                onClick={() => fileInputRef.current.click()}
                className="mt-6 rounded-xl bg-brand-indigo px-5 py-2.5 font-sans text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Browse Files
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Loading columns from uploaded file */}
          {loadingCols && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Parsing dataset structure...</p>
            </div>
          )}

          {/* Step 2: Parameter Configuration Form */}
          {file && !loadingCols && !results && !loadingAnalysis && (
            <form onSubmit={runAnalysis} className="space-y-6">
              {/* Selected File Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex justify-between items-center">
                <div>
                  <p className="font-sans text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selected Dataset</p>
                  <p className="font-sans text-sm font-semibold text-slate-700 truncate max-w-[250px]">{file.name}</p>
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
                    <p className="font-sans text-[10px] text-slate-400 mt-1">
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

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Generating statistical summary arrays...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Panel */}
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
                      onChange={(e) => setChartTheme(e.target.value)}
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
                                            <td className="py-2.5 px-3 text-right font-mono">{gData.cv.toFixed(2)}%</td>
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
                          const total = o.n + (o.missing?.count || 0);
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
                      <p className="font-sans text-[9px] text-slate-400 italic bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
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
                          <p className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">Normality Test</p>
                          <p className="font-display text-sm font-bold text-slate-700 mt-1">Shapiro-Wilk W Test</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                          <p className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Statistic (W)</p>
                          <p className="font-display text-sm font-bold text-slate-700 mt-1 font-mono">{shapiro.stat !== undefined ? shapiro.stat.toFixed(4) : 'N/A'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                          <p className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">Significance (p-value)</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-display text-sm font-bold text-slate-700 font-mono">{shapiro.p_value !== undefined ? formatPValue(shapiro.p_value) : 'N/A'}</span>
                            {shapiro.p_value !== undefined && (
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
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

                  {/* Q-Q Plot Card with High-Res Download Actions */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="font-sans text-[10px] font-bold text-slate-400 uppercase">Export DPI:</span>
                        {[150, 300, 600].map(dpiVal => (
                          <button
                            key={dpiVal}
                            onClick={() => setDownloadDpi(dpiVal)}
                            className={`px-2 py-1 font-sans text-[9px] font-bold rounded-lg cursor-pointer ${
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
                            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[9px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
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
                    <span className="font-sans text-[10px] font-bold text-slate-400 uppercase">Global Export DPI:</span>
                    {[150, 300, 600].map(dpiVal => (
                      <button
                        key={dpiVal}
                        onClick={() => setDownloadDpi(dpiVal)}
                        className={`px-2 py-1 font-sans text-[9px] font-bold rounded-lg cursor-pointer ${
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
                              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[9px] font-bold uppercase transition-colors flex items-center space-x-0.5 cursor-pointer"
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
                              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[9px] font-bold uppercase transition-colors flex items-center space-x-0.5 cursor-pointer"
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
