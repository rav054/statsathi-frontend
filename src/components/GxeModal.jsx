import { apiFetch } from '../utils/apiFetch';
import { useState } from 'react';
import { X, AlertCircle, RefreshCw, Download, Sprout } from 'lucide-react';
import { useAuth, API_URL } from '../context/AuthContext';
import DatasetViewerModal from './DatasetViewerModal';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import SaveToProjectButton from './SaveToProjectButton';
import ReopenedBanner from './ReopenedBanner';
import ResultChartPanel from './ResultChartPanel';
import { downloadDocxReport, formatP } from '../utils/reportApi';
import { saveBlob } from '../utils/workspaceApi';

const GENOTYPE_HINT = /genotype|variety|cultivar|entry|hybrid|accession|clone|line|gen\b/i;
const ENVIRONMENT_HINT = /environment|env\b|location|site|year|season|trial|place|loc\b/i;
const REP_HINT = /rep|block/i;

const fmt = (value, digits = 3) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (value !== 0 && (Math.abs(value) >= 100000 || Math.abs(value) < 0.001)) return value.toExponential(2);
  return value.toFixed(digits);
};

const CHART_OPTIONS = [
  { value: 'classic', label: 'GGE biplot', hint: 'Genotypes (points) and environments (vectors) on the first two principal components of the environment-centred data.' },
  { value: 'which_won_where', label: 'Which won where', hint: 'Polygon view: the vertex genotype of each sector is best in the environments inside that sector (mega-environments).' },
  { value: 'mean_stability', label: 'Mean vs. stability', hint: 'Genotypes further along the arrow have a better mean; shorter dotted projections mean more stable performance.' },
  { value: 'ranking', label: 'Ideal genotype', hint: 'Genotypes ranked by distance from the ideal genotype: best mean performance and fully stable.' },
  { value: 'discriminativeness', label: 'Discriminating & representative', hint: 'Long environment vectors separate genotypes well; a small angle with the average-environment axis means a representative environment.' },
  { value: 'ammi1', label: 'AMMI1', hint: 'Mean performance against the IPCA1 score for genotypes and environments.' },
  { value: 'ammi2', label: 'AMMI2', hint: 'IPCA1 against IPCA2: genotypes near the origin interact little with environments.' },
  { value: 'adaptability', label: 'Adaptability lines', hint: "Each genotype's regression on the environment mean (Finlay-Wilkinson / Eberhart-Russell slope b)." },
  { value: 'heatmap', label: 'Means heatmap', hint: 'Genotype × environment means sorted by genotype and environment mean.' }
];

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm outline-hidden focus:border-brand-indigo';

const Table = ({ columns, rows, note, minWidth = 640 }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
    <table className="w-full border-collapse whitespace-nowrap font-sans text-xs" style={{ minWidth }}>
      <thead>
        <tr className="border-b border-slate-100 text-slate-400">
          {columns.map((c, i) => <th key={c} className={`py-2 pr-3 ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className={`border-b border-slate-50 text-slate-700 hover:bg-slate-50/50 ${row.muted ? 'text-slate-500' : ''}`}>
            {row.cells.map((cell, i) => (
              <td key={i} className={`py-1.5 pr-3 ${i === 0 ? `text-left font-semibold ${row.indent ? 'pl-4 font-normal' : ''}` : 'text-right font-mono'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {note && <p className="mt-3 font-sans text-[13px] leading-relaxed text-slate-400">{note}</p>}
  </div>
);

// Genotype × environment analysis of multi-environment trials: AMMI, GGE biplot and stability statistics
const GxeModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token, user } = useAuth();
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ columns: cols, numericColumns: numeric }) => {
      const genotype = cols.find(c => GENOTYPE_HINT.test(c)) || cols.find(c => !numeric.includes(c)) || '';
      const environment = cols.find(c => c !== genotype && ENVIRONMENT_HINT.test(c))
        || cols.find(c => c !== genotype && !numeric.includes(c)) || '';
      const rep = cols.find(c => ![genotype, environment].includes(c) && REP_HINT.test(c)) || '';
      setGenotypeCol(genotype);
      setEnvironmentCol(environment);
      setRepCol(rep);
      setResponseCol(numeric.find(c => ![genotype, environment, rep].includes(c)) || '');
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { file, columns, numericColumns } = dataset;
  const [genotypeCol, setGenotypeCol] = useState(saved.genotype || '');
  const [environmentCol, setEnvironmentCol] = useState(saved.environment || '');
  const [repCol, setRepCol] = useState(saved.replicate || '');
  const [responseCol, setResponseCol] = useState(saved.response || '');
  const [higherIsBetter, setHigherIsBetter] = useState(saved.higher_is_better === false ? 'false' : 'true');
  const [scaling, setScaling] = useState(saved.scaling || 'none');
  const [svp, setSvp] = useState(saved.svp || 'auto');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('anova');

  if (!isOpen) return null;

  const runAnalysis = async () => {
    if (!genotypeCol || !environmentCol || !responseCol) {
      setError('Choose the genotype, environment and response columns.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('genotype_col', genotypeCol);
    formData.append('environment_col', environmentCol);
    formData.append('response_col', responseCol);
    if (repCol) formData.append('rep_col', repCol);
    formData.append('higher_is_better', higherIsBetter);
    formData.append('scaling', scaling);
    formData.append('svp', svp);
    try {
      const res = await apiFetch(`${API_URL}/analyze/gxe`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'G×E analysis failed.');
      setResults(data);
      setActiveTab('anova');
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
      setGenotypeCol(saved.genotype || '');
      setEnvironmentCol(saved.environment || '');
      setRepCol(saved.replicate || '');
      setResponseCol(saved.response || '');
      setHigherIsBetter(saved.higher_is_better === false ? 'false' : 'true');
      setScaling(saved.scaling || 'none');
      setSvp(saved.svp || 'auto');
    }
  };

  const handleClose = () => {
    dataset.clear();
    setResults(null);
    setError(null);
    onClose();
  };

  // ----- result tables -----
  const hasS2di = results?.genotype_stats.some(r => r.s2di !== null);
  const stabilityColumns = results ? [
    ['Genotype', r => r.genotype],
    ['Mean', r => fmt(r.mean)],
    ['Rank', r => r.rank],
    ['b', r => fmt(r.bi)],
    ['p (b = 1)', r => formatP(r.bi_p)],
    ...(hasS2di ? [['S²d', r => fmt(r.s2di)], ['p (S²d = 0)', r => formatP(r.s2di_p)]] : [['Deviation MS', r => fmt(r.deviation_ms)]]),
    ['R²', r => fmt(r.r2)],
    ['Wi² (%)', r => fmt(r.ecovalence_percent, 1)],
    ['σ²ᵢ Shukla', r => fmt(r.shukla)],
    ['CV (%)', r => fmt(r.cv, 1)],
    ['ASV', r => fmt(r.asv)],
    ['ASV rank', r => r.asv_rank ?? '–'],
    ['YSI rank', r => r.ysi_rank ?? '–'],
    ['GGE ideal rank', r => r.ideal_rank]
  ] : [];
  const stabilityRows = results ? [...results.genotype_stats].sort((a, b) => a.rank - b.rank) : [];

  const ipcaPercent = Object.fromEntries((results?.ammi.ipca || []).map(t => [t.component, t.percent]));
  const anovaColumns = ['Source', 'df', 'SS', 'MS', 'F', 'p', '% of G × E'];
  const anovaCells = (row) => [row.source, row.df, fmt(row.ss, 2), row.ms === null ? '–' : fmt(row.ms, 2), row.f === null ? '–' : fmt(row.f, 2), row.p === null ? '–' : formatP(row.p), ipcaPercent[row.source] !== undefined ? fmt(ipcaPercent[row.source], 1) : ''];

  const environmentColumns = ['Environment', 'Mean', 'Index', 'IPCA1', 'IPCA2', 'Vector length', 'cos (AEC)', 'Angle (°)', 'Best genotype'];
  const environmentCells = (r) => [r.environment, fmt(r.mean), fmt(r.index), fmt(r.ipca1), fmt(r.ipca2), fmt(r.vector_length), fmt(r.representativeness), fmt(r.angle, 1), r.winner];

  const downloadCsv = () => {
    const lines = [stabilityColumns.map(([label]) => label), ...stabilityRows.map(r => stabilityColumns.map(([, get]) => get(r)))];
    const csv = lines.map(cells => cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `StatSathi_GxE_Stability_${file.name.replace(/\.[^/.]+$/, '')}.csv`);
  };

  const buildDocxReport = () => {
    const charts = results.charts || {};
    const figures = CHART_OPTIONS.map(o => [o.value === 'classic' ? 'gge_biplot' : o.value, o.label]).filter(([key]) => charts[key]);
    const sections = [{
      heading: 'Data',
      paragraphs: [
        `${results.genotypes.length} genotypes (${genotypeCol}) in ${results.environments.length} environments (${environmentCol}); response: ${results.response}.`,
        results.replicates ? `${results.replicates} replicates per genotype in each environment${results.anova.blocks ? ` (blocks: ${repCol})` : ''}.` : 'Analysis of genotype × environment means (no error term).',
        results.higher_is_better ? 'Higher values are better.' : 'Lower values are better.',
        `GGE biplot: environment-centred data, ${results.gge.scaling === 'sd' ? 'scaled by environment standard deviation' : 'not scaled'}; PC1 and PC2 explain ${(results.gge.percent[0] + results.gge.percent[1]).toFixed(1)}% of G + GE.`,
        ...results.notes
      ]
    }, {
      heading: '1. AMMI Analysis of Variance',
      tables: [{ columns: anovaColumns, rows: results.anova.rows.map(anovaCells), note: 'IPCA degrees of freedom after Gollob (1968).' }]
    }, {
      heading: '2. Stability Statistics',
      tables: [{
        columns: stabilityColumns.map(([label]) => label),
        rows: stabilityRows.map(r => stabilityColumns.map(([, get]) => get(r))),
        note: 'b and S²d: Eberhart & Russell (1966); Wi²: Wricke (1962) ecovalence; σ²ᵢ: Shukla (1972); ASV: AMMI stability value (Purchase et al. 2000); YSI: rank of ASV + rank of mean; GGE ideal rank: distance from the ideal genotype (Yan & Tinker 2006).'
      }]
    }, {
      heading: '3. Environments and Mega-environments',
      paragraphs: results.gge.mega_environments.map(m => `${m.winner} is best in ${m.environments.join(', ')}.`),
      tables: [{ columns: environmentColumns, rows: results.environment_stats.map(environmentCells), note: 'Index: environment mean minus the grand mean. Vector length: discriminating ability; cos (AEC): representativeness.' }]
    }];
    if (results.genotypes.length <= 40 && results.environments.length <= 12) {
      sections.push({
        heading: '4. Genotype × Environment Means',
        tables: [{
          columns: ['Genotype', ...results.environments, 'Mean'],
          rows: results.genotypes.map((g, i) => [g, ...results.means.matrix[i].map(v => fmt(v, 2)), fmt(results.means.genotype_means[i], 2)])
        }]
      });
    }
    sections.push({
      heading: `${sections.length}. Charts`,
      images: figures.map(([key, label], i) => ({ data: `data:image/png;base64,${charts[key]}`, caption: `Figure ${i + 1}. ${label}` }))
    });
    return {
      title: 'Genotype × Environment (AMMI & GGE) Analysis Report',
      test_applied: 'AMMI, GGE biplot, Eberhart-Russell, Wricke, Shukla, ASV',
      dataset_name: file?.name,
      filename: `StatSathi_GxE_Report_${file.name.replace(/\.[^/.]+$/, '')}`,
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
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Sprout className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Genotype × Environment: AMMI & GGE Biplot</h3>
              <p className="font-sans text-xs text-slate-400">Stability and adaptation of genotypes across locations, years or seasons.</p>
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
                title="Select or drop a multi-environment trial dataset"
                hint="Long format: one row per plot with genotype, environment, (replicate) and the measured trait. Every genotype must be grown in every environment."
                onViewData={() => setViewerOpen(true)}
              />

              {file && (<>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Genotype column</label>
                  <select value={genotypeCol} onChange={(e) => setGenotypeCol(e.target.value)} className={selectClass}>
                    <option value="">Choose…</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[13px] text-slate-400">Varieties, lines, hybrids or treatments compared.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Environment column</label>
                  <select value={environmentCol} onChange={(e) => setEnvironmentCol(e.target.value)} className={selectClass}>
                    <option value="">Choose…</option>
                    {columns.filter(c => c !== genotypeCol).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[13px] text-slate-400">Location, year, season or a location-year combination (at least 3).</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Response (trait)</label>
                  <select value={responseCol} onChange={(e) => setResponseCol(e.target.value)} className={selectClass}>
                    <option value="">Choose…</option>
                    {numericColumns.filter(c => ![genotypeCol, environmentCol, repCol].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Replicate / block column (optional)</label>
                  <select value={repCol} onChange={(e) => setRepCol(e.target.value)} className={selectClass}>
                    <option value="">None</option>
                    {columns.filter(c => ![genotypeCol, environmentCol, responseCol].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[13px] text-slate-400">Adds the replicates-within-environments term; environments are then tested against it.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Better performance</label>
                  <select value={higherIsBetter} onChange={(e) => setHigherIsBetter(e.target.value)} className={selectClass}>
                    <option value="true">Higher values (yield, protein…)</option>
                    <option value="false">Lower values (disease score, days to maturity…)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">GGE scaling</label>
                    <select value={scaling} onChange={(e) => setScaling(e.target.value)} className={selectClass}>
                      <option value="none">None</option>
                      <option value="sd">Environment SD</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-sans text-xs font-bold text-slate-500">Singular value partitioning</label>
                    <select value={svp} onChange={(e) => setSvp(e.target.value)} className={selectClass}>
                      <option value="auto">Recommended per view</option>
                      <option value="symmetric">Symmetric</option>
                      <option value="genotype">Genotype-focused</option>
                      <option value="environment">Environment-focused</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || !genotypeCol || !environmentCol || !responseCol}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
              >
                {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Running AMMI and GGE analysis...</span></> : <span>Run G×E Analysis</span>}
              </button>
              </>)}
            </div>
          )}

          {results && (
            <div className="space-y-5 animate-fade-in">
              {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex space-x-5 overflow-x-auto border-b border-slate-200">
                  {[['anova', 'AMMI ANOVA'], ['stability', 'Stability'], ['environments', 'Environments'], ['means', 'Means'], ['charts', 'Biplots & Charts']].map(([id, label]) => (
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
                  <button onClick={downloadCsv} className="flex items-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"><Download className="h-3.5 w-3.5" /><span>Stability CSV</span></button>
                  {user && (
                    <SaveToProjectButton
                      module="gxe"
                      report={() => buildDocxReport()}
                      source={dataset.source}
                      defaultTitle={`G×E analysis – ${results.response}`}
                      parameters={{ genotype: genotypeCol, environment: environmentCol, response: responseCol, replicate: repCol || null, higher_is_better: results.higher_is_better, scaling, svp, dataset: file?.name }}
                      result={{ ...results, charts: undefined }}
                    />
                  )}
                  <button onClick={() => setResults(null)} className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" /><span>New Analysis</span></button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 font-sans text-[14px]">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{results.genotypes.length} genotypes × {results.environments.length} environments</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{results.replicates ? `${results.replicates} replicates` : 'means only'}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Grand mean {fmt(results.means.grand_mean, 2)}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">GGE PC1 + PC2: {(results.gge.percent[0] + results.gge.percent[1]).toFixed(1)}%</span>
              </div>

              {results.notes.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 font-sans text-[14px] text-amber-700">{results.notes.join(' ')}</div>
              )}

              {activeTab === 'anova' && (
                <Table
                  columns={anovaColumns}
                  rows={results.anova.rows.map(row => ({ cells: anovaCells(row), indent: row.component, muted: row.component }))}
                  note={`The genotype × environment interaction is split into interaction principal component axes (IPCA) with Gollob's degrees of freedom.${results.anova.blocks ? ' Environments are tested against replicates within environments; other terms against the pooled error.' : ''}`}
                />
              )}

              {activeTab === 'stability' && (
                <Table
                  minWidth={1100}
                  columns={stabilityColumns.map(([label]) => label)}
                  rows={stabilityRows.map(r => ({ cells: stabilityColumns.map(([, get]) => get(r)) }))}
                  note={`Rank 1 = best mean (${results.higher_is_better ? 'highest' : 'lowest'}). b (Eberhart & Russell): 1 = average response, > 1 responsive to good environments, < 1 suited to poor ones. ${hasS2di ? 'S²d near 0: predictable performance. ' : ''}Smaller Wi² (Wricke), σ²ᵢ (Shukla), CV and ASV mean more stable. YSI combines ASV and mean ranks. GGE ideal rank: closeness to the ideal genotype on the biplot.`}
                />
              )}

              {activeTab === 'environments' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {results.gge.mega_environments.map(m => (
                      <div key={m.winner} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
                        <p className="font-sans text-[13px] font-bold uppercase text-emerald-600">Mega-environment</p>
                        <p className="font-sans text-sm font-bold text-slate-800">{m.winner} wins</p>
                        <p className="font-sans text-xs text-slate-500">{m.environments.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                  <Table
                    minWidth={760}
                    columns={environmentColumns}
                    rows={results.environment_stats.map(r => ({ cells: environmentCells(r) }))}
                    note="Index: environment mean minus the grand mean. Vector length on the GGE biplot measures how well an environment discriminates genotypes; cos (AEC) close to 1 (small angle) means it represents the average environment. Best genotype: highest value predicted by the GGE biplot."
                  />
                  {results.environments.length <= 15 && (
                    <Table
                      columns={['r', ...results.environments]}
                      rows={results.environments.map((e, i) => ({ cells: [e, ...results.environment_correlations[i].map(v => fmt(v, 2))] }))}
                      note="Correlations between environments across genotypes. Low or negative correlations indicate crossover interaction and possibly different mega-environments."
                    />
                  )}
                </div>
              )}

              {activeTab === 'means' && (
                <Table
                  minWidth={Math.max(640, 90 * (results.environments.length + 3))}
                  columns={['Genotype', ...results.environments, 'Mean', 'Rank']}
                  rows={[
                    ...results.genotypes.map((g, i) => ({ cells: [g, ...results.means.matrix[i].map(v => fmt(v, 2)), fmt(results.means.genotype_means[i], 2), results.genotype_stats[i].rank] })),
                    { cells: ['Environment mean', ...results.means.environment_means.map(v => fmt(v, 2)), fmt(results.means.grand_mean, 2), ''], muted: true }
                  ]}
                />
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
                  classicPlot={(results.charts || {}).gge_biplot}
                  initialImages={Object.fromEntries(Object.entries((results.charts || {})).filter(([key, image]) => key !== 'gge_biplot' && image))}
                  options={chartOptions}
                  filenameBase={`statsathi_gxe_${results.response}`}
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

export default GxeModal;
