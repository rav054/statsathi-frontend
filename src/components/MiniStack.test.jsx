import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniStack } from './Home';

const stack = {
  categories: ['Treated', 'Control'],
  series: ['Survived', 'Died'],
  values: [[40, 10], [25, 35]],
};

const chart = (props = {}) => render(<MiniStack stack={stack} {...props} />).container.querySelector('svg');

describe('the contingency thumbnail', () => {
  it('draws one segment per non-zero cell, stacked within each category', () => {
    const svg = chart();
    const bars = [...svg.querySelectorAll('rect')].filter(r => Number(r.getAttribute('height')) > 2);
    // four cells plus the two legend swatches
    expect(bars).toHaveLength(4 + 2);

    // Treated totals 50 and Control 60, so Control is the taller bar
    const heightOf = (name) => [...svg.querySelectorAll('rect')]
      .filter(r => Math.abs(Number(r.getAttribute('x')) - (name === 'Treated' ? 66.5 : 199.5) + 17) < 2)
      .reduce((sum, r) => sum + Number(r.getAttribute('height')), 0);
    expect(heightOf('Control')).toBeGreaterThan(heightOf('Treated'));
  });

  it('names both variables for a screen reader and labels the series', () => {
    const svg = chart();
    expect(svg.getAttribute('aria-label')).toBe('Counts for Treated, Control split by Survived, Died');
    expect(svg.textContent).toContain('Survived');
    expect(svg.textContent).toContain('Died');
  });

  it('gives each series its own hue, in the palette order', () => {
    const fills = [...chart().querySelectorAll('rect')].map(r => r.getAttribute('fill'));
    expect(new Set(fills)).toEqual(new Set(['#6366F1', '#D96C0C']));
  });

  it('drops labels and legend in the thumbnail so the bars get the whole box', () => {
    const svg = chart({ compact: true, width: 92, height: 56 });
    expect(svg.textContent).toBe('');
    expect(svg.querySelectorAll('line')).toHaveLength(0);
    expect([...svg.querySelectorAll('rect')].length).toBe(4);
  });
});
