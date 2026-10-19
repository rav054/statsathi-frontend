import { describe, expect, it } from 'vitest';
import STYLE from '../theme/figure_style.json';
import { PALETTE_OPTIONS, paletteColors, themeColors, themedAxis, themedLayout } from './figureStyle';

describe('the shared figure style', () => {
  it('offers the default palette first and marks the colour-blind-safe ones', () => {
    expect(PALETTE_OPTIONS[0].value).toBe(STYLE.default_palette);
    expect(PALETTE_OPTIONS.every(p => p.colors.length >= 6)).toBe(true);
    expect(PALETTE_OPTIONS.some(p => p.colorblindSafe)).toBe(true);
  });

  it('repeats a palette only when asked for more colours than it has', () => {
    const colors = STYLE.palettes[STYLE.default_palette].colors;
    expect(paletteColors(undefined, 3)).toEqual(colors.slice(0, 3));
    expect(paletteColors(undefined, colors.length + 1).at(-1)).toBe(colors[0]);
    expect(paletteColors('not-a-palette', 2)).toEqual(colors.slice(0, 2));
  });

  it('uses the night steps and ink on a dark surface', () => {
    const palette = STYLE.palettes[STYLE.default_palette];
    expect(paletteColors(undefined, 2, { dark: true })).toEqual(palette.colors_dark.slice(0, 2));
    expect(themeColors(true).background).toBe(STYLE.colors_dark.background);

    const dark = themedLayout({}, { dark: true });
    expect(dark.paper_bgcolor).toBe(STYLE.colors_dark.background);
    expect(dark.font.color).toBe(STYLE.colors_dark.text);
    expect(dark.colorway[0]).toBe(palette.colors_dark[0]);
    expect(themedAxis({}, { dark: true }).gridcolor).toBe(STYLE.colors_dark.grid);
  });

  it('keeps the chart’s own settings on top of the theme', () => {
    const layout = themedLayout({ title: { text: 'Yield' }, yaxis: { title: { text: 't/ha' } } });
    expect(layout.title.text).toBe('Yield');
    expect(layout.title.x).toBe(0);
    expect(layout.yaxis.title.text).toBe('t/ha');
    expect(layout.yaxis.gridcolor).toBe(STYLE.colors.grid);
    expect(layout.hoverlabel.bgcolor).toBe(STYLE.colors.background);
  });
});
