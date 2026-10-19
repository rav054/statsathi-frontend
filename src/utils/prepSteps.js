// The cleaning steps the Data Preparation screen offers, described once so the editor, the API call and a saved
// recipe all agree. Each field says how to edit one key of the step object sent to /analyze/prep/apply.
//
// Field types: columns (several), column (one), select, number, text, list (comma-separated), boolean, mapping,
// file (the second table for a merge). `showIf(step)` hides a field that does not apply; `optional` fields may be
// left empty.

const MISSING_OPTIONS = [['rows', 'Rows with gaps'], ['columns', 'Columns with many gaps']];
const OPS = [
  ['eq', 'is'], ['ne', 'is not'], ['gt', 'is above'], ['ge', 'is at least'], ['lt', 'is below'], ['le', 'is at most'],
  ['between', 'is between'], ['in', 'is one of'], ['not_in', 'is not one of'], ['contains', 'contains'],
  ['is_missing', 'is missing'], ['not_missing', 'is present'],
];
const NO_VALUE_OPS = ['is_missing', 'not_missing'];

export const STEP_CATALOG = {
  drop_missing: {
    label: 'Remove missing values',
    group: 'Missing values',
    defaults: { axis: 'rows', how: 'any', columns: [] },
    fields: [
      { key: 'axis', label: 'Remove', type: 'select', options: MISSING_OPTIONS },
      { key: 'how', label: 'When', type: 'select', options: [['any', 'any value is missing'], ['all', 'every value is missing']], showIf: s => s.axis === 'rows' },
      { key: 'columns', label: 'Only look at', type: 'columns', optional: true, showIf: s => s.axis === 'rows' },
      { key: 'max_missing_fraction', label: 'Keep columns missing at most (0-1)', type: 'number', min: 0, max: 1, step: 0.05, optional: true, showIf: s => s.axis === 'columns' },
    ],
  },
  fill_missing: {
    label: 'Fill missing values',
    group: 'Missing values',
    defaults: { columns: [], method: 'median', group_by: '' },
    fields: [
      { key: 'columns', label: 'Columns', type: 'columns' },
      { key: 'method', label: 'Fill with', type: 'select', options: [['mean', 'Mean'], ['median', 'Median'], ['mode', 'Most common value'], ['constant', 'A fixed value'], ['interpolate', 'Interpolation (ordered data)'], ['ffill', 'Previous value'], ['bfill', 'Next value']] },
      { key: 'value', label: 'Value', type: 'text', showIf: s => s.method === 'constant' },
      { key: 'group_by', label: 'Within each group of', type: 'column', optional: true, showIf: s => ['mean', 'median', 'mode'].includes(s.method) },
    ],
  },
  drop_duplicates: {
    label: 'Remove duplicate rows',
    group: 'Rows & columns',
    defaults: { columns: [], keep: 'first' },
    fields: [
      { key: 'columns', label: 'Duplicate when these match (default: every column)', type: 'columns', optional: true },
      { key: 'keep', label: 'Keep', type: 'select', options: [['first', 'The first copy'], ['last', 'The last copy'], ['none', 'No copies']] },
    ],
  },
  filter_rows: {
    label: 'Filter rows',
    group: 'Rows & columns',
    defaults: { column: '', op: 'eq', value: '', action: 'keep' },
    fields: [
      { key: 'action', label: 'Action', type: 'select', options: [['keep', 'Keep rows where'], ['drop', 'Remove rows where']] },
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'op', label: 'Condition', type: 'select', options: OPS },
      { key: 'value', label: 'Value', type: 'text', showIf: s => !NO_VALUE_OPS.includes(s.op) && !['in', 'not_in'].includes(s.op) },
      { key: 'value', label: 'Values (comma-separated)', type: 'list', showIf: s => ['in', 'not_in'].includes(s.op) },
      { key: 'value2', label: 'and', type: 'text', showIf: s => s.op === 'between' },
    ],
  },
  select_columns: {
    label: 'Keep or remove columns',
    group: 'Rows & columns',
    defaults: { columns: [], action: 'drop' },
    fields: [
      { key: 'action', label: 'Action', type: 'select', options: [['drop', 'Remove these columns'], ['keep', 'Keep only these columns']] },
      { key: 'columns', label: 'Columns', type: 'columns' },
    ],
  },
  rename_columns: {
    label: 'Rename columns',
    group: 'Rows & columns',
    defaults: { mapping: {} },
    fields: [{ key: 'mapping', label: 'New names', type: 'mapping', source: 'columns' }],
  },
  sort_rows: {
    label: 'Sort rows',
    group: 'Rows & columns',
    defaults: { columns: [], ascending: true },
    fields: [
      { key: 'columns', label: 'Sort by', type: 'columns' },
      { key: 'ascending', label: 'Smallest first', type: 'boolean' },
    ],
  },
  cast_type: {
    label: 'Change column type',
    group: 'Clean values',
    defaults: { columns: [], to: 'numeric' },
    fields: [
      { key: 'columns', label: 'Columns', type: 'columns' },
      { key: 'to', label: 'Read as', type: 'select', options: [['numeric', 'Numbers (strips commas and units)'], ['integer', 'Whole numbers'], ['text', 'Text'], ['category', 'Categories'], ['datetime', 'Dates']] },
      { key: 'dayfirst', label: 'Day comes first (31/12/2025)', type: 'boolean', showIf: s => s.to === 'datetime' },
    ],
  },
  clean_text: {
    label: 'Tidy text labels',
    group: 'Clean values',
    defaults: { columns: [], case: 'none', trim: true, collapse_spaces: true, blanks_to_missing: true },
    fields: [
      { key: 'columns', label: 'Columns (default: every text column)', type: 'columns', optional: true },
      { key: 'case', label: 'Capitalisation', type: 'select', options: [['none', 'Leave as is'], ['upper', 'UPPER'], ['lower', 'lower'], ['title', 'Title Case']] },
      { key: 'trim', label: 'Trim leading and trailing spaces', type: 'boolean' },
      { key: 'collapse_spaces', label: 'Collapse repeated spaces', type: 'boolean' },
      { key: 'blanks_to_missing', label: 'Treat "NA", "-", "?" as missing', type: 'boolean' },
    ],
  },
  recode_values: {
    label: 'Recode values',
    group: 'Clean values',
    defaults: { column: '', mapping: {}, new_column: '' },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'mapping', label: 'Replace', type: 'mapping', source: 'values' },
      { key: 'new_column', label: 'Write to a new column (optional)', type: 'text', optional: true },
    ],
  },
  impute_model: {
    label: 'Fill gaps with a model',
    group: 'Missing values',
    defaults: { columns: [], method: 'iterative', predictors: [], n_neighbors: 5, bounds: 'none', seed: 2026 },
    fields: [
      { key: 'columns', label: 'Numeric columns to fill', type: 'columns' },
      { key: 'method', label: 'Model', type: 'select', options: [['iterative', 'Chained regressions (MICE-style)'], ['knn', 'Nearest complete rows (KNN)']] },
      { key: 'predictors', label: 'Learn from (default: other numeric columns, row IDs left out)', type: 'columns', optional: true },
      { key: 'n_neighbors', label: 'Neighbours', type: 'number', min: 1, max: 50, step: 1, showIf: s => s.method === 'knn' },
      { key: 'bounds', label: 'Keep filled values', type: 'select', options: [['none', 'Unrestricted'], ['non_negative', 'Zero or above'], ['observed_range', 'Within the observed range']] },
      { key: 'seed', label: 'Random seed', type: 'number', step: 1, showIf: s => s.method === 'iterative' },
    ],
  },
  compute_column: {
    label: 'Calculated column',
    group: 'Clean values',
    defaults: { name: '', formula: '' },
    fields: [
      { key: 'name', label: 'New column name', type: 'text' },
      { key: 'formula', label: 'Formula', type: 'formula' },
    ],
  },
  bin_numeric: {
    label: 'Group into classes',
    group: 'Clean values',
    defaults: { column: '', method: 'equal_width', bins: 3, new_column: '' },
    fields: [
      { key: 'column', label: 'Numeric column', type: 'column' },
      { key: 'method', label: 'Classes', type: 'select', options: [['equal_width', 'Equal width'], ['quantile', 'Equal number of rows'], ['custom', 'My own edges']] },
      { key: 'bins', label: 'Number of classes', type: 'number', min: 2, max: 20, step: 1, showIf: s => s.method !== 'custom' },
      { key: 'edges', label: 'Edges (comma-separated, e.g. 0, 6.5, 7.5, 14)', type: 'list', numeric: true, showIf: s => s.method === 'custom' },
      { key: 'labels', label: 'Class names (optional, comma-separated)', type: 'list', optional: true },
      { key: 'new_column', label: 'New column name (optional)', type: 'text', optional: true },
    ],
  },
  handle_outliers: {
    label: 'Handle outliers',
    group: 'Clean values',
    defaults: { columns: [], method: 'iqr', action: 'flag', group_by: '' },
    fields: [
      { key: 'columns', label: 'Columns (default: every numeric column)', type: 'columns', optional: true },
      { key: 'method', label: 'Rule', type: 'select', options: [['iqr', '1.5 × IQR (Tukey fences)'], ['zscore', 'z-score above 3'], ['mad', 'Modified z-score above 3.5 (robust)']] },
      { key: 'threshold', label: 'Custom cut-off (optional)', type: 'number', step: 0.1, optional: true },
      { key: 'action', label: 'Then', type: 'select', options: [['flag', 'Mark them in a new column'], ['to_missing', 'Set them to missing'], ['winsorize', 'Pull them back to the fence'], ['remove', 'Remove their rows']] },
      { key: 'group_by', label: 'Judge within each group of', type: 'column', optional: true },
    ],
  },
  to_long: {
    label: 'Wide → long',
    group: 'Reshape & combine',
    defaults: { id_columns: [], value_columns: [], variable_name: 'variable', value_name: 'value', drop_missing: false },
    fields: [
      { key: 'id_columns', label: 'Columns that identify a row (e.g. Genotype, Rep)', type: 'columns' },
      { key: 'value_columns', label: 'Columns to stack (default: all the others)', type: 'columns', optional: true },
      { key: 'variable_name', label: 'Name for the stacked column names', type: 'text' },
      { key: 'value_name', label: 'Name for the values', type: 'text' },
      { key: 'drop_missing', label: 'Skip empty cells', type: 'boolean' },
    ],
  },
  to_wide: {
    label: 'Long → wide',
    group: 'Reshape & combine',
    defaults: { index: [], columns_from: '', values_from: '', aggfunc: 'mean' },
    fields: [
      { key: 'index', label: 'One row per', type: 'columns' },
      { key: 'columns_from', label: 'New columns from', type: 'column' },
      { key: 'values_from', label: 'Values from', type: 'column' },
      { key: 'aggfunc', label: 'Combine repeats with', type: 'select', options: [['mean', 'Mean'], ['median', 'Median'], ['sum', 'Sum'], ['count', 'Count'], ['first', 'First value'], ['min', 'Minimum'], ['max', 'Maximum']] },
    ],
  },
  merge: {
    label: 'Join another file',
    group: 'Reshape & combine',
    defaults: { on: [], how: 'left' },
    fields: [
      { key: 'file', label: 'Second file', type: 'file' },
      { key: 'on', label: 'Match rows on', type: 'columns' },
      { key: 'how', label: 'Keep', type: 'select', options: [['left', 'Every row of this dataset'], ['inner', 'Only rows found in both'], ['outer', 'Rows from either file'], ['right', 'Every row of the second file']] },
    ],
  },
};

// How a column is written inside a formula: plain names as they are, anything else in [square brackets]
export const formulaName = (name) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`);

// Short reminders shown under the formula box; the backend (app/expressions.py) is the full list
export const FORMULA_EXAMPLES = [
  ['[Plot yield (kg)] / [Plot area (m2)] * 10000', 'yield per hectare'],
  ['100 * Germinated / Sown', 'a percentage'],
  ['row_mean(Rep1, Rep2, Rep3)', 'mean across columns'],
  ['100 * Yield / mean(Yield)', 'relative to the overall mean'],
  ['if_else(Treatment == "Control", 0, log10(Dose))', 'a condition'],
];

export const FORMULA_FUNCTIONS = [
  'log', 'log10', 'log2', 'sqrt', 'exp', 'abs', 'round', 'floor', 'ceil', 'clip', 'arcsin_sqrt', 'if_else',
  'is_missing', 'fill', 'row_mean', 'row_sum', 'row_min', 'row_max', 'mean', 'median', 'sd', 'min', 'max', 'sum',
  'zscore', 'rank',
];

export const STEP_GROUPS =['Missing values', 'Rows & columns', 'Clean values', 'Reshape & combine'];

let nextId = 1;

export const newStep = (type, overrides = {}) => ({
  id: `step-${nextId++}`,
  type,
  ...structuredClone(STEP_CATALOG[type].defaults),
  ...overrides,
});

export const visibleFields = (step) => STEP_CATALOG[step.type].fields.filter(field => !field.showIf || field.showIf(step));

const isEmpty = (value) => value === undefined || value === null || value === ''
  || (Array.isArray(value) && value.length === 0)
  || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

// What still has to be filled in before a step can run ('' when it is ready)
export const stepProblem = (step, { hasMergeFile = false } = {}) => {
  for (const field of visibleFields(step)) {
    if (field.type === 'file') {
      if (!hasMergeFile) return 'Choose the second file.';
      continue;
    }
    if (!field.optional && field.type !== 'boolean' && isEmpty(step[field.key])) return `Set "${field.label}".`;
  }
  return '';
};

const parseList = (value, numeric) => {
  const items = Array.isArray(value) ? value : String(value ?? '').split(',');
  const cleaned = items.map(item => String(item).trim()).filter(Boolean);
  return numeric ? cleaned.map(Number) : cleaned;
};

// The step as the API expects it: hidden fields and empty optional ones left out, lists and numbers parsed
export const toApiStep = (step) => {
  const payload = { type: step.type };
  for (const field of visibleFields(step)) {
    if (field.type === 'file') continue;
    let value = step[field.key];
    if (field.type === 'list') value = parseList(value, field.numeric);
    if (field.type === 'number' && !isEmpty(value)) value = Number(value);
    if (field.type === 'mapping') {
      value = Object.fromEntries(Object.entries(value || {}).filter(([, to]) => String(to).trim() !== ''));
    }
    if (isEmpty(value) && field.type !== 'boolean') continue;
    payload[field.key] = value;
  }
  return payload;
};

// The body the workspace API stores for a recipe kept in a project
export const recipeToProjectBody = (steps, { name, description, datasetName }) => ({
  name: name.trim(),
  description: description?.trim() || null,
  source_dataset: datasetName || null,
  steps: steps.map(toApiStep),
});

// A saved recipe keeps the steps only; files and ids are not part of it
export const recipeToJson = (steps, datasetName) => JSON.stringify({
  statsathi_recipe: 1,
  dataset: datasetName || null,
  steps: steps.map(toApiStep),
}, null, 2);

export const recipeFromJson = (text) => recipeFromSteps(JSON.parse(text));

// Steps as stored (a file's JSON, or a recipe from a project) turned back into editable steps
export const recipeFromSteps = (parsed) => {
  const list = Array.isArray(parsed) ? parsed : parsed?.steps;
  if (!Array.isArray(list)) throw new Error('This file is not a StatSathi recipe.');
  return list.map((raw, index) => {
    if (!raw || !STEP_CATALOG[raw.type]) throw new Error(`Step ${index + 1} has an unknown type "${raw?.type}".`);
    const { type, ...rest } = raw;
    const listKeys = STEP_CATALOG[type].fields.filter(f => f.type === 'list').map(f => f.key);
    listKeys.forEach(key => { if (Array.isArray(rest[key])) rest[key] = rest[key].join(', '); });
    return newStep(type, rest);
  });
};

// Column names each step leaves behind that the dataset did not have, so later steps can pick them
export const columnsAfter = (columns, steps) => {
  let known = [...columns];
  for (const step of steps) {
    if (step.type === 'rename_columns') {
      known = known.map(name => (step.mapping?.[name] ? step.mapping[name] : name));
    } else if (step.type === 'select_columns' && step.columns?.length) {
      known = step.action === 'keep' ? known.filter(c => step.columns.includes(c)) : known.filter(c => !step.columns.includes(c));
    } else if (step.type === 'compute_column' && step.name?.trim()) {
      known.push(step.name.trim());
    } else if (step.type === 'recode_values' && step.new_column) {
      known.push(step.new_column);
    } else if (step.type === 'bin_numeric' && step.column) {
      known.push(step.new_column || `${step.column}_class`);
    } else if (step.type === 'handle_outliers' && step.action === 'flag') {
      (step.columns?.length ? step.columns : []).forEach(c => known.push(`${c}_is_outlier`));
    } else if (step.type === 'to_long') {
      known = [...(step.id_columns || []), step.variable_name || 'variable', step.value_name || 'value'];
    }
  }
  return [...new Set(known)];
};

// One-click fixes for the problems the profile found
export const suggestedSteps = (profile) => {
  if (!profile) return [];
  const suggestions = [];
  const byCode = (code) => profile.columns.filter(c => c.issues.some(issue => issue.code === code)).map(c => c.name);

  const asText = byCode('numeric_as_text');
  if (asText.length) suggestions.push({ title: `Convert ${asText.join(', ')} to numbers`, step: newStep('cast_type', { columns: asText, to: 'numeric' }) });
  const variants = [...new Set([...byCode('label_variants'), ...byCode('missing_as_text')])];
  if (variants.length) suggestions.push({ title: `Tidy the labels in ${variants.join(', ')}`, step: newStep('clean_text', { columns: variants }) });
  if (profile.duplicate_rows) suggestions.push({ title: `Remove ${profile.duplicate_rows} duplicate row${profile.duplicate_rows === 1 ? '' : 's'}`, step: newStep('drop_duplicates') });
  const useless = [...byCode('all_missing'), ...byCode('constant')];
  if (useless.length) suggestions.push({ title: `Remove empty or constant columns (${useless.join(', ')})`, step: newStep('select_columns', { action: 'drop', columns: useless }) });
  const outliers = byCode('outliers');
  if (outliers.length) suggestions.push({ title: `Mark outliers in ${outliers.join(', ')}`, step: newStep('handle_outliers', { columns: outliers, action: 'flag' }) });
  // Numeric columns with some gaps (a column with every value missing is removed above, not filled)
  const gappy = profile.columns.filter(c => c.kind === 'numeric' && c.missing > 0 && c.missing < profile.n_rows).map(c => c.name);
  if (gappy.length) suggestions.push({ title: `Fill the gaps in ${gappy.join(', ')} with the median`, step: newStep('fill_missing', { columns: gappy, method: 'median' }) });
  return suggestions;
};
