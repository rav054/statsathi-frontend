// Reopening a saved analysis: the Projects page hands the stored result to the module that produced it.
// The payload lives in sessionStorage for the moment it takes to switch pages, and is consumed once.
const KEY = 'statsathi_open_analysis';

// Modules whose screens can display a saved result again
export const REOPENABLE_MODULES = [
  'descriptive', 'correlation', 'parametric', 'nonparametric', 'anova', 'regression',
  'pca', 'clustering', 'sem', 'trend', 'gxe', 'divergence', 'timeseries',
];

export const canReopen = (module) => REOPENABLE_MODULES.includes(module);

export const storeAnalysisHandoff = (payload) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;  // private mode or storage full: the analysis simply cannot be reopened
  }
};

// React calls state initializers twice in development (StrictMode), and the dashboard reads the handoff in one of
// them. The analysis is kept until the end of the current task so both calls see it, and dropped afterwards: coming
// back to the dashboard later must not reopen it.
let pending = null;

export const takeAnalysisHandoff = () => {
  if (pending) return pending;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const payload = raw ? JSON.parse(raw) : null;
    if (payload) {
      pending = payload;
      setTimeout(() => { pending = null; }, 0);
    }
    return payload;
  } catch {
    return null;
  }
};
