import { describe, expect, it } from 'vitest';
import { buildLayout } from './fieldLayout';

const base = { replications: 4, treatments: 5, factorB: 3, factorC: 2, seed: 482913 };
const sorted = (values) => [...values].sort();

describe('randomized field plans', () => {
  it('gives the same plan for the same settings and seed, and a different one for another seed', () => {
    const one = buildLayout({ ...base, designType: 'rbd_oneway' });
    expect(buildLayout({ ...base, designType: 'rbd_oneway' })).toEqual(one);
    expect(buildLayout({ ...base, designType: 'rbd_oneway', seed: 482914 })).not.toEqual(one);
  });

  it('CRD: every treatment appears once per replication, spread over a near-square grid', () => {
    const plan = buildLayout({ ...base, designType: 'crd_oneway' });
    const plots = plan.grid.flat();
    expect(plots).toHaveLength(20);
    expect(new Set(plots).size).toBe(20);
    expect(plan.grid[0]).toHaveLength(Math.ceil(Math.sqrt(20)));
  });

  it('RBD: each block holds every treatment exactly once', () => {
    const plan = buildLayout({ ...base, designType: 'rbd_twoway' });
    expect(plan.blocks).toHaveLength(4);
    const expected = sorted(['A1', 'A2', 'A3', 'A4', 'A5'].flatMap(a => ['B1', 'B2', 'B3'].map(b => `${a}${b}`)));
    plan.blocks.forEach(block => expect(sorted(block.plots)).toEqual(expected));
    // blocks are randomized independently
    expect(new Set(plan.blocks.map(block => block.plots.join()))).not.toHaveProperty('size', 1);
  });

  it('Latin square: each treatment once in every row and every column', () => {
    const { square } = buildLayout({ ...base, designType: 'lsd' });
    const treatments = sorted(['T1', 'T2', 'T3', 'T4', 'T5']);
    square.forEach(row => expect(sorted(row)).toEqual(treatments));
    for (let c = 0; c < 5; c++) expect(sorted(square.map(row => row[c]))).toEqual(treatments);
  });

  it('split-plot and sub-sub plot: every level at every stratum', () => {
    const split = buildLayout({ ...base, designType: 'splitplot' });
    split.blocks.forEach(block => {
      expect(sorted(block.mainPlots.map(p => p.mainName))).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
      block.mainPlots.forEach(main => expect(sorted(main.subplots)).toEqual(['B1', 'B2', 'B3']));
    });
    const subsub = buildLayout({ ...base, designType: 'subsubplot' });
    subsub.blocks[0].mainPlots.forEach(main => main.subplots.forEach(sub => expect(sorted(sub.subSubplots)).toEqual(['C1', 'C2'])));
  });

  it('has no plan for an unknown design', () => {
    expect(buildLayout({ ...base, designType: 'teleport' })).toBeNull();
  });
});
