import { apiFetch } from '../utils/apiFetch';
import { useMemo, useState } from 'react';
import { AlertCircle, Download, FileText, Info, Play, RefreshCw } from 'lucide-react';
import { API_URL } from '../context/AuthContext';
import { saveBlob } from '../utils/workspaceApi';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import { emptyPooledAnalyses, imputationReport, pooledAnalysesProblem, pooledAnalysesRequest } from '../utils/pooledReport';
import { PooledAnalysesForm, PooledAnalysesResults } from './PooledAnalyses';
import SaveToProjectButton from './SaveToProjectButton';

const fmt = (value, digits = 3) => (value === null || value === undefined || Number.isNaN(value)
  ? '–' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }));

// Variances can be tiny (a slope of 0.02 has a between-imputation variance near 1e-8): keep three significant figures
const fmtSmall = (value) => (value === null || value === undefined || Number.isNaN(value) ? '–'
  : value !== 0 && Math.abs(value) < 0.001 ? Number(value).toExponential(2) : fmt(value, 4));

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-slate-700 focus:border-brand-indigo focus:outline-none';

const Chips = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.length === 0 && <span className="font-sans text-[14px] text-slate-400">None available.</span>}
    {options.map(name => {
      const on = value.includes(name);
      return (
        <button key={name} type="button" onClick={() => onChange(on ? value.filter(v => v !== name) : [...value, name])}
          className={`rounded-full border px-2.5 py-0.5 font-sans text-[14px] font-semibold cursor-pointer ${on ? 'border-brand-indigo bg-indigo-50 text-brand-indigo' : 'border-slate-200 bg-white text-slate-500'}`}>
          {name}
        </button>
      );
    })}
  </div>
);

const Label = ({ children }) => <p className="mb-1 font-sans text-[13px] font-bold uppercase tracking-wide text-slate-400">{children}</p>;

const PooledTable = ({ title, rows, firstHeader }) => (
  <div className="overflow-auto rounded-2xl border border-slate-100">
    <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 font-display text-xs font-bold text-slate-800">{title}</p>
    <table className="min-w-full whitespace-nowrap text-left font-sans text-[14px] text-slate-700">
      <thead>
        <tr className="text-slate-500">
          {[firstHeader, 'Estimate', 'SE', '95% CI', 'df', 'p', 'FMI', 'Between-imp. var.'].map(h => (
            <th key={h} className="whitespace-nowrap px-3 py-2 font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, pooled }) => (
          <tr key={label} className="border-t border-slate-50">
            <td className="px-3 py-1.5 font-semibold text-slate-800">{label}</td>
            <td className="px-3 py-1.5 font-mono">{fmtSmall(pooled.estimate)}</td>
            <td className="px-3 py-1.5 font-mono">{fmtSmall(pooled.se)}</td>
            <td className="whitespace-nowrap px-3 py-1.5 font-mono">[{fmt(pooled.ci_low, 3)}, {fmt(pooled.ci_high, 3)}]</td>
            <td className="px-3 py-1.5 font-mono">{fmt(pooled.df, 1)}</td>
            <td className="px-3 py-1.5 font-mono">{formatP(pooled.p_value)}</td>
            <td className={`px-3 py-1.5 font-mono ${pooled.fmi > 0.5 ? 'font-bold text-amber-600' : ''}`}>{fmt(pooled.fmi, 3)}</td>
            <td className="px-3 py-1.5 font-mono">{fmtSmall(pooled.between)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Multiple imputation: fill the gaps many times, repeat the analysis on each completed table, and pool the answers
 * with Rubin's rules so the uncertainty from the missing values stays in the standard errors.
 */
const MultipleImputationPanel = ({ token, file, profile }) => {
  const numeric = useMemo(() => (profile?.columns || []).filter(c => c.kind === 'numeric'), [profile]);
  const withGaps = numeric.filter(c => c.missing > 0 && c.missing < profile.n_rows).map(c => c.name);
  const categoryColumns = (profile?.columns || []).filter(c => c.kind !== 'numeric' && c.missing === 0 && c.unique <= 50 && c.unique > 1);
  const completeCategories = categoryColumns.map(c => c.name);

  const [targets, setTargets] = useState(withGaps);
  const [predictors, setPredictors] = useState([]);
  const [m, setM] = useState(20);
  const [maxIter, setMaxIter] = useState(10);
  const [seed, setSeed] = useState(2026);
  const [bounds, setBounds] = useState('none');
  const [dependent, setDependent] = useState('');
  const [regressors, setRegressors] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [pooledSpec, setPooledSpec] = useState(emptyPooledAnalyses);
  // The analyses sent with the last run, kept for saving the result
  const [ranAnalyses, setRanAnalyses] = useState({});

  const predictorOptions = [...numeric.map(c => c.name), ...completeCategories].filter(name => !targets.includes(name));
  const regressionOptions = [...numeric.map(c => c.name), ...completeCategories].filter(name => name !== dependent);

  const run = async () => {
    setRunning(true);
    setError(null);
    const body = new FormData();
    body.append('file', file);
    body.append('columns_str', targets.join(','));
    if (predictors.length) body.append('predictors_str', predictors.join(','));
    body.append('m', String(m));
    body.append('max_iter', String(maxIter));
    body.append('seed', String(seed));
    body.append('bounds', bounds);
    if (dependent && regressors.length) {
      body.append('regression_dependent', dependent);
      body.append('regression_predictors_str', regressors.join(','));
    }
    const analyses = pooledAnalysesRequest(pooledSpec);
    if (Object.keys(analyses).length) body.append('analyses', JSON.stringify(analyses));
    try {
      const res = await apiFetch(`${API_URL}/analyze/prep/multiple-imputation`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Multiple imputation failed.');
      setOutcome(data);
      setRanAnalyses(analyses);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!profile) return null;

  if (withGaps.length === 0) {
    return (
      <div className="flex items-center space-x-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-sans text-xs text-emerald-700">
        <Info className="h-4 w-4" /><span>No numeric column has missing values, so there is nothing to impute.</span>
      </div>
    );
  }

  const baseName = (file?.name || 'dataset').replace(/\.[^/.]+$/, '');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 font-sans text-[14px] text-indigo-900">
        Filling each gap once and then analysing the table treats guesses as measurements, so standard errors come out
        too small. Here the gaps are filled <b>m</b> times with random draws, the summary is repeated on every completed
        table, and the answers are combined with <b>Rubin&apos;s rules</b> - the spread between imputations stays in the
        standard errors. The fraction of missing information (FMI) says how much the gaps cost.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Impute these columns</Label>
            <Chips options={withGaps} value={targets} onChange={setTargets} />
          </div>
          <div>
            <Label>Predictors (default: other numeric columns, row IDs left out)</Label>
            <Chips options={predictorOptions} value={predictors} onChange={setPredictors} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Imputations (m)</Label><input type="number" min={2} max={50} className={inputClass} value={m} onChange={(e) => setM(Number(e.target.value))} /></div>
            <div><Label>Iterations</Label><input type="number" min={1} max={50} className={inputClass} value={maxIter} onChange={(e) => setMaxIter(Number(e.target.value))} /></div>
            <div><Label>Seed</Label><input type="number" className={inputClass} value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></div>
          </div>
          <div>
            <Label>Keep imputed values</Label>
            <select className={inputClass} value={bounds} onChange={(e) => setBounds(e.target.value)}>
              <option value="none">Unrestricted</option>
              <option value="non_negative">Zero or above</option>
              <option value="observed_range">Within the observed range</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-100 p-3">
          <p className="font-display text-xs font-bold text-slate-800">Pooled regression (optional)</p>
          <div>
            <Label>Response</Label>
            <select className={inputClass} value={dependent} onChange={(e) => { setDependent(e.target.value); setRegressors(r => r.filter(x => x !== e.target.value)); }}>
              <option value="">— no regression —</option>
              {numeric.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          {dependent && (
            <div>
              <Label>Predictors</Label>
              <Chips options={regressionOptions.filter(n => numeric.some(c => c.name === n))} value={regressors} onChange={setRegressors} />
            </div>
          )}
          <p className="font-sans text-[13px] text-slate-400">
            Fitted by OLS on every completed table; coefficients pooled with Rubin&apos;s rules, R² on Fisher&apos;s z scale.
          </p>
        </div>
      </div>

      <PooledAnalysesForm
        numeric={numeric.map(c => c.name)}
        categories={categoryColumns}
        value={pooledSpec}
        onChange={setPooledSpec}
      />

      {error && (
        <div className="flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="font-sans text-xs">{error}</span>
        </div>
      )}

      <button type="button" onClick={run} disabled={running || targets.length === 0 || m < 2 || (dependent && regressors.length === 0) || Boolean(pooledAnalysesProblem(pooledSpec))}
        title={pooledAnalysesProblem(pooledSpec)}
        className="flex items-center space-x-2 rounded-xl bg-brand-indigo px-4 py-2 font-sans text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
        {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        <span>{running ? `Imputing ${m} times…` : 'Run multiple imputation'}</span>
      </button>

      {outcome && (
        <div className="space-y-4">
          <div className="overflow-auto rounded-2xl border border-slate-100">
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 font-display text-xs font-bold text-slate-800">Observed and imputed values</p>
            <table className="min-w-full whitespace-nowrap text-left font-sans text-[14px] text-slate-700">
              <thead>
                <tr className="text-slate-500">
                  {['Column', 'Missing', 'Observed mean (SD)', 'Observed range', 'Imputed mean (SD)', 'Imputed range'].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outcome.columns.map(c => (
                  <tr key={c.column} className="border-t border-slate-50">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{c.column}</td>
                    <td className="px-3 py-1.5">{c.missing} ({c.missing_pct}%)</td>
                    <td className="px-3 py-1.5 font-mono">{fmt(c.observed_mean)} ({fmt(c.observed_sd)})</td>
                    <td className="px-3 py-1.5 font-mono">{fmt(c.observed_min)} – {fmt(c.observed_max)}</td>
                    <td className="px-3 py-1.5 font-mono">{fmt(c.imputed_mean)} ({fmt(c.imputed_sd)})</td>
                    <td className="px-3 py-1.5 font-mono">{fmt(c.imputed_min)} – {fmt(c.imputed_max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-1.5 font-sans text-[13px] text-slate-400">
              Imputed values far outside the observed range suggest the imputation model does not fit; consider other predictors or bounds.
            </p>
          </div>

          <PooledTable title={`Pooled means (m = ${outcome.settings.m})`} firstHeader="Column"
            rows={outcome.columns.map(c => ({ label: c.column, pooled: c.pooled_mean }))} />

          <PooledAnalysesResults outcome={outcome} />

          {outcome.regression && (
            <div className="space-y-1">
              <PooledTable title={`Pooled regression of ${outcome.regression.dependent} (n = ${outcome.regression.n})`} firstHeader="Term"
                rows={outcome.regression.coefficients.map(c => ({ label: c.term, pooled: c }))} />
              <p className="font-sans text-[14px] text-slate-500">Pooled R² = {fmt(outcome.regression.r_squared, 4)}</p>
            </div>
          )}

          <ul className="list-disc space-y-1 rounded-2xl border border-slate-100 py-2 pl-6 pr-3 font-sans text-[14px] text-slate-600">
            {outcome.notes.map(note => <li key={note}>{note}</li>)}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button"
              onClick={() => saveBlob(new Blob([outcome.long_csv], { type: 'text/csv' }), `${baseName}_imputed_m${outcome.settings.m}.csv`)}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 px-4 py-2 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Download className="h-4 w-4 text-brand-orange" /><span>Download all imputations (long format, .imp column)</span>
            </button>
            <button type="button"
              onClick={() => downloadDocxReport(token, { ...imputationReport(outcome, file?.name), filename: `StatSathi_Imputation_${baseName}` }).catch(err => setError(err.message))}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 px-4 py-2 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              <FileText className="h-4 w-4 text-brand-indigo" /><span>Word report</span>
            </button>
            <SaveToProjectButton
              module="imputation"
              report={() => imputationReport(outcome, file?.name)}
              defaultTitle={`Multiple imputation (m = ${outcome.settings.m}) – ${file?.name || 'dataset'}`}
              parameters={{ ...outcome.settings, analyses: ranAnalyses, regression_dependent: outcome.regression?.dependent || null, dataset: file?.name }}
              result={Object.fromEntries(Object.entries(outcome).filter(([key]) => key !== 'long_csv'))}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MultipleImputationPanel;
