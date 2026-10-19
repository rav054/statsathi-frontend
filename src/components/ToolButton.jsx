import {
  Wand2, Sliders, Grid, RefreshCw, Calculator, GitCompare, BarChart3, Milestone, Binary, Cpu,
  TrendingUp, Activity, LineChart, Network, Layers, Compass, Sprout, Boxes, LayoutGrid, FileText,
} from 'lucide-react';
import { TOOLS } from '../utils/modules';

// One icon per tool, so a button is recognisable before it is read
const ICONS = {
  prep: Wand2, transform: Sliders, layout: Grid, excel: RefreshCw,
  descriptive: Calculator, correlation: GitCompare, plots: BarChart3,
  anova: Milestone, parametric: Binary, nonparametric: Cpu,
  regression: TrendingUp, trend: Activity, timeseries: LineChart, sem: Network,
  pca: Layers, clustering: Compass, gxe: Sprout, divergence: Boxes,
  composer: LayoutGrid, report: FileText,
};

/**
 * A tool on Home: frosted glass over a tint of its step's colour, with the icon in a gradient tile.
 * The featured tool of a step is filled with that gradient instead.
 */
const ToolButton = ({ id, accent, featured = false, onClick, className = '' }) => {
  const tool = TOOLS[id];
  const Icon = ICONS[id] || Calculator;
  const gradient = `linear-gradient(135deg, ${accent.from}, ${accent.to})`;

  return (
    <button type="button" onClick={onClick} title={tool.description}
      style={featured
        ? { backgroundImage: gradient, boxShadow: `0 8px 18px -10px ${accent.from}` }
        : { backgroundImage: `linear-gradient(135deg, ${accent.tint}, rgba(255,255,255,0))` }}
      className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left backdrop-blur-sm transition-all duration-150 hover:-translate-y-px cursor-pointer ${featured
        ? 'border-transparent text-white hover:brightness-[1.06]'
        : 'border-white/70 bg-white/60 text-ink-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-white hover:shadow-[0_8px_18px_-12px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/5 dark:text-night-ink dark:hover:border-white/20'} ${className}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white transition-transform duration-150 group-hover:scale-105"
        style={featured ? { background: 'rgba(255,255,255,0.22)' } : { backgroundImage: gradient }}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
      <span className="font-sans text-[12.5px] font-semibold">{tool.label}</span>
    </button>
  );
};

export default ToolButton;
