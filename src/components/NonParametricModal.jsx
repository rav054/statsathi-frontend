import { apiFetch } from '../utils/apiFetch';
import { useState, useEffect, useCallback } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { X, AlertCircle, Download, RefreshCw, Info, Eye } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import ResultChartPanel from './ResultChartPanel';

// Chart styles offered under the results (drawn by /analyze/result-chart)
const nonParametricChartOptions = (testType, selectedCols) => {
  const classic = { value: 'classic', label: 'Classic' };
  if (testType === 'wilcoxon') {
    return [classic, {
      value: 'paired', label: 'Paired lines', hint: 'One line per pair from the first to the second measurement.',
      fields: { layout: 'long', x_var: selectedCols[0], y_var: selectedCols[1] }
    }];
  }
  if (testType === 'chi_square') {
    return [classic, {
      value: 'mosaic', label: 'Mosaic plot', hint: 'Tile areas show the cross-tabulation; colour shows standardized residuals.',
      fields: { layout: 'long', x_var: selectedCols[0], hue_var: selectedCols[1] }
    }];
  }
  return [
    classic,
    { value: 'raincloud', label: 'Raincloud', hint: 'Density, box plot and every observation.' },
    { value: 'boxswarm', label: 'Box + beeswarm', hint: 'Box plots with every observation.' }
  ];
};

const NonParametricModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token, user } = useAuth();
  
  // State for dataset selection
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ numericColumns: numeric }) => {
      setCol1(numeric[0] || '');
      setCol2(numeric[1] || '');
      setSelectedCols(numeric.slice(0, 2));
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { clear } = dataset;
  const { file, columns, numericColumns } = dataset;

  // State for test configurations
  const [testType, setTestType] = useState('mann_whitney');
  const [col1, setCol1] = useState('');
  const [col2, setCol2] = useState('');
  const [selectedCols, setSelectedCols] = useState([]);
  
  // State for results
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));

  // Fetch the dataset this analysis was run on, then restore its settings so it can be run again
  const restoreSaved = async () => {
    setReopened(false);
    setResults(null);
    const loaded = await dataset.selectProjectDataset(initialAnalysis.dataset, initialAnalysis.projectName);
    if (loaded) {
      setTestType(saved.test || 'mann_whitney');
      setSelectedCols(saved.variables || []);
      setCol1(saved.variables?.[0] || '');
      setCol2(saved.variables?.[1] || '');
    }
  };
  const [chartImage, setChartImage] = useState(null); // chart style chosen below the results, used in reports
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const formatPValue = (p) => {
    if (typeof p !== 'number') return 'p = N/A';
    if (p < 0.001) return 'p < 0.001';
    return `p = ${p.toFixed(4)}`;
  };

  const handleReset = useCallback(() => {
    clear();
    setTestType('mann_whitney');
    setCol1('');
    setCol2('');
    setSelectedCols([]);
    setResults(null);
    setError(null);
  }, [clear]);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen, handleReset]);

  if (!isOpen) return null;

  const handleSaveEditedData = async (editedFile) => {
    setResults(null);
    setError(null);
    if (editedFile) {
      await dataset.selectFile(editedFile);
    }
  };

  // Upload file to parse columns immediately
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
    setChartImage(null);

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
      const res = await apiFetch(`${API_URL}/analyze/nonparametric`, {
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
    if (testType === 'chi_square' && results.statistics.contingency_table) {
      report += `\nContingency Table (Counts):\n`;
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
    } else if (testType === 'chi_square') {
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
    const s = results.statistics;
    const name = s.test_name || 'Non-parametric test';
    const symbol = name.includes('Mann-Whitney') ? 'U' : name.includes('Wilcoxon') ? 'W' : name.includes('Kruskal') ? 'H' : 'χ²';
    const fixed = (v, digits = 4) => (v === null || v === undefined ? 'N/A' : v.toFixed(digits));

    const testRows = [[`Test statistic (${symbol})`, fixed(s.statistic)]];
    if (s.degrees_of_freedom !== undefined) testRows.push(['Degrees of freedom', String(s.degrees_of_freedom)]);
    testRows.push(['p-value', formatP(s.p_value)]);
    if (s.effect_size !== undefined && s.effect_size !== null) testRows.push([`Effect size (${s.effect_size_name || 'effect size'})`, fixed(s.effect_size)]);
    if (s.yates_corrected) testRows.push(['Yates-corrected χ²', `${fixed(s.yates_corrected.statistic)} (p = ${formatP(s.yates_corrected.p_value)})`]);
    if (s.fisher_exact_p !== undefined && s.fisher_exact_p !== null) testRows.push(["Fisher's exact test p", formatP(s.fisher_exact_p)]);
    testRows.push(['Conclusion', s.significant ? 'Statistically significant (reject H₀)' : 'Not statistically significant (fail to reject H₀)']);
    const sections = [{ heading: '1. Test Statistics', tables: [{ columns: ['Parameter', 'Value'], rows: testRows }] }];

    if (s.medians && typeof s.medians === 'object') {
      const groups = Object.keys(s.medians);
      sections.push({
        heading: '2. Group Medians',
        tables: [{ columns: ['Group', 'n', 'Median', 'Q1', 'Q3', 'IQR'], rows: groups.map(g => [g, s.sizes?.[g] ?? '–', fixed(s.medians[g]), fixed(s.q25?.[g]), fixed(s.q75?.[g]), fixed(s.iqr?.[g])]) }]
      });
    } else if (s.median_group1 !== undefined) {
      const rows = [
        [selectedCols[0] || 'Group 1', s.n_group1 ?? s.n ?? '–', fixed(s.median_group1), fixed(s.q25_group1), fixed(s.q75_group1)],
        [selectedCols[1] || 'Group 2', s.n_group2 ?? s.n ?? '–', fixed(s.median_group2), fixed(s.q25_group2), fixed(s.q75_group2)]
      ];
      if (s.median_difference !== undefined) rows.push(['Paired differences', s.n ?? '–', fixed(s.median_difference), fixed(s.q25_difference), fixed(s.q75_difference)]);
      sections.push({
        heading: '2. Group Descriptives',
        tables: [{
          columns: ['Group', 'n', 'Median', 'Q1', 'Q3'],
          rows,
          note: s.n_nonzero !== undefined ? `${s.n_nonzero} of ${s.n} pairs had a non-zero difference; zero differences are excluded from the test.` : undefined
        }]
      });
    }

    if (s.contingency_table) {
      const ct = s.contingency_table;
      const corner = `${selectedCols[0] || 'Variable 1'} \\ ${selectedCols[1] || 'Variable 2'}`;
      const tables = [{ columns: [corner, ...ct.columns], rows: ct.index.map((label, i) => [label, ...ct.values[i]]), caption: 'Observed counts' }];
      if (ct.expected) tables.push({ columns: [corner, ...ct.columns], rows: ct.index.map((label, i) => [label, ...ct.expected[i].map(v => v.toFixed(2))]), caption: 'Expected counts under independence' });
      sections.push({ heading: '3. Contingency Table', tables, bullets: s.notes || [] });
    }

    if (results.normality && Object.keys(results.normality).length > 0) {
      sections.push({
        heading: 'Normality Check (Shapiro-Wilk)',
        paragraphs: ['A significant result (p < 0.05) indicates non-normal data, which supports using a non-parametric test.'],
        tables: [{
          columns: ['Variable', 'W', 'p-value', 'Status'],
          rows: Object.entries(results.normality).map(([column, meta]) => (meta.error
            ? [column, 'N/A', 'N/A', meta.error]
            : [column === 'differences' ? 'Paired differences' : column, fixed(meta.stat), formatP(meta.p_value), meta.normal ? 'Normal' : 'Not normal']))
        }]
      });
    }
    if (chartImage || results.plot) sections.push({ heading: 'Figure', images: [{ data: `data:image/png;base64,${chartImage || results.plot}`, caption: `Figure 1. ${name}` }] });

    return {
      title: 'Non-Parametric Hypothesis Test Report',
      test_applied: name,
      dataset_name: file?.name,
      filename: fileName,
      sections
    };
  };


  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
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
          <button data-dialog-close aria-label="Close"
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

          {/* Step 2: Config Form */}
          {!results && !loadingAnalysis && (
            <div className="space-y-6">
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a dataset for the test"
                hint="Each group or measurement in its own column; for a chi-square test, two categorical columns (CSV or Excel)."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (
              <form onSubmit={runAnalysis} className="space-y-6">
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
            </div>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-orange border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Running rankings calculations...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Output */}
          {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

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
                  <SaveToProjectButton
                    module="nonparametric"
                    report={() => buildDocxReport('report')}
                    source={dataset.source}
                    defaultTitle={`${results?.statistics?.test_name || 'Non-parametric test'} – ${selectedCols.join(', ')}`}
                    parameters={{ test: testType, variables: selectedCols, dataset: file?.name }}
                    result={results}
                  />
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

                  {/* Expected counts, 2x2 alternatives and warnings */}
                  {results.statistics.contingency_table.expected && (
                    <div className="mt-4 pt-3 border-t border-dashed border-slate-100">
                      <h6 className="font-display text-[11px] font-bold text-slate-600 mb-2">Expected Frequencies (under independence)</h6>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse font-sans text-xs text-left">
                          <tbody>
                            {results.statistics.contingency_table.index.map((rowLabel, rowIndex) => (
                              <tr key={rowLabel} className="border-b border-slate-50 text-slate-600">
                                <td className="py-2 font-semibold">{rowLabel}</td>
                                {results.statistics.contingency_table.expected[rowIndex].map((cellValue, colIndex) => (
                                  <td key={colIndex} className={`py-2 text-right font-mono ${cellValue < 5 ? 'text-amber-600 font-bold' : ''}`}>{cellValue.toFixed(2)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {(results.statistics.yates_corrected || results.statistics.fisher_exact_p != null) && (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-sans">
                      {results.statistics.yates_corrected && (
                        <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Yates-Corrected χ²</p>
                          <p className="font-semibold text-slate-700 mt-0.5">
                            {results.statistics.yates_corrected.statistic.toFixed(4)} (p = {results.statistics.yates_corrected.p_value < 0.001 ? '< 0.001' : results.statistics.yates_corrected.p_value.toFixed(4)})
                          </p>
                        </div>
                      )}
                      {results.statistics.fisher_exact_p != null && (
                        <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Fisher's Exact Test</p>
                          <p className="font-semibold text-slate-700 mt-0.5">
                            p = {results.statistics.fisher_exact_p < 0.001 ? '< 0.001' : results.statistics.fisher_exact_p.toFixed(4)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {results.statistics.notes?.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50 py-2 pl-6 pr-3 font-sans text-[11px] text-amber-800">
                      {results.statistics.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                    </ul>
                  )}
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

              {/* Result chart with alternative styles */}
              {results.plot && (
                <ResultChartPanel
                  key={results.plot.slice(-32)}
                  token={token}
                  file={file}
                  classicPlot={results.plot}
                  options={nonParametricChartOptions(testType, selectedCols)}
                  fields={{
                    layout: testType === 'friedman' ? 'wide_complete' : 'wide',
                    cols_str: selectedCols.join(','),
                    p_value: results.statistics?.p_value,
                    test_label: results.statistics?.test_name
                  }}
                  filenameBase={`nonparametric_${testType}`}
                  onImageChange={setChartImage}
                />
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
