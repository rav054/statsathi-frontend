import React from 'react';
import { LayoutDashboard, FolderKanban, BookOpen } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'My Projects', icon: FolderKanban },
    { id: 'learning', label: 'Learning Hub', icon: BookOpen },
  ];

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] border-r border-slate-200 bg-white flex flex-col justify-between py-6 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="px-4 space-y-6">
        <div className="px-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">
            Workspace
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center space-x-3 rounded-xl px-4 py-3 font-sans text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50/70 text-brand-indigo shadow-xs dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-brand-indigo dark:text-indigo-300' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:border-slate-800 dark:bg-slate-800/50">
          <p className="font-display text-xs font-bold text-slate-700 dark:text-slate-200">Academic License</p>
          <p className="font-sans text-[10px] text-slate-400 mt-1 leading-normal dark:text-slate-400">
            Equipped with statistical tools optimized for peer-reviewed journal criteria.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
