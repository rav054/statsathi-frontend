import { apiFetch } from '../utils/apiFetch';
import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import { useAuth, API_URL } from './AuthContext';
import { useSharedDataset } from './SharedDatasetContext';
import DatasetViewerModal from '../components/DatasetViewerModal';
import StoredDatasetModal from '../components/StoredDatasetModal';
import { takeAnalysisHandoff } from '../utils/analysisHandoff';

// Each analysis module is loaded on first use, so the app does not download every module (and Plotly) up front.
const MODULES = {
  descriptive: lazy(() => import('../components/DescriptiveModal')),
  correlation: lazy(() => import('../components/CorrelationModal')),
  parametric: lazy(() => import('../components/ParametricModal')),
  nonparametric: lazy(() => import('../components/NonParametricModal')),
  anova: lazy(() => import('../components/AnovaModal')),
  plots: lazy(() => import('../components/PlotsModal')),
  pca: lazy(() => import('../components/PcaModal')),
  layout: lazy(() => import('../components/LayoutGeneratorModal')),
  clustering: lazy(() => import('../components/ClusteringModal')),
  regression: lazy(() => import('../components/RegressionModal')),
  trend: lazy(() => import('../components/TrendModal')),
  gxe: lazy(() => import('../components/GxeModal')),
  divergence: lazy(() => import('../components/DivergenceModal')),
  timeseries: lazy(() => import('../components/TimeSeriesModal')),
  composer: lazy(() => import('../components/FigureComposerModal')),
  transform: lazy(() => import('../components/DataTransformModal')),
  prep: lazy(() => import('../components/DataPrepModal')),
};
const SemModal = lazy(() => import('../components/SemModal'));
const SemDemoApp = lazy(() => import('../components/SemDemoApp'));

// Modules that can reopen a saved analysis
const REOPENS = new Set(['descriptive', 'correlation', 'parametric', 'nonparametric', 'anova', 'pca', 'clustering',
  'regression', 'trend', 'gxe', 'divergence', 'timeseries']);

// Mounts a module the first time it is opened and keeps it mounted afterwards, so closing and reopening keeps its
// state. Modules position themselves against the viewport, so they render outside the page.
const LazyModal = ({ open, children }) => {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return mounted ? createPortal(<Suspense fallback={null}>{children}</Suspense>, document.body) : null;
};

const ModuleHostContext = createContext(null);

export const useModuleHost = () => {
  const context = useContext(ModuleHostContext);
  if (!context) throw new Error('useModuleHost must be used inside ModuleHostProvider');
  return context;
};

/**
 * Owns every analysis module, the dataset shared between them and the dataset viewer, so that any part of the app
 * (the navigation rail, Home, the search) can open a tool.
 */
export const ModuleHostProvider = ({ children, onNavigate, onSignIn }) => {
  const { user } = useAuth();
  const { shared, setShared } = useSharedDataset();
  const file = shared?.file || null;
  const [open, setOpen] = useState({});
  const [reopened, setReopened] = useState(null);
  // Bumped for every handed-over analysis, so a module that is already mounted starts again with it
  const [reopenSeq, setReopenSeq] = useState(0);
  const [semMode, setSemMode] = useState('canvas');
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storedOpen, setStoredOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [datasetError, setDatasetError] = useState(null);
  const excelInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const close = useCallback((id) => setOpen(prev => ({ ...prev, [id]: false })), []);

  // A file chosen here has not been read yet; the first module to use it reads its columns
  const setFile = useCallback((nextFile, source = { kind: 'upload' }) => {
    setShared(nextFile ? { file: nextFile, source, columns: null, numericColumns: [] } : null);
  }, [setShared]);

  const requireUser = useCallback(() => {
    if (user) return true;
    setAuthPromptOpen(true);
    return false;
  }, [user]);

  const openTool = useCallback((id) => {
    if (id === 'report') {
      onNavigate?.('projects');
      return;
    }
    if (!requireUser()) return;
    if (id === 'excel') {
      excelInputRef.current?.click();
      return;
    }
    setReopened(null);
    setOpen(prev => ({ ...prev, [id]: true }));
  }, [onNavigate, requireUser]);

  // A saved analysis handed over from the Projects page opens in its module
  const openHandoff = useCallback(() => {
    const handoff = takeAnalysisHandoff();
    if (!handoff) return;
    if (!REOPENS.has(handoff.module) && handoff.module !== 'prep' && handoff.module !== 'sem') return;
    setReopened(handoff);
    setReopenSeq(n => n + 1);
    if (handoff.module === 'sem') setSemMode('canvas');
    setOpen(prev => ({ ...prev, [handoff.module]: true }));
  }, []);

  const chooseUpload = useCallback(() => {
    if (requireUser()) csvInputRef.current?.click();
  }, [requireUser]);

  const acceptFile = useCallback((selected) => {
    if (!selected) return;
    setDatasetError(null);
    const ext = selected.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      setDatasetError('Excel files need converting first: use Excel to CSV under Prepare, then add the CSV.');
      return;
    }
    if (ext !== 'csv') {
      setDatasetError('Please choose a CSV file.');
      return;
    }
    setFile(selected);
    setViewerOpen(true);
  }, [setFile]);

  const saveEditedData = useCallback(async (editedFile) => {
    setFile(editedFile);
    const formData = new FormData();
    formData.append('file', editedFile);
    try {
      const res = await apiFetch(`${API_URL}/analyze/upload-edited-data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to upload edited data.');
    } catch (err) {
      console.error('Error saving edited data:', err);
    }
  }, [setFile]);

  const convertExcel = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setConverting(true);
    setDatasetError(null);
    const formData = new FormData();
    formData.append('file', selected);
    try {
      const res = await apiFetch(`${API_URL}/analyze/excel-to-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to convert Excel to CSV.');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selected.name.replace(/\.[^.]+$/, '')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDatasetError(err.message || 'The Excel file could not be converted.');
    } finally {
      setConverting(false);
    }
  };

  const value = useMemo(() => ({
    openTool,
    openHandoff,
    file,
    source: shared?.source || null,
    chooseUpload,
    acceptFile,
    openStored: () => requireUser() && setStoredOpen(true),
    openViewer: () => setViewerOpen(true),
    removeFile: () => setFile(null),
    converting,
    datasetError,
  }), [openTool, openHandoff, file, shared, chooseUpload, acceptFile, requireUser, setFile, converting, datasetError]);

  const initial = (id) => (reopened?.module === id ? reopened : null);
  const Module = (id, props = {}) => {
    const Component = MODULES[id];
    return (
      <LazyModal key={id} open={!!open[id]}>
        <Component key={reopened?.module === id ? reopenSeq : 0} isOpen={!!open[id]} onClose={() => close(id)}
          {...(REOPENS.has(id) ? { initialAnalysis: initial(id) } : {})} {...props} />
      </LazyModal>
    );
  };

  return (
    <ModuleHostContext.Provider value={value}>
      {children}

      <input type="file" ref={csvInputRef} accept=".csv" className="hidden" onChange={(e) => { acceptFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input type="file" ref={excelInputRef} accept=".xlsx,.xls" className="hidden" onChange={convertExcel} />

      {['descriptive', 'correlation', 'parametric', 'nonparametric', 'anova', 'plots', 'pca', 'layout', 'clustering',
        'regression', 'trend', 'gxe', 'divergence', 'timeseries', 'composer'].map(id => Module(id))}
      {Module('prep', { initialRecipe: reopened?.module === 'prep' ? reopened.recipe || null : null })}
      {Module('transform', {
        file,
        onSaveTransformedData: (updated) => { saveEditedData(updated); setViewerOpen(true); },
      })}

      {/* SEM: visual PLS-SEM / CB-SEM canvas, or lavaan-style syntax tool (switchable in either header) */}
      <LazyModal open={!!open.sem && semMode === 'canvas'}>
        <SemModal key={reopened?.module === 'sem' ? reopenSeq : 0} isOpen={!!open.sem && semMode === 'canvas'} onClose={() => close('sem')} onModeChange={setSemMode} initialAnalysis={initial('sem')} />
      </LazyModal>
      <LazyModal open={!!open.sem && semMode === 'syntax'}>
        <SemDemoApp isOpen={!!open.sem && semMode === 'syntax'} onClose={() => close('sem')} initialFile={file} onModeChange={setSemMode} />
      </LazyModal>

      <StoredDatasetModal isOpen={storedOpen} onClose={() => setStoredOpen(false)} onChosen={(stored, source) => setFile(stored, source)} />
      <DatasetViewerModal isOpen={viewerOpen} onClose={() => setViewerOpen(false)} file={file} onSave={saveEditedData} />

      {authPromptOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-center font-display text-lg font-bold text-ink">Sign in to continue</h3>
            <p className="mt-2 px-2 text-center font-sans text-sm leading-relaxed text-muted">
              Log in or create a free account to upload data and run analyses. Your projects are saved to your account.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" onClick={() => { setAuthPromptOpen(false); onSignIn?.(); }}
                className="h-11 w-full rounded-xl bg-brand-indigo font-sans text-sm font-semibold text-white hover:bg-brand-violet cursor-pointer">
                Log in or sign up
              </button>
              <button type="button" data-dialog-close onClick={() => setAuthPromptOpen(false)}
                className="h-11 w-full rounded-xl border border-line bg-surface font-sans text-sm font-medium text-ink-2 hover:bg-soft cursor-pointer">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </ModuleHostContext.Provider>
  );
};
