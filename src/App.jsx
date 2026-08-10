import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import LearningHub from './components/LearningHub';
import Auth from './components/Auth';
import SemModal from './components/SemModal';

const MainLayout = ({ activeTab, setActiveTab, authView, setAuthView }) => {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-brand-slate">
      {/* Top Header */}
      <Header onAuthClick={() => setAuthView(true)} />

      {/* Main Workspace Frame */}
      {authView ? (
        <div className="flex-1 flex flex-col justify-between">
          <Auth onSuccess={() => setAuthView(false)} />
          <Footer />
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-row">
            {/* Left Sidebar */}
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            
            {/* Core Dash Content Area */}
            <main className="flex-1 flex flex-col bg-brand-slate">
              {activeTab === 'dashboard' && <Dashboard onAuthClick={() => setAuthView(true)} />}
              {activeTab === 'projects' && <Projects onAuthClick={() => setAuthView(true)} />}
              {activeTab === 'learning' && <LearningHub />}
              {activeTab === 'sem' && (
                <div className="flex-1 p-8 animate-fade-in">
                  <div className="mb-6">
                    <h1 className="font-display text-2xl font-extrabold text-slate-800 tracking-tight">
                      Structural Equation Modeling (SEM)
                    </h1>
                    <p className="font-sans text-sm text-slate-500 mt-1">
                      Construct latent constructs, path diagrams, mediation analysis, and model fitting.
                    </p>
                  </div>
                  <SemModal isOpen={true} onClose={() => setActiveTab('dashboard')} isEmbedded={true} />
                </div>
              )}
            </main>
          </div>
          {/* Bottom Footer */}
          <Footer />
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authView, setAuthView] = useState(false);

  return (
    <AuthProvider>
      <MainLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        authView={authView}
        setAuthView={setAuthView}
      />
    </AuthProvider>
  );
};

export default App;
