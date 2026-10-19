import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { workspaceApi } from '../utils/workspaceApi';
import { ProjectDatasets } from './DatasetPicker';

/**
 * Choosing a dataset already stored in one of the user's projects, from the dashboard.
 *
 * The analysis screens get this through the shared dataset picker; the dashboard has its own upload buttons, so it
 * opens this small dialog instead. `onChosen(file, source)` receives the downloaded file ready to work on.
 */
const StoredDatasetModal = ({ isOpen, onClose, onChosen }) => {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const choose = async (dataset, projectName) => {
    setBusy(true);
    setError(null);
    try {
      const blob = await workspaceApi(token).downloadDataset(dataset.id);
      const stored = new File([blob], dataset.filename, { type: dataset.content_type || 'text/csv' });
      onChosen(stored, { kind: 'project', datasetId: dataset.id, projectId: dataset.project_id, projectName });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex w-full max-w-lg flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl font-sans">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-800">Use a saved dataset</h3>
            <p className="font-sans text-xs text-slate-400">
              Files you have stored in a project, ready to analyse without uploading them again.
            </p>
          </div>
          <button data-dialog-close aria-label="Close"
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-3 flex items-center space-x-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-sans text-xs font-medium">{error}</span>
            </div>
          )}
          <ProjectDatasets onChoose={choose} busy={busy} />
        </div>
      </div>
    </div>
  );
};

export default StoredDatasetModal;
