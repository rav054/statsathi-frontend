import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Eye, Info, Layers, GitBranch } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import DatasetViewerModal from './DatasetViewerModal';

const CLUSTER_PALETTES = {
  classic: {
    name: 'Classic Multi-Color',
    colors: ['#4F46E5', '#F97316', '#10B981', '#EC4899', '#8B5CF6', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6', '#6366F1']
  },
  sunset: {
    name: 'Sunset Glow',
    colors: ['#F97316', '#EF4444', '#EC4899', '#F59E0B', '#D97706', '#B91C1C', '#BE123C', '#E11D48', '#FDA4AF', '#FECDD3']
  },
  forest: {
    name: 'Forest Green',
    colors: ['#10B981', '#059669', '#047857', '#0D9488', '#0F766E', '#14B8A6', '#2DD4BF', '#065F46', '#022C22', '#A7F3D0']
  },
  ocean: {
    name: 'Ocean Breeze',
    colors: ['#0EA5E9', '#3B82F6', '#2563EB', '#0284C7', '#1D4ED8', '#075985', '#38BDF8', '#7DD3FC', '#0369A1', '#0F172A']
  },
  pastel: {
    name: 'Modern Pastel',
    colors: ['#818CF8', '#FCA5A5', '#86EFAC', '#FDE047', '#C084FC', '#F472B6', '#67E8F9', '#FDBA74', '#93C5FD', '#A5F3FC']
  },
  slate: {
    name: 'Moody Slate',
    colors: ['#475569', '#64748B', '#94A3B8', '#334155', '#1E293B', '#0F172A', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#94A3B8']
  }
};

const ClusteringModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();

  // Dataset states
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Parameter states
  const [selectedCols, setSelectedCols] = useState([]);
  const [clusterMethod, setClusterMethod] = useState('kmeans'); // 'kmeans' or 'hierarchical'
  const [k, setK] = useState(3);
  const [cutHeight, setCutHeight] = useState('');
  const [scatterX, setScatterX] = useState('');
  const [scatterY, setScatterY] = useState('');
  
  // Results & UI states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'dendrogram', 'biplot', 'profile', 'data'
  const [viewerOpen, setViewerOpen] = useState(false);
  const [downloadDpi, setDownloadDpi] = useState(150);
  const [clusterPalette, setClusterPalette] = useState('classic');

  // Plotly chart refs
  const dendrogramRef = useRef(null);
  const biplotRef = useRef(null);

  // Initialize scatter plot variables when results are loaded
  useEffect(() => {
    if (results && results.variables && results.variables.length > 0) {
      setScatterX(results.variables[0]);
      setScatterY(results.variables[1] || results.variables[0]);
    }
  }, [results]);

  // Trigger charts rendering when activeTab or results change
  useEffect(() => {
    if (!results) return;

    // 1. Dendrogram rendering
    if (activeTab === 'dendrogram' && clusterMethod === 'hierarchical' && dendrogramRef.current) {
      const dendrogram = results.hierarchical.dendrogram;
      if (dendrogram) {
        const traces = [];
        const colorMap = {
          'C0': 0, 'C1': 1, 'C2': 2, 'C3': 3, 'C4': 4, 'C5': 5, 'C6': 6, 'C7': 7, 'C8': 8, 'C9': 9,
          'g': 2, 'r': 7, 'b': 0, 'c': 8, 'm': 3, 'y': 5, 'k': 9
        };
        const mapDendrogramColor = (c) => {
          if (!c) return '#64748B';
          const index = colorMap[c];
          if (index !== undefined) {
            const palColors = CLUSTER_PALETTES[clusterPalette]?.colors || CLUSTER_PALETTES.classic.colors;
            return palColors[index % palColors.length];
          }
          return c;
        };

        for (let idx = 0; idx < dendrogram.icoord.length; idx++) {
          const xArr = dendrogram.icoord[idx];
          const yArr = dendrogram.dcoord[idx];
          const color = mapDendrogramColor(dendrogram.color_list[idx]);
          traces.push({
            x: xArr,
            y: yArr,
            type: 'scatter',
            mode: 'lines',
            showlegend: false,
            line: { color: color, width: 1.5 },
            hoverinfo: 'none'
          });
        }

        const activeCut = parseFloat(cutHeight || results.hierarchical.cut_height_used);

        const layout = {
          title: {
            text: 'Hierarchical Clustering Dendrogram (Ward\'s Linkage)',
            font: { family: 'Outfit, sans-serif', size: 14, color: '#1E293B', weight: 'bold' }
          },
          xaxis: {
            title: { text: 'Observations / Linkage Groups', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
            showticklabels: false,
            gridcolor: '#F1F5F9'
          },
          yaxis: {
            title: { text: 'Distance (Height)', font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
            gridcolor: '#F1F5F9'
          },
          plot_bgcolor: '#ffffff',
          paper_bgcolor: '#ffffff',
          margin: { t: 50, r: 40, l: 60, b: 50 },
          shapes: [
            {
              type: 'line',
              x0: 0,
              y0: activeCut,
              x1: Math.max(...dendrogram.icoord.flat()),
              y1: activeCut,
              line: {
                color: '#EF4444',
                width: 2,
                dash: 'dashdot'
              }
            }
          ]
        };

        const config = { responsive: true, displayModeBar: false };
        Plotly.newPlot(dendrogramRef.current, traces, layout, config);
      }
    }

    // 2. Cluster Scatter Plot rendering
    if (activeTab === 'biplot' && biplotRef.current && results) {
      const activeLabels = clusterMethod === 'kmeans' ? results.kmeans.labels : results.hierarchical.labels;
      const numClusters = clusterMethod === 'kmeans' ? k : [...new Set(activeLabels)].length;
      
      const colX = scatterX || results.variables[0];
      const colY = scatterY || results.variables[1] || results.variables[0];
      
      const idxX = results.variables.indexOf(colX);
      const idxY = results.variables.indexOf(colY);
      
      const traces = [];
      const clusterColors = CLUSTER_PALETTES[clusterPalette]?.colors || CLUSTER_PALETTES.classic.colors;
      
      const getConvexHull = (pts) => {
        if (pts.length <= 1) return pts;
        const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
        const crossProduct = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lower = [];
        for (const p of sorted) {
          while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
          lower.push(p);
        }
        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
          const p = sorted[i];
          while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
          upper.push(p);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
      };

      for (let c = 0; c < numClusters; c++) {
        const clusterX = [];
        const clusterY = [];
        const hoverTexts = [];
        const points = [];
        
        activeLabels.forEach((label, idx) => {
          if (label === c) {
            const record = results.records[idx];
            const px = record[colX];
            const py = record[colY];
            clusterX.push(px);
            clusterY.push(py);
            points.push({ x: px, y: py });
            hoverTexts.push(`Row ${record.excel_row}<br>${colX}: ${px}<br>${colY}: ${py}<br>Cluster: ${c}`);
          }
        });
        
        // Add cloud shape (Convex Hull) for this cluster if we have 3 or more points
        if (points.length >= 3) {
          const hull = getConvexHull(points);
          const hullX = hull.map(p => p.x);
          const hullY = hull.map(p => p.y);
          if (hull.length > 0) {
            hullX.push(hull[0].x);
            hullY.push(hull[0].y);
          }
          
          traces.push({
            x: hullX,
            y: hullY,
            mode: 'lines',
            type: 'scatter',
            fill: 'toself',
            fillcolor: clusterColors[c % clusterColors.length] + '18', // ~9% opacity cloud
            line: {
              color: clusterColors[c % clusterColors.length],
              width: 1.5,
              dash: 'dashdot'
            },
            showlegend: false,
            hoverinfo: 'skip',
            name: `Cluster ${c} Cloud`
          });
        }
        
        traces.push({
          x: clusterX,
          y: clusterY,
          mode: 'markers',
          type: 'scatter',
          name: `Cluster ${c}`,
          text: hoverTexts,
          hoverinfo: 'text',
          marker: {
            color: clusterColors[c % clusterColors.length],
            size: 10,
            line: { color: '#ffffff', width: 1 }
          }
        });
      }
      
      // Plot centroids if kmeans
      if (clusterMethod === 'kmeans' && results.kmeans.centroids) {
        const centroidX = [];
        const centroidY = [];
        const centroidHover = [];
        
        for (let c = 0; c < numClusters; c++) {
          if (results.kmeans.centroids[c] && idxX !== -1 && idxY !== -1) {
            centroidX.push(results.kmeans.centroids[c][idxX]);
            centroidY.push(results.kmeans.centroids[c][idxY]);
            centroidHover.push(`Cluster ${c} Centroid<br>${colX}: ${results.kmeans.centroids[c][idxX].toFixed(3)}<br>${colY}: ${results.kmeans.centroids[c][idxY].toFixed(3)}`);
          }
        }
        
        if (centroidX.length > 0) {
          traces.push({
            x: centroidX,
            y: centroidY,
            mode: 'markers',
            type: 'scatter',
            name: 'Centroids',
            text: centroidHover,
            hoverinfo: 'text',
            marker: {
              symbol: 'star',
              size: 16,
              color: '#1E293B',
              line: { color: '#ffffff', width: 2 }
            }
          });
        }
      }
      
      const layout = {
        title: {
          text: `Cluster Scatter Plot: ${colX} vs ${colY}`,
          font: { family: 'Outfit, sans-serif', size: 14, color: '#1E293B', weight: 'bold' }
        },
        xaxis: {
          title: { text: colX, font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
          gridcolor: '#F1F5F9',
          zerolinecolor: '#E2E8F0'
        },
        yaxis: {
          title: { text: colY, font: { family: 'Outfit, sans-serif', size: 11, color: '#475569' } },
          gridcolor: '#F1F5F9',
          zerolinecolor: '#E2E8F0'
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        margin: { t: 50, r: 40, l: 60, b: 50 },
        showlegend: true,
        legend: { x: 0, y: 1 }
      };
      
      const config = { responsive: true, displayModeBar: false };
      Plotly.newPlot(biplotRef.current, traces, layout, config);
    }
  }, [results, activeTab, cutHeight, clusterMethod, k, scatterX, scatterY, clusterPalette]);

  if (!isOpen) return null;

  // File processing
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

  const processFile = async (selectedFile) => {
    setFile(selectedFile);
    setColumns([]);
    setNumericColumns([]);
    setSelectedCols([]);
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

  const handleCheckboxChange = (col) => {
    if (selectedCols.includes(col)) {
      setSelectedCols(selectedCols.filter(c => c !== col));
    } else {
      setSelectedCols([...selectedCols, col]);
    }
  };

  const runAnalysis = async (e) => {
    e.preventDefault();
    if (selectedCols.length < 2) {
      setError("Please select at least 2 numeric variables for clustering analysis.");
      return;
    }

    setLoadingAnalysis(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('variables_str', selectedCols.join(','));
    formData.append('method', clusterMethod);
    formData.append('k', k.toString());
    if (clusterMethod === 'hierarchical' && cutHeight) {
      formData.append('cut_height', cutHeight);
    }

    try {
      const response = await fetch(`${API_URL}/analyze/cluster`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to execute clustering.');

      setResults(data);
      setActiveTab('profile');
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
    setResults(null);
    setError(null);
  };

  const handleAnalyzeNew = () => {
    setResults(null);
    setError(null);
  };

  // High resolution Plot download
  const handleDownloadPlot = (chartType, format) => {
    let targetRef = chartType === 'dendrogram' ? dendrogramRef.current : biplotRef.current;
    if (!targetRef) return;

    const scale = downloadDpi / 96;
    const filename = `statsathi_cluster_${chartType}_export_${downloadDpi}dpi`;

    Plotly.downloadImage(targetRef, {
      format: format,
      width: 800,
      height: 600,
      scale: scale,
      filename: filename
    });
  };

  // Report downloads
  const handleDownloadReport = (format) => {
    if (!results) return;

    const activeLabels = clusterMethod === 'kmeans' ? results.kmeans.labels : results.hierarchical.labels;
    const summaries = clusterMethod === 'kmeans' ? results.kmeans.summaries : results.hierarchical.summaries;
    
    let report = `================================================================================\n`;
    report += `                     STAT SATHI CLUSTERING ANALYSIS REPORT                      \n`;
    report += `================================================================================\n`;
    report += `Generated on: ${new Date().toLocaleString()}\n`;
    report += `Dataset File: ${file.name}\n`;
    report += `Variables Selected: ${selectedCols.join(', ')}\n`;
    report += `Clustering Method: ${clusterMethod === 'kmeans' ? 'K-Means' : 'Hierarchical (Ward\'s Linkage)'}\n`;
    if (clusterMethod === 'kmeans') {
      report += `Number of Clusters (K): ${k}\n`;
    } else {
      report += `Cut Height Used: ${results.hierarchical.cut_height_used.toFixed(4)}\n`;
      report += `Clusters Identified: ${summaries.length}\n`;
    }
    report += `--------------------------------------------------------------------------------\n\n`;

    report += `1. CLUSTER PROFILE SUMMARY (MEANS OF VARIABLES)\n`;
    report += `--------------------------------------------------------------------------------\n`;
    
    // Header
    let headersRow = `Variable`.padEnd(20, ' ') + `Overall Mean`.padStart(15, ' ');
    summaries.forEach(s => {
      headersRow += `Cluster ${s.cluster_id}`.padStart(15, ' ');
    });
    report += headersRow + '\n';
    report += `-`.repeat(20 + 15 + summaries.length * 15) + '\n';

    selectedCols.forEach(col => {
      // Calculate overall mean
      const overallMean = results.records.reduce((acc, r) => acc + (r[col] || 0), 0) / results.records.length;
      let row = col.substring(0, 19).padEnd(20, ' ') + overallMean.toFixed(4).padStart(15, ' ');
      summaries.forEach(s => {
        const val = s.means[col];
        row += (val !== null && val !== undefined ? val.toFixed(4) : 'N/A').padStart(15, ' ');
      });
      report += row + '\n';
    });
    report += `-`.repeat(20 + 15 + summaries.length * 15) + '\n';
    
    // Sizes
    let sizeRow = `Sample Size (N)`.padEnd(20, ' ') + results.records.length.toString().padStart(15, ' ');
    summaries.forEach(s => {
      sizeRow += s.count.toString().padStart(15, ' ');
    });
    report += sizeRow + '\n\n';

    const fileName = `StatSathi_Clustering_Report_${file.name.split('.')[0]}`;
    const title = "Stat Sathi Clustering Analysis Report";

    if (format === 'txt') {
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      // Styled word tables (centrally aligned)
      const overallMeanCols = selectedCols.map(col => {
        const overallMean = results.records.reduce((acc, r) => acc + (r[col] || 0), 0) / results.records.length;
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${col}</td>
            <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${overallMean.toFixed(4)}</td>
            ${summaries.map(s => {
              const val = s.means[col];
              return `<td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-family: 'Courier New', Courier, monospace;">${val !== null && val !== undefined ? val.toFixed(4) : 'N/A'}</td>`;
            }).join('')}
          </tr>
        `;
      }).join('');

      const sizeCols = `
        <tr style="background-color: #F8FAFC; font-weight: bold;">
          <td style="border: 1px solid #CBD5E1; padding: 8px; color: #1E293B;">Observations Count (N)</td>
          <td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right;">${results.records.length}</td>
          ${summaries.map(s => `<td style="border: 1px solid #CBD5E1; padding: 8px; text-align: right;">${s.count}</td>`).join('')}
        </tr>
      `;

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
          <h1>Clustering Analysis and Risk Zoning Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table">
            <tr>
              <td class="meta-label">Analysis Module</td>
              <td>Unsupervised Machine Learning Clustering</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file.name}</td>
            </tr>
            <tr>
              <td class="meta-label">Clustering Method</td>
              <td>${clusterMethod === 'kmeans' ? 'K-Means' : 'Hierarchical (Ward\'s Linkage)'}</td>
            </tr>
            ${clusterMethod === 'kmeans' ? `
            <tr>
              <td class="meta-label">Specified Clusters (K)</td>
              <td>${k}</td>
            </tr>
            ` : `
            <tr>
              <td class="meta-label">Cut Height Used</td>
              <td>${results.hierarchical.cut_height_used.toFixed(4)}</td>
            </tr>
            `}
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

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">1. Cluster Profiles (Variable Means)</h2>
          <div align="center">
          <table align="center" style="border-collapse: collapse; width: 95%; font-family: Arial, sans-serif; font-size: 10pt; margin-left: auto; margin-right: auto; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">Variable</th>
                <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Overall Mean</th>
                ${summaries.map(s => `<th style="border: 1px solid #CBD5E1; padding: 8px; text-align: right; font-weight: bold;">Cluster ${s.cluster_id}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${overallMeanCols}
              ${sizeCols}
            </tbody>
          </table>
          </div>

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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-brand-indigo">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold text-slate-800">
                Clustering Analysis (Risk Zoning)
              </h2>
              <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                Group observations using unsupervised K-Means or Hierarchical Clustering models for environmental risk zoning.
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
                    Select Numeric Variables for Scaled Normalization
                  </label>
                  {numericColumns.length === 0 ? (
                    <p className="font-sans text-xs text-slate-400">No numeric variables found in dataset.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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
                    <label className="font-sans text-xs font-bold text-slate-500">Clustering Methodology</label>
                    <select
                      value={clusterMethod}
                      onChange={(e) => setClusterMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="kmeans">K-Means Clustering</option>
                      <option value="hierarchical">Hierarchical (Ward's Linkage)</option>
                    </select>
                  </div>

                  {clusterMethod === 'kmeans' ? (
                    <div className="space-y-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                      <div className="flex justify-between items-center">
                        <label className="font-sans text-xs font-bold text-slate-600">Number of Clusters (K): {k}</label>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        value={k}
                        onChange={(e) => setK(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo"
                      />
                      <span className="text-[10px] text-slate-400 block">Set target risk zones or category groupings.</span>
                    </div>
                  ) : (
                    <div className="space-y-3 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                      <label className="font-sans text-xs font-bold text-slate-600 block">Dendrogram Cut Height (Optional)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 5.2 (Leave blank for automatic k)"
                        value={cutHeight}
                        onChange={(e) => setCutHeight(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo transition-all"
                      />
                      <span className="text-[10px] text-slate-400 block leading-tight">Cut-off height for separating tree branches. If empty, cuts to yield k = {k} clusters.</span>
                    </div>
                  )}

                  <div className="space-y-1.5 mt-4">
                    <label className="font-sans text-xs font-bold text-slate-500">Cluster Color Palette</label>
                    <select
                      value={clusterPalette}
                      onChange={(e) => setClusterPalette(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      {Object.keys(CLUSTER_PALETTES).map(paletteKey => (
                        <option key={paletteKey} value={paletteKey}>
                          {CLUSTER_PALETTES[paletteKey].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Execute Clustering Module
              </button>
            </form>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 text-brand-indigo animate-spin" />
              <p className="font-display text-xs font-bold text-slate-500 mt-4">Computing Linkage and Centroid Allocations...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Panel */}
          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 pb-px space-x-6 overflow-x-auto">
                {[
                  { id: 'profile', label: 'Cluster Profiles' },
                  ...(clusterMethod === 'hierarchical' ? [{ id: 'dendrogram', label: 'Dendrogram Tree' }] : []),
                  { id: 'biplot', label: 'Cluster Scatter Plot' },
                  { id: 'data', label: 'Export Dataset' }
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

              {/* Tab 1: Profile Grids */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs overflow-x-auto">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-display text-xs font-bold text-slate-700">Cluster Characteristics (Mean Profiles)</h4>
                      <span className="font-sans text-[10px] text-slate-400 font-bold bg-indigo-50 text-brand-indigo px-2 py-0.5 rounded-lg">
                        Method: {clusterMethod === 'kmeans' ? 'K-Means' : 'Hierarchical'}
                      </span>
                    </div>
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                          <th className="p-3">Variable Name</th>
                          <th className="p-3 text-right">Overall Mean</th>
                          {(clusterMethod === 'kmeans' ? results.kmeans.summaries : results.hierarchical.summaries).map(s => (
                            <th key={s.cluster_id} className="p-3 text-right">Cluster {s.cluster_id}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCols.map(col => {
                          const overallMean = results.records.reduce((acc, r) => acc + (r[col] || 0), 0) / results.records.length;
                          return (
                            <tr key={col} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-700">{col}</td>
                              <td className="p-3 text-right font-mono text-slate-500">{overallMean.toFixed(4)}</td>
                              {(clusterMethod === 'kmeans' ? results.kmeans.summaries : results.hierarchical.summaries).map(s => {
                                const val = s.means[col];
                                return (
                                  <td key={s.cluster_id} className="p-3 text-right font-mono text-slate-800 font-semibold">
                                    {val !== null && val !== undefined ? val.toFixed(4) : 'N/A'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {/* Sample Size Row */}
                        <tr className="border-b border-slate-200 bg-slate-50/30 font-bold text-slate-700">
                          <td className="p-3">Observations Count (N)</td>
                          <td className="p-3 text-right font-mono text-slate-500">{results.records.length}</td>
                          {(clusterMethod === 'kmeans' ? results.kmeans.summaries : results.hierarchical.summaries).map(s => (
                            <td key={s.cluster_id} className="p-3 text-right font-mono text-indigo-600">{s.count}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Dendrogram */}
              {activeTab === 'dendrogram' && clusterMethod === 'hierarchical' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 gap-3">
                    <div className="flex items-center space-x-4">
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
                      <div className="flex items-center space-x-1.5">
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Palette:</label>
                        <select
                          value={clusterPalette}
                          onChange={(e) => setClusterPalette(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
                        >
                          {Object.keys(CLUSTER_PALETTES).map(paletteKey => (
                            <option key={paletteKey} value={paletteKey}>
                              {CLUSTER_PALETTES[paletteKey].name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex space-x-1.5">
                      {['png', 'jpeg', 'svg'].map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => handleDownloadPlot('dendrogram', fmt)}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[9px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          <span>{fmt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
                    <div ref={dendrogramRef} className="w-full h-[400px]"></div>
                  </div>
                </div>
              )}

              {/* Tab 3: Cluster Scatter Plot */}
              {activeTab === 'biplot' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 gap-3">
                    {/* Variable Selectors */}
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1.5">
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">X-Axis:</label>
                        <select
                          value={scatterX}
                          onChange={(e) => setScatterX(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                        >
                          {results.variables.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Y-Axis:</label>
                        <select
                          value={scatterY}
                          onChange={(e) => setScatterY(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
                        >
                          {results.variables.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Palette:</label>
                        <select
                          value={clusterPalette}
                          onChange={(e) => setClusterPalette(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
                        >
                          {Object.keys(CLUSTER_PALETTES).map(paletteKey => (
                            <option key={paletteKey} value={paletteKey}>
                              {CLUSTER_PALETTES[paletteKey].name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

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
                          onClick={() => handleDownloadPlot('biplot', fmt)}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[9px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          <span>{fmt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
                    <div ref={biplotRef} className="w-full h-[450px]"></div>
                  </div>
                </div>
              )}

              {/* Tab 4: Export Data Grid */}
              {activeTab === 'data' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-display text-xs font-bold text-slate-700">Clean Dataset with Cluster Assignment Columns</h4>
                    <span className="font-sans text-[10px] text-slate-400">Total Observations: {results.records.length}</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full border-collapse font-sans text-[11px] text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50/50 sticky top-0">
                          <th className="py-2 pl-3">Index</th>
                          <th className="py-2 text-right">Excel Row</th>
                          {selectedCols.map(col => <th key={col} className="py-2 text-right">{col}</th>)}
                          <th className="py-2 text-right text-indigo-600 font-bold">K-Means Cluster ID</th>
                          <th className="py-2 text-right text-emerald-600 font-bold">Hierarchical Cluster ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.records.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/30">
                            <td className="py-2 pl-3 font-semibold text-slate-400">{row.original_index}</td>
                            <td className="py-2 text-right font-mono text-slate-500">{row.excel_row}</td>
                            {selectedCols.map(col => (
                              <td key={col} className="py-2 text-right font-mono">
                                {row[col] !== null && row[col] !== undefined ? row[col].toFixed(4) : 'N/A'}
                              </td>
                            ))}
                            <td className="py-2 text-right font-mono text-indigo-600 font-bold bg-indigo-50/20">{row.kmeans_cluster}</td>
                            <td className="py-2 text-right font-mono text-emerald-600 font-bold bg-emerald-50/20">{row.hierarchical_cluster}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                Clustering Parameters
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
        onSave={(newFile) => setFile(newFile)}
      />
    </div>
  );
};

export default ClusteringModal;
