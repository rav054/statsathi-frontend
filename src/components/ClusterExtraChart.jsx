import { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Download } from 'lucide-react';
import FigurePresetSelect from './FigurePresetSelect';
import { themedLayout } from '../utils/figureStyle';
import { exportPlotlyFigure } from '../utils/plotlyExport';

const subtitle = (title, note) => `${title}<br><span style="font-size:11px;font-weight:normal;color:#4B5563">${note}</span>`;

const clusterIds = (labels) => [...new Set(labels)].sort((a, b) => a - b);

// Silhouette width of every observation, grouped by cluster and sorted within it
const silhouetteFigure = (results, method, colors) => {
  const values = results.silhouette?.[method];
  const labels = method === 'kmeans' ? results.kmeans.labels : results.hierarchical.labels;
  if (!values) {
    return {
      data: [],
      layout: { title: { text: 'Silhouette plot' }, annotations: [{ text: 'Silhouette widths need at least 2 clusters and fewer clusters than observations.', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }] }
    };
  }
  const gap = Math.max(2, Math.round(labels.length * 0.02));
  const traces = [];
  const tickvals = [];
  const ticktext = [];
  let offset = 0;
  clusterIds(labels).forEach(cluster => {
    const members = labels.map((label, i) => (label === cluster ? i : -1)).filter(i => i >= 0).sort((a, b) => values[b] - values[a]);
    traces.push({
      type: 'bar', orientation: 'h', width: 1, name: `Cluster ${cluster}`,
      x: members.map(i => values[i]), y: members.map((_, k) => offset + k),
      marker: { color: colors[cluster % colors.length] },
      text: members.map(i => `Row ${results.records[i]?.excel_row ?? i + 2}`),
      textposition: 'none',
      hovertemplate:`Cluster ${cluster}<br>%{text}<br>Silhouette: %{x:.3f}<extra></extra>`
    });
    tickvals.push(offset + (members.length - 1) / 2);
    ticktext.push(`Cluster ${cluster} (n = ${members.length})`);
    offset += members.length + gap;
  });
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    data: traces,
    layout: {
      title: { text: subtitle('Silhouette plot', 'Near 1: well matched to its own cluster. Near 0: between clusters. Below 0: possibly assigned to the wrong cluster.') },
      bargap: 0,
      showlegend: false,
      height: Math.max(380, Math.min(900, offset * 5 + 160)),
      margin: { t: 80 },
      xaxis: { title: { text: 'Silhouette width' }, range: [Math.min(-0.1, Math.min(...values) - 0.05), 1] },
      yaxis: { tickvals, ticktext, showgrid: false, autorange: 'reversed', ticks: '' },
      shapes: [{ type: 'line', xref: 'x', x0: average, x1: average, yref: 'paper', y0: 0, y1: 1, line: { color: '#1F2937', width: 1.5, dash: 'dash' } }],
      annotations: [{ xref: 'x', yref: 'paper', x: average, y: 1.02, text: `Average ${average.toFixed(3)}`, showarrow: false, xanchor: 'left', font: { size: 11 } }]
    }
  };
};

// Cluster means on a radar chart, each axis scaled from the lowest to the highest cluster mean
const radarFigure = (results, method, colors) => {
  const summaries = method === 'kmeans' ? results.kmeans.summaries : results.hierarchical.summaries;
  const variables = results.variables;
  const low = variables.map(v => Math.min(...summaries.map(s => s.means[v] ?? 0)));
  const high = variables.map(v => Math.max(...summaries.map(s => s.means[v] ?? 0)));
  const close = (values) => [...values, values[0]];
  return {
    data: summaries.map(summary => {
      const raw = variables.map(v => summary.means[v]);
      const scaled = raw.map((value, i) => (high[i] > low[i] ? (value - low[i]) / (high[i] - low[i]) : 0.5));
      const color = colors[summary.cluster_id % colors.length];
      return {
        type: 'scatterpolar', mode: 'lines+markers', fill: 'toself', opacity: 0.85,
        name: `Cluster ${summary.cluster_id} (n = ${summary.count})`,
        r: close(scaled), theta: close(variables), customdata: close(raw),
        line: { color, width: 2 }, marker: { color, size: 6 }, fillcolor: `${color}26`,
        hovertemplate: `Cluster ${summary.cluster_id}<br>%{theta}: %{customdata:.3f}<extra></extra>`
      };
    }),
    layout: {
      title: { text: subtitle('Cluster profiles (radar)', 'Each axis runs from the lowest cluster mean (centre) to the highest (edge). Hover for the actual means.') },
      height: 540,
      margin: { t: 90 },
      polar: {
        radialaxis: { range: [0, 1.05], showticklabels: false, gridcolor: '#E5E7EB', linecolor: '#E5E7EB' },
        angularaxis: { gridcolor: '#E5E7EB', linecolor: '#9CA3AF', tickfont: { size: 12 } }
      },
      legend: { orientation: 'h', y: -0.08 }
    }
  };
};

// Heatmap of the cluster means of the standardized variables
const heatmapFigure = (results, method) => {
  const summaries = method === 'kmeans' ? results.kmeans.summaries : results.hierarchical.summaries;
  const profiles = results.profiles_scaled?.[method] || {};
  const variables = results.variables;
  const rows = summaries.map(s => `Cluster ${s.cluster_id} (n = ${s.count})`);
  const z = summaries.map(s => variables.map(v => profiles[s.cluster_id]?.[v] ?? null));
  const limit = Math.max(1, ...z.flat().filter(v => v != null).map(Math.abs));
  return {
    data: [{
      type: 'heatmap', x: variables, y: rows, z, zmid: 0, zmin: -limit, zmax: limit,
      // Plotly's RdBu runs blue (low) to red (high): above-average cluster means are red, as in the correlation charts
      colorscale: 'RdBu', xgap: 2, ygap: 2,
      texttemplate: '%{z:.2f}', textfont: { size: 12 },
      customdata: summaries.map(s => variables.map(v => s.means[v])),
      hovertemplate: '%{y}<br>%{x}<br>z = %{z:.2f}<br>Mean = %{customdata:.3f}<extra></extra>',
      colorbar: { title: { text: 'z-score' }, thickness: 14 }
    }],
    layout: {
      title: { text: subtitle('Cluster profile heatmap', 'Cluster means of the standardized variables: 0 is the overall mean, ±1 is one standard deviation.') },
      height: Math.max(320, 64 * rows.length + 190),
      margin: { t: 90 },
      xaxis: { tickangle: -30, showgrid: false, showline: false },
      yaxis: { autorange: 'reversed', showgrid: false, showline: false }
    }
  };
};

const FIGURES = { silhouette: silhouetteFigure, radar: radarFigure, heatmap: heatmapFigure };

// Extra clustering charts: silhouette plot, profile radar, profile heatmap
const ClusterExtraChart = ({ kind, results, clusterMethod, colors, figurePrefs, setFigurePrefs, onError }) => {
  const chartRef = useRef(null);
  const [downloadDpi, setDownloadDpi] = useState(300);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const figure = FIGURES[kind](results, clusterMethod, colors);
    Plotly.newPlot(element, figure.data, themedLayout(figure.layout, { palette: figurePrefs.palette }), { responsive: true, displayModeBar: false });
    return () => Plotly.purge(element);
  }, [kind, results, clusterMethod, colors, figurePrefs.palette]);

  const download = (format) => {
    exportPlotlyFigure(chartRef.current, {
      format, preset: figurePrefs.preset, dpi: downloadDpi, filename: `statsathi_cluster_${kind}_${downloadDpi}dpi`,
      aspect: kind === 'radar' ? 0.9 : undefined
    }).catch(err => onError?.(err.message));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 gap-3">
        <div className="flex flex-wrap items-center gap-2">
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

export default ClusterExtraChart;
