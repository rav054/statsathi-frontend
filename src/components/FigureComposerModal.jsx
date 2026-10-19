import { apiFetch } from '../utils/apiFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, AlertCircle, RefreshCw, Download, LayoutGrid, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useAuth, API_URL } from '../context/AuthContext';
import { saveBlob } from '../utils/workspaceApi';
import { PRESET_OPTIONS } from '../utils/figureStyle';

const MAX_PANELS = 12;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/tiff'];
const FORMATS = [['png', 'PNG'], ['tiff', 'TIFF (LZW)'], ['pdf', 'PDF'], ['svg', 'SVG'], ['eps', 'EPS'], ['jpeg', 'JPEG']];
const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs outline-hidden focus:border-brand-indigo';

let nextId = 1;

// Combine chart images into one labelled multi-panel figure for a journal or thesis
const FigureComposerModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const [panels, setPanels] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [columns, setColumns] = useState('');
  const [preset, setPreset] = useState('double_column');
  const [fit, setFit] = useState('row');
  const [spacing, setSpacing] = useState('3');
  const [labelStyle, setLabelStyle] = useState('lower_paren');
  const [labelPosition, setLabelPosition] = useState('outside');
  const [background, setBackground] = useState('white');
  const [figureCaption, setFigureCaption] = useState('');
  const [format, setFormat] = useState('png');
  const [dpi, setDpi] = useState('600');
  const [preview, setPreview] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).filter(f => ACCEPTED.includes(f.type) || /\.(png|jpe?g|tiff?)$/i.test(f.name));
    if (!incoming.length) {
      setError('Add PNG, JPEG or TIFF images. Every StatSathi chart can be downloaded as a PNG.');
      return;
    }
    setError(null);
    setPanels(current => {
      const room = MAX_PANELS - current.length;
      if (room <= 0) {
        setError(`A figure can hold at most ${MAX_PANELS} panels.`);
        return current;
      }
      const added = incoming.slice(0, room).map(file => ({ id: nextId++, file, url: URL.createObjectURL(file), label: '', caption: '' }));
      if (incoming.length > room) setError(`Only the first ${room} image${room === 1 ? '' : 's'} could be added (limit ${MAX_PANELS} panels).`);
      return [...current, ...added];
    });
  };

  const move = (index, step) => {
    setPanels(current => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const update = (id, field, value) => setPanels(current => current.map(p => (p.id === id ? { ...p, [field]: value } : p)));

  const remove = (id) => setPanels(current => {
    const panel = current.find(p => p.id === id);
    if (panel) URL.revokeObjectURL(panel.url);
    return current.filter(p => p.id !== id);
  });

  const formData = useCallback(() => {
    const body = new FormData();
    panels.forEach(panel => body.append('files', panel.file, panel.file.name));
    if (columns) body.append('columns', columns);
    body.append('preset', preset);
    body.append('fit', fit);
    body.append('spacing_mm', spacing || '0');
    body.append('label_style', labelStyle);
    body.append('label_position', labelPosition);
    body.append('background', background);
    body.append('labels_json', JSON.stringify(panels.map(p => p.label || '')));
    body.append('captions_json', JSON.stringify(panels.map(p => p.caption || '')));
    if (figureCaption) body.append('figure_caption', figureCaption);
    return body;
  }, [panels, columns, preset, fit, spacing, labelStyle, labelPosition, background, figureCaption]);

  // Redraw the preview a moment after the last change
  useEffect(() => {
    if (!isOpen || panels.length === 0) return undefined;  // nothing to draw; the preview below is hidden instead
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API_URL}/analyze/figure/compose`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not build the figure.');
        setPreview(data.image);
        setInfo(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [isOpen, panels, formData, token]);

  const download = async () => {
    setDownloading(true);
    try {
      const body = formData();
      body.append('download_format', format);
      body.append('dpi', dpi);
      const res = await apiFetch(`${API_URL}/analyze/figure/download`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not export the figure.');
      }
      saveBlob(await res.blob(), `statsathi_figure.${format === 'jpeg' ? 'jpg' : format}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleClose = () => {
    panels.forEach(panel => URL.revokeObjectURL(panel.url));
    setPanels([]);
    setPreview(null);
    setError(null);
    onClose();
  };

  const ready = panels.length > 0 && Boolean(preview);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-orange-50 p-2 text-brand-orange"><LayoutGrid className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Figure Composer</h3>
              <p className="font-sans text-xs text-slate-400">Combine charts into one labelled multi-panel figure at journal size.</p>
            </div>
          </div>
          <button data-dialog-close aria-label="Close" onClick={handleClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-start space-x-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-8 text-center transition-all ${
                  dragActive ? 'border-brand-indigo bg-indigo-50/30' : 'border-slate-300 hover:border-brand-indigo hover:bg-slate-50/50'
                }`}
              >
                <input type="file" ref={fileInputRef} accept=".png,.jpg,.jpeg,.tif,.tiff" multiple className="hidden"
                  onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"><Upload className="h-5 w-5 text-slate-400" /></div>
                <p className="font-sans text-sm font-semibold text-slate-700">Add chart images</p>
                <p className="mt-1 font-sans text-xs text-slate-400">Drop PNG, JPEG or TIFF files, or click to browse. Up to {MAX_PANELS} panels; download charts from any StatSathi module as PNG.</p>
              </div>

              {panels.length > 0 && (
                <div className="space-y-2">
                  {panels.map((panel, index) => (
                    <div key={panel.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs">
                      <img src={panel.url} alt={panel.file.name} className="h-16 w-20 shrink-0 rounded-lg border border-slate-100 object-contain bg-slate-50" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="truncate font-sans text-[11px] font-semibold text-slate-600">
                          <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500">{info?.panels?.[index]?.label || String.fromCharCode(97 + index)}</span>
                          {panel.file.name}
                        </p>
                        <input value={panel.caption} onChange={(e) => update(panel.id, 'caption', e.target.value)}
                          placeholder="Panel caption (optional)" className="w-full rounded-lg border border-slate-200 px-2 py-1 font-sans text-[11px] outline-hidden focus:border-brand-indigo" />
                        <input value={panel.label} onChange={(e) => update(panel.id, 'label', e.target.value)}
                          placeholder="Label override (optional)" className="w-full rounded-lg border border-slate-200 px-2 py-1 font-sans text-[11px] outline-hidden focus:border-brand-indigo" />
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => move(index, 1)} disabled={index === panels.length - 1} className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => remove(panel.id)} className="rounded-lg border border-slate-200 p-1 text-rose-500 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Panels per row</span>
                  <select value={columns} onChange={(e) => setColumns(e.target.value)} className={selectClass}>
                    <option value="">Automatic</option>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Panel fit</span>
                  <select value={fit} onChange={(e) => setFit(e.target.value)} className={selectClass}>
                    <option value="row">Fill each row (no gaps)</option>
                    <option value="width">Equal widths (aligned columns)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Figure width</span>
                  <select value={preset} onChange={(e) => setPreset(e.target.value)} className={selectClass}>
                    {PRESET_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Gap between panels: {spacing} mm</span>
                  <input type="range" min="0" max="10" step="0.5" value={spacing} onChange={(e) => setSpacing(e.target.value)}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-indigo" />
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Panel labels</span>
                  <select value={labelStyle} onChange={(e) => setLabelStyle(e.target.value)} className={selectClass}>
                    <option value="lower_paren">(a), (b), (c)</option>
                    <option value="lower">a, b, c</option>
                    <option value="upper_paren">(A), (B), (C)</option>
                    <option value="upper">A, B, C</option>
                    <option value="none">No labels</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Label position</span>
                  <select value={labelPosition} onChange={(e) => setLabelPosition(e.target.value)} className={selectClass}>
                    <option value="outside">Above the panel</option>
                    <option value="inside">Inside the panel</option>
                    <option value="none">Hidden</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Background</span>
                  <select value={background} onChange={(e) => setBackground(e.target.value)} className={selectClass}>
                    <option value="white">White</option>
                    <option value="transparent">Transparent</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-sans text-[11px] font-semibold text-slate-500">Export</span>
                  <div className="flex gap-2">
                    <select value={format} onChange={(e) => setFormat(e.target.value)} className={selectClass}>
                      {FORMATS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select value={dpi} onChange={(e) => setDpi(e.target.value)} className={selectClass}>
                      {[150, 300, 600, 1200].map(v => <option key={v} value={v}>{v} DPI</option>)}
                    </select>
                  </div>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-sans text-[11px] font-semibold text-slate-500">Figure caption (optional)</span>
                <textarea value={figureCaption} onChange={(e) => setFigureCaption(e.target.value)} rows={2}
                  placeholder="Figure 1. Effect of nitrogen levels on grain yield..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-sans text-xs outline-hidden focus:border-brand-indigo" />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {loading && <RefreshCw className="h-7 w-7 animate-spin text-brand-indigo" />}
                {!loading && ready && (
                  <img src={`data:image/png;base64,${preview}`} alt="Composed figure" className="max-h-[62vh] w-auto rounded-xl border border-slate-200/60 bg-white p-2" />
                )}
                {!loading && !ready && (
                  <p className="max-w-xs text-center font-sans text-xs text-slate-400">
                    The composed figure appears here as soon as you add images, and updates whenever you change an option.
                  </p>
                )}
              </div>
              {ready && info && (
                <div className="flex flex-wrap items-center gap-2 font-sans text-[11px]">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{info.rows} × {info.columns} panels</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{info.size_mm.width} × {info.size_mm.height} mm</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{info.preset.label}</span>
                </div>
              )}
              <button
                type="button"
                onClick={download}
                disabled={!ready || downloading}
                className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-brand-orange py-3 font-sans text-sm font-bold text-white shadow-md hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
              >
                {downloading ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Exporting...</span></> : <><Download className="h-4 w-4" /><span>Download figure</span></>}
              </button>
              <p className="font-sans text-[10px] leading-relaxed text-slate-400">
                The figure is built at the chosen physical width, so a double-column figure really is 180 mm wide. TIFF, PDF and EPS are the formats journals usually ask for; 600 DPI suits most submissions. Panels keep their own proportions, so nothing is stretched.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FigureComposerModal;
