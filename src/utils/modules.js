// Every tool in StatSathi, grouped by research step. The navigation rail, Home, the phone layout and the
// "Find a test or project" search all read this one list.

export const TOOLS = {
  prep: { label: 'Data preparation', description: 'Health-check and clean a dataset step by step, or impute missing values.', keywords: 'clean missing impute outliers duplicates recode reshape join recipe' },
  transform: { label: 'Transform & scale', description: 'Log, square root, arcsine, Box-Cox, Yeo-Johnson, z-score and min-max.', keywords: 'log sqrt arcsine box-cox yeo-johnson zscore normalise scaling' },
  layout: { label: 'Field layout', description: 'Randomised CRD, RBD, Latin square and split-plot field layouts.', keywords: 'field layout randomisation crd rbd lsd split plot design' },
  excel: { label: 'Excel to CSV', description: 'Convert an Excel workbook to a CSV file.', keywords: 'excel xlsx convert csv' },
  descriptive: { label: 'Descriptive stats', description: 'Summary statistics, CV, shape, outliers and distributions.', keywords: 'mean median sd cv skewness kurtosis summary outliers' },
  correlation: { label: 'Correlation', description: 'Pearson and Spearman correlations with heatmaps.', keywords: 'pearson spearman heatmap relationship matrix' },
  plots: { label: 'Plots', description: 'Box plots, histograms, Q-Q plots and more, ready for publication.', keywords: 'box histogram qq chart graph visualisation' },
  anova: { label: 'ANOVA', description: 'CRD, RBD, factorial and split-plot ANOVA with DMRT, LSD and Tukey letters.', keywords: 'anova variance dmrt duncan tukey lsd rbd crd factorial split plot post hoc' },
  parametric: { label: 'Parametric tests', description: 't-tests and z-tests for normally distributed data.', keywords: 't-test t test paired independent welch z-test z test tests compare two means' },
  nonparametric: { label: 'Non-parametric', description: 'Mann-Whitney U, Wilcoxon and Kruskal-Wallis.', keywords: 'nonparametric non parametric rank tests mann whitney u wilcoxon signed kruskal wallis friedman median' },
  regression: { label: 'Regression', description: 'Simple, multiple and PLS regression.', keywords: 'linear multiple pls regression model predict' },
  trend: { label: 'Trend', description: 'Mann-Kendall, Sen’s slope and change-point tests.', keywords: 'mann kendall sen slope pettitt snht change point trend' },
  timeseries: { label: 'Forecast', description: 'Decompose, test stationarity and forecast a time series.', keywords: 'time series forecast sarima exponential smoothing decomposition' },
  sem: { label: 'SEM', description: 'Structural equation models with fit indices and path diagrams.', keywords: 'structural equation path latent mediation cfa pls-sem' },
  pca: { label: 'PCA', description: 'Eigenvalues, loadings, scores and biplots.', keywords: 'principal component analysis biplot loadings' },
  clustering: { label: 'Clustering', description: 'Ward hierarchical clustering and k-means with dendrograms.', keywords: 'cluster ward kmeans dendrogram' },
  gxe: { label: 'G×E', description: 'AMMI, GGE biplots and stability measures for multi-environment trials.', keywords: 'gxe ammi gge stability eberhart russell environment genotype' },
  divergence: { label: 'Divergence', description: 'Mahalanobis D² with Tocher clustering.', keywords: 'mahalanobis d2 tocher genetic divergence' },
  composer: { label: 'Compose figure', description: 'Combine charts into one labelled multi-panel figure.', keywords: 'figure panel compose tiff journal' },
  report: { label: 'Project report', description: 'One Word document with methods, results and references.', keywords: 'word report docx methods references' },
};

export const WORKFLOW = [
  { id: 'prepare', number: '01', title: 'Prepare', blurb: 'Clean, impute and reshape data, or lay out a field trial.', tools: ['prep', 'transform', 'layout', 'excel'], accent: { from: '#059669', to: '#34D399', tint: 'rgba(5,150,105,0.10)' } },
  { id: 'explore', number: '02', title: 'Explore', blurb: 'Summaries, distributions and relationships between variables.', tools: ['descriptive', 'correlation', 'plots'], accent: { from: '#0EA5E9', to: '#6EE7F9', tint: 'rgba(14,165,233,0.10)' } },
  { id: 'compare', number: '03', title: 'Compare groups', blurb: 'Do treatments differ? ANOVA with post-hoc letters, t-tests and rank tests.', tools: ['anova', 'parametric', 'nonparametric'], featured: 'anova', accent: { from: '#4F46E5', to: '#818CF8', tint: 'rgba(79,70,229,0.10)' } },
  { id: 'model', number: '04', title: 'Model', blurb: 'Explain or predict a response over doses, time or pathways.', tools: ['regression', 'trend', 'timeseries', 'sem'], accent: { from: '#3730A3', to: '#6366F1', tint: 'rgba(55,48,163,0.10)' } },
  { id: 'multivariate', number: '05', title: 'Multivariate', blurb: 'Group genotypes, reduce traits and study stability across environments.', tools: ['pca', 'clustering', 'gxe', 'divergence'], accent: { from: '#0D9488', to: '#5EEAD4', tint: 'rgba(13,148,136,0.10)' } },
  { id: 'report', number: '06', title: 'Figures & report', blurb: 'Publication figures and a Word report with methods and references.', tools: ['composer', 'plots', 'report'], accent: { from: '#EA580C', to: '#FDBA74', tint: 'rgba(234,88,12,0.10)' } },
];

// The step a tool belongs to (its first appearance), for breadcrumbs such as "Compare groups"
export const stepOfTool = (toolId) => WORKFLOW.find(step => step.tools.includes(toolId)) || null;

const normalise = (text) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

// Tools whose name, description or keywords contain every word typed, best matches (name hits) first
export const searchTools = (query) => {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return Object.entries(TOOLS)
    .map(([id, tool]) => {
      const name = normalise(tool.label);
      const haystack = `${name} ${normalise(tool.description)} ${tool.keywords}`;
      if (!words.every(word => haystack.includes(word))) return null;
      const score = words.filter(word => name.includes(word)).length;
      return { id, ...tool, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
};
