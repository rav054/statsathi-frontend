import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSupportedFile, useDataset } from './useDataset';

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

describe('the dataset an analysis works on', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => columnsResponse);
  });

  it('accepts the spreadsheet formats the API can read', () => {
    expect(isSupportedFile(csv('data.csv'))).toBe(true);
    expect(isSupportedFile(csv('data.XLSX'))).toBe(true);
    expect(isSupportedFile(csv('notes.txt'))).toBe(false);
  });

  it('reads the columns of an uploaded file and reports them once', async () => {
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useDataset({ onLoaded }));

    await act(async () => { await result.current.selectFile(csv()); });

    expect(result.current.file.name).toBe('trial.csv');
    expect(result.current.columns).toEqual(['Year', 'Yield', 'Block']);
    expect(result.current.numericColumns).toEqual(['Year', 'Yield']);
    expect(result.current.source).toEqual({ kind: 'upload' });
    expect(result.current.error).toBeNull();
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onLoaded.mock.calls[0][0].columns).toEqual(['Year', 'Yield', 'Block']);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://api.test/analyze/columns');
    expect(options.headers.Authorization).toBe('Bearer test-token');
  });

  it('refuses a file the API cannot read, without calling the API', async () => {
    const { result } = renderHook(() => useDataset());
    await act(async () => { await result.current.selectFile(csv('photo.png')); });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/\.csv/);
    expect(result.current.file).toBeNull();
  });

  it('keeps the message when the API rejects the file', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 400, headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'The file is empty.' }),
    }));
    const { result } = renderHook(() => useDataset());
    await act(async () => { await result.current.selectFile(csv()); });
    expect(result.current.error).toBe('The file is empty.');
    expect(result.current.file).toBeNull();
    expect(result.current.columns).toEqual([]);
  });

  it('downloads a dataset stored in a project and remembers where it came from', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/workspace/datasets/7/download')) {
        return { ok: true, status: 200, headers: { get: () => 'text/csv' }, blob: async () => new Blob(['Year,Yield\n2020,5\n']) };
      }
      return columnsResponse;
    });
    const { result } = renderHook(() => useDataset());

    await act(async () => {
      await result.current.selectProjectDataset(
        { id: 7, filename: 'weather.csv', project_id: 3, content_type: 'text/csv' }, 'Bhopal weather study');
    });

    await waitFor(() => expect(result.current.file).not.toBeNull());
    expect(result.current.file.name).toBe('weather.csv');
    expect(result.current.source).toEqual({ kind: 'project', datasetId: 7, projectId: 3, projectName: 'Bhopal weather study' });
    expect(result.current.columns).toEqual(['Year', 'Yield', 'Block']);
  });

  it('forgets everything when the dataset is cleared', async () => {
    const onCleared = vi.fn();
    const { result } = renderHook(() => useDataset({ onCleared }));
    await act(async () => { await result.current.selectFile(csv()); });
    act(() => { result.current.clear(); });

    expect(result.current.file).toBeNull();
    expect(result.current.columns).toEqual([]);
    expect(result.current.source).toBeNull();
    expect(onCleared).toHaveBeenCalledTimes(1);
  });
});
