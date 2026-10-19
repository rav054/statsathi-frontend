// Switches the SEM card between the visual canvas (PLS-SEM / CB-SEM) and the lavaan-syntax tool.
const MODES = [
  ['canvas', 'Visual Canvas (PLS / CB-SEM)'],
  ['syntax', 'Syntax Mode (lavaan-style)']
];

const SemModeSwitch = ({ mode, onChange }) => (
  <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 font-sans text-[14px] font-bold">
    {MODES.map(([id, label]) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        className={`rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
          mode === id ? 'bg-brand-indigo text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

export default SemModeSwitch;
