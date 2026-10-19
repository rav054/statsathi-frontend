import { describe, expect, it } from 'vitest';
import { TOOLS, WORKFLOW, searchTools, stepOfTool } from './modules';
import { formatStat, relativeTime, summariseResult } from './resultSummary';

describe('the tool list', () => {
  it('puts every tool in at least one workflow step', () => {
    const inSteps = new Set(WORKFLOW.flatMap(step => step.tools));
    expect(Object.keys(TOOLS).filter(id => !inSteps.has(id))).toEqual([]);
    expect(stepOfTool('anova').title).toBe('Compare groups');
  });

  it('finds tools by method names people type', () => {
    expect(searchTools('dmrt')[0].id).toBe('anova');
    expect(searchTools('rank test').map(t => t.id)).toContain('nonparametric');
    expect(searchTools('mann kendall')[0].id).toBe('trend');
    expect(searchTools('')).toEqual([]);
  });
});

describe('result summaries', () => {
  const anova = {
    anova_table: { f_statistic: 33.8, p_value: 0.00004, df_between: 4, df_within: 12, significant: true },
    descriptives: { N0: { mean: 3.12, se: 0.14 }, N120: { mean: 5.02, se: 0.14 }, N40: { mean: 4.05, se: 0.14 }, N80: { mean: 4.86, se: 0.14 } },
    posthoc_letters: { N0: 'c', N40: 'b', N80: 'a', N120: 'a' },
    cv: 6.42,
  };

  it('writes the ANOVA finding and orders levels naturally', () => {
    const summary = summariseResult('anova', anova, { dependent: 'grain yield', factor_a: 'N dose' });
    expect(summary.headline).toBe('N dose had a significant effect on grain yield.');
    expect(summary.detail).toBe('N80, N120 share the top group.');
    expect(summary.bars.map(b => b.name)).toEqual(['N0', 'N40', 'N80', 'N120']);
    expect(summary.stats.map(formatStat)).toEqual(['F(4, 12) = 33.8', 'p < 0.001', 'CV = 6.4%']);
  });

  it('says so when nothing differs, and gives no summary for unknown shapes', () => {
    const flat = { ...anova, anova_table: { ...anova.anova_table, p_value: 0.41, significant: false } };
    expect(summariseResult('anova', flat, { dependent: 'yield' }).detail).toBe('The groups did not differ significantly in yield.');
    expect(summariseResult('anova', {}, {})).toBeNull();
    expect(summariseResult('pca', { anything: 1 }, {})).toBeNull();
  });

  it('describes when something was saved', () => {
    const now = new Date('2026-09-14T12:00:00Z');
    expect(relativeTime('2026-09-14T11:58:00', now)).toBe('2 minutes ago');
    expect(relativeTime('2026-09-14T09:00:00', now)).toBe('3 hours ago');
    expect(relativeTime('2026-09-13T09:00:00', now)).toBe('Yesterday');
  });
});
