import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Info, HelpCircle, Eye, Table, Copy } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import Plotly from 'plotly.js-dist-min';

const DATA_FORMAT_GUIDES = {
  oneway: {
    title: "One Factor (CRD) Expected Format",
    description: "Standard design for comparing treatment groups when the experimental area is homogeneous.",
    headers: ["Treatment", "Yield"],
    rows: [
      ["T1", "45.2"],
      ["T1", "46.8"],
      ["T2", "52.1"],
      ["T2", "51.5"]
    ],
    note: "All observations should be listed vertically (long format). Multiple entries for the same treatment represent replications."
  },
  rbd_oneway: {
    title: "One Factor (RBD) Expected Format",
    description: "Includes a blocking factor (Replication/Block) to control for field/environmental gradients.",
    headers: ["Treatment", "Replication", "Yield"],
    rows: [
      ["T1", "R1", "45.2"],
      ["T1", "R2", "46.8"],
      ["T2", "R1", "52.1"],
      ["T2", "R2", "51.5"]
    ],
    note: "The replication/block factor blocks treatment variation. Data must be balanced across all blocks."
  },
  twoway: {
    title: "Two Factors (CRD) Expected Format",
    description: "Evaluates the main effects and interaction between two categorical factors.",
    headers: ["Factor_A", "Factor_B", "Yield"],
    rows: [
      ["N_Level1", "Irrigated", "65.2"],
      ["N_Level1", "Rainfed", "54.8"],
      ["N_Level2", "Irrigated", "78.4"],
      ["N_Level2", "Rainfed", "62.1"]
    ],
    note: "Columns should represent Factor A treatments, Factor B treatments, and the numeric response."
  },
  rbd_twoway: {
    title: "Two Factors (RBD) Expected Format",
    description: "Two-way factorial design grouped/blocked by replication/block factor.",
    headers: ["Factor_A", "Factor_B", "Replication", "Yield"],
    rows: [
      ["N_Level1", "Irrigated", "R1", "65.2"],
      ["N_Level1", "Irrigated", "R2", "66.8"],
      ["N_Level2", "Rainfed", "R1", "54.8"],
      ["N_Level2", "Rainfed", "R2", "53.5"]
    ],
    note: "Requires Replication block column in addition to both treatment factor columns."
  },
  splitplot: {
    title: "Two Factors (Split-plot) Expected Format",
    description: "Multi-layered design. Main plots are assigned to Factor A, subplots to Factor B, blocked by Replications.",
    headers: ["Main_Plot", "Sub_Plot", "Replication", "Yield"],
    rows: [
      ["Nitrogen1", "Water_Level1", "R1", "75.2"],
      ["Nitrogen1", "Water_Level2", "R1", "81.3"],
      ["Nitrogen1", "Water_Level1", "R2", "74.8"],
      ["Nitrogen2", "Water_Level2", "R2", "88.5"]
    ],
    note: "Ensure that combinations of Main Plot, Sub Plot, and Replications are complete and balanced."
  },
  lsd: {
    title: "Latin Square Design (LSD) Expected Format",
    description: "Standard layout for field studies to block out gradient variation in two perpendicular directions (Rows and Columns).",
    headers: ["Treatment", "Row_Factor", "Column_Factor", "Yield"],
    rows: [
      ["T1", "Row1", "Col1", "45.2"],
      ["T2", "Row1", "Col2", "46.8"],
      ["T3", "Row1", "Col3", "48.1"],
      ["T2", "Row2", "Col1", "52.1"],
      ["T3", "Row2", "Col2", "50.4"],
      ["T1", "Row2", "Col3", "51.5"]
    ],
    note: "The size of rows, columns, and treatments must be equal (e.g. 3x3, 4x4). Each treatment must occur exactly once in each row and column."
  },
  crd_multifactor: {
    title: "Multi-Factor (CRD) Expected Format",
    description: "Evaluates the main effects and all interaction effects among 3 or more categorical factors.",
    headers: ["Factor_A", "Factor_B", "Factor_C", "Yield"],
    rows: [
      ["N_Level1", "Irrigated", "Var1", "65.2"],
      ["N_Level1", "Rainfed", "Var2", "54.8"],
      ["N_Level2", "Irrigated", "Var1", "78.4"],
      ["N_Level2", "Rainfed", "Var2", "62.1"]
    ],
    note: "Select 3 or more factor columns and the numeric dependent variable."
  },
  rbd_multifactor: {
    title: "Multi-Factor (RBD) Expected Format",
    description: "Multi-factor factorial design grouped/blocked by replication/block factor.",
    headers: ["Factor_A", "Factor_B", "Factor_C", "Replication", "Yield"],
    rows: [
      ["N_Level1", "Irrigated", "Var1", "R1", "65.2"],
      ["N_Level1", "Irrigated", "Var1", "R2", "66.8"],
      ["N_Level2", "Rainfed", "Var2", "R1", "54.8"],
      ["N_Level2", "Rainfed", "Var2", "R2", "53.5"]
    ],
    note: "Requires a Replication block column and 3 or more treatment factor columns."
  }
};

const anovaPalettes = [
  { value: 'Oranges', label: 'Agricultural Orange' },
  { value: 'Blues', label: 'Ocean Blue' },
  { value: 'Greens', label: 'Forest Green' },
  { value: 'coolwarm', label: 'Divergent Red-Blue' },
  { value: 'Purples', label: 'Deep Purple' },
  { value: 'magma', label: 'Magma Pink-Black' },
  { value: 'sunset', label: 'Sunset Glow' },
  { value: 'crest', label: 'Crest Teal' }
];

const AnovaModal = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();
  
  // State for dataset selection
  const [file, setFile] = useState(null);




  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // State for test configurations
  const [testType, setTestType] = useState('oneway');
  const [depVar, setDepVar] = useState('');
  const [indVar1, setIndVar1] = useState('');
  const [indVar2, setIndVar2] = useState('');
  const [repVar, setRepVar] = useState('');
  const [selectedFactors, setSelectedFactors] = useState([]);
  const [posthocMethod, setPosthocMethod] = useState('tukey');
  const [palette, setPalette] = useState('Oranges');
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  
  // State for results
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [postHocModalOpen, setPostHocModalOpen] = useState(false);
  const chartRef = useRef(null);

  // Customizations for Post-Hoc Comparison Graph
  const [postHocFontSize, setPostHocFontSize] = useState(10);
  const [postHocFontColor, setPostHocFontColor] = useState('#334155');
  const [postHocBarColor, setPostHocBarColor] = useState('');
  const [postHocChartTitle, setPostHocChartTitle] = useState('');
  const [postHocXLabel, setPostHocXLabel] = useState('Treatment Groups');
  const [postHocYLabel, setPostHocYLabel] = useState('Treatment Means');
  const [postHocSplitFactor, setPostHocSplitFactor] = useState('');
  const [downloadDpi, setDownloadDpi] = useState(300);

  // Customizations for Structured Multi-Factor Interaction Grid Table & Chart
  const [gridRowFactor, setGridRowFactor] = useState('');
  const [gridColFactor1, setGridColFactor1] = useState('');
  const [gridColFactor2, setGridColFactor2] = useState('');
  const [gridCellDisplay, setGridCellDisplay] = useState('mean_letter');
  const [showGridChart, setShowGridChart] = useState(true);
  const [gridChartType, setGridChartType] = useState('bar');
  const [gridTheme, setGridTheme] = useState('agri_green');
  const [gridCustomColor, setGridCustomColor] = useState('');
  const [gridFontSize, setGridFontSize] = useState(10);
  const [gridFontColor, setGridFontColor] = useState('#334155');
  const [gridChartTitle, setGridChartTitle] = useState('');
  const [gridXLabel, setGridXLabel] = useState('');
  const [gridYLabel, setGridYLabel] = useState('');

  useEffect(() => {
    const factors = getAvailableFactors();
    if (factors.length >= 2) {
      if (!gridColFactor1 || !factors.includes(gridColFactor1)) {
        setGridColFactor1(factors[0]);
      }
      if (!gridColFactor2 || !factors.includes(gridColFactor2)) {
        setGridColFactor2(factors.length >= 3 ? factors[1] : '');
      }
      if (!gridRowFactor || !factors.includes(gridRowFactor)) {
        setGridRowFactor(factors[factors.length - 1]);
      }
    }
  }, [results, testType, selectedFactors, indVar1, indVar2]);

  const buildCrossTabulatedData = () => {
    if (!results || !results.descriptives) return null;
    const factors = getAvailableFactors();
    if (factors.length < 2) return null;

    const rFactor = (gridRowFactor && factors.includes(gridRowFactor)) ? gridRowFactor : factors[factors.length - 1];
    const c1Factor = (gridColFactor1 && factors.includes(gridColFactor1) && gridColFactor1 !== rFactor) ? gridColFactor1 : (factors.find(f => f !== rFactor) || factors[0]);
    const c2Factor = (gridColFactor2 && factors.includes(gridColFactor2) && gridColFactor2 !== rFactor && gridColFactor2 !== c1Factor) ? gridColFactor2 : '';

    const rIdx = factors.indexOf(rFactor);
    const c1Idx = factors.indexOf(c1Factor);
    const c2Idx = c2Factor ? factors.indexOf(c2Factor) : -1;

    if (rIdx === -1 || c1Idx === -1) return null;

    const rSet = new Set();
    const c1Set = new Set();
    const c2Set = new Set();

    Object.keys(results.descriptives).forEach(cellName => {
      const parts = cellName.split(' / ').map(p => p.trim());
      if (parts[rIdx] !== undefined) rSet.add(parts[rIdx]);
      if (parts[c1Idx] !== undefined) c1Set.add(parts[c1Idx]);
      if (c2Idx !== -1 && parts[c2Idx] !== undefined) c2Set.add(parts[c2Idx]);
    });

    const rowLevels = Array.from(rSet).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
    const col1Levels = Array.from(c1Set).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
    const col2Levels = c2Factor ? Array.from(c2Set).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'})) : [];

    const cellMap = {};
    Object.entries(results.descriptives).forEach(([cellName, info]) => {
      const parts = cellName.split(' / ').map(p => p.trim());
      const key = [
        parts[rIdx] || '',
        parts[c1Idx] || '',
        c2Idx !== -1 ? (parts[c2Idx] || '') : ''
      ].join('|||');
      cellMap[key] = {
        cellName,
        info,
        letter: results.posthoc_letters?.[cellName] || ''
      };
    });

    return {
      rFactor,
      c1Factor,
      c2Factor,
      rowLevels,
      col1Levels,
      col2Levels,
      cellMap
    };
  };

  const formatGridCellValue = (item) => {
    if (!item || !item.info) return '-';
    const meanStr = item.info.mean.toFixed(3);
    const seStr = item.info.se !== undefined ? item.info.se.toFixed(3) : '';
    const letter = item.letter || '';

    switch (gridCellDisplay) {
      case 'mean_only':
        return meanStr;
      case 'mean_se':
        return seStr ? `${meanStr} ± ${seStr}` : meanStr;
      case 'mean_se_letter':
        return seStr ? `${meanStr} ± ${seStr} ${letter}`.trim() : `${meanStr} ${letter}`.trim();
      case 'mean_letter':
      default:
        return letter ? `${meanStr} ${letter}` : meanStr;
    }
  };

  const handleCopyGridTable = () => {
    const data = buildCrossTabulatedData();
    if (!data) return;
    const { rFactor, c1Factor, c2Factor, rowLevels, col1Levels, col2Levels, cellMap } = data;
    const hasSubHeader = c2Factor && col2Levels.length > 0;

    let html = `<table border="1" style="border-collapse: collapse; text-align: center; font-family: Arial, sans-serif; font-size: 11pt;">`;
    html += `<thead><tr style="background-color: #f1f5f9;">`;
    html += `<th ${hasSubHeader ? 'rowspan="2"' : ''} style="border: 1px solid #94a3b8; padding: 8px; text-align: left; background-color: #e2e8f0;">${rFactor}</th>`;
    col1Levels.forEach(c1 => {
      html += `<th ${hasSubHeader ? `colspan="${col2Levels.length}"` : ''} style="border: 1px solid #94a3b8; padding: 8px; background-color: #e2e8f0;">${c1}</th>`;
    });
    html += `</tr>`;

    if (hasSubHeader) {
      html += `<tr style="background-color: #f8fafc;">`;
      col1Levels.forEach(c1 => {
        col2Levels.forEach(c2 => {
          html += `<th style="border: 1px solid #94a3b8; padding: 6px; background-color: #f1f5f9;">${c2}</th>`;
        });
      });
      html += `</tr>`;
    }
    html += `</thead><tbody>`;

    rowLevels.forEach(rVal => {
      html += `<tr><td style="border: 1px solid #94a3b8; padding: 8px; text-align: left; font-weight: bold; background-color: #f8fafc;">${rVal}</td>`;
      col1Levels.forEach(c1Val => {
        if (hasSubHeader) {
          col2Levels.forEach(c2Val => {
            const key = [rVal, c1Val, c2Val].join('|||');
            const item = cellMap[key];
            html += `<td style="border: 1px solid #94a3b8; padding: 8px;">${formatGridCellValue(item)}</td>`;
          });
        } else {
          const key = [rVal, c1Val, ''].join('|||');
          const item = cellMap[key];
          html += `<td style="border: 1px solid #94a3b8; padding: 8px;">${formatGridCellValue(item)}</td>`;
        }
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    try {
      const type = 'text/html';
      const blob = new Blob([html], { type });
      const dataObj = [new ClipboardItem({ [type]: blob, 'text/plain': new Blob([html], { type: 'text/plain' }) })];
      navigator.clipboard.write(dataObj).then(() => {
        alert("Structured factor grid table copied to clipboard! You can paste it directly into MS Word or Excel.");
      }).catch(() => {
        navigator.clipboard.writeText(html);
        alert("Table HTML copied to clipboard!");
      });
    } catch (e) {
      navigator.clipboard.writeText(html);
      alert("Table HTML copied to clipboard!");
    }
  };

  const handleDownloadGridChart = (format, elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const scale = downloadDpi / 96;
    const filename = `StatSathi_MultiFactor_Grid_Plot_${depVar}_${downloadDpi}dpi`;
    Plotly.downloadImage(el, {
      format: format,
      width: 800,
      height: 500,
      scale: scale,
      filename: filename
    });
  };

  const getSeriesColor = (c1Idx, c2Idx, totalC1, totalC2, theme) => {
    if (theme === 'custom' && gridCustomColor) {
      return gridCustomColor;
    }

    const colorFamilies = {
      forest_field: [
        ['#1E70B8', '#74B3E8', '#93C5FD'], // Blue family (like Image 1)
        ['#E85D26', '#F6A483', '#FED7AA'], // Orange family (like Image 1)
        ['#15803D', '#4ADE80', '#BBF7D0'], // Green family
        ['#7E22CE', '#C084FC', '#F3E8FF']  // Purple family
      ],
      agri_green: [
        ['#15803D', '#4ADE80', '#86EFAC'],
        ['#C2410C', '#FB923C', '#FED7AA'],
        ['#1E40AF', '#60A5FA', '#BFDBFE'],
        ['#6B21A8', '#C084FC', '#F3E8FF']
      ],
      forest_field: [
        ['#1E70B8', '#74B3E8', '#93C5FD'], // Blue family (like Image 1)
        ['#E85D26', '#F6A483', '#FED7AA'], // Orange family (like Image 1)
        ['#15803D', '#4ADE80', '#BBF7D0'], // Green family
        ['#7E22CE', '#C084FC', '#F3E8FF']  // Purple family
      ],
      agri_green: [
        ['#15803D', '#4ADE80', '#86EFAC'],
        ['#166534', '#22C55E', '#BBF7D0'],
        ['#047857', '#34D399', '#A7F3D0'],
        ['#65A30D', '#A3E635', '#ECFCCB']
      ],
      sunset_orange: [
        ['#C2410C', '#F97316', '#FDBA74'],
        ['#B45309', '#F59E0B', '#FDE68A'],
        ['#BE123C', '#FB7185', '#FECDD3'],
        ['#D97706', '#FBBF24', '#FEF08A']
      ],
      ocean_blue: [
        ['#1E3A8A', '#3B82F6', '#93C5FD'],
        ['#0F766E', '#14B8A6', '#99F6E4'],
        ['#4338CA', '#818CF8', '#C7D2FE'],
        ['#0284C7', '#38BDF8', '#BAE6FD']
      ],
      deep_purple: [
        ['#6B21A8', '#A855F7', '#E9D5FF'],
        ['#0369A1', '#38BDF8', '#BAE6FD'],
        ['#BE185D', '#F472B6', '#FBCFE8'],
        ['#4C1D95', '#8B5CF6', '#DDD6FE']
      ],
      coolwarm: [
        ['#1E3A8A', '#60A5FA', '#BFDBFE'],
        ['#B91C1C', '#F87171', '#FCA5A5'],
        ['#047857', '#34D399', '#A7F3D0'],
        ['#D97706', '#FBBF24', '#FEF08A']
      ],
      magma: [
        ['#311042', '#A83267', '#FBB672'],
        ['#111827', '#4B5563', '#9CA3AF'],
        ['#6B1D5C', '#DC5059', '#FED7AA']
      ],
      viridis: [
        ['#0284C7', '#38BDF8', '#BAE6FD'],
        ['#16A34A', '#4ADE80', '#BBF7D0'],
        ['#D97706', '#FBBF24', '#FEF08A'],
        ['#7E22CE', '#C084FC', '#F3E8FF']
      ],
      crimson_gold: [
        ['#BE123C', '#F43F5E', '#FECDD3'],
        ['#D97706', '#FBBF24', '#FEF08A'],
        ['#059669', '#34D399', '#A7F3D0'],
        ['#2563EB', '#60A5FA', '#BFDBFE']
      ],
      autumn_harvest: [
        ['#B45309', '#F59E0B', '#FDE68A'],
        ['#EA580C', '#FB923C', '#FED7AA'],
        ['#65A30D', '#A3E635', '#ECFCCB'],
        ['#86198F', '#E879F9', '#FDE8FF']
      ],
      monochrome_grey: [
        ['#1E293B', '#64748B', '#CBD5E1'],
        ['#334155', '#94A3B8', '#E2E8F0'],
        ['#0F172A', '#475569', '#94A3B8']
      ],
      neon_vibrant: [
        ['#06B6D4', '#67E8F9', '#CFFAFE'],
        ['#FF6B00', '#FF9E00', '#FFE600'],
        ['#84CC16', '#BEF264', '#ECFCCB'],
        ['#EC4899', '#F472B6', '#FCE7F3']
      ]
    };

    const familyList = colorFamilies[theme] || colorFamilies.forest_field;
    const family = familyList[c1Idx % familyList.length];
    return family[c2Idx % family.length] || family[0];
  };

  useEffect(() => {
    let active = true;
    const data = buildCrossTabulatedData();
    if (!data || !showGridChart) return;

    const mainEl = document.getElementById('plotly-grid-main');
    const posthocEl = document.getElementById('plotly-grid-posthoc');

    if (!mainEl && !posthocEl) return;

    const { rFactor, c1Factor, c2Factor, rowLevels, col1Levels, col2Levels, cellMap } = data;
    const hasSubHeader = c2Factor && col2Levels.length > 0;

    const seriesList = [];
    if (hasSubHeader) {
      col1Levels.forEach((c1, c1Idx) => {
        col2Levels.forEach((c2, c2Idx) => {
          const sColor = getSeriesColor(c1Idx, c2Idx, col1Levels.length, col2Levels.length, gridTheme);
          seriesList.push({ name: `${c1}, ${c2}`, c1, c2, color: sColor });
        });
      });
    } else {
      col1Levels.forEach((c1, c1Idx) => {
        const sColor = getSeriesColor(c1Idx, 0, col1Levels.length, 1, gridTheme);
        seriesList.push({ name: c1, c1, c2: '', color: sColor });
      });
    }

    const traces = seriesList.map((s) => {
      const sColor = (gridTheme === 'custom' && gridCustomColor) ? gridCustomColor : s.color;

      const yData = rowLevels.map(rVal => {
        const key = [rVal, s.c1, s.c2].join('|||');
        return cellMap[key]?.info?.mean ?? 0;
      });

      const seData = rowLevels.map(rVal => {
        const key = [rVal, s.c1, s.c2].join('|||');
        return cellMap[key]?.info?.se ?? 0;
      });

      const textLetters = rowLevels.map(rVal => {
        const key = [rVal, s.c1, s.c2].join('|||');
        return cellMap[key]?.letter || '';
      });

      return {
        x: rowLevels,
        y: yData,
        name: s.name,
        type: gridChartType === 'line' ? 'scatter' : 'bar',
        mode: gridChartType === 'line' ? 'lines+markers' : undefined,
        marker: {
          color: sColor,
          size: gridChartType === 'line' ? 8 : undefined,
          line: { color: '#000000', width: 0.5 }
        },
        line: gridChartType === 'line' ? { color: sColor, width: 2.5 } : undefined,
        error_y: {
          type: 'data',
          array: seData,
          visible: true,
          color: '#000000',
          thickness: 1.5,
          width: 4
        },
        text: textLetters,
        textposition: 'outside',
        textfont: {
          family: 'Arial, sans-serif',
          size: Math.max(9, gridFontSize),
          color: '#000000',
          weight: 'bold'
        },
        cliponaxis: false
      };
    });

    const dynamicMarginL = Math.max(70, gridFontSize * 4.5);
    const dynamicMarginB = Math.max(70, gridFontSize * 5);
    const dynamicMarginT = Math.max(70, gridFontSize * 4);
    const dynamicMarginR = Math.max(40, gridFontSize * 2);

    const layout = {
      autosize: true,
      height: Math.max(380, 340 + gridFontSize * 4),
      width: 720,
      margin: { l: dynamicMarginL, r: dynamicMarginR, t: dynamicMarginT, b: dynamicMarginB },
      font: { family: 'Arial, sans-serif', size: gridFontSize, color: gridFontColor },
      title: {
        text: gridChartTitle ? gridChartTitle : `${depVar || 'Response'} — ${c1Factor}${c2Factor ? ' vs ' + c2Factor : ''}`,
        font: { size: gridFontSize + 4, family: 'Arial, sans-serif', weight: 'bold', color: gridFontColor }
      },
      barmode: 'group',
      xaxis: {
        title: {
          text: gridXLabel || rFactor,
          font: { size: gridFontSize + 2, family: 'Arial, sans-serif', weight: 'bold', color: gridFontColor }
        },
        tickfont: { color: gridFontColor, size: gridFontSize + 1, family: 'Arial, sans-serif', weight: 'bold' },
        showline: true,
        linecolor: '#000000',
        linewidth: 1.5,
        showgrid: false,
        zeroline: false,
        automargin: true
      },
      yaxis: {
        title: {
          text: gridYLabel || (depVar ? `${depVar}` : 'Response Mean'),
          font: { size: gridFontSize + 2, family: 'Arial, sans-serif', weight: 'bold', color: gridFontColor }
        },
        tickfont: { color: gridFontColor, size: gridFontSize + 1, family: 'Arial, sans-serif', weight: 'bold' },
        showline: true,
        linecolor: '#000000',
        linewidth: 1.5,
        showgrid: false,
        zeroline: false,
        automargin: true
      },
      legend: {
        orientation: 'h',
        y: 1.14,
        x: 0.98,
        xanchor: 'right',
        font: { size: Math.max(9, gridFontSize), color: gridFontColor, family: 'Arial, sans-serif', weight: 'bold' }
      },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff'
    };

    const config = { responsive: true, displayModeBar: false };

    setTimeout(() => {
      if (!active) return;
      if (mainEl) Plotly.newPlot(mainEl, traces, layout, config);
      if (posthocEl) Plotly.newPlot(posthocEl, traces, layout, config);
    }, 100);

    return () => {
      active = false;
      if (mainEl) Plotly.purge(mainEl);
      if (posthocEl) Plotly.purge(posthocEl);
    };
  }, [results, testType, selectedFactors, indVar1, indVar2, gridRowFactor, gridColFactor1, gridColFactor2, gridCellDisplay, showGridChart, gridChartType, gridTheme, gridCustomColor, gridFontSize, gridFontColor, gridChartTitle, gridXLabel, gridYLabel, postHocModalOpen]);

  const renderStructuredGridTableCard = (isModal = false) => {
    const data = buildCrossTabulatedData();
    if (!data) return null;
    const factors = getAvailableFactors();
    const { rFactor, c1Factor, c2Factor, rowLevels, col1Levels, col2Levels, cellMap } = data;
    const hasSubHeader = c2Factor && col2Levels.length > 0;
    const elementId = isModal ? 'plotly-grid-posthoc' : 'plotly-grid-main';

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h5 className="font-display text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Table className="h-4 w-4 text-brand-orange" />
              <span>Multi-Factor Structured Interaction Grid Table & Chart</span>
            </h5>
            <p className="font-sans text-[10px] text-slate-400 mt-0.5">
              Cross-tabulated mean comparison grid & multi-series interaction graph (Word/Excel exportable format).
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowGridChart(!showGridChart)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-sans text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>{showGridChart ? 'Hide Interaction Plot' : 'Show Interaction Plot'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyGridTable}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Table for Word/Excel</span>
            </button>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
          {/* Row Factor */}
          <div className="space-y-1">
            <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Row Factor (Vertical)</label>
            <select
              value={gridRowFactor || rFactor}
              onChange={(e) => setGridRowFactor(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2.5 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all cursor-pointer"
            >
              {factors.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Col Factor 1 */}
          <div className="space-y-1">
            <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Column Factor 1 (Primary)</label>
            <select
              value={gridColFactor1 || c1Factor}
              onChange={(e) => setGridColFactor1(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2.5 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all cursor-pointer"
            >
              {factors.filter(f => f !== (gridRowFactor || rFactor)).map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Col Factor 2 */}
          <div className="space-y-1">
            <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Column Factor 2 (Sub-header)</label>
            <select
              value={gridColFactor2}
              onChange={(e) => setGridColFactor2(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2.5 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all cursor-pointer"
            >
              <option value="">-- None (Single Header) --</option>
              {factors.filter(f => f !== (gridRowFactor || rFactor) && f !== (gridColFactor1 || c1Factor)).map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Display Value */}
          <div className="space-y-1">
            <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Cell Content Format</label>
            <select
              value={gridCellDisplay}
              onChange={(e) => setGridCellDisplay(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2.5 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 transition-all cursor-pointer"
            >
              <option value="mean_letter">Mean + Group Letter (e.g. 15.20 a)</option>
              <option value="mean_only">Mean Only (e.g. 15.20)</option>
              <option value="mean_se">Mean ± S.E. (e.g. 15.20 ± 0.32)</option>
              <option value="mean_se_letter">Mean ± S.E. + Letter (e.g. 15.20 ± 0.32 a)</option>
            </select>
          </div>
        </div>

        {/* Table Render */}
        <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-xs">
          <table className="w-full border-collapse font-sans text-xs text-center border border-slate-300">
            <thead>
              {/* Header Row 1 */}
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th
                  rowSpan={hasSubHeader ? 2 : 1}
                  className="border border-slate-300 p-2.5 text-left font-bold bg-slate-100 min-w-[140px]"
                >
                  {rFactor}
                </th>
                {col1Levels.map(c1 => (
                  <th
                    key={c1}
                    colSpan={hasSubHeader ? col2Levels.length : 1}
                    className="border border-slate-300 p-2.5 text-center font-bold bg-slate-100"
                  >
                    {c1}
                  </th>
                ))}
              </tr>

              {/* Header Row 2 */}
              {hasSubHeader && (
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-300">
                  {col1Levels.map(c1 => (
                    col2Levels.map(c2 => (
                      <th key={`${c1}_${c2}`} className="border border-slate-300 p-2 text-center font-semibold bg-slate-50">
                        {c2}
                      </th>
                    ))
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {rowLevels.map(rVal => (
                <tr key={rVal} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                  <td className="border border-slate-300 p-2.5 text-left font-semibold text-slate-800 bg-slate-50/30">
                    {rVal}
                  </td>
                  {col1Levels.map(c1Val => (
                    hasSubHeader ? (
                      col2Levels.map(c2Val => {
                        const key = [rVal, c1Val, c2Val].join('|||');
                        const item = cellMap[key];
                        return (
                          <td key={key} className="border border-slate-300 p-2.5 text-center font-mono text-slate-700">
                            {formatGridCellValue(item)}
                          </td>
                        );
                      })
                    ) : (
                      (() => {
                        const key = [rVal, c1Val, ''].join('|||');
                        const item = cellMap[key];
                        return (
                          <td key={key} className="border border-slate-300 p-2.5 text-center font-mono text-slate-700">
                            {formatGridCellValue(item)}
                          </td>
                        );
                      })()
                    )
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Interaction Plot & Chart Customization Panel */}
        {showGridChart && (
          <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in">
            {/* Chart Customization Controls (Matching Image 1) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs space-y-4">
              <h5 className="font-display text-xs font-bold text-slate-700">Customize Graph Settings</h5>
              
              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Font Size */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">FONT SIZE (PX)</label>
                  <input
                    type="number"
                    min="6"
                    max="24"
                    value={gridFontSize}
                    onChange={(e) => setGridFontSize(parseInt(e.target.value) || 10)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  />
                </div>

                {/* Font Color */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">FONT COLOR</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={gridFontColor.startsWith('#') && gridFontColor.length === 7 ? gridFontColor : '#334155'}
                      onChange={(e) => setGridFontColor(e.target.value)}
                      className="h-8 w-10 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="#334155"
                      value={gridFontColor}
                      onChange={(e) => setGridFontColor(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    />
                  </div>
                </div>

                {/* Color Scheme */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">COLOR SCHEME</label>
                  <select
                    value={gridTheme}
                    onChange={(e) => setGridTheme(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all cursor-pointer"
                  >
                    <option value="forest_field">Forest Green & Blue/Orange (Image 1)</option>
                    <option value="agri_green">Agriculture Green</option>
                    <option value="sunset_orange">Sunset Orange</option>
                    <option value="ocean_blue">Ocean Blue</option>
                    <option value="deep_purple">Deep Purple</option>
                    <option value="coolwarm">Divergent Coolwarm</option>
                    <option value="magma">Magma Dark</option>
                    <option value="viridis">Viridis Scientific</option>
                    <option value="crimson_gold">Crimson & Gold</option>
                    <option value="autumn_harvest">Autumn Harvest</option>
                    <option value="monochrome_grey">Publication Greyscale (Journal)</option>
                    <option value="neon_vibrant">Modern Cyber Vibrant</option>
                    <option value="custom">Custom Color of Choice</option>
                  </select>
                </div>

                {/* Bar Color */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">BAR COLOR</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={gridCustomColor.startsWith('#') && gridCustomColor.length === 7 ? gridCustomColor : '#EA580C'}
                      onChange={(e) => {
                        setGridCustomColor(e.target.value);
                        setGridTheme('custom');
                      }}
                      className="h-8 w-10 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="Default theme color"
                      value={gridCustomColor}
                      onChange={(e) => {
                        setGridCustomColor(e.target.value);
                        if (e.target.value) setGridTheme('custom');
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                {/* Chart Type */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">CHART TYPE</label>
                  <select
                    value={gridChartType}
                    onChange={(e) => setGridChartType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all cursor-pointer"
                  >
                    <option value="bar">Grouped Bar Chart</option>
                    <option value="line">Grouped Line Plot</option>
                  </select>
                </div>

                {/* Chart Title */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">CHART TITLE</label>
                  <input
                    type="text"
                    placeholder="e.g. Mean Separation Plot"
                    value={gridChartTitle}
                    onChange={(e) => setGridChartTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  />
                </div>

                {/* X-Axis Label */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">X-AXIS LABEL</label>
                  <input
                    type="text"
                    placeholder={rFactor || "Treatment Groups"}
                    value={gridXLabel}
                    onChange={(e) => setGridXLabel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  />
                </div>

                {/* Y-Axis Label */}
                <div className="space-y-1">
                  <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Y-AXIS LABEL</label>
                  <input
                    type="text"
                    placeholder={depVar || "Response Mean"}
                    value={gridYLabel}
                    onChange={(e) => setGridYLabel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Plot Container */}
            <div className="w-full bg-white rounded-xl p-3 border border-slate-100 shadow-xs flex flex-col items-center">
              <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="font-sans text-[11px] font-semibold text-slate-600">
                  {rFactor} × {c1Factor}{c2Factor ? ' × ' + c2Factor : ''} Interaction Graph
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadGridChart('png', elementId)}
                    className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadGridChart('svg', elementId)}
                    className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>SVG</span>
                  </button>
                </div>
              </div>
              <div id={elementId} className="w-full max-w-full min-h-[340px]" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const getAvailableFactors = () => {
    if (['crd_multifactor', 'rbd_multifactor'].includes(testType)) {
      return selectedFactors;
    }
    if (['twoway', 'rbd_twoway', 'splitplot'].includes(testType)) {
      return [indVar1, indVar2].filter(Boolean);
    }
    return [];
  };

  const getSplitLevels = () => {
    if (!results || !results.descriptives || !postHocSplitFactor) return [];
    const factors = getAvailableFactors();
    const splitIndex = factors.indexOf(postHocSplitFactor);
    if (splitIndex === -1) return [];

    const levelsSet = new Set();
    Object.keys(results.descriptives).forEach(cellName => {
      const parts = cellName.split(' / ');
      if (parts[splitIndex] !== undefined) {
        levelsSet.add(parts[splitIndex].trim());
      }
    });
    return Array.from(levelsSet).sort();
  };

  const getFilteredDataForLevel = (level) => {
    const factors = getAvailableFactors();
    const splitIndex = factors.indexOf(postHocSplitFactor);
    if (splitIndex === -1) return [];

    return Object.entries(results.descriptives || {})
      .filter(([cellName]) => {
        const parts = cellName.split(' / ');
        return parts[splitIndex] && parts[splitIndex].trim() === level;
      })
      .map(([cellName, info]) => {
        const parts = cellName.split(' / ');
        const otherParts = parts.filter((_, idx) => idx !== splitIndex);
        const remainingLabel = otherParts.join(' / ');
        return {
          originalName: cellName,
          displayName: remainingLabel,
          info
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, {numeric: true, sensitivity: 'base'}));
  };

  useEffect(() => {
    if (depVar) {
      setPostHocYLabel(depVar);
    }
  }, [depVar]);

  useEffect(() => {
    let active = true;
    if (!postHocModalOpen || !results) return;

    const factors = getAvailableFactors();
    const splitIndex = factors.indexOf(postHocSplitFactor);

    const paletteMap = {
      Oranges: { primary: '#EA580C', line: '#9A3412', accent: '#D97706' },
      Blues: { primary: '#2563EB', line: '#1E40AF', accent: '#0284C7' },
      Greens: { primary: '#16A34A', line: '#166534', accent: '#0D9488' },
      coolwarm: { primary: '#4F46E5', line: '#3730A3', accent: '#EF4444' },
      Purples: { primary: '#9333EA', line: '#6B21A8', accent: '#EC4899' },
      magma: { primary: '#581C87', line: '#3B0764', accent: '#F97316' },
      sunset: { primary: '#BE123C', line: '#9F1239', accent: '#F59E0B' },
      crest: { primary: '#047857', line: '#065F46', accent: '#06B6D4' }
    };

    const currentTheme = paletteMap[palette] || paletteMap.Oranges;
    const barColor = postHocBarColor || currentTheme.primary;

    const renderChart = (element, xData, yData, seData, textData, subTitle) => {
      if (!element) return;
      const data = [
        {
          x: xData,
          y: yData,
          type: 'bar',
          marker: {
            color: barColor,
            line: {
              color: currentTheme.line,
              width: 1.5
            }
          },
          error_y: {
            type: 'data',
            array: seData,
            visible: true,
            color: currentTheme.accent,
            thickness: 1.5,
            width: 4
          },
          text: textData,
          textposition: 'outside',
          cliponaxis: false
        }
      ];

      const dynamicMarginL = Math.max(60, postHocFontSize * 4);
      const dynamicMarginB = Math.max(70, postHocFontSize * 4);
      const dynamicMarginT = Math.max(60, postHocFontSize * 3 + 10);
      const dynamicMarginR = Math.max(30, postHocFontSize * 2);

      const layout = {
        autosize: true,
        height: Math.max(320, 280 + postHocFontSize * 4),
        width: 680,
        margin: { l: dynamicMarginL, r: dynamicMarginR, t: dynamicMarginT, b: dynamicMarginB },
        font: { family: 'Inter, sans-serif', size: postHocFontSize, color: postHocFontColor },
        title: {
          text: postHocChartTitle ? `${postHocChartTitle} (${subTitle})` : `${subTitle} Mean Comparison`,
          font: { size: postHocFontSize + 3, family: 'Inter', weight: 'bold', color: postHocFontColor }
        },
        xaxis: {
          title: { text: postHocXLabel, font: { size: postHocFontSize + 1, family: 'Inter', weight: 'bold', color: postHocFontColor }, standoff: Math.max(10, postHocFontSize * 0.8) },
          tickangle: 15,
          tickfont: { color: postHocFontColor, size: postHocFontSize },
          automargin: true
        },
        yaxis: {
          title: { text: postHocYLabel, font: { size: postHocFontSize + 1, family: 'Inter', weight: 'bold', color: postHocFontColor }, standoff: Math.max(10, postHocFontSize * 0.8) },
          tickfont: { color: postHocFontColor, size: postHocFontSize },
          automargin: true
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
      };

      const config = { responsive: true, displayModeBar: false };
      Plotly.newPlot(element, data, layout, config);
    };

    setTimeout(() => {
      if (!active) return;
      if (splitIndex !== -1 && postHocSplitFactor) {
        const levels = getSplitLevels();
        levels.forEach((level, idx) => {
          const el = document.getElementById(`plotly-posthoc-${idx}`);
          if (el) {
            const filtered = getFilteredDataForLevel(level);
            const xData = filtered.map(item => item.displayName);
            const yData = filtered.map(item => item.info.mean);
            const seData = filtered.map(item => item.info.se || 0);
            const textData = filtered.map(item => results.posthoc_letters?.[item.originalName] || '');
            renderChart(el, xData, yData, seData, textData, `${postHocSplitFactor}: ${level}`);
          }
        });
      } else {
        const el = chartRef.current;
        if (el) {
          const sortedDescriptives = Object.entries(results.descriptives || {})
            .sort((a, b) => a[0].localeCompare(b[0], undefined, {numeric: true, sensitivity: 'base'}));
          const xData = sortedDescriptives.map(([name]) => name);
          const yData = sortedDescriptives.map(([_, info]) => info.mean);
          const seData = sortedDescriptives.map(([_, info]) => info.se || 0);
          const textData = sortedDescriptives.map(([name]) => results.posthoc_letters?.[name] || '');
          renderChart(el, xData, yData, seData, textData, 'All Treatments');
        }
      }
    }, 100);

    return () => {
      active = false;
      if (chartRef.current) {
        Plotly.purge(chartRef.current);
      }
      const levels = getSplitLevels();
      levels.forEach((_, idx) => {
        const el = document.getElementById(`plotly-posthoc-${idx}`);
        if (el) {
          Plotly.purge(el);
        }
      });
    };
  }, [postHocModalOpen, results, palette, postHocFontSize, postHocFontColor, postHocBarColor, postHocChartTitle, postHocXLabel, postHocYLabel, postHocSplitFactor]);

  const handleDownloadPostHocReport = (format) => {
    if (!results) return;

    const posthocMethodLabels = {
      tukey: "Tukey's HSD / LSD",
      duncan: "Duncan's Multiple Range Test (DMRT)",
      games_howell: "Games-Howell"
    };
    const currentMethodLabel = posthocMethodLabels[posthocMethod] || posthocMethod;

    let reportText = `================================================================================\n`;
    reportText += `POST-HOC MEAN SEPARATION ANALYSIS REPORT (${currentMethodLabel.toUpperCase()})\n`;
    reportText += `================================================================================\n`;
    reportText += `Generated on: ${new Date().toLocaleString()}\n`;
    reportText += `Dependent Variable: ${depVar}\n`;
    reportText += `Factor A (Treatment Group): ${indVar1}\n`;
    if (indVar2) {
      reportText += `Factor B: ${indVar2}\n`;
    }
    if (repVar) {
      reportText += `Replication/Block Factor: ${repVar}\n`;
    }
    
    const layoutNames = {
      oneway: "Completely Randomized Design (CRD) - One Factor",
      rbd_oneway: "Randomized Block Design (RBD) - One Factor",
      lsd: "Latin Square Design (LSD)",
      twoway: "Completely Randomized Design (CRD) - Two Factors",
      rbd_twoway: "Randomized Block Design (RBD) - Two Factors",
      splitplot: "Split-plot Design"
    };
    reportText += `Experimental Layout: ${layoutNames[testType] || testType}\n`;
    reportText += `--------------------------------------------------------------------------------\n\n`;

    reportText += `SIGNIFICANCE GROUPING TABLE (CD at 5% level)\n`;
    reportText += `--------------------------------------------------------------------------------\n`;
    reportText += `TreatmentGroup              Mean        S.E.        Significance Group\n`;
    reportText += `--------------------------------------------------------------------------------\n`;

    const sortedDescriptives = Object.entries(results.descriptives || {})
      .sort((a, b) => a[0].localeCompare(b[0], undefined, {numeric: true, sensitivity: 'base'}));

    sortedDescriptives.forEach(([cellName, info]) => {
      const nameStr = cellName.padEnd(27, ' ');
      const meanStr = info.mean.toFixed(3).padStart(10, ' ');
      const seStr = (info.se !== undefined ? info.se.toFixed(3) : '-').padStart(11, ' ');
      const groupStr = (results.posthoc_letters?.[cellName] || '-').padStart(20, ' ');
      reportText += `${nameStr}${meanStr}${seStr}${groupStr}\n`;
    });
    reportText += `--------------------------------------------------------------------------------\n\n`;

    reportText += `Summary ANOVA Metrics:\n`;
    reportText += `  - Grand Mean: ${results.grand_mean ? results.grand_mean.toFixed(3) : 'N/A'}\n`;
    reportText += `  - Coefficient of Variation (C.V. %): ${results.cv ? results.cv.toFixed(3) : 'N/A'}\n`;
    reportText += `  - Standard Error of Mean (SE(m)): ${results.sem ? results.sem.toFixed(3) : 'N/A'}\n`;

    if (results.cd_results && results.cd_results.length > 0) {
      reportText += `\nCritical Differences & Standard Errors of Difference:\n`;
      results.cd_results.forEach(r => {
        reportText += `  - ${r.parameter}:\n`;
        reportText += `    SE(d): ${r.se_d.toFixed(3)}\n`;
        reportText += `    C.D. 5%: ${r.cd_5.toFixed(3)}\n`;
        reportText += `    C.D. 1%: ${r.cd_1.toFixed(3)}\n`;
      });
    }

    reportText += `\n================================================================================\n`;
    reportText += `Stat Sathi - Your Trustworthy Research Analytics Companion\n`;
    reportText += `Curated by Ravi, PhD Scholar ICAR-IISS\n`;
    reportText += `================================================================================\n`;

    const fileName = `StatSathi_PostHoc_Report_${depVar}`;
    const title = `Stat Sathi Post-Hoc ${currentMethodLabel} Report`;

    if (format === 'txt') {
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      const sortedDescriptives = Object.entries(results.descriptives || {})
        .sort((a, b) => a[0].localeCompare(b[0], undefined, {numeric: true, sensitivity: 'base'}));

      const significanceRows = sortedDescriptives.map(([cellName, info]) => {
        const meanStr = info.mean.toFixed(3);
        const seStr = info.se !== undefined ? info.se.toFixed(3) : '-';
        const groupStr = results.posthoc_letters?.[cellName] || '-';
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${cellName}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${meanStr}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${seStr}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold; color: #F97316;">${groupStr}</td>
          </tr>
        `;
      }).join('');

      let cdRows = '';
      if (results.cd_results && results.cd_results.length > 0) {
        cdRows = results.cd_results.map(r => `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${r.parameter}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.se_d.toFixed(3)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #4F46E5;">${r.cd_5.toFixed(3)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #F97316;">${r.cd_1.toFixed(3)}</td>
          </tr>
        `).join('');
      }

      const layoutNames = {
        oneway: "Completely Randomized Design (CRD) - One Factor",
        rbd_oneway: "Randomized Block Design (RBD) - One Factor",
        lsd: "Latin Square Design (LSD)",
        twoway: "Completely Randomized Design (CRD) - Two Factors",
        rbd_twoway: "Randomized Block Design (RBD) - Two Factors",
        splitplot: "Split-plot Design"
      };

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
          <h1>Post-Hoc Mean Separation Analysis Report (${currentMethodLabel})</h1>
          
          <div align="center">
          <table align="center" class="meta-table" style="width: 75%;">
            <tr>
              <td class="meta-label">Dependent Variable</td>
              <td>${depVar}</td>
            </tr>
            <tr>
              <td class="meta-label">Factor A (Treatment Group)</td>
              <td>${indVar1}</td>
            </tr>
            ${indVar2 ? `
            <tr>
              <td class="meta-label">Factor B</td>
              <td>${indVar2}</td>
            </tr>
            ` : ''}
            ${repVar ? `
            <tr>
              <td class="meta-label">Replication/Block Factor</td>
              <td>${repVar}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="meta-label">Experimental Layout</td>
              <td>${layoutNames[testType] || testType}</td>
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

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Significance Grouping Table (CD at 5% level)</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 80%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Treatment Group</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Mean</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">S.E.</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold;">Significance Group</th>
              </tr>
            </thead>
            <tbody>
              ${significanceRows}
            </tbody>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Summary ANOVA Metrics</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 80%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Metric</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Grand Mean</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${results.grand_mean ? results.grand_mean.toFixed(3) : 'N/A'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Coefficient of Variation (C.V. %)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${results.cv ? results.cv.toFixed(3) + '%' : 'N/A'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Standard Error of Mean (SE(m))</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${results.sem ? results.sem.toFixed(3) : 'N/A'}</td>
              </tr>
            </tbody>
          </table>
          </div>

          ${cdRows ? `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Critical Differences & Standard Errors of Difference</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 80%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Parameter</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SE(d)</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">C.D. 5%</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">C.D. 1%</th>
              </tr>
            </thead>
            <tbody>
              ${cdRows}
            </tbody>
          </table>
          </div>
          ` : ''}

          <p style="margin-top: 40px; font-size: 9pt; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; text-align: center;">
            Stat Sathi &copy; 2026 - Your Trustworthy Research Analytics Companion - developed by Ravi, PhD Scholar in IISS Bhopal
          </p>
        </body>
        </html>
      `;
      const centeredHtml = htmlContent
        .replace(/width:\s*100%/gi, 'width: 80%')
        .replace(/class="meta-table"/gi, 'class="meta-table" style="width: 75%;"')
        .replace(/<table([^>]*)>/gi, (match, attrs) => {
          let newAttrs = attrs;
          if (/width:\s*100%/i.test(newAttrs)) {
            newAttrs = newAttrs.replace(/width:\s*100%/i, 'width: 80%');
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

  const handleDownloadPostHocChart = (format) => {
    const scale = downloadDpi / 96;
    const filenameBase = `StatSathi_PostHoc_Chart_${depVar}_${downloadDpi}dpi`;

    const factors = getAvailableFactors();
    const splitIndex = factors.indexOf(postHocSplitFactor);

    if (splitIndex !== -1 && postHocSplitFactor) {
      const levels = getSplitLevels();
      levels.forEach((level, idx) => {
        const el = document.getElementById(`plotly-posthoc-${idx}`);
        if (el) {
          Plotly.downloadImage(el, {
            format: format,
            width: 800,
            height: 500,
            scale: scale,
            filename: `${filenameBase}_${postHocSplitFactor}_${level}`
          });
        }
      });
    } else {
      if (!chartRef.current) return;
      Plotly.downloadImage(chartRef.current, {
        format: format,
        width: 800,
        height: 500,
        scale: scale,
        filename: filenameBase
      });
    }
  };

  const formatPValue = (p) => {
    if (typeof p !== 'number') return 'p = N/A';
    if (p < 0.001) return 'p < 0.001';
    return `p = ${p.toFixed(3)}`;
  };

  const handleReset = () => {
    setFile(null);
    setColumns([]);
    setNumericColumns([]);
    setTestType('oneway');
    setDepVar('');
    setIndVar1('');
    setIndVar2('');
    setRepVar('');
    setSelectedFactors([]);
    setPosthocMethod('tukey');
    setPostHocChartTitle('');
    setPostHocXLabel('Treatment Groups');
    setPostHocYLabel('Treatment Means');
    setPostHocSplitFactor('');
    setResults(null);
    setError(null);
    setShowFormatGuide(false);
    setPostHocModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  useEffect(() => {
    // Reset hidden fields when layout type changes to prevent dirty payload submission
    if (!['twoway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType)) {
      setIndVar2('');
    }
    if (!['rbd_oneway', 'rbd_twoway', 'splitplot', 'lsd', 'rbd_multifactor'].includes(testType)) {
      setRepVar('');
    }
    if (!['crd_multifactor', 'rbd_multifactor'].includes(testType)) {
      setSelectedFactors([]);
    }
  }, [testType]);

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
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleSaveEditedData = async (editedFile) => {
    setResults(null);
    setError(null);
    if (editedFile) {
      await handleFileSelected(editedFile);
    }
  };

  const handleFileSelected = async (selectedFile) => {
    setError(null);
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError("Supported formats: CSV or Excel (.xlsx, .xls) only.");
      return;
    }

    setFile(selectedFile);
    setLoadingCols(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_URL}/analyze/columns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to read columns.");
      }

      setColumns(data.columns || []);
      setNumericColumns(data.numeric_columns || []);

      if (data.numeric_columns && data.numeric_columns.length > 0) {
        setDepVar(data.numeric_columns[0]);
      }

      const allCols = data.columns || [];
      if (allCols.length > 0) {
        const diffCols = allCols.filter(c => !data.numeric_columns.includes(c));
        if (diffCols.length > 0) {
          setIndVar1(diffCols[0]);
          if (diffCols.length > 1) {
            setIndVar2(diffCols[1]);
          } else {
            setIndVar2(allCols[0]);
          }
          if (diffCols.length > 2) {
            setRepVar(diffCols[2]);
          } else {
            setRepVar(allCols[0]);
          }
        } else {
          setIndVar1(allCols[0]);
          if (allCols.length > 1) {
            setIndVar2(allCols[1]);
          }
          if (allCols.length > 2) {
            setRepVar(allCols[2]);
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setFile(null);
    } finally {
      setLoadingCols(false);
    }
  };

  const runAnalysis = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setError(null);
    console.log("runAnalysis started:", { file, depVar, indVar1 });

    if (!file) {
      setError("Please upload a dataset first.");
      return;
    }
    if (!depVar) {
      setError("Please select a Dependent Variable (Numeric/Yield).");
      return;
    }

    const isMultiFactor = ['crd_multifactor', 'rbd_multifactor'].includes(testType);

    if (isMultiFactor) {
      if (selectedFactors.length < 3) {
        setError("Please select at least 3 factors for Multi-Factor ANOVA.");
        return;
      }
      if (selectedFactors.includes(depVar)) {
        setError("Dependent variable cannot be one of the factors.");
        return;
      }
      if (testType === 'rbd_multifactor') {
        if (!repVar) {
          setError("Replication/Block Factor is required for RBD Multi-Factor.");
          return;
        }
        if (selectedFactors.includes(repVar)) {
          setError("Replication/Block factor cannot be one of the factors.");
          return;
        }
      }
    } else {
      if (!indVar1) {
        setError(testType === 'lsd' ? "Please select a Treatment column." : "Please select Independent Factor 1.");
        return;
      }

      if (['twoway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType) && !indVar2) {
        setError(testType === 'lsd' ? "Column Factor is required for LSD design." : "Independent Factor 2 (Factor B) is required for this configuration.");
        return;
      }

      if (['rbd_oneway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType) && !repVar) {
        setError(testType === 'lsd' ? "Row Factor is required for LSD design." : "Replication/Block Factor is required for this configuration.");
        return;
      }

      if (['twoway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType) && indVar1 === indVar2) {
        setError(testType === 'lsd' ? "Treatments and Column Factor must be different columns." : "Factor A and Factor B must be different columns.");
        return;
      }

      if (['rbd_oneway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType) && (indVar1 === repVar || indVar2 === repVar)) {
        setError(testType === 'lsd' ? "Row Factor must be a different column than Treatments or Column Factor." : "Replication/Block factor must be a different column than Factor A or Factor B.");
        return;
      }
    }

    setLoadingAnalysis(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('test_type', testType);
    formData.append('dep_var', depVar);
    
    if (isMultiFactor) {
      formData.append('factors', selectedFactors.join(','));
      formData.append('ind_var1', selectedFactors[0]);
    } else {
      formData.append('ind_var1', indVar1);
      if (['twoway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType) && indVar2) {
        formData.append('ind_var2', indVar2);
      }
    }
    
    if (['rbd_oneway', 'rbd_twoway', 'splitplot', 'lsd', 'rbd_multifactor'].includes(testType) && repVar) {
      formData.append('rep_var', repVar);
    }
    formData.append('posthoc_method', posthocMethod);
    formData.append('palette', palette);

    try {
      const res = await fetch(`${API_URL}/analyze/anova`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "ANOVA calculation execution failed.");
      }
      setResults(data);
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

  const handleDownloadPlot = () => {
    if (!results || !results.plot) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${results.plot}`;
    link.download = `anova_plot_${testType}_${depVar}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnalyzeNew = () => {
    setResults(null);
    setError(null);
  };

  const handleDownloadReport = (format) => {
    if (!results) return;

    const fileName = `StatSathi_DoE_Report_${depVar}`;
    const title = `Stat Sathi ${results.anova_table?.method || 'ANOVA Analysis'} Report`;

    if (format === 'txt') {
      let report = `==================================================\n`;
      report += `              STAT SATHI STATISTICAL REPORT       \n`;
      report += `==================================================\n\n`;
      report += `Test Applied: ${results.anova_table?.method || 'ANOVA Analysis'}\n`;
      report += `Dataset: ${file ? file.name : 'N/A'}\n`;
      report += `Dependent Variable: ${depVar}\n`;
      report += `Independent Factor 1: ${indVar1}\n`;
      if (['twoway', 'rbd_twoway', 'splitplot'].includes(testType) && indVar2) {
        report += `Independent Factor 2 (Factor B): ${indVar2}\n`;
      }
      if (['rbd_oneway', 'rbd_twoway', 'splitplot'].includes(testType) && repVar) {
        report += `Replication/Block Factor: ${repVar}\n`;
      }
      report += `\n--------------------------------------------------\n`;
      report += `1. ANOVA SUMMARY TABLE\n`;
      report += `--------------------------------------------------\n`;

      const tab = results.anova_table;
      if (testType === 'oneway') {
        report += `Source         | SS           | df     | MS           | F        | p-value\n`;
        report += `---------------+--------------+--------+--------------+----------+---------\n`;
        report += `Between Groups | ${tab.ss_between?.toFixed(3).padEnd(12)} | ${String(tab.df_between).padEnd(6)} | ${tab.ms_between?.toFixed(3).padEnd(12)} | ${tab.f_statistic?.toFixed(3).padEnd(8)} | ${tab.p_value < 0.001 ? 'p < 0.001' : tab.p_value?.toFixed(6)}\n`;
        report += `Within Groups  | ${tab.ss_within?.toFixed(3).padEnd(12)} | ${String(tab.df_within?.toFixed(2).replace(/\.00$/, '')).padEnd(6)} | ${tab.ms_within?.toFixed(3).padEnd(12)} |          |\n`;
        report += `Total          | ${tab.ss_total?.toFixed(3).padEnd(12)} | ${String(tab.df_total).padEnd(6)} |              |          |\n`;
      } else if (testType === 'rbd_oneway') {
        report += `Source         | SS           | df     | MS           | F        | p-value\n`;
        report += `---------------+--------------+--------+--------------+----------+---------\n`;
        report += `Replications   | ${tab.ss_rep?.toFixed(3).padEnd(12)} | ${String(tab.df_rep).padEnd(6)} | ${tab.ms_rep?.toFixed(3).padEnd(12)} | ${tab.f_rep?.toFixed(3).padEnd(8)} | ${tab.p_rep < 0.001 ? 'p < 0.001' : tab.p_rep?.toFixed(6)}\n`;
        report += `Treatments     | ${tab.ss_between?.toFixed(3).padEnd(12)} | ${String(tab.df_between).padEnd(6)} | ${tab.ms_between?.toFixed(3).padEnd(12)} | ${tab.f_statistic?.toFixed(3).padEnd(8)} | ${tab.p_value < 0.001 ? 'p < 0.001' : tab.p_value?.toFixed(6)}\n`;
        report += `Error          | ${tab.ss_within?.toFixed(3).padEnd(12)} | ${String(tab.df_within).padEnd(6)} | ${tab.ms_within?.toFixed(3).padEnd(12)} |          |\n`;
        report += `Total          | ${tab.ss_total?.toFixed(3).padEnd(12)} | ${String(tab.df_total).padEnd(6)} |              |          |\n`;
      } else if (testType === 'lsd') {
        report += `Source         | SS           | df     | MS           | F        | p-value\n`;
        report += `---------------+--------------+--------+--------------+----------+---------\n`;
        report += `Rows           | ${tab.ss_row?.toFixed(3).padEnd(12)} | ${String(tab.df_row).padEnd(6)} | ${tab.ms_row?.toFixed(3).padEnd(12)} | ${tab.f_row?.toFixed(3).padEnd(8)} | ${tab.p_row < 0.001 ? 'p < 0.001' : tab.p_row?.toFixed(6)}\n`;
        report += `Columns        | ${tab.ss_col?.toFixed(3).padEnd(12)} | ${String(tab.df_col).padEnd(6)} | ${tab.ms_col?.toFixed(3).padEnd(12)} | ${tab.f_col?.toFixed(3).padEnd(8)} | ${tab.p_col < 0.001 ? 'p < 0.001' : tab.p_col?.toFixed(6)}\n`;
        report += `Treatments     | ${tab.ss_between?.toFixed(3).padEnd(12)} | ${String(tab.df_between).padEnd(6)} | ${tab.ms_between?.toFixed(3).padEnd(12)} | ${tab.f_statistic?.toFixed(3).padEnd(8)} | ${tab.p_value < 0.001 ? 'p < 0.001' : tab.p_value?.toFixed(6)}\n`;
        report += `Error          | ${tab.ss_within?.toFixed(3).padEnd(12)} | ${String(tab.df_within).padEnd(6)} | ${tab.ms_within?.toFixed(3).padEnd(12)} |          |\n`;
        report += `Total          | ${tab.ss_total?.toFixed(3).padEnd(12)} | ${String(tab.df_total).padEnd(6)} |              |          |\n`;
      } else if (testType === 'twoway') {
        report += `Source         | SS           | df     | MS           | F        | p-value\n`;
        report += `---------------+--------------+--------+--------------+----------+---------\n`;
        report += `${indVar1.substring(0, 14).padEnd(14)} | ${tab.factorA?.ss.toFixed(3).padEnd(12)} | ${String(tab.factorA?.df).padEnd(6)} | ${tab.factorA?.ms.toFixed(3).padEnd(12)} | ${tab.factorA?.f_statistic.toFixed(3).padEnd(8)} | ${tab.factorA?.p_value < 0.001 ? 'p < 0.001' : tab.factorA?.p_value.toFixed(6)}\n`;
        report += `${indVar2.substring(0, 14).padEnd(14)} | ${tab.factorB?.ss.toFixed(3).padEnd(12)} | ${String(tab.factorB?.df).padEnd(6)} | ${tab.factorB?.ms.toFixed(3).padEnd(12)} | ${tab.factorB?.f_statistic.toFixed(3).padEnd(8)} | ${tab.factorB?.p_value < 0.001 ? 'p < 0.001' : tab.factorB?.p_value.toFixed(6)}\n`;
        report += `Interaction    | ${tab.interaction?.ss.toFixed(3).padEnd(12)} | ${String(tab.interaction?.df).padEnd(6)} | ${tab.interaction?.ms.toFixed(3).padEnd(12)} | ${tab.interaction?.f_statistic.toFixed(3).padEnd(8)} | ${tab.interaction?.p_value < 0.001 ? 'p < 0.001' : tab.interaction?.p_value.toFixed(6)}\n`;
        report += `Error          | ${tab.error?.ss.toFixed(3).padEnd(12)} | ${String(tab.error?.df).padEnd(6)} | ${tab.error?.ms.toFixed(3).padEnd(12)} |          |\n`;
        report += `Total          | ${tab.total?.ss.toFixed(3).padEnd(12)} | ${String(tab.total?.df).padEnd(6)} |              |          |\n`;
      } else if (testType === 'rbd_twoway') {
        report += `Source         | SS           | df     | MS           | F        | p-value\n`;
        report += `---------------+--------------+--------+--------------+----------+---------\n`;
        report += `Replications   | ${tab.ss_rep?.toFixed(3).padEnd(12)} | ${String(tab.df_rep).padEnd(6)} | ${tab.ms_rep?.toFixed(3).padEnd(12)} | ${tab.f_rep?.toFixed(3).padEnd(8)} | ${tab.p_rep < 0.001 ? 'p < 0.001' : tab.p_rep?.toFixed(6)}\n`;
        report += `${indVar1.substring(0, 14).padEnd(14)} | ${tab.factorA?.ss.toFixed(3).padEnd(12)} | ${String(tab.factorA?.df).padEnd(6)} | ${tab.factorA?.ms.toFixed(3).padEnd(12)} | ${tab.factorA?.f_statistic.toFixed(3).padEnd(8)} | ${tab.factorA?.p_value < 0.001 ? 'p < 0.001' : tab.factorA?.p_value.toFixed(6)}\n`;
        report += `${indVar2.substring(0, 14).padEnd(14)} | ${tab.factorB?.ss.toFixed(3).padEnd(12)} | ${String(tab.factorB?.df).padEnd(6)} | ${tab.factorB?.ms.toFixed(3).padEnd(12)} | ${tab.factorB?.f_statistic.toFixed(3).padEnd(8)} | ${tab.factorB?.p_value < 0.001 ? 'p < 0.001' : tab.factorB?.p_value.toFixed(6)}\n`;
        report += `Interaction    | ${tab.interaction?.ss.toFixed(3).padEnd(12)} | ${String(tab.interaction?.df).padEnd(6)} | ${tab.interaction?.ms.toFixed(3).padEnd(12)} | ${tab.interaction?.f_statistic.toFixed(3).padEnd(8)} | ${tab.interaction?.p_value < 0.001 ? 'p < 0.001' : tab.interaction?.p_value.toFixed(6)}\n`;
        report += `Error          | ${tab.error?.ss.toFixed(3).padEnd(12)} | ${String(tab.error?.df).padEnd(6)} | ${tab.error?.ms.toFixed(3).padEnd(12)} |          |\n`;
        report += `Total          | ${tab.total?.ss.toFixed(3).padEnd(12)} | ${String(tab.total?.df).padEnd(6)} |              |          |\n`;
      } else if (testType === 'splitplot') {
        report += `Source         | SS           | df     | MS           | F        | p-value\n`;
        report += `---------------+--------------+--------+--------------+----------+---------\n`;
        report += `Replications   | ${tab.ss_rep?.toFixed(3).padEnd(12)} | ${String(tab.df_rep).padEnd(6)} | ${tab.ms_rep?.toFixed(3).padEnd(12)} | ${tab.f_rep?.toFixed(3).padEnd(8)} | ${tab.p_rep < 0.001 ? 'p < 0.001' : tab.p_rep?.toFixed(6)}\n`;
        report += `Main Plot (A)  | ${tab.factorA?.ss.toFixed(3).padEnd(12)} | ${String(tab.factorA?.df).padEnd(6)} | ${tab.factorA?.ms.toFixed(3).padEnd(12)} | ${tab.factorA?.f_statistic.toFixed(3).padEnd(8)} | ${tab.factorA?.p_value < 0.001 ? 'p < 0.001' : tab.factorA?.p_value.toFixed(6)}\n`;
        report += `Error (a)      | ${tab.error_a?.ss.toFixed(3).padEnd(12)} | ${String(tab.error_a?.df).padEnd(6)} | ${tab.error_a?.ms.toFixed(3).padEnd(12)} |          |\n`;
        report += `Sub Plot (B)   | ${tab.factorB?.ss.toFixed(3).padEnd(12)} | ${String(tab.factorB?.df).padEnd(6)} | ${tab.factorB?.ms.toFixed(3).padEnd(12)} | ${tab.factorB?.f_statistic.toFixed(3).padEnd(8)} | ${tab.factorB?.p_value < 0.001 ? 'p < 0.001' : tab.factorB?.p_value.toFixed(6)}\n`;
        report += `Interaction(AB)| ${tab.interaction?.ss.toFixed(3).padEnd(12)} | ${String(tab.interaction?.df).padEnd(6)} | ${tab.interaction?.ms.toFixed(3).padEnd(12)} | ${tab.interaction?.f_statistic.toFixed(3).padEnd(8)} | ${tab.interaction?.p_value < 0.001 ? 'p < 0.001' : tab.interaction?.p_value.toFixed(6)}\n`;
        report += `Error (b)      | ${tab.error_b?.ss.toFixed(3).padEnd(12)} | ${String(tab.error_b?.df).padEnd(6)} | ${tab.error_b?.ms.toFixed(3).padEnd(12)} |          |\n`;
        report += `Total          | ${tab.total?.ss.toFixed(3).padEnd(12)} | ${String(tab.total?.df).padEnd(6)} |              |          |\n`;
      }


      report += `\n--------------------------------------------------\n`;
      report += `3. TABLES OF MEAN, STANDARD ERRORS AND C.D.\n`;
      report += `--------------------------------------------------\n`;
      report += `Treatment                | Mean       | S.E.       \n`;
      report += `-------------------------+------------+------------\n`;
      Object.entries(results.descriptives || {}).forEach(([cell, stats]) => {
        const seVal = stats.se !== undefined ? stats.se.toFixed(3) : '-';
        report += `${cell.substring(0, 24).padEnd(24)} | ${stats.mean.toFixed(3).padEnd(10)} | ${seVal.padEnd(10)}\n`;
      });
      report += `-------------------------+------------+------------\n`;
      report += `C.D.                     | ${getCD5Value()}\n`;
      report += `SE(m)                    | ${getSEmValue()}\n`;
      report += `SE(d)                    | ${getSEdValue()}\n`;
      report += `C.V.                     | ${results.cv !== undefined ? results.cv.toFixed(3) + '%' : '-'}\n`;

      if (testType === 'oneway' && results.posthoc_results && results.posthoc_results.length > 0) {
        report += `\n--------------------------------------------------\n`;
        report += `4. POST-HOC PAIRWISE COMPARISONS (${posthocMethod === 'games_howell' ? 'Games-Howell' : posthocMethod === 'duncan' ? "Duncan's DMRT" : 'Tukey HSD / LSD'})\n`;
        report += `--------------------------------------------------\n`;
        report += `Group 1                  | Group 2                  | Mean Diff  | p-value\n`;
        report += `-------------------------+--------------------------+------------+------------\n`;
        results.posthoc_results.forEach(comp => {
          report += `${comp.group1.substring(0, 24).padEnd(24)} | ${comp.group2.substring(0, 24).padEnd(24)} | ${comp.mean_diff.toFixed(3).padEnd(10)} | ${comp.p_value < 0.001 ? 'p < 0.001' : comp.p_value.toFixed(6)}\n`;
        });
      }

      report += `\n--------------------------------------------------\n`;
      report += `5. ASSUMPTION CHECKS\n`;
      report += `--------------------------------------------------\n`;
      report += `Shapiro-Wilk Normality Test:\n`;
      Object.entries(results.shapiro_results || {}).forEach(([column, meta]) => {
        if (meta.error) {
          report += `  - ${column}: ${meta.error}\n`;
        } else {
          const normalityStr = meta.normal ? 'Normally Distributed' : (column === 'Model Residuals' ? 'Not Normal' : 'Non-Normal Distribution');
          report += `  - ${column}: W = ${meta.stat.toFixed(3)}, p = ${meta.p_value.toFixed(6)} (${normalityStr})\n`;
        }
      });

      if (results.levene_results) {
        const lev = results.levene_results;
        report += `\nLevene's Equality of Variances Test:\n`;
        report += `  - Statistic: ${lev.stat.toFixed(3)}, p = ${lev.p_value.toFixed(6)} (${lev.equal_var ? 'Equal Variances' : 'Unequal Variances'})\n`;
      }

      report += `\n==================================================\n`;
      report += `Report generated on ${new Date().toLocaleString()}\n`;
      report += `Stat Sathi - Your Trustworthy Research Analytics Companion\n`;
      report += `Curated by Ravi, PhD Scholar ICAR-IISS\n`;
      report += `==================================================\n`;

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `StatSathi_DoE_Report_${depVar}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      const tab = results.anova_table;
      let anovaTableHTML = '';

      if (testType === 'oneway') {
        anovaTableHTML = `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Source of Variation</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">df</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">MS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">F-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Between Groups</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_between?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_between}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_between?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_statistic?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_value < 0.001 ? 'p &lt; 0.001' : tab.p_value?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Within Groups</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_within?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_within?.toFixed(2).replace(/\.00$/, '')}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_within?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr style="font-weight: bold; background-color: #F1F5F9;">
                <td style="border: 1px solid #CBD5E1; padding: 10px;">Total</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_total?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_total}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
              </tr>
            </tbody>
          </table>
          </div>
        `;
      } else if (testType === 'rbd_oneway') {
        anovaTableHTML = `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Source of Variation</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">df</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">MS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">F-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Replications</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_rep}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_rep < 0.001 ? 'p &lt; 0.001' : tab.p_rep?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Treatments</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_between?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_between}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_between?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_statistic?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_value < 0.001 ? 'p &lt; 0.001' : tab.p_value?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Error</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_within?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_within}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_within?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr style="font-weight: bold; background-color: #F1F5F9;">
                <td style="border: 1px solid #CBD5E1; padding: 10px;">Total</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_total?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_total}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
              </tr>
            </tbody>
          </table>
          </div>
        `;
      } else if (testType === 'lsd') {
        anovaTableHTML = `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Source of Variation</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">df</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">MS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">F-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Rows</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_row?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_row}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_row?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_row?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_row < 0.001 ? 'p &lt; 0.001' : tab.p_row?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Columns</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_col?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_col}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_col?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_col?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_col < 0.001 ? 'p &lt; 0.001' : tab.p_col?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Treatments</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_between?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_between}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_between?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_statistic?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_value < 0.001 ? 'p &lt; 0.001' : tab.p_value?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Error</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_within?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_within}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_within?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr style="font-weight: bold; background-color: #F1F5F9;">
                <td style="border: 1px solid #CBD5E1; padding: 10px;">Total</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_total?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_total}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
              </tr>
            </tbody>
          </table>
          </div>
        `;
      } else if (testType === 'twoway') {
        anovaTableHTML = `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Source of Variation</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">df</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">MS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">F-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${indVar1} (Factor A)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.factorA?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.factorA?.p_value < 0.001 ? 'p &lt; 0.001' : tab.factorA?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${indVar2} (Factor B)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.factorB?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.factorB?.p_value < 0.001 ? 'p &lt; 0.001' : tab.factorB?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Interaction (A x B)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.interaction?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.interaction?.p_value < 0.001 ? 'p &lt; 0.001' : tab.interaction?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Error</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.error?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr style="font-weight: bold; background-color: #F1F5F9;">
                <td style="border: 1px solid #CBD5E1; padding: 10px;">Total</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.total?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.total?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
              </tr>
            </tbody>
          </table>
          </div>
        `;
      } else if (testType === 'rbd_twoway') {
        anovaTableHTML = `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Source of Variation</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">df</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">MS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">F-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Replications</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_rep}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_rep < 0.001 ? 'p &lt; 0.001' : tab.p_rep?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${indVar1} (Factor A)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.factorA?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.factorA?.p_value < 0.001 ? 'p &lt; 0.001' : tab.factorA?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${indVar2} (Factor B)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.factorB?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.factorB?.p_value < 0.001 ? 'p &lt; 0.001' : tab.factorB?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Interaction (A x B)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.interaction?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.interaction?.p_value < 0.001 ? 'p &lt; 0.001' : tab.interaction?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Error</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.error?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr style="font-weight: bold; background-color: #F1F5F9;">
                <td style="border: 1px solid #CBD5E1; padding: 10px;">Total</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.total?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.total?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
              </tr>
            </tbody>
          </table>
          </div>
        `;
      } else if (testType === 'splitplot') {
        anovaTableHTML = `
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Source of Variation</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">SS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">df</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">MS</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">F-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Replications</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ss_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.df_rep}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.ms_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.f_rep?.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.p_rep < 0.001 ? 'p &lt; 0.001' : tab.p_rep?.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Main Plot (A)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.factorA?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorA?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.factorA?.p_value < 0.001 ? 'p &lt; 0.001' : tab.factorA?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Error (a)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error_a?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.error_a?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error_a?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Sub Plot (B)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.factorB?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.factorB?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.factorB?.p_value < 0.001 ? 'p &lt; 0.001' : tab.factorB?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Interaction (A x B)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.interaction?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.interaction?.f_statistic.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${tab.interaction?.p_value < 0.001 ? 'p &lt; 0.001' : tab.interaction?.p_value.toFixed(6)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Error (b)</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error_b?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.error_b?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.error_b?.ms.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">-</td>
              </tr>
              <tr style="font-weight: bold; background-color: #F1F5F9;">
                <td style="border: 1px solid #CBD5E1; padding: 10px;">Total</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${tab.total?.ss.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;">${tab.total?.df}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right;"></td>
              </tr>
            </tbody>
          </table>
          </div>
        `;
      }

      const meansRows = Object.entries(results.descriptives || {}).map(([cell, stats]) => {
        const seVal = stats.se !== undefined ? stats.se.toFixed(3) : '-';
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${cell}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${stats.mean.toFixed(3)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${seVal}</td>
          </tr>
        `;
      }).join('');

      const designStatsTable = `
        <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #4F46E5; color: white;">
              <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Parameter</th>
              <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Critical Difference (C.D.) 5%</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #F97316;">${getCD5Value()}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">SE(m)</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${getSEmValue()}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">SE(d)</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${getSEdValue()}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Coefficient of Variation (C.V. %)</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${results.cv !== undefined ? results.cv.toFixed(3) + '%' : '-'}</td>
            </tr>
          </tbody>
        </table>
          </div>
      `;

      let postHocTable = '';
      if (testType === 'oneway' && results.posthoc_results && results.posthoc_results.length > 0) {
        postHocTable = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Post-Hoc Pairwise Comparisons (${posthocMethod === 'games_howell' ? 'Games-Howell' : posthocMethod === 'duncan' ? "Duncan's DMRT" : 'Tukey HSD / LSD'})</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Group 1</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Group 2</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Mean Diff</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
              </tr>
            </thead>
            <tbody>
              ${results.posthoc_results.map(comp => `
                <tr>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${comp.group1}</td>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${comp.group2}</td>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${comp.mean_diff.toFixed(3)}</td>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: ${comp.p_value < 0.05 ? '#EF4444' : '#1E293B'};">${comp.p_value < 0.001 ? 'p &lt; 0.001' : comp.p_value.toFixed(6)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        `;
      }

      const shapiroRows = Object.entries(results.shapiro_results || {}).map(([column, meta]) => {
        if (meta.error) {
          return `
            <tr>
              <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${column}</td>
              <td colspan="3" style="border: 1px solid #CBD5E1; padding: 10px; color: #EF4444; font-style: italic;">${meta.error}</td>
            </tr>
          `;
        }
        const normalityStr = meta.normal ? 'Normally Distributed' : (column === 'Model Residuals' ? 'Not Normal' : 'Non-Normal Distribution');
        return `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${column}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${meta.stat.toFixed(3)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${meta.p_value < 0.001 ? 'p &lt; 0.001' : meta.p_value.toFixed(6)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold; color: ${meta.normal ? '#10B981' : '#F59E0B'};">${normalityStr}</td>
          </tr>
        `;
      }).join('');

      let leveneRow = '';
      if (results.levene_results) {
        const lev = results.levene_results;
        leveneRow = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Levene's Equality of Variances Test</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Check</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Levene Statistic</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold;">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Equality of Variances</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${lev.stat.toFixed(3)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${lev.p_value < 0.001 ? 'p &lt; 0.001' : lev.p_value.toFixed(6)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold; color: ${lev.equal_var ? '#10B981' : '#F59E0B'};">${lev.equal_var ? 'Equal Variances' : 'Unequal Variances'}</td>
              </tr>
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
            .meta-table { border-collapse: collapse; width: 75%; margin-left: auto; margin-right: auto; margin-bottom: 25px; }
            .meta-table td { padding: 8px; border: 1px solid #E2E8F0; }
            .meta-label { font-weight: bold; background-color: #F8FAFC; width: 30%; }
          </style>
        </head>
        <body>
          <h1>Stat Sathi Design of Experiments (ANOVA) Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table" style="width: 75%;">
            <tr>
              <td class="meta-label">Test Applied</td>
              <td>${results.anova_table?.method || 'ANOVA Analysis'}</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file ? file.name : 'N/A'}</td>
            </tr>
            <tr>
              <td class="meta-label">Dependent Variable</td>
              <td>${depVar}</td>
            </tr>
            <tr>
              <td class="meta-label">Factor 1 (Treatment A)</td>
              <td>${indVar1}</td>
            </tr>
            ${indVar2 ? `
            <tr>
              <td class="meta-label">Factor 2 (Factor B)</td>
              <td>${indVar2}</td>
            </tr>
            ` : ''}
            ${repVar ? `
            <tr>
              <td class="meta-label">Replication/Block Factor</td>
              <td>${repVar}</td>
            </tr>
            ` : ''}
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

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">1. ANOVA Table</h2>
          ${anovaTableHTML}

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">2. Treatment Means Table</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 80%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Treatment Group</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Mean</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">S.E.</th>
              </tr>
            </thead>
            <tbody>
              ${meansRows}
            </tbody>
          </table>
          </div>

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">3. Key Design Statistics</h2>
          ${designStatsTable}

          ${postHocTable}

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">4. Assumption Checks</h2>
          <h3 style="color: #1E293B; font-family: Arial, sans-serif; font-size: 11pt; margin-top: 10px;">Normality Check (Shapiro-Wilk Test)</h3>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 80%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Variable / Term</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">W Statistic</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${shapiroRows}
            </tbody>
          </table>
          </div>

          ${leveneRow}

          <p style="margin-top: 40px; font-size: 9pt; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; text-align: center;">
            Stat Sathi &copy; 2026 - Your Trustworthy Research Analytics Companion - developed by Ravi, PhD Scholar in IISS Bhopal
          </p>
        </body>
        </html>
      `;
      const centeredHtml = htmlContent
        .replace(/width:\s*100%/gi, 'width: 80%')
        .replace(/class="meta-table"/gi, 'class="meta-table" style="width: 75%;"')
        .replace(/<table([^>]*)>/gi, (match, attrs) => {
          let newAttrs = attrs;
          if (/width:\s*100%/i.test(newAttrs)) {
            newAttrs = newAttrs.replace(/width:\s*100%/i, 'width: 80%');
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

  const getCD5Value = () => {
    if (!results || !results.cd_results || results.cd_results.length === 0) return '-';
    if (results.cd_results.length === 1) return results.cd_results[0].cd_5.toFixed(3);
    return results.cd_results.map(r => {
      const label = r.parameter
        .replace('Main Plot Factor A: ', 'A: ')
        .replace('Sub Plot Factor B: ', 'B: ')
        .replace('Factor A: ', 'A: ')
        .replace('Factor B: ', 'B: ')
        .replace('Interaction: ', 'AxB: ')
        .replace('Sub Plot B at same Main Plot A', 'B at same A')
        .replace('Main Plot A at same Sub Plot B', 'A at same B');
      return `${label}: ${r.cd_5.toFixed(3)}`;
    }).join('; ');
  };

  const getSEmValue = () => {
    if (!results) return '-';
    if (results.sem !== undefined && (testType === 'oneway' || testType === 'rbd_oneway' || testType === 'lsd' || testType === 'crd_multifactor' || testType === 'rbd_multifactor')) {
      return results.sem.toFixed(3);
    }
    if (!results.cd_results || results.cd_results.length === 0) return '-';
    return results.cd_results.map(r => {
      const label = r.parameter
        .replace('Main Plot Factor A: ', 'A: ')
        .replace('Sub Plot Factor B: ', 'B: ')
        .replace('Factor A: ', 'A: ')
        .replace('Factor B: ', 'B: ')
        .replace('Interaction: ', 'AxB: ')
        .replace('Sub Plot B at same Main Plot A', 'B at same A')
        .replace('Main Plot A at same Sub Plot B', 'A at same B');
      return `${label}: ${(r.se / Math.sqrt(2) || r.se_d / Math.sqrt(2)).toFixed(3)}`;
    }).join('; ');
  };

  const getSEdValue = () => {
    if (!results || !results.cd_results || results.cd_results.length === 0) return '-';
    if (results.cd_results.length === 1) return results.cd_results[0].se_d.toFixed(3);
    return results.cd_results.map(r => {
      const label = r.parameter
        .replace('Main Plot Factor A: ', 'A: ')
        .replace('Sub Plot Factor B: ', 'B: ')
        .replace('Factor A: ', 'A: ')
        .replace('Factor B: ', 'B: ')
        .replace('Interaction: ', 'AxB: ')
        .replace('Sub Plot B at same Main Plot A', 'B at same A')
        .replace('Main Plot A at same Sub Plot B', 'A at same B');
      return `${label}: ${r.se_d.toFixed(3)}`;
    }).join('; ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[640px] w-full max-w-4xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-800">
              Design of Experiments (ANOVA)
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Perform completely randomized (CRD), randomized block (RBD), and split-plot analyses with standard agricultural statistics.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error}</span>
            </div>
          )}

          {/* Step 1: File Upload */}
          {!file && !loadingCols && (
            <div className="space-y-4">
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-14 px-6 text-center cursor-pointer transition-all duration-200 ${
                  dragActive ? 'border-brand-indigo bg-indigo-50/30' : 'border-slate-300 hover:border-brand-indigo hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleChange}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
                  <Upload className="h-6 w-6 text-slate-400" />
                </div>
                <p className="font-sans text-sm font-semibold text-slate-700">Select or drop dataset for ANOVA analysis</p>
                <p className="font-sans text-xs text-slate-400 mt-1">Supports CSV, XLSX, and XLS formats</p>
              </div>

              {/* Expected Format Guide before Upload */}
              <div className="rounded-3xl border border-slate-100 bg-slate-50/30 p-5 space-y-4 shadow-sm animate-fade-in">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-display text-sm font-bold text-slate-700">ANOVA Dataset Layout Assistant</h4>
                    <p className="font-sans text-xs text-slate-400 mt-0.5">Select a layout design below to see sample CSV headers, rows, and structure.</p>
                  </div>
                  <HelpCircle className="h-5 w-5 text-brand-indigo" />
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {[
                    { id: 'oneway', label: 'CRD (1 Factor)' },
                    { id: 'rbd_oneway', label: 'RBD (1 Factor)' },
                    { id: 'lsd', label: 'Latin Square (LSD)' },
                    { id: 'twoway', label: 'CRD (2 Factors)' },
                    { id: 'rbd_twoway', label: 'RBD (2 Factors)' },
                    { id: 'crd_multifactor', label: 'CRD (Multi-Factor)' },
                    { id: 'rbd_multifactor', label: 'RBD (Multi-Factor)' },
                    { id: 'splitplot', label: 'Split-plot' },
                  ].map(layout => (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => {
                        setTestType(layout.id);
                        setShowFormatGuide(true);
                      }}
                      className={`rounded-xl py-2 px-3 text-center font-sans text-xs font-bold border transition-all ${
                        showFormatGuide && testType === layout.id
                          ? 'bg-brand-indigo text-white border-brand-indigo shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      {layout.label}
                    </button>
                  ))}
                </div>

                {showFormatGuide && (
                  <div className="rounded-2xl border border-brand-indigo/10 bg-indigo-50/20 p-4 space-y-3 animate-fade-in">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-sans text-xs font-bold text-slate-850">
                          {DATA_FORMAT_GUIDES[testType].title}
                        </h4>
                        <p className="font-sans text-[11px] text-slate-500 mt-0.5">
                          {DATA_FORMAT_GUIDES[testType].description}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-indigo/10 p-1 text-brand-indigo text-[10px] font-bold px-2.5">
                        Required Columns
                      </span>
                    </div>

                    {/* Sample Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-xs">
                      <table className="min-w-full divide-y divide-slate-100 text-left font-sans text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            {DATA_FORMAT_GUIDES[testType].headers.map(hdr => (
                              <th key={hdr} className="px-4 py-2 border-b border-slate-100">{hdr}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                          {DATA_FORMAT_GUIDES[testType].rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/50">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-4 py-2">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-start space-x-1.5 text-[10px] text-slate-500 bg-amber-50/40 border border-amber-100/50 rounded-xl p-2.5">
                      <Info className="h-3.5 w-3.5 text-brand-orange shrink-0 mt-0.5" />
                      <span>
                        <strong>Layout Tip:</strong> {DATA_FORMAT_GUIDES[testType].note}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading columns indicator */}
          {loadingCols && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Reading dataset columns...</p>
            </div>
          )}

          {/* Step 2: Configure Test Form */}
          {file && !loadingCols && !results && !loadingAnalysis && (
            <form onSubmit={runAnalysis} className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex justify-between items-center">
                <div className="truncate">
                  <p className="font-sans text-xs font-bold text-slate-400 uppercase">Selected Dataset</p>
                  <p className="font-sans text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1"
                  >
                    <Eye className="h-3.5 w-3.5 text-brand-orange" />
                    <span>View Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-xs font-semibold flex items-center space-x-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Select Design Type */}
                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="font-sans text-xs font-bold text-slate-500">Experimental Design Layout</label>
                    <button
                      type="button"
                      onClick={() => setShowFormatGuide(!showFormatGuide)}
                      className="text-xs text-brand-indigo font-bold hover:text-indigo-700 hover:underline flex items-center space-x-1 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>{showFormatGuide ? 'Hide Expected Format' : 'Show Expected Format'}</span>
                    </button>
                  </div>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    <option value="oneway">One Factor (CRD) Analysis</option>
                    <option value="rbd_oneway">One Factor (RBD) Analysis</option>
                    <option value="lsd">Latin Square Design (LSD) Analysis</option>
                    <option value="twoway">Two Factors (CRD) Analysis</option>
                    <option value="rbd_twoway">Two Factors (RBD) Analysis</option>
                    <option value="crd_multifactor">Multi-Factor (CRD) Analysis</option>
                    <option value="rbd_multifactor">Multi-Factor (RBD) Analysis</option>
                    <option value="splitplot">Two Factors (Split-plot) Analysis</option>
                  </select>

                  {showFormatGuide && (
                    <div className="mt-3 rounded-2xl border border-brand-indigo/10 bg-indigo-50/20 p-4 space-y-3 animate-fade-in text-left">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-sans text-xs font-bold text-slate-800">
                            {DATA_FORMAT_GUIDES[testType].title}
                          </h4>
                          <p className="font-sans text-[11px] text-slate-500 mt-0.5">
                            {DATA_FORMAT_GUIDES[testType].description}
                          </p>
                        </div>
                        <span className="rounded-full bg-brand-indigo/10 p-1 text-brand-indigo text-[10px] font-bold px-2.5">
                          Required Columns
                        </span>
                      </div>

                      {/* Sample Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-xs">
                        <table className="min-w-full divide-y divide-slate-100 text-left font-sans text-[11px]">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                              {DATA_FORMAT_GUIDES[testType].headers.map(hdr => (
                                <th key={hdr} className="px-4 py-2 border-b border-slate-100">{hdr}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                            {DATA_FORMAT_GUIDES[testType].rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/50">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-4 py-2">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-start space-x-1.5 text-[10px] text-slate-500 bg-amber-50/40 border border-amber-100/50 rounded-xl p-2.5">
                        <Info className="h-3.5 w-3.5 text-brand-orange shrink-0 mt-0.5" />
                        <span>
                          <strong>Layout Tip:</strong> {DATA_FORMAT_GUIDES[testType].note}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dependent Variable */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Dependent Variable (Numeric / Yield)</label>
                  <select
                    value={depVar}
                    onChange={(e) => setDepVar(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    <option value="">-- Select Dependent Variable --</option>
                    {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Independent Variable 1 / Factor A */}
                {!['crd_multifactor', 'rbd_multifactor'].includes(testType) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      {testType === 'splitplot' ? 'Main Plot Factor A (Categorical)' : testType === 'lsd' ? 'Treatments (Categorical)' : 'Independent Factor 1 (Categorical)'}
                    </label>
                    <select
                      value={indVar1}
                      onChange={(e) => setIndVar1(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">{testType === 'lsd' ? '-- Select Treatments --' : '-- Select Factor 1 --'}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Multi-Factor Checklist */}
                {['crd_multifactor', 'rbd_multifactor'].includes(testType) && (
                  <div className="space-y-1.5 col-span-1 md:col-span-2 animate-fade-in text-left">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      Select Treatment Factors (Choose 3 or more categorical variables)
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 max-h-48 overflow-y-auto">
                      {columns
                        .filter(c => c !== depVar && c !== repVar)
                        .map(c => {
                          const isChecked = selectedFactors.includes(c);
                          return (
                            <label key={c} className="flex items-center space-x-2.5 p-2 rounded-lg bg-white border border-slate-100 hover:border-brand-indigo/30 transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedFactors(selectedFactors.filter(f => f !== c));
                                  } else {
                                    setSelectedFactors([...selectedFactors, c]);
                                  }
                                }}
                                className="rounded-sm border-slate-300 text-brand-indigo focus:ring-brand-indigo/20 h-4 w-4"
                              />
                              <span className="font-sans text-sm text-slate-700 font-medium select-none truncate">{c}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Independent Variable 2 / Factor B (Only for Two Factors, Split-plot, or Column Factor for LSD) */}
                {['twoway', 'rbd_twoway', 'splitplot', 'lsd'].includes(testType) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      {testType === 'lsd' ? 'Column Factor (Categorical)' : testType === 'splitplot' ? 'Sub Plot Factor B (Categorical)' : 'Independent Factor 2 (Categorical)'}
                    </label>
                    <select
                      value={indVar2}
                      onChange={(e) => setIndVar2(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">{testType === 'lsd' ? '-- Select Column Factor --' : '-- Select Factor 2 --'}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Replication / Block variable (For RBD, Split-plot, Row Factor for LSD, or Multi-Factor RBD) */}
                {['rbd_oneway', 'rbd_twoway', 'splitplot', 'lsd', 'rbd_multifactor'].includes(testType) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">
                      {testType === 'lsd' ? 'Row Factor (Categorical)' : 'Replication / Block Factor (Categorical)'}
                    </label>
                    <select
                      value={repVar}
                      onChange={(e) => setRepVar(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">{testType === 'lsd' ? '-- Select Row Factor --' : '-- Select Replication Block --'}</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Post-Hoc Method (For All Designs) */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="font-sans text-xs font-bold text-slate-500">Post-Hoc Comparison Method</label>
                  <select
                    value={posthocMethod}
                    onChange={(e) => setPosthocMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    <option value="tukey">Tukey's HSD / LSD (Critical Difference)</option>
                    <option value="duncan">Duncan's Multiple Range Test (DMRT)</option>
                    <option value="games_howell">Games-Howell (Assuming Unequal Variances)</option>
                  </select>
                </div>

                {/* Graph Color Palette (For All Designs) */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="font-sans text-xs font-bold text-slate-500">Graph Color Palette</label>
                  <select
                    value={palette}
                    onChange={(e) => setPalette(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    {anovaPalettes.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
              >
                Run Agricultural ANOVA
              </button>
            </form>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Running Design calculations...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Output */}
          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Experimental Design Report
                  </h4>
                  <p className="text-xs text-brand-indigo font-semibold mt-0.5">
                    Layout: {results.anova_table?.method || 'ANOVA Analysis'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                    onClick={handleDownloadPlot}
                    className="flex items-center space-x-1.5 rounded-lg bg-brand-indigo p-1.5 px-3 hover:bg-indigo-700 text-white font-sans text-xs font-semibold transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Chart</span>
                  </button>
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
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex justify-between items-center max-w-xs ml-auto shadow-xs">
                <span className="font-sans text-xs font-bold text-slate-500">Graph Palette:</span>
                <select
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/10 outline-hidden transition-all"
                >
                  {anovaPalettes.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Warning Banners */}
              {results.shapiro_results && Object.values(results.shapiro_results).some(meta => meta && meta.p_value < 0.05) && (
                <div className="flex items-start space-x-2.5 rounded-2xl bg-orange-50 border border-orange-200 p-4 text-orange-800 animate-fade-in">
                  <AlertCircle className="h-5 w-5 shrink-0 text-orange-500 mt-0.5" />
                  <span className="font-sans text-xs font-semibold leading-normal">
                    Warning: Normality assumption check failed for one or more groups (Shapiro-Wilk p &lt; 0.05). If distribution deviations are severe, consider using Non-Parametric alternatives (e.g. Kruskal-Wallis).
                  </span>
                </div>
              )}

              {/* Layout Specific Quick Summaries */}
              {testType === 'oneway' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Treatment F-Statistic</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {results.anova_table?.f_statistic !== undefined ? `F = ${results.anova_table.f_statistic.toFixed(3)}` : 'N/A'}
                    </p>
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                      df = ({results.anova_table?.df_between}, {results.anova_table?.df_within?.toFixed(2).replace(/\.00$/, '')})
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Treatment p-value</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {formatPValue(results.anova_table?.p_value)}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.significant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Treatment Effect (H₀)</p>
                    <p className="font-sans text-xs font-semibold text-slate-600 mt-2">
                      {results.anova_table?.significant ? 'Reject Null. Treatments differ significantly.' : 'Fail to Reject Null. No treatment differences.'}
                    </p>
                  </div>
                </div>
              )}

              {testType === 'rbd_oneway' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Treatment F-Statistic</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {results.anova_table?.f_statistic !== undefined ? `F = ${results.anova_table.f_statistic.toFixed(3)}` : 'N/A'}
                    </p>
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                      df = ({results.anova_table?.df_between}, {results.anova_table?.df_within})
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Treatment p-value</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {formatPValue(results.anova_table?.p_value)}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.significant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Replications / Blocks</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {formatPValue(results.anova_table?.p_rep)}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.significant_rep ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.significant_rep ? 'Significant Block Effect' : 'No Block Effect'}
                    </span>
                  </div>
                </div>
              )}

              {testType === 'lsd' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Rows ({repVar || 'Row Factor'})</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {results.anova_table?.p_row !== undefined ? formatPValue(results.anova_table.p_row) : 'N/A'}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.significant_row ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.significant_row ? 'Significant Row Effect' : 'No Row Effect'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Columns ({indVar2 || 'Column Factor'})</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {results.anova_table?.p_col !== undefined ? formatPValue(results.anova_table.p_col) : 'N/A'}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.significant_col ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.significant_col ? 'Significant Column Effect' : 'No Column Effect'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Treatments ({indVar1})</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {results.anova_table?.p_value !== undefined ? formatPValue(results.anova_table.p_value) : 'N/A'}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.significant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                </div>
              )}

              {['twoway', 'rbd_twoway', 'splitplot'].includes(testType) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">{indVar1} Main Effect</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {formatPValue(results.anova_table?.factorA?.p_value)}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.factorA?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.factorA?.significant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">{indVar2} Main Effect</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {formatPValue(results.anova_table?.factorB?.p_value)}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.factorB?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.factorB?.significant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Interaction Effect (A x B)</p>
                    <p className="font-display text-lg font-bold text-slate-800 mt-1">
                      {formatPValue(results.anova_table?.interaction?.p_value)}
                    </p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 font-sans text-[8px] font-bold ${
                      results.anova_table?.interaction?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {results.anova_table?.interaction?.significant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                </div>
              )}

              {/* ANOVA Summary Table */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                <h5 className="font-display text-xs font-bold text-slate-700 mb-3">ANOVA Summary Table</h5>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-sans text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2 pr-4">Source of Variation</th>
                        <th className="py-2 text-right">Sum of Squares (SS)</th>
                        <th className="py-2 text-right">DF</th>
                        <th className="py-2 text-right">Mean Sum of Squares (MSS)</th>
                        <th className="py-2 text-right">F-Value</th>
                        <th className="py-2 text-right">p-value</th>
                        <th className="py-2 text-right">Significance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* One Factor CRD */}
                      {testType === 'oneway' && (
                        <>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Treatments ({indVar1})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_between?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_between}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_between?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Error (Residual)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_within?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_within?.toFixed(2).replace(/\.00$/, '')}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_within?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_total?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_total}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}

                      {/* One Factor RBD */}
                      {testType === 'rbd_oneway' && (
                        <>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Replications (Blocks)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_rep}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_rep)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant_rep ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant_rep ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Treatments ({indVar1})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_between?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_between}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_between?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Error (Residual)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_within?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_within}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_within?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_total?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_total}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}

                      {/* Latin Square Design (LSD) */}
                      {testType === 'lsd' && (
                        <>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Rows ({repVar || 'Row Factor'})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_row?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_row}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_row?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_row?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_row)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant_row ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant_row ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Columns ({indVar2 || 'Column Factor'})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_col?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_col}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_col?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_col?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_col)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant_col ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant_col ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Treatments ({indVar1})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_between?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_between}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_between?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Error (Residual)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_within?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_within}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_within?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_total?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_total}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}

                      {/* Two Factor CRD */}
                      {testType === 'twoway' && (
                        <>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{indVar1} (Factor A)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.factorA?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.factorA?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.factorA?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.factorA?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{indVar2} (Factor B)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.factorB?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.factorB?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.factorB?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.factorB?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Interaction ({indVar1} x {indVar2})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.interaction?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.interaction?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.interaction?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.interaction?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Error (Residual)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.df}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}

                      {/* Two Factor RBD */}
                      {testType === 'rbd_twoway' && (
                        <>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Replications (Blocks)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_rep}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_rep)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant_rep ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant_rep ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{indVar1} (Factor A)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.factorA?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.factorA?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.factorA?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.factorA?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{indVar2} (Factor B)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.factorB?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.factorB?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.factorB?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.factorB?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Interaction ({indVar1} x {indVar2})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.interaction?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.interaction?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.interaction?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.interaction?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Error (Residual)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.df}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}
                      {/* Multi-Factor CRD/RBD */}
                      {['crd_multifactor', 'rbd_multifactor'].includes(testType) && results.anova_table?.effects && (
                        <>
                          {results.anova_table.effects.map((eff, index) => (
                            <tr key={index} className="border-b border-slate-50 text-slate-700">
                              <td className="py-2.5 font-semibold">{eff.source}</td>
                              <td className="py-2.5 text-right">{eff.ss?.toFixed(3)}</td>
                              <td className="py-2.5 text-right">{eff.df}</td>
                              <td className="py-2.5 text-right">{eff.ms?.toFixed(3)}</td>
                              <td className="py-2.5 text-right font-medium">{eff.f_statistic?.toFixed(3)}</td>
                              <td className="py-2.5 text-right">{formatPValue(eff.p_value)}</td>
                              <td className="py-2.5 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  eff.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                                }`}>
                                  {eff.significant ? 'Significant' : 'Not Significant'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold font-sans">Error (Residual)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.df}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}

                      {/* Split Plot Design */}
                      {testType === 'splitplot' && (
                        <>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Replications (Blocks)</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ss_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.df_rep}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.ms_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.f_rep?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.p_rep)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.significant_rep ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.significant_rep ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Main Plot Treatments ({indVar1})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorA?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.factorA?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.factorA?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.factorA?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.factorA?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold font-sans">Error (a) - Main Plot Residual</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error_a?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error_a?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error_a?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Sub Plot Treatments ({indVar2})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.factorB?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.factorB?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.factorB?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.factorB?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.factorB?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">Interaction ({indVar1} x {indVar2})</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.interaction?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-medium">{results.anova_table?.interaction?.f_statistic?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(results.anova_table?.interaction?.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                results.anova_table?.interaction?.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {results.anova_table?.interaction?.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold font-sans">Error (b) - Sub Plot Residual</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error_b?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error_b?.df}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.error_b?.ms?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                          <tr className="border-b border-slate-50 text-slate-700 font-semibold bg-slate-50/30">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.ss?.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{results.anova_table?.total?.df}</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                            <td className="py-2.5 text-right">-</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Critical Difference CD & SE(d) table */}
              {results.cd_results && results.cd_results.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs animate-fade-in">
                  <h5 className="font-display text-xs font-bold text-slate-700 mb-3 flex items-center space-x-1">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Critical Differences (CD / LSD) & SE(d)</span>
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2 pr-4">Comparison / Treatment Factor</th>
                          <th className="py-2 text-right">Standard Error of Difference (SE(d))</th>
                          <th className="py-2 text-right">Critical Difference (CD at 5%)</th>
                          <th className="py-2 text-right">Critical Difference (CD at 1%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.cd_results.map((res, idx) => (
                          <tr key={idx} className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{res.parameter}</td>
                            <td className="py-2.5 text-right font-mono">{res.se_d.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-mono text-emerald-600 font-semibold">{res.cd_5.toFixed(3)}</td>
                            <td className="py-2.5 text-right font-mono text-indigo-600 font-semibold">{res.cd_1.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Structured Multi-Factor Interaction Grid Table */}
              {renderStructuredGridTableCard(false)}

              {/* TABLES OF MEAN, STANDARD ERRORS AND C.D. */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs animate-fade-in">
                <h5 className="font-display text-xs font-bold text-slate-700 mb-3">TABLES OF MEAN, STANDARD ERRORS AND C.D.</h5>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-sans text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2 pr-4">Treatment</th>
                        <th className="py-2 text-right">Mean</th>
                        <th className="py-2 text-right">S.E.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(results.descriptives || {}).map(([cellName, info]) => (
                        <tr key={cellName} className="border-b border-slate-50 text-slate-700">
                          <td className="py-2.5 font-semibold">{cellName}</td>
                          <td className="py-2.5 text-right font-mono">{info.mean.toFixed(3)}</td>
                          <td className="py-2.5 text-right font-mono">{info.se !== undefined ? info.se.toFixed(3) : '-'}</td>
                        </tr>
                      ))}
                      {/* Footer Rows */}
                      <tr className="border-t border-slate-200 font-semibold text-slate-700 bg-slate-50/20">
                        <td className="py-2.5 font-bold">C.D.</td>
                        <td className="py-2.5 text-right font-mono font-semibold text-slate-700" colSpan={2}>
                          {getCD5Value()}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-50 text-slate-700 bg-slate-50/20">
                        <td className="py-2.5 font-bold">SE(m)</td>
                        <td className="py-2.5 text-right font-mono text-slate-700" colSpan={2}>
                          {getSEmValue()}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-50 text-slate-700 bg-slate-50/20">
                        <td className="py-2.5 font-bold">SE(d)</td>
                        <td className="py-2.5 text-right font-mono text-slate-700" colSpan={2}>
                          {getSEdValue()}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-50 text-slate-700 bg-slate-50/20">
                        <td className="py-2.5 font-bold">C.V.</td>
                        <td className="py-2.5 text-right font-mono text-slate-700" colSpan={2}>
                          {results.cv !== undefined ? results.cv.toFixed(3) + '%' : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Post-Hoc Comparisons Table (Only for One-Way CRD) */}
              {testType === 'oneway' && results.posthoc_results && results.posthoc_results.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs animate-fade-in">
                  <h5 className="font-display text-xs font-bold text-slate-700 mb-3">
                    Post-Hoc Pairwise Comparisons ({posthocMethod === 'games_howell' ? 'Games-Howell' : posthocMethod === 'duncan' ? "Duncan's DMRT" : "Tukey's HSD / LSD"})
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2 pr-4">Group (1)</th>
                          <th className="py-2 pr-4">Group (2)</th>
                          <th className="py-2 text-right">Mean Difference</th>
                          <th className="py-2 text-right">p-value</th>
                          <th className="py-2 text-right">Significance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.posthoc_results.map((comp, idx) => (
                          <tr key={idx} className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{comp.group1}</td>
                            <td className="py-2.5 font-semibold">{comp.group2}</td>
                            <td className="py-2.5 text-right font-mono">{comp.mean_diff.toFixed(3)}</td>
                            <td className="py-2.5 text-right">{formatPValue(comp.p_value)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                comp.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {comp.significant ? 'Significant' : 'Not Significant'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Assumption Checks Section */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs animate-fade-in">
                <div className="flex items-center space-x-1.5 mb-2">
                  <Info className="h-4 w-4 text-brand-indigo" />
                  <h5 className="font-display text-xs font-bold text-slate-700">Assumption Checks</h5>
                </div>
                <p className="font-sans text-[10px] text-slate-400 mb-3 leading-normal">
                  ANOVA models assume normally distributed data and homogeneous variances within groups.
                </p>
                <div className="space-y-3">
                  {/* Shapiro-Wilk Normality Checks */}
                  <div className="space-y-2">
                    <p className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider">Normality Check (Shapiro-Wilk)</p>
                    {Object.entries(results.shapiro_results || {}).map(([column, meta]) => (
                      <div key={column} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                        <span className="font-semibold text-slate-700 font-sans">{column}</span>
                        {meta.error ? (
                          <span className="text-slate-400 italic">{meta.error}</span>
                        ) : (
                          <div className="flex space-x-4 items-center">
                            <span className="text-slate-500 font-mono">W = {meta.stat.toFixed(3)}</span>
                            <span className="text-slate-500 font-mono">{formatPValue(meta.p_value)}</span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              meta.normal ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {meta.normal ? 'Normally Distributed' : (column === 'Model Residuals' ? 'Not Normal' : 'Non-Normal Distribution')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {Object.keys(results.shapiro_results || {}).length === 0 && (
                      <p className="text-xs text-slate-400 italic">Normality tests bypassed for this ANOVA configuration.</p>
                    )}
                  </div>

                  {/* Levene's Equality of Variances Check */}
                  {results.levene_results && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Homogeneity of Variance Check (Levene's Test)</p>
                      <div className="flex justify-between items-center text-xs pb-1">
                        <span className="font-semibold text-slate-700">Levene's Test (Across groups)</span>
                        <div className="flex space-x-4 items-center">
                          <span className="text-slate-500 font-mono">Statistic = {results.levene_results.stat.toFixed(3)}</span>
                          <span className="text-slate-500 font-mono">{formatPValue(results.levene_results.p_value)}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            results.levene_results.equal_var ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {results.levene_results.equal_var ? 'Homogeneous Variances' : 'Heterogeneous Variances'}
                          </span>
                        </div>
                      </div>
                      <p className="font-sans text-[9px] text-slate-400 mt-1 italic leading-normal">
                        * Levene's test p &ge; 0.05 indicates equal variances.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Base64 Plot View */}
              {results.plot && (
                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-inner space-y-4">
                  <img
                    src={`data:image/png;base64,${results.plot}`}
                    alt="ANOVA Plot Chart"
                    className="max-h-[320px] w-auto object-contain rounded-2xl border border-slate-200/50 bg-white p-2 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadPlot}
                    className="flex items-center space-x-1.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-sans text-xs font-bold px-4 py-2.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download ANOVA Plot</span>
                  </button>
                </div>
              )}

              {/* Post-Hoc Mean Separation Action */}
              {results.posthoc_letters && Object.keys(results.posthoc_letters).length > 0 && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => setPostHocModalOpen(true)}
                    className="flex items-center space-x-2 rounded-2xl bg-brand-indigo px-6 py-3.5 hover:bg-indigo-700 text-white font-sans text-sm font-bold shadow-md transition-all cursor-pointer animate-pulse-subtle"
                  >
                    <span>Run Post-Hoc Analysis (Mean Separation)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {file && (
            <button
              onClick={() => setViewerOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center space-x-1"
            >
              <Eye className="h-4 w-4 text-brand-orange" />
              <span>View Data</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <DatasetViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={file}
        onSave={handleSaveEditedData}
      />

      {/* Post-Hoc Mean Separation Modal */}
      {postHocModalOpen && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative flex h-full max-h-[600px] w-full max-w-4xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-800">
                  Post-Hoc Mean Separation Analysis ({posthocMethod === 'games_howell' ? 'Games-Howell' : posthocMethod === 'duncan' ? "Duncan's DMRT" : "Tukey's HSD / LSD"})
                </h3>
                <p className="font-sans text-xs text-slate-400">
                  Pairwise comparison of treatment means with significance groupings at the 5% level.
                </p>
              </div>
              <button
                onClick={() => setPostHocModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* For Multi-Factor / Two-Way ANOVA: Render Multi-Factor Interaction Grid Table & Grouped Post-Hoc Plot */}
              {renderStructuredGridTableCard(true)}

              {/* For One-Way ANOVA: Render Single-Factor Table & Standard Bar Chart */}
              {getAvailableFactors().length < 2 && (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <h5 className="font-display text-xs font-bold text-slate-700 mb-3">Significance Grouping Table</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse font-sans text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold">
                            <th className="py-2 pr-4">Treatment</th>
                            <th className="py-2 text-right">Mean</th>
                            <th className="py-2 text-right">S.E.</th>
                            <th className="py-2 text-right">Significance Group</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(results.descriptives || {})
                            .sort((a, b) => a[0].localeCompare(b[0], undefined, {numeric: true, sensitivity: 'base'}))
                            .map(([cellName, info]) => (
                              <tr key={cellName} className="border-b border-slate-50 text-slate-700">
                                <td className="py-2.5 font-semibold">{cellName}</td>
                                <td className="py-2.5 text-right font-mono">{info.mean.toFixed(3)}</td>
                                <td className="py-2.5 text-right font-mono">{info.se !== undefined ? info.se.toFixed(3) : '-'}</td>
                                <td className="py-2.5 text-right font-bold text-brand-indigo">{results.posthoc_letters?.[cellName] || '-'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Graph Customization Settings */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs space-y-3">
                    <h5 className="font-display text-xs font-bold text-slate-700">Customize Graph Settings</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Font Size */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Font Size (px)</label>
                        <input
                          type="number"
                          min="6"
                          max="24"
                          value={postHocFontSize}
                          onChange={(e) => setPostHocFontSize(parseInt(e.target.value) || 10)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                        />
                      </div>
                      {/* Font Color */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Font Color</label>
                        <div className="flex space-x-2">
                          <input
                            type="color"
                            value={postHocFontColor.startsWith('#') && postHocFontColor.length === 7 ? postHocFontColor : '#334155'}
                            onChange={(e) => setPostHocFontColor(e.target.value)}
                            className="h-8 w-10 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            placeholder="#334155"
                            value={postHocFontColor}
                            onChange={(e) => setPostHocFontColor(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                          />
                        </div>
                      </div>
                      {/* Color Scheme */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Color Scheme</label>
                        <select
                          value={palette}
                          onChange={(e) => setPalette(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                        >
                          <option value="Oranges">Agricultural Orange</option>
                          <option value="Blues">Ocean Blue</option>
                          <option value="Greens">Forest Green</option>
                          <option value="coolwarm">Divergent Coolwarm</option>
                          <option value="Purples">Deep Purple</option>
                          <option value="magma">Magma Pink-Black</option>
                          <option value="sunset">Sunset Glow</option>
                          <option value="crest">Crest Teal</option>
                        </select>
                      </div>
                      {/* Bar Color */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Bar Color</label>
                        <div className="flex space-x-2">
                          <input
                            type="color"
                            value={postHocBarColor.startsWith('#') && postHocBarColor.length === 7 ? postHocBarColor : '#EA580C'}
                            onChange={(e) => setPostHocBarColor(e.target.value)}
                            className="h-8 w-10 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            placeholder="Default theme color"
                            value={postHocBarColor}
                            onChange={(e) => setPostHocBarColor(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {/* Chart Title */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Chart Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Mean Separation Plot"
                          value={postHocChartTitle}
                          onChange={(e) => setPostHocChartTitle(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                        />
                      </div>
                      {/* X-Axis Label */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">X-Axis Label</label>
                        <input
                          type="text"
                          placeholder="e.g. Treatments"
                          value={postHocXLabel}
                          onChange={(e) => setPostHocXLabel(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                        />
                      </div>
                      {/* Y-Axis Label */}
                      <div className="space-y-1">
                        <label className="font-sans text-[9px] font-bold text-slate-400 uppercase">Y-Axis Label</label>
                        <input
                          type="text"
                          placeholder="e.g. Yield"
                          value={postHocYLabel}
                          onChange={(e) => setPostHocYLabel(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Plotly Chart */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col space-y-4">
                    <div className="w-full flex items-center justify-between border-b border-slate-200/50 pb-3">
                      <h5 className="font-display text-xs font-bold text-slate-700">Mean Separation Chart (with Error Bars & Groupings)</h5>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <span className="font-sans text-[9px] font-bold text-slate-400 uppercase">DPI:</span>
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
                        <div className="h-4 w-px bg-slate-200" />
                        <button
                          onClick={() => handleDownloadPostHocChart('png')}
                          className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Download Chart as PNG"
                        >
                          <Download className="h-3 w-3" />
                          <span>PNG</span>
                        </button>
                        <button
                          onClick={() => handleDownloadPostHocChart('svg')}
                          className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Download Chart as SVG"
                        >
                          <Download className="h-3 w-3" />
                          <span>SVG</span>
                        </button>
                      </div>
                    </div>

                    <div className="w-full bg-white rounded-xl p-2 border border-slate-100 shadow-xs flex justify-center">
                      <div ref={chartRef} className="w-full max-w-full" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center space-x-1 bg-brand-indigo/10 p-1 rounded-xl border border-brand-indigo/20">
                <span className="font-sans text-[9px] font-bold text-brand-indigo px-2 uppercase shrink-0">Post-Hoc:</span>
                <button
                  onClick={() => handleDownloadPostHocReport('txt')}
                  className="rounded-lg bg-brand-indigo hover:bg-indigo-700 text-white font-sans text-[10px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
                  title="Save as Text"
                >
                  TXT
                </button>
                <button
                  onClick={() => handleDownloadPostHocReport('doc')}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-[10px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
                  title="Export to Word"
                >
                  Word
                </button>
              </div>
              <button
                onClick={() => setPostHocModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnovaModal;
