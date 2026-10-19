import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModuleHost } from '../context/ModuleHost';
import { workspaceApi } from '../utils/workspaceApi';
import { TOOLS, WORKFLOW } from '../utils/modules';
import ToolButton from './ToolButton';
import { formatStat, moduleName, relativeTime, summariseResult } from '../utils/resultSummary';
import { canReopen, storeAnalysisHandoff } from '../utils/analysisHandoff';
import { ChevronRightIcon, DatabaseIcon, DocumentIcon, PlusIcon, UploadIcon } from './shell/Icons';

const greeting = (now = new Date()) => {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const PROJECT_DOTS = ['bg-brand-indigo', 'bg-brand-emerald', 'bg-faint'];

// Mean bars with post-hoc letters: the top group in periwinkle, its best level in the tangerine outlier colour
export const MiniBars = ({ summary, width = 266, height = 176, dark = true, compact = false }) => {
  const bars = summary.bars;
  if (compact) {
    // A thumbnail: the bars alone, coloured by post-hoc group
    const max = Math.max(...bars.map(b => b.mean)) || 1;
    const gap = 4;
    const barWidth = (width - gap * (bars.length - 1)) / bars.length;
    const best = bars.reduce((a, b) => (b.mean > a.mean ? b : a), bars[0]);
    const lowest = bars.reduce((a, b) => (b.mean < a.mean ? b : a), bars[0]);
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {bars.map((bar, i) => {
          const h = Math.max(4, (bar.mean / max) * (height - 2));
          const fill = summary.topGroup.has(bar.name) ? '#4F46E5' : bar === lowest ? '#CBD5E1' : '#A5B4FC';
          return <rect key={bar.name} x={i * (barWidth + gap)} y={height - h} width={barWidth} height={h} rx="2" fill={bar === best && summary.topGroup.size <= 1 ? '#4F46E5' : fill} />;
        })}
      </svg>
    );
  }
  const max = Math.max(...bars.map(b => b.mean + (b.se || 0)));
  const top = max > 0 ? Math.ceil(max * 1.15) : 1;
  const plotTop = 24, baseline = height - 26, left = 24;
  const slot = (width - left) / bars.length;
  const barWidth = Math.min(30, slot * 0.62);
  const y = (value) => baseline - (value / top) * (baseline - plotTop);
  const best = bars.reduce((a, b) => (b.mean > a.mean ? b : a), bars[0]);
  const lowest = bars.reduce((a, b) => (b.mean < a.mean ? b : a), bars[0]);
  const fill = (bar) => {
    if (bar === best) return '#F97316';
    if (summary.topGroup.has(bar.name)) return '#818CF8';
    if (bar === lowest) return dark ? '#475569' : '#CBD5E1';
    return '#6366F1';
  };
  const text = dark ? '#E2E8F0' : '#0F172A';
  const axis = dark ? '#94A3B8' : '#64748B';
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Group means with post-hoc letters">
      <line x1={left} y1={baseline} x2={width - 4} y2={baseline} stroke={dark ? '#334155' : '#CBD5E1'} />
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={left} x2={width - 4} y1={baseline - f * (baseline - plotTop)} y2={baseline - f * (baseline - plotTop)}
          stroke={dark ? '#1E293B' : '#E8EBF1'} strokeDasharray="2 4" />
      ))}
      <text x={left - 6} y={baseline + 3} fill="#64748B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono, monospace">0</text>
      <text x={left - 6} y={plotTop + 3} fill="#64748B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono, monospace">{top}</text>
      {bars.map((bar, i) => {
        const cx = left + slot * i + slot / 2;
        return (
          <g key={bar.name}>
            <rect x={cx - barWidth / 2} y={y(bar.mean)} width={barWidth} height={baseline - y(bar.mean)} rx="3" fill={fill(bar)} />
            {bar.letter && <text x={cx} y={y(bar.mean) - 6} fill={text} fontSize="11" fontWeight="700" textAnchor="middle">{bar.letter}</text>}
            <text x={cx} y={baseline + 15} fill={axis} fontSize="9.5" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {bar.name.length > 6 ? `${bar.name.slice(0, 5)}…` : bar.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const Card = ({ className = '', children, ...rest }) => (
  <section {...rest} className={`rounded-2xl border border-line bg-surface dark:border-night-line dark:bg-night-surface ${className}`}>{children}</section>
);

const Home = ({ onSignIn, onOpenProject, onNewProject, focusStep }) => {
  const { user, token } = useAuth();
  const { openTool, openHandoff, file, source, chooseUpload, acceptFile, openStored, openViewer, removeFile, datasetError } = useModuleHost();
  const api = useMemo(() => workspaceApi(token), [token]);
  const [projects, setProjects] = useState([]);
  const [latest, setLatest] = useState(null); // { result, project, datasets }
  const [invitations, setInvitations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const [openStep, setOpenStep] = useState(null);

  // A saved analysis sent here from the Projects page opens straight away
  useEffect(() => { openHandoff(); }, [openHandoff]);

  useEffect(() => {
    if (!user || !token) return undefined;
    let active = true;
    (async () => {
      try {
        const [list, invites] = await Promise.all([api.listProjects(), api.invitations().catch(() => ({ invitations: [] }))]);
        if (!active) return;
        setProjects(list);
        setInvitations(invites.invitations || []);
        // The most recent saved result among the most recently changed projects
        const recent = [...list].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).filter(p => p.result_count > 0).slice(0, 3);
        const details = await Promise.all(recent.map(p => api.getProject(p.id)));
        const candidates = details.flatMap(d => d.results.map(r => ({ result: r, project: d })));
        candidates.sort((a, b) => (b.result.created_at || '').localeCompare(a.result.created_at || ''));
        if (candidates[0]) {
          const full = await api.getResult(candidates[0].result.id);
          if (active) setLatest({ result: full, project: candidates[0].project });
        }
      } catch (err) {
        // The rest of Home still works; the card says so rather than pretending there is no saved work
        if (active) setLoadError(err.message);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [api, user, token, reloadKey]);

  // A workflow step chosen in the navigation rail is brought into view and outlined for a moment
  const [seenFocus, setSeenFocus] = useState(null);
  if (focusStep !== seenFocus) {
    setSeenFocus(focusStep);
    setHighlight(focusStep?.id || null);
  }
  useEffect(() => {
    if (!focusStep?.id) return undefined;
    document.getElementById(`step-${focusStep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlight(null), 1600);
    return () => clearTimeout(timer);
  }, [focusStep]);

  const summary = latest ? summariseResult(latest.result.module, latest.result.result, latest.result.parameters) : null;
  const recentProjects = [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 3);
  const firstName = user?.full_name?.split(' ')[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const resume = () => {
    if (!latest) return;
    const { result, project } = latest;
    if (!canReopen(result.module)) {
      onOpenProject(project.id);
      return;
    }
    const dataset = project.datasets.find(d => d.id === result.dataset_id) || null;
    storeAnalysisHandoff({ module: result.module, title: result.title, parameters: result.parameters || {}, result: result.result,
      savedAt: result.created_at, projectName: project.name, dataset });
    openHandoff();
  };

  const answerInvitation = async (invitation, accept) => {
    try {
      if (accept) await api.acceptInvitation(invitation.id);
      else await api.declineInvitation(invitation.id);
      setInvitations(list => list.filter(i => i.id !== invitation.id));
      if (accept) onOpenProject(invitation.project_id);
    } catch {
      // the Projects page shows invitation errors in full
      onOpenProject(null);
    }
  };

  return (
    <main className="flex flex-col gap-7 px-4 py-6 md:px-10 md:pb-10 md:pt-8 animate-fade-in">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[13px] text-muted dark:text-night-muted">{today}</span>
          <h1 className="font-display text-[28px] font-bold leading-[1.1] md:text-[36px]">
            {user ? `${greeting()}, ${firstName}.` : 'Welcome to StatSathi.'}
          </h1>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={user ? onNewProject : onSignIn}
            className="flex h-[42px] items-center gap-2 whitespace-nowrap rounded-[11px] border border-[#DDE1EA] bg-surface px-4 font-sans text-sm font-semibold hover:bg-soft dark:border-night-line dark:bg-night-surface dark:hover:bg-night-soft cursor-pointer">
            <PlusIcon className="h-4 w-4 text-ink-2 dark:text-night-muted" /> New project
          </button>
          <button type="button" onClick={chooseUpload}
            className="flex h-[42px] items-center gap-2 whitespace-nowrap rounded-[11px] bg-brand-indigo px-[18px] font-sans text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_-6px_rgba(79,70,229,0.6)] hover:bg-brand-violet cursor-pointer">
            <UploadIcon className="h-4 w-4" /> Upload data
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Continue where you left off */}
        <section className="relative flex min-h-[268px] flex-col gap-7 overflow-hidden rounded-[20px] bg-brand-navy p-6 text-white md:flex-row md:p-7 lg:col-span-2 dark:border dark:border-night-line">
          <div className="pointer-events-none absolute inset-0 bg-graph-paper-dark" />
          <svg className="pointer-events-none absolute -right-10 -top-24" width="560" height="260" aria-hidden="true">
            <ellipse cx="300" cy="120" rx="260" ry="120" fill="none" stroke="#312E81" strokeDasharray="3 5" transform="rotate(-18 300 120)" />
          </svg>
          <div className="relative flex min-w-0 flex-1 flex-col gap-3.5">
            <div className="flex items-center gap-2 font-sans text-xs font-semibold tracking-[0.06em] text-[#A5B4FC]">
              <span className="h-[7px] w-[7px] rounded-full bg-brand-orange" />
              {latest ? 'CONTINUE WHERE YOU LEFT OFF' : loadError ? 'YOUR LATEST ANALYSIS' : 'START HERE'}
            </div>
            {latest ? (
              <>
                <h2 className="font-display text-[22px] font-bold leading-[1.2] md:text-[26px]">{latest.result.title}</h2>
                <p className="max-w-[440px] font-sans text-[14.5px] leading-[1.55] text-[#CBD5E1]">
                  {summary ? `${summary.headline} ${summary.detail || ''}` : `${moduleName(latest.result.module)} saved in ${latest.project.name}.`}
                </p>
                {summary && (
                  <div className="flex flex-wrap gap-x-[18px] gap-y-1 font-mono text-[12.5px] text-faint">
                    {summary.stats.map(stat => <span key={stat.label}>{formatStat(stat)}</span>)}
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex flex-wrap gap-2.5">
                  <button type="button" onClick={resume} className="h-10 rounded-[10px] bg-white px-[18px] font-sans text-sm font-semibold text-brand-navy hover:bg-[#EEF0FF] cursor-pointer">
                    {canReopen(latest.result.module) ? 'Resume analysis' : 'Open result'}
                  </button>
                  <button type="button" onClick={() => onOpenProject(latest.project.id)} className="h-10 rounded-[10px] border border-[#334155] px-4 font-sans text-sm font-medium text-[#E2E8F0] hover:bg-white/5 cursor-pointer">
                    Open project
                  </button>
                </div>
                <span className="font-sans text-xs text-muted">Saved {relativeTime(latest.result.created_at).toLowerCase()} in {latest.project.name}</span>
              </>
            ) : (
              <>
                <h2 className="font-display text-[22px] font-bold leading-[1.2] md:text-[26px]">
                  {!user ? 'Statistics for field and lab research' : loadError ? 'Your saved work could not be loaded' : loaded ? 'Run your first analysis' : 'Looking for your latest analysis…'}
                </h2>
                <p className="max-w-[440px] font-sans text-[14.5px] leading-[1.55] text-[#CBD5E1]">
                  {!user
                    ? 'Prepare data, compare treatments, model responses and write up the methods, all in one place. Sign in to save your work to projects.'
                    : loadError || 'Add a dataset, choose a step below and save the result to a project. Your latest analysis then waits here, ready to pick up.'}
                </p>
                <div className="flex-1" />
                <div className="flex flex-wrap gap-2.5">
                  {loadError ? (
                    <button type="button" onClick={() => { setLoadError(null); setLoaded(false); setReloadKey(n => n + 1); }}
                      className="h-10 rounded-[10px] bg-white px-[18px] font-sans text-sm font-semibold text-brand-navy hover:bg-[#EEF0FF] cursor-pointer">
                      Try again
                    </button>
                  ) : (
                    <button type="button" onClick={user ? chooseUpload : onSignIn} className="h-10 rounded-[10px] bg-white px-[18px] font-sans text-sm font-semibold text-brand-navy hover:bg-[#EEF0FF] cursor-pointer">
                      {user ? 'Upload data' : 'Log in or sign up'}
                    </button>
                  )}
                  <button type="button" onClick={() => openTool('anova')} className="h-10 rounded-[10px] border border-[#334155] px-4 font-sans text-sm font-medium text-[#E2E8F0] hover:bg-white/5 cursor-pointer">
                    Try ANOVA
                  </button>
                </div>
              </>
            )}
          </div>
          {summary?.bars && (
            <div className="relative flex w-full shrink-0 flex-col gap-2 rounded-[14px] border border-[#1E293B] bg-white/[0.04] p-4 md:w-[300px]">
              <span className="font-sans text-[11.5px] text-faint">{latest.result.parameters?.dependent || 'Response'} · group means</span>
              <MiniBars summary={summary} />
            </div>
          )}
        </section>

        {/* Start with your data */}
        <section
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (user) acceptFile(e.dataTransfer.files?.[0]); else onSignIn(); }}
          className={`flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-dashed bg-surface p-6 dark:bg-night-surface ${dragging ? 'border-brand-indigo bg-[#F5F6FF]' : 'border-[#C7CCF9] dark:border-night-line'}`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF0FF] text-brand-indigo dark:bg-night-soft dark:text-brand-periwinkle">
            <DocumentIcon />
          </div>
          <h3 className="font-display text-[19px] font-bold">Start with your data</h3>
          <p className="font-sans text-[13.5px] leading-[1.55] text-muted dark:text-night-muted">
            Drop a CSV file here or choose one. It is shared with every analysis until you remove it.
          </p>
          {datasetError && <p role="alert" className="font-sans text-xs text-rose-600">{datasetError}</p>}
          <div className="flex-1" />
          <div className="flex flex-col gap-2">
            {file ? (
              <div className="flex items-center gap-2.5 rounded-[10px] bg-[#F6F7FA] px-3 py-2.5 font-sans text-[13px] dark:bg-night-soft">
                <DatabaseIcon className="h-4 w-4 shrink-0 text-brand-emerald" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="truncate text-[11px] text-faint">{source?.kind === 'project' ? `From ${source.projectName}` : 'From this device'}</span>
                </span>
                <button type="button" onClick={openViewer} className="font-semibold text-brand-indigo hover:text-brand-violet dark:text-brand-periwinkle cursor-pointer">View</button>
                <button type="button" onClick={removeFile} className="text-muted hover:text-rose-600 cursor-pointer">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={chooseUpload}
                className="flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#F6F7FA] font-sans text-[13px] font-semibold text-ink-2 hover:bg-[#EEF0FF] dark:bg-night-soft dark:text-night-ink cursor-pointer">
                <UploadIcon className="h-4 w-4" /> Choose a CSV file
              </button>
            )}
            <span className="font-sans text-xs text-muted dark:text-night-muted">
              or <button type="button" onClick={openStored} className="font-medium text-brand-indigo hover:text-brand-violet dark:text-brand-periwinkle cursor-pointer">use a dataset saved in a project</button>
            </span>
          </div>
        </section>
      </div>

      {/* What do you want to do? */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[21px] font-bold">What do you want to do?</h2>
          <span className="hidden font-sans text-[13px] text-muted sm:block dark:text-night-muted">Every tool, grouped by research step</span>
        </div>
        {/* Phones: one compact list; a step opens to show its tools */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface sm:hidden dark:border-night-line dark:bg-night-surface">
          {WORKFLOW.map((step, index) => {
            const expanded = openStep === step.id;
            return (
              <div key={step.id} className={index > 0 ? 'border-t border-[#F0F2F6] dark:border-night-line' : ''}>
                <button type="button" onClick={() => setOpenStep(expanded ? null : step.id)} aria-expanded={expanded}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3.5 text-left cursor-pointer">
                  <span className="w-5 font-mono text-[11.5px] font-semibold text-brand-indigo dark:text-brand-periwinkle">{step.number}</span>
                  <span className="flex min-w-0 flex-1 flex-col py-2">
                    <span className="font-sans text-[14.5px] font-semibold">{step.title}</span>
                    <span className="truncate font-sans text-xs text-muted dark:text-night-muted">{step.tools.map(id => TOOLS[id].label).join(', ')}</span>
                  </span>
                  <ChevronRightIcon className={`h-4 w-4 text-faint transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                {expanded && (
                  <div className="flex flex-wrap gap-2 px-3.5 pb-3.5 pl-[46px]">
                    {step.tools.map(toolId => (
                      <ToolButton key={toolId} id={toolId} accent={step.accent} featured={step.featured === toolId}
                        onClick={() => openTool(toolId)} className="min-h-10 px-2.5" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden grid-cols-1 gap-3.5 sm:grid sm:grid-cols-2 xl:grid-cols-3">
          {WORKFLOW.map(step => {
            const featured = Boolean(step.featured);
            return (
              <div key={step.id} id={`step-${step.id}`}
                className={`flex scroll-mt-24 flex-col gap-3 rounded-2xl border bg-surface p-[18px] transition-shadow dark:bg-night-surface ${featured
                  ? 'border-[#C7CCF9] shadow-[0_10px_24px_-18px_rgba(79,70,229,0.55)] dark:border-brand-indigo/50'
                  : 'border-line dark:border-night-line'} ${highlight === step.id ? 'ring-2 ring-brand-orange ring-offset-2 ring-offset-canvas dark:ring-offset-night' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg font-mono text-[11px] font-semibold text-white"
                    style={{ backgroundImage: `linear-gradient(135deg, ${step.accent.from}, ${step.accent.to})` }}>{step.number}</span>
                  <h3 className="font-display text-[17px] font-bold">{step.title}</h3>
                </div>
                <p className="font-sans text-[13px] leading-[1.5] text-muted dark:text-night-muted">{step.blurb}</p>
                <div className="flex flex-wrap gap-2">
                  {step.tools.map(toolId => (
                    <ToolButton key={toolId} id={toolId} accent={step.accent} featured={step.featured === toolId}
                      onClick={() => openTool(toolId)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {user && recentProjects.length > 0 && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className={`flex flex-col py-1.5 ${invitations.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="flex items-center justify-between px-[18px] pb-2 pt-3">
              <h3 className="font-display text-base font-bold">Recent projects</h3>
              <button type="button" onClick={() => onOpenProject(null)} className="font-sans text-[13px] font-semibold text-brand-indigo hover:text-brand-violet dark:text-brand-periwinkle cursor-pointer">All projects</button>
            </div>
            {recentProjects.map((project, index) => {
              const shared = project.role && project.role !== 'owner';
              return (
                <button key={project.id} type="button" onClick={() => onOpenProject(project.id)}
                  className="flex items-center gap-3.5 border-t border-[#F0F2F6] px-[18px] py-3 text-left hover:bg-soft dark:border-night-line dark:hover:bg-night-soft cursor-pointer">
                  <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${PROJECT_DOTS[index % PROJECT_DOTS.length]}`} />
                  <span className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{project.name}</span>
                  <span className="hidden w-[210px] truncate font-sans text-[12.5px] text-muted sm:block dark:text-night-muted">
                    {shared
                      ? `${project.result_count} analyses · shared by ${project.owner?.full_name?.split(' ')[0] || 'a colleague'}`
                      : `${project.result_count} ${project.result_count === 1 ? 'analysis' : 'analyses'} · ${project.dataset_count} ${project.dataset_count === 1 ? 'dataset' : 'datasets'}`}
                  </span>
                  <span className="hidden sm:flex">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[10.5px] font-bold text-white dark:border-night-surface ${shared ? 'bg-brand-orange' : 'bg-brand-navy dark:bg-night-soft'}`}>
                      {(project.owner?.full_name || '?').charAt(0).toUpperCase()}
                    </span>
                    {project.member_count > 0 && (
                      <span className="-ml-[7px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand-emerald text-[10px] font-bold text-white dark:border-night-surface">
                        +{project.member_count}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right font-mono text-[11.5px] text-faint sm:w-[96px]">{relativeTime(project.updated_at)}</span>
                </button>
              );
            })}
          </Card>

          {invitations.length > 0 && (
            <Card className="flex flex-col gap-3 p-[18px]">
              <h3 className="font-display text-base font-bold">Invitations</h3>
              {invitations.slice(0, 2).map(invitation => (
                <div key={invitation.id} className="flex flex-col gap-3">
                  <p className="font-sans text-[13.5px] leading-[1.5] text-ink-2 dark:text-night-ink">
                    <strong>{invitation.invited_by?.full_name || invitation.invited_by?.email}</strong> invited you to{' '}
                    <strong>{invitation.project_name}</strong> as {invitation.role === 'editor' ? 'an editor' : 'a viewer'}.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => answerInvitation(invitation, true)} className="h-9 rounded-[9px] bg-brand-navy px-4 font-sans text-[13px] font-semibold text-white hover:bg-[#1E293B] dark:bg-night-ink dark:text-night cursor-pointer">Accept</button>
                    <button type="button" onClick={() => answerInvitation(invitation, false)} className="h-9 rounded-[9px] border border-[#DDE1EA] px-3.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-soft dark:border-night-line dark:text-night-muted cursor-pointer">Decline</button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </main>
  );
};

export default Home;
