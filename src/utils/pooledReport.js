// Multiple-imputation results as report sections (the shape /reports/docx and project reports use), and the request
// for the pooled analyses the user switched on.

const num = (value) => (value === null || value === undefined || Number.isNaN(value) ? null : Number(value));
const pText = (p) => (p === null || p === undefined ? '–' : p < 0.001 ? '< 0.001' : Number(p).toFixed(4));
const ci = (low, high, digits = 3) => `[${Number(low).toFixed(digits)}, ${Number(high).toFixed(digits)}]`;

// Every pooled analysis switched off, with nothing chosen
export const emptyPooledAnalyses = () => ({
  groupComparison: { enabled: false, outcome: '', group: '' },
  correlation: { enabled: false, variables: [], method: 'pearson' },
  anova: { enabled: false, response: '', factors: [], block: '', interaction: true, comparison: 'bonferroni' },
});

// The analyses part of the API request, from the form state ({ enabled, ...settings } per analysis)
export const pooledAnalysesRequest = ({ groupComparison, correlation, anova }) => {
  const request = {};
  if (groupComparison?.enabled && groupComparison.outcome && groupComparison.group) {
    request.group_comparison = { outcome: groupComparison.outcome, group: groupComparison.group };
  }
  if (correlation?.enabled && correlation.variables?.length >= 2) {
    request.correlation = { variables: correlation.variables, method: correlation.method || 'pearson' };
  }
  if (anova?.enabled && anova.response && anova.factors?.length) {
    request.anova = {
      response: anova.response,
      factors: anova.factors.slice(0, 2),
      block: anova.block || null,
      interaction: anova.factors.length === 2 ? Boolean(anova.interaction) : false,
      comparison: anova.comparison || 'bonferroni',
    };
  }
  return request;
};

// What still has to be chosen before the pooled analyses can run ('' when ready)
export const pooledAnalysesProblem = ({ groupComparison, correlation, anova }) => {
  if (groupComparison?.enabled && (!groupComparison.outcome || !groupComparison.group)) return 'Choose the outcome and the two-level group for the comparison.';
  if (correlation?.enabled && (correlation.variables || []).length < 2) return 'Choose at least two variables to correlate.';
  if (anova?.enabled && (!anova.response || !(anova.factors || []).length)) return 'Choose the ANOVA response and at least one factor.';
  if (anova?.enabled && anova.factors.length > 2) return 'The pooled ANOVA takes one or two factors.';
  return '';
};

export const imputationReport = (outcome, datasetName) => {
  const { settings } = outcome;
  const sections = [{
    heading: 'Imputation',
    paragraphs: [
      `${settings.m} imputations of ${settings.columns.join(', ')} by chained equations (Bayesian ridge regression, draws from the posterior predictive), ${settings.max_iter} iterations each, seeds ${settings.seed}-${settings.seed + settings.m - 1}; predictors: ${settings.predictors.join(', ') || 'none'}.`,
    ],
    tables: [{
      caption: 'Observed and imputed values',
      columns: ['Column', 'Missing', 'Observed mean', 'Observed SD', 'Imputed mean', 'Imputed SD'],
      rows: outcome.columns.map(c => [c.column, c.missing, num(c.observed_mean), num(c.observed_sd), num(c.imputed_mean), num(c.imputed_sd)]),
    }, {
      caption: `Pooled means (m = ${settings.m})`,
      columns: ['Column', 'Mean', 'SE', '95% CI', 'df', 'FMI'],
      rows: outcome.columns.map(c => [c.column, num(c.pooled_mean.estimate), num(c.pooled_mean.se), ci(c.pooled_mean.ci_low, c.pooled_mean.ci_high), num(c.pooled_mean.df), num(c.pooled_mean.fmi)]),
    }],
  }];

  const g = outcome.group_comparison;
  if (g) {
    sections.push({
      heading: `Pooled comparison of ${g.outcome} by ${g.group}`,
      tables: [{
        columns: ['Difference', 'Estimate', 'SE', '95% CI', 'df', 'p', 'FMI', "Cohen's d"],
        rows: [[g.difference, num(g.estimate), num(g.se), ci(g.ci_low, g.ci_high), num(g.df), pText(g.p_value), num(g.fmi), num(g.cohens_d)]],
        note: `Group means: ${g.levels.map(level => `${level} ${Number(g.means[level]).toFixed(3)}`).join(', ')}. Welch standard errors; Cohen's d averaged over imputations.`,
      }],
    });
  }

  const c = outcome.correlation;
  if (c) {
    sections.push({
      heading: `Pooled ${c.method === 'spearman' ? 'Spearman' : 'Pearson'} correlations`,
      tables: [{
        columns: ['Variable 1', 'Variable 2', 'r', '95% CI', 'p', 'FMI'],
        rows: c.pairs.map(pair => [pair.x, pair.y, num(pair.r), ci(pair.ci_low, pair.ci_high), pText(pair.p_value), num(pair.fmi)]),
        note: "Pooled on Fisher's z scale and transformed back.",
      }],
    });
  }

  const a = outcome.anova;
  if (a) {
    const section = {
      heading: `Pooled ANOVA of ${a.response}`,
      tables: [{
        caption: 'Tests of each term (D1 multivariate Wald statistic)',
        columns: ['Term', 'F', 'df1', 'df2', 'p', 'RIV'],
        rows: a.terms.map(t => [t.term, num(t.F), t.df1, num(t.df2), pText(t.p_value), num(t.riv)]),
        note: `Sum-to-zero contrasts; df2 capped at the complete-data residual df (${a.df_residual}). RIV = relative increase in variance due to missing data.`,
      }],
    };
    Object.entries(a.comparisons).forEach(([factor, block]) => {
      section.tables.push({
        caption: `Pooled means of ${factor} (${a.comparison_method === 'bonferroni' ? 'Bonferroni-adjusted' : 'unadjusted'} comparisons, α = ${a.alpha})`,
        columns: [factor, 'Mean', 'SE', '95% CI', 'Group'],
        rows: block.means.map(row => [row.level, num(row.mean), num(row.se), ci(row.ci_low, row.ci_high), row.group]),
        note: 'Means sharing a letter do not differ significantly.',
      });
    });
    sections.push(section);
  }

  if (outcome.regression) {
    const r = outcome.regression;
    sections.push({
      heading: `Pooled regression of ${r.dependent}`,
      tables: [{
        columns: ['Term', 'Estimate', 'SE', '95% CI', 'df', 'p', 'FMI'],
        rows: r.coefficients.map(t => [t.term, num(t.estimate), num(t.se), ci(t.ci_low, t.ci_high, 4), num(t.df), pText(t.p_value), num(t.fmi)]),
        note: `Pooled R² = ${Number(r.r_squared).toFixed(4)} (n = ${r.n}).`,
      }],
    });
  }

  return {
    title: 'Multiple imputation',
    test_applied: `Multiple imputation (m = ${settings.m}) with pooled analyses`,
    dataset_name: datasetName,
    filename: 'StatSathi_Multiple_Imputation',
    sections,
    notes: outcome.notes,
  };
};
