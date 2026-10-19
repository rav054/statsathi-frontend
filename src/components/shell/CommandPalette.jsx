import { useEffect, useMemo, useRef, useState } from 'react';
import { searchTools, stepOfTool } from '../../utils/modules';
import { FolderIcon, SearchIcon } from './Icons';

/**
 * "Find a test or project": type a few words ("rank test", "dmrt", a project name) and press Enter.
 * Opens with Ctrl K / Cmd K from anywhere, or from the search box in the navigation rail.
 */
const CommandPalette = ({ open, onClose, projects = [], onTool, onProject }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    const tools = searchTools(query).slice(0, 7).map(tool => ({ kind: 'tool', key: `tool-${tool.id}`, ...tool }));
    const words = query.trim().toLowerCase();
    const matchingProjects = words
      ? projects.filter(p => p.name.toLowerCase().includes(words)).slice(0, 5).map(p => ({ kind: 'project', key: `project-${p.id}`, project: p }))
      : [];
    return [...tools, ...matchingProjects];
  }, [query, projects]);

  if (!open) return null;

  const choose = (item) => {
    if (!item) return;
    setQuery('');
    setActive(0);
    onClose();
    if (item.kind === 'tool') onTool(item.id);
    else onProject(item.project.id);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(i => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Find a test or project" data-theme-aware
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh] backdrop-blur-xs animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl dark:border-night-line dark:bg-night-surface">
        <div className="flex items-center gap-3 border-b border-line px-4 dark:border-night-line">
          <SearchIcon className="h-5 w-5 text-faint" />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
            placeholder="Find a test or project, e.g. “rank test” or “dmrt”" aria-label="Search tests and projects"
            className="h-14 flex-1 bg-transparent font-sans text-[15px] text-ink outline-hidden placeholder:text-faint dark:text-night-ink" />
          <button type="button" data-dialog-close onClick={onClose}
            className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-muted dark:border-night-line cursor-pointer">Esc</button>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() === '' && (
            <li className="px-3 py-6 text-center font-sans text-sm text-muted">Type what you want to do: a test, a method or a project name.</li>
          )}
          {query.trim() !== '' && results.length === 0 && (
            <li className="px-3 py-6 text-center font-sans text-sm text-muted">Nothing matches “{query}”.</li>
          )}
          {results.map((item, index) => (
            <li key={item.key} role="option" aria-selected={index === active}>
              <button type="button" onMouseEnter={() => setActive(index)} onClick={() => choose(item)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer ${index === active ? 'bg-indigo-50 dark:bg-night-soft' : ''}`}>
                {item.kind === 'tool' ? (
                  <>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-semibold text-white"
                      style={{ backgroundImage: `linear-gradient(135deg, ${stepOfTool(item.id)?.accent.from}, ${stepOfTool(item.id)?.accent.to})` }}>{stepOfTool(item.id)?.number}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-sans text-sm font-semibold text-ink dark:text-night-ink">{item.label}</span>
                      <span className="truncate font-sans text-xs text-muted dark:text-night-muted">{item.description}</span>
                    </span>
                    <span className="font-sans text-[11px] text-faint">{stepOfTool(item.id)?.title}</span>
                  </>
                ) : (
                  <>
                    <FolderIcon className="h-4 w-6 text-muted" />
                    <span className="flex-1 font-sans text-sm font-semibold text-ink dark:text-night-ink">{item.project.name}</span>
                    <span className="font-sans text-[11px] text-faint">Project</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;
