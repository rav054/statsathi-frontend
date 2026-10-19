import { apiFetch } from '../utils/apiFetch';
import { useState } from 'react';
import { X, AlertCircle, RefreshCw, Download, Activity } from 'lucide-react';
import { useAuth, API_URL } from '../context/AuthContext';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import ResultChartPanel from './ResultChartPanel';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import { saveBlob } from '../utils/workspaceApi';

const TIME_HINT = /year|date|time|period|season_year/i;

const fmt = (value, digits = 3) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (value !== 0 && (Math.abs(value) >= 10000 || Math.abs(value) < 0.001)) return value.toExponential(2);
  return value.toFixed(digits);
};

const formatTime = (value, kind) => {
  if (value === null || value === undefined) return '–';
  if (kind === 'date') {
    const year = Math.floor(value);
    const month = Math.min(12, Math.floor((value - year) * 12) + 1);
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  if (kind === 'order') return `observation ${value}`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const trendBadge = (trend) => {
  if (trend === 'increasing') return 'bg-rose-50 text-rose-600';
  if (trend === 'decreasing') return 'bg-sky-50 text-sky-600';
  return 'bg-slate-100 text-slate-500';
};

const StatCard = ({ title, rows, note }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
    <h5 className="mb-2 border-b border-slate-100 pb-2 font-display text-xs font-bold text-slate-700">{title}</h5>
    <table className="w-full font-sans text-xs">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-slate-50 last:border-0">
            <td className="py-1.5 pr-3 text-slate-400">{label}</td>
            <td className="py-1.5 text-right font-mono font-semibold text-slate-700">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {note && <p className="mt-2 font-sans text-[10px] leading-relaxed text-slate-400">{note}</p>}
  </div>
);

// Trend, change-point and homogeneity analysis of time series
const TrendModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token, user } = useAuth();
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ columns: cols }) => {
      setTimeCol(cols.find(c => TIME_HINT.test(c)) || '');
      setSeasonCol('');
      setValueCols([]);
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { file, columns, numericColumns } = dataset;
  const [valueCols, setValueCols] = useState(saved.variables || []);
  const [timeCol, setTimeCol] = useState(saved.time || '');
  const [seasonCol, setSeasonCol] = useState(saved.season || '');
  const [alpha, setAlpha] = useState(String(saved.alpha || '0.05'));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [activeVar, setActiveVar] = useState('');
  const [chartImage, setChartImage] = useState(null);

  if (!isOpen) return null;

  const toggleValue = (col) => {
    setValueCols(prev => (prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]));
  };

  const runAnalysis = async () => {
    if (valueCols.length === 0) {
      setError('Choose at least one variable to test.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setChartImage(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('value_cols_str', valueCols.join(','));
    if (timeCol) formData.append('time_col', timeCol);
    if (seasonCol) formData.append('season_col', seasonCol);
    formData.append('alpha', alpha);
    try {
      const res = await apiFetch(`${API_URL}/analyze/trend`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Trend analysis failed.');
      setResults(data);
      setActiveVar(data.variables[0]);
      setActiveTab('summary');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch the dataset this analysis was run on, then restore its settings so it can be run again
  const restoreSaved = async () => {
    setReopened(false);
    setResults(null);
    const loaded = await dataset.selectProjectDataset(initialAnalysis.dataset, initialAnalysis.projectName);
    if (loaded) {
      setValueCols(saved.variables || []);
      setTimeCol(saved.time || '');
      setSeasonCol(saved.season || '');
      setAlpha(String(saved.alpha || '0.05'));
    }
  };

  const handleClose = () => {
    dataset.clear();
    setResults(null);
    setError(null);
    onClose();
  };

  const kind = results?.time.kind;
  const unit = results?.time.unit;

  const summaryRows = results ? results.variables.map(name => {
    const r = results.results[name];
    const change = r.pettitt.p_value < results.alpha ? formatTime(r.time_values[r.pettitt.change_index + 1], kind) : '–';
    return {
      name,
      n: r.n,
      mkZ: fmt(r.mann_kendall.z, 2),
      mkP: formatP(r.mann_kendall.p_value),
      trend: r.mann_kendall.trend,
      modifiedP: formatP(r.modified_mann_kendall.p_value),
      seasonalP: r.seasonal_mann_kendall ? formatP(r.seasonal_mann_kendall.p_value) : null,
      sen: `${fmt(r.sen.slope)} [${fmt(r.sen.ci_low)}, ${fmt(r.sen.ci_high)}]`,
      percent: r.sen.percent_of_mean == null ? '–' : `${r.sen.percent_of_mean >= 0 ? '+' : ''}${r.sen.percent_of_mean.toFixed(1)}%`,
      change,
      pettittP: formatP(r.pettitt.p_value),
      homogeneity: r.homogeneity.class
    };
  }) : [];

  const downloadCsv = () => {
    const header = ['Variable', 'n', 'Mann-Kendall Z', 'MK p', 'Trend', 'Modified MK p', ...(results.season_column ? ['Seasonal MK p'] : []),
      `Sen slope ${unit} [95% CI]`, 'Change over period (% of mean)', 'Pettitt change', 'Pettitt p', 'Homogeneity'];
    const lines = summaryRows.map(row => [row.name, row.n, row.mkZ, row.mkP, row.trend, row.modifiedP, ...(results.season_column ? [row.seasonalP] : []),
      row.sen, row.percent, row.change, row.pettittP, row.homogeneity]);
    const csv = [header, ...lines].map(cells => cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `StatSathi_Trend_Summary_${file.name.replace(/\.[^/.]+$/, '')}.csv`);
  };

  const buildDocxReport = () => {
    const sections = [{
      heading: 'Data',
      paragraphs: [
        `Variables tested: ${results.variables.join(', ')}.`,
        results.time.column ? `Time: ${results.time.column} (${results.time.kind === 'date' ? 'dates, as decimal years' : 'numeric'}).` : 'Time: row order of the dataset.',
        ...(results.season_column ? [`Seasons: ${results.season_column} (seasonal Mann-Kendall test).`] : []),
        `Significance level: α = ${results.alpha}.`,
        ...results.notes
      ]
    }, {
      heading: '1. Summary',
      tables: [{
        columns: ['Variable', 'n', 'MK Z', 'MK p', 'Trend', 'Modified MK p', `Sen's slope ${unit} [95% CI]`, 'Change (% of mean)', 'Pettitt change', 'Homogeneity'],
        rows: summaryRows.map(r => [r.name, r.n, r.mkZ, r.mkP, r.trend, r.modifiedP, r.sen, r.percent, r.change, r.homogeneity]),
        note: 'Mann-Kendall (MK) tests for a monotonic trend; the modified test (Hamed & Rao 1998) corrects for autocorrelation. Homogeneity classes after Wijngaard et al. (2003).'
      }],
      images: results.summary_chart ? [{ data: `data:image/png;base64,${results.summary_chart}`, caption: 'Change over the period as a percentage of the mean' }] : []
    }];
    results.variables.forEach((name, index) => {
      const r = results.results[name];
      const charts = (results.charts || {})[name];
      sections.push({
        heading: `${index + 2}. ${name}`,
        tables: [{
          columns: ['Test', 'Statistic', 'p-value', 'Result'],
          rows: [
            ['Mann-Kendall', `S = ${r.mann_kendall.s}, Z = ${fmt(r.mann_kendall.z, 3)}, τ = ${fmt(r.mann_kendall.tau, 3)}`, formatP(r.mann_kendall.p_value), r.mann_kendall.trend],
            ['Modified Mann-Kendall', `Z = ${fmt(r.modified_mann_kendall.z, 3)}, n/n* = ${fmt(r.modified_mann_kendall.variance_correction, 3)}`, formatP(r.modified_mann_kendall.p_value), r.modified_mann_kendall.trend],
            ...(r.seasonal_mann_kendall ? [['Seasonal Mann-Kendall', `Z = ${fmt(r.seasonal_mann_kendall.z, 3)}, slope = ${fmt(r.seasonal_mann_kendall.slope)}`, formatP(r.seasonal_mann_kendall.p_value), r.seasonal_mann_kendall.trend]] : []),
            ["Sen's slope", `${fmt(r.sen.slope)} ${unit} [${fmt(r.sen.ci_low)}, ${fmt(r.sen.ci_high)}]`, '–', `change over period ${fmt(r.sen.change_over_period)}`],
            ['Linear trend (OLS)', `${fmt(r.linear.slope)} ${unit}, R² = ${fmt(r.linear.r2, 3)}`, formatP(r.linear.p_value), ''],
            ['Pettitt', `K = ${fmt(r.pettitt.k, 0)}, change after ${formatTime(r.time_values[r.pettitt.change_index], kind)}`, formatP(r.pettitt.p_value), `mean ${fmt(r.pettitt.mean_before)} → ${fmt(r.pettitt.mean_after)}`],
            ['SNHT', `T0 = ${fmt(r.snht.t0, 3)}`, formatP(r.snht.p_value), ''],
            ['Buishand range', `R/√n = ${fmt(r.buishand.r, 3)}`, formatP(r.buishand.p_value_r), ''],
            ['Von Neumann ratio', fmt(r.von_neumann.ratio, 3), formatP(r.von_neumann.p_value), `homogeneity: ${r.homogeneity.class}`],
            ['Innovative trend analysis', `D = ${fmt(r.ita.indicator, 2)}, slope = ${fmt(r.ita.slope)}`, '–', r.ita.ranges.map(p => `${p.range} ${p.change_percent == null ? 'n/a' : `${p.change_percent.toFixed(1)}%`}`).join(', ')]
          ]
        }],
        images: index < 10 ? [
          { data: `data:image/png;base64,${name === activeVar && chartImage ? chartImage : charts.series}`, caption: `${name}: time series with Sen's slope` },
          { data: `data:image/png;base64,${charts.ita}`, caption: `${name}: innovative trend analysis` },
          { data: `data:image/png;base64,${charts.homogeneity}`, caption: `${name}: homogeneity tests` }
        ] : []
      });
    });
    return {
      title: 'Trend and Change-Point Analysis Report',
      test_applied: 'Mann-Kendall, Sen\'s slope, Pettitt, SNHT, Buishand, von Neumann, Innovative Trend Analysis',
      dataset_name: file?.name,
      filename: `StatSathi_Trend_Report_${file.name.replace(/\.[^/.]+$/, '')}`,
      sections
    };
  };

  const hasCharts = Object.keys(results?.charts || {}).length > 0;
  const r = results && activeVar ? results.results[activeVar] : null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-brand-indigo"><Activity className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Trend & Change-Point Analysis</h3>
              <p className="font-sans text-xs text-slate-400">Mann-Kendall, Sen&apos;s slope, Pettitt, SNHT, Buishand and Innovative Trend Analysis for time series.</p>
            </div>
          </div>
          <button data-dialog-close aria-label="Close" onClick={handleClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {(error || dataset.error) && (
            <div className="mb-5 flex items-start space-x-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium">{error || dataset.error}</span>
            </div>
          )}

          {!results && (
            <div className="space-y-5">
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a time-series dataset"
                hint="One row per time step: a year or date column and one or more measured variables (CSV or Excel)."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (<>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Time column</label>
                  <select value={timeCol} onChange={(e) => { setTimeCol(e.target.value); setValueCols(prev => prev.filter(c => c !== e.target.value)); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm outline-hidden focus:border-brand-indigo">
                    <option value="">Row order (no time column)</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[10px] text-slate-400">Years, dates or any numeric time. Sen&apos;s slope is expressed per unit of this column.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Season column (optional)</label>
                  <select value={seasonCol} onChange={(e) => setSeasonCol(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm outline-hidden focus:border-brand-indigo">
                    <option value="">None</option>
                    {columns.filter(c => c !== timeCol).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[10px] text-slate-400">For monthly or seasonal data (for example Month): adds the seasonal Mann-Kendall test.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Significance level</label>
                  <select value={alpha} onChange={(e) => setAlpha(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm outline-hidden focus:border-brand-indigo">
                    <option value="0.01">α = 0.01</option>
                    <option value="0.05">α = 0.05</option>
                    <option value="0.1">α = 0.10</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-sans text-xs font-bold text-slate-500">Variables to test ({valueCols.length} selected, up to 20)</label>
                <div className="flex flex-wrap gap-1.5">
                  {numericColumns.filter(c => c !== timeCol && c !== seasonCol).map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleValue(col)}
                      className={`rounded-full border px-3 py-1 font-sans text-xs font-semibold transition-colors cursor-pointer ${
                        valueCols.includes(col) ? 'border-brand-indigo bg-indigo-50 text-brand-indigo' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || valueCols.length === 0}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
              >
                {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Running trend tests...</span></> : <span>Run Trend Analysis</span>}
              </button>
              </>)}
            </div>
          )}

          {results && (
            <div className="space-y-5 animate-fade-in">
              {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex border-b border-slate-200 space-x-6">
                  {[['summary', 'Summary'], ['details', 'Test Details'], ['charts', 'Charts']].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`border-b-2 pb-2.5 font-display text-xs font-bold transition-all cursor-pointer ${activeTab === id ? 'border-brand-indigo text-brand-indigo' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => downloadDocxReport(token, buildDocxReport()).catch(err => setError(err.message))} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer">Word Report</button>
                  <button onClick={downloadCsv} className="flex items-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"><Download className="h-3.5 w-3.5" /><span>Summary CSV</span></button>
                  {user && (
                    <SaveToProjectButton
                      module="trend"
                      report={() => buildDocxReport()}
                      source={dataset.source}
                      defaultTitle={`Trend analysis – ${results.variables.join(', ')}`}
                      parameters={{ variables: results.variables, time: timeCol || null, season: seasonCol || null, alpha: results.alpha, dataset: file?.name }}
                      result={{ ...results, charts: undefined, summary_chart: undefined }}
                    />
                  )}
                  <button onClick={() => setResults(null)} className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" /><span>New Analysis</span></button>
                </div>
              </div>

              {results.notes.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 font-sans text-[11px] text-amber-700">{results.notes.join(' ')}</div>
              )}

              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <table className="w-full min-w-[760px] border-collapse whitespace-nowrap font-sans text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-slate-400">
                          <th className="py-2 pr-3">Variable</th>
                          <th className="py-2 pr-3 text-right">n</th>
                          <th className="py-2 pr-3 text-right">MK Z</th>
                          <th className="py-2 pr-3 text-right">MK p</th>
                          <th className="py-2 pr-3">Trend</th>
                          <th className="py-2 pr-3 text-right">Modified MK p</th>
                          {results.season_column && <th className="py-2 pr-3 text-right">Seasonal MK p</th>}
                          <th className="py-2 pr-3 text-right">Sen&apos;s slope {unit} [95% CI]</th>
                          <th className="py-2 pr-3 text-right">Change (% of mean)</th>
                          <th className="py-2 pr-3 text-right">Change point</th>
                          <th className="py-2">Homogeneity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryRows.map(row => (
                          <tr key={row.name} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/50">
                            <td className="py-2 pr-3 font-semibold">
                              <button type="button" onClick={() => { setActiveVar(row.name); setActiveTab('details'); }} className="text-brand-indigo hover:underline cursor-pointer">{row.name}</button>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{row.n}</td>
                            <td className="py-2 pr-3 text-right font-mono">{row.mkZ}</td>
                            <td className="py-2 pr-3 text-right font-mono">{row.mkP}</td>
                            <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${trendBadge(row.trend)}`}>{row.trend}</span></td>
                            <td className="py-2 pr-3 text-right font-mono">{row.modifiedP}</td>
                            {results.season_column && <td className="py-2 pr-3 text-right font-mono">{row.seasonalP}</td>}
                            <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">{row.sen}</td>
                            <td className="py-2 pr-3 text-right font-mono">{row.percent}</td>
                            <td className="py-2 pr-3 text-right font-mono">{row.change}</td>
                            <td className="py-2 capitalize">{row.homogeneity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 font-sans text-[10px] leading-relaxed text-slate-400">
                      MK: Mann-Kendall test for a monotonic trend (α = {results.alpha}); the modified test corrects for autocorrelation and is the one to report when the series is autocorrelated.
                      Change point: first time step after a significant Pettitt break. Homogeneity: useful / doubtful / suspect after Wijngaard et al. (2003).
                    </p>
                  </div>
                  {results.summary_chart && (
                    <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <img src={`data:image/png;base64,${results.summary_chart}`} alt="Trend magnitude across variables" className="max-h-[420px] w-auto rounded-xl border border-slate-200/50 bg-white p-2" />
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'details' || activeTab === 'charts') && results.variables.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 font-sans text-[10px] font-bold uppercase text-slate-400">Variable:</span>
                  {results.variables.map(name => (
                    <button key={name} type="button" onClick={() => { setActiveVar(name); setChartImage(null); }} className={`rounded-full border px-3 py-1 font-sans text-[11px] font-semibold cursor-pointer ${activeVar === name ? 'border-brand-indigo bg-brand-indigo text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-indigo'}`}>
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'details' && r && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <StatCard
                    title="Mann-Kendall test"
                    rows={[['S', r.mann_kendall.s], ['Var(S)', fmt(r.mann_kendall.var_s, 1)], ['Z', fmt(r.mann_kendall.z)], ["Kendall's τ", fmt(r.mann_kendall.tau)], ['p-value', formatP(r.mann_kendall.p_value)], ['Result', r.mann_kendall.trend]]}
                  />
                  <StatCard
                    title="Modified Mann-Kendall (Hamed & Rao)"
                    rows={[['Variance correction n/n*', fmt(r.modified_mann_kendall.variance_correction)], ['Z', fmt(r.modified_mann_kendall.z)], ['p-value', formatP(r.modified_mann_kendall.p_value)], ['Result', r.modified_mann_kendall.trend], ['Lag-1 autocorrelation', `${fmt(r.autocorrelation.r1)} (${r.autocorrelation.significant ? 'significant' : 'not significant'})`]]}
                    note={r.autocorrelation.significant ? 'The series is autocorrelated, which makes the ordinary Mann-Kendall test too liberal: report the modified test.' : 'No significant lag-1 autocorrelation: the ordinary and modified tests should agree.'}
                  />
                  {r.seasonal_mann_kendall && (
                    <StatCard
                      title="Seasonal Mann-Kendall"
                      rows={[['Seasons', r.seasonal_mann_kendall.seasons], ['S', r.seasonal_mann_kendall.s], ['Z', fmt(r.seasonal_mann_kendall.z)], ['p-value', formatP(r.seasonal_mann_kendall.p_value)], [`Seasonal Sen's slope ${unit}`, fmt(r.seasonal_mann_kendall.slope)], ['Result', r.seasonal_mann_kendall.trend]]}
                      note="Trends are tested within each season and combined, so the seasonal cycle does not mask or mimic a trend."
                    />
                  )}
                  <StatCard
                    title="Magnitude of the trend"
                    rows={[[`Sen's slope ${unit}`, fmt(r.sen.slope)], ['95% CI', `[${fmt(r.sen.ci_low)}, ${fmt(r.sen.ci_high)}]`], ['Change over the period', fmt(r.sen.change_over_period)], ['Change (% of mean)', r.sen.percent_of_mean == null ? '–' : `${r.sen.percent_of_mean.toFixed(1)}%`], [`Linear (OLS) slope ${unit}`, `${fmt(r.linear.slope)} [${fmt(r.linear.ci_low)}, ${fmt(r.linear.ci_high)}]`], ['Linear R² / p', `${fmt(r.linear.r2)} / ${formatP(r.linear.p_value)}`]]}
                  />
                  <StatCard
                    title="Change point (Pettitt)"
                    rows={[['K', fmt(r.pettitt.k, 0)], ['Last value before the change', formatTime(r.time_values[r.pettitt.change_index], kind)], ['p-value', formatP(r.pettitt.p_value)], ['Mean before → after', `${fmt(r.pettitt.mean_before)} → ${fmt(r.pettitt.mean_after)}`]]}
                  />
                  <StatCard
                    title="Homogeneity tests"
                    rows={[['SNHT T0', `${fmt(r.snht.t0)} (${formatP(r.snht.p_value)})`], ['Buishand Q/√n', `${fmt(r.buishand.q)} (${formatP(r.buishand.p_value_q)})`], ['Buishand R/√n', `${fmt(r.buishand.r)} (${formatP(r.buishand.p_value_r)})`], ['Von Neumann ratio', `${fmt(r.von_neumann.ratio)} (${formatP(r.von_neumann.p_value)})`], ['Classification', `${r.homogeneity.class} (${r.homogeneity.tests_rejecting} of ${r.homogeneity.tests} reject)`]]}
                    note={`p-values from ${r.simulations} simulated homogeneous series. Classes use Pettitt, SNHT, Buishand R and von Neumann.`}
                  />
                  <StatCard
                    title="Innovative trend analysis (Şen)"
                    rows={[['Trend indicator D', fmt(r.ita.indicator, 2)], ['ITA slope per time step', fmt(r.ita.slope)], ...r.ita.ranges.map(p => [`${p.range[0].toUpperCase()}${p.range.slice(1)} values`, p.change_percent == null ? '–' : `${p.change_percent >= 0 ? '+' : ''}${p.change_percent.toFixed(1)}%`])]}
                    note="Compares the sorted first and second halves of the series, showing whether low, medium and high values changed differently."
                  />
                </div>
              )}

              {activeTab === 'charts' && !hasCharts && (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-xs">
                  <p className="font-sans text-xs text-slate-500">
                    Charts are not stored with a saved analysis, to keep it small.
                    {initialAnalysis?.dataset ? ' Use "Load the dataset & restore settings" above, then run it again to redraw them.' : ' Run the analysis again on its dataset to redraw them.'}
                  </p>
                </div>
              )}

              {activeTab === 'charts' && activeVar && hasCharts && (
                <ResultChartPanel
                  key={activeVar}
                  token={token}
                  file={file}
                  classicPlot={(results.charts || {})[activeVar].series}
                  initialImages={{ ita: (results.charts || {})[activeVar].ita, homogeneity: (results.charts || {})[activeVar].homogeneity }}
                  options={[
                    { value: 'classic', label: 'Time series', hint: "Observations, LOESS smooth, Sen's slope line and any significant change point." },
                    { value: 'ita', label: 'Innovative trend analysis', hint: 'Sorted first half against sorted second half; points above the 1:1 line increased.' },
                    { value: 'homogeneity', label: 'Homogeneity tests', hint: 'Pettitt, SNHT and Buishand statistics over time, with the most likely break marked.' }
                  ]}
                  filenameBase={`statsathi_trend_${activeVar}`}
                  onImageChange={setChartImage}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <DatasetViewerModal isOpen={viewerOpen} onClose={() => setViewerOpen(false)} file={file} onSave={(edited) => edited && dataset.selectFile(edited)} />
    </div>
  );
};

export default TrendModal;
