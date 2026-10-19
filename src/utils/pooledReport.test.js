import { describe, expect, it } from 'vitest';
import { emptyPooledAnalyses, imputationReport, pooledAnalysesProblem, pooledAnalysesRequest } from './pooledReport';

const pooled = (estimate) => ({ estimate, se: 0.1, ci_low: estimate - 0.2, ci_high: estimate + 0.2, df: 30.5, fmi: 0.12, p_value: 0.0004, between: 0.001 });

const outcome = {
  settings: { columns: ['Yield'], predictors: ['Tillers'], m: 20, max_iter: 10, seed: 2026 },
  columns: [{ column: 'Yield', missing: 5, observed_mean: 11, observed_sd: 1, imputed_mean: 11.4, imputed_sd: 1.2, pooled_mean: pooled(11.1) }],
  group_comparison: { outcome: 'Yield', group: 'Nitrogen', levels: ['N0', 'N60'], difference: 'N0 - N60', means: { N0: 10.5, N60: 11.6 }, ...pooled(-1.1), cohens_d: -1.4 },
  correlation: { method: 'spearman', pairs: [{ x: 'Yield', y: 'Tillers', r: 0.61, ci_low: 0.4, ci_high: 0.77, p_value: 0.00001, fmi: 0.2 }] },
  anova: {
    response: 'Yield', df_residual: 35, alpha: 0.05, comparison_method: 'bonferroni',
    terms: [{ term: 'Irrigation', F: 5.05, df1: 2, df2: 35, p_value: 0.0118, riv: 0.47 }],
    comparisons: { Irrigation: { means: [{ level: 'I1', mean: 10.98, se: 0.2, ci_low: 10.5, ci_high: 11.4, group: 'b' }, { level: 'I2', mean: 12.25, se: 0.2, ci_low: 11.8, ci_high: 12.7, group: 'a' }] } },
  },
  regression: null,
  notes: ['20 imputations by chained equations.'],
};

describe('pooled analyses on imputed data', () => {
  it('sends only the analyses that are switched on and complete', () => {
    const spec = emptyPooledAnalyses();
    expect(pooledAnalysesRequest(spec)).toEqual({});
    spec.correlation = { enabled: true, variables: ['Yield', 'Tillers'], method: 'spearman' };
    spec.anova = { enabled: true, response: 'Yield', factors: ['Irrigation'], block: '', interaction: true, comparison: 'lsd' };
    expect(pooledAnalysesRequest(spec)).toEqual({
      correlation: { variables: ['Yield', 'Tillers'], method: 'spearman' },
      // a single factor never asks for an interaction, and no block is sent as null
      anova: { response: 'Yield', factors: ['Irrigation'], block: null, interaction: false, comparison: 'lsd' },
    });
  });

  it('says what is missing before the run', () => {
    const spec = emptyPooledAnalyses();
    expect(pooledAnalysesProblem(spec)).toBe('');
    spec.groupComparison.enabled = true;
    expect(pooledAnalysesProblem(spec)).toMatch(/two-level group/);
    spec.groupComparison = { enabled: true, outcome: 'Yield', group: 'Nitrogen' };
    spec.anova.enabled = true;
    expect(pooledAnalysesProblem(spec)).toMatch(/ANOVA response/);
  });

  it('builds report sections for every pooled result', () => {
    const report = imputationReport(outcome, 'trial.csv');
    expect(report.dataset_name).toBe('trial.csv');
    expect(report.sections.map(s => s.heading)).toEqual([
      'Imputation',
      'Pooled comparison of Yield by Nitrogen',
      'Pooled Spearman correlations',
      'Pooled ANOVA of Yield',
    ]);
    const anova = report.sections[3];
    expect(anova.tables[0].rows[0]).toEqual(['Irrigation', 5.05, 2, 35, '0.0118', 0.47]);
    expect(anova.tables[1].rows.map(row => row[4])).toEqual(['b', 'a']);
    expect(report.sections[2].tables[0].rows[0][4]).toBe('< 0.001');
    // every table row has as many cells as columns (the report API rejects anything else)
    report.sections.forEach(section => section.tables.forEach(table => table.rows.forEach(row => expect(row).toHaveLength(table.columns.length))));
  });
});
