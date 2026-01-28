

import React, { useState, useEffect } from 'react';
import { ExplorerProvider, useExplorer } from './context/ExplorerContext';
import { InteractiveCanvas } from './components/InteractiveCanvas';
import { Sidebar } from './components/Sidebar';
import { Search, ExternalLink, Zap, Layers, Menu, ShieldAlert, Key, ShieldOff, Settings2, Sparkles, Cpu, PenTool } from 'lucide-react';
import { PerspectiveType, StyleType, DetailLevelType } from './types';

const TopBar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { explore, state, setGenerationMode, setGenerationOptions, reconfigure } = useExplorer();
  const [query, setQuery] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    explore(query);
    setQuery('');
  };

  return (
    <div className="w-full bg-cyber-dark/80 backdrop-blur-md z-40 flex flex-col border-b border-cyber-dim transition-all duration-300">
      {/* Row 1: Main Controls */}
      <div className="h-16 flex items-center px-4 md:px-6 gap-4 md:gap-6 w-full shrink-0">
        
        {/* Mobile Menu Button */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden text-cyber-accent hover:text-white transition-colors"
        >
          <Menu size={24} />
        </button>

        {/* Search Module - Flex Grow to fill space */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-3xl relative h-full flex items-center gap-2 md:gap-4 m-0">
          <div className="relative w-full flex items-center">
              <Search className="absolute left-3 text-cyber-subtext pointer-events-none" size={16} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={state.isOffline ? "OFFLINE MODE" : "ENTER SUBJECT..."}
                className="w-full bg-cyber-panel border border-cyber-dim text-cyber-text h-10 px-4 pl-10 pr-20 md:pr-28 rounded-sm focus:outline-none focus:border-cyber-accent font-mono placeholder:text-cyber-subtext/50 transition-colors text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={state.status.isGenerating || state.isOffline}
              />
              <button 
                  type="submit" 
                  className="absolute right-1 top-1 bottom-1 px-3 md:px-4 bg-cyber-dim text-cyber-accent font-mono text-[10px] md:text-xs hover:bg-cyber-accent hover:text-cyber-dark transition-colors uppercase font-bold rounded-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={state.status.isGenerating || state.isOffline}
              >
                  EXECUTE
              </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-cyber-panel border border-cyber-dim rounded-sm p-1 shrink-0 h-8 items-center ml-2 sm:ml-0">
            <button
              type="button"
              onClick={() => setGenerationMode('fast')}
              className={`relative group px-2 md:px-3 py-1 h-full flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all rounded-sm ${
                state.generationMode === 'fast' 
                  ? 'bg-cyber-accent text-cyber-dark' 
                  : 'text-cyber-subtext hover:text-white disabled:opacity-50'
              }`}
            >
              <Zap size={12} /> <span className="hidden md:inline">Fast</span><span className="md:hidden">F</span>
              <div className="absolute top-full right-0 mt-3 w-32 p-2 bg-cyber-panel border border-cyber-dim text-cyber-subtext text-[9px] normal-case leading-tight rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-right md:text-center md:right-auto md:left-1/2 md:-translate-x-1/2 md:origin-top">
                <strong className="text-cyber-accent block mb-0.5">Exploded Only</strong>
                Fast generation with single view.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGenerationMode('full')}
              className={`relative group px-2 md:px-3 py-1 h-full flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all rounded-sm ${
                state.generationMode === 'full' 
                  ? 'bg-cyber-accent text-cyber-dark' 
                  : 'text-cyber-subtext hover:text-white disabled:opacity-50'
              }`}
            >
              <Layers size={12} /> <span className="hidden md:inline">Full</span><span className="md:hidden">F</span>
              <div className="absolute top-full right-0 mt-3 w-40 p-2 bg-cyber-panel border border-cyber-dim text-cyber-subtext text-[9px] normal-case leading-tight rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-right md:text-center md:right-auto md:left-1/2 md:-translate-x-1/2 md:origin-top">
                <strong className="text-cyber-accent block mb-0.5">Complete Suite</strong>
                Assembled, Cutaway & Exploded views.
              </div>
            </button>
          </div>
          
          {/* Advanced Options Toggle */}
          <button
             type="button"
             onClick={() => setShowOptions(!showOptions)}
             className={`h-8 w-8 flex items-center justify-center border rounded-sm transition-all shrink-0 ${
                 showOptions 
                 ? 'bg-cyber-accent border-cyber-accent text-cyber-dark' 
                 : 'bg-cyber-panel border-cyber-dim text-cyber-subtext hover:text-white'
             }`}
          >
             <Settings2 size={16} />
          </button>

        </form>
        
        {/* Status Module - Fixed Right */}
        <div className="flex items-center gap-4 ml-auto shrink-0 h-full">
          <div className="flex flex-col items-end justify-center">
              <span className="hidden md:block text-[10px] text-cyber-subtext uppercase tracking-widest leading-none mb-1">System Status</span>
              <div 
                onClick={() => state.isOffline && reconfigure()}
                className={`flex items-center gap-2 ${state.isOffline ? 'cursor-pointer hover:opacity-80' : ''}`}
              >
                  <div className={`w-2 h-2 rounded-full ${state.status.isGenerating ? 'bg-yellow-400 animate-ping' : state.isOffline ? 'bg-red-500' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`}></div>
                  <span className={`hidden md:inline text-xs font-mono font-bold ${state.isOffline ? 'text-red-500' : 'text-cyber-accent'}`}>
                      {state.status.isGenerating ? 'PROCESSING' : state.isOffline ? 'OFFLINE' : 'READY'}
                  </span>
              </div>
          </div>
        </div>
      </div>

      {/* Row 2: Advanced Options (Collapsible) */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out border-t border-cyber-dim/30 bg-cyber-panel/50 ${showOptions ? 'max-h-24 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
          <div className="flex flex-wrap items-center px-4 md:px-6 gap-2 md:gap-6 justify-center md:justify-start">
             
             {/* Perspective Selector - DISABLED: Does not produce distinct enough results currently. */}
             {/* 
             <div className="flex items-center gap-2">
                 <label className="text-[9px] uppercase tracking-widest text-cyber-subtext font-bold">Perspective:</label>
                 <select 
                    value={state.generationOptions.perspective}
                    onChange={(e) => setGenerationOptions({ perspective: e.target.value as PerspectiveType })}
                    className="bg-cyber-dark border border-cyber-dim text-cyber-text text-[10px] uppercase font-mono rounded px-2 py-1 focus:outline-none focus:border-cyber-accent"
                    disabled={state.status.isGenerating || state.isOffline}
                 >
                     <option value="General">General</option>
                     <option value="Industrial">Industrial</option>
                     <option value="Scientific">Scientific</option>
                     <option value="Conceptual">Conceptual</option>
                 </select>
             </div>
             */}

             {/* Style Selector - CHANGED to Toggle Group */}
             <div className="flex items-center gap-2">
                 <label className="text-[9px] uppercase tracking-widest text-cyber-subtext font-bold mr-1">Style:</label>
                 <div className="flex bg-cyber-panel border border-cyber-dim rounded-sm p-1 h-8 items-center">
                    <button
                        type="button"
                        onClick={() => setGenerationOptions({ style: 'Default' })}
                        className={`relative group px-3 py-1 h-full flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all rounded-sm ${
                            state.generationOptions.style === 'Default'
                            ? 'bg-cyber-accent text-cyber-dark'
                            : 'text-cyber-subtext hover:text-white disabled:opacity-50'
                        }`}
                        disabled={state.status.isGenerating || state.isOffline}
                    >
                        <Sparkles size={12} /> <span className="hidden sm:inline">Default</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setGenerationOptions({ style: 'Schematic' })}
                        className={`relative group px-3 py-1 h-full flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all rounded-sm ${
                            state.generationOptions.style === 'Schematic'
                            ? 'bg-cyber-accent text-cyber-dark'
                            : 'text-cyber-subtext hover:text-white disabled:opacity-50'
                        }`}
                        disabled={state.status.isGenerating || state.isOffline}
                    >
                        <Cpu size={12} /> <span className="hidden sm:inline">Schematic</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setGenerationOptions({ style: 'Drawing' })}
                        className={`relative group px-3 py-1 h-full flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all rounded-sm ${
                            state.generationOptions.style === 'Drawing'
                            ? 'bg-cyber-accent text-cyber-dark'
                            : 'text-cyber-subtext hover:text-white disabled:opacity-50'
                        }`}
                        disabled={state.status.isGenerating || state.isOffline}
                    >
                        <PenTool size={12} /> <span className="hidden sm:inline">Drawing</span>
                    </button>
                 </div>
             </div>

             {/* Detail Level Selector - DISABLED: Does not produce distinct enough results currently. */}
             {/*
             <div className="flex items-center gap-2">
                 <label className="text-[9px] uppercase tracking-widest text-cyber-subtext font-bold">Detail:</label>
                 <select 
                    value={state.generationOptions.detailLevel}
                    onChange={(e) => setGenerationOptions({ detailLevel: e.target.value as DetailLevelType })}
                    className="bg-cyber-dark border border-cyber-dim text-cyber-text text-[10px] uppercase font-mono rounded px-2 py-1 focus:outline-none focus:border-cyber-accent"
                    disabled={state.status.isGenerating || state.isOffline}
                 >
                     <option value="Simple">Simple</option>
                     <option value="Normal">Normal</option>
                     <option value="Detailed">Detailed</option>
                 </select>
             </div>
             */}

          </div>
      </div>
    </div>
  );
};

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex w-screen h-screen sm:h-screen h-[100dvh] bg-cyber-dark overflow-hidden text-cyber-text font-sans" style={{ backgroundColor: '#050a14' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 relative flex flex-col h-full overflow-hidden">
        {/* Adjusted: TopBar is now part of the flex column flow, so no fixed padding needed on container */}
        <div className="relative w-full h-full flex flex-col"> 
             <TopBar onMenuClick={() => setSidebarOpen(true)} />
             <main className="flex-1 relative w-full overflow-hidden">
                <InteractiveCanvas />
             </main>
        </div>
      </div>
    </div>
  );
};

const SetupScreen = () => {
  const { configureAccess } = useExplorer();
  const [step, setStep] = useState<'selection' | 'input'>('selection');
  const [customKey, setCustomKey] = useState('');

  const handleNoKey = () => configureAccess();
  const handleUserKey = () => configureAccess(customKey);

  return (
    <div className="w-screen h-screen sm:h-screen h-[100dvh] bg-cyber-dark flex flex-col items-center justify-center p-8 text-center relative overflow-hidden font-mono" style={{ backgroundColor: '#050a14' }}>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff05_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
        
        <div className="max-w-xl w-full bg-cyber-panel border border-cyber-dim p-8 rounded-lg relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]" style={{ backgroundColor: '#0a1120', borderColor: '#00f0ff20' }}>
            <div className="flex justify-center mb-6">
                <ShieldAlert className="text-cyber-accent w-16 h-16 animate-pulse" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Setup API key</h1>
            <p className="text-cyber-subtext mb-8" style={{ color: '#94a3b8' }}>Select initialization method for Gemini 3 Pro Neural Interface.</p>

            {step === 'selection' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: User Key */}
                    <button 
                         onClick={() => setStep('input')}
                        className="flex flex-col items-center p-6 bg-cyber-dark/50 border border-cyber-dim hover:border-cyber-accent hover:bg-cyber-accent/10 transition-all group rounded"
                        style={{ backgroundColor: '#050a14' }}
                    >
                        <Key className="mb-4 text-blue-500 group-hover:scale-110 transition-transform" size={32} />
                        <h3 className="text-white font-bold mb-2 text-sm">USER KEY</h3>
                        <p className="text-[10px] text-cyber-subtext" style={{ color: '#94a3b8' }}>Provide your own API Key.</p>
                        <p className="text-[9px] text-green-500 mt-2 uppercase">Secure & Private</p>
                    </button>

                    {/* Option 2: No Key */}
                    <button 
                        onClick={handleNoKey}
                        className="flex flex-col items-center p-6 bg-cyber-dark/50 border border-cyber-dim hover:border-red-500 hover:bg-red-500/10 transition-all group rounded"
                        style={{ backgroundColor: '#050a14' }}
                    >
                        <ShieldOff className="mb-4 text-red-500 group-hover:scale-110 transition-transform" size={32} />
                        <h3 className="text-white font-bold mb-2 text-sm">OFFLINE MODE</h3>
                        <p className="text-[10px] text-cyber-subtext" style={{ color: '#94a3b8' }}>View saved data only.</p>
                        <p className="text-[9px] text-red-500 mt-2 uppercase">Generation Disabled</p>
                    </button>
                </div>
            )}

            {step === 'input' && (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="text-left">
                        <label className="text-[10px] text-cyber-accent uppercase tracking-widest font-bold mb-2 block">Enter Gemini API Key</label>
                        <input 
                            type="password" 
                            value={customKey}
                            onChange={(e) => setCustomKey(e.target.value)}
                            className="w-full bg-cyber-dark border border-cyber-dim text-white p-3 rounded focus:border-cyber-accent focus:outline-none"
                            placeholder="AIzaSy..."
                            style={{ backgroundColor: '#050a14', color: '#fff' }}
                        />
                         <p className="text-[10px] text-cyber-subtext mt-2" style={{ color: '#94a3b8' }}>
                             Your key is stored in session memory only and is never transmitted to our servers.
                         </p>
                    </div>
                    <div className="flex gap-4 mt-4">
                        <button 
                            onClick={() => setStep('selection')}
                            className="flex-1 py-3 border border-cyber-dim text-cyber-subtext hover:text-white transition-colors uppercase text-xs font-bold"
                        >
                            Back
                        </button>
                        <button 
                            onClick={handleUserKey}
                            disabled={customKey.length < 10}
                            className="flex-1 py-3 bg-cyber-accent text-cyber-dark font-bold uppercase text-xs hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#00f0ff', color: '#050a14' }}
                        >
                            Set & Continue
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-8 pt-4 border-t border-cyber-dim flex justify-center text-[10px] text-cyber-dim">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="hover:text-cyber-accent flex items-center gap-1">
                    Get an API Key <ExternalLink size={10} />
                </a>
            </div>
        </div>
    </div>
  );
}

const AppContent = () => {
  const { state } = useExplorer();
  
  if (!state.isConfigured) {
      return <SetupScreen />;
  }

  return <MainLayout />;
};

const App: React.FC = () => {
  return (
    <ExplorerProvider>
        <AppContent />
    </ExplorerProvider>
  );
};

export default App;
