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
const parametricChartOptions = (testType, col1, col2) => {
  const classic = { value: 'classic', label: 'Classic' };
  if (testType === 'paired_t') {
    const pairFields = { layout: 'long', x_var: col1, y_var: col2 };
    return [
      classic,
      { value: 'paired', label: 'Paired lines', hint: 'One line per pair from the first to the second measurement, with means ± 95% CI.', fields: pairFields },
      { value: 'paired_estimation', label: 'Estimation plot', hint: 'Paired lines plus the mean difference and its 95% CI on a floating axis.', fields: pairFields }
    ];
  }
  const groupCharts = [
    classic,
    { value: 'raincloud', label: 'Raincloud', hint: 'Density, box plot and every observation.' },
    { value: 'meanci', label: 'Mean ± 95% CI', hint: 'Means with t-based 95% confidence intervals over the observations.' }
  ];
  if (col2 && ['independent_t', 'z_test'].includes(testType)) {
    return [
      ...groupCharts,
      { value: 'boxswarm', label: 'Box + beeswarm', hint: 'Box plots with every observation; the bracket shows the test p-value.' },
      { value: 'estimation', label: 'Estimation plot', hint: 'Observations plus the difference in means and its 95% CI on a floating axis (Gardner-Altman).' }
    ];
  }
  return groupCharts;
};

const ParametricModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token, user } = useAuth();
  
  // State for dataset selection
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ numericColumns: numeric }) => {
      setCol1(numeric[0] || '');
      setCol2(numeric[1] || '');
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { clear } = dataset;
  const { file, numericColumns } = dataset;

  // State for test configurations
  const [testType, setTestType] = useState('independent_t');
  const [col1, setCol1] = useState('');
  const [col2, setCol2] = useState('');
  const [mu, setMu] = useState('');
  
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
      setTestType(saved.test || 'independent_t');
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
    setTestType('independent_t');
    setCol1('');
    setCol2('');
    setMu('');
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

  const runAnalysis = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setError(null);

    if (!file) {
      setError("Please upload a dataset first.");
      return;
    }
    if (!col1) {
      setError("Please select the Primary Variable (Col 1).");
      return;
    }

    // Validation for hypothesized mean
    if (['one_sample_t', 'z_test'].includes(testType) && (testType === 'one_sample_t' || !col2)) {
      if (mu === '' || isNaN(parseFloat(mu))) {
        setError("Hypothesized Population Mean (μ) is required before running the test.");
        return;
      }
    }
    
    setLoadingAnalysis(true);
    setError(null);
    setResults(null);
    setChartImage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('test_type', testType);
    formData.append('col1', col1);
    if (['independent_t', 'paired_t', 'z_test'].includes(testType) && col2) {
      formData.append('col2', col2);
    }
    if (['one_sample_t', 'z_test'].includes(testType)) {
      const parsedMu = parseFloat(mu) || 0.0;
      formData.append('mu', parsedMu);
      formData.append('hypothesized_mean', parsedMu);
    }

    try {
      const res = await apiFetch(`${API_URL}/analyze/parametric`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Parametric analysis execution failed.");
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
    link.download = `parametric_plot_${testType}_${col1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnalyzeNew = () => {
    setResults(null);
    setError(null);
    setMu('');
  };  const handleDownloadReport = (format) => {
    if (!results) return;

    const fileName = `StatSathi_Report_${testType}_${col1}`;

    if (format === 'txt') {
      let report = `==================================================\n`;
      report += `              STAT SATHI STATISTICAL REPORT       \n`;
      report += `==================================================\n\n`;
      report += `Test Applied: ${results.test_used || 'Parametric Test'}\n`;
      report += `Dataset: ${file ? file.name : 'N/A'}\n`;
      report += `Variables Analysed:\n`;
      report += `  - Variable 1 (X): ${col1}\n`;
      if (col2) {
        report += `  - Variable 2 (Y): ${col2}\n`;
      }
      report += `\n--------------------------------------------------\n`;
      report += `1. TEST STATISTICS\n`;
      report += `--------------------------------------------------\n`;
      if (results.statistics.t_statistic !== undefined) {
        report += `t-Statistic: ${results.statistics.t_statistic.toFixed(6)}\n`;
      } else if (results.statistics.z_statistic !== undefined) {
        report += `Z-Statistic: ${results.statistics.z_statistic.toFixed(6)}\n`;
      }
      if (results.statistics.degrees_of_freedom !== undefined) {
        report += `Degrees of Freedom: ${results.statistics.degrees_of_freedom.toFixed(2).replace(/\.00$/, '')}\n`;
      }
      if (results.statistics.hypothesized_mean !== undefined) {
        report += `Hypothesized Mean (mu_0): ${results.statistics.hypothesized_mean}\n`;
      }
      report += `p-Value: ${results.statistics.p_value < 0.001 ? 'p < 0.001' : results.statistics.p_value.toFixed(6)}\n`;
      report += `Significance level (alpha): 0.05\n`;
      report += `Result: ${results.statistics.significant ? 'Statistically Significant (Reject H0)' : 'Not Statistically Significant (Fail to Reject H0)'}\n`;
      
      report += `\n--------------------------------------------------\n`;
      report += `2. DESCRIPTIVE STATISTICS\n`;
      report += `--------------------------------------------------\n`;
      
      const size = results.statistics.n || results.statistics.n_group1;
      const mean = results.statistics.sample_mean !== undefined ? results.statistics.sample_mean : results.statistics.mean_group1;
      const std = results.statistics.sample_std !== undefined ? results.statistics.sample_std : results.statistics.std_group1;
      
      report += `${col1}:\n`;
      report += `  - Sample Size (n): ${size}\n`;
      report += `  - Mean: ${mean.toFixed(4)}\n`;
      report += `  - Std. Deviation: ${std.toFixed(4)}\n`;
      
      if (col2) {
        const size2 = results.statistics.n || results.statistics.n_group2;
        const mean2 = results.statistics.mean_group2;
        const std2 = results.statistics.std_group2;
        report += `${col2}:\n`;
        report += `  - Sample Size (n): ${size2}\n`;
        report += `  - Mean: ${mean2.toFixed(4)}\n`;
        report += `  - Std. Deviation: ${std2 ? std2.toFixed(4) : 'N/A'}\n`;
      }
      
      if (testType === 'paired_t' && results.statistics.mean_difference !== undefined) {
        report += `\nPaired Differences:\n`;
        report += `  - Mean Difference: ${results.statistics.mean_difference.toFixed(4)}\n`;
        report += `  - Std. Deviation of Diff: ${results.statistics.std_difference.toFixed(4)}\n`;
        report += `  - 95% Confidence Interval: [${results.statistics.ci_difference[0].toFixed(4)}, ${results.statistics.ci_difference[1].toFixed(4)}]\n`;
      }
      
      if (testType === 'one_sample_t' && results.statistics.cohens_d !== undefined) {
        report += `\nEffect Size & CI:\n`;
        report += `  - Cohen's d: ${results.statistics.cohens_d.toFixed(4)}\n`;
        report += `  - 95% Confidence Interval: [${results.statistics.ci[0].toFixed(4)}, ${results.statistics.ci[1].toFixed(4)}]\n`;
      }
      
      if (testType === 'z_test' && results.statistics.ci_difference) {
        report += `\nConfidence Interval:\n`;
        report += `  - 95% CI of the Difference: [${results.statistics.ci_difference[0].toFixed(4)}, ${results.statistics.ci_difference[1].toFixed(4)}]\n`;
      }
      
      report += `\n--------------------------------------------------\n`;
      report += `3. ASSUMPTION CHECKS\n`;
      report += `--------------------------------------------------\n`;
      report += `Shapiro-Wilk Normality Test:\n`;
      if (testType === 'paired_t') {
        const diffMeta = results.shapiro_results?.differences;
        if (diffMeta) {
          report += `  - Paired Differences: W = ${diffMeta.stat.toFixed(4)}, p = ${diffMeta.p_value.toFixed(6)} (${diffMeta.normal ? 'Normally Distributed' : 'Non-Normal Distribution'})\n`;
        }
      } else {
        Object.entries(results.shapiro_results || {}).forEach(([column, meta]) => {
          if (meta.error) {
            report += `  - ${column}: ${meta.error}\n`;
          } else {
            report += `  - ${column}: W = ${meta.stat.toFixed(4)}, p = ${meta.p_value.toFixed(6)} (${meta.normal ? 'Normally Distributed' : 'Non-Normal Distribution'})\n`;
          }
        });
      }
      
      if (testType === 'independent_t' && results.levene_results) {
        const lev = results.levene_results;
        report += `\nLevene's Equality of Variances Test:\n`;
        report += `  - Statistic: ${lev.stat.toFixed(4)}, p = ${lev.p_value.toFixed(6)} (${lev.equal_var ? 'Equal Variances' : 'Unequal Variances'})\n`;
      }
      
      report += `\n==================================================\n`;
      report += `Report generated on ${new Date().toLocaleString()}\n`;
      report += `Stat Sathi - Your Trustworthy Research Analytics Companion\n`;
      report += `Curated by ${user ? user.full_name : 'Guest Researcher'}\n`;
      report += `==================================================\n`;

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
    const fixed = (v, digits = 4) => (v === null || v === undefined ? 'N/A' : v.toFixed(digits));
    const interval = (pair) => (pair && pair[0] != null ? `[${pair[0].toFixed(4)}, ${pair[1].toFixed(4)}]` : 'N/A');
    const statName = s.t_statistic !== undefined ? 't' : 'Z';
    const statValue = s.t_statistic !== undefined ? s.t_statistic : s.z_statistic;

    const testRows = [[`Test statistic (${statName})`, fixed(statValue)]];
    if (s.degrees_of_freedom !== undefined && s.degrees_of_freedom !== null) testRows.push(['Degrees of freedom', s.degrees_of_freedom.toFixed(2).replace(/\.00$/, '')]);
    if (s.hypothesized_mean !== undefined) testRows.push(['Hypothesized mean (μ₀)', String(s.hypothesized_mean)]);
    testRows.push(['p-value', formatP(s.p_value)], ['Significance level (α)', '0.05'],
      ['Conclusion', s.significant ? 'Statistically significant (reject H₀)' : 'Not statistically significant (fail to reject H₀)']);

    const descriptiveRows = [[col1, s.n || s.n_group1, fixed(s.sample_mean ?? s.mean_group1), fixed(s.sample_std ?? s.std_group1)]];
    if (col2 && s.mean_group2 !== undefined) descriptiveRows.push([col2, s.n || s.n_group2, fixed(s.mean_group2), fixed(s.std_group2)]);

    const effectRows = [];
    if (s.mean_difference !== undefined) effectRows.push(['Mean difference', fixed(s.mean_difference)]);
    if (s.std_difference !== undefined) effectRows.push(['SD of differences', fixed(s.std_difference)]);
    if (s.se_difference !== undefined && s.se_difference !== null) effectRows.push(['SE of the difference', fixed(s.se_difference)]);
    if (s.ci_difference) effectRows.push(['95% CI of the difference', interval(s.ci_difference)]);
    if (s.ci) effectRows.push(['95% CI of the mean', interval(s.ci)]);
    if (s.cohens_d !== undefined && s.cohens_d !== null) effectRows.push([testType === 'paired_t' ? "Cohen's d_z" : "Cohen's d", fixed(s.cohens_d)]);
    if (s.hedges_g !== undefined && s.hedges_g !== null) effectRows.push(["Hedges' g", fixed(s.hedges_g)]);

    const sections = [{
      heading: '1. Test Statistics',
      tables: [{ columns: ['Parameter', 'Value'], rows: testRows }]
    }];
    if (s.student && s.welch) {
      sections[0].tables.push({
        columns: ['Test', 't', 'df', 'p-value', '95% CI of the difference'],
        rows: [
          ["Student's t (equal variances)", fixed(s.student.t_statistic), fixed(s.student.degrees_of_freedom, 2), formatP(s.student.p_value), interval(s.student.ci_difference)],
          ["Welch's t (unequal variances)", fixed(s.welch.t_statistic), fixed(s.welch.degrees_of_freedom, 2), formatP(s.welch.p_value), interval(s.welch.ci_difference)]
        ],
        caption: 'Both versions of the independent t-test',
        note: `${results.test_used} was reported above, selected by Levene's test.`
      });
    }
    sections.push({ heading: '2. Sample Descriptive Statistics', tables: [{ columns: ['Variable / group', 'n', 'Mean', 'SD'], rows: descriptiveRows }] });
    if (effectRows.length > 0) sections.push({ heading: '3. Effect Size and Confidence Intervals', tables: [{ columns: ['Parameter', 'Value'], rows: effectRows }] });

    const normalityRows = testType === 'paired_t'
      ? (results.shapiro_results?.differences && !results.shapiro_results.differences.error
        ? [['Paired differences', fixed(results.shapiro_results.differences.stat), formatP(results.shapiro_results.differences.p_value), results.shapiro_results.differences.normal ? 'Normal' : 'Not normal']]
        : [])
      : Object.entries(results.shapiro_results || {}).map(([column, meta]) => (meta.error
        ? [column, 'N/A', 'N/A', meta.error]
        : [column, fixed(meta.stat), formatP(meta.p_value), meta.normal ? 'Normal' : 'Not normal']));
    const assumptionTables = [];
    if (normalityRows.length > 0) assumptionTables.push({ columns: ['Variable', 'Shapiro-Wilk W', 'p-value', 'Status'], rows: normalityRows, caption: 'Normality (Shapiro-Wilk)' });
    if (testType === 'independent_t' && results.levene_results) {
      const lev = results.levene_results;
      assumptionTables.push({ columns: ['Comparison', 'Levene statistic', 'p-value', 'Result'], rows: [[`${col1} vs ${col2}`, fixed(lev.stat), formatP(lev.p_value), lev.equal_var ? 'Equal variances' : 'Unequal variances']], caption: "Levene's test for equal variances" });
    }
    if (assumptionTables.length > 0) sections.push({ heading: '4. Assumption Checks', tables: assumptionTables });
    if (chartImage || results.plot) sections.push({ heading: 'Figure', images: [{ data: `data:image/png;base64,${chartImage || results.plot}`, caption: `Figure 1. ${results.test_used || 'Parametric test'}` }] });

    return {
      title: 'Parametric Hypothesis Test Report',
      test_applied: results.test_used || 'Parametric test',
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
              Parametric Hypothesis Testing
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Compare groups assuming normally distributed data. t-Test, Paired t-Test, Z-Test.
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

          {/* Step 2: Configure Test Form */}
          {!results && !loadingAnalysis && (
            <div className="space-y-6">
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a dataset for the test"
                hint="Each group or measurement in its own column (CSV or Excel)."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (
              <form onSubmit={runAnalysis} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Select Test Type */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Hypothesis Test Type</label>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    <option value="independent_t">Independent Two-Sample t-Test</option>
                    <option value="paired_t">Paired Two-Sample t-Test</option>
                    <option value="one_sample_t">One-Sample t-Test</option>
                    <option value="z_test">Z-Test (Compare Means)</option>
                  </select>
                </div>

                {/* Variable 1 */}
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Variable 1 (X)</label>
                  <select
                    value={col1}
                    onChange={(e) => setCol1(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  >
                    {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Variable 2 (Only for two-sample comparisons) */}
                {['independent_t', 'paired_t', 'z_test'].includes(testType) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">Variable 2 (Y)</label>
                    <select
                      value={col2}
                      onChange={(e) => setCol2(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    >
                      <option value="">-- None (Single Group against Mean) --</option>
                      {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Hypothesized Mean (One-Sample / Z-test single group) */}
                {((testType === 'z_test' && !col2) || testType === 'one_sample_t') && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="font-sans text-xs font-bold text-slate-500">Hypothesized Population Mean (μ)</label>
                    <input
                      type="number"
                      step="any"
                      value={mu}
                      onChange={(e) => setMu(parseFloat(e.target.value) || 0.0)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
              >
                Run Parametric Test
              </button>
              </form>
              )}
            </div>
          )}

          {/* Running Analysis Loader */}
          {loadingAnalysis && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
              <p className="font-sans text-sm font-medium text-slate-600 animate-pulse">Running hypothesis test calculations...</p>
            </div>
          )}

          {/* Step 3: Analysis Results Output */}
          {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

          {results && !loadingAnalysis && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Statistical Report
                  </h4>
                  <p className="text-xs text-brand-indigo font-semibold mt-0.5">
                    Test Applied: {results.test_used || 'Parametric Test'}
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
                    module="parametric"
                    report={() => buildDocxReport('report')}
                    source={dataset.source}
                    defaultTitle={`${results?.test_used || 'Parametric test'} – ${[col1, col2].filter(Boolean).join(' vs ')}`}
                    parameters={{ test: testType, variables: [col1, col2].filter(Boolean), dataset: file?.name }}
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

              {/* Warning Banner for Normality Violation */}
              {(() => {
                let showWarning = false;
                let warningMsg = '';
                if (results.shapiro_results) {
                  if (testType === 'paired_t') {
                    const diffMeta = results.shapiro_results.differences;
                    if (diffMeta && diffMeta.p_value < 0.05) {
                      showWarning = true;
                      warningMsg = "Warning: Data significantly deviates from a normal distribution. Consider running a Non-Parametric Test (Wilcoxon Signed-Rank) for paired data.";
                    }
                  } else {
                    const hasViolation = Object.values(results.shapiro_results).some(meta => 
                      meta && meta.p_value !== undefined && meta.p_value < 0.05
                    );
                    if (hasViolation) {
                      showWarning = true;
                      warningMsg = "Warning: Data significantly deviates from a normal distribution. Consider running a Non-Parametric Test (e.g., Mann-Whitney U) for more reliable results.";
                    }
                  }
                }
                return showWarning ? (
                  <div className="flex items-start space-x-2.5 rounded-2xl bg-orange-50 border border-orange-200 p-4 text-orange-800 animate-fade-in">
                    <AlertCircle className="h-5 w-5 shrink-0 text-orange-500 mt-0.5" />
                    <span className="font-sans text-xs font-semibold leading-normal">{warningMsg}</span>
                  </div>
                ) : null;
              })()}

              {/* Main metrics summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm relative">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">
                      {results.test_used || 'Test Statistic'}
                    </p>
                    {testType === 'independent_t' && results.test_used === "Welch's t-Test" && (
                      <div className="group relative cursor-pointer text-amber-500 hover:text-amber-600">
                        <Info className="h-3.5 w-3.5" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2 font-normal shadow-lg leading-normal z-10">
                          Welch's t-test was selected automatically because Levene's test indicated unequal variances between groups (p &lt; 0.05).
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="font-display text-lg font-bold text-slate-800 mt-1">
                    {results.statistics.t_statistic !== undefined 
                      ? `t = ${results.statistics.t_statistic.toFixed(4)}` 
                      : `Z = ${results.statistics.z_statistic.toFixed(4)}`}
                  </p>
                  {results.statistics.degrees_of_freedom !== undefined && (
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                      df = {typeof results.statistics.degrees_of_freedom === 'number' 
                        ? results.statistics.degrees_of_freedom.toFixed(2).replace(/\.00$/, '') 
                        : results.statistics.degrees_of_freedom}
                    </p>
                  )}
                  {results.statistics.hypothesized_mean !== undefined && (
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">
                      μ₀ = {results.statistics.hypothesized_mean}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Probability Value</p>
                  <p className="font-display text-lg font-bold text-slate-800 mt-1">
                    {formatPValue(results.statistics.p_value)}
                  </p>
                  <span className={`inline-block mt-1.5 rounded px-1.5 py-0.5 font-sans text-[9px] font-bold ${
                    results.statistics.significant ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {results.statistics.significant ? 'p < 0.05 (Significant)' : 'p ≥ 0.05 (Not Significant)'}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="font-sans text-[10px] font-bold text-slate-400 uppercase">Null Hypothesis (H₀)</p>
                  <p className={`font-sans text-xs font-semibold mt-2 leading-snug ${
                    results.statistics.significant ? 'text-rose-600' : 'text-slate-600'
                  }`}>
                    {results.statistics.significant 
                      ? 'Reject Null Hypothesis. Significant difference exists.' 
                      : 'Fail to Reject Null Hypothesis. No significant difference.'}
                  </p>
                </div>
              </div>

              {/* Group Means Table */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                <h5 className="font-display text-xs font-bold text-slate-700 mb-3">Sample Statistics</h5>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-sans text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2">Variable / Group</th>
                        <th className="py-2 text-right">Sample Size (n)</th>
                        <th className="py-2 text-right">Mean</th>
                        <th className="py-2 text-right">Std. Deviation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-50 text-slate-700">
                        <td className="py-2.5 font-semibold">{col1}</td>
                        <td className="py-2.5 text-right">{results.statistics.n || results.statistics.n_group1}</td>
                        <td className="py-2.5 text-right">
                          {(results.statistics.sample_mean !== undefined 
                            ? results.statistics.sample_mean 
                            : results.statistics.mean_group1).toFixed(4)}
                        </td>
                        <td className="py-2.5 text-right">
                          {(results.statistics.sample_std !== undefined
                            ? results.statistics.sample_std
                            : results.statistics.std_group1).toFixed(4)}
                        </td>
                      </tr>
                      {['independent_t', 'paired_t', 'z_test'].includes(testType) && col2 && (
                        <tr className="border-b border-slate-50 text-slate-700">
                          <td className="py-2.5 font-semibold">{col2}</td>
                          <td className="py-2.5 text-right">{results.statistics.n || results.statistics.n_group2}</td>
                          <td className="py-2.5 text-right">{(results.statistics.mean_group2).toFixed(4)}</td>
                          <td className="py-2.5 text-right">
                            {results.statistics.std_group2 !== undefined
                              ? results.statistics.std_group2.toFixed(4)
                              : '-'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Task 2: Paired t-Test section for paired differences */}
                {['paired_t', 'independent_t'].includes(testType) && results.statistics.mean_difference !== undefined && (
                  <div className="mt-4 pt-3 border-t border-dashed border-slate-100 grid grid-cols-3 gap-3 text-xs font-sans animate-fade-in">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Mean Difference</p>
                      <p className="font-semibold text-slate-700 mt-0.5">{results.statistics.mean_difference.toFixed(4)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {testType === 'paired_t' ? 'Standard Deviation of Diff' : 'Std. Error of Difference'}
                      </p>
                      <p className="font-semibold text-slate-700 mt-0.5">
                        {(testType === 'paired_t' ? results.statistics.std_difference : results.statistics.se_difference)?.toFixed(4) ?? 'n/a'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">95% CI [Lower, Upper]</p>
                      <p className="font-semibold text-slate-700 mt-0.5">
                        {`[${results.statistics.ci_difference[0]?.toFixed(4) ?? 'n/a'}, ${results.statistics.ci_difference[1]?.toFixed(4) ?? 'n/a'}]`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Task 3: One-Sample t-Test section for Cohen's d and 95% Confidence Interval */}
                {['one_sample_t', 'paired_t', 'independent_t'].includes(testType) && results.statistics.cohens_d !== undefined && results.statistics.cohens_d !== null && (
                  <div className="mt-4 pt-3 border-t border-dashed border-slate-100 grid grid-cols-2 gap-3 text-xs font-sans animate-fade-in">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {testType === 'paired_t' ? "Cohen's d_z (Effect Size)" : testType === 'independent_t' ? "Cohen's d, pooled SD (Effect Size)" : "Cohen's d (Effect Size)"}
                      </p>
                      <p className="font-semibold text-slate-700 mt-0.5">
                        {results.statistics.cohens_d.toFixed(4)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                          ({Math.abs(results.statistics.cohens_d) < 0.2 ? 'Negligible' :
                            Math.abs(results.statistics.cohens_d) < 0.5 ? 'Small' :
                            Math.abs(results.statistics.cohens_d) < 0.8 ? 'Medium' : 'Large'})
                        </span>
                      </p>
                    </div>
                    {results.statistics.ci && (
                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100/50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">95% Confidence Interval of Mean</p>
                        <p className="font-semibold text-slate-700 mt-0.5">
                          {`[${results.statistics.ci[0].toFixed(4)}, ${results.statistics.ci[1].toFixed(4)}]`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Task 4: Confidence Interval of the Difference for Z-Test */}
              {testType === 'z_test' && results.statistics.ci_difference && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 shadow-xs animate-fade-in">
                  <div className="flex items-center space-x-1.5 mb-1.5">
                    <Info className="h-4 w-4 text-brand-indigo" />
                    <h5 className="font-display text-xs font-bold text-slate-700">95% Confidence Interval of the Difference</h5>
                  </div>
                  <p className="font-sans text-xs text-slate-600">
                    The 95% confidence interval for the difference between the population means is{' '}
                    <span className="font-bold text-indigo-700">
                      [{results.statistics.ci_difference[0].toFixed(4)}, {results.statistics.ci_difference[1].toFixed(4)}]
                    </span>.
                  </p>
                </div>
              )}

              {/* Assumption Checks Section */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                <div className="flex items-center space-x-1.5 mb-2">
                  <Info className="h-4 w-4 text-brand-indigo" />
                  <h5 className="font-display text-xs font-bold text-slate-700">Assumption Checks</h5>
                </div>
                <p className="font-sans text-[10px] text-slate-400 mb-3 leading-normal">
                  Parametric tests make specific assumptions about the distribution and variance of the data.
                </p>
                <div className="space-y-3">
                  {/* Shapiro-Wilk Normality Checks */}
                  <div className="space-y-2">
                    <p className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider">Normality Check (Shapiro-Wilk)</p>
                    {testType === 'paired_t' ? (
                      results.shapiro_results?.differences ? (
                        <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                          <span className="font-semibold text-slate-700 font-sans">Normality of Paired Differences</span>
                          {results.shapiro_results.differences.error ? (
                            <span className="text-slate-400 italic">{results.shapiro_results.differences.error}</span>
                          ) : (
                            <div className="flex space-x-4 items-center">
                              <span className="text-slate-500">W = {results.shapiro_results.differences.stat.toFixed(4)}</span>
                              <span className="text-slate-500">{formatPValue(results.shapiro_results.differences.p_value)}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                results.shapiro_results.differences.normal ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {results.shapiro_results.differences.normal ? 'Normally Distributed' : 'Non-Normal Distribution'}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic font-sans">No normality data available for differences.</p>
                      )
                    ) : (
                      Object.entries(results.shapiro_results || {}).map(([column, meta]) => (
                        <div key={column} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                          <span className="font-semibold text-slate-700 font-sans">{column}</span>
                          {meta.error ? (
                            <span className="text-slate-400 italic">{meta.error}</span>
                          ) : (
                            <div className="flex space-x-4 items-center">
                              <span className="text-slate-500">W = {meta.stat.toFixed(4)}</span>
                              <span className="text-slate-500">{formatPValue(meta.p_value)}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                meta.normal ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {meta.normal ? 'Normally Distributed' : 'Non-Normal Distribution'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Levene's Equality of Variances Check (Only for independent t-test) */}
                  {testType === 'independent_t' && results.levene_results && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Equality of Variances Check (Levene's Test)</p>
                      <div className="flex justify-between items-center text-xs pb-1">
                        <span className="font-semibold text-slate-700">Levene's Test ({col1} vs {col2})</span>
                        <div className="flex space-x-4 items-center">
                          <span className="text-slate-500">Statistic = {results.levene_results.stat.toFixed(4)}</span>
                          <span className="text-slate-500">{formatPValue(results.levene_results.p_value)}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            results.levene_results.equal_var ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {results.levene_results.equal_var ? 'Equal Variances' : 'Unequal Variances'}
                          </span>
                        </div>
                      </div>
                      <p className="font-sans text-[9px] text-slate-400 mt-1 italic leading-normal">
                        * Levene's test p &ge; 0.05 indicates equal variances (Student's t-test used). p &lt; 0.05 indicates unequal variances (Welch's t-test used automatically).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Result chart with alternative styles */}
              {results.plot && (
                <ResultChartPanel
                  key={results.plot.slice(-32)}
                  token={token}
                  file={file}
                  classicPlot={results.plot}
                  options={parametricChartOptions(testType, col1, col2)}
                  fields={{
                    layout: 'wide',
                    cols_str: (col2 && ['independent_t', 'z_test'].includes(testType) ? [col1, col2] : [col1]).join(','),
                    p_value: results.statistics?.p_value,
                    test_label: results.test_used,
                    equal_var: results.levene_results?.equal_var,
                    ...(testType === 'one_sample_t' || (testType === 'z_test' && !col2)
                      ? { reference: parseFloat(mu) || 0, reference_label: `Hypothesized mean = ${parseFloat(mu) || 0}` }
                      : {})
                  }}
                  filenameBase={`parametric_${testType}_${col1}`}
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

export default ParametricModal;
