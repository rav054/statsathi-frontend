import { PRESET_OPTIONS } from '../utils/figureStyle';

// Export size picker: screen, journal column widths, thesis page or poster
const FigurePresetSelect = ({ value, onChange, className = '' }) => (
  <label className={`flex items-center space-x-1.5 ${className}`} title="Figure width, font sizes and default DPI for the exported file">
    <span className="font-sans text-[9px] font-bold uppercase text-slate-400 shrink-0">Size:</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-[11px] text-slate-600 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all cursor-pointer"
    >
      {PRESET_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
    </select>
  </label>
);

export default FigurePresetSelect;
