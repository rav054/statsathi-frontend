import Plotly from 'plotly.js-dist-min';
import { presetOf, PX_PER_MM, SCREEN_PRESET } from './figureStyle';
import { saveBlob } from './workspaceApi';

// Scales font sizes (inside font / tickfont / textfont objects) and margins of a Plotly layout
const scaleLayout = (value, factor, parentKey = '') => {
  if (Array.isArray(value)) return value.map(item => scaleLayout(item, factor, parentKey));
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'size' && typeof item === 'number' && /font$/i.test(parentKey)) {
      out[key] = item * factor;
    } else if (parentKey === 'margin' && typeof item === 'number') {
      out[key] = Math.max(4, item * factor);
    } else {
      out[key] = scaleLayout(item, factor, key);
    }
  });
  return out;
};

// Exports a rendered Plotly chart at a figure-size preset (e.g. 85 mm single journal column).
// Fonts are rescaled so the printed text size matches the preset; `dpi` defaults to the preset's.
export const exportPlotlyFigure = async (element, { format = 'png', preset, dpi, filename = 'statsathi_figure', aspect } = {}) => {
  if (!element || !element.data) throw new Error('The chart has not been drawn yet.');
  const p = presetOf(preset);
  const width = Math.round(p.width_mm * PX_PER_MM);
  const height = Math.round(width * (aspect || p.aspect));
  const layout = {
    ...scaleLayout(element.layout || {}, p.font_pt / SCREEN_PRESET.font_pt),
    width,
    height,
    autosize: false
  };
  // Scale from the exact target so the file is width_mm at the requested DPI (not the rounded CSS width)
  const targetPixels = (p.width_mm / 25.4) * (dpi || p.dpi);
  const url = await Plotly.toImage(
    { data: element.data, layout },
    { format, width, height, scale: format === 'svg' ? 1 : targetPixels / width }
  );
  const blob = await (await fetch(url)).blob();
  saveBlob(blob, `${filename}.${format === 'jpeg' ? 'jpg' : format}`);
};
