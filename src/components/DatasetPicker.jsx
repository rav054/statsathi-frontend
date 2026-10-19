import { useEffect, useRef, useState } from 'react';
import { Upload, RefreshCw, Eye, FolderOpen, Database, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { workspaceApi } from '../utils/workspaceApi';

const formatBytes = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Datasets already stored in the user's projects, so a file does not have to be uploaded again
export const ProjectDatasets = ({ onChoose, busy }) => {
  const { token } = useAuth();
  const [projects, setProjects] = useState(null);
  const [openProject, setOpenProject] = useState(null);
  const [details, setDetails] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    workspaceApi(token).listProjects()
      .then(list => active && setProjects(list))
      .catch(err => active && setError(err.message));
    return () => { active = false; };
  }, [token]);

  const toggle = async (project) => {
    const next = openProject === project.id ? null : project.id;
    setOpenProject(next);
    if (next && !details[project.id]) {
      try {
        const full = await workspaceApi(token).getProject(project.id);
        setDetails(current => ({ ...current, [project.id]: full }));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (error) return <p className="py-6 text-center font-sans text-xs text-rose-600">{error}</p>;
  if (!projects) return <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-brand-indigo" /></div>;
  if (projects.length === 0) {
    return <p className="py-6 text-center font-sans text-xs text-slate-400">No projects yet. Upload a file here, then save it to a project from the Projects page to reuse it later.</p>;
  }

  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto">
      {projects.map(project => {
        const detail = details[project.id];
        const expanded = openProject === project.id;
        return (
          <div key={project.id} className="rounded-xl border border-slate-100">
            <button
              type="button"
              onClick={() => toggle(project)}
              className="flex w-full items-center justify-between px-3 py-2 text-left cursor-pointer hover:bg-slate-50"
            >
              <span className="flex items-center space-x-2 font-sans text-xs font-semibold text-slate-700">
                {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                <FolderOpen className="h-3.5 w-3.5 text-brand-orange" />
                <span>{project.name}</span>
              </span>
              <span className="font-sans text-[10px] text-slate-400">{project.dataset_count} dataset{project.dataset_count === 1 ? '' : 's'}</span>
            </button>
            {expanded && (
              <div className="border-t border-slate-100 px-3 py-2 space-y-1">
                {!detail && <div className="flex justify-center py-2"><RefreshCw className="h-4 w-4 animate-spin text-brand-indigo" /></div>}
                {detail && detail.datasets.length === 0 && (
                  <p className="py-1 font-sans text-[11px] text-slate-400">This project has no datasets yet.</p>
                )}
                {detail?.datasets.map(dataset => (
                  <button
                    key={dataset.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onChoose(dataset, project.name)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-indigo-50/60 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="flex min-w-0 items-center space-x-2">
                      <Database className="h-3.5 w-3.5 shrink-0 text-brand-indigo" />
                      <span className="truncate font-sans text-[11px] font-semibold text-slate-700">{dataset.filename}</span>
                    </span>
                    <span className="shrink-0 font-sans text-[10px] text-slate-400">
                      {dataset.n_rows} × {dataset.n_columns} · {formatBytes(dataset.size_bytes)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Choosing the dataset for an analysis: upload a file, or pick one already stored in a project.
 * `dataset` is the value returned by the useDataset hook.
 */
const DatasetPicker = ({ dataset, title, hint, onViewData, onChange }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('upload');
  const [dragActive, setDragActive] = useState(false);

  const choose = async (file) => {
    const loaded = await dataset.selectFile(file);
    if (loaded) onChange?.(loaded);
  };

  const chooseStored = async (stored, projectName) => {
    const loaded = await dataset.selectProjectDataset(stored, projectName);
    if (loaded) onChange?.(loaded);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) choose(e.dataTransfer.files[0]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  if (dataset.loading && !dataset.file) {
    return <div className="flex items-center justify-center py-16"><RefreshCw className="h-8 w-8 animate-spin text-brand-indigo" /></div>;
  }

  if (dataset.file) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="min-w-0">
          <p className="font-sans text-[10px] font-bold uppercase text-slate-400">Selected dataset</p>
          <p className="truncate font-sans text-sm font-semibold text-slate-700">{dataset.file.name}</p>
          <p className="font-sans text-[10px] text-slate-400">
            {dataset.source?.kind === 'project' ? `From project: ${dataset.source.projectName}` : 'Uploaded from this device'}
            {dataset.columns.length > 0 ? ` · ${dataset.columns.length} columns` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {onViewData && (
            <button type="button" onClick={onViewData} className="flex items-center space-x-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Eye className="h-3.5 w-3.5 text-brand-orange" /><span>View Data</span>
            </button>
          )}
          <button type="button" onClick={() => dataset.clear({ forget: true })} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
            Choose Other Dataset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {user && (
        <div className="flex space-x-1 rounded-xl bg-slate-100 p-1">
          {[['upload', 'Upload a file'], ['project', 'From my projects']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-1.5 font-sans text-xs font-bold transition-colors cursor-pointer ${
                tab === id ? 'bg-white text-brand-indigo shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(tab === 'upload' || !user) ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all ${
            dragActive ? 'border-brand-indigo bg-indigo-50/30' : 'border-slate-300 hover:border-brand-indigo hover:bg-slate-50/50'
          }`}
        >
          <input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) choose(e.target.files[0]); e.target.value = ''; }} />
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100"><Upload className="h-6 w-6 text-slate-400" /></div>
          <p className="font-sans text-sm font-semibold text-slate-700">{title || 'Select or drop a dataset'}</p>
          <p className="mt-1 max-w-xl font-sans text-xs text-slate-400">{hint || 'CSV or Excel (.xlsx, .xls).'}</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 p-3">
          <ProjectDatasets onChoose={chooseStored} busy={dataset.loading} />
          <p className="mt-2 font-sans text-[10px] text-slate-400">
            Datasets you have saved to a project, ready to analyse without uploading them again.
          </p>
        </div>
      )}
    </div>
  );
};

export default DatasetPicker;
