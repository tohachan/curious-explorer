import React, { useState, useMemo } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import { ExploredItem } from '../types';
import { Database, ChevronRight, ChevronDown, Circle, Zap, Download, Upload, Search, X, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper for deep search matching
const hasSearchMatch = (item: ExploredItem, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.name.toLowerCase().includes(q)) return true;
  return item.children?.some(child => hasSearchMatch(child, query)) || false;
};

// Recursive Tree Node
const TraceNode: React.FC<{ 
  item: ExploredItem; 
  currentId: string | undefined; 
  onNavigate: (id: string) => void;
  depth?: number;
  searchQuery?: string;
}> = ({ item, currentId, onNavigate, depth = 0, searchQuery }) => {
  // Logic for expansion and highlighting
  const isCurrent = item.id === currentId;
  const matchesSearch = searchQuery ? item.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
  
  // Check if children have matches (for search expansion)
  const hasChildMatch = searchQuery ? item.children?.some(c => hasSearchMatch(c, searchQuery)) : false;

  // Check if ancestor of current (for active trace expansion)
  const isAncestor = !isCurrent && !searchQuery && currentId && (
    item.children?.some(c => c.id === currentId || isChildInPath(c, currentId))
  );

  function isChildInPath(node: ExploredItem, targetId: string): boolean {
    if (node.id === targetId) return true;
    return node.children?.some(c => isChildInPath(c, targetId)) || false;
  }

  const hasChildren = item.children && item.children.length > 0;
  // Expand if: Active Trace (Ancestor/Current) OR Search Result (Has Child Match)
  const shouldExpand = isCurrent || isAncestor || hasChildMatch;

  return (
    <div className="select-none">
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(item.id);
        }}
        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-all duration-200 group
          ${isCurrent 
            ? 'bg-cyber-accent/10 text-cyber-accent border-l-2 border-cyber-accent' 
            : 'text-cyber-subtext hover:text-white hover:bg-white/5'
          }
        `}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <div className="shrink-0">
          {isCurrent ? (
            <Zap size={12} className="animate-pulse" />
          ) : hasChildren ? (
            shouldExpand ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <Circle size={8} className="opacity-50" />
          )}
        </div>
        
        <span className={`text-xs font-mono truncate flex-1 ${isCurrent ? 'font-bold' : ''}`}>
          {matchesSearch ? (
            <span className="text-white bg-cyber-accent/20 px-0.5 rounded">{item.name}</span>
          ) : (
            item.name
          )}
        </span>
      </div>

      {hasChildren && shouldExpand && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="border-l border-cyber-dim ml-3">
            {item.children!.map(child => (
              <TraceNode 
                key={child.id} 
                item={child} 
                currentId={currentId} 
                onNavigate={onNavigate}
                depth={depth + 1}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { state, navigateTo, reset, loadExploration, exportDatabase, importDatabase, removeExploration } = useExplorer();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  // Filter collection based on search
  const filteredCollection = useMemo(() => {
    return state.collection.filter(item => hasSearchMatch(item, searchQuery));
  }, [state.collection, searchQuery]);

  const handleNodeClick = (rootItem: ExploredItem, targetId: string) => {
    // If we are navigating within the active session, just navigate
    if (state.history[0]?.id === rootItem.id) {
      navigateTo(targetId);
    } else {
      // If clicking into a different exploration, load it first, then navigate
      loadExploration(rootItem);
      if (targetId !== rootItem.id) {
        setTimeout(() => navigateTo(targetId), 0); 
      }
    }
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-cyber-panel border-r border-cyber-dim flex flex-col font-mono text-sm shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header & Search */}
        <div className="p-4 border-b border-cyber-dim bg-cyber-dark/50 flex flex-col gap-2">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-cyber-accent font-bold">
              <Database size={16} />
              <span>DATA_LOG</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={reset}
                className="text-[10px] uppercase tracking-widest text-cyber-subtext hover:text-cyber-accent transition-colors"
              >
                New Scan
              </button>
              {/* Mobile Close Button */}
              <button onClick={onClose} className="lg:hidden text-cyber-subtext hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>
          
          {/* Search Input */}
          <div>
              <label 
                htmlFor="sidebar-search"
                className="text-[10px] text-cyber-accent uppercase tracking-widest mb-1.5 block cursor-pointer font-bold"
              >
                Data Search
              </label>
              <div className="relative group">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-cyber-dim group-focus-within:text-cyber-accent transition-colors" size={14} />
              <input 
                  id="sidebar-search"
                  type="text" 
                  placeholder="Search nodes..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-cyber-dark border border-cyber-dim rounded py-1.5 pl-8 pr-8 text-xs text-cyber-text focus:outline-none focus:border-cyber-accent placeholder:text-cyber-dim transition-colors"
              />
              {searchQuery && (
                  <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-cyber-dim hover:text-white"
                  >
                  <X size={12} />
                  </button>
              )}
              </div>
          </div>
        </div>

        {/* Explorations List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-2">
          {filteredCollection.length === 0 && (
            <div className="text-cyber-dim text-xs italic p-4 text-center border border-dashed border-cyber-dim rounded">
              {searchQuery ? 'No matching data found.' : 'Database empty.'}
            </div>
          )}
          
          {filteredCollection.map((item) => {
            const isActive = state.history.length > 0 && state.history[0].id === item.id;
            const isConfirmingDelete = deleteConfirmation === item.id;
            // Show tree if: It is the active item OR we have a search query (to show hits)
            const showTree = isActive || searchQuery.length > 0;

            return (
              <div 
                key={item.id}
                className={`border rounded transition-all duration-300 overflow-hidden relative group shrink-0
                  ${isActive 
                    ? 'bg-cyber-accent/5 border-cyber-accent/50 shadow-[0_0_10px_rgba(0,240,255,0.05)]' 
                    : 'bg-cyber-dark/30 border-cyber-dim hover:border-cyber-subtext'
                  }
                `}
              >
                  {/* Delete Confirmation Overlay */}
                  <AnimatePresence>
                    {isConfirmingDelete && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 bg-cyber-dark/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-2"
                      >
                          <div className="text-white text-xs font-bold mb-1 flex items-center gap-1">
                              <AlertTriangle size={12} className="text-red-500" /> Remove item & data tree?
                          </div>
                          <div className="flex gap-2">
                              <button 
                                  onClick={(e) => { e.stopPropagation(); removeExploration(item.id); }}
                                  className="px-3 py-0.5 bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white rounded text-[10px] uppercase font-bold transition-colors"
                              >
                                  Yes, Delete
                              </button>
                              <button 
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmation(null); }}
                                  className="px-3 py-0.5 bg-cyber-panel border border-cyber-dim text-cyber-subtext hover:text-white rounded text-[10px] uppercase transition-colors"
                              >
                                  Cancel
                              </button>
                          </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                {/* Root Item Header */}
                <div 
                  onClick={() => handleNodeClick(item, item.id)}
                  className="p-3 cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-1 pr-6">
                      <span className="font-bold truncate text-sm flex items-center gap-2">
                        {item.name}
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyber-accent mr-1 shadow-[0_0_5px_#00f0ff]"></div>}
                      </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] opacity-70">
                    <span className="uppercase tracking-wider">{item.category}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>

                  {/* Delete Button (Visible on Hover) */}
                  <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmation(item.id); }}
                      className="absolute top-2 right-2 p-1 text-cyber-dim hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Remove Exploration"
                  >
                      <Trash2 size={14} />
                  </button>
                </div>

                {/* Tree View (Active Trace or Search Results) */}
                <AnimatePresence>
                  {showTree && !isConfirmingDelete && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="border-t border-cyber-dim/30 bg-black/20 pb-2 px-2 pt-2">
                          <TraceNode 
                            item={item} 
                            currentId={isActive ? state.currentItem?.id : undefined}
                            onNavigate={(targetId) => handleNodeClick(item, targetId)}
                            searchQuery={searchQuery}
                          />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        
        {/* Footer / Backup Controls */}
        <div className="p-3 border-t border-cyber-dim bg-cyber-dark/30">
          <h4 className="text-[9px] text-cyber-dim uppercase tracking-widest mb-2 text-center">Database Backup</h4>
          <div className="flex gap-2">
            <button 
              onClick={exportDatabase}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-cyber-panel border border-cyber-dim text-cyber-subtext hover:text-cyber-accent hover:border-cyber-accent text-[10px] uppercase rounded transition-colors"
            >
              <Download size={12} /> Export
            </button>
            
            <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-cyber-panel border border-cyber-dim text-cyber-subtext hover:text-cyber-accent hover:border-cyber-accent text-[10px] uppercase rounded transition-colors cursor-pointer">
              <Upload size={12} /> Import
              <input 
                type="file" 
                accept="application/json" 
                className="hidden" 
                onChange={(e) => {
                  if(e.target.files?.[0]) importDatabase(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
        
        <div className="p-2 bg-cyber-dark text-[9px] text-cyber-dim text-center uppercase tracking-widest border-t border-cyber-dim">
          Gemini 3 Pro Vision / System Online
        </div>
      </div>
    </>
  );
};