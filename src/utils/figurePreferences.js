import { useCallback, useState } from 'react';
import STYLE from '../theme/figure_style.json';

const STORAGE_KEY = 'statsathi_figure_preferences';

const readPreferences = () => {
  const defaults = { preset: STYLE.default_preset, palette: STYLE.default_palette };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      preset: STYLE.presets[stored.preset] ? stored.preset : defaults.preset,
      palette: STYLE.palettes[stored.palette] ? stored.palette : defaults.palette
    };
  } catch {
    return defaults;
  }
};

// The user's preferred figure size preset and palette, remembered in this browser
export const useFigurePreferences = () => {
  const [preferences, setPreferences] = useState(readPreferences);
  const updatePreferences = useCallback((changes) => {
    setPreferences(prev => {
      const next = { ...prev, ...changes };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode); keep the choice for this session only
      }
      return next;
    });
  }, []);
  return [preferences, updatePreferences];
};
