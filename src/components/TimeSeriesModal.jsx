import { apiFetch } from '../utils/apiFetch';
import { useState } from 'react';
import { X, AlertCircle, RefreshCw, Download, LineChart } from 'lucide-react';
import { useAuth, API_URL } from '../context/AuthContext';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import ResultChartPanel from './ResultChartPanel';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import { saveBlob } from '../utils/workspaceApi';

const TIME_HINT = /date|month|year|time|period|week|day|quarter/i;

const fmt = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (value !== 0 && (Math.abs(value) >= 100000 || Math.abs(value) < 0.001)) return value.toExponential(2);
  return value.toFixed(digits);
};

const formatTime = (value, kind) => {
  if (value === null || value === undefined) return '–';
  if (kind === 'date') return String(value).slice(0, 10);
  if (kind === 'order') return `#${value}`;
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
};

const CHART_OPTIONS = [
  { value: 'classic', label: 'Forecast', hint: 'Observations, the fitted values and the forecast with its 80% and 95% prediction intervals.' },
  { value: 'decomposition', label: 'Decomposition', hint: 'The series split into trend, seasonal pattern and remainder.' },
  { value: 'seasonal', label: 'Seasonal pattern', hint: 'Each season drawn on top of the others, with their average.' },
  { value: 'correlogram', label: 'Autocorrelation', hint: 'ACF and PACF of the series: how strongly each lag relates to the present.' },
  { value: 'models', label: 'Model accuracy', hint: 'Forecast error of every model on the test period.' },
  { value: 'residuals', label: 'Residual checks', hint: 'Residuals over time, their autocorrelation and their distribution.' }
];

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm outline-hidden focus:border-brand-indigo';

const Card = ({ title, value, hint, tone = 'slate' }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
    <p className="font-sans text-[13px] font-bold uppercase text-slate-400">{title}</p>
    <p className={`mt-0.5 font-mono text-sm font-bold ${tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-800'}`}>{value}</p>
    {hint && <p className="mt-1 font-sans text-[13px] leading-snug text-slate-400">{hint}</p>}
  </div>
);

// Time-series analysis: diagnostics, decomposition, model comparison and forecasts
const TimeSeriesModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token, user } = useAuth();
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ columns: cols, numericColumns: numeric }) => {
      const time = cols.find(c => TIME_HINT.test(c)) || '';
      setTimeCol(time);
      setValueCol(numeric.find(c => c !== time) || '');
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { file, columns, numericColumns } = dataset;
  const [valueCol, setValueCol] = useState(saved.value || '');
  const [timeCol, setTimeCol] = useState(saved.time || '');
  const [seasonLength, setSeasonLength] = useState(saved.season_length ? String(saved.season_length) : '');
  const [horizon, setHorizon] = useState(String(saved.horizon || '12'));
  const [holdout, setHoldout] = useState(saved.holdout ? String(saved.holdout) : '');
  const [transform, setTransform] = useState(saved.transform || 'none');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('forecast');

  if (!isOpen) return null;

  const runAnalysis = async () => {
    if (!valueCol) {
      setError('Choose the column to forecast.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('value_col', valueCol);
    if (timeCol) formData.append('time_col', timeCol);
    if (seasonLength) formData.append('season_length', seasonLength);
    formData.append('horizon', horizon || '12');
    if (holdout) formData.append('holdout', holdout);
    formData.append('transform', transform);
    try {
      const res = await apiFetch(`${API_URL}/analyze/timeseries`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Time-series analysis failed.');
      setResults(data);
      setActiveTab('forecast');
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
      setValueCol(saved.value || '');
      setTimeCol(saved.time || '');
      setSeasonLength(saved.season_length ? String(saved.season_length) : '');
      setHorizon(String(saved.horizon || '12'));
      setHoldout(saved.holdout ? String(saved.holdout) : '');
      setTransform(saved.transform || 'none');
    }
  };

  const handleClose = () => {
    dataset.clear();
    setResults(null);
    setError(null);
    onClose();
  };

  const kind = results?.series.kind;
  const best = results?.models.find(m => m.selected);

  const forecastRows = results ? results.forecast.times.map((time, i) => [
    formatTime(time, kind),
    fmt(results.forecast.mean[i]),
    `${fmt(results.forecast.lower80[i])} – ${fmt(results.forecast.upper80[i])}`,
    `${fmt(results.forecast.lower95[i])} – ${fmt(results.forecast.upper95[i])}`
  ]) : [];

  const modelRows = results ? [...results.models].sort((a, b) => {
    if (a.holdout && b.holdout) return a.holdout.rmse - b.holdout.rmse;
    return (a.aicc ?? Infinity) - (b.aicc ?? Infinity);
  }) : [];

  const downloadCsv = () => {
    const header = ['Time', 'Forecast', 'Lower 80%', 'Upper 80%', 'Lower 95%', 'Upper 95%'];
    const lines = results.forecast.times.map((time, i) => [
      formatTime(time, kind), results.forecast.mean[i], results.forecast.lower80[i], results.forecast.upper80[i],
      results.forecast.lower95[i], results.forecast.upper95[i]
    ]);
    const csv = [header, ...lines].map(cells => cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `StatSathi_Forecast_${file.name.replace(/\.[^/.]+$/, '')}.csv`);
  };

  const buildDocxReport = () => {
    const diagnostics = results.diagnostics;
    const charts = results.charts || {};
    const figures = CHART_OPTIONS.map(o => [o.value === 'classic' ? 'forecast' : o.value, o.label]).filter(([key]) => charts[key]);
    const sections = [{
      heading: 'Data',
      paragraphs: [
        `${results.series.n} observations of ${results.value_column}${results.series.kind === 'date' ? ` at ${results.series.frequency} intervals` : ''}.`,
        results.series.season_length > 1 ? `Season length: ${results.series.season_length} periods.` : 'No seasonal pattern was modelled.',
        results.holdout ? `The last ${results.holdout} observations were held back to compare the models; the chosen model was then refitted on the whole series.` : 'The series was too short to hold observations back, so models were compared by corrected AIC.',
        ...results.notes
      ]
    }, {
      heading: '1. Diagnostics',
      tables: [{
        columns: ['Check', 'Result', 'Meaning'],
        rows: [
          ['ADF test (H0: not stationary)', `statistic ${fmt(diagnostics.adf.statistic)}, ${formatP(diagnostics.adf.p_value)}`, diagnostics.adf.stationary ? 'Stationary' : 'Not stationary'],
          ['KPSS test (H0: stationary)', `statistic ${fmt(diagnostics.kpss.statistic)}, ${formatP(diagnostics.kpss.p_value)}`, diagnostics.kpss.stationary ? 'Stationary' : 'Not stationary'],
          ['Ljung-Box autocorrelation', `${formatP(diagnostics.correlogram.ljung_box.p_value)} up to lag ${diagnostics.correlogram.ljung_box.lag}`, diagnostics.correlogram.ljung_box.p_value < 0.05 ? 'The series is autocorrelated (forecastable structure)' : 'No autocorrelation detected'],
          ['Differences suggested', `${diagnostics.suggested_differences.regular} regular, ${diagnostics.suggested_differences.seasonal} seasonal`, 'Used by the automatic SARIMA search'],
          ['Strength of trend', fmt(results.decomposition.strengths.trend), '0 = none, 1 = very strong'],
          ['Strength of seasonality', fmt(results.decomposition.strengths.seasonal), '0 = none, 1 = very strong']
        ]
      }]
    }, {
      heading: '2. Models Compared',
      tables: [{
        columns: ['Model', 'Specification', 'AICc', 'RMSE', 'MAE', 'MAPE (%)', 'MASE'],
        rows: modelRows.map(m => [m.name + (m.selected ? ' (chosen)' : ''), m.detail || '', fmt(m.aicc, 1),
          fmt(m.holdout?.rmse), fmt(m.holdout?.mae), fmt(m.holdout?.mape, 1), fmt(m.holdout?.mase)]),
        note: 'Accuracy is measured on the test period. MASE below 1 beats a seasonal naive forecast.'
      }]
    }, {
      heading: '3. Forecast',
      paragraphs: [`Model used: ${results.forecast.model}.`],
      tables: [{
        columns: ['Time', 'Forecast', '80% interval', '95% interval'],
        rows: forecastRows,
        note: 'Prediction intervals assume the pattern in the data continues and that the residuals behave like noise.'
      }]
    }, {
      heading: '4. Charts',
      images: figures.map(([key, label], i) => ({ data: `data:image/png;base64,${charts[key]}`, caption: `Figure ${i + 1}. ${label}` }))
    }];
    return {
      title: 'Time Series and Forecast Report',
      test_applied: `Decomposition, stationarity tests and forecasting (${results.forecast.model})`,
      dataset_name: file?.name,
      filename: `StatSathi_TimeSeries_Report_${file.name.replace(/\.[^/.]+$/, '')}`,
      sections
    };
  };

  const hasCharts = Object.keys(results?.charts || {}).length > 0;
  const chartOptions = results ? CHART_OPTIONS.filter(o => o.value === 'classic' || (results.charts || {})[o.value]) : [];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-sky-50 p-2 text-sky-600"><LineChart className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Time Series & Forecasting</h3>
              <p className="font-sans text-xs text-slate-400">Decomposition, stationarity checks, model comparison and forecasts with prediction intervals.</p>
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
                hint="One row per period at regular intervals (daily, weekly, monthly, quarterly or yearly), with the measured value."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (<>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Value to forecast</label>
                  <select value={valueCol} onChange={(e) => setValueCol(e.target.value)} className={selectClass}>
                    <option value="">Choose…</option>
                    {numericColumns.filter(c => c !== timeCol).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Time column</label>
                  <select value={timeCol} onChange={(e) => setTimeCol(e.target.value)} className={selectClass}>
                    <option value="">Row order (no time column)</option>
                    {columns.filter(c => c !== valueCol).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[13px] text-slate-400">Dates give the seasonal period automatically; numbers (for example years) are treated as equally spaced.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Season length</label>
                    <select value={seasonLength} onChange={(e) => setSeasonLength(e.target.value)} className={selectClass}>
                      <option value="">Automatic</option>
                      <option value="1">None</option>
                      <option value="4">4 (quarterly)</option>
                      <option value="7">7 (daily, weekly cycle)</option>
                      <option value="12">12 (monthly)</option>
                      <option value="52">52 (weekly)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Transformation</label>
                    <select value={transform} onChange={(e) => setTransform(e.target.value)} className={selectClass}>
                      <option value="none">None</option>
                      <option value="log">Logarithm</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Periods to forecast</label>
                    <input type="number" min="1" max="120" value={horizon} onChange={(e) => setHorizon(e.target.value)} className={selectClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Test period</label>
                    <input type="number" min="0" max="120" value={holdout} onChange={(e) => setHoldout(e.target.value)} placeholder="Automatic" className={selectClass} />
                  </div>
                </div>
              </div>
              <p className="font-sans text-[13px] text-slate-400">
                The test period is held back from every model, so the models are compared on data they have not seen. The winner is then refitted on the whole series to produce the forecast.
              </p>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || !valueCol}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
              >
                {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Fitting and comparing models...</span></> : <span>Analyse & Forecast</span>}
              </button>
              </>)}
            </div>
          )}

          {results && (
            <div className="space-y-5 animate-fade-in">
              {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex space-x-5 overflow-x-auto border-b border-slate-200">
                  {[['forecast', 'Forecast'], ['models', 'Models'], ['diagnostics', 'Diagnostics'], ['charts', 'Charts']].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`whitespace-nowrap border-b-2 pb-2.5 font-display text-xs font-bold transition-all cursor-pointer ${activeTab === id ? 'border-brand-indigo text-brand-indigo' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => downloadDocxReport(token, buildDocxReport()).catch(err => setError(err.message))} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer">Word Report</button>
                  <button onClick={downloadCsv} className="flex items-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"><Download className="h-3.5 w-3.5" /><span>Forecast CSV</span></button>
                  {user && (
                    <SaveToProjectButton
                      module="timeseries"
                      report={() => buildDocxReport()}
                      source={dataset.source}
                      defaultTitle={`Forecast – ${results.value_column}`}
                      parameters={{ value: valueCol, time: timeCol || null, season_length: results.series.season_length, horizon: results.forecast.horizon, holdout: results.holdout, transform, dataset: file?.name }}
                      result={{ ...results, charts: undefined }}
                    />
                  )}
                  <button onClick={() => setResults(null)} className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" /><span>New Analysis</span></button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 font-sans text-[14px]">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{results.series.n} {results.series.frequency} observations</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Season: {results.series.season_length > 1 ? `${results.series.season_length} periods` : 'none'}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Chosen model: {results.forecast.model}</span>
                {best?.holdout && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Test RMSE {fmt(best.holdout.rmse)}{best.holdout.mase != null ? `, MASE ${fmt(best.holdout.mase)}` : ''}</span>}
              </div>

              {results.notes.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 font-sans text-[14px] text-amber-700">{results.notes.join(' ')}</div>
              )}

              {activeTab === 'forecast' && (
                <div className="space-y-4">
                  {hasCharts && (
                  <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <img src={`data:image/png;base64,${(results.charts || {}).forecast}`} alt="Forecast" className="max-h-[380px] w-auto rounded-xl border border-slate-200/50 bg-white p-2" />
                  </div>
                  )}
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <table className="w-full min-w-[560px] border-collapse whitespace-nowrap font-sans text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-slate-400">
                          <th className="py-2 pr-3">Time</th>
                          <th className="py-2 pr-3 text-right">Forecast</th>
                          <th className="py-2 pr-3 text-right">80% interval</th>
                          <th className="py-2 text-right">95% interval</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/50">
                            {row.map((cell, c) => (
                              <td key={c} className={`py-1.5 pr-3 ${c === 0 ? 'font-semibold' : 'text-right font-mono'}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 font-sans text-[13px] leading-relaxed text-slate-400">
                      Forecast from {results.forecast.model}. The 80% interval is the range the value should fall in 4 times out of 5 if the pattern continues; the 95% interval is wider and more cautious.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'models' && (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <table className="w-full min-w-[720px] border-collapse whitespace-nowrap font-sans text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-400">
                        <th className="py-2 pr-3">Model</th>
                        <th className="py-2 pr-3">Specification</th>
                        <th className="py-2 pr-3 text-right">AICc</th>
                        <th className="py-2 pr-3 text-right">RMSE</th>
                        <th className="py-2 pr-3 text-right">MAE</th>
                        <th className="py-2 pr-3 text-right">MAPE (%)</th>
                        <th className="py-2 text-right">MASE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelRows.map(m => (
                        <tr key={m.key} className={`border-b border-slate-50 ${m.selected ? 'bg-indigo-50/40 font-bold text-brand-indigo' : 'text-slate-700'}`}>
                          <td className="py-2 pr-3 font-semibold">{m.name}{m.selected ? ' ★' : ''}</td>
                          <td className="py-2 pr-3 text-slate-500">{m.detail}</td>
                          <td className="py-2 pr-3 text-right font-mono">{fmt(m.aicc, 1)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{fmt(m.holdout?.rmse)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{fmt(m.holdout?.mae)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{fmt(m.holdout?.mape, 1)}</td>
                          <td className="py-2 text-right font-mono">{fmt(m.holdout?.mase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 font-sans text-[13px] leading-relaxed text-slate-400">
                    {results.holdout
                      ? `Every model was fitted without the last ${results.holdout} observations and then asked to forecast them; the star marks the most accurate. MASE below 1 beats a seasonal naive forecast.`
                      : 'The series was too short to hold data back, so models were compared by corrected AIC (lower is better).'}
                  </p>
                </div>
              )}

              {activeTab === 'diagnostics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Card title="ADF test" value={`${fmt(results.diagnostics.adf.statistic)} (${formatP(results.diagnostics.adf.p_value)})`}
                      hint={results.diagnostics.adf.stationary ? 'Stationary: no unit root' : 'Not stationary: the level drifts'} />
                    <Card title="KPSS test" value={`${fmt(results.diagnostics.kpss.statistic)} (${formatP(results.diagnostics.kpss.p_value)})`}
                      hint={results.diagnostics.kpss.stationary ? 'Stationary around a constant level' : 'Not stationary: a trend or drift is present'} />
                    <Card title="Ljung-Box" value={formatP(results.diagnostics.correlogram.ljung_box.p_value)}
                      hint={`Up to lag ${results.diagnostics.correlogram.ljung_box.lag}. ${results.diagnostics.correlogram.ljung_box.p_value < 0.05 ? 'The series has structure worth modelling.' : 'The series looks like noise.'}`} />
                    <Card title="Differences suggested" value={`${results.diagnostics.suggested_differences.regular} regular, ${results.diagnostics.suggested_differences.seasonal} seasonal`}
                      hint="Used by the automatic SARIMA search to make the series stationary" />
                    <Card title="Strength of trend" value={fmt(results.decomposition.strengths.trend)} hint="0 = none, 1 = very strong"
                      tone={results.decomposition.strengths.trend > 0.6 ? 'good' : 'slate'} />
                    <Card title="Strength of seasonality" value={fmt(results.decomposition.strengths.seasonal)} hint="0 = none, 1 = very strong"
                      tone={results.decomposition.strengths.seasonal > 0.6 ? 'good' : 'slate'} />
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <h5 className="mb-1 font-display text-xs font-bold text-slate-700">Residuals of the chosen model</h5>
                    <p className="font-sans text-xs text-slate-600">
                      Ljung-Box {formatP(results.residuals.ljung_box.p_value)} up to lag {results.residuals.ljung_box.lag}
                      {results.residuals.shapiro?.p_value != null ? `; Shapiro-Wilk normality ${formatP(results.residuals.shapiro.p_value)}` : ''}.
                      {results.residuals.ljung_box.p_value < 0.05
                        ? ' Some pattern is left in the residuals, so the prediction intervals may be too narrow.'
                        : ' No autocorrelation is left in the residuals, which is what a good model should leave behind.'}
                    </p>
                  </div>
                  {hasCharts && (
                  <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <img src={`data:image/png;base64,${(results.charts || {}).correlogram}`} alt="Autocorrelation" className="max-h-[320px] w-auto rounded-xl border border-slate-200/50 bg-white p-2" />
                  </div>
                  )}
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

              {activeTab === 'charts' && hasCharts && (
                <ResultChartPanel
                  token={token}
                  file={file}
                  classicPlot={(results.charts || {}).forecast}
                  initialImages={Object.fromEntries(Object.entries((results.charts || {})).filter(([key, image]) => key !== 'forecast' && image))}
                  options={chartOptions}
                  filenameBase={`statsathi_forecast_${results.value_column}`}
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

export default TimeSeriesModal;
