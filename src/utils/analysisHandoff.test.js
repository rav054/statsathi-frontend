import { beforeEach, describe, expect, it } from 'vitest';
import { canReopen, storeAnalysisHandoff, takeAnalysisHandoff, REOPENABLE_MODULES } from './analysisHandoff';

const payload = { module: 'trend', title: 'Rainfall trends', parameters: { time: 'Year' }, result: { n: 3 } };

describe('handing a saved analysis to its module', () => {
  // the module holds a handed-over analysis until the end of the task, so each test starts on a fresh one
  beforeEach(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

  it('stores the analysis and gives it back once', () => {
    expect(storeAnalysisHandoff(payload)).toBe(true);
    expect(takeAnalysisHandoff()).toEqual(payload);
    expect(sessionStorage.getItem('statsathi_open_analysis')).toBeNull();
  });

  it('gives the same analysis to both calls of a double render, then forgets it', async () => {
    storeAnalysisHandoff(payload);
    expect(takeAnalysisHandoff()).toEqual(payload);
    expect(takeAnalysisHandoff()).toEqual(payload);  // React runs state initializers twice in development
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(takeAnalysisHandoff()).toBeNull();  // coming back to the dashboard later must not reopen it
  });

  it('returns nothing when there is no analysis waiting', async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(takeAnalysisHandoff()).toBeNull();
  });

  it('survives storage that refuses to write', () => {
    const real = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { setItem: () => { throw new Error('denied'); }, getItem: () => null, removeItem: () => {}, clear: () => {} },
    });
    try {
      expect(storeAnalysisHandoff(payload)).toBe(false);
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: real });
    }
  });

  it('knows which modules can reopen a saved analysis', () => {
    expect(REOPENABLE_MODULES).toContain('trend');
    expect(canReopen('gxe')).toBe(true);
    expect(canReopen('anova')).toBe(true);
    // The screens that never save a result cannot reopen one
    expect(canReopen('plots')).toBe(false);
    expect(canReopen('layout')).toBe(false);
  });
});
