import React, { useState, useRef } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { Calculator, BarChart3, Binary, Compass, Cpu, GitCompare, Info, Lock, Milestone, Upload, Grid, Layers, Network, TrendingUp, RefreshCw } from 'lucide-react';
import DatasetViewerModal from './DatasetViewerModal';
import CorrelationModal from './CorrelationModal';
import ParametricModal from './ParametricModal';
import NonParametricModal from './NonParametricModal';
import AnovaModal from './AnovaModal';
import PlotsModal from './PlotsModal';
import PcaModal from './PcaModal';
import LayoutGeneratorModal from './LayoutGeneratorModal';
import DescriptiveModal from './DescriptiveModal';
import ClusteringModal from './ClusteringModal';
import RegressionModal from './RegressionModal';

const Dashboard = ({ onAuthClick }) => {
  const { user } = useAuth();
  const [descriptiveOpen, setDescriptiveOpen] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  const [parametricOpen, setParametricOpen] = useState(false);
  const [nonParametricOpen, setNonParametricOpen] = useState(false);
  const [anovaOpen, setAnovaOpen] = useState(false);
  const [plotsOpen, setPlotsOpen] = useState(false);
  const [pcaOpen, setPcaOpen] = useState(false);
  const [layoutGeneratorOpen, setLayoutGeneratorOpen] = useState(false);
  const [clusteringOpen, setClusteringOpen] = useState(false);
  const [regressionOpen, setRegressionOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState('');
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState(null);
  const excelInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const handleSaveEditedData = async (editedFile) => {
    setFile(editedFile);
    
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', editedFile);
    
    try {
      const res = await fetch(`${API_URL}/analyze/upload-edited-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to upload edited data.');
      }
      console.log('Edited data uploaded successfully:', data);
    } catch (err) {
      console.error('Error saving edited data:', err);
    }
  };

  const handleExcelToCsvClick = () => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    if (excelInputRef.current) {
      excelInputRef.current.click();
    }
  };

  const handleExcelFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setConverting(true);
    setConversionError(null);

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_URL}/analyze/excel-to-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to convert Excel to CSV.');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const originalName = selectedFile.name;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      link.download = `${baseName}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      setConversionError(err.message || 'An error occurred during conversion.');
    } finally {
      setConverting(false);
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
    }
  };

  const modules = [
    {
      id: 'descriptive',
      title: 'Descriptive Statistics',
      description: 'Explore core summary statistics, coefficient of variation, shape, outliers, missing values, and data distribution.',
      buttonText: 'Run Descriptive Stats',
      icon: Calculator,
    },
    {
      id: 'correlation',
      title: 'Correlation',
      description: 'Explore relationships between variables. Pearson, Spearman, Matrix Heatmaps.',
      buttonText: 'Analyze Correlation',
      icon: GitCompare,
    },
    {
      id: 'parametric',
      title: 'Parametric Tests',
      description: 'Compare groups with normal data. t-Test, Paired t-Test, Z-Test.',
      buttonText: 'Run Parametric Tests',
      icon: Binary,
    },
    {
      id: 'nonparametric',
      title: 'Non-Parametric Tests',
      description: 'Analyze data that doesn\'t follow normal distribution. Mann-Whitney U, Wilcoxon, Kruskal-Wallis.',
      buttonText: 'Run Non-Parametric Tests',
      icon: Cpu,
    },
    {
      id: 'anova',
      title: 'ANOVA',
      description: 'Analysis of Variance. One-Way and Two-Way ANOVA, Duncan DMRT, Post-Hoc Analysis.',
      buttonText: 'Run ANOVA',
      icon: Milestone,
    },
    {
      id: 'pca',
      title: 'PCA Analysis',
      description: 'Principal Component Analysis. Obtain eigenvalues, eigenvectors, load matrices, scores, and biplots.',
      buttonText: 'Run PCA Analysis',
      icon: Layers,
    },
    {
      id: 'plots',
      title: 'Plots (Visualization)',
      description: 'Generate publication-ready charts. Box Plots, Histograms, QQ-Plots, PCA Biplots.',
      buttonText: 'Generate Plots',
      icon: BarChart3,
    },
    {
      id: 'layout',
      title: 'Field Layout Generator',
      description: 'Design crop field experiment grids (CRD, RBD, LSD, Split-plot, Sub-sub plot) with bunds and channels.',
      buttonText: 'Generate Field Layout',
      icon: Grid,
    },
    {
      id: 'clustering',
      title: 'Clustering & Risk Zoning',
      description: 'Perform standard scaling, hierarchical clustering with Ward\'s method, and K-Means. View interactive dendrograms and PCA biplot overlays.',
      buttonText: 'Run Clustering',
      icon: Compass,
    },
    {
      id: 'regression',
      title: 'Regression Analysis',
      description: 'Perform Simple Linear Regression, Multiple Linear Regression, or Partial Least Squares Regression (PLSR) on your datasets.',
      buttonText: 'Run Regression',
      icon: TrendingUp,
    },
  ];

  const handleAction = (moduleId) => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }

    if (moduleId === 'descriptive') {
      setDescriptiveOpen(true);
    } else if (moduleId === 'correlation') {
      setCorrOpen(true);
    } else if (moduleId === 'parametric') {
      setParametricOpen(true);
    } else if (moduleId === 'nonparametric') {
      setNonParametricOpen(true);
    } else if (moduleId === 'anova') {
      setAnovaOpen(true);
    } else if (moduleId === 'plots') {
      setPlotsOpen(true);
    } else if (moduleId === 'pca') {
      setPcaOpen(true);
    } else if (moduleId === 'layout') {
      setLayoutGeneratorOpen(true);
    } else if (moduleId === 'clustering') {
      setClusteringOpen(true);
    } else if (moduleId === 'regression') {
      setRegressionOpen(true);
    } else {
      setSelectedModule(modules.find(m => m.id === moduleId)?.title || '');
      setComingSoonOpen(true);
    }
  };

  const handleGlobalUpload = () => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    if (csvInputRef.current) {
      csvInputRef.current.click();
    }
  };

  const handleCsvFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext !== 'csv') {
      alert("Please upload a valid CSV file. (Excel files can be converted to CSV using the Excel to CSV converter next to this button).");
      return;
    }

    setFile(selectedFile);
    setViewerOpen(true);
  };

  return (
    <div className="flex-1 p-8 animate-fade-in">
      {/* Top Welcome / Upload Row */}
      <div className="flex flex-col justify-between items-start md:flex-row md:items-center border-b border-slate-200/50 pb-6 mb-8 gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-800 tracking-tight">
            Welcome to Stat Sathi.
          </h1>
          <p className="font-sans text-sm text-slate-500 mt-1">
            Select a statistical module below to begin your analysis.
          </p>
        </div>

        {/* Sunset Orange Add CSV & Convert Buttons */}
        <div className="flex flex-col items-end space-y-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGlobalUpload}
              className="flex items-center space-x-2 rounded-2xl bg-brand-orange px-6 py-3.5 font-display text-sm font-bold text-white shadow-md shadow-orange-100 hover:bg-orange-600 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-brand-orange/20 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Upload className="h-4.5 w-4.5" />
              <span>Add your CSV file</span>
            </button>

            <button
              onClick={handleExcelToCsvClick}
              disabled={converting}
              className="flex items-center space-x-2 rounded-2xl border border-brand-orange text-brand-orange bg-white px-6 py-3.5 font-display text-sm font-bold shadow-xs hover:bg-orange-50 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              {converting ? (
                <div className="h-4.5 w-4.5 animate-spin rounded-full border border-brand-orange border-t-transparent" />
              ) : (
                <RefreshCw className="h-4.5 w-4.5" />
              )}
              <span>Excel to CSV convert</span>
            </button>
            <input
              type="file"
              ref={excelInputRef}
              onChange={handleExcelFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <input
              type="file"
              ref={csvInputRef}
              onChange={handleCsvFileChange}
              accept=".csv"
              className="hidden"
            />
          </div>
          {conversionError && (
            <p className="font-sans text-[11px] text-red-500 font-medium">
              {conversionError}
            </p>
          )}
        </div>
      </div>

      {/* Modules CSS Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <div 
              key={m.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-md shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
            >
              <div>
                {/* Icon Placeholder at top */}
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo">
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <h3 className="font-display text-base font-bold text-slate-800">
                  {m.title}
                </h3>
                <p className="font-sans text-xs text-slate-400 mt-2 leading-relaxed min-h-[40px]">
                  {m.description}
                </p>
              </div>

              {/* Full-width Indigo Button at bottom */}
              <button
                onClick={() => handleAction(m.id)}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-indigo py-3 font-sans text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-all active:scale-[0.99] cursor-pointer"
              >
                {m.buttonText}
              </button>
            </div>
          );
        })}
      </div>

      {/* Guest Authentication Prompt Modal */}
      {authPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-brand-indigo mb-4 mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-center font-display text-base font-bold text-slate-800">
              Authentication Required
            </h3>
            <p className="text-center font-sans text-xs text-slate-400 mt-2 leading-relaxed px-2">
              Please log in or register an account to upload datasets and run statistical analysis modules.
            </p>
            <div className="mt-6 flex flex-col space-y-2">
              <button
                onClick={() => {
                  setAuthPromptOpen(false);
                  onAuthClick();
                }}
                className="w-full rounded-xl bg-brand-indigo py-3 font-sans text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                Log In / Sign Up
              </button>
              <button
                onClick={() => setAuthPromptOpen(false)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module Curation Coming Soon Modal */}
      {comingSoonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-brand-orange mb-4 mx-auto">
              <Info className="h-6 w-6" />
            </div>
            <h3 className="text-center font-display text-base font-bold text-slate-800">
              {selectedModule} Curation
            </h3>
            <p className="text-center font-sans text-xs text-slate-400 mt-2 leading-relaxed px-4">
              The <strong className="text-slate-600">{selectedModule}</strong> mathematical module is currently under development. Ravi, PhD Scholar at ICAR-IISS, is compiling academic metrics to ensure perfect compatibility with peer-reviewed scientific journals.
            </p>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <h4 className="font-display text-xs font-bold text-slate-600 mb-1">Coming Next:</h4>
              <ul className="list-disc list-inside font-sans text-[10px] text-slate-400 space-y-1">
                <li>Automated normality checking (Shapiro-Wilk)</li>
                <li>Post-hoc test selection matching ANOVA F-results</li>
                <li>Full SVG chart exports for publication</li>
              </ul>
            </div>
            <button
              onClick={() => setComingSoonOpen(false)}
              className="mt-6 w-full rounded-xl bg-brand-indigo py-3 font-sans text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Descriptive Statistics Modal */}
      <DescriptiveModal
        isOpen={descriptiveOpen}
        onClose={() => setDescriptiveOpen(false)}
      />

      {/* Core Correlation Analysis Modal */}
      <CorrelationModal
        isOpen={corrOpen}
        onClose={() => setCorrOpen(false)}
      />

      {/* Parametric Hypothesis Testing Modal */}
      <ParametricModal
        isOpen={parametricOpen}
        onClose={() => setParametricOpen(false)}
      />

      {/* Non-Parametric Hypothesis Testing Modal */}
      <NonParametricModal
        isOpen={nonParametricOpen}
        onClose={() => setNonParametricOpen(false)}
      />

      {/* ANOVA Hypothesis Testing Modal */}
      <AnovaModal
        isOpen={anovaOpen}
        onClose={() => setAnovaOpen(false)}
      />

      {/* PCA Analysis Modal */}
      <PcaModal
        isOpen={pcaOpen}
        onClose={() => setPcaOpen(false)}
      />

      {/* Plots Visualization Modal */}
      <PlotsModal
        isOpen={plotsOpen}
        onClose={() => setPlotsOpen(false)}
      />

      {/* Field Layout Generator Modal */}
      <LayoutGeneratorModal
        isOpen={layoutGeneratorOpen}
        onClose={() => setLayoutGeneratorOpen(false)}
      />

      {/* Clustering Analysis Modal */}
      <ClusteringModal
        isOpen={clusteringOpen}
        onClose={() => setClusteringOpen(false)}
      />

      {/* Regression Analysis Modal */}
      <RegressionModal
        isOpen={regressionOpen}
        onClose={() => setRegressionOpen(false)}
      />

      <DatasetViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        file={file}
        onSave={handleSaveEditedData}
      />
    </div>
  );
};

export default Dashboard;

