import { formatP } from '../utils/reportApi';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-slate-700 focus:border-brand-indigo focus:outline-none';
const fmt = (value, digits = 3) => (value === null || value === undefined || Number.isNaN(value)
  ? '–' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }));

const Label = ({ children }) => <p className="mb-1 font-sans text-[13px] font-bold uppercase tracking-wide text-slate-400">{children}</p>;

const Chips = ({ options, value, onChange, max }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(name => {
      const on = value.includes(name);
      return (
        <button key={name} type="button"
          onClick={() => onChange(on ? value.filter(v => v !== name) : (max && value.length >= max ? [...value.slice(1), name] : [...value, name]))}
          className={`rounded-full border px-2.5 py-0.5 font-sans text-[14px] font-semibold cursor-pointer ${on ? 'border-brand-indigo bg-indigo-50 text-brand-indigo' : 'border-slate-200 bg-white text-slate-500'}`}>
          {name}
        </button>
      );
    })}
  </div>
);

const Section = ({ title, hint, enabled, onToggle, children }) => (
  <div className={`space-y-2 rounded-2xl border p-3 ${enabled ? 'border-indigo-100 bg-indigo-50/30' : 'border-slate-100'}`}>
    <label className="flex cursor-pointer items-start space-x-2">
      <input type="checkbox" className="mt-0.5" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
      <span>
        <span className="block font-display text-xs font-bold text-slate-800">{title}</span>
        <span className="block font-sans text-[13px] text-slate-500">{hint}</span>
      </span>
    </label>
    {enabled && <div className="space-y-2 pl-5">{children}</div>}
  </div>
);

/**
 * Choosing the analyses to repeat on every imputed dataset. `columns` describes the dataset (from the profile):
 * numeric columns for outcomes, category columns (no gaps) for groups and factors.
 */
export const PooledAnalysesForm = ({ numeric, categories, value, onChange }) => {
  const set = (key, patch) => onChange({ ...value, [key]: { ...value[key], ...patch } });
  const twoLevel = categories.filter(c => c.unique === 2).map(c => c.name);
  const factorNames = categories.map(c => c.name);
  const { groupComparison: g, correlation: c, anova: a } = value;

  return (
    <div className="space-y-2">
      <p className="font-display text-xs font-bold text-slate-800">Pooled analyses (optional)</p>
      <Section title="Two-group comparison" hint="Mean difference with a Welch standard error, pooled with Rubin's rules."
        enabled={g.enabled} onToggle={(on) => set('groupComparison', { enabled: on })}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Outcome</Label>
            <select className={inputClass} value={g.outcome} onChange={(e) => set('groupComparison', { outcome: e.target.value })}>
              <option value="">Choose…</option>
              {numeric.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <Label>Group (two levels)</Label>
            <select className={inputClass} value={g.group} onChange={(e) => set('groupComparison', { group: e.target.value })}>
              <option value="">Choose…</option>
              {twoLevel.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {twoLevel.length === 0 && <p className="font-sans text-[13px] text-amber-600">No complete category column has exactly two levels.</p>}
      </Section>

      <Section title="Correlations" hint="Every pair, pooled on Fisher's z scale."
        enabled={c.enabled} onToggle={(on) => set('correlation', { enabled: on })}>
        <Label>Variables</Label>
        <Chips options={numeric} value={c.variables} onChange={(variables) => set('correlation', { variables })} />
        <select className={inputClass} value={c.method} onChange={(e) => set('correlation', { method: e.target.value })}>
          <option value="pearson">Pearson</option>
          <option value="spearman">Spearman</option>
        </select>
      </Section>

      <Section title="ANOVA" hint="Each term tested with the pooled D1 Wald statistic; means compared pairwise with letters."
        enabled={a.enabled} onToggle={(on) => set('anova', { enabled: on })}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Response</Label>
            <select className={inputClass} value={a.response} onChange={(e) => set('anova', { response: e.target.value })}>
              <option value="">Choose…</option>
              {numeric.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <Label>Block / replication</Label>
            <select className={inputClass} value={a.block} onChange={(e) => set('anova', { block: e.target.value })}>
              <option value="">— none (CRD) —</option>
              {factorNames.filter(n => !a.factors.includes(n)).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <Label>Treatment factors (one or two)</Label>
        <Chips options={factorNames.filter(n => n !== a.block)} value={a.factors} max={2} onChange={(factors) => set('anova', { factors })} />
        {a.factors.length === 2 && (
          <label className="flex items-center space-x-2 font-sans text-[14px] text-slate-600">
            <input type="checkbox" checked={a.interaction} onChange={(e) => set('anova', { interaction: e.target.checked })} />
            <span>Include the interaction</span>
          </label>
        )}
        <select className={inputClass} value={a.comparison} onChange={(e) => set('anova', { comparison: e.target.value })}>
          <option value="bonferroni">Bonferroni-adjusted pairwise comparisons</option>
          <option value="lsd">Unadjusted pairwise comparisons (LSD)</option>
        </select>
        {factorNames.length === 0 && <p className="font-sans text-[13px] text-amber-600">No complete category column to use as a factor.</p>}
      </Section>
    </div>
  );
};


const Table = ({ title, columns, rows, note }) => (
  <div className="overflow-auto rounded-2xl border border-slate-100">
    <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 font-display text-xs font-bold text-slate-800">{title}</p>
    <table className="min-w-full whitespace-nowrap text-left font-sans text-[14px] text-slate-700">
      <thead><tr className="text-slate-500">{columns.map(h => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-slate-50">
            {row.map((cell, j) => <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'font-semibold text-slate-800' : 'font-mono'}`}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
    {note && <p className="border-t border-slate-100 px-3 py-1.5 font-sans text-[13px] text-slate-400">{note}</p>}
  </div>
);

const interval = (low, high, digits = 3) => `[${fmt(low, digits)}, ${fmt(high, digits)}]`;

export const PooledAnalysesResults = ({ outcome }) => {
  const g = outcome.group_comparison;
  const c = outcome.correlation;
  const a = outcome.anova;
  return (
    <>
      {g && (
        <Table
          title={`Pooled comparison of ${g.outcome} by ${g.group}`}
          columns={['Difference', 'Estimate', 'SE', '95% CI', 'df', 'p', 'FMI', "Cohen's d"]}
          rows={[[g.difference, fmt(g.estimate, 4), fmt(g.se, 4), interval(g.ci_low, g.ci_high), fmt(g.df, 1), formatP(g.p_value), fmt(g.fmi), fmt(g.cohens_d)]]}
          note={`Means: ${g.levels.map(level => `${level} ${fmt(g.means[level])}`).join(' · ')}. Welch standard errors; Cohen's d averaged over imputations.`}
        />
      )}
      {c && (
        <Table
          title={`Pooled ${c.method === 'spearman' ? 'Spearman' : 'Pearson'} correlations`}
          columns={['Variable 1', 'Variable 2', 'r', '95% CI', 'p', 'FMI']}
          rows={c.pairs.map(pair => [pair.x, pair.y, fmt(pair.r), interval(pair.ci_low, pair.ci_high), formatP(pair.p_value), fmt(pair.fmi)])}
          note="Pooled on Fisher's z scale and transformed back."
        />
      )}
      {a && (
        <>
          <Table
            title={`Pooled ANOVA of ${a.response} (n = ${a.n})`}
            columns={['Term', 'F', 'df1', 'df2', 'p', 'RIV']}
            rows={a.terms.map(t => [t.term, fmt(t.F), t.df1, fmt(t.df2, 1), formatP(t.p_value), fmt(t.riv)])}
            note={`D1 multivariate Wald tests with sum-to-zero contrasts; df2 is capped at the complete-data residual df (${a.df_residual}). RIV: relative increase in variance due to the missing data.`}
          />
          {Object.entries(a.comparisons).map(([factor, block]) => (
            <Table
              key={factor}
              title={`Pooled means of ${factor}`}
              columns={[factor, 'Mean', 'SE', '95% CI', 'Group']}
              rows={block.means.map(row => [row.level, fmt(row.mean, 4), fmt(row.se, 4), interval(row.ci_low, row.ci_high), row.group])}
              note={`Means sharing a letter do not differ at α = ${a.alpha} (${a.comparison_method === 'bonferroni' ? 'Bonferroni-adjusted' : 'unadjusted'} pooled t-tests).`}
            />
          ))}
        </>
      )}
    </>
  );
};
