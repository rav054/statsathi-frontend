import { apiFetch } from '../utils/apiFetch';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { API_URL } from '../context/AuthContext';
import { saveBlob } from '../utils/workspaceApi';

// Other ways to draw an analysis result. "Classic" is the chart returned with the analysis; the other
// styles are drawn on request by /analyze/result-chart from the same dataset.
//   options: [{ value, label, hint, fields }]   fields: form fields for the request (merged over `fields`)
//   initialImages: charts already returned by the analysis ({ value: base64 PNG }); these are not requested again
const ResultChartPanel = ({ token, file, classicPlot, options, fields = {}, initialImages = {}, filenameBase = 'statsathi_chart', onImageChange }) => {
  const [chart, setChart] = useState('classic');
  const [images, setImages] = useState(initialImages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const current = chart === 'classic' ? classicPlot : images[chart];
  const selected = options.find(o => o.value === chart);

  const selectChart = async (value) => {
    // A result reopened from a project has no dataset behind it until the user loads one
    if (!file && value !== 'classic') return;
    setChart(value);
    setError(null);
    if (value === 'classic' || images[value]) {
      onImageChange?.(value === 'classic' ? classicPlot : images[value]);
      return;
    }
    const option = options.find(o => o.value === value);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chart', value);
    Object.entries({ ...fields, ...(option?.fields || {}) }).forEach(([key, v]) => {
      if (v === undefined || v === null || v === '') return;
      formData.append(key, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/analyze/result-chart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not draw this chart.');
      setImages(prev => ({ ...prev, [value]: data.plot }));
      onImageChange?.(data.plot);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!current) return;
    const blob = await (await apiFetch(`data:image/png;base64,${current}`)).blob();
    saveBlob(blob, `${filenameBase}_${chart}.png`);
  };

  return (
    <div className="flex flex-col items-center bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-inner space-y-3">
      {options.length > 1 && !file && (
        <p className="font-sans text-[14px] text-slate-400">
          Other chart styles are drawn from the dataset - load it to switch styles.
        </p>
      )}

      {options.length > 1 && file && (
        <div className="w-full space-y-1.5">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="font-sans text-[13px] font-bold uppercase text-slate-400 mr-1">Chart style:</span>
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectChart(option.value)}
                className={`rounded-full border px-3 py-1 font-sans text-[14px] font-semibold transition-colors cursor-pointer ${
                  chart === option.value
                    ? 'border-brand-indigo bg-brand-indigo text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-indigo hover:text-brand-indigo'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {selected?.hint && <p className="text-center font-sans text-[14px] text-slate-400">{selected.hint}</p>}
        </div>
      )}

      {error && <p className="font-sans text-xs text-rose-600">{error}</p>}
      {loading ? (
        <div className="flex h-[280px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-indigo border-t-transparent"></div>
        </div>
      ) : current && (
        <img
          src={`data:image/png;base64,${current}`}
          alt={selected?.label || 'Result chart'}
          className="max-h-[360px] w-auto object-contain rounded-2xl border border-slate-200/50 bg-white p-2 shadow-sm"
        />
      )}

      {current && !loading && (
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center space-x-1.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-sans text-xs font-bold px-4 py-2 transition-colors shadow-sm cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>Download chart (PNG)</span>
        </button>
      )}
    </div>
  );
};

export default ResultChartPanel;
