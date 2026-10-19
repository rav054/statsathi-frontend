import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedDatasetProvider } from '../context/SharedDatasetContext';
import { useDataset } from './useDataset';

vi.mock('../context/AuthContext', () => ({
  API_URL: 'http://api.test',
  useAuth: () => ({ token: 'test-token', user: { id: 1 } }),
}));

const csv = (name = 'trial.csv') => new File(['Year,Yield\n2020,5\n'], name, { type: 'text/csv' });

const columnsResponse = {
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({ columns: ['Year', 'Yield', 'Block'], numeric_columns: ['Year', 'Yield'] }),
};

const wrapper = ({ children }) => <SharedDatasetProvider>{children}</SharedDatasetProvider>;

// One workspace, two screens: `loader` is the screen the user is on, `screen` is the module they open next
const renderTwoScreens = (onLoaded) => renderHook(
  ({ open }) => ({ loader: useDataset({ active: true }), screen: useDataset({ active: open, onLoaded }) }),
  { wrapper, initialProps: { open: false } },
);

describe('carrying one dataset across the workspace', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => columnsResponse);
  });

  it('starts a newly opened screen on the dataset the previous one loaded', async () => {
    const onLoaded = vi.fn();
    const { result, rerender } = renderTwoScreens(onLoaded);

    await act(async () => { await result.current.loader.selectFile(csv('weather.csv')); });
    expect(result.current.screen.file).toBeNull();
    expect(onLoaded).not.toHaveBeenCalled();

    rerender({ open: true });

    await waitFor(() => expect(result.current.screen.file).not.toBeNull());
    expect(result.current.screen.file.name).toBe('weather.csv');
    expect(result.current.screen.columns).toEqual(['Year', 'Yield', 'Block']);
    // The columns are reported, so the screen picks its defaults exactly as it would after an upload
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onLoaded.mock.calls[0][0].numericColumns).toEqual(['Year', 'Yield']);
  });

  it('remembers where a stored dataset came from when another screen adopts it', async () => {
    global.fetch = vi.fn(async (url) => (
      String(url).includes('/workspace/datasets/7/download')
        ? { ok: true, status: 200, headers: { get: () => 'text/csv' }, blob: async () => new Blob(['Year,Yield\n2020,5\n']) }
        : columnsResponse
    ));
    const { result, rerender } = renderTwoScreens(vi.fn());

    await act(async () => {
      await result.current.loader.selectProjectDataset(
        { id: 7, filename: 'weather.csv', project_id: 3, content_type: 'text/csv' }, 'Bhopal weather study');
    });
    rerender({ open: true });

    await waitFor(() => expect(result.current.screen.file).not.toBeNull());
    expect(result.current.screen.source).toEqual({
      kind: 'project', datasetId: 7, projectId: 3, projectName: 'Bhopal weather study',
    });
  });

  it('keeps the dataset when a screen closes, and drops it when the user chooses another', async () => {
    const { result, rerender } = renderTwoScreens(vi.fn());
    await act(async () => { await result.current.loader.selectFile(csv()); });
    rerender({ open: true });
    await waitFor(() => expect(result.current.screen.file).not.toBeNull());

    // Closing a screen resets that screen only: reopening finds the dataset again
    rerender({ open: false });
    act(() => { result.current.screen.clear(); });
    rerender({ open: true });
    await waitFor(() => expect(result.current.screen.file).not.toBeNull());

    // "Choose Other Dataset" drops it from the workspace, so the screen stays empty instead of adopting again
    act(() => { result.current.screen.clear({ forget: true }); });
    expect(result.current.screen.file).toBeNull();
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(result.current.screen.loading).toBe(false));
    expect(result.current.screen.file).toBeNull();
  });
});
