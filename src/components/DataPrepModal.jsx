import { apiFetch } from '../utils/apiFetch';
import { useMemo, useState } from 'react';
import {
  X, AlertCircle, CheckCircle2, Download, Play, Plus, RefreshCw, Sparkles, FolderPlus, Wand2,
} from 'lucide-react';
import { useAuth, API_URL } from '../context/AuthContext';
import DatasetPicker from './DatasetPicker';
import PrepStepEditor from './PrepStepEditor';
import RecipeStore from './RecipeStore';
import MultipleImputationPanel from './MultipleImputationPanel';
import { useDataset } from '../hooks/useDataset';
import { saveBlob, workspaceApi, projectLabel, writableProjects } from '../utils/workspaceApi';
import {
  STEP_CATALOG, STEP_GROUPS, newStep, stepProblem, toApiStep, recipeFromSteps, columnsAfter, suggestedSteps,
} from '../utils/prepSteps';

const fmt = (value, digits = 3) => (value === undefined || value === null ? '–' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }));
const baseName = (name = 'dataset') => name.replace(/\.[^/.]+$/, '');

const Tile = ({ label, value, tone = 'slate', hint }) => (
  <div className={`rounded-2xl border p-3 ${tone === 'amber' ? 'border-amber-200 bg-amber-50/60' : tone === 'green' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-100 bg-slate-50'}`}>
    <p className="font-sans text-[13px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="font-display text-lg font-bold text-slate-800">{value}</p>
    {hint && <p className="font-sans text-[13px] text-slate-400">{hint}</p>}
  </div>
);

const PreviewTable = ({ preview }) => (
  <div className="overflow-auto rounded-2xl border border-slate-100">
    <table className="min-w-full text-left font-sans text-[14px]">
      <thead className="sticky top-0 bg-slate-50">
        <tr>
          {preview.columns.map(name => <th key={name} className="whitespace-nowrap px-3 py-2 font-bold text-slate-600">{name}</th>)}
        </tr>
      </thead>
      <tbody>
        {preview.rows.map((row, i) => (
          <tr key={i} className="border-t border-slate-50">
            {preview.columns.map(name => (
              <td key={name} className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-700">
                {row[name] === null || row[name] === undefined ? <span className="text-slate-300">—</span> : String(row[name])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 font-sans text-[13px] text-slate-400">
      Showing {preview.showing} of {preview.total.toLocaleString()} rows
    </p>
  </div>
);

// What the profile found, column by column
const HealthCheck = ({ profile }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Tile label="Rows" value={profile.n_rows.toLocaleString()} hint={`${profile.complete_rows.toLocaleString()} complete`} />
      <Tile label="Columns" value={profile.n_columns} />
      <Tile label="Missing cells" value={`${profile.missing_pct}%`} tone={profile.missing_cells ? 'amber' : 'green'} hint={`${profile.missing_cells.toLocaleString()} cells`} />
      <Tile label="Duplicate rows" value={profile.duplicate_rows} tone={profile.duplicate_rows ? 'amber' : 'green'} />
      <Tile label="Issues" value={profile.issue_count} tone={profile.issue_count ? 'amber' : 'green'} />
    </div>

    <div className="overflow-auto rounded-2xl border border-slate-100">
      <table className="min-w-full text-left font-sans text-[14px]">
        <thead className="bg-slate-50">
          <tr>
            {['Column', 'Type', 'Missing', 'Unique', 'Summary', 'Worth checking'].map(h => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-bold text-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profile.columns.map(column => (
            <tr key={column.name} className="border-t border-slate-50 align-top">
              <td className="px-3 py-2 font-semibold text-slate-800">{column.name}</td>
              <td className="px-3 py-2 text-slate-500">{column.kind}</td>
              <td className={`px-3 py-2 ${column.missing ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
                {column.missing ? `${column.missing} (${column.missing_pct}%)` : '0'}
              </td>
              <td className="px-3 py-2 text-slate-500">{column.unique}</td>
              <td className="px-3 py-2 text-slate-500">
                {column.kind === 'numeric' && column.mean !== undefined
                  ? `${fmt(column.min)} – ${fmt(column.max)} · mean ${fmt(column.mean)}`
                  : (column.top_values || []).map(([v, n]) => `${v} (${n})`).join(', ')}
              </td>
              <td className="px-3 py-2">
                {column.issues.length === 0
                  ? <span className="text-emerald-600">Looks fine</span>
                  : <ul className="space-y-0.5">{column.issues.map(issue => <li key={issue.code} className="text-amber-700">{issue.message}</li>)}</ul>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/**
 * Data Preparation: check a dataset for the usual problems, build a recipe of cleaning steps, run it, and hand the
 * cleaned table to every other module. The recipe can be saved and run again on the next season's sheet.
 */
const DataPrepModal = ({ isOpen, onClose, initialRecipe = null }) => {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [profiling, setProfiling] = useState(false);
  const [steps, setSteps] = useState(() => (initialRecipe ? recipeFromSteps(initialRecipe.steps) : []));
  // The stored recipe being edited, so Save can update it in place
  const [recipeMeta, setRecipeMeta] = useState(() => (initialRecipe
    ? { id: initialRecipe.id, name: initialRecipe.name, projectId: initialRecipe.project_id, projectName: initialRecipe.projectName }
    : null));
  const [mergeFile, setMergeFile] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(initialRecipe ? `Opened the recipe "${initialRecipe.name}". Choose the dataset to run it on.` : null);
  const [tab, setTab] = useState('check');
  const [adding, setAdding] = useState(false);
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState('');

  const readProfile = async (file) => {
    setProfiling(true);
    setError(null);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await apiFetch(`${API_URL}/analyze/prep/profile`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not check this dataset.');
      setProfile(data.profile);
      setPreview(data.preview);
    } catch (err) {
      setError(err.message);
    } finally {
      setProfiling(false);
    }
  };

  const dataset = useDataset({
    active: isOpen,
    onLoaded: ({ file }) => {
      setOutcome(null);
      setTab('check');
      readProfile(file);
    },
    onCleared: () => {
      setProfile(null);
      setPreview(null);
      setOutcome(null);
    },
  });
  const { file } = dataset;

  const originalColumns = useMemo(() => profile?.columns.map(c => c.name) || [], [profile]);
  const topValues = useMemo(
    () => Object.fromEntries((profile?.columns || []).map(c => [c.name, (c.top_values || []).map(([v]) => v)])),
    [profile],
  );
  const suggestions = useMemo(() => {
    const taken = new Set(steps.map(s => s.type));
    return suggestedSteps(profile).filter(s => !taken.has(s.step.type));
  }, [profile, steps]);

  if (!isOpen) return null;

  const blocking = steps.map(step => stepProblem(step, { hasMergeFile: Boolean(mergeFile) })).find(Boolean);

  const updateStep = (index, next) => setSteps(current => current.map((s, i) => (i === index ? next : s)));
  const moveStep = (index, offset) => setSteps(current => {
    const next = [...current];
    const target = index + offset;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const addStep = (type) => {
    setSteps(current => [...current, newStep(type)]);
    setAdding(false);
  };

  const runRecipe = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    const body = new FormData();
    body.append('file', file);
    body.append('steps', JSON.stringify(steps.map(toApiStep)));
    if (mergeFile && steps.some(s => s.type === 'merge')) body.append('merge_file', mergeFile);
    try {
      const res = await apiFetch(`${API_URL}/analyze/prep/apply`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'The recipe could not be run.');
      setOutcome(data);
      setTab('result');
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  // Try a formula on the data as it stands after the steps before it
  const checkFormula = async (index, formula) => {
    const body = new FormData();
    body.append('file', file);
    body.append('formula', formula);
    const earlier = steps.slice(0, index);
    body.append('steps', JSON.stringify(earlier.map(toApiStep)));
    if (mergeFile && earlier.some(s => s.type === 'merge')) body.append('merge_file', mergeFile);
    const res = await apiFetch(`${API_URL}/analyze/prep/formula`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'The formula could not be checked.');
    return data;
  };

  const cleanedFile = () => new File([outcome.csv_content], `${baseName(file?.name)}_clean.csv`, { type: 'text/csv' });

  // The cleaned table becomes the workspace dataset, so every module opens on it
  const useCleaned = async () => {
    const cleaned = cleanedFile();
    const loaded = await dataset.selectFile(cleaned);
    if (loaded) {
      setSteps([]);
      setMergeFile(null);
      setNotice(`Now working on ${cleaned.name} - every module will open on it.`);
    }
  };

  const openProjects = async () => {
    try {
      const list = writableProjects(await workspaceApi(token).listProjects());
      setProjects(list);
      setProjectId(list.length ? String(list[0].id) : '');
    } catch (err) {
      setError(err.message);
    }
  };

  const saveToProject = async () => {
    try {
      await workspaceApi(token).uploadDataset(Number(projectId), cleanedFile());
      setNotice('Cleaned dataset saved to the project.');
      setProjects(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClose = () => {
    dataset.clear();
    setSteps([]);
    setRecipeMeta(null);
    setMergeFile(null);
    setError(null);
    setNotice(null);
    onClose();
  };

  const recipePanel = (
    <div className="flex h-full flex-col space-y-3">
      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
          <p className="mb-2 flex items-center space-x-1.5 font-sans text-[13px] font-bold uppercase tracking-wide text-brand-indigo">
            <Sparkles className="h-3.5 w-3.5" /><span>Suggested fixes</span>
          </p>
          <div className="space-y-1.5">
            {suggestions.map(suggestion => (
              <button
                key={suggestion.title}
                type="button"
                onClick={() => setSteps(current => [...current, suggestion.step])}
                className="flex w-full items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-left font-sans text-[14px] text-slate-700 hover:bg-indigo-50 cursor-pointer"
              >
                <span>{suggestion.title}</span>
                <Plus className="h-3.5 w-3.5 shrink-0 text-brand-indigo" />
              </button>
            ))}
          </div>
        </div>
      )}

      <RecipeStore
        token={token}
        user={user}
        steps={steps}
        datasetName={file?.name}
        meta={recipeMeta}
        onMeta={setRecipeMeta}
        onLoad={(loaded, meta, message) => {
          setSteps(loaded);
          setRecipeMeta(meta);
          setOutcome(null);
          setError(null);
          setNotice(message);
        }}
        onError={setError}
        onNotice={(message) => { setError(null); setNotice(message); }}
      />

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {steps.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center font-sans text-[14px] text-slate-400">
            Add a suggested fix or a step below. Steps run in order, top to bottom.
          </p>
        )}
        {steps.map((step, index) => (
          <PrepStepEditor
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            columns={columnsAfter(originalColumns, steps.slice(0, index))}
            valuesOf={(column) => topValues[column] || []}
            mergeFile={mergeFile}
            onMergeFile={setMergeFile}
            onCheckFormula={(formula) => checkFormula(index, formula)}
            onChange={(next) => updateStep(index, next)}
            onMove={(offset) => moveStep(index, offset)}
            onRemove={() => setSteps(current => current.filter((_, i) => i !== index))}
          />
        ))}

        {adding ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            {STEP_GROUPS.map(group => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="mb-1 font-sans text-[13px] font-bold uppercase tracking-wide text-slate-400">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STEP_CATALOG).filter(([, spec]) => spec.group === group).map(([type, spec]) => (
                    <button key={type} type="button" onClick={() => addStep(type)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 font-sans text-[14px] font-semibold text-slate-600 hover:border-brand-indigo hover:text-brand-indigo cursor-pointer">
                      {spec.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center space-x-1.5 rounded-2xl border border-dashed border-slate-300 py-2 font-sans text-xs font-semibold text-slate-500 hover:border-brand-indigo hover:text-brand-indigo cursor-pointer">
            <Plus className="h-3.5 w-3.5" /><span>Add a step</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={runRecipe}
        disabled={running || steps.length === 0 || Boolean(blocking)}
        title={blocking || ''}
        className="flex w-full items-center justify-center space-x-2 rounded-xl bg-brand-indigo py-2.5 font-sans text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
      >
        {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        <span>Run recipe</span>
      </button>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[780px] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl font-sans">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-brand-indigo"><Wand2 className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Data Preparation</h3>
              <p className="font-sans text-xs text-slate-400">Check a dataset for problems, clean it step by step, and keep the recipe.</p>
            </div>
          </div>
          <button data-dialog-close aria-label="Close" type="button" onClick={handleClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {!file ? (
            <div className="h-full space-y-4 overflow-y-auto p-6">
              {steps.length > 0 && (
                <div className="flex items-start space-x-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-indigo-900">
                  <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-indigo" />
                  <p className="font-sans text-xs">
                    {recipeMeta ? <>The recipe <b>{recipeMeta.name}</b> from {recipeMeta.projectName}</> : 'A recipe'} is ready
                    ({steps.length} step{steps.length === 1 ? '' : 's'}). Choose the dataset to run it on.
                  </p>
                </div>
              )}
              <DatasetPicker
                dataset={dataset}
                title="Select or drop a dataset to prepare"
                hint="Any field or laboratory sheet (CSV or Excel). Nothing is changed until you run a recipe."
              />
            </div>
          ) : (
            <div className="grid h-full grid-cols-1 lg:grid-cols-[380px_1fr]">
              <div className="overflow-hidden border-b border-slate-100 bg-slate-50/40 p-4 lg:border-b-0 lg:border-r">
                {recipePanel}
              </div>

              <div className="flex flex-col overflow-hidden">
                <div className="space-y-3 border-b border-slate-100 p-4">
                  <DatasetPicker dataset={dataset} />
                  {error && (
                    <div className="flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="font-sans text-xs">{error}</span>
                    </div>
                  )}
                  {notice && (
                    <div className="flex items-start space-x-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span className="font-sans text-xs">{notice}</span>
                    </div>
                  )}
                  <div className="flex space-x-6 border-b border-slate-100">
                    {[['check', 'Health check'], ['data', 'Data'], ['impute', 'Multiple imputation'], ['result', 'Result']].map(([id, label]) => (
                      <button key={id} type="button" disabled={id === 'result' && !outcome} onClick={() => setTab(id)}
                        className={`pb-2 font-sans text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer ${tab === id ? 'border-b-2 border-brand-indigo text-brand-indigo' : 'text-slate-400 hover:text-slate-600'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {profiling && <div className="flex justify-center py-16"><RefreshCw className="h-8 w-8 animate-spin text-brand-indigo" /></div>}
                  {!profiling && tab === 'check' && profile && <HealthCheck profile={profile} />}
                  {!profiling && tab === 'data' && preview && <PreviewTable preview={preview} />}
                  {!profiling && tab === 'impute' && profile && (
                    <MultipleImputationPanel key={`${file?.name}-${profile.n_rows}-${profile.missing_cells}`} token={token} file={file} profile={profile} />
                  )}
                  {!profiling && tab === 'result' && outcome && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Tile label="Rows" value={`${outcome.before.n_rows.toLocaleString()} → ${outcome.after.n_rows.toLocaleString()}`} />
                        <Tile label="Columns" value={`${outcome.before.n_columns} → ${outcome.after.n_columns}`} />
                        <Tile label="Missing cells" value={`${outcome.before.missing_cells} → ${outcome.after.missing_cells}`} tone={outcome.after.missing_cells ? 'amber' : 'green'} />
                        <Tile label="Issues" value={`${outcome.before.issue_count} → ${outcome.after.issue_count}`} tone={outcome.after.issue_count ? 'amber' : 'green'} />
                      </div>

                      <div className="rounded-2xl border border-slate-100 p-4">
                        <p className="mb-2 font-display text-xs font-bold text-slate-800">What the recipe did</p>
                        <ol className="space-y-1.5">
                          {outcome.log.map(entry => (
                            <li key={entry.step} className="flex space-x-2 font-sans text-xs text-slate-600">
                              <span className="font-bold text-brand-indigo">{entry.step}.</span><span>{entry.message}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={useCleaned}
                          className="flex items-center space-x-1.5 rounded-xl bg-brand-indigo px-4 py-2 font-sans text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer">
                          <CheckCircle2 className="h-4 w-4" /><span>Use the cleaned data</span>
                        </button>
                        <button type="button" onClick={() => saveBlob(cleanedFile(), cleanedFile().name)}
                          className="flex items-center space-x-1.5 rounded-xl border border-slate-200 px-4 py-2 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                          <Download className="h-4 w-4 text-brand-orange" /><span>Download CSV</span>
                        </button>
                        {user && (projects === null ? (
                          <button type="button" onClick={openProjects}
                            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 px-4 py-2 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                            <FolderPlus className="h-4 w-4 text-brand-indigo" /><span>Save to a project</span>
                          </button>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 font-sans text-xs">
                              {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
                            </select>
                            <button type="button" onClick={saveToProject} disabled={!projectId}
                              className="rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-xs font-bold text-white disabled:opacity-50 cursor-pointer">Save</button>
                          </div>
                        ))}
                      </div>

                      <PreviewTable preview={outcome.preview} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataPrepModal;
