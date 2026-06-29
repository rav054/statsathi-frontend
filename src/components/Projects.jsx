import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Folder, Calendar, Table, BrainCircuit, Trash2, Plus, Info, ArrowLeft, CheckSquare, Square, Edit2, Check, RefreshCw } from 'lucide-react';

const Projects = ({ onAuthClick }) => {
  const { user } = useAuth();
  
  // Seed initial projects if not present in localStorage
  const defaultProjects = [
    {
      id: 1,
      name: "Dummy project",
      created: "2026-06-29",
      samples: 120,
      variables: 6,
      status: "Ready",
      testUsed: "One-Way ANOVA, LSD Test",
      tasks: [
        { id: 101, text: "Add your CSV dataset file", completed: true },
        { id: 102, text: "Verify variable columns in data editor", completed: true },
        { id: 103, text: "Run ANOVA with Duncan / LSD post-hoc", completed: false },
        { id: 104, text: "Download high-resolution 300 DPI chart", completed: false }
      ]
    }
  ];

  const [projects, setProjects] = useState(() => {
    const saved = localStorage.getItem('statsathi_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length === 0 || !parsed.some(p => p.name === "Dummy project")) {
          return defaultProjects;
        }
        return parsed;
      } catch (e) {
        return defaultProjects;
      }
    }
    return defaultProjects;
  });

  const [activeProjectId, setActiveProjectId] = useState(null);
  
  // Create / Edit states
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectTasks, setNewProjectTasks] = useState(['']); // Start with one task input
  
  // Active editing project name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Task input state (within project detail view)
  const [taskInput, setTaskInput] = useState('');

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem('statsathi_projects', JSON.stringify(projects));
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleDelete = (id, e) => {
    if (e) e.stopPropagation(); // Stop click from triggering active project
    setProjects(projects.filter(p => p.id !== id));
    if (activeProjectId === id) setActiveProjectId(null);
  };

  const handleCreateProjectSubmit = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const tasksList = newProjectTasks
      .filter(t => t.trim() !== '')
      .map((t, idx) => ({
        id: Date.now() + idx,
        text: t.trim(),
        completed: false
      }));

    const newProj = {
      id: Date.now(),
      name: newProjectName.trim(),
      created: new Date().toISOString().split('T')[0],
      samples: 0,
      variables: 0,
      status: tasksList.length > 0 ? "In Progress" : "Empty",
      testUsed: "None",
      tasks: tasksList
    };

    setProjects([newProj, ...projects]);
    setNewProjectName('');
    setNewProjectTasks(['']);
    setIsCreating(false);
    setActiveProjectId(newProj.id);
  };

  const handleAddTaskField = () => {
    setNewProjectTasks([...newProjectTasks, '']);
  };

  const handleTaskFieldChange = (index, value) => {
    const updated = [...newProjectTasks];
    updated[index] = value;
    setNewProjectTasks(updated);
  };

  const handleRemoveTaskField = (index) => {
    const updated = newProjectTasks.filter((_, idx) => idx !== index);
    setNewProjectTasks(updated.length > 0 ? updated : ['']);
  };

  // Detail View Handlers
  const handleToggleTask = (taskId) => {
    setProjects(projects.map(p => {
      if (p.id === activeProjectId) {
        const updatedTasks = p.tasks.map(t => 
          t.id === taskId ? { ...t, completed: !t.completed } : t
        );
        
        // Auto update status based on tasks completed
        let newStatus = p.status;
        const total = updatedTasks.length;
        const completedCount = updatedTasks.filter(t => t.completed).length;
        
        if (total === 0) newStatus = "Empty";
        else if (completedCount === total) newStatus = "Completed";
        else if (completedCount > 0) newStatus = "In Progress";
        else newStatus = "Ready";

        return { ...p, tasks: updatedTasks, status: newStatus };
      }
      return p;
    }));
  };

  const handleAddNewTask = (e) => {
    e.preventDefault();
    if (!taskInput.trim() || !activeProject) return;

    setProjects(projects.map(p => {
      if (p.id === activeProjectId) {
        const newTask = {
          id: Date.now(),
          text: taskInput.trim(),
          completed: false
        };
        const updatedTasks = [...p.tasks, newTask];
        return {
          ...p,
          tasks: updatedTasks,
          status: p.status === 'Completed' ? 'In Progress' : p.status === 'Empty' ? 'In Progress' : p.status
        };
      }
      return p;
    }));
    setTaskInput('');
  };

  const handleDeleteTask = (taskId) => {
    setProjects(projects.map(p => {
      if (p.id === activeProjectId) {
        const updatedTasks = p.tasks.filter(t => t.id !== taskId);
        return { ...p, tasks: updatedTasks };
      }
      return p;
    }));
  };

  const handleSaveNameEdit = () => {
    if (!editedName.trim()) return;
    setProjects(projects.map(p => 
      p.id === activeProjectId ? { ...p, name: editedName.trim() } : p
    ));
    setIsEditingName(false);
  };

  const handleStatusChange = (statusVal) => {
    setProjects(projects.map(p => 
      p.id === activeProjectId ? { ...p, status: statusVal } : p
    ));
  };

  const handleMetaChange = (field, value) => {
    setProjects(projects.map(p => 
      p.id === activeProjectId ? { ...p, [field]: value } : p
    ));
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-brand-indigo mb-4">
          <Folder className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-slate-800">My Projects</h2>
        <p className="font-sans text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
          Please log in to save your statistical datasets, calculations, and generated plots under your personal profile workspace.
        </p>
        <button
          onClick={onAuthClick}
          className="mt-6 rounded-xl bg-brand-indigo px-5 py-2.5 font-sans text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          Sign In to Access Projects
        </button>
      </div>
    );
  }

  // 1. CREATE DIALOG
  if (isCreating) {
    return (
      <div className="flex-1 p-8 animate-fade-in max-w-3xl mx-auto">
        <div className="flex items-center space-x-2 border-b border-slate-200/50 pb-6 mb-8">
          <button 
            onClick={() => setIsCreating(false)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-xl font-extrabold text-slate-800 tracking-tight">Create New Project</h1>
            <p className="font-sans text-xs text-slate-400 mt-0.5">Initialize a workspace and specify tasks to perform.</p>
          </div>
        </div>

        <form onSubmit={handleCreateProjectSubmit} className="space-y-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-md shadow-slate-100/50">
          <div className="space-y-1">
            <label className="font-sans text-xs font-bold text-slate-500 uppercase">Project Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Rice Nitrogen-Uptake Split-Plot Analysis"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo"
            />
          </div>

          <div className="space-y-3">
            <label className="font-sans text-xs font-bold text-slate-500 uppercase block">Tasks to Perform (Checklist)</label>
            <p className="font-sans text-[10px] text-slate-400 -mt-2">List the analytical steps you plan to take in this project.</p>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {newProjectTasks.map((task, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder={`Task #${idx + 1}`}
                    value={task}
                    onChange={(e) => handleTaskFieldChange(idx, e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-600 outline-hidden focus:border-brand-indigo"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTaskField(idx)}
                    className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddTaskField}
              className="mt-2 text-brand-indigo hover:text-indigo-700 font-sans text-xs font-bold flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Add Task Line</span>
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-indigo hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Create and Open Project
          </button>
        </form>
      </div>
    );
  }

  // 2. DETAIL WORKSPACE VIEW
  if (activeProjectId && activeProject) {
    const completedTasks = activeProject.tasks ? activeProject.tasks.filter(t => t.completed).length : 0;
    const totalTasks = activeProject.tasks ? activeProject.tasks.length : 0;
    const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
      <div className="flex-1 p-8 animate-fade-in max-w-4xl mx-auto">
        
        {/* Back and Title Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200/50 pb-6 mb-8 gap-4">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <button 
              onClick={() => {
                setActiveProjectId(null);
                setIsEditingName(false);
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-sans text-sm text-slate-700 outline-hidden focus:border-brand-indigo"
                  />
                  <button onClick={handleSaveNameEdit} className="p-1.5 bg-brand-indigo text-white rounded-lg hover:bg-indigo-700">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 className="font-display text-base md:text-lg font-bold text-slate-800 tracking-tight leading-tight">
                    {activeProject.name}
                  </h1>
                  <button 
                    onClick={() => {
                      setEditedName(activeProject.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="font-sans text-[10px] text-slate-400 mt-1">Created on {activeProject.created}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
            <select
              value={activeProject.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-600 outline-hidden"
            >
              <option value="Empty">Empty</option>
              <option value="In Progress">In Progress</option>
              <option value="Ready">Ready</option>
              <option value="Completed">Completed</option>
            </select>
            <button 
              onClick={(e) => handleDelete(activeProject.id, e)}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content: Tasks Checklist (2 cols) */}
          <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-md shadow-slate-100/50">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-700">Tasks to Perform</h3>
              <p className="font-sans text-[10px] text-slate-400">Track and manage checklist steps for this workspace.</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
              <div className="flex justify-between font-sans text-[10px] font-bold text-slate-500 uppercase">
                <span>Workspace Progress</span>
                <span>{completedTasks} / {totalTasks} Tasks ({completionPct}%)</span>
              </div>
              <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-indigo h-full rounded-full transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                ></div>
              </div>
            </div>

            {/* Task Add Form */}
            <form onSubmit={handleAddNewTask} className="flex items-center space-x-2 border-b border-slate-100 pb-4">
              <input
                type="text"
                placeholder="Add a new task to perform..."
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-sans text-xs text-slate-600 outline-hidden focus:border-brand-indigo"
              />
              <button
                type="submit"
                disabled={!taskInput.trim()}
                className="px-4 py-2 bg-brand-indigo hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 font-sans text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Add
              </button>
            </form>

            {/* Tasks List */}
            {totalTasks === 0 ? (
              <div className="py-8 text-center text-slate-400 font-sans text-xs">
                No tasks defined yet. Add one above!
              </div>
            ) : (
              <div className="space-y-2">
                {activeProject.tasks.map(t => (
                  <div 
                    key={t.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      t.completed ? 'bg-slate-50/50 border-slate-100 text-slate-400' : 'bg-white border-slate-100 text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTask(t.id)}
                      className="flex items-center space-x-3 text-left font-sans text-xs font-medium cursor-pointer flex-1"
                    >
                      {t.completed ? (
                        <CheckSquare className="h-4.5 w-4.5 text-brand-indigo shrink-0" />
                      ) : (
                        <Square className="h-4.5 w-4.5 text-slate-300 shrink-0" />
                      )}
                      <span className={t.completed ? 'line-through' : ''}>{t.text}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Project Attributes (1 col) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-md shadow-slate-100/50 space-y-4">
              <h3 className="font-display text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">Project Metadata</h3>
              
              <div className="space-y-1">
                <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Samples count</label>
                <input
                  type="number"
                  value={activeProject.samples}
                  onChange={(e) => handleMetaChange('samples', parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-sans text-xs text-slate-600 outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Variables count</label>
                <input
                  type="number"
                  value={activeProject.variables}
                  onChange={(e) => handleMetaChange('variables', parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-sans text-xs text-slate-600 outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-sans text-[10px] font-bold text-slate-400 uppercase">Statistical Test Target</label>
                <input
                  type="text"
                  value={activeProject.testUsed}
                  onChange={(e) => handleMetaChange('testUsed', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-sans text-xs text-slate-600 outline-hidden"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // 3. MAIN PROJECTS LIST
  return (
    <div className="flex-1 p-8 animate-fade-in">
      <div className="flex justify-between items-center border-b border-slate-200/50 pb-6 mb-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-800 tracking-tight">
            My Projects
          </h1>
          <p className="font-sans text-sm text-slate-500 mt-1">
            Access your saved data configurations and checklist workflows.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-2 rounded-2xl bg-brand-indigo px-4 py-2.5 font-sans text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 py-16 text-center bg-white/50">
          <Folder className="mx-auto h-12 w-12 text-slate-300" />
          <p className="font-sans text-sm font-semibold text-slate-700 mt-4">No Projects Found</p>
          <p className="font-sans text-xs text-slate-400 mt-1">Create your first project to save dataset calculations and task lists.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const total = p.tasks ? p.tasks.length : 0;
            const completed = p.tasks ? p.tasks.filter(t => t.completed).length : 0;
            const progressStr = total > 0 ? `(${completed}/${total} tasks)` : '';
            
            return (
              <div 
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className="flex flex-col md:flex-row md:items-center justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-md shadow-slate-100/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo">
                    <Folder className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-800">{p.name}</h3>
                    <div className="flex flex-wrap gap-y-2 mt-2 gap-x-4 text-[10px] text-slate-400 font-sans font-semibold">
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{p.created}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Table className="h-3.5 w-3.5" />
                        <span>{p.samples} samples / {p.variables} variables</span>
                      </span>
                      <span className="flex items-center space-x-1 text-slate-500">
                        <BrainCircuit className="h-3.5 w-3.5" />
                        <span>{p.testUsed}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-4 md:mt-0 justify-end">
                  {total > 0 && (
                    <span className="font-sans text-[10px] font-bold text-slate-400">
                      {progressStr}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] font-bold ${
                    p.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    p.status === 'Ready' ? 'bg-indigo-50 text-brand-indigo border border-indigo-100' :
                    p.status === 'In Progress' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-slate-50 text-slate-400 border border-slate-100'
                  }`}>
                    {p.status}
                  </span>
                  
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="rounded-xl border border-slate-100 bg-white p-2 text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Delete Project"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
