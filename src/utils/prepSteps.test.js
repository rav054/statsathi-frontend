import { describe, expect, it } from 'vitest';
import {
  STEP_CATALOG, columnsAfter, formulaName, newStep, recipeFromSteps, recipeToProjectBody, recipeFromJson, recipeToJson, stepProblem, suggestedSteps, toApiStep,
} from './prepSteps';

describe('the cleaning steps the preparation screen offers', () => {
  it('starts every step from defaults the API accepts', () => {
    Object.keys(STEP_CATALOG).forEach(type => {
      const step = newStep(type);
      expect(step.type).toBe(type);
      expect(step.id).toMatch(/^step-/);
    });
  });

  it('says what is still missing before a step can run', () => {
    expect(stepProblem(newStep('fill_missing'))).toMatch(/Columns/);
    expect(stepProblem(newStep('fill_missing', { columns: ['Yield'] }))).toBe('');
    expect(stepProblem(newStep('fill_missing', { columns: ['Yield'], method: 'constant' }))).toMatch(/Value/);
    expect(stepProblem(newStep('merge', { on: ['Plot'] }))).toMatch(/second file/);
    expect(stepProblem(newStep('merge', { on: ['Plot'] }), { hasMergeFile: true })).toBe('');
    // optional fields never block
    expect(stepProblem(newStep('drop_duplicates'))).toBe('');
  });

  it('sends only the fields that apply, with lists and numbers parsed', () => {
    const filter = newStep('filter_rows', { column: 'Treatment', op: 'in', value: 'T1, T2 ,T3', value2: 'ignored' });
    expect(toApiStep(filter)).toEqual({ type: 'filter_rows', action: 'keep', column: 'Treatment', op: 'in', value: ['T1', 'T2', 'T3'] });

    const bins = newStep('bin_numeric', { column: 'pH', method: 'custom', edges: '0, 6.5, 7.5, 14', labels: '' });
    expect(toApiStep(bins)).toEqual({ type: 'bin_numeric', column: 'pH', method: 'custom', edges: [0, 6.5, 7.5, 14] });

    const outliers = newStep('handle_outliers', { columns: ['y'], threshold: '2.5', group_by: '' });
    expect(toApiStep(outliers)).toEqual({ type: 'handle_outliers', columns: ['y'], method: 'iqr', threshold: 2.5, action: 'flag' });

    const rename = newStep('rename_columns', { mapping: { Ht: 'Height', Yld: '' } });
    expect(toApiStep(rename).mapping).toEqual({ Ht: 'Height' });

    // booleans are sent even when false
    expect(toApiStep(newStep('sort_rows', { columns: ['Plot'], ascending: false })).ascending).toBe(false);
  });

  it('saves a recipe and reads it back', () => {
    const steps = [
      newStep('cast_type', { columns: ['Yield'] }),
      newStep('bin_numeric', { column: 'pH', method: 'custom', edges: '0, 7, 14' }),
    ];
    const text = recipeToJson(steps, 'trial.csv');
    expect(JSON.parse(text).dataset).toBe('trial.csv');
    const loaded = recipeFromJson(text);
    expect(loaded.map(toApiStep)).toEqual(steps.map(toApiStep));
    expect(loaded[0].id).not.toBe(steps[0].id);
    expect(() => recipeFromJson('{"steps":[{"type":"teleport"}]}')).toThrow(/unknown type/);
    expect(() => recipeFromJson('{"hello":1}')).toThrow(/not a StatSathi recipe/);
  });

  it('tracks the column names earlier steps create', () => {
    const columns = ['Genotype', 'Env1', 'Env2', 'pH'];
    expect(columnsAfter(columns, [newStep('rename_columns', { mapping: { pH: 'Soil pH' } })])).toContain('Soil pH');
    expect(columnsAfter(columns, [newStep('bin_numeric', { column: 'pH' })])).toContain('pH_class');
    expect(columnsAfter(columns, [newStep('to_long', { id_columns: ['Genotype'], variable_name: 'Environment', value_name: 'Yield' })]))
      .toEqual(['Genotype', 'Environment', 'Yield']);
    expect(columnsAfter(columns, [newStep('select_columns', { action: 'drop', columns: ['Env2'] })]))
      .toEqual(['Genotype', 'Env1', 'pH']);
  });

  it('stores a recipe in a project and opens it again', () => {
    const steps = [
      newStep('impute_model', { columns: ['Yield'], method: 'knn', n_neighbors: '3' }),
      newStep('bin_numeric', { column: 'pH', method: 'custom', edges: '0, 7, 14' }),
    ];
    const body = recipeToProjectBody(steps, { name: '  Kharif cleaning ', description: ' ', datasetName: 'kharif.csv' });
    expect(body.name).toBe('Kharif cleaning');
    expect(body.description).toBeNull();
    expect(body.source_dataset).toBe('kharif.csv');
    expect(body.steps[0]).toEqual({ type: 'impute_model', columns: ['Yield'], method: 'knn', n_neighbors: 3, bounds: 'none' });

    const reopened = recipeFromSteps(body.steps);
    expect(reopened.map(toApiStep)).toEqual(body.steps);
    expect(reopened[1].edges).toBe('0, 7, 14'); // lists come back as editable text
  });

  it('writes column names the way formulas expect', () => {
    expect(formulaName('Yield')).toBe('Yield');
    expect(formulaName('rep_2')).toBe('rep_2');
    expect(formulaName('Plot yield (kg)')).toBe('[Plot yield (kg)]');
    expect(formulaName('2020')).toBe('[2020]');
  });

  it('makes a calculated column available to later steps', () => {
    const compute = newStep('compute_column', { name: 'Yield (kg/ha)', formula: '[Plot yield] * 500' });
    expect(stepProblem(newStep('compute_column', { name: 'x' }))).toMatch(/Formula/);
    expect(stepProblem(compute)).toBe('');
    expect(toApiStep(compute)).toEqual({ type: 'compute_column', name: 'Yield (kg/ha)', formula: '[Plot yield] * 500' });
    expect(columnsAfter(['Plot yield'], [compute])).toEqual(['Plot yield', 'Yield (kg/ha)']);
  });

  it('turns the health check into one-click fixes', () => {
    const profile = {
      n_rows: 10,
      duplicate_rows: 2,
      columns: [
        { name: 'Yield', kind: 'categorical', missing: 0, issues: [{ code: 'numeric_as_text' }] },
        { name: 'Treatment', kind: 'categorical', missing: 0, issues: [{ code: 'label_variants' }] },
        { name: 'Height', kind: 'numeric', missing: 3, issues: [{ code: 'outliers' }] },
        { name: 'Notes', kind: 'categorical', missing: 10, issues: [{ code: 'all_missing' }] },
      ],
    };
    const types = suggestedSteps(profile).map(s => s.step.type);
    expect(types).toEqual(['cast_type', 'clean_text', 'drop_duplicates', 'select_columns', 'handle_outliers', 'fill_missing']);
    expect(suggestedSteps(profile)[5].step.columns).toEqual(['Height']);
    expect(suggestedSteps(null)).toEqual([]);
  });
});
