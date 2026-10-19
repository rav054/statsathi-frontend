import { apiFetch } from '../utils/apiFetch';
import { useState } from 'react';
import { X, AlertCircle, RefreshCw, Download, Boxes } from 'lucide-react';
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
const REP_HINT = /rep|block/i;

const fmt = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (value !== 0 && (Math.abs(value) >= 100000 || Math.abs(value) < 0.001)) return value.toExponential(2);
  return value.toFixed(digits);
};

const CHART_OPTIONS = [
  { value: 'classic', label: 'Tocher diagram', hint: 'Clusters as circles: intra-cluster distance inside, inter-cluster distances on the lines.' },
  { value: 'dendrogram', label: 'Dendrogram', hint: 'UPGMA tree of Mahalanobis distances, with labels coloured by Tocher cluster.' },
  { value: 'canonical', label: 'Canonical variates', hint: 'Genotypes in the space where Euclidean distance approximates D².' },
  { value: 'd2_heatmap', label: 'D² heatmap', hint: 'All pairwise D² values, ordered by cluster.' },
  { value: 'cluster_means', label: 'Cluster means', hint: 'Mean of each trait per cluster, coloured within traits.' },
  { value: 'contributions', label: 'Trait contributions', hint: 'How often each trait contributes most to the divergence between pairs.' }
];

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-sm outline-hidden focus:border-brand-indigo';

const Table = ({ columns, rows, note, minWidth = 620 }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
    <table className="w-full border-collapse whitespace-nowrap font-sans text-xs" style={{ minWidth }}>
      <thead>
        <tr className="border-b border-slate-100 text-slate-400">
          {columns.map((c, i) => <th key={i} className={`py-2 pr-3 ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/50">
            {row.map((cell, i) => (
              <td key={i} className={`py-1.5 pr-3 ${i === 0 ? 'text-left font-semibold' : 'text-right font-mono'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {note && <p className="mt-3 font-sans text-[13px] leading-relaxed text-slate-400">{note}</p>}
  </div>
);

// Genetic divergence: Mahalanobis D², Tocher clustering, character contributions and canonical variates
const DivergenceModal = ({ isOpen, onClose, initialAnalysis = null }) => {
  const saved = initialAnalysis?.parameters || {};
  const { token, user } = useAuth();
  const dataset = useDataset({
    active: isOpen && !initialAnalysis,
    onLoaded: ({ columns: cols, numericColumns: numeric }) => {
      const genotype = cols.find(c => GENOTYPE_HINT.test(c)) || cols.find(c => !numeric.includes(c)) || '';
      const rep = cols.find(c => c !== genotype && REP_HINT.test(c)) || '';
      setGenotypeCol(genotype);
      setRepCol(rep);
      setTraits(numeric.filter(c => ![genotype, rep].includes(c)).slice(0, 10));
      setResults(null);
    },
    onCleared: () => setResults(null),
  });
  const { file, columns, numericColumns } = dataset;
  const [genotypeCol, setGenotypeCol] = useState(saved.genotype || '');
  const [repCol, setRepCol] = useState(saved.replicate || '');
  const [traits, setTraits] = useState(saved.traits || []);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(initialAnalysis?.result || null);
  const [reopened, setReopened] = useState(Boolean(initialAnalysis?.result));
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  if (!isOpen) return null;

  const toggleTrait = (col) => {
    setTraits(prev => (prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]));
  };

  const runAnalysis = async () => {
    if (!genotypeCol || traits.length < 2) {
      setError('Choose the genotype column and at least 2 traits.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('genotype_col', genotypeCol);
    formData.append('traits_str', traits.join(','));
    if (repCol) formData.append('rep_col', repCol);
    try {
      const res = await apiFetch(`${API_URL}/analyze/divergence`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Divergence analysis failed.');
      setResults(data);
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
      setGenotypeCol(saved.genotype || '');
      setRepCol(saved.replicate || '');
      setTraits(saved.traits || []);
    }
  };

  const handleClose = () => {
    dataset.clear();
    setResults(null);
    setError(null);
    onClose();
  };

  const downloadCsv = () => {
    const header = ['Genotype', ...results.genotypes];
    const lines = results.genotypes.map((g, i) => [g, ...results.d2[i].map(v => v.toFixed(4))]);
    const csv = [header, ...lines].map(cells => cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `StatSathi_D2_Matrix_${file.name.replace(/\.[^/.]+$/, '')}.csv`);
  };

  const buildDocxReport = () => {
    const charts = results.charts || {};
    const figures = CHART_OPTIONS.map(o => [o.value === 'classic' ? 'tocher' : o.value, o.label]).filter(([key]) => charts[key]);
    const sections = [{
      heading: 'Data',
      paragraphs: [
        `${results.genotypes.length} genotypes (${genotypeCol}) described by ${results.traits.length} traits: ${results.traits.join(', ')}.`,
        results.replicated
          ? `Replicated trial${repCol ? ` with blocks (${repCol})` : ''}: distances use the error variance-covariance matrix (Rao's D²).`
          : 'One observation per genotype: distances use the covariance matrix among genotypes.',
        ...results.notes
      ]
    }];
    if (results.wilks) {
      sections.push({
        heading: '1. Test of Divergence (Wilks’ Lambda)',
        tables: [{
          columns: ['Statistic', 'Value'],
          rows: [
            ['Wilks’ Lambda', fmt(results.wilks.lambda, 4)],
            ['F (Rao approximation)', fmt(results.wilks.f, 3)],
            ['Numerator df', fmt(results.wilks.df1, 0)],
            ['Denominator df', fmt(results.wilks.df2, 1)],
            ['p-value', formatP(results.wilks.p_value)]
          ],
          note: 'Tests whether the genotype mean vectors differ; a significant result justifies the divergence analysis.'
        }]
      });
    }
    const start = sections.length;
    sections.push({
      heading: `${start}. Tocher Clusters`,
      paragraphs: [`Threshold θ = ${fmt(results.theta)} (the largest of the genotypes' smallest D² values).`],
      tables: [{
        columns: ['Cluster', 'Genotypes', 'Number', 'Intra-cluster D²', 'Intra-cluster D'],
        rows: results.clusters.map(c => [c.name, c.members.join(', '), c.size, fmt(c.intra_d2), fmt(c.intra_d)])
      }]
    }, {
      heading: `${start + 1}. Average Intra- and Inter-cluster Distances (D²)`,
      tables: [{
        columns: ['Cluster', ...results.cluster_distances.names],
        rows: results.cluster_distances.names.map((name, i) => [name, ...results.cluster_distances.d2[i].map(v => fmt(v))]),
        note: 'Diagonal: average distance within a cluster; off-diagonal: average distance between clusters.'
      }]
    }, {
      heading: `${start + 2}. Cluster Means`,
      tables: [{
        columns: ['Cluster', ...results.traits],
        rows: results.cluster_means.names.map((name, i) => [name, ...results.cluster_means.values[i].map(v => fmt(v))])
      }]
    }, {
      heading: `${start + 3}. Contribution of Traits to Divergence`,
      tables: [{
        columns: ['Trait', 'Times ranked first', 'Contribution (%)'],
        rows: results.contributions.map(c => [c.trait, c.times_first, fmt(c.percent, 1)]),
        note: 'Singh (1981): the trait with the largest difference on the uncorrelated scale, counted over all pairs of genotypes.'
      }]
    }, {
      heading: `${start + 4}. Charts`,
      images: figures.map(([key, label], i) => ({ data: `data:image/png;base64,${charts[key]}`, caption: `Figure ${i + 1}. ${label}` }))
    });
    return {
      title: 'Genetic Divergence (D² and Tocher) Report',
      test_applied: 'Mahalanobis D², Tocher clustering, Wilks’ Lambda, canonical variates',
      dataset_name: file?.name,
      filename: `StatSathi_Divergence_Report_${file.name.replace(/\.[^/.]+$/, '')}`,
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
            <div className="rounded-xl bg-violet-50 p-2 text-violet-600"><Boxes className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Genetic Divergence: D² & Tocher</h3>
              <p className="font-sans text-xs text-slate-400">Mahalanobis D², Tocher clustering, cluster distances and the contribution of each trait.</p>
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
                title="Select or drop a germplasm evaluation dataset"
                hint="One row per plot (or per genotype): a genotype column, an optional replicate column and the measured traits."
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
                  <p className="font-sans text-[13px] text-slate-400">At least 3 genotypes, varieties or accessions.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs font-bold text-slate-500">Replicate / block column (optional)</label>
                  <select value={repCol} onChange={(e) => setRepCol(e.target.value)} className={selectClass}>
                    <option value="">None</option>
                    {columns.filter(c => c !== genotypeCol).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="font-sans text-[13px] text-slate-400">With replication, D² uses the error variance-covariance matrix (Rao&apos;s D²) and Wilks&apos; test is reported.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-sans text-xs font-bold text-slate-500">Traits ({traits.length} selected, at least 2)</label>
                <div className="flex flex-wrap gap-1.5">
                  {numericColumns.filter(c => ![genotypeCol, repCol].includes(c)).map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleTrait(col)}
                      className={`rounded-full border px-3 py-1 font-sans text-xs font-semibold transition-colors cursor-pointer ${
                        traits.includes(col) ? 'border-brand-indigo bg-indigo-50 text-brand-indigo' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
                <p className="font-sans text-[13px] text-slate-400">The order of selection sets the order of the transformation used for the trait contributions.</p>
              </div>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || !genotypeCol || traits.length < 2}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
              >
                {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Computing D² and Tocher clusters...</span></> : <span>Run Divergence Analysis</span>}
              </button>
              </>)}
            </div>
          )}

          {results && (
            <div className="space-y-5 animate-fade-in">
              {reopened && <ReopenedBanner analysis={initialAnalysis} onRestore={restoreSaved} />}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex space-x-5 overflow-x-auto border-b border-slate-200">
                  {[['summary', 'Clusters'], ['distances', 'Cluster Distances'], ['means', 'Cluster Means'], ['contributions', 'Trait Contributions'], ['charts', 'Charts']].map(([id, label]) => (
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
                  <button onClick={downloadCsv} className="flex items-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"><Download className="h-3.5 w-3.5" /><span>D² Matrix CSV</span></button>
                  {user && (
                    <SaveToProjectButton
                      module="divergence"
                      report={() => buildDocxReport()}
                      source={dataset.source}
                      defaultTitle={`Divergence (D²) – ${results.genotypes.length} genotypes`}
                      parameters={{ genotype: genotypeCol, replicate: repCol || null, traits: results.traits, dataset: file?.name }}
                      result={{ ...results, charts: undefined }}
                    />
                  )}
                  <button onClick={() => setResults(null)} className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" /><span>New Analysis</span></button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 font-sans text-[14px]">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{results.genotypes.length} genotypes × {results.traits.length} traits</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{results.clusters.length} Tocher clusters</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">θ = {fmt(results.theta)}</span>
                {results.wilks && (
                  <span className={`rounded-full px-3 py-1 ${results.wilks.p_value < 0.05 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    Wilks&apos; Λ = {fmt(results.wilks.lambda, 4)}, {formatP(results.wilks.p_value)}
                  </span>
                )}
              </div>

              {results.notes.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 font-sans text-[14px] text-amber-700">{results.notes.join(' ')}</div>
              )}

              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {results.wilks && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                      <h5 className="mb-1 font-display text-xs font-bold text-slate-700">Test of divergence (Wilks&apos; Λ)</h5>
                      <p className="font-sans text-xs text-slate-600">
                        Λ = <span className="font-mono font-semibold">{fmt(results.wilks.lambda, 4)}</span>, F({fmt(results.wilks.df1, 0)}, {fmt(results.wilks.df2, 1)}) = <span className="font-mono font-semibold">{fmt(results.wilks.f, 2)}</span>, {formatP(results.wilks.p_value)}.
                        {results.wilks.p_value < 0.05 ? ' The genotypes differ significantly in their mean vectors, so the divergence analysis is justified.' : ' The genotype mean vectors do not differ significantly; interpret the clusters with caution.'}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {results.clusters.map(c => (
                      <div key={c.name} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                        <div className="flex items-baseline justify-between">
                          <p className="font-display text-sm font-bold text-slate-800">{c.name}</p>
                          <span className="font-sans text-[14px] text-slate-400">{c.size} genotype{c.size === 1 ? '' : 's'}</span>
                        </div>
                        <p className="mt-1 font-sans text-xs text-slate-600">{c.members.join(', ')}</p>
                        {c.size > 1 && <p className="mt-1.5 font-sans text-[14px] text-slate-400">Intra-cluster D² = <span className="font-mono">{fmt(c.intra_d2)}</span> (D = {fmt(c.intra_d)})</p>}
                      </div>
                    ))}
                  </div>
                  <p className="font-sans text-[13px] leading-relaxed text-slate-400">
                    Tocher&apos;s method (Rao 1952): each cluster starts with the closest pair of unclustered genotypes, and a genotype joins while its average D² to the members stays below θ = {fmt(results.theta)}, the largest of the genotypes&apos; smallest D² values. Genotypes that cannot join any cluster stand alone.
                  </p>
                </div>
              )}

              {activeTab === 'distances' && (
                <Table
                  columns={['Cluster', ...results.cluster_distances.names]}
                  rows={results.cluster_distances.names.map((name, i) => [name, ...results.cluster_distances.d2[i].map(v => fmt(v))])}
                  note="Average D² within each cluster (diagonal) and between clusters (off-diagonal). Take the square root for D. The most divergent pair of clusters is the best source of parents for hybridization."
                />
              )}

              {activeTab === 'means' && (
                <Table
                  columns={['Cluster', ...results.traits]}
                  rows={results.cluster_means.names.map((name, i) => [name, ...results.cluster_means.values[i].map(v => fmt(v))])}
                  note="Mean of each trait within each cluster: use with the cluster distances to choose parents that are both divergent and good performers."
                />
              )}

              {activeTab === 'contributions' && (
                <Table
                  minWidth={420}
                  columns={['Trait', 'Times ranked first', 'Contribution (%)']}
                  rows={results.contributions.map(c => [c.trait, c.times_first, fmt(c.percent, 1)])}
                  note="For each pair of genotypes, the trait with the largest difference on the uncorrelated (transformed) scale is ranked first (Singh 1981). Traits with a high percentage drive most of the divergence."
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
                  classicPlot={(results.charts || {}).tocher}
                  initialImages={Object.fromEntries(Object.entries((results.charts || {})).filter(([key, image]) => key !== 'tocher' && image))}
                  options={chartOptions}
                  filenameBase="statsathi_divergence"
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

export default DivergenceModal;
