import { useRef, useState } from 'react';
import { FileJson, FolderOpen, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { saveBlob, workspaceApi, projectLabel, writableProjects } from '../utils/workspaceApi';
import { recipeFromJson, recipeFromSteps, recipeToJson, recipeToProjectBody } from '../utils/prepSteps';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-slate-700 focus:border-brand-indigo focus:outline-none';
const buttonClass = 'flex items-center space-x-1 rounded-lg border border-slate-200 px-2 py-1 font-sans text-[14px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer';
const baseName = (name = 'dataset') => name.replace(/\.[^/.]+$/, '');

/**
 * Saving and loading recipes: kept in a project (so they follow the account and sit beside its data), or as a JSON
 * file. `meta` is the stored recipe being edited ({ id, name, projectId, projectName }), so it can be updated in place.
 */
const RecipeStore = ({ token, user, steps, datasetName, meta, onMeta, onLoad, onError, onNotice }) => {
  const [mode, setMode] = useState(null); // 'save' | 'load'
  const [projects, setProjects] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const api = workspaceApi(token);

  const run = async (work) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openSave = () => run(async () => {
    setMode(mode === 'save' ? null : 'save');
    setName(meta?.name || `${baseName(datasetName)} cleaning`);
    if (user) {
      const list = writableProjects(await api.listProjects());
      setProjects(list);
      setProjectId(String(meta?.projectId || list[0]?.id || ''));
    }
  });

  const openLoad = () => run(async () => {
    setMode(mode === 'load' ? null : 'load');
    if (user) setRecipes(await api.listRecipes());
  });

  const saveNew = () => run(async () => {
    const body = recipeToProjectBody(steps, { name, description, datasetName });
    const saved = await api.saveRecipe(Number(projectId), body);
    const project = projects.find(p => p.id === Number(projectId));
    onMeta({ id: saved.id, name: saved.name, projectId: saved.project_id, projectName: project?.name });
    onNotice(`Recipe "${saved.name}" saved to ${project?.name || 'the project'}.`);
    setMode(null);
  });

  const update = () => run(async () => {
    const saved = await api.replaceRecipe(meta.id, recipeToProjectBody(steps, { name, description, datasetName }));
    onMeta({ ...meta, name: saved.name });
    onNotice(`Recipe "${saved.name}" updated.`);
    setMode(null);
  });

  const loadStored = (recipe) => run(async () => {
    const full = await api.getRecipe(recipe.id);
    onLoad(recipeFromSteps(full.steps), { id: full.id, name: full.name, projectId: full.project_id, projectName: recipe.project_name },
      `Loaded "${full.name}" from ${recipe.project_name}${full.source_dataset ? ` (written for ${full.source_dataset})` : ''}. Check the columns still exist, then run it.`);
    setMode(null);
  });

  const removeStored = (recipe) => run(async () => {
    if (!window.confirm(`Delete the recipe "${recipe.name}"?`)) return;
    await api.deleteRecipe(recipe.id);
    setRecipes(current => current.filter(r => r.id !== recipe.id));
    if (meta?.id === recipe.id) onMeta(null);
  });

  const loadFile = async (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    try {
      onLoad(recipeFromJson(await chosen.text()), null, `Loaded ${chosen.name}. Check the columns still exist, then run it.`);
      setMode(null);
    } catch (err) {
      onError(`Could not read the recipe: ${err.message}`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-slate-800">Recipe</p>
          {meta && <p className="truncate font-sans text-[13px] text-slate-400">{meta.name} · {meta.projectName}</p>}
        </div>
        <div className="flex shrink-0 items-center space-x-1">
          <button type="button" onClick={openLoad} disabled={busy} className={buttonClass} title="Open a saved recipe">
            <Upload className="h-3 w-3" /><span>Load</span>
          </button>
          <button type="button" onClick={openSave} disabled={busy || steps.length === 0} className={buttonClass} title="Keep this recipe to run again">
            <Save className="h-3 w-3" /><span>Save</span>
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={loadFile} />
        </div>
      </div>

      {mode === 'save' && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          {user ? (
            <>
              <input className={inputClass} value={name} maxLength={200} placeholder="Recipe name" onChange={(e) => setName(e.target.value)} />
              <textarea className={inputClass} rows={2} value={description} maxLength={2000} placeholder="What it does (optional)"
                onChange={(e) => setDescription(e.target.value)} />
              <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
              </select>
              <div className="flex flex-wrap gap-1.5">
                {meta?.id && (
                  <button type="button" onClick={update} disabled={busy || !name.trim()}
                    className="rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-[14px] font-bold text-white disabled:opacity-50 cursor-pointer">
                    Update “{meta.name}”
                  </button>
                )}
                <button type="button" onClick={saveNew} disabled={busy || !name.trim() || !projectId}
                  className={meta?.id ? buttonClass : 'rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-[14px] font-bold text-white disabled:opacity-50 cursor-pointer'}>
                  {meta?.id ? 'Save as a new recipe' : 'Save to project'}
                </button>
              </div>
            </>
          ) : (
            <p className="font-sans text-[14px] text-slate-500">Sign in to keep recipes in your projects.</p>
          )}
          <button type="button" className={buttonClass}
            onClick={() => saveBlob(new Blob([recipeToJson(steps, datasetName)], { type: 'application/json' }), `${baseName(datasetName)}_recipe.json`)}>
            <FileJson className="h-3 w-3" /><span>Download as a file</span>
          </button>
        </div>
      )}

      {mode === 'load' && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          {user && recipes === null && <div className="flex justify-center py-2"><RefreshCw className="h-4 w-4 animate-spin text-brand-indigo" /></div>}
          {user && recipes?.length === 0 && <p className="font-sans text-[14px] text-slate-400">No recipes saved in your projects yet.</p>}
          {user && recipes?.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {recipes.map(recipe => (
                <li key={recipe.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <button type="button" onClick={() => loadStored(recipe)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <p className="truncate font-sans text-[14px] font-semibold text-slate-700">{recipe.name}</p>
                    <p className="truncate font-sans text-[13px] text-slate-400">
                      <FolderOpen className="mr-1 inline h-3 w-3 text-brand-orange" />
                      {recipe.project_name} · {recipe.step_count} step{recipe.step_count === 1 ? '' : 's'}
                      {recipe.source_dataset ? ` · ${recipe.source_dataset}` : ''}
                    </p>
                  </button>
                  <button type="button" onClick={() => removeStored(recipe)} title="Delete recipe"
                    className="shrink-0 p-1 text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={buttonClass} onClick={() => fileRef.current?.click()}>
            <FileJson className="h-3 w-3" /><span>From a file…</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default RecipeStore;
