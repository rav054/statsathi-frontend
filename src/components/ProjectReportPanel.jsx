import { useState } from 'react';
import { Check, Copy, FileText, RefreshCw } from 'lucide-react';
import { saveBlob, workspaceApi } from '../utils/workspaceApi';
import { methodsAsText } from '../utils/reportContent';

const Tick = ({ checked, onChange, children }) => (
  <label className="flex cursor-pointer items-start gap-2 font-sans text-[13px] text-ink-2 dark:text-night-ink">
    <input type="checkbox" className="mt-[3px] accent-brand-indigo" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="min-w-0">{children}</span>
  </label>
);

/**
 * The project report: one Word document with the data, the cleaning recipes, a methods section written from the
 * saved settings, every chosen result, an activity log and the references - plus the methods text on its own.
 */
const ProjectReportPanel = ({ token, detail, onError }) => {
  const api = workspaceApi(token);
  const [title, setTitle] = useState(`${detail.name} – analysis report`);
  const [resultIds, setResultIds] = useState(() => detail.results.map(r => r.id));
  const [recipeIds, setRecipeIds] = useState(() => (detail.recipes || []).map(r => r.id));
  const [activity, setActivity] = useState(true);
  const [references, setReferences] = useState(true);
  const [building, setBuilding] = useState(false);
  const [methods, setMethods] = useState(null);
  const [copied, setCopied] = useState(false);

  const toggle = (setter, id) => (on) => setter(current => (on ? [...current, id] : current.filter(x => x !== id)));

  const download = async () => {
    setBuilding(true);
    try {
      const blob = await api.projectReport(detail.id, {
        title: title.trim() || null, result_ids: resultIds, recipe_ids: recipeIds,
        include_activity: activity, include_references: references,
      });
      saveBlob(blob, `${(title.trim() || detail.name).replace(/[^\w.-]+/g, '_')}.docx`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBuilding(false);
    }
  };

  const showMethods = async () => {
    if (methods) {
      setMethods(null);
      return;
    }
    try {
      setMethods(await api.projectMethods(detail.id));
    } catch (err) {
      onError(err.message);
    }
  };

  const copyMethods = async () => {
    try {
      await navigator.clipboard.writeText(methodsAsText(methods));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('The browser would not allow copying; select the text and copy it instead.');
    }
  };


  const nothing = detail.results.length === 0 && (detail.recipes || []).length === 0 && detail.datasets.length === 0;
  const recipes = detail.recipes || [];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const [choosing, setChoosing] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-dashed border-[#CBD5E1] p-4 dark:border-night-line">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <p className="flex-1 font-sans text-[13.5px] leading-[1.5] text-ink-2 dark:text-night-ink">
          {nothing
            ? 'Add data or save an analysis, and the report writes itself from what the project holds.'
            : `Ready to write up: ${plural(detail.datasets.length, 'dataset', 'datasets')}, ${plural(recipes.length, 'cleaning recipe', 'cleaning recipes')} and ${plural(detail.results.length, 'analysis', 'analyses')}, with a methods section and references.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={showMethods} disabled={detail.results.length === 0 && recipes.length === 0}
            className="h-9 rounded-[9px] px-2 font-sans text-[13.5px] font-semibold text-brand-indigo hover:text-brand-violet disabled:opacity-40 dark:text-brand-periwinkle cursor-pointer">
            {methods ? 'Hide methods text' : 'Methods text'}
          </button>
          <button id="project-report-build" type="button" onClick={download} disabled={building || nothing}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-brand-indigo px-3.5 font-sans text-[13px] font-semibold text-white hover:bg-brand-violet disabled:opacity-50 cursor-pointer">
            {building ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            <span>Download Word report</span>
          </button>
        </div>
      </div>

      {!nothing && (
        <button type="button" onClick={() => setChoosing(open => !open)} aria-expanded={choosing}
          className="self-start font-sans text-[12.5px] font-medium text-muted hover:text-ink dark:text-night-muted dark:hover:text-night-ink cursor-pointer">
          {choosing ? 'Hide report contents' : 'Choose what goes in the report'}
        </button>
      )}

      {choosing && (
        <div className="flex flex-col gap-3 rounded-xl bg-soft p-3 dark:bg-night-soft">
          <label className="flex flex-col gap-1 font-sans text-[12px] font-semibold text-ink-2 dark:text-night-muted">
            Report title
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-2.5 font-sans text-[13px] font-normal text-ink dark:border-night-line dark:bg-night dark:text-night-ink" />
          </label>
          {detail.results.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="font-sans text-[11px] font-bold tracking-[0.08em] text-faint">ANALYSES</p>
              {detail.results.map(r => (
                <Tick key={r.id} checked={resultIds.includes(r.id)} onChange={toggle(setResultIds, r.id)}>{r.title}</Tick>
              ))}
            </div>
          )}
          {recipes.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="font-sans text-[11px] font-bold tracking-[0.08em] text-faint">CLEANING RECIPES</p>
              {recipes.map(r => (
                <Tick key={r.id} checked={recipeIds.includes(r.id)} onChange={toggle(setRecipeIds, r.id)}>{r.name}</Tick>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Tick checked={activity} onChange={setActivity}>Activity log</Tick>
            <Tick checked={references} onChange={setReferences}>References</Tick>
          </div>
        </div>
      )}

      {methods && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 dark:border-night-line dark:bg-night">
          <div className="flex items-center justify-between">
            <p className="font-sans text-[11px] font-bold tracking-[0.08em] text-faint">METHODS</p>
            <button type="button" onClick={copyMethods}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-sans text-[12px] font-semibold text-ink-2 hover:bg-soft dark:border-night-line dark:text-night-ink cursor-pointer">
              {copied ? <Check className="h-3.5 w-3.5 text-brand-emerald" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy all'}</span>
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 font-sans text-[13px] leading-relaxed text-ink-2 dark:text-night-ink">
            {methods.preparation.map(p => (
              <p key={`prep-${p.recipe_id}`}><b>Data preparation ({p.name}).</b> {p.sentences.join(' ')}</p>
            ))}
            {methods.analyses.map(a => <p key={`analysis-${a.result_id}`}><b>{a.title}.</b> {a.paragraph}</p>)}
            <p>{methods.software}</p>
            <p className="pt-1 font-bold">References</p>
            <ul className="space-y-1">
              {methods.references.map(ref => <li key={ref} className="pl-4 -indent-4">{ref}</li>)}
            </ul>
          </div>
          <p className="font-sans text-[11.5px] text-faint">
            Written from the saved settings, so read it against what you did. References are in APA style without DOIs.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectReportPanel;
