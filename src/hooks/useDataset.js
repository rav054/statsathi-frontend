import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, useAuth } from '../context/AuthContext';
import { useSharedDataset } from '../context/SharedDatasetContext';
import { workspaceApi } from '../utils/workspaceApi';

export const SUPPORTED_EXTENSIONS = ['csv', 'xlsx', 'xls'];

export const isSupportedFile = (file) => SUPPORTED_EXTENSIONS.includes(file.name.split('.').pop().toLowerCase());

/**
 * The dataset an analysis screen is working on: the file itself, where it came from, and its columns.
 *
 * Every module used to repeat this: validate the file, POST it to /analyze/columns, remember the column names.
 * `onLoaded({ columns, numericColumns, file })` runs after a dataset is read, so a screen can pick its default
 * columns; `onCleared` runs when the dataset is removed.
 *
 * A loaded dataset is published to the workspace, and while `active` is true (a screen passes its own `isOpen`)
 * an empty screen adopts whatever the workspace already has, so the user picks a dataset once per session.
 */
export const useDataset = ({ onLoaded, onCleared, active = false } = {}) => {
  const { token } = useAuth();
  const { shared, setShared } = useSharedDataset();
  const [file, setFile] = useState(null);
  const [source, setSource] = useState(null); // { kind: 'upload' } or { kind: 'project', datasetId, projectId, projectName }
  const [columns, setColumns] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep the callbacks in refs so screens do not have to memoize them
  const loadedRef = useRef(onLoaded);
  const clearedRef = useRef(onCleared);
  useEffect(() => {
    loadedRef.current = onLoaded;
    clearedRef.current = onCleared;
  });

  const readColumns = useCallback(async (nextFile, nextSource) => {
    if (!isSupportedFile(nextFile)) {
      setError(`Supported formats: ${SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(', ')} only.`);
      return null;
    }
    setLoading(true);
    setError(null);
    const body = new FormData();
    body.append('file', nextFile);
    try {
      const res = await fetch(`${API_URL}/analyze/columns`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to read the dataset columns.');
      const loaded = { file: nextFile, columns: data.columns || [], numericColumns: data.numeric_columns || [] };
      setFile(nextFile);
      setSource(nextSource);
      setColumns(loaded.columns);
      setNumericColumns(loaded.numericColumns);
      setShared({ ...loaded, source: nextSource });
      loadedRef.current?.(loaded);
      return loaded;
    } catch (err) {
      setError(err.message);
      setFile(null);
      setSource(null);
      setColumns([]);
      setNumericColumns([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, setShared]);

  const selectFile = useCallback((nextFile) => readColumns(nextFile, { kind: 'upload' }), [readColumns]);

  const selectProjectDataset = useCallback(async (dataset, projectName) => {
    setLoading(true);
    setError(null);
    try {
      const blob = await workspaceApi(token).downloadDataset(dataset.id);
      const stored = new File([blob], dataset.filename, { type: dataset.content_type || 'text/csv' });
      return await readColumns(stored, {
        kind: 'project', datasetId: dataset.id, projectId: dataset.project_id, projectName
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [token, readColumns]);

  /**
   * Remove the dataset from this screen. `{ forget: true }` (the picker's "Choose Other Dataset") drops it from the
   * workspace as well; closing a screen keeps it, so the next module still opens on the same data.
   */
  const clear = useCallback((options) => {
    setFile(null);
    setSource(null);
    setColumns([]);
    setNumericColumns([]);
    setError(null);
    if (options?.forget === true) setShared(null);
    clearedRef.current?.();
  }, [setShared]);

  // An empty screen starts on the dataset the workspace is already working with
  const failedAdoption = useRef(null);
  useEffect(() => {
    if (!active || file || !shared?.file || failedAdoption.current === shared.file) return;
    // The columns are read again rather than copied, so the screen's onLoaded picks its defaults exactly as it
    // would after an upload; a file that cannot be read is not offered again.
    readColumns(shared.file, shared.source).then(loaded => {
      if (!loaded) failedAdoption.current = shared.file;
    });
  }, [active, file, shared, readColumns]);

  return { file, source, columns, numericColumns, loading, error, setError, selectFile, selectProjectDataset, clear };
};
