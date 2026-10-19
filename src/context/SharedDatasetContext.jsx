import { createContext, useContext, useMemo, useState } from 'react';

/**
 * The dataset the user is currently working on, shared by the whole workspace.
 *
 * Picking a file in one module (or on the dashboard) makes it the starting point for the next one, so a dataset is
 * chosen once per session instead of once per screen. `columns` is null when the file has not been read yet — the
 * module that adopts it reads the columns then and republishes them, so it only happens once.
 */
const SharedDatasetContext = createContext(null);

export const SharedDatasetProvider = ({ children }) => {
  const [shared, setShared] = useState(null); // { file, source, columns, numericColumns } or null
  const value = useMemo(() => ({ shared, setShared }), [shared]);
  return <SharedDatasetContext.Provider value={value}>{children}</SharedDatasetContext.Provider>;
};

// Screens rendered outside the provider (tests, isolated previews) simply have no shared dataset
const NO_SHARING = { shared: null, setShared: () => {} };

export const useSharedDataset = () => useContext(SharedDatasetContext) || NO_SHARING;
