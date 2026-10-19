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

// "F(4, 12) = 33.8", "p < 0.001", "CV = 6.4%"
export const formatStat = (stat) => (String(stat.value).startsWith('<') ? `${stat.label} ${stat.value}` : `${stat.label} = ${stat.value}`);

export const summariseResult = (module, result, parameters) => {
  try {
    if (module === 'anova') return anovaSummary(result, parameters);
  } catch {
    // an unexpected shape just means no summary
  }
  return null;
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
