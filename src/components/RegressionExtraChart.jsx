import { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Download } from 'lucide-react';
import FigurePresetSelect from './FigurePresetSelect';
import FigurePaletteSelect from './FigurePaletteSelect';
import { paletteColors, themedAxis, themedLayout } from '../utils/figureStyle';
import { exportPlotlyFigure } from '../utils/plotlyExport';

const withAlpha = (hex, alpha) => {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const zeroLine = (xref, yref) => ({
  type: 'line', xref: `${xref} domain`, x0: 0, x1: 1, yref, y0: 0, y1: 0,
  line: { color: '#9CA3AF', width: 1, dash: 'dot' }
});

const panelTitle = (xref, text) => ({
  xref: `${xref} domain`, yref: `${xref.replace('x', 'y')} domain`, x: 0, y: 1.1, xanchor: 'left',
  showarrow: false, text: `<b>${text}</b>`, font: { size: 12 }
});

// Simple regression: observations, fitted line, 95% confidence band (mean) and prediction band (new observation)
const lineFigure = (results, depVar, colors) => {
  const band = results.fit_band;
  const reversed = (values) => [...values].reverse();
  const intercept = results.coefficients[0].coefficient;
  const slope = results.coefficients[1].coefficient;
  return {
    data: [
      {
        x: [...band.x, ...reversed(band.x)], y: [...band.pi_upper, ...reversed(band.pi_lower)], type: 'scatter',
        fill: 'toself', fillcolor: withAlpha(colors[0], 0.08), line: { width: 0 }, hoverinfo: 'skip', name: '95% prediction band'
      },
      {
        x: [...band.x, ...reversed(band.x)], y: [...band.ci_upper, ...reversed(band.ci_lower)], type: 'scatter',
        fill: 'toself', fillcolor: withAlpha(colors[0], 0.22), line: { width: 0 }, hoverinfo: 'skip', name: '95% confidence band'
      },
      {
        x: band.x_values, y: results.actual, type: 'scatter', mode: 'markers', name: 'Observations',
        marker: { color: colors[0], size: 8, opacity: 0.85, line: { color: '#ffffff', width: 0.5 } },
        hovertemplate: `${band.x_name}: %{x:.3f}<br>${depVar}: %{y:.3f}<extra></extra>`
      },
      { x: band.x, y: band.fitted, type: 'scatter', mode: 'lines', name: 'Fitted line', line: { color: colors[1], width: 2.5 } }
    ],
    layout: {
      title: { text: `${depVar} vs ${band.x_name}: fitted line with 95% bands` },
      xaxis: { title: { text: band.x_name } },
      yaxis: { title: { text: depVar } },
      legend: { x: 0, y: 1 },
      annotations: [{
        xref: 'paper', yref: 'paper', x: 1, y: 0, xanchor: 'right', yanchor: 'bottom', showarrow: false,
        text: `${depVar} = ${intercept.toFixed(3)} ${slope < 0 ? '−' : '+'} ${Math.abs(slope).toFixed(3)} × ${band.x_name}   (R² = ${results.r2.toFixed(3)})`,
        bgcolor: 'rgba(255,255,255,0.85)', font: { size: 12 }
      }],
      height: 460
    }
  };
};

// Four-panel residual check: linearity, normality, constant variance, influential observations
const diagnosticsFigure = (results, colors) => {
  const d = results.diagnostics;
  const flagged = d.cooks_distance.map(c => c != null && c > d.cooks_threshold);
  const qqValues = d.qq_sample.filter(v => v != null);
  const qqRange = [Math.min(...d.qq_theoretical, ...qqValues), Math.max(...d.qq_theoretical, ...qqValues)];
  const marker = (color) => ({ color, size: 7, opacity: 0.8, line: { color: '#ffffff', width: 0.5 } });
  return {
    data: [
      {
        x: d.fitted, y: results.residuals, xaxis: 'x', yaxis: 'y', type: 'scatter', mode: 'markers', marker: marker(colors[0]),
        text: d.rows, hovertemplate: 'Row %{text}<br>Fitted: %{x:.3f}<br>Residual: %{y:.3f}<extra></extra>'
      },
      {
        x: d.qq_theoretical, y: d.qq_sample, xaxis: 'x2', yaxis: 'y2', type: 'scatter', mode: 'markers', marker: marker(colors[0]),
        text: d.qq_rows, hovertemplate: 'Row %{text}<br>Theoretical: %{x:.3f}<br>Standardized: %{y:.3f}<extra></extra>'
      },
      {
        x: qqRange, y: qqRange, xaxis: 'x2', yaxis: 'y2', type: 'scatter', mode: 'lines',
        line: { color: colors[1], width: 1.5, dash: 'dash' }, hoverinfo: 'skip'
      },
      {
        x: d.fitted, y: d.standardized_residuals.map(v => (v == null ? null : Math.sqrt(Math.abs(v)))), xaxis: 'x3', yaxis: 'y3',
        type: 'scatter', mode: 'markers', marker: marker(colors[0]), text: d.rows,
        hovertemplate: 'Row %{text}<br>Fitted: %{x:.3f}<br>√|Standardized residual|: %{y:.3f}<extra></extra>'
      },
      {
        x: d.leverage, y: d.standardized_residuals, xaxis: 'x4', yaxis: 'y4', type: 'scatter', mode: 'markers',
        marker: { ...marker(colors[0]), color: flagged.map(f => (f ? colors[1] : colors[0])), size: flagged.map(f => (f ? 11 : 7)) },
        text: d.rows.map((row, i) => `${row}<br>Cook's D: ${d.cooks_distance[i] == null ? 'n/a' : d.cooks_distance[i].toFixed(3)}`),
        hovertemplate: 'Row %{text}<br>Leverage: %{x:.3f}<br>Standardized: %{y:.3f}<extra></extra>'
      }
    ],
    layout: {
      title: { text: 'Residual diagnostics' },
      grid: { rows: 2, columns: 2, pattern: 'independent', xgap: 0.14, ygap: 0.22 },
      showlegend: false,
      height: 720,
      margin: { t: 90, b: 90 },
      xaxis: { title: { text: 'Fitted values' } },
      yaxis: { title: { text: 'Residuals' } },
      xaxis2: themedAxis({ title: { text: 'Theoretical normal quantiles' } }),
      yaxis2: themedAxis({ title: { text: 'Standardized residuals' } }),
      xaxis3: themedAxis({ title: { text: 'Fitted values' } }),
      yaxis3: themedAxis({ title: { text: '√|Standardized residuals|' } }),
      xaxis4: themedAxis({ title: { text: 'Leverage' } }),
      yaxis4: themedAxis({ title: { text: 'Standardized residuals' } }),
      shapes: [zeroLine('x', 'y'), zeroLine('x4', 'y4')],
      annotations: [
        panelTitle('x', 'Residuals vs fitted (linearity)'),
        panelTitle('x2', 'Normal Q-Q (normality)'),
        panelTitle('x3', 'Scale-location (constant variance)'),
        panelTitle('x4', 'Residuals vs leverage (influence)'),
        {
          xref: 'paper', yref: 'paper', x: 0, y: -0.14, xanchor: 'left', showarrow: false, font: { size: 11, color: '#4B5563' },
          text: `Highlighted points: Cook's distance above 4/n = ${d.cooks_threshold.toFixed(3)}. Hover a point to see its spreadsheet row.`
        }
      ]
    }
  };
};

// Coefficient (forest) plot of the predictors with 95% confidence intervals
const coefficientsFigure = (results, colors) => {
  const coefficients = results.coefficients.filter(c => c.variable !== 'Intercept').sort((a, b) => a.coefficient - b.coefficient);
  const significant = coefficients.map(c => c.ci_lower > 0 || c.ci_upper < 0);
  return {
    data: [{
      x: coefficients.map(c => c.coefficient), y: coefficients.map(c => c.variable), type: 'scatter', mode: 'markers',
      marker: { color: significant.map(s => (s ? colors[0] : '#9CA3AF')), size: 11, symbol: 'diamond' },
      error_x: {
        type: 'data', symmetric: false, array: coefficients.map(c => c.ci_upper - c.coefficient),
        arrayminus: coefficients.map(c => c.coefficient - c.ci_lower), color: '#4B5563', thickness: 2, width: 0
      },
      text: coefficients.map(c => `p = ${c.p_value < 0.001 ? '< 0.001' : c.p_value.toFixed(4)}`),
      hovertemplate: '%{y}<br>Estimate: %{x:.4f}<br>%{text}<extra></extra>'
    }],
    layout: {
      title: {
        text: 'Coefficients with 95% confidence intervals'
          + '<br><span style="font-size:11px;font-weight:normal;color:#4B5563">'
          + 'Grey: not significant (the 95% CI includes 0). Estimates are in the units of each predictor.</span>'
      },
      xaxis: { title: { text: 'Estimate' }, zeroline: true, zerolinecolor: '#9CA3AF', zerolinewidth: 1.5 },
      yaxis: { automargin: true, range: [-0.6, coefficients.length - 0.4] },
      showlegend: false,
      height: Math.max(340, 56 * coefficients.length + 190),
      margin: { t: 80 }
    }
  };
};

const FIGURES = { line: lineFigure, diagnostics: diagnosticsFigure, coefficients: coefficientsFigure };
const FILENAMES = { line: 'regression_line_bands', diagnostics: 'regression_residual_diagnostics', coefficients: 'regression_coefficients' };

// Extra regression charts: fitted line with bands, residual diagnostics, coefficient plot
const RegressionExtraChart = ({ kind, results, depVar, figurePrefs, setFigurePrefs, onError }) => {
  const chartRef = useRef(null);
  const [downloadDpi, setDownloadDpi] = useState(300);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const colors = paletteColors(figurePrefs.palette);
    const figure = kind === 'line' ? lineFigure(results, depVar, colors) : FIGURES[kind](results, colors);
    Plotly.newPlot(element, figure.data, themedLayout(figure.layout, { palette: figurePrefs.palette }), { responsive: true, displayModeBar: false });
    return () => Plotly.purge(element);
  }, [kind, results, depVar, figurePrefs.palette]);

  const download = (format) => {
    exportPlotlyFigure(chartRef.current, {
      format, preset: figurePrefs.preset, dpi: downloadDpi, filename: `${FILENAMES[kind]}_${downloadDpi}dpi`,
      aspect: kind === 'diagnostics' ? 0.9 : undefined
    }).catch(err => onError?.(err.message));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FigurePaletteSelect value={figurePrefs.palette} onChange={(palette) => setFigurePrefs({ palette })} />
          <FigurePresetSelect value={figurePrefs.preset} onChange={(preset) => setFigurePrefs({ preset })} />
          <span className="font-sans text-[13px] font-bold text-slate-400 uppercase">DPI:</span>
          {[150, 300, 600].map(dpiVal => (
            <button
              key={dpiVal}
              type="button"
              onClick={() => setDownloadDpi(dpiVal)}
              className={`px-2 py-1 font-sans text-[12px] font-bold rounded-lg cursor-pointer ${
                downloadDpi === dpiVal ? 'bg-brand-indigo text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {dpiVal}
            </button>
          ))}
        </div>
        <div className="flex space-x-1.5">
          {['png', 'jpeg', 'svg'].map(fmt => (
            <button
              key={fmt}
              type="button"
              onClick={() => download(fmt)}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-sans text-[12px] font-bold uppercase transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              <span>{fmt}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
};

export default RegressionExtraChart;
