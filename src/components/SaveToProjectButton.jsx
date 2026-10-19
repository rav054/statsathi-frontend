import { useMemo, useState } from 'react';
import { FolderPlus, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { workspaceApi, projectLabel, writableProjects } from '../utils/workspaceApi';
import { reportContent } from '../utils/reportContent';

// Saves the current analysis (its settings and the API result) into one of the user's projects.
const SaveToProjectButton = ({ module, defaultTitle, parameters = {}, result, source = null, report = null, className = '' }) => {
  const { user, token } = useAuth();
  const api = useMemo(() => workspaceApi(token), [token]);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }
  const [saving, setSaving] = useState(false);

  if (!user || !result) return null;

  const openDialog = async () => {
    setOpen(true);
    setMessage(null);
    setTitle(defaultTitle);
    try {
      const list = writableProjects(await api.listProjects());
      setProjects(list);
      setProjectId(list.length > 0 ? String(list[0].id) : '');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const save = async () => {
    if (!projectId || !title.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      // Link the stored dataset when the analysis used one from this same project, so it can be re-run later
      const datasetId = source?.kind === 'project' && source.projectId === Number(projectId) ? source.datasetId : undefined;
      await api.saveResult(Number(projectId), { module, title: title.trim(), parameters, result, dataset_id: datasetId, report: reportContent(report) });
      setMessage({ type: 'ok', text: 'Saved to project.' });
      setTimeout(() => setOpen(false), 1000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openDialog())}
        className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <FolderPlus className="h-4 w-4 text-brand-indigo" />
        <span>Save to Project</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-xl space-y-3">
          <div className="space-y-1">
            <label className="font-sans text-[10px] font-bold uppercase text-slate-400">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-sans text-xs text-slate-700"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-sans text-[10px] font-bold uppercase text-slate-400">Title</label>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-sans text-xs text-slate-700"
            />
          </div>
          {message && (
            <p className={`flex items-center space-x-1 font-sans text-[11px] ${message.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {message.type === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              <span>{message.text}</span>
            </p>
          )}
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 font-sans text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !projectId || !title.trim()}
              className="rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaveToProjectButton;
