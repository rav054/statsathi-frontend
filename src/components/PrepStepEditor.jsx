import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, AlertCircle } from 'lucide-react';
import {
  STEP_CATALOG, FORMULA_EXAMPLES, FORMULA_FUNCTIONS, formulaName, visibleFields, stepProblem,
} from '../utils/prepSteps';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-slate-700 focus:border-brand-indigo focus:outline-none';

const ColumnChips = ({ options, value = [], onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.length === 0 && <span className="font-sans text-[11px] text-slate-400">No columns yet.</span>}
    {options.map(name => {
      const on = value.includes(name);
      return (
        <button
          key={name}
          type="button"
          onClick={() => onChange(on ? value.filter(v => v !== name) : [...value, name])}
          className={`rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-semibold transition-colors cursor-pointer ${
            on ? 'border-brand-indigo bg-indigo-50 text-brand-indigo' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
          }`}
        >
          {name}
        </button>
      );
    })}
  </div>
);

// Old → new pairs, for renaming columns or recoding the values of one column
const MappingEditor = ({ keys, value = {}, onChange }) => (
  <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
    {keys.length === 0 && <span className="font-sans text-[11px] text-slate-400">Pick a column first.</span>}
    {keys.map(key => (
      <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="truncate font-mono text-[11px] text-slate-600" title={key}>{key}</span>
        <span className="font-sans text-[11px] text-slate-400">→</span>
        <input
          className={inputClass}
          value={value[key] ?? ''}
          placeholder="unchanged"
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      </div>
    ))}
  </div>
);

// A formula box with column and function shortcuts, and a check against the real data
const FormulaEditor = ({ value = '', columns, onChange, onCheck }) => {
  const boxRef = useRef(null);
  const [check, setCheck] = useState(null); // { ok, message } or { ok, sample, missing, rows }
  const [checking, setChecking] = useState(false);

  // Put text at the cursor rather than at the end
  const insert = (text) => {
    const box = boxRef.current;
    const start = box ? box.selectionStart : value.length;
    const end = box ? box.selectionEnd : value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    setCheck(null);
    requestAnimationFrame(() => {
      if (!box) return;
      box.focus();
      box.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      setCheck(await onCheck(value));
    } catch (err) {
      setCheck({ ok: false, message: err.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <textarea
        ref={boxRef}
        rows={2}
        spellCheck={false}
        className={`${inputClass} font-mono`}
        value={value}
        placeholder="[Plot yield (kg)] / [Plot area (m2)] * 10000"
        onChange={(e) => { onChange(e.target.value); setCheck(null); }}
      />
      <div className="flex flex-wrap gap-1">
        {columns.map(name => (
          <button key={name} type="button" onClick={() => insert(formulaName(name))}
            className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:border-brand-indigo cursor-pointer">
            {name}
          </button>
        ))}
      </div>
      <select
        className={inputClass}
        value=""
        onChange={(e) => { if (e.target.value) insert(`${e.target.value}(`); }}
      >
        <option value="">Insert a function…</option>
        {FORMULA_FUNCTIONS.map(fn => <option key={fn} value={fn}>{fn}( )</option>)}
      </select>
      <details className="font-sans text-[10px] text-slate-500">
        <summary className="cursor-pointer text-slate-400">Examples</summary>
        <ul className="mt-1 space-y-0.5">
          {FORMULA_EXAMPLES.map(([example, meaning]) => (
            <li key={example}><code className="font-mono text-slate-700">{example}</code> - {meaning}</li>
          ))}
        </ul>
      </details>
      <div className="flex items-start gap-2">
        <button type="button" onClick={runCheck} disabled={!value.trim() || checking}
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-sans text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer">
          {checking ? 'Checking…' : 'Check'}
        </button>
        {check && (check.ok ? (
          <p className="font-sans text-[11px] text-emerald-700">
            First values: {check.sample.map(v => (v === null ? '—' : Number.isFinite(v) ? Number(v.toFixed(4)) : String(v))).join(', ')}
            {check.missing ? ` · ${check.missing} of ${check.rows} rows have no value` : ''}
          </p>
        ) : (
          <p className="font-sans text-[11px] text-rose-600">{check.message}</p>
        ))}
      </div>
    </div>
  );
};

/**
 * One step of a cleaning recipe, edited in place.
 * `columns` are the names available to this step (after the steps before it); `valuesOf(column)` lists a
 * column's common values for recoding.
 */
const PrepStepEditor = ({ step, index, total, columns, valuesOf, mergeFile, onMergeFile, onCheckFormula, onChange, onMove, onRemove }) => {
  const spec = STEP_CATALOG[step.type];
  const problem = stepProblem(step, { hasMergeFile: Boolean(mergeFile) });
  const set = (key, value) => onChange({ ...step, [key]: value });

  const renderField = (field) => {
    const value = step[field.key];
    switch (field.type) {
      case 'columns':
        return <ColumnChips options={columns} value={value} onChange={(v) => set(field.key, v)} />;
      case 'column':
        return (
          <select className={inputClass} value={value || ''} onChange={(e) => set(field.key, e.target.value)}>
            <option value="">{field.optional ? '— none —' : 'Choose a column'}</option>
            {columns.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        );
      case 'select':
        return (
          <select className={inputClass} value={value} onChange={(e) => set(field.key, e.target.value)}>
            {field.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        );
      case 'number':
        return (
          <input type="number" className={inputClass} value={value ?? ''} min={field.min} max={field.max} step={field.step}
            onChange={(e) => set(field.key, e.target.value)} />
        );
      case 'text':
      case 'list':
        return (
          <input className={inputClass} value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
            onChange={(e) => set(field.key, e.target.value)} />
        );
      case 'boolean':
        return (
          <label className="flex items-center space-x-2 font-sans text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(field.key, e.target.checked)} />
            <span>{field.label}</span>
          </label>
        );
      case 'mapping': {
        const keys = field.source === 'columns' ? columns : valuesOf(step.column);
        return <MappingEditor keys={keys} value={value} onChange={(v) => set(field.key, v)} />;
      }
      case 'formula':
        return <FormulaEditor value={value} columns={columns} onChange={(v) => set(field.key, v)} onCheck={onCheckFormula} />;
      case 'file':
        return (
          <div className="flex items-center gap-2">
            <input type="file" accept=".csv,.xlsx,.xls" className="font-sans text-[11px] text-slate-600"
              onChange={(e) => onMergeFile(e.target.files?.[0] || null)} />
            {mergeFile && <span className="truncate font-sans text-[11px] text-slate-500">{mergeFile.name}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-2xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center space-x-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-sans text-[10px] font-bold text-brand-indigo">{index + 1}</span>
          <span className="truncate font-display text-xs font-bold text-slate-800">{spec.label}</span>
        </div>
        <div className="flex shrink-0 items-center space-x-0.5">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"
            className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"
            className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onRemove} title="Remove step"
            className="rounded p-1 text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="space-y-2">
        {visibleFields(step).map((field, i) => (
          <div key={`${field.key}-${i}`}>
            {field.type !== 'boolean' && (
              <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wide text-slate-400">{field.label}</p>
            )}
            {renderField(field)}
          </div>
        ))}
      </div>

      {problem && (
        <p className="mt-2 flex items-center space-x-1 font-sans text-[11px] text-amber-600">
          <AlertCircle className="h-3 w-3" /><span>{problem}</span>
        </p>
      )}
    </div>
  );
};

export default PrepStepEditor;
