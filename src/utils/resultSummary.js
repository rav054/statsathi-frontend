// A plain-language headline and the key numbers of a saved result, for Home's "Continue where you left off"
// and the project page. Only modules whose result shape is known get a finding; the rest show their title.

const formatP = (p) => (p < 0.001 ? '< 0.001' : p.toFixed(3));
const formatNumber = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '');

const naturalOrder = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const anovaSummary = (result, parameters) => {
  const table = result?.anova_table;
  const descriptives = result?.descriptives;
  if (!table || !Number.isFinite(table.f_statistic) || !descriptives) return null;
  const response = parameters?.dependent || 'the response';
  const factor = parameters?.factor_a || 'Treatment';
  const letters = result.posthoc_letters || {};
  const groups = Object.keys(descriptives).sort(naturalOrder).map(name => ({
    name,
    mean: descriptives[name].mean,
    se: descriptives[name].se,
    letter: letters[name] || '',
  }));
  const significant = table.significant ?? table.p_value < 0.05;
  const best = [...groups].sort((a, b) => b.mean - a.mean)[0];
  const topLetters = best?.letter ? new Set(best.letter.split('')) : null;
  const topGroup = topLetters ? groups.filter(g => g.letter.split('').some(l => topLetters.has(l))) : [];

  let detail;
  if (!significant) {
    detail = `The groups did not differ significantly in ${response}.`;
  } else if (topGroup.length > 1) {
    detail = `${topGroup.map(g => g.name).join(', ')} share the top group.`;
  } else if (best) {
    detail = `${best.name} had the highest mean (${formatNumber(best.mean, 2)}).`;
  }

  return {
    headline: significant
      ? `${factor} had a significant effect on ${response}.`
      : `${factor} had no significant effect on ${response}.`,
    detail,
    significant,
    stats: [
      { label: `F(${table.df_between}, ${table.df_within})`, value: formatNumber(table.f_statistic, 1) },
      { label: 'p', value: formatP(table.p_value), highlight: significant },
      ...(Number.isFinite(result.cv) ? [{ label: 'CV', value: `${formatNumber(result.cv, 1)}%` }] : []),
    ],
    bars: groups.length >= 2 && groups.length <= 12 ? groups : null,
    topGroup: new Set(topGroup.map(g => g.name)),
  };
};

const NO_GROUP = new Set();

// Cramer's V and the rank-biserial family all run 0-1, so one wording covers them
const effectWord = (value) => {
  const size = Math.abs(value);
  if (!Number.isFinite(size)) return '';
  if (size < 0.1) return 'a negligible';
  if (size < 0.3) return 'a small';
  if (size < 0.5) return 'a moderate';
  return 'a strong';
};

const barsFrom = (entries) => {
  const bars = entries
    .filter(([, value]) => Number.isFinite(value))
    .sort(([a], [b]) => naturalOrder(a, b))
    .map(([name, value]) => ({ name, mean: value, letter: '' }));
  return bars.length >= 2 && bars.length <= 12 ? bars : null;
};

const chiSquareSummary = (stats, parameters) => {
  const table = stats.contingency_table;
  const [first, second] = parameters?.variables || [];
  const rows = table?.index || [];
  const columns = table?.columns || [];
  const significant = stats.significant ?? stats.p_value < 0.05;
  const v = stats.effect_size;

  // The counts themselves are the finding here, so the card stacks each row category by column
  // category: a bar is a group's size and its segments are what the test actually compares.
  const stack = rows.length >= 2 && rows.length <= 10 && columns.length >= 2 && columns.length <= 6
    ? { categories: rows.map(String), series: columns.map(String), values: table.values }
    : null;

  const pair = first && second ? `${first} and ${second}` : 'the two variables';
  return {
    headline: significant ? `${pair} are associated.` : `No association between ${pair}.`,
    detail: significant && Number.isFinite(v)
      ? `Cramer's V of ${formatNumber(v, 2)} is ${effectWord(v)} association.`
      : stats.notes?.[0] || 'The counts are close to what independence would predict.',
    significant,
    stats: [
      { label: `X2(${stats.degrees_of_freedom})`, value: formatNumber(stats.statistic, 1) },
      { label: 'p', value: formatP(stats.p_value), highlight: significant },
      ...(Number.isFinite(v) ? [{ label: "Cramer's V", value: formatNumber(v, 2) }] : []),
      ...(Number.isFinite(stats.n) ? [{ label: 'n', value: String(stats.n) }] : []),
    ],
    bars: null,
    stack,
    chartLabel: first && second ? `${first} by ${second}` : 'Observed counts',
    topGroup: NO_GROUP,
    warning: stats.notes?.[0] || null,
  };
};

const nonparametricSummary = (result, parameters) => {
  const stats = result?.statistics;
  if (!stats || !Number.isFinite(stats.p_value)) return null;
  if (stats.contingency_table) return chiSquareSummary(stats, parameters);

  const significant = stats.significant ?? stats.p_value < 0.05;
  const variables = parameters?.variables || [];
  // Two-group tests report each median on its own key; the many-group ones report a medians object
  const medians = stats.medians
    ? Object.entries(stats.medians)
    : [[variables[0] || 'Group 1', stats.median_group1], [variables[1] || 'Group 2', stats.median_group2]];
  const bars = barsFrom(medians);
  const compared = bars ? bars.map(b => b.name).join(' and ') : 'the groups';
  const highest = bars ? [...bars].sort((a, b) => b.mean - a.mean)[0] : null;

  return {
    headline: significant
      ? `${stats.test_name || 'The test'} found a significant difference.`
      : `${stats.test_name || 'The test'} found no significant difference.`,
    detail: significant && highest
      ? `${highest.name} had the highest median (${formatNumber(highest.mean, 2)}).`
      : `Medians for ${compared} are close enough to be explained by chance.`,
    significant,
    stats: [
      { label: 'Statistic', value: formatNumber(stats.statistic, 1) },
      { label: 'p', value: formatP(stats.p_value), highlight: significant },
      ...(Number.isFinite(stats.effect_size)
        ? [{ label: stats.effect_size_name || 'Effect', value: formatNumber(stats.effect_size, 2) }] : []),
    ],
    bars,
    chartLabel: 'Group medians',
    topGroup: NO_GROUP,
  };
};

const parametricSummary = (result, parameters) => {
  const stats = result?.statistics;
  const p = stats?.p_value;
  if (!stats || !Number.isFinite(p)) return null;
  const significant = stats.significant ?? p < 0.05;
  const [first, second] = parameters?.variables || [];
  const bars = barsFrom([
    [first || 'Group 1', stats.mean_group1],
    [second || 'Group 2', stats.mean_group2],
  ]);
  const d = stats.cohens_d;

  return {
    headline: significant
      ? `${first || 'Group 1'} and ${second || 'Group 2'} differ significantly.`
      : `${first || 'Group 1'} and ${second || 'Group 2'} do not differ significantly.`,
    detail: Number.isFinite(stats.mean_difference)
      ? `The means differ by ${formatNumber(Math.abs(stats.mean_difference), 2)}${Number.isFinite(d) ? `, ${effectWord(d)} effect` : ''}.`
      : undefined,
    significant,
    stats: [
      ...(Number.isFinite(stats.t_statistic)
        ? [{ label: `t(${formatNumber(stats.degrees_of_freedom, 0)})`, value: formatNumber(stats.t_statistic, 2) }] : []),
      { label: 'p', value: formatP(p), highlight: significant },
      ...(Number.isFinite(d) ? [{ label: "Cohen's d", value: formatNumber(d, 2) }] : []),
    ],
    bars,
    chartLabel: 'Group means',
    topGroup: NO_GROUP,
  };
};

const regressionSummary = (result) => {
  if (!Number.isFinite(result?.r2)) return null;
  const significant = Number.isFinite(result.f_pvalue) && result.f_pvalue < 0.05;
  const share = Math.round(result.r2 * 100);
  const terms = (result.coefficients || []).filter(c => c.name && c.name.toLowerCase() !== 'intercept');
  const strongest = terms.filter(c => Number.isFinite(c.p_value)).sort((a, b) => a.p_value - b.p_value)[0];

  return {
    headline: significant
      ? `The model explains ${share}% of the variation.`
      : 'The model does not fit significantly better than the mean.',
    detail: strongest && strongest.p_value < 0.05
      ? `${strongest.name} is the strongest predictor.`
      : undefined,
    significant,
    stats: [
      { label: 'R2', value: formatNumber(result.r2, 3) },
      ...(Number.isFinite(result.adj_r2) ? [{ label: 'adj R2', value: formatNumber(result.adj_r2, 3) }] : []),
      ...(Number.isFinite(result.f_pvalue) ? [{ label: 'p', value: formatP(result.f_pvalue), highlight: significant }] : []),
    ],
    bars: null,
    topGroup: NO_GROUP,
  };
};

const correlationSummary = (result) => {
  const matrix = result?.matrix;
  const values = matrix?.values;
  if (!Array.isArray(values) || values.length < 2) return null;

  // The strongest pair off the diagonal is the headline; the matrix itself is too big for the card
  let best = null;
  for (let row = 0; row < values.length; row += 1) {
    for (let col = row + 1; col < values[row].length; col += 1) {
      const r = values[row][col];
      if (!Number.isFinite(r)) continue;
      if (!best || Math.abs(r) > Math.abs(best.r)) {
        best = { r, a: String(matrix.index[row]), b: String(matrix.columns[col]) };
      }
    }
  }
  if (!best) return null;

  return {
    headline: `${best.a} and ${best.b} are the most strongly related pair.`,
    detail: `They correlate ${best.r < 0 ? 'negatively' : 'positively'} (r = ${formatNumber(best.r, 2)}), ${effectWord(best.r)} relationship.`,
    significant: Math.abs(best.r) >= 0.5,
    stats: [
      { label: 'r', value: formatNumber(best.r, 2), highlight: Math.abs(best.r) >= 0.5 },
      { label: 'Method', value: result.method || 'pearson' },
      { label: 'Variables', value: String(values.length) },
    ],
    bars: null,
    topGroup: NO_GROUP,
  };
};

// "F(4, 12) = 33.8", "p < 0.001", "CV = 6.4%"
export const formatStat = (stat) => (String(stat.value).startsWith('<') ? `${stat.label} ${stat.value}` : `${stat.label} = ${stat.value}`);

const SUMMARISERS = {
  anova: anovaSummary,
  nonparametric: nonparametricSummary,
  parametric: parametricSummary,
  regression: regressionSummary,
  correlation: correlationSummary,
};

export const summariseResult = (module, result, parameters) => {
  try {
    return SUMMARISERS[module]?.(result, parameters) || null;
  } catch {
    // an unexpected shape just means no summary
    return null;
  }
};

const MODULE_NAMES = {
  anova: 'ANOVA', descriptive: 'Descriptive statistics', correlation: 'Correlation', parametric: 'Parametric test',
  nonparametric: 'Non-parametric test', regression: 'Regression', trend: 'Trend analysis', timeseries: 'Time series',
  gxe: 'G×E analysis', divergence: 'Genetic divergence', pca: 'PCA', clustering: 'Clustering', sem: 'SEM',
  imputation: 'Multiple imputation',
};
export const moduleName = (module) => MODULE_NAMES[module] || module;

// "2 hours ago", "Yesterday", "5 Sep"
export const relativeTime = (iso, now = new Date()) => {
  if (!iso) return '';
  const then = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
