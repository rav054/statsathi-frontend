import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DatasetPicker from './DatasetPicker';

vi.mock('../context/AuthContext', () => ({
  API_URL: 'http://api.test',
  useAuth: () => ({ token: 'test-token', user: { id: 1, email: 'r@example.com' } }),
}));

const emptyDataset = (overrides = {}) => ({
  file: null, source: null, columns: [], numericColumns: [], loading: false, error: null,
  selectFile: vi.fn(), selectProjectDataset: vi.fn(), clear: vi.fn(), setError: vi.fn(), ...overrides,
});

const projectResponses = () => vi.fn(async (url) => {
  const address = String(url);
  const body = address.endsWith('/workspace/projects')
    ? [{ id: 3, name: 'Bhopal weather study', dataset_count: 1 }]
    : { id: 3, name: 'Bhopal weather study', datasets: [{ id: 7, filename: 'weather.csv', project_id: 3, n_rows: 40, n_columns: 3, size_bytes: 2048 }] };
  return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body };
});

describe('choosing the dataset for an analysis', () => {
  it('offers an upload area with the wording the screen asked for', () => {
    render(<DatasetPicker dataset={emptyDataset()} title="Drop a trial dataset" hint="One row per plot." />);
    expect(screen.getByText('Drop a trial dataset')).toBeInTheDocument();
    expect(screen.getByText('One row per plot.')).toBeInTheDocument();
  });

  it('sends a chosen file to the dataset, and reports it upwards', async () => {
    const selectFile = vi.fn(async (file) => ({ file, columns: ['a'], numericColumns: ['a'] }));
    const onChange = vi.fn();
    const { container } = render(<DatasetPicker dataset={emptyDataset({ selectFile })} onChange={onChange} />);

    const file = new File(['a\n1\n'], 'trial.csv', { type: 'text/csv' });
    await userEvent.upload(container.querySelector('input[type=file]'), file);

    expect(selectFile).toHaveBeenCalledWith(file);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('shows which dataset is in use and where it came from', async () => {
    const clear = vi.fn();
    const dataset = emptyDataset({
      file: new File([''], 'weather.csv'), columns: ['Year', 'Rain'],
      source: { kind: 'project', datasetId: 7, projectId: 3, projectName: 'Bhopal weather study' }, clear,
    });
    const onViewData = vi.fn();
    render(<DatasetPicker dataset={dataset} onViewData={onViewData} />);

    expect(screen.getByText('weather.csv')).toBeInTheDocument();
    expect(screen.getByText(/From project: Bhopal weather study/)).toBeInTheDocument();
    expect(screen.getByText(/2 columns/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /View Data/i }));
    expect(onViewData).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Choose Other Dataset/i }));
    expect(clear).toHaveBeenCalled();
  });

  it('lists datasets already saved in a project and uses the one that is picked', async () => {
    global.fetch = projectResponses();
    const selectProjectDataset = vi.fn(async () => ({ file: new File([''], 'weather.csv'), columns: [], numericColumns: [] }));
    render(<DatasetPicker dataset={emptyDataset({ selectProjectDataset })} />);

    await userEvent.click(screen.getByRole('button', { name: /From my projects/i }));
    const project = await screen.findByRole('button', { name: /Bhopal weather study/ });
    await userEvent.click(project);

    const stored = await screen.findByRole('button', { name: /weather\.csv/ });
    expect(stored).toHaveTextContent('40 × 3');
    await userEvent.click(stored);

    expect(selectProjectDataset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, filename: 'weather.csv' }), 'Bhopal weather study');
  });

  it('explains what to do when there are no saved projects yet', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => [] }));
    render(<DatasetPicker dataset={emptyDataset()} />);
    await userEvent.click(screen.getByRole('button', { name: /From my projects/i }));
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });
});
