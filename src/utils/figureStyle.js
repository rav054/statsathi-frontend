import STYLE from '../theme/figure_style.json';

// Shared figure style. The backend keeps an identical copy of figure_style.json so the
// server-rendered Matplotlib figures and these Plotly charts look the same.
export const FIGURE_STYLE = STYLE;
export const PX_PER_PT = 96 / 72;
export const PX_PER_MM = 96 / 25.4;

export const PALETTE_OPTIONS = Object.entries(STYLE.palettes)
  .map(([value, p]) => ({ value, label: p.label, colors: p.colors, colorblindSafe: p.colorblind_safe }));

export const PRESET_OPTIONS = Object.entries(STYLE.presets)
  .map(([value, p]) => ({ value, label: p.label }));

export const SCREEN_PRESET = STYLE.presets.screen;

export const presetOf = (name) => STYLE.presets[name] || STYLE.presets[STYLE.default_preset];

export const isStylePalette = (name) => Boolean(STYLE.palettes[name]);

// Colours of a palette; with `n`, the list is repeated to exactly n entries.
// `dark` picks the steps chosen for the night surface, which are lighter than the light-mode ones.
export const paletteColors = (name, n, { dark = false } = {}) => {
  const palette = STYLE.palettes[name] || STYLE.palettes[STYLE.default_palette];
  const colors = (dark && palette.colors_dark) || palette.colors;
  return n === undefined ? [...colors] : Array.from({ length: n }, (_, i) => colors[i % colors.length]);
};

// Ink, axis and surface colours for the theme the chart is drawn on
export const themeColors = (dark = false) => (dark ? STYLE.colors_dark : STYLE.colors);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Recursively merges plain objects; arrays and other values in `override` replace those in `base`
export const mergeDeep = (base, override) => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    out[key] = mergeDeep(base[key], value);
  });
  return out;
};

const axisBase = (dark = false) => {
  const c = themeColors(dark);
  return {
    showline: true,
    linecolor: c.axis,
    linewidth: 1,
    ticks: 'outside',
    tickcolor: c.axis,
    ticklen: 4,
    tickfont: { size: Math.round(SCREEN_PRESET.font_pt * 0.9 * PX_PER_PT), color: c.muted },
    title: { font: { size: Math.round(SCREEN_PRESET.font_pt * PX_PER_PT), color: c.text }, standoff: 10 },
    gridcolor: c.grid,
    zeroline: false,
    automargin: true
  };
};

// Styled axis for extra subplot axes (xaxis2, yaxis2, ...), which themedLayout does not cover
export const themedAxis = (overrides = {}, { dark = false } = {}) => mergeDeep(axisBase(dark), overrides);

// Plotly layout with the StatSathi theme underneath the chart's own settings
export const themedLayout = (layout = {}, { palette, dark = false } = {}) => {
  const c = themeColors(dark);
  const size = Math.round(SCREEN_PRESET.font_pt * PX_PER_PT);
  const small = Math.round(SCREEN_PRESET.font_pt * 0.9 * PX_PER_PT);
  const titleSize = Math.round(SCREEN_PRESET.title_pt * PX_PER_PT);
  const axis = axisBase(dark);
  const base = {
    font: { family: STYLE.font.css, size, color: c.text },
    title: { font: { size: titleSize, color: c.text, weight: 'bold' }, x: 0, xref: 'paper', xanchor: 'left' },
    colorway: paletteColors(palette, undefined, { dark }),
    paper_bgcolor: c.background,
    plot_bgcolor: c.background,
    xaxis: axis,
    yaxis: axis,
    legend: { bgcolor: 'rgba(0,0,0,0)', font: { size: small, color: c.text } },
    hovermode: 'closest',
    hoverlabel: {
      font: { family: STYLE.font.css, size: small, color: c.text },
      bgcolor: c.background,
      bordercolor: c.axis
    },
    separators: '. ',
    margin: { t: 56, r: 24, l: 64, b: 56 }
  };
  return mergeDeep(base, layout);
};
