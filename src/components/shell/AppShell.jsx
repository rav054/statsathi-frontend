import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Moon, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useModuleHost } from '../../context/ModuleHost';
import { workspaceApi } from '../../utils/workspaceApi';
import { WORKFLOW } from '../../utils/modules';
import EditProfileModal from '../EditProfileModal';
import CommandPalette from './CommandPalette';
import { BookIcon, DotsIcon, FolderIcon, HomeIcon, SearchIcon, UploadIcon } from './Icons';

const formatMb = (bytes) => { const mb = bytes / (1024 * 1024); return mb >= 10 ? mb.toFixed(0) : mb < 0.1 && bytes > 0 ? '<0.1' : mb.toFixed(1); };

const NAV = [
  { id: 'dashboard', label: 'Home', Icon: HomeIcon },
  { id: 'projects', label: 'Projects', Icon: FolderIcon },
  { id: 'learning', label: 'Learning Hub', Icon: BookIcon },
];

export const Wordmark = ({ className = 'text-[19px]' }) => (
  <span className={`font-display font-bold tracking-tight text-ink dark:text-night-ink ${className}`}>
    Stat<span className="text-brand-indigo dark:text-brand-periwinkle">Sathi</span>
  </span>
);

const Avatar = ({ name, className = 'h-[34px] w-[34px] text-[13px]' }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-navy font-bold text-white dark:bg-night-ink dark:text-night ${className}`}>
    {(name || '?').charAt(0).toUpperCase()}
  </span>
);

// Profile, theme and sign-out, opened from the user card (desktop) or the avatar (phone)
const UserMenu = ({ open, onClose, onEditProfile, placement }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  if (!open || !user) return null;
  return (
    <div className={`absolute z-50 w-60 rounded-2xl border border-line bg-surface p-2 shadow-xl animate-fade-in dark:border-night-line dark:bg-night-surface ${placement}`}>
      <div className="border-b border-line px-3 py-2.5 dark:border-night-line">
        <p className="font-sans text-sm font-semibold text-ink dark:text-night-ink">{user.full_name}</p>
        <p className="truncate font-sans text-xs text-muted dark:text-night-muted">{user.email}</p>
      </div>
      <button type="button" onClick={() => { onClose(); onEditProfile(); }}
        className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-sans text-sm text-ink-2 hover:bg-soft dark:text-night-ink dark:hover:bg-night-soft cursor-pointer">
        <UserIcon className="h-4 w-4 text-faint" /> Profile, password and data
      </button>
      <button type="button" onClick={toggleTheme}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-sans text-sm text-ink-2 hover:bg-soft dark:text-night-ink dark:hover:bg-night-soft cursor-pointer">
        {isDark ? <Sun className="h-4 w-4 text-faint" /> : <Moon className="h-4 w-4 text-faint" />}
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>
      <button type="button" onClick={() => { onClose(); logout(); }}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-sans text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
};

const useClickOutside = (ref, onOutside) => {
  useEffect(() => {
    const handler = (event) => { if (ref.current && !ref.current.contains(event.target)) onOutside(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
};

/**
 * The app frame from the redesign: a navigation rail on desktop (search, Home/Projects/Learning Hub, the six
 * workflow steps, storage and the user card), and a top bar plus bottom bar on phones.
 */
const AppShell = ({ activeTab, onNavigate, onOpenProject, onSignIn, onWorkflowStep, children }) => {
  const { user, token } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { openTool, chooseUpload } = useModuleHost();
  const api = useMemo(() => workspaceApi(token), [token]);
  const [projects, setProjects] = useState([]);
  const [storage, setStorage] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null); // 'rail' | 'top'
  const [profileOpen, setProfileOpen] = useState(false);
  const railMenuRef = useRef(null);
  const topMenuRef = useRef(null);
  const closeMenu = useMemo(() => () => setMenuOpen(null), []);
  useClickOutside(menuOpen === 'rail' ? railMenuRef : topMenuRef, closeMenu);

  // Project count, search list and storage; refreshed when the user moves between pages
  useEffect(() => {
    if (!user || !token) return undefined;
    let active = true;
    Promise.all([api.listProjects(), api.storage()])
      .then(([list, usage]) => { if (active) { setProjects(list); setStorage(usage); } })
      .catch(() => {});
    return () => { active = false; };
  }, [api, user, token, activeTab]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const usedPct = storage ? Math.min(100, Math.round((storage.used_bytes / storage.limit_bytes) * 100)) : 0;
  const visibleProjects = user ? projects : [];

  return (
    <div className="flex min-h-screen bg-canvas text-ink dark:bg-night dark:text-night-ink">
      {/* Desktop navigation rail */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-4 py-5 md:flex dark:border-night-line dark:bg-night-surface">
        <button type="button" onClick={() => onNavigate('dashboard')} className="flex items-center gap-2.5 px-1.5 text-left cursor-pointer">
          <img src="/statsathi-mark.svg" alt="" className="h-[34px] w-[34px]" />
          <span className="flex flex-col">
            <Wordmark />
            <span className="font-sans text-[10.5px] tracking-[0.02em] text-muted dark:text-night-muted">Research analytics companion</span>
          </span>
        </button>

        <button type="button" onClick={() => setPaletteOpen(true)}
          className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-[#F8F9FB] px-2.5 font-sans text-[13px] text-faint hover:border-[#C7CCF9] dark:border-night-line dark:bg-night cursor-pointer">
          <SearchIcon className="h-4 w-4" />
          <span className="flex-1 truncate whitespace-nowrap text-left">Find a test or project</span>
          <span className="rounded-[5px] border border-line bg-surface px-[5px] py-px font-mono text-[10.5px] text-muted dark:border-night-line dark:bg-night-soft">Ctrl K</span>
        </button>

        <nav aria-label="Workspace" className="flex flex-col gap-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 font-sans text-sm cursor-pointer ${active
                  ? 'bg-[#EEF0FF] font-semibold text-brand-violet dark:bg-night-soft dark:text-night-ink'
                  : 'font-medium text-ink-2 hover:bg-soft dark:text-night-muted dark:hover:bg-night-soft'}`}>
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-brand-indigo dark:text-brand-periwinkle' : 'text-muted'}`} />
                <span className="flex-1 text-left">{label}</span>
                {active && <span className="h-[7px] w-[7px] rounded-full bg-brand-orange" />}
                {!active && id === 'projects' && visibleProjects.length > 0 && (
                  <span className="font-mono text-[11px] text-faint">{visibleProjects.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1.5 font-sans text-[10.5px] font-bold tracking-[0.1em] text-faint">WORKFLOW</span>
          {WORKFLOW.map(step => (
            <button key={step.id} type="button" onClick={() => onWorkflowStep(step.id)}
              className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-left font-sans text-[13.5px] text-ink-2 hover:bg-soft dark:text-night-muted dark:hover:bg-night-soft cursor-pointer">
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] font-mono text-[9.5px] font-semibold text-white"
                style={{ backgroundImage: `linear-gradient(135deg, ${step.accent.from}, ${step.accent.to})` }}>{step.number}</span>
              {step.title}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {user && storage && (
          <div className="flex flex-col gap-2 px-2.5">
            <div className="flex justify-between font-sans text-[11.5px] text-muted dark:text-night-muted">
              <span>Storage</span>
              <span className="font-mono">{formatMb(storage.used_bytes)} / {formatMb(storage.limit_bytes)} MB</span>
            </div>
            <div className="h-1 overflow-hidden rounded bg-[#EEF0F4] dark:bg-night-soft">
              <div className={`h-full ${usedPct > 90 ? 'bg-rose-500' : 'bg-brand-indigo'}`} style={{ width: `${Math.max(usedPct, 1)}%` }} />
            </div>
          </div>
        )}

        {user ? (
          <div ref={railMenuRef} className="relative">
            <button type="button" onClick={() => setMenuOpen(menuOpen === 'rail' ? null : 'rail')} aria-label="Account menu"
              className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2.5 text-left hover:bg-soft dark:border-night-line dark:hover:bg-night-soft cursor-pointer">
              <Avatar name={user.full_name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-sans text-[13px] font-semibold">{user.full_name}</span>
                <span className="truncate font-sans text-[11px] text-muted dark:text-night-muted">{user.institution || user.email}</span>
              </span>
              <DotsIcon className="h-4 w-4 text-faint" />
            </button>
            <UserMenu open={menuOpen === 'rail'} onClose={closeMenu} onEditProfile={() => setProfileOpen(true)} placement="bottom-full left-0 mb-2" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={onSignIn}
              className="h-10 rounded-xl bg-brand-indigo font-sans text-sm font-semibold text-white hover:bg-brand-violet cursor-pointer">
              Log in
            </button>
            <button type="button" onClick={toggleTheme}
              className="flex h-9 items-center justify-center gap-2 rounded-xl border border-line font-sans text-[13px] text-ink-2 dark:border-night-line dark:text-night-muted cursor-pointer">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-40 flex h-[60px] items-center gap-2.5 border-b border-line bg-surface/95 px-4 backdrop-blur-sm md:hidden dark:border-night-line dark:bg-night-surface/95">
          <button type="button" onClick={() => onNavigate('dashboard')} className="flex flex-1 items-center gap-2.5 cursor-pointer">
            <img src="/statsathi-mark.svg" alt="" className="h-[30px] w-[30px]" />
            <Wordmark className="text-lg" />
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Find a test or project"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 dark:border-night-line dark:bg-night-soft dark:text-night-ink cursor-pointer">
            <SearchIcon className="h-[18px] w-[18px]" />
          </button>
          {user ? (
            <div ref={topMenuRef} className="relative">
              <button type="button" onClick={() => setMenuOpen(menuOpen === 'top' ? null : 'top')} aria-label="Account menu" className="flex h-11 w-11 items-center justify-center cursor-pointer">
                <Avatar name={user.full_name} className="h-9 w-9 text-[13px]" />
              </button>
              <UserMenu open={menuOpen === 'top'} onClose={closeMenu} onEditProfile={() => setProfileOpen(true)} placement="right-0 top-full mt-2" />
            </div>
          ) : (
            <button type="button" onClick={onSignIn} className="h-11 rounded-xl bg-brand-indigo px-4 font-sans text-sm font-semibold text-white cursor-pointer">Log in</button>
          )}
        </header>

        <div className="flex min-w-0 flex-1 flex-col pb-[76px] md:pb-0">
          {children}
        </div>

        {/* Phone bottom bar */}
        <nav aria-label="Workspace" className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-4 border-t border-line bg-surface px-2 pb-3.5 pt-1.5 md:hidden dark:border-night-line dark:bg-night-surface">
          {[
            { id: 'dashboard', label: 'Home', Icon: HomeIcon, action: () => onNavigate('dashboard') },
            { id: 'projects', label: 'Projects', Icon: FolderIcon, action: () => onNavigate('projects') },
            { id: 'upload', label: 'Upload', Icon: UploadIcon, action: chooseUpload },
            { id: 'learning', label: 'Learn', Icon: BookIcon, action: () => onNavigate('learning') },
          ].map(({ id, label, Icon, action }) => {
            const active = activeTab === id;
            return (
              <button key={id} type="button" onClick={action} aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-[3px] font-sans text-[11.5px] cursor-pointer ${active ? 'font-semibold text-brand-violet dark:text-brand-periwinkle' : 'text-muted dark:text-night-muted'}`}>
                <Icon className={`h-[22px] w-[22px] ${active ? 'text-brand-indigo dark:text-brand-periwinkle' : ''}`} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} projects={visibleProjects}
        onTool={openTool} onProject={onOpenProject} />
      <EditProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default AppShell;
