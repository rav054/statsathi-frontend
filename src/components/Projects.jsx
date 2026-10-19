import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowLeft, Check, Edit2, RefreshCw, Trash2, Wand2, X } from 'lucide-react';
import { workspaceApi, saveBlob } from '../utils/workspaceApi';
import { canReopen, storeAnalysisHandoff } from '../utils/analysisHandoff';
import { formatStat, moduleName, relativeTime, summariseResult } from '../utils/resultSummary';
import ProjectReportPanel from './ProjectReportPanel';
import ProjectSharingPanel from './ProjectSharingPanel';
import ProjectInvitations from './ProjectInvitations';
import { MiniBars } from './Home';
import { ChevronRightIcon, DatabaseIcon, DocumentIcon, DownloadIcon, FolderIcon, PlusIcon, ShareIcon, UploadIcon } from './shell/Icons';

const LEGACY_KEY = 'statsathi_projects';
const LEGACY_IMPORTED_KEY = 'statsathi_projects_imported';

const statusFromTasks = (tasks) => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  if (total === 0) return 'Empty';
  if (completed === total) return 'Completed';
  if (completed > 0) return 'In Progress';
  return 'Ready';
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
const formatBytes = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

const STATUS_PILL = {
  Completed: 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/60 dark:text-emerald-300',
  Ready: 'bg-[#EEF0FF] text-brand-violet dark:bg-brand-indigo/25 dark:text-[#C7CCF9]',
  'In Progress': 'bg-[#FEF3C7] text-[#B45309] dark:bg-amber-950/50 dark:text-amber-300',
  Empty: 'bg-soft text-muted dark:bg-night-soft dark:text-night-muted',
};

const PREP_STEP_NAMES = {
  compute_column: 'calculated column', impute_model: 'model imputation', drop_missing: 'drop missing rows', fill_missing: 'fill missing values',
  drop_duplicates: 'drop duplicates', filter_rows: 'filter rows',
};
const stepName = (step) => PREP_STEP_NAMES[step.type] || String(step.type || '').replace(/_/g, ' ');

// Projects kept in this browser before accounts stored them are imported once.
// The browser copy is left untouched as a backup.
const importLegacyProjects = async (api) => {
  try {
    if (localStorage.getItem(LEGACY_IMPORTED_KEY)) return;
    const saved = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    const own = Array.isArray(saved) ? saved.filter(p => p && p.name && p.name !== 'Dummy project') : [];
    if (own.length > 0) await api.importProjects(own);
    localStorage.setItem(LEGACY_IMPORTED_KEY, new Date().toISOString());
  } catch (err) {
    console.error('Could not import browser-saved projects:', err);
  }
};

const personTone = (index) => ['bg-brand-navy dark:bg-night-soft', 'bg-brand-emerald', 'bg-brand-orange', 'bg-brand-indigo'][index % 4];

const Avatar = ({ name, index = 0, className = 'h-[34px] w-[34px] text-[13px]' }) => (
  <span className={`flex items-center justify-center rounded-full border-2 border-surface font-bold text-white dark:border-night-surface ${personTone(index)} ${className}`}>
    {(name || '?').charAt(0).toUpperCase()}
  </span>
);

const IconButton = ({ label, onClick, disabled, danger, children }) => (
  <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
    className={`flex h-8 w-8 items-center justify-center rounded-lg text-faint disabled:opacity-40 cursor-pointer ${danger ? 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40' : 'hover:bg-soft hover:text-ink dark:hover:bg-night-soft dark:hover:text-night-ink'}`}>
    {children}
  </button>
);

// One step of the "From data to report" thread
const Stage = ({ number, title, state = 'done', last = false, action, children }) => {
  const marker = state === 'current'
    ? 'bg-brand-indigo text-white border-brand-indigo'
    : state === 'pending'
      ? 'border-dashed border-faint text-muted bg-surface dark:bg-night-surface'
      : 'border-brand-emerald text-brand-emerald bg-surface dark:bg-night-surface';
  return (
    <div className="flex gap-[18px]">
      <div className="flex w-7 shrink-0 flex-col items-center">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] font-mono text-[11px] font-semibold ${marker}`}>{number}</span>
        {!last && <span className="w-[1.5px] flex-1 bg-[#DDE1EA] dark:bg-night-line" />}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col gap-2.5 ${last ? '' : 'pb-[26px]'}`}>
        <div className="flex h-7 items-center gap-2.5">
          <h3 className="flex-1 font-display text-base font-bold">{title}</h3>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
};

const TextLink = ({ onClick, children, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="font-sans text-[13px] font-semibold text-brand-indigo hover:text-brand-violet disabled:opacity-40 dark:text-brand-periwinkle cursor-pointer">
    {children}
  </button>
);

const Projects = ({ onAuthClick, onOpenDashboard, request = null }) => {
  const { user, token } = useAuth();
  const api = useMemo(() => workspaceApi(token), [token]);

  const [projects, setProjects] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Active project, including its datasets and saved results
  const [detail, setDetail] = useState(null);
  const [meta, setMeta] = useState({ samples: 0, variables: 0, test_used: '' });
  const [summaries, setSummaries] = useState({});

  // Create / edit states
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTasks, setNewProjectTasks] = useState(['']);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const fileInputRef = useRef(null);

  // "New project" from Home opens the create form straight away
  const [seenRequest, setSeenRequest] = useState(null);
  if (request !== seenRequest) {
    setSeenRequest(request);
    if (request?.kind === 'create') setIsCreating(true);
  }

  const run = async (action) => {
    setError(null);
    setBusy(true);
    try {
      return await action();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const refreshList = useCallback(async () => {
    const [list, usage] = await Promise.all([api.listProjects(), api.storage()]);
    setProjects(list);
    setStorage(usage);
  }, [api]);

  useEffect(() => {
    if (!user || !token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await importLegacyProjects(api);
        const [list, usage] = await Promise.all([api.listProjects(), api.storage()]);
        if (!cancelled) {
          setProjects(list);
          setStorage(usage);
        }
        if (request?.kind === 'open' && request.id) {
          const project = await api.getProject(request.id);
          if (!cancelled) {
            setDetail(project);
            setMeta({ samples: project.samples, variables: project.variables, test_used: project.test_used });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, token, api, request]);

  // Findings for saved ANOVA results (the list carries only titles, so the newest few are fetched in full)
  const detailId = detail?.id;
  const summarisable = useMemo(
    () => (detail?.results || []).filter(r => r.module === 'anova').slice(0, 6).map(r => r.id).join(','),
    [detail],
  );
  useEffect(() => {
    if (!detailId || !summarisable) return undefined;
    let cancelled = false;
    Promise.all(summarisable.split(',').map(id => api.getResult(Number(id)).catch(() => null)))
      .then(results => {
        if (cancelled) return;
        const found = {};
        results.filter(Boolean).forEach(r => { found[r.id] = summariseResult(r.module, r.result, r.parameters); });
        setSummaries(found);
      });
    return () => { cancelled = true; };
  }, [api, detailId, summarisable]);

  const applyDetail = (project) => {
    setDetail(project);
    setMeta({ samples: project.samples, variables: project.variables, test_used: project.test_used });
  };

  const openProject = (id) => run(async () => applyDetail(await api.getProject(id)));

  const reloadDetail = async (id) => applyDetail(await api.getProject(id));

  const closeProject = () => {
    setDetail(null);
    setSummaries({});
    setIsEditingName(false);
    run(refreshList);
  };

  // PATCH the active project, keeping the datasets and results already loaded
  const updateDetail = (changes) => run(async () => {
    const updated = await api.updateProject(detail.id, changes);
    setDetail(prev => ({ ...prev, ...updated, datasets: prev.datasets, results: prev.results, recipes: prev.recipes, members: prev.members, dataset_count: prev.dataset_count, result_count: prev.result_count }));
  });

  const handleDelete = (project, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete "${project.name}" with its datasets and saved results? This cannot be undone.`)) return;
    run(async () => {
      await api.deleteProject(project.id);
      if (detail?.id === project.id) setDetail(null);
      await refreshList();
    });
  };

  const handleCreateProjectSubmit = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const tasks = newProjectTasks
      .filter(t => t.trim() !== '')
      .map((t, idx) => ({ id: Date.now() + idx, text: t.trim(), completed: false }));

    run(async () => {
      const created = await api.createProject({ name: newProjectName.trim(), status: statusFromTasks(tasks), tasks });
      setNewProjectName('');
      setNewProjectTasks(['']);
      setIsCreating(false);
      await reloadDetail(created.id);
    });
  };

  const handleTaskFieldChange = (index, value) => {
    const updated = [...newProjectTasks];
    updated[index] = value;
    setNewProjectTasks(updated);
  };

  const handleRemoveTaskField = (index) => {
    const updated = newProjectTasks.filter((_, idx) => idx !== index);
    setNewProjectTasks(updated.length > 0 ? updated : ['']);
  };

  const saveTasks = (tasks) => updateDetail({ tasks, status: statusFromTasks(tasks) });
  const handleToggleTask = (taskId) => saveTasks(detail.tasks.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t)));
  const handleAddNewTask = (e) => {
    e.preventDefault();
    if (!taskInput.trim()) return;
    saveTasks([...detail.tasks, { id: Date.now(), text: taskInput.trim(), completed: false }]);
    setTaskInput('');
  };
  const handleDeleteTask = (taskId) => saveTasks(detail.tasks.filter(t => t.id !== taskId));

  const handleSaveNameEdit = () => {
    if (!editedName.trim()) return;
    updateDetail({ name: editedName.trim() });
    setIsEditingName(false);
  };

  const handleMetaBlur = (field) => {
    if (meta[field] !== detail[field]) updateDetail({ [field]: meta[field] });
  };

  const handleDatasetUpload = (e) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    run(async () => {
      await api.uploadDataset(detail.id, selected);
      await reloadDetail(detail.id);
      setStorage(await api.storage());
    });
  };

  const handleDatasetDownload = (dataset) => run(async () => saveBlob(await api.downloadDataset(dataset.id), dataset.filename));

  // Send a saved analysis back to the module that produced it, with its dataset when one is linked
  const handleResultOpen = (result) => run(async () => {
    const full = await api.getResult(result.id);
    const stored = detail.datasets.find(d => d.id === full.dataset_id) || null;
    const ready = storeAnalysisHandoff({
      module: full.module,
      title: full.title,
      parameters: full.parameters || {},
      result: full.result,
      savedAt: full.created_at,
      projectName: detail.name,
      dataset: stored,
    });
    if (!ready) throw new Error('This browser would not let the analysis be handed over (session storage is blocked).');
    onOpenDashboard?.();
  });

  const handleDatasetDelete = (dataset) => {
    if (!window.confirm(`Delete dataset "${dataset.filename}"?`)) return;
    run(async () => {
      await api.deleteDataset(dataset.id);
      await reloadDetail(detail.id);
      setStorage(await api.storage());
    });
  };

  const handleResultDownload = (result) => run(async () => {
    const full = await api.getResult(result.id);
    saveBlob(new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' }), `${result.title.replace(/[^\w.-]+/g, '_')}.json`);
  });

  // A recipe opens in Data Preparation, where the user picks the dataset to run it on
  const handleRecipeOpen = (recipe) => run(async () => {
    const ready = storeAnalysisHandoff({ module: 'prep', recipe: { ...recipe, projectName: detail.name } });
    if (!ready) throw new Error('This browser would not let the recipe be handed over (session storage is blocked).');
    onOpenDashboard?.();
  });

  const handleRecipeDownload = (recipe) => {
    const file = { statsathi_recipe: 1, name: recipe.name, description: recipe.description, dataset: recipe.source_dataset, steps: recipe.steps };
    saveBlob(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), `${recipe.name.replace(/[^\w.-]+/g, '_')}_recipe.json`);
  };

  const handleRecipeDelete = (recipe) => {
    if (!window.confirm(`Delete the recipe "${recipe.name}"?`)) return;
    run(async () => {
      await api.deleteRecipe(recipe.id);
      await reloadDetail(detail.id);
      setStorage(await api.storage());
    });
  };

  const handleResultDelete = (result) => {
    if (!window.confirm(`Delete saved analysis "${result.title}"?`)) return;
    run(async () => {
      await api.deleteResult(result.id);
      await reloadDetail(detail.id);
      setStorage(await api.storage());
    });
  };

  const errorBanner = error && (
    <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-sans text-[13px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{error}</span>
      <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-rose-400 hover:text-rose-700 cursor-pointer"><X className="h-4 w-4" /></button>
    </div>
  );

  const inputClass = 'h-[38px] w-full rounded-[9px] border border-[#DDE1EA] bg-surface px-3 font-sans text-[13.5px] text-ink outline-hidden placeholder:text-faint focus:border-brand-indigo read-only:bg-soft dark:border-night-line dark:bg-night dark:text-night-ink';
  const cardClass = 'rounded-2xl border border-line bg-surface dark:border-night-line dark:bg-night-surface';

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FF] text-brand-indigo dark:bg-night-soft">
          <FolderIcon className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-bold">Projects</h2>
        <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-muted dark:text-night-muted">
          Log in to keep datasets, cleaning recipes, analyses and reports together, and to share them with colleagues.
        </p>
        <button onClick={onAuthClick} className="mt-6 h-11 rounded-xl bg-brand-indigo px-5 font-sans text-sm font-semibold text-white hover:bg-brand-violet cursor-pointer">
          Log in to see your projects
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-brand-indigo" />
      </div>
    );
  }

  // 1. CREATE
  if (isCreating) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-10 md:py-8 animate-fade-in">
        {errorBanner}
        <div className="flex items-center gap-3">
          <button onClick={() => setIsCreating(false)} aria-label="Back to projects"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink dark:border-night-line dark:bg-night-surface cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight">New project</h1>
            <p className="font-sans text-[13.5px] text-muted dark:text-night-muted">A home for one study: its data, analyses and report.</p>
          </div>
        </div>

        <form onSubmit={handleCreateProjectSubmit} className={`${cardClass} flex flex-col gap-6 p-6`}>
          <label className="flex flex-col gap-1.5 font-sans text-[12.5px] font-semibold text-ink-2 dark:text-night-muted">
            Project name
            <input type="text" required maxLength={200} autoFocus placeholder="e.g. Rice nitrogen trial 2026" value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)} className={`${inputClass} h-[42px] font-normal`} />
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-sans text-[12.5px] font-semibold text-ink-2 dark:text-night-muted">Tasks <span className="font-normal text-faint">(optional)</span></span>
            <p className="-mt-1 font-sans text-[12.5px] text-faint">The steps you plan to take. You can change them later.</p>
            <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto pr-1">
              {newProjectTasks.map((task, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" placeholder={`Task ${idx + 1}`} value={task} onChange={(e) => handleTaskFieldChange(idx, e.target.value)} className={inputClass} />
                  <IconButton label="Remove task" onClick={() => handleRemoveTaskField(idx)} danger><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setNewProjectTasks([...newProjectTasks, ''])}
              className="flex items-center gap-1.5 self-start font-sans text-[13px] font-semibold text-brand-indigo hover:text-brand-violet dark:text-brand-periwinkle cursor-pointer">
              <PlusIcon className="h-4 w-4" /> Add a task
            </button>
          </div>

          <button type="submit" disabled={busy}
            className="h-11 rounded-xl bg-brand-indigo font-sans text-sm font-semibold text-white hover:bg-brand-violet disabled:opacity-60 cursor-pointer">
            Create and open project
          </button>
        </form>
      </main>
    );
  }

  // 2. PROJECT PAGE
  if (detail) {
    const isOwner = detail.role === 'owner';
    const canEdit = detail.role !== 'viewer';
    const completedTasks = detail.tasks.filter(t => t.completed).length;
    const recipes = detail.recipes || [];
    const members = (detail.members || []).filter(m => m.status === 'active');
    const shared = !isOwner || detail.member_count > 0;
    const who = (item) => (item.added_by?.email === user.email ? 'you' : item.added_by?.full_name?.split(' ')[0] || 'someone');
    const latestResultId = detail.results[0]?.id;
    const activity = [
      ...detail.datasets.map(d => ({ key: `d${d.id}`, at: d.created_at, tone: 'bg-brand-emerald', text: <>{who(d) === 'you' ? 'You' : who(d)} added <strong>{d.filename}</strong></> })),
      ...detail.results.map(r => ({ key: `r${r.id}`, at: r.created_at, tone: 'bg-brand-orange', text: <>{who(r) === 'you' ? 'You' : who(r)} saved <strong>{r.title}</strong></> })),
      ...recipes.map(r => ({ key: `c${r.id}`, at: r.updated_at, tone: 'bg-brand-indigo', text: <>{who(r) === 'you' ? 'You' : who(r)} saved the recipe <strong>{r.name}</strong></> })),
    ].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 4);
    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return (
      <div className="flex flex-col animate-fade-in">
        {/* Project header */}
        <header className="relative overflow-hidden border-b border-line bg-surface px-4 pb-[26px] pt-[22px] md:px-12 dark:border-night-line dark:bg-night-surface">
          <svg className="pointer-events-none absolute right-0 top-0 hidden md:block" width="520" height="190" viewBox="0 0 520 190" aria-hidden="true">
            <defs>
              <pattern id="project-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="currentColor" className="text-[#EEF0F5] dark:text-night-line" /></pattern>
              <linearGradient id="project-fade" x1="0" x2="1"><stop offset="0" stopColor="var(--color-surface)" /><stop offset="0.6" stopColor="var(--color-surface)" stopOpacity="0" /></linearGradient>
            </defs>
            <rect width="520" height="190" fill="url(#project-grid)" />
            <ellipse cx="380" cy="80" rx="120" ry="50" fill="none" stroke="#C7CCF9" strokeDasharray="3 5" transform="rotate(-20 380 80)" opacity="0.8" />
            <circle cx="330" cy="100" r="3" fill="#6366F1" /><circle cx="356" cy="86" r="4" fill="#4F46E5" /><circle cx="382" cy="78" r="2.5" fill="#818CF8" />
            <circle cx="404" cy="66" r="3.5" fill="#4F46E5" /><circle cx="430" cy="58" r="2.5" fill="#6366F1" /><circle cx="452" cy="44" r="5" fill="#F97316" />
            <circle cx="342" cy="126" r="2.5" fill="#10B981" /><circle cx="370" cy="118" r="3" fill="#059669" /><circle cx="396" cy="122" r="2" fill="#34D399" />
            <rect width="520" height="190" fill="url(#project-fade)" className="dark:hidden" />
          </svg>

          <div className="relative flex items-center gap-2 font-sans text-[13px] text-muted dark:text-night-muted">
            <button type="button" onClick={closeProject} className="flex items-center gap-1.5 hover:text-ink dark:hover:text-night-ink cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" /> Projects
            </button>
            <ChevronRightIcon className="h-3.5 w-3.5 text-faint" />
            <span className="truncate font-semibold text-ink dark:text-night-ink">{detail.name}</span>
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin text-faint" />}
          </div>

          <div className="relative mt-[18px] flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                {isEditingName ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveNameEdit(); }} className="flex items-center gap-2">
                    <input type="text" maxLength={200} value={editedName} autoFocus onChange={(e) => setEditedName(e.target.value)} aria-label="Project name"
                      className="h-11 w-[min(420px,70vw)] rounded-xl border border-line bg-surface px-3 font-display text-2xl font-bold text-ink outline-hidden focus:border-brand-indigo dark:border-night-line dark:bg-night dark:text-night-ink" />
                    <IconButton label="Save name" onClick={handleSaveNameEdit}><Check className="h-4 w-4" /></IconButton>
                    <IconButton label="Cancel" onClick={() => setIsEditingName(false)}><X className="h-4 w-4" /></IconButton>
                  </form>
                ) : (
                  <>
                    <h1 className="font-display text-[28px] font-bold leading-[1.1] md:text-[34px]">{detail.name}</h1>
                    {isOwner && (
                      <IconButton label="Rename project" onClick={() => { setEditedName(detail.name); setIsEditingName(true); }}><Edit2 className="h-4 w-4" /></IconButton>
                    )}
                  </>
                )}
                <label className="relative">
                  <span className="sr-only">Project status</span>
                  <select value={detail.status} onChange={(e) => updateDetail({ status: e.target.value })} disabled={!canEdit} aria-label="Project status"
                    className={`appearance-none rounded-full px-2.5 py-1 font-sans text-xs font-semibold outline-hidden disabled:cursor-default ${canEdit ? 'cursor-pointer' : ''} ${STATUS_PILL[detail.status] || STATUS_PILL.Empty}`}>
                    {Object.keys(STATUS_PILL).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-x-[18px] gap-y-1 font-sans text-[13.5px] text-muted dark:text-night-muted">
                {detail.test_used && detail.test_used !== 'None' && <span>{detail.test_used}</span>}
                {(detail.samples > 0 || detail.variables > 0) && <span>{detail.samples} samples · {detail.variables} variables</span>}
                <span>Started {formatDate(detail.created_at)}</span>
                {!isOwner && <span>Shared by {detail.owner?.full_name || detail.owner?.email} · you are {detail.role === 'editor' ? 'an editor' : 'a viewer'}</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center">
                <Avatar name={detail.owner?.full_name} index={0} />
                {members.slice(0, 3).map((m, i) => (
                  <span key={m.id} className="-ml-[9px]"><Avatar name={m.full_name || m.email} index={i + 1} /></span>
                ))}
                {members.length > 3 && (
                  <span className="-ml-[9px] flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-dashed border-[#CBD5E1] bg-[#EEF0F5] font-sans text-xs font-semibold text-muted dark:border-night-line dark:bg-night-soft">+{members.length - 3}</span>
                )}
              </div>
              <button type="button" onClick={() => scrollTo('project-people')}
                className="flex h-10 items-center gap-2 rounded-[10px] border border-[#DDE1EA] bg-surface px-4 font-sans text-sm font-semibold hover:bg-soft dark:border-night-line dark:bg-night-surface dark:hover:bg-night-soft cursor-pointer">
                <ShareIcon className="h-4 w-4 text-ink-2 dark:text-night-muted" /> Share
              </button>
              <button type="button" onClick={() => { scrollTo('project-report'); document.getElementById('project-report-build')?.focus({ preventScroll: true }); }}
                className="flex h-10 items-center gap-2 rounded-[10px] bg-brand-indigo px-[18px] font-sans text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.6)] hover:bg-brand-violet cursor-pointer">
                <DocumentIcon className="h-4 w-4" /> Build Word report
              </button>
              {isOwner && (
                <IconButton label="Delete project" onClick={(e) => handleDelete(detail, e)} danger><Trash2 className="h-4 w-4" /></IconButton>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-7 px-4 pb-12 pt-[30px] md:px-12 xl:grid-cols-3">
          {errorBanner && <div className="xl:col-span-3">{errorBanner}</div>}

          {/* Research thread */}
          <section className="flex min-w-0 flex-col xl:col-span-2">
            <div className="flex items-baseline justify-between gap-4 pb-[18px]">
              <h2 className="font-display text-xl font-bold">From data to report</h2>
              <span className="hidden font-sans text-[13px] text-muted sm:block dark:text-night-muted">Everything in this project, in the order it was done</span>
            </div>

            <Stage number="1" title="Data" state={detail.datasets.length ? 'done' : 'pending'}
              action={canEdit && <TextLink onClick={() => fileInputRef.current?.click()} disabled={busy}>Upload</TextLink>}>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleDatasetUpload} />
              {detail.datasets.length === 0 ? (
                <p className="font-sans text-[13px] text-muted dark:text-night-muted">
                  {canEdit ? `No datasets yet. Upload a CSV or Excel file (up to ${storage ? formatBytes(storage.max_dataset_bytes) : '10 MB'}).` : 'No datasets in this project yet.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {detail.datasets.map(d => (
                    <div key={d.id} className={`${cardClass} flex flex-col gap-2 px-4 py-3.5`}>
                      <div className="flex items-center gap-2.5">
                        <DatabaseIcon className="h-[18px] w-[18px] shrink-0 text-brand-emerald" />
                        <span className="min-w-0 flex-1 truncate font-sans text-sm font-semibold" title={d.filename}>{d.filename}</span>
                        <IconButton label={`Download ${d.filename}`} onClick={() => handleDatasetDownload(d)} disabled={busy}><DownloadIcon className="h-4 w-4" /></IconButton>
                        {d.can_change !== false && (
                          <IconButton label={`Delete ${d.filename}`} onClick={() => handleDatasetDelete(d)} disabled={busy} danger><Trash2 className="h-4 w-4" /></IconButton>
                        )}
                      </div>
                      <span className="font-mono text-[11.5px] text-muted dark:text-night-muted">{d.n_rows} rows · {d.n_columns} columns · {formatBytes(d.size_bytes)}</span>
                      <span className="font-sans text-xs text-faint">Added by {who(d)} · {formatDate(d.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Stage>

            <Stage number="2" title="Cleaning" state={recipes.length ? 'done' : 'pending'}>
              {recipes.length === 0 ? (
                <p className="font-sans text-[13px] text-muted dark:text-night-muted">No cleaning recipes yet. Save one from Data preparation to clean new data the same way.</p>
              ) : recipes.map(recipe => (
                <div key={recipe.id} className={`${cardClass} flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center`}>
                  <Wand2 className="hidden h-[18px] w-[18px] shrink-0 text-brand-indigo md:block dark:text-brand-periwinkle" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-sans text-sm font-semibold" title={recipe.description || recipe.name}>{recipe.name}</span>
                    <span className="truncate font-sans text-[12.5px] text-muted dark:text-night-muted">
                      {(recipe.steps || []).map(stepName).join(' → ')}{shared ? ` · by ${who(recipe)}` : ''}
                    </span>
                  </div>
                  <span className="font-mono text-[11.5px] text-muted dark:text-night-muted">{recipe.step_count} step{recipe.step_count === 1 ? '' : 's'}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleRecipeOpen(recipe)} disabled={busy}
                      className="h-8 rounded-lg border border-[#DDE1EA] px-3 font-sans text-[13px] font-semibold hover:bg-soft dark:border-night-line dark:hover:bg-night-soft cursor-pointer">
                      Run on new data
                    </button>
                    <IconButton label="Download recipe file" onClick={() => handleRecipeDownload(recipe)} disabled={busy}><DownloadIcon className="h-4 w-4" /></IconButton>
                    {recipe.can_change !== false && (
                      <IconButton label={`Delete recipe ${recipe.name}`} onClick={() => handleRecipeDelete(recipe)} disabled={busy} danger><Trash2 className="h-4 w-4" /></IconButton>
                    )}
                  </div>
                </div>
              ))}
            </Stage>

            <Stage number="3" title="Analyses" state={detail.results.length ? 'current' : 'pending'}
              action={canEdit && <TextLink onClick={() => onOpenDashboard?.()}>New analysis</TextLink>}>
              {detail.results.length === 0 ? (
                <p className="font-sans text-[13px] text-muted dark:text-night-muted">No saved analyses yet. Run one and use Save to project.</p>
              ) : detail.results.map(r => {
                const summary = summaries[r.id];
                const latest = r.id === latestResultId;
                return (
                  <div key={r.id} className={`flex flex-col gap-4 rounded-[14px] border bg-surface p-4 md:flex-row md:items-center dark:bg-night-surface ${latest
                    ? 'border-[#C7CCF9] shadow-[0_10px_24px_-20px_rgba(79,70,229,0.6)] dark:border-brand-indigo/50'
                    : 'border-line dark:border-night-line'}`}>
                    <div className="hidden h-14 w-[92px] shrink-0 items-center justify-center md:flex">
                      {summary?.bars ? (
                        <MiniBars summary={summary} width={92} height={56} compact />
                      ) : (
                        <span className="flex h-14 w-[92px] items-center justify-center rounded-lg bg-soft font-mono text-[11px] font-semibold text-brand-indigo dark:bg-night-soft dark:text-brand-periwinkle">
                          {moduleName(r.module).slice(0, 12)}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-sans text-[14.5px] font-semibold">{r.title}</span>
                        {latest && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-orange" title="Most recent" />}
                      </div>
                      <span className="font-sans text-[13px] text-ink-2 dark:text-night-ink">
                        {summary
                          ? `${summary.headline} ${summary.stats.map(formatStat).slice(0, 2).join(', ')}.`
                          : `${moduleName(r.module)}${r.parameters?.dependent ? ` of ${r.parameters.dependent}` : ''}`}
                      </span>
                      <span className="font-sans text-xs text-faint">Saved by {who(r)} · {relativeTime(r.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {canReopen(r.module) && (
                        <button type="button" onClick={() => handleResultOpen(r)} disabled={busy}
                          className={`h-[34px] rounded-[9px] px-3.5 font-sans text-[13px] font-semibold cursor-pointer ${latest
                            ? 'bg-brand-navy text-white hover:bg-[#1E293B] dark:bg-night-ink dark:text-night'
                            : 'border border-[#DDE1EA] hover:bg-soft dark:border-night-line dark:hover:bg-night-soft'}`}>
                          Open
                        </button>
                      )}
                      <IconButton label="Download as JSON" onClick={() => handleResultDownload(r)} disabled={busy}><DownloadIcon className="h-4 w-4" /></IconButton>
                      {r.can_change !== false && (
                        <IconButton label={`Delete ${r.title}`} onClick={() => handleResultDelete(r)} disabled={busy} danger><Trash2 className="h-4 w-4" /></IconButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </Stage>

            <Stage number="4" title="Report" state="pending" last>
              <div id="project-report" className="scroll-mt-24">
                <ProjectReportPanel key={`${detail.id}-${detail.results.length}-${recipes.length}`} token={token} detail={detail} onError={setError} />
              </div>
            </Stage>
          </section>

          {/* Side */}
          <aside className="flex min-w-0 flex-col gap-5">
            <div className={`${cardClass} flex flex-col gap-3.5 p-[18px]`}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-base font-bold">Tasks</h3>
                <span className="font-mono text-xs text-muted dark:text-night-muted">{completedTasks} of {detail.tasks.length}</span>
              </div>
              {detail.tasks.length > 0 && (
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(detail.tasks.length, 12)}, minmax(0, 1fr))` }}>
                  {Array.from({ length: Math.min(detail.tasks.length, 12) }, (_, i) => (
                    <span key={i} className={`h-[5px] rounded-[3px] ${i < Math.round((completedTasks / detail.tasks.length) * Math.min(detail.tasks.length, 12)) ? 'bg-brand-emerald' : 'bg-line dark:bg-night-line'}`} />
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {detail.tasks.length === 0 && <p className="font-sans text-[13px] text-muted dark:text-night-muted">No tasks yet.</p>}
                {detail.tasks.map(t => (
                  <div key={t.id} className="group flex items-center gap-2.5">
                    <button type="button" onClick={() => handleToggleTask(t.id)} disabled={busy || !canEdit} role="checkbox" aria-checked={t.completed}
                      className="flex min-h-9 flex-1 items-center gap-2.5 text-left font-sans text-[13.5px] disabled:cursor-default cursor-pointer">
                      <svg className={`h-[18px] w-[18px] shrink-0 ${t.completed ? 'text-brand-emerald' : 'text-faint'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="5" />{t.completed && <path d="m8 12 3 3 5-6" />}
                      </svg>
                      <span className={t.completed ? 'text-faint line-through' : 'text-ink-2 dark:text-night-ink'}>{t.text}</span>
                    </button>
                    {canEdit && (
                      <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <IconButton label={`Delete task ${t.text}`} onClick={() => handleDeleteTask(t.id)} disabled={busy} danger><Trash2 className="h-3.5 w-3.5" /></IconButton>
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <form onSubmit={handleAddNewTask} className="flex gap-2">
                  <input type="text" maxLength={500} placeholder="Add a task" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} aria-label="New task" className={inputClass} />
                  <button type="submit" disabled={!taskInput.trim() || busy}
                    className="h-[38px] rounded-[9px] bg-brand-navy px-3.5 font-sans text-[13px] font-semibold text-white disabled:opacity-40 dark:bg-night-ink dark:text-night cursor-pointer">
                    Add
                  </button>
                </form>
              )}
            </div>

            <ProjectSharingPanel api={api} detail={detail} currentUserEmail={user.email} onChanged={() => reloadDetail(detail.id)} onLeft={closeProject} onError={setError} />

            {activity.length > 0 && (
              <div className={`${cardClass} flex flex-col gap-3 p-[18px]`}>
                <h3 className="font-display text-base font-bold">Recent activity</h3>
                {activity.map(item => (
                  <div key={item.key} className="flex gap-2.5 font-sans text-[13px] leading-[1.45]">
                    <span className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${item.tone}`} />
                    <span className="min-w-0 flex-1 text-ink-2 dark:text-night-ink">{item.text}</span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">{relativeTime(item.at)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`${cardClass} flex flex-col gap-3 p-[18px]`}>
              <h3 className="font-display text-base font-bold">Details</h3>
              <label className="flex flex-col gap-1 font-sans text-xs font-semibold text-muted dark:text-night-muted">
                Design or main test
                <input type="text" maxLength={200} value={meta.test_used} onChange={(e) => setMeta({ ...meta, test_used: e.target.value })} onBlur={() => handleMetaBlur('test_used')} readOnly={!canEdit} className={`${inputClass} font-normal`} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 font-sans text-xs font-semibold text-muted dark:text-night-muted">
                  Samples
                  <input type="number" min="0" value={meta.samples} onChange={(e) => setMeta({ ...meta, samples: parseInt(e.target.value, 10) || 0 })} onBlur={() => handleMetaBlur('samples')} readOnly={!canEdit} className={`${inputClass} font-mono font-normal`} />
                </label>
                <label className="flex flex-col gap-1 font-sans text-xs font-semibold text-muted dark:text-night-muted">
                  Variables
                  <input type="number" min="0" value={meta.variables} onChange={(e) => setMeta({ ...meta, variables: parseInt(e.target.value, 10) || 0 })} onBlur={() => handleMetaBlur('variables')} readOnly={!canEdit} className={`${inputClass} font-mono font-normal`} />
                </label>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // 3. PROJECT LIST
  const usedPct = storage ? Math.min(100, Math.round((storage.used_bytes / storage.limit_bytes) * 100)) : 0;
  const sorted = [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  return (
    <main className="flex flex-col gap-6 px-4 py-6 md:px-10 md:py-8 animate-fade-in">
      {errorBanner}
      <ProjectInvitations api={api} onError={setError} onAccepted={async (projectId) => { await refreshList(); await openProject(projectId); }} />
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] font-bold leading-[1.1] md:text-[36px]">Projects</h1>
          <p className="font-sans text-sm text-muted dark:text-night-muted">Each project keeps one study together: data, cleaning, analyses and the report.</p>
        </div>
        <div className="flex items-center gap-5">
          {storage && (
            <div className="hidden w-56 flex-col gap-1.5 sm:flex">
              <div className="flex justify-between font-sans text-[11.5px] text-muted dark:text-night-muted">
                <span>Storage</span><span className="font-mono">{formatBytes(storage.used_bytes)} / {formatBytes(storage.limit_bytes)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded bg-[#EEF0F4] dark:bg-night-soft">
                <div className={`h-full ${usedPct > 90 ? 'bg-rose-500' : 'bg-brand-indigo'}`} style={{ width: `${Math.max(usedPct, 1)}%` }} />
              </div>
            </div>
          )}
          <button onClick={() => setIsCreating(true)}
            className="flex h-[42px] items-center gap-2 whitespace-nowrap rounded-[11px] bg-brand-indigo px-[18px] font-sans text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.6)] hover:bg-brand-violet cursor-pointer">
            <PlusIcon className="h-4 w-4" /> New project
          </button>
        </div>
      </header>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-[#C7CCF9] bg-surface px-6 py-16 text-center dark:border-night-line dark:bg-night-surface">
          <FolderIcon className="h-10 w-10 text-faint" />
          <p className="font-display text-lg font-bold">No projects yet</p>
          <p className="max-w-sm font-sans text-sm text-muted dark:text-night-muted">Create a project to save datasets, analyses and a report for one study.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sorted.map((p) => {
            const sharedWithMe = p.role && p.role !== 'owner';
            const total = p.tasks.length;
            const completed = p.tasks.filter(t => t.completed).length;
            return (
              <div key={p.id} role="button" tabIndex={0} onClick={() => openProject(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') openProject(p.id); }}
                className={`${cardClass} group flex cursor-pointer flex-col gap-4 p-5 transition-shadow hover:border-[#C7CCF9] hover:shadow-[0_10px_24px_-18px_rgba(79,70,229,0.55)] dark:hover:border-brand-indigo/50`}>
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-display text-lg font-bold">{p.name}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 font-sans text-[11.5px] font-semibold ${STATUS_PILL[p.status] || STATUS_PILL.Empty}`}>{p.status}</span>
                    </div>
                    <span className="font-sans text-[13px] text-muted dark:text-night-muted">
                      {sharedWithMe
                        ? `Shared by ${p.owner?.full_name || p.owner?.email} · ${p.role === 'editor' ? 'Editor' : 'Viewer'}`
                        : p.member_count > 0 ? `Shared with ${p.member_count} ${p.member_count === 1 ? 'person' : 'people'}` : (p.test_used && p.test_used !== 'None' ? p.test_used : 'Only you')}
                    </span>
                  </div>
                  {(!p.role || p.role === 'owner') && (
                    <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton label={`Delete ${p.name}`} onClick={(e) => handleDelete(p, e)} danger><Trash2 className="h-4 w-4" /></IconButton>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-[12.5px] text-muted dark:text-night-muted">
                  <span className="flex items-center gap-1.5"><DatabaseIcon className="h-3.5 w-3.5 text-brand-emerald" />{p.dataset_count} {p.dataset_count === 1 ? 'dataset' : 'datasets'}</span>
                  <span className="flex items-center gap-1.5"><UploadIcon className="h-3.5 w-3.5 rotate-180 text-brand-indigo" />{p.result_count} {p.result_count === 1 ? 'analysis' : 'analyses'}</span>
                  {total > 0 && <span className="font-mono">{completed}/{total} tasks</span>}
                  <span className="ml-auto font-mono text-[11.5px] text-faint">{relativeTime(p.updated_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default Projects;
