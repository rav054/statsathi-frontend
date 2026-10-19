import { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SharedDatasetProvider } from './context/SharedDatasetContext';
import { ModuleHostProvider } from './context/ModuleHost';
import DialogKeyboard from './components/DialogKeyboard';
import AppShell, { Wordmark } from './components/shell/AppShell';
import Footer from './components/Footer';
import Home from './components/Home';
import Projects from './components/Projects';
import LearningHub from './components/LearningHub';
import Auth from './components/Auth';
import VerifyEmailBanner from './components/VerifyEmailBanner';
import { ResetPasswordPage, VerifyEmailPage } from './components/AccountLinkPage';

// Each workspace tab has its own URL, so pages can be bookmarked and Back/Forward work.
// Hosting must serve index.html for these paths (see vercel.json).
const TAB_PATHS = { dashboard: '/', projects: '/projects', learning: '/learning' };
const TAB_TITLES = { dashboard: 'Home', projects: 'Projects', learning: 'Learning Hub' };

// Pages opened from account emails; they are not workspace tabs
const ACCOUNT_PAGES = { '/reset-password': 'reset', '/verify-email': 'verify' };
const accountPageFromPath = (pathname) => ACCOUNT_PAGES[pathname.replace(/\/+$/, '')] || null;

const tabFromPath = (pathname) => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return Object.keys(TAB_PATHS).find(tab => TAB_PATHS[tab] === normalized) || 'dashboard';
};

// Sign-in and the pages opened from account emails use a simple centred frame with the wordmark
const PlainFrame = ({ onHome, children }) => (
  <div className="flex min-h-screen flex-col bg-canvas text-ink dark:bg-night dark:text-night-ink">
    <header className="flex h-16 items-center px-4 md:px-8">
      <button type="button" onClick={onHome} className="flex items-center gap-2.5 cursor-pointer">
        <img src="/statsathi-mark.svg" alt="" className="h-8 w-8" />
        <Wordmark className="text-lg" />
      </button>
    </header>
    <div className="flex flex-1 flex-col justify-between">
      {children}
      <Footer />
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTabState] = useState(() => tabFromPath(window.location.pathname));
  const [authView, setAuthView] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [accountPage, setAccountPage] = useState(() => accountPageFromPath(window.location.pathname));
  // Requests passed down to pages: open this project, start a new project, show this workflow step
  const [projectRequest, setProjectRequest] = useState(null);
  const [focusStep, setFocusStep] = useState(null);

  const closeAccountPage = useCallback(() => {
    window.history.replaceState({ tab: 'dashboard' }, '', '/');
    setAccountPage(null);
    setActiveTabState('dashboard');
  }, []);

  useEffect(() => {
    const onPopState = () => setActiveTabState(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const pageTitle = accountPage === 'reset' ? 'Reset password' : accountPage === 'verify' ? 'Confirm email' : TAB_TITLES[activeTab];
    document.title = `${pageTitle} · StatSathi`;
  }, [activeTab, accountPage]);

  const setActiveTab = useCallback((tab) => {
    const path = TAB_PATHS[tab] || '/';
    if (window.location.pathname !== path) window.history.pushState({ tab }, '', path);
    setActiveTabState(tab);
    setAuthView(false);
  }, []);

  // Moving between pages from the navigation drops any pending request to open a particular project
  const navigate = useCallback((tab) => {
    setProjectRequest(null);
    setActiveTab(tab);
  }, [setActiveTab]);

  const openAuth = useCallback((mode = 'login') => {
    setAuthMode(mode);
    setAuthView(true);
  }, []);

  const openProject = useCallback((projectId) => {
    setProjectRequest(projectId ? { kind: 'open', id: projectId, at: Date.now() } : null);
    setActiveTab('projects');
  }, [setActiveTab]);

  const newProject = useCallback(() => {
    setProjectRequest({ kind: 'create', at: Date.now() });
    setActiveTab('projects');
  }, [setActiveTab]);

  const showWorkflowStep = useCallback((stepId) => {
    setFocusStep({ id: stepId, at: Date.now() });
    setActiveTab('dashboard');
  }, [setActiveTab]);

  let page;
  if (accountPage) {
    page = (
      <PlainFrame onHome={closeAccountPage}>
        {accountPage === 'reset'
          ? <ResetPasswordPage onDone={closeAccountPage} onRequestNewLink={() => { closeAccountPage(); openAuth('forgot'); }} />
          : <VerifyEmailPage onDone={closeAccountPage} />}
      </PlainFrame>
    );
  } else if (authView) {
    page = (
      <PlainFrame onHome={() => setAuthView(false)}>
        <Auth key={authMode} initialMode={authMode} onSuccess={() => setAuthView(false)} />
      </PlainFrame>
    );
  } else {
    page = (
      <AppShell activeTab={activeTab} onNavigate={navigate} onOpenProject={openProject} onSignIn={() => openAuth()} onWorkflowStep={showWorkflowStep}>
        <VerifyEmailBanner />
        <div className="flex flex-1 flex-col">
          {activeTab === 'dashboard' && (
            <Home onSignIn={() => openAuth()} onOpenProject={openProject} onNewProject={newProject} focusStep={focusStep} />
          )}
          {activeTab === 'projects' && (
            <Projects onAuthClick={() => openAuth()} onOpenDashboard={() => setActiveTab('dashboard')} request={projectRequest} />
          )}
          {activeTab === 'learning' && <LearningHub />}
        </div>
        <Footer />
      </AppShell>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <SharedDatasetProvider>
          <ModuleHostProvider onNavigate={navigate} onSignIn={() => openAuth()}>
            <DialogKeyboard />
            {page}
          </ModuleHostProvider>
        </SharedDatasetProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
