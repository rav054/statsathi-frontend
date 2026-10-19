import { describe, expect, it } from 'vitest';
import { summariseResult } from './resultSummary';

const chiSquare = {
  statistics: {
    test_name: 'Chi-Square Test of Independence',
    statistic: 18.42,
    p_value: 0.0001,
    degrees_of_freedom: 2,
    effect_size: 0.41,
    effect_size_name: "Cramér's V",
    n: 110,
    significant: true,
    notes: [],
    contingency_table: {
      index: ['Treated', 'Control'],
      columns: ['Survived', 'Died'],
      values: [[40, 10], [25, 35]],
    },
  },
};

describe('the chi-square summary', () => {
  const summary = summariseResult('nonparametric', chiSquare, { variables: ['Treatment', 'Outcome'] });

  it('says in words what the test found', () => {
    expect(summary.headline).toBe('Treatment and Outcome are associated.');
    expect(summary.detail).toContain('moderate association');
    expect(summary.significant).toBe(true);
  });

  it('reports the statistic, p and effect size', () => {
    expect(summary.stats.map(s => s.label)).toEqual(['X2(2)', 'p', "Cramer's V", 'n']);
    expect(summary.stats[1].value).toBe('< 0.001');
    expect(summary.stats[1].highlight).toBe(true);
  });

  it('hands the card a stacked chart of the counts, not group means', () => {
    expect(summary.bars).toBeNull();
    expect(summary.stack).toEqual({
      categories: ['Treated', 'Control'],
      series: ['Survived', 'Died'],
      values: [[40, 10], [25, 35]],
    });
    expect(summary.chartLabel).toBe('Treatment by Outcome');
  });

  it('states the opposite finding when nothing is significant', () => {
    const none = summariseResult('nonparametric',
      { statistics: { ...chiSquare.statistics, p_value: 0.42, significant: false } },
      { variables: ['Treatment', 'Outcome'] });
    expect(none.headline).toBe('No association between Treatment and Outcome.');
    expect(none.significant).toBe(false);
  });
});

describe('the other module summaries', () => {
  it('charts group medians for a rank test', () => {
    const summary = summariseResult('nonparametric', {
      statistics: {
        test_name: 'Kruskal-Wallis H-Test', statistic: 9.1, p_value: 0.01, significant: true,
        medians: { N0: 3.1, N40: 4.2, N80: 5.4 }, effect_size: 0.52, effect_size_name: 'Eta-squared (H)',
      },
    }, {});
    expect(summary.bars.map(b => b.name)).toEqual(['N0', 'N40', 'N80']);
    expect(summary.detail).toContain('N80 had the highest median');
    expect(summary.chartLabel).toBe('Group medians');
  });

  it('charts the two means for a t-test', () => {
    const summary = summariseResult('parametric', {
      statistics: {
        test_name: "Welch's t-test", t_statistic: -3.4, degrees_of_freedom: 18, p_value: 0.003,
        mean_group1: 4.1, mean_group2: 5.6, mean_difference: -1.5, cohens_d: -1.2, significant: true,
      },
    }, { variables: ['Control', 'Treated'] });
    expect(summary.headline).toBe('Control and Treated differ significantly.');
    expect(summary.bars.map(b => b.mean)).toEqual([4.1, 5.6]);
    expect(summary.stats[0].label).toBe('t(18)');
  });

  it('reports fit for a regression and the strongest pair for a correlation', () => {
    const regression = summariseResult('regression', {
      r2: 0.84, adj_r2: 0.81, f_pvalue: 0.0004,
      coefficients: [{ name: 'Intercept', p_value: 0.9 }, { name: 'Nitrogen', p_value: 0.001 }],
    }, {});
    expect(regression.headline).toBe('The model explains 84% of the variation.');
    expect(regression.detail).toContain('Nitrogen');

    const correlation = summariseResult('correlation', {
      method: 'pearson',
      matrix: { index: ['Yield', 'Height'], columns: ['Yield', 'Height'], values: [[1, -0.78], [-0.78, 1]] },
    }, {});
    expect(correlation.headline).toBe('Yield and Height are the most strongly related pair.');
    expect(correlation.detail).toContain('negatively');
  });

  it('returns nothing rather than guessing at an unknown or broken result', () => {
    expect(summariseResult('clustering', { anything: 1 }, {})).toBeNull();
    expect(summariseResult('nonparametric', null, {})).toBeNull();
    expect(summariseResult('parametric', { statistics: {} }, {})).toBeNull();
  });
});
