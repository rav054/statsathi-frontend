import { apiFetch } from '../utils/apiFetch';
import { useState, useEffect, useRef } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import DatasetPicker from './DatasetPicker';
import { useDataset } from '../hooks/useDataset';
import {
  X, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Sliders, Check, Zap, ChevronRight
} from 'lucide-react';

const TRANSFORM_METHODS = [
  {
    category: 'Variance Stabilizers & Skew Reduction',
    items: [
      { id: 'log10', label: 'Log10 Transformation', suffix: '_Log10', icon: 'log', desc: 'Compresses right-skewed positive data and normalizes variance.', recommendation: 'Best for strictly positive data (> 0) with heavy right skew.' },
      { id: 'ln', label: 'Natural Logarithm (Ln)', suffix: '_Ln', icon: 'ln', desc: 'Natural logarithm transformation for multiplicative growth.', recommendation: 'Best for positive data (> 0) with exponential trends.' },
      { id: 'sqrt', label: 'Square Root (√x)', suffix: '_Sqrt', icon: 'sqrt', desc: 'Mild transformation for count data or moderate right skew.', recommendation: 'Best for non-negative count data (≥ 0) like Poisson processes.' },
      { id: 'arcsine', label: 'Arcsine (Angular)', suffix: '_Arcsine', icon: 'asin', desc: 'Angular transformation for proportions (0-1) or percentages (0-100%).', recommendation: 'Best for binomial percentage/ratio data in agriculture & biology.' },
    ]
  },
  {
    category: 'Advanced Power Transformations',
    items: [
      { id: 'yeojohnson', label: 'Yeo-Johnson (Recommended)', suffix: '_YeoJohnson', icon: 'yj', desc: 'Power transform that supports zero and negative values.', recommendation: '★ Best all-around stabilizer when data contains negative or zero values.' },
      { id: 'boxcox', label: 'Box-Cox Transformation', suffix: '_BoxCox', icon: 'bc', desc: 'Optimal power transformation for strictly positive data.', recommendation: 'Best for optimizing normality when data is strictly positive (> 0).' },
    ]
  },
  {
    category: 'Feature Scaling & Normalization (ML)',
    items: [
      { id: 'zscore', label: 'Z-Score Standardization', suffix: '_ZScore', icon: 'z', desc: 'Rescales data to Mean = 0, Standard Deviation = 1.', recommendation: 'Ideal for PCA, Clustering, Regression & distance-based algorithms.' },
      { id: 'minmax', label: 'Min-Max Scaling [0, 1]', suffix: '_MinMax', icon: 'mm', desc: 'Scales feature values to a fixed range between 0 and 1.', recommendation: 'Ideal for Neural Networks & algorithms requiring bounded features.' },
    ]
  },
  {
    category: 'Spectral & Chemometric Preprocessing (Advanced Tier)',
    items: [
      { id: 'snv', label: 'Standard Normal Variate (SNV)', suffix: '_SNV', icon: 'snv', desc: 'Row-wise spectrum normalization removing scatter and slope effects.', recommendation: 'Essential for NIR/FTIR spectroscopy to correct multiplicative light scattering.' },
      { id: 'msc', label: 'Multiplicative Scatter Correction (MSC)', suffix: '_MSC', icon: 'msc', desc: 'Corrects scatter differences relative to mean reference spectrum.', recommendation: 'Standard in chemometrics for spectral baseline and scatter correction.' },
      { id: 'sg_smooth', label: 'Savitzky-Golay (SG) Smoothing', suffix: '_SGSmooth', icon: 'sgs', desc: 'Polynomial smoothing filter reducing noise while preserving peak shapes.', recommendation: 'Best for smoothing noisy high-resolution spectral curves or time-series.' },
      { id: 'sg_1der', label: 'SG First Derivative', suffix: '_SG1stDeriv', icon: 'sg1', desc: 'First-order derivative resolving overlapping peaks and baseline shifts.', recommendation: 'Removes constant baseline offsets and highlights spectral peak slopes.' },
      { id: 'sg_2der', label: 'SG Second Derivative', suffix: '_SG2ndDeriv', icon: 'sg2', desc: 'Second-order derivative accentuating narrow absorption bands.', recommendation: 'Removes linear baseline drift and separates overlapping spectral bands.' },
    ]
  }
];

const DataTransformModal = ({ isOpen, onClose, file: propFile, onSaveTransformedData }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [numericCols, setNumericCols] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('log10');
  const [error, setError] = useState(null);
  const [suggestedMethod, setSuggestedMethod] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  // Result of the last transformation, kept on screen so lambdas and before/after diagnostics can be reviewed
  const [transformResult, setTransformResult] = useState(null);

  const resetOutputs = () => {
    setSuggestedMethod(null);
    setSuccessMsg(null);
    setTransformResult(null);
    setError(null);
  };

  const dataset = useDataset({
    onLoaded: ({ numericColumns }) => {
      setNumericCols(numericColumns);
      setSelectedCols(numericColumns.slice(0, 1));
      resetOutputs();
    },
    onCleared: () => {
      setNumericCols([]);
      setSelectedCols([]);
      resetOutputs();
    },
  });
  const { file: activeFile, selectFile } = dataset;

  // The dashboard can hand this screen the dataset the user is already working on
  const handedOver = useRef(null);
  useEffect(() => {
    if (isOpen && propFile && handedOver.current !== propFile) {
      handedOver.current = propFile;
      selectFile(propFile);
    }
  }, [isOpen, propFile, selectFile]);

  const handleToggleColumn = (colName) => {
    setSelectedCols(prev =>
      prev.includes(colName)
        ? prev.filter(c => c !== colName)
        : [...prev, colName]
    );
  };

  const handleSelectAll = () => {
    if (selectedCols.length === numericCols.length) {
      setSelectedCols([]);
    } else {
      setSelectedCols([...numericCols]);
    }
  };

  const handleApplyTransformation = async () => {
    if (!activeFile) {
      setError('Please upload or select a dataset file first.');
      return;
    }
    if (selectedCols.length === 0) {
      setError('Please select at least one numeric column to transform.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuggestedMethod(null);
      setSuccessMsg(null);

      const formData = new FormData();
      formData.append('file', activeFile);
      formData.append('columns', JSON.stringify(selectedCols));
      formData.append('method', selectedMethod);

      const res = await apiFetch(`${API_URL}/analyze/transform`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        const detailMsg = data.detail || 'Transformation failed.';
        setError(detailMsg);
        if (detailMsg.toLowerCase().includes('yeo-johnson')) {
          setSuggestedMethod('yeojohnson');
        }
        return;
      }

      setSuccessMsg(data.message || 'Dataset transformed successfully!');

      // Create a updated File object from returned CSV
      if (data.csv_content && onSaveTransformedData) {
        const updatedBlob = new Blob([data.csv_content], { type: 'text/csv' });
        const fileNameToUse = activeFile?.name || propFile?.name || 'transformed_dataset.csv';
        const updatedFile = new File([updatedBlob], fileNameToUse, { type: 'text/csv' });

        // Keep the dialog open so the lambdas and before/after diagnostics can be reviewed first
        setTransformResult({
          lambdas: data.lambdas || {},
          diagnostics: data.diagnostics || {},
          notes: data.notes || [],
          apply: () => {
            onSaveTransformedData(updatedFile, data.records, data.transformed_columns);
            setTransformResult(null);
            onClose();
          }
        });
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during transformation.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Flatten methods to find active info card
  const activeMethodInfo = TRANSFORM_METHODS.flatMap(g => g.items).find(m => m.id === selectedMethod);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[640px] w-full max-w-3xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="rounded-2xl bg-brand-indigo/10 p-2.5 text-brand-indigo">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">
                Data Transformation & Scaling
              </h3>
              <p className="text-xs text-slate-400">
                Transform skewed variables, stabilize variances, or standardize features for modeling.
              </p>
            </div>
          </div>
          <button data-dialog-close aria-label="Close"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Alerts */}
          {(error || dataset.error) && (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-700 space-y-2 animate-fade-in">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error || dataset.error}</span>
              </div>
              {suggestedMethod === 'yeojohnson' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('yeojohnson');
                    setError(null);
                    setSuggestedMethod(null);
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-red-600 px-3 py-1.5 font-sans text-[14px] font-bold text-white shadow-xs hover:bg-red-700 transition-all cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Switch to Yeo-Johnson Transformation</span>
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center space-x-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-bold text-emerald-800 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Review before applying: lambdas, before/after shape diagnostics and notes */}
          {transformResult && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs space-y-3 animate-fade-in">
              <h4 className="font-display text-xs font-bold text-slate-700">Transformation Diagnostics</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold">
                      <th className="py-2 pr-3">Variable</th>
                      {Object.keys(transformResult.lambdas).length > 0 && <th className="py-2 text-right">λ</th>}
                      <th className="py-2 text-right">Skewness (before → after)</th>
                      <th className="py-2 text-right">Kurtosis (before → after)</th>
                      <th className="py-2 text-right">Shapiro-Wilk p (before → after)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(transformResult.diagnostics).map(([col, d]) => {
                      const fmt = (v, digits = 3) => (v === null || v === undefined ? 'n/a' : v.toFixed(digits));
                      const fmtP = (v) => (v === null || v === undefined ? 'n/a' : v < 0.001 ? '< 0.001' : v.toFixed(4));
                      return (
                        <tr key={col} className="border-b border-slate-50 text-slate-700">
                          <td className="py-2 pr-3 font-semibold">{col}</td>
                          {Object.keys(transformResult.lambdas).length > 0 && (
                            <td className="py-2 text-right font-mono">{fmt(transformResult.lambdas[col], 4)}</td>
                          )}
                          <td className="py-2 text-right font-mono">{fmt(d.before.skewness)} → {fmt(d.after.skewness)}</td>
                          <td className="py-2 text-right font-mono">{fmt(d.before.kurtosis)} → {fmt(d.after.kurtosis)}</td>
                          <td className="py-2 text-right font-mono">{fmtP(d.before.shapiro_p)} → {fmtP(d.after.shapiro_p)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {transformResult.notes.length > 0 && (
                <ul className="list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50 py-2 pl-6 pr-3 text-[14px] text-amber-800">
                  {transformResult.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                </ul>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={transformResult.apply}
                  className="rounded-xl bg-brand-indigo px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Use Transformed Data
                </button>
              </div>
            </div>
          )}

          <DatasetPicker
            dataset={dataset}
            title="Select or drop a dataset to transform"
            hint="Any table with the numeric variables you want to rescale or stabilize (CSV or Excel)."
          />

          {/* Step 1: Select Column(s) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <span>1. Select Variable(s) to Transform</span>
                <span className="text-[13px] text-slate-400 font-normal">({selectedCols.length} selected)</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-brand-indigo hover:text-indigo-700 transition-colors cursor-pointer"
              >
                {selectedCols.length === numericCols.length ? 'Deselect All' : 'Select All Numeric'}
              </button>
            </div>

            {(loading || dataset.loading) ? (
              <div className="flex items-center space-x-2 text-xs text-slate-400 py-3">
                <RefreshCw className="h-4 w-4 animate-spin text-brand-indigo" />
                <span>Loading numeric columns...</span>
              </div>
            ) : numericCols.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                No numeric columns detected in the active dataset.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {numericCols.map((col) => {
                  const isSelected = selectedCols.includes(col);
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleToggleColumn(col)}
                      className={`inline-flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 font-sans text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-brand-indigo bg-brand-indigo/10 text-brand-indigo shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className={`h-3.5 w-3.5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected ? 'border-brand-indigo bg-brand-indigo text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                      <span>{col}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Transformation Method */}
          <div className="space-y-3">
            <label className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Select Transformation Method
            </label>

            <div className="space-y-4">
              {TRANSFORM_METHODS.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h4 className="text-[14px] font-bold text-slate-400 uppercase tracking-wider">
                    {group.category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.items.map((method) => {
                      const isSelected = selectedMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedMethod(method.id)}
                          className={`flex items-start justify-between rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-brand-indigo bg-brand-indigo/5 ring-2 ring-brand-indigo/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <span className={`font-sans text-xs font-bold ${isSelected ? 'text-brand-indigo' : 'text-slate-800'}`}>
                                {method.label}
                              </span>
                              <span className="font-mono text-[12px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                {method.suffix}
                              </span>
                            </div>
                            <p className="text-[14px] text-slate-500 leading-snug">
                              {method.desc}
                            </p>
                          </div>
                          <div className={`h-4 w-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                            isSelected ? 'border-brand-indigo bg-brand-indigo text-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Method Recommendation Helper Card */}
          {activeMethodInfo && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-slate-50 p-4 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-brand-indigo">
                <Sparkles className="h-4 w-4 text-brand-indigo" />
                <span>Statistical Recommendation</span>
              </div>
              <p className="text-slate-600 leading-relaxed font-sans">
                {activeMethodInfo.recommendation}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyTransformation}
            disabled={loading || dataset.loading || selectedCols.length === 0}
            className="flex items-center space-x-2 rounded-2xl bg-brand-indigo px-6 py-2.5 font-sans text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Transforming...</span>
              </>
            ) : (
              <>
                <span>Apply Transformation</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default DataTransformModal;
