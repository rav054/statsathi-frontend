import React, { useState, useRef, useEffect } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, Upload, Check, AlertCircle, Download, RefreshCw, Info, Eye } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';

const NonParametricModal = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();
  
  // State for dataset selection
  const [file, setFile] = useState(null);




  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // State for test configurations
  const [testType, setTestType] = useState('mann_whitney');
  const [col1, setCol1] = useState('');
  const [col2, setCol2] = useState('');
  const [selectedCols, setSelectedCols] = useState([]);
  
  // State for results
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const formatPValue = (p) => {
    if (typeof p !== 'number') return 'p = N/A';
    if (p < 0.001) return 'p < 0.001';
    return `p = ${p.toFixed(4)}`;
  };

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  // Upload file to parse columns immediately
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
        setCol1(data.numeric_columns[0]);
        const initialSelected = [data.numeric_columns[0]];
        if (data.numeric_columns.length > 1) {
          setCol2(data.numeric_columns[1]);
          initialSelected.push(data.numeric_columns[1]);
        }
        setSelectedCols(initialSelected);
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
    if (!file) {
      setError("Please upload a dataset first.");
      return;
    }

    // Validation based on test type
    if (testType === 'mann_whitney' || testType === 'kruskal_wallis') {
      if (selectedCols.length < 2) {
        setError("Independent groups comparison requires selecting at least 2 variables.");
        return;
      }
    } else if (testType === 'wilcoxon' || testType === 'chi_square') {
      if (selectedCols.length !== 2) {
        setError("This test requires selecting exactly 2 variables.");
        return;
      }
    } else if (testType === 'friedman') {
      if (selectedCols.length < 3) {
        setError("Friedman repeated-measures test requires selecting at least 3 variables.");
        return;
      }
    }

    setLoadingAnalysis(true);
    setError(null);
    setResults(null);

    // Smart Routing for Independent tests
    let routed_test_type = testType;
    if (testType === 'mann_whitney' || testType === 'kruskal_wallis') {
      routed_test_type = selectedCols.length === 2 ? 'mann_whitney' : 'kruskal_wallis';
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('test_type', routed_test_type);
    
    // Append parameters
    if (selectedCols.length >= 1) {
      formData.append('col1', selectedCols[0]);
    }
    if (selectedCols.length >= 2) {
      formData.append('col2', selectedCols[1]);
    }
    formData.append('cols_str', selectedCols.join(','));

    try {
      const res = await fetch(`${API_URL}/analyze/nonparametric`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Analysis execution failed.");
      }
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleDownloadPlot = () => {
    if (!results || !results.plot) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${results.plot}`;
    link.download = `nonparametric_plot_${testType}_${col1}_vs_${col2}.png`;
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

    let report = `==================================================\n`;
    report += `         STAT SATHI NON-PARAMETRIC REPORT         \n`;
    report += `==================================================\n\n`;
    report += `Test Applied: ${results.statistics.test_name || 'Non-Parametric Test'}\n`;
    report += `Dataset: ${file ? file.name : 'N/A'}\n`;
    report += `Variables Analysed:\n`;
    selectedCols.forEach((colName, idx) => {
      report += `  - Variable ${idx + 1}: ${colName}\n`;
    });
    report += `\n--------------------------------------------------\n`;
    report += `1. TEST STATISTICS\n`;
    report += `--------------------------------------------------\n`;
    
    const name = results.statistics.test_name || '';
    const statSymbol = (() => {
      if (name.includes("Mann-Whitney")) return "U";
      if (name.includes("Wilcoxon")) return "W";
      if (name.includes("Kruskal-Wallis")) return "H";
      if (name.includes("Friedman")) return "Chi-Square";
      if (name.includes("Chi-Square")) return "Chi-Square";
      return "Statistic";
    })();

    if (results.statistics.statistic !== undefined) {
      report += `${statSymbol}: ${results.statistics.statistic.toFixed(4)}\n`;
    }
    if (results.statistics.df !== undefined) {
      report += `Degrees of Freedom (df): ${results.statistics.df}\n`;
    }
    report += `p-Value: ${results.statistics.p_value < 0.001 ? 'p < 0.001' : results.statistics.p_value.toFixed(6)}\n`;
    
    if (results.statistics.effect_size !== undefined && results.statistics.effect_size_name) {
      report += `Effect Size (${results.statistics.effect_size_name}): ${results.statistics.effect_size.toFixed(4)}\n`;
    }

    report += `Result: ${results.statistics.significant ? 'Statistically Significant (Reject H0)' : 'Not Statistically Significant (Fail to Reject H0)'}\n`;
    
    // Chi-Square contingency table
    if (testType === 'chisquare' && results.statistics.contingency_table) {
      report += `\nContingency Table (Counts):\n`;
      const ct = results.statistics.contingency_table;
      report += `  Variables: ${selectedCols[0]} vs ${selectedCols[1]}\n`;
      report += `  Values formatted as category cross-counts. Inspect UI report for complete structure.\n`;
    }

    report += `\n--------------------------------------------------\n`;
    report += `2. SAMPLE GROUP DESCRIPTIVES\n`;
    report += `--------------------------------------------------\n`;
    
    if (testType === 'kruskal' || testType === 'friedman') {
      results.statistics.medians.forEach((m, idx) => {
        const cName = selectedCols[idx] || `Group ${idx + 1}`;
        const iqrStr = results.statistics.iqrs && results.statistics.iqrs[idx] ? ` (IQR: ${results.statistics.iqrs[idx].toFixed(2)})` : '';
        report += `${cName}: Median = ${m.toFixed(4)}${iqrStr}\n`;
      });
    } else if (testType === 'chisquare') {
      report += `Categorical distributions mapped. Inspect UI summaries.\n`;
    } else {
      const n1 = results.statistics.n1 !== undefined ? results.statistics.n1 : results.statistics.n;
      const n2 = results.statistics.n2 !== undefined ? results.statistics.n2 : results.statistics.n;
      const med1 = results.statistics.median1 !== undefined ? results.statistics.median1 : results.statistics.median_group1;
      const med2 = results.statistics.median2 !== undefined ? results.statistics.median2 : results.statistics.median_group2;
      const q25_1 = results.statistics.q25_group1;
      const q75_1 = results.statistics.q75_group1;
      const q25_2 = results.statistics.q25_group2;
      const q75_2 = results.statistics.q75_group2;
      
      const iqrStr1 = (q25_1 !== undefined && q75_1 !== undefined) ? ` (IQR: ${q25_1.toFixed(2)} - ${q75_1.toFixed(2)})` : '';
      const iqrStr2 = (q25_2 !== undefined && q75_2 !== undefined) ? ` (IQR: ${q25_2.toFixed(2)} - ${q75_2.toFixed(2)})` : '';

      report += `${selectedCols[0] || 'Group 1'}:\n`;
      report += `  - Sample Size (n): ${n1}\n`;
      if (med1 !== undefined && med1 !== null) report += `  - Median: ${med1.toFixed(4)}${iqrStr1}\n`;
      
      report += `${selectedCols[1] || 'Group 2'}:\n`;
      report += `  - Sample Size (n): ${n2}\n`;
      if (med2 !== undefined && med2 !== null) report += `  - Median: ${med2.toFixed(4)}${iqrStr2}\n`;
      
      if (results.statistics.median_difference !== undefined) {
        const q25_diff = results.statistics.q25_difference;
        const q75_diff = results.statistics.q75_difference;
        const iqrDiffStr = (q25_diff !== undefined && q75_diff !== undefined) ? ` (IQR: ${q25_diff.toFixed(2)} - ${q75_diff.toFixed(2)})` : '';
        report += `\nPaired Differences:\n`;
        report += `  - Median Difference: ${results.statistics.median_difference.toFixed(4)}${iqrDiffStr}\n`;
      }
    }
    
    report += `\n==================================================\n`;
    report += `Report generated on ${new Date().toLocaleString()}\n`;
    report += `Stat Sathi - Your Trustworthy Research Analytics Companion\n`;
    report += `Curated by ${user ? user.full_name : 'Guest Researcher'}\n`;
    report += `==================================================\n`;

    const fileName = `StatSathi_NonParametricReport_${testType}_${selectedCols.join('_')}`;
    const title = `Stat Sathi ${results.statistics.test_name || 'Non-Parametric Test'} Report`;

    if (format === 'txt') {
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'doc') {
      const name = results.statistics.test_name || '';
      const statSymbol = (() => {
        if (name.includes("Mann-Whitney")) return "U";
        if (name.includes("Wilcoxon")) return "W";
        if (name.includes("Kruskal-Wallis")) return "H";
        if (name.includes("Friedman")) return "Chi-Square";
        if (name.includes("Chi-Square")) return "Chi-Square";
        return "Statistic";
      })();

      let statsRows = `
        <tr>
          <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Test Statistic (${statSymbol})</td>
          <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${results.statistics.statistic !== undefined ? results.statistics.statistic.toFixed(6) : 'N/A'}</td>
        </tr>
      `;
      if (results.statistics.df !== undefined) {
        statsRows += `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Degrees of Freedom (df)</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${results.statistics.df}</td>
          </tr>
        `;
      }
      statsRows += `
        <tr>
          <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">p-value</td>
          <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: ${results.statistics.significant ? '#EF4444' : '#1E293B'};">${results.statistics.p_value < 0.001 ? 'p &lt; 0.001' : results.statistics.p_value.toFixed(6)}</td>
        </tr>
      `;
      if (results.statistics.effect_size !== undefined && results.statistics.effect_size_name) {
        statsRows += `
          <tr>
            <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Effect Size (${results.statistics.effect_size_name})</td>
            <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${results.statistics.effect_size.toFixed(4)}</td>
          </tr>
        `;
      }
      statsRows += `
        <tr>
          <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Conclusion</td>
          <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; color: ${results.statistics.significant ? '#10B981' : '#64748B'};">${results.statistics.significant ? 'Statistically Significant (Reject H₀)' : 'Not Statistically Significant (Fail to Reject H₀)'}</td>
        </tr>
      `;

      let descriptivesTable = '';
      if (testType === 'kruskal' || testType === 'friedman') {
        descriptivesTable = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Sample Group Medians</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Group Name</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Median</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">IQR</th>
              </tr>
            </thead>
            <tbody>
              ${results.statistics.medians.map((m, idx) => {
                const cName = selectedCols[idx] || `Group ${idx + 1}`;
                const iqrVal = results.statistics.iqrs && results.statistics.iqrs[idx] ? results.statistics.iqrs[idx].toFixed(4) : '-';
                return `
                  <tr>
                    <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${cName}</td>
                    <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${m.toFixed(4)}</td>
                    <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${iqrVal}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          </div>
        `;
      } else if (testType === 'chisquare') {
        descriptivesTable = ''; 
      } else {
        const n1 = results.statistics.n1 !== undefined ? results.statistics.n1 : results.statistics.n;
        const n2 = results.statistics.n2 !== undefined ? results.statistics.n2 : results.statistics.n;
        const med1 = results.statistics.median1 !== undefined ? results.statistics.median1 : results.statistics.median_group1;
        const med2 = results.statistics.median2 !== undefined ? results.statistics.median2 : results.statistics.median_group2;
        const q25_1 = results.statistics.q25_group1;
        const q75_1 = results.statistics.q75_group1;
        const q25_2 = results.statistics.q25_group2;
        const q75_2 = results.statistics.q75_group2;
        
        const iqrStr1 = (q25_1 !== undefined && q75_1 !== undefined) ? `${q25_1.toFixed(3)} - ${q75_1.toFixed(3)}` : 'N/A';
        const iqrStr2 = (q25_2 !== undefined && q75_2 !== undefined) ? `${q25_2.toFixed(3)} - ${q75_2.toFixed(3)}` : 'N/A';

        let diffRow = '';
        if (results.statistics.median_difference !== undefined) {
          const q25_diff = results.statistics.q25_difference;
          const q75_diff = results.statistics.q75_difference;
          const iqrDiffStr = (q25_diff !== undefined && q75_diff !== undefined) ? `${q25_diff.toFixed(3)} - ${q75_diff.toFixed(3)}` : 'N/A';
          diffRow = `
            <tr>
              <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #4F46E5;">Paired Differences</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; color: #4F46E5;">${n1}</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #4F46E5;">${results.statistics.median_difference.toFixed(4)}</td>
              <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #4F46E5;">${iqrDiffStr}</td>
            </tr>
          `;
        }

        descriptivesTable = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Sample Group Descriptives</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Group Name</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Sample Size (n)</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Median</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">IQR (Q1 - Q3)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${selectedCols[0] || 'Group 1'}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; color: #334155;">${n1}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${med1 !== undefined && med1 !== null ? med1.toFixed(4) : 'N/A'}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${iqrStr1}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${selectedCols[1] || 'Group 2'}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; color: #334155;">${n2}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${med2 !== undefined && med2 !== null ? med2.toFixed(4) : 'N/A'}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace; color: #334155;">${iqrStr2}</td>
              </tr>
              ${diffRow}
            </tbody>
          </table>
          </div>
        `;
      }

      let contingencyTableMarkup = '';
      if (testType === 'chisquare' && results.statistics.contingency_table) {
        const ct = results.statistics.contingency_table;
        contingencyTableMarkup = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Contingency Frequencies Table</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">${selectedCols[0] || 'Var 1'} \\ ${selectedCols[1] || 'Var 2'}</th>
                ${ct.columns.map(colHeader => `<th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">${colHeader}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${ct.index.map((rowLabel, rowIndex) => `
                <tr>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC; color: #1E293B;">${rowLabel}</td>
                  ${ct.values[rowIndex].map(cellValue => `<td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; color: #334155; font-family: 'Courier New', Courier, monospace;">${cellValue}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        `;
      }

      let normalityTableMarkup = '';
      if (results.normality && Object.keys(results.normality).length > 0) {
        let normalityRows = '';
        if (testType === 'wilcoxon') {
          const diffMeta = results.normality.differences;
          if (diffMeta) {
            normalityRows = `
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">Paired Differences</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${diffMeta.stat.toFixed(4)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${diffMeta.p_value < 0.001 ? 'p &lt; 0.001' : diffMeta.p_value.toFixed(6)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold; color: ${diffMeta.normal ? '#F59E0B' : '#10B981'};">${diffMeta.normal ? 'Normal (Parametric Preferred)' : 'Non-Normal (Non-Parametric Justified)'}</td>
              </tr>
            `;
          }
        } else {
          normalityRows = Object.entries(results.normality).map(([column, meta]) => {
            if (meta.error) {
              return `
                <tr>
                  <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${column}</td>
                  <td colspan="3" style="border: 1px solid #CBD5E1; padding: 10px; color: #EF4444; font-style: italic;">${meta.error}</td>
                </tr>
              `;
            }
            return `
              <tr>
                <td style="border: 1px solid #CBD5E1; padding: 10px; font-weight: bold; background-color: #F8FAFC;">${column}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${meta.stat.toFixed(4)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-family: 'Courier New', Courier, monospace;">${meta.p_value < 0.001 ? 'p &lt; 0.001' : meta.p_value.toFixed(6)}</td>
                <td style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold; color: ${meta.normal ? '#F59E0B' : '#10B981'};">${meta.normal ? 'Normal (Parametric Preferred)' : 'Non-Normal (Non-Parametric Justified)'}</td>
              </tr>
            `;
          }).join('');
        }

        normalityTableMarkup = `
          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">Normality Check & Justification (Shapiro-Wilk Test)</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Variable</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">W Statistic</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">p-value</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: center; font-weight: bold;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${normalityRows}
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
          <h1>Stat Sathi Non-Parametric Hypothesis Test Report</h1>
          
          <div align="center">
          <table align="center" class="meta-table" style="width: 75%;">
            <tr>
              <td class="meta-label">Test Applied</td>
              <td>${results.statistics.test_name || 'Non-Parametric Test'}</td>
            </tr>
            <tr>
              <td class="meta-label">Dataset File</td>
              <td>${file ? file.name : 'N/A'}</td>
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

          <h2 style="color: #4F46E5; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 20px;">1. Test Statistics</h2>
          <div align="center">
          <table align="center" style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #4F46E5; color: white;">
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-weight: bold;">Parameter</th>
                <th style="border: 1px solid #CBD5E1; padding: 10px; text-align: right; font-weight: bold;">Value</th>
              </tr>
            </thead>
            <tbody>
              ${statsRows}
            </tbody>
          </table>
          </div>

          ${descriptivesTable}

          ${contingencyTableMarkup}

          ${normalityTableMarkup}

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

  function handleReset() {
    setFile(null);
    setColumns([]);
    setNumericColumns([]);
    setTestType('mann_whitney');
    setCol1('');
    setCol2('');
    setSelectedCols([]);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[640px] w-full max-w-4xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-800">
              Non-Parametric Hypothesis Testing
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Analyze data that doesn't follow normal distribution. Mann-Whitney U, Wilcoxon, Kruskal-Wallis.
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

          {/* Step 1: Upload */}
          {!file && !loadingCols && (
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-16 px-6 text-center cursor-pointer border-slate-300 hover:border-brand-indigo hover:bg-slate-50/50 transition-all"
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
              <p className="font-sans text-sm font-semibold text-slate-700">Select or drop dataset for Non-Parametric analysis</p>
              <p className="font-sans text-xs text-slate-400 mt-1">Supports CSV, XLSX, and XLS formats</p>
            </div>
          )}

          {/* Loading headers */}
          {loadingCols && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Reading dataset columns...</p>
            </div>
          )}

          {/* Step 2: Config Form */}
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

              <div className="grid grid-cols-1 gap-6">
                {/* Select Test Type */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Non-Parametric Test Type</label>
                  <select
                    value={testType}
                    onChange={(e) => {
                      setTestType(e.target.value);
                      setSelectedCols([]);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all"
                  >
                    {(selectedCols.length === 0 || selectedCols.length <= 2) && (
                      <option value="mann_whitney">Independent Groups Comparison (Mann-Whitney / Kruskal-Wallis)</option>
                    )}
                    {(selectedCols.length === 0 || selectedCols.length <= 2) && (
                      <option value="wilcoxon">Wilcoxon Signed-Rank Test (2 Paired Groups)</option>
                    )}
                    {(selectedCols.length === 0 || selectedCols.length >= 3) && (
                      <option value="kruskal_wallis">Kruskal-Wallis H-Test (3+ Independent Groups)</option>
                    )}
                    {(selectedCols.length === 0 || selectedCols.length >= 3) && (
                      <option value="friedman">Friedman Test (3+ Repeated Measures)</option>
                    )}
                    {(selectedCols.length === 0 || selectedCols.length <= 2) && (
                      <option value="chi_square">Chi-Square Test (2 Categorical Variables)</option>
                    )}
                  </select>
                </div>

                {/* Variable Checkbox Grid */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Select Variables for Comparison</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 max-h-[140px] overflow-y-auto border border-slate-200 rounded-xl p-3 bg-white">
                    {(testType === 'chi_square' ? columns : numericColumns).map(col => (
                      <label key={col} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCols.includes(col)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (['wilcoxon', 'chi_square'].includes(testType) && selectedCols.length >= 2) {
                                return;
                              }
                              if (testType === 'mann_whitney' && selectedCols.length >= 2) {
                                setTestType('kruskal_wallis');
                              }
                              setSelectedCols([...selectedCols, col]);
                            } else {
                              const updated = selectedCols.filter(c => c !== col);
                              setSelectedCols(updated);
                              if (testType === 'kruskal_wallis' && updated.length === 2) {
                                setTestType('mann_whitney');
                              }
                            }
                          }}
                          className="rounded border-slate-300 text-brand-orange focus:ring-brand-orange h-3.5 w-3.5"
                        />
                        <span className="truncate">{col}</span>
                      </label>
                    ))}
                  </div>
                  <p className="font-sans text-[10px] text-slate-400 mt-1 italic">
                    {testType === 'mann_whitney' || testType === 'kruskal_wallis' 
                      ? "Select 2 columns for Mann-Whitney U, or 3+ columns for Kruskal-Wallis (auto-routed)." 
                      : testType === 'wilcoxon' 
                      ? "Select exactly 2 paired variables." 
                      : testType === 'friedman' 
                      ? "Select 3 or more repeated measures paired variables." 
                      : "Select exactly 2 categorical variables."}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-orange py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-orange-100 hover:bg-orange-600 transition-colors"
              >
                Run Non-Parametric Test
              </button>
            </form>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-orange border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Running rankings calculations...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Output */}
          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Statistical Report (Non-Parametric Analysis)
                  </h4>
                  <p className="text-xs text-brand-orange font-semibold mt-0.5">
                    Test Applied: {results.statistics.test_name || 'Non-Parametric Test'}
                  </p>
                </div>
                <div className="flex space-x-2">
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

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm relative">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">
                      {results.statistics.test_name || 'Test Statistic'}
                    </p>
                  </div>
                  <p className="font-display text-lg font-bold text-slate-800 mt-1 font-sans">
                    {(() => {
                      const name = results.statistics.test_name;
                      if (name.includes("Mann-Whitney")) return "U";
                      if (name.includes("Wilcoxon")) return "W";
                      if (name.includes("Kruskal-Wallis")) return "H";
                      if (name.includes("Friedman")) return "χ²_F";
                      if (name.includes("Chi-Square")) return "χ²";
                      return "T";
                    })()} = {results.statistics.statistic.toFixed(4)}
                  </p>
                  {results.statistics.degrees_of_freedom !== undefined && (
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5 font-sans">df = {results.statistics.degrees_of_freedom}</p>
                  )}
                  {results.statistics.effect_size !== undefined && (
                    <p className="font-sans text-[10px] text-brand-orange font-bold mt-1.5 font-sans">
                      Effect Size = {results.statistics.effect_size.toFixed(4)}
                      <span className="text-[9px] font-normal text-slate-400 ml-1 font-sans">
                        {(() => {
                          const name = results.statistics.test_name;
                          if (name.includes("Chi-Square")) return "(Cramer's V)";
                          if (name.includes("Friedman")) return "(Kendall's W)";
                          if (name.includes("Kruskal-Wallis")) return "(η²_H)";
                          return "(Rank-Biserial r)";
                        })()}
                      </span>
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Probability Value</p>
                  <p className="font-display text-lg font-bold text-slate-800 mt-1">
                    {formatPValue(results.statistics.p_value)}
                  </p>
                  <span className={`inline-block mt-1.5 rounded px-1.5 py-0.5 font-sans text-[9px] font-bold ${
                    results.statistics.significant ? 'bg-orange-50 text-brand-orange border border-orange-100' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {results.statistics.significant ? 'p < 0.05 (Significant)' : 'p ≥ 0.05 (Not Significant)'}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Null Hypothesis (H₀)</p>
                  <p className={`font-sans text-xs font-semibold mt-2 leading-snug ${
                    results.statistics.significant ? 'text-brand-orange' : 'text-slate-600'
                  }`}>
                    {results.statistics.significant 
                      ? 'Reject Null Hypothesis. Significant difference in distribution medians.' 
                      : 'Fail to Reject Null Hypothesis. Distribution medians are similar.'}
                  </p>
                </div>
              </div>

              {/* Medians Statistics Table (Only for Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman) */}
              {!results.statistics.contingency_table && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <h5 className="font-display text-xs font-bold text-slate-700 mb-3">Sample Medians (Non-Parametric Centers)</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2 font-sans">Variable / Group</th>
                          <th className="py-2 text-right font-sans">Sample Size (n)</th>
                          <th className="py-2 text-right font-sans">Median</th>
                          <th className="py-2 text-right font-sans">IQR (Q1 - Q3)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['Mann-Whitney U Test', 'Wilcoxon Signed-Rank Test'].includes(results.statistics.test_name) && (
                          <>
                            <tr className="border-b border-slate-50 text-slate-700">
                              <td className="py-2.5 font-semibold font-sans">{selectedCols[0] || col1}</td>
                              <td className="py-2.5 text-right font-sans">{results.statistics.n_group1 || results.statistics.n}</td>
                              <td className="py-2.5 text-right font-sans">{results.statistics.median_group1?.toFixed(4)}</td>
                              <td className="py-2.5 text-right font-sans">
                                {results.statistics.q25_group1 !== undefined && results.statistics.q75_group1 !== undefined
                                  ? `${results.statistics.q25_group1.toFixed(2)} - ${results.statistics.q75_group1.toFixed(2)}`
                                  : '-'}
                              </td>
                            </tr>
                            <tr className="border-b border-slate-50 text-slate-700">
                              <td className="py-2.5 font-semibold font-sans">{selectedCols[1] || col2}</td>
                              <td className="py-2.5 text-right font-sans">{results.statistics.n_group2 || results.statistics.n}</td>
                              <td className="py-2.5 text-right font-sans">{results.statistics.median_group2?.toFixed(4)}</td>
                              <td className="py-2.5 text-right font-sans">
                                {results.statistics.q25_group2 !== undefined && results.statistics.q75_group2 !== undefined
                                  ? `${results.statistics.q25_group2.toFixed(2)} - ${results.statistics.q75_group2.toFixed(2)}`
                                  : '-'}
                              </td>
                            </tr>
                            {results.statistics.median_difference !== undefined && (
                              <tr className="border-b border-slate-50 text-slate-500 bg-slate-50/50">
                                <td className="py-2.5 font-semibold font-sans">Median Difference (Paired)</td>
                                <td className="py-2.5 text-right font-sans">-</td>
                                <td className="py-2.5 text-right font-sans">{results.statistics.median_difference.toFixed(4)}</td>
                                <td className="py-2.5 text-right font-sans">
                                  {results.statistics.q25_difference !== undefined && results.statistics.q75_difference !== undefined
                                    ? `${results.statistics.q25_difference.toFixed(2)} - ${results.statistics.q75_difference.toFixed(2)}`
                                    : '-'}
                                </td>
                              </tr>
                            )}
                          </>
                        )}

                        {['Kruskal-Wallis H-Test', 'Friedman Test (Repeated Measures)'].includes(results.statistics.test_name) && results.statistics.medians && (
                          Object.keys(results.statistics.medians).map(colName => (
                            <tr key={colName} className="border-b border-slate-50 text-slate-700">
                              <td className="py-2.5 font-semibold font-sans">{colName}</td>
                              <td className="py-2.5 text-right font-sans">{results.statistics.sizes?.[colName] || results.statistics.n}</td>
                              <td className="py-2.5 text-right font-sans">{results.statistics.medians[colName].toFixed(4)}</td>
                              <td className="py-2.5 text-right font-sans">
                                {results.statistics.q25?.[colName] !== undefined && results.statistics.q75?.[colName] !== undefined
                                  ? `${results.statistics.q25[colName].toFixed(2)} - ${results.statistics.q75[colName].toFixed(2)}`
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contingency Table (Only for Chi-Square Test) */}
              {results.statistics.contingency_table && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <h5 className="font-display text-xs font-bold text-slate-700 mb-3">Contingency Frequencies Table</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2">{selectedCols[0] || col1} \ {selectedCols[1] || col2}</th>
                          {results.statistics.contingency_table.columns.map(colHeader => (
                            <th key={colHeader} className="py-2 text-right">{colHeader}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.statistics.contingency_table.index.map((rowLabel, rowIndex) => (
                          <tr key={rowLabel} className="border-b border-slate-50 text-slate-700">
                            <td className="py-2.5 font-semibold">{rowLabel}</td>
                            {results.statistics.contingency_table.values[rowIndex].map((cellValue, colIndex) => (
                              <td key={colIndex} className="py-2.5 text-right font-sans">{cellValue}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Normality & Justification Checks */}
              {results.normality && Object.keys(results.normality).length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <div className="flex items-center space-x-1.5 mb-2">
                    <Info className="h-4 w-4 text-brand-orange" />
                    <h5 className="font-display text-xs font-bold text-slate-700">Normality Check & Choice Justification</h5>
                  </div>
                  <p className="font-sans text-[10px] text-slate-400 mb-3 leading-normal">
                    If Shapiro-Wilk p &lt; 0.05, the data is **not normally distributed**, which justifies using these distribution-free non-parametric checks.
                  </p>
                  <div className="space-y-2">
                    {testType === 'wilcoxon' ? (
                      results.normality?.differences ? (
                        <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                          <span className="font-semibold text-slate-700 font-sans">Normality of Paired Differences</span>
                          {results.normality.differences.error ? (
                            <span className="text-slate-400 italic">{results.normality.differences.error}</span>
                          ) : (
                            <div className="flex space-x-4 items-center">
                              <span className="text-slate-500 font-sans">W = {results.normality.differences.stat.toFixed(4)}</span>
                              <span className="text-slate-500 font-sans">{formatPValue(results.normality.differences.p_value)}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                results.normality.differences.normal ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {results.normality.differences.normal ? 'Normal (Parametric Preferred)' : 'Non-Normal (Non-Parametric Justified)'}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic font-sans">No normality data available for differences.</p>
                      )
                    ) : (
                      Object.entries(results.normality).map(([column, meta]) => (
                        <div key={column} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                          <span className="font-semibold text-slate-700 font-sans">{column}</span>
                          {meta.error ? (
                            <span className="text-slate-400 italic">{meta.error}</span>
                          ) : (
                            <div className="flex space-x-4 items-center">
                              <span className="text-slate-500 font-sans">W = {meta.stat.toFixed(4)}</span>
                              <span className="text-slate-500 font-sans">{formatPValue(meta.p_value)}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                meta.normal ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {meta.normal ? 'Normal (Parametric Preferred)' : 'Non-Normal (Non-Parametric Justified)'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Base64 Violin Plot View */}
              {results.plot && (
                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-inner">
                  <img
                    src={`data:image/png;base64,${results.plot}`}
                    alt="Non-Parametric Analysis Chart"
                    className="max-h-[320px] w-auto object-contain rounded-2xl border border-slate-200/50 bg-white p-2 shadow-sm"
                  />
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
    </div>
  );
};

export default NonParametricModal;
