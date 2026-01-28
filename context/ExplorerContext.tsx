import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, ExploredItem, GenerationStatus, ExploreAction, GenerationOptions } from '../types';
import { analyzeStructure, generateVisualAssets, detectPartCoordinates, identifyMainObject, setUserApiKey } from '../services/gemini';
import { saveExploration, getAllExplorations, bulkSaveExplorations, deleteExploration } from '../services/db';

const initialState: AppState = {
  currentItem: null,
  history: [],
  collection: [], // Stores only ROOT items
  status: { isGenerating: false, stage: 'idle' },
  generationMode: 'full', // Default to full experience
  generationOptions: {
    perspective: 'General',
    style: 'Default',
    detailLevel: 'Normal'
  },
  isConfigured: false,
  isOffline: false,
};

const ExplorerContext = createContext<{
  state: AppState;
  explore: (query: string, parentId?: string, referenceImage?: string) => Promise<void>;
  exploreFromImage: (file: File) => Promise<void>;
  exploreFromDataUrl: (base64: string) => Promise<void>;
  loadExploration: (item: ExploredItem) => void;
  removeExploration: (id: string) => Promise<void>;
  navigateTo: (targetId: string) => void;
  setGenerationMode: (mode: 'fast' | 'full') => void;
  setGenerationOptions: (options: Partial<GenerationOptions>) => void;
  exportDatabase: () => Promise<void>;
  importDatabase: (file: File) => Promise<void>;
  reset: () => void;
  reconfigure: () => void;
  configureAccess: (key?: string) => void;
} | undefined>(undefined);

// Helper to find path from root to targetId
const findPathToNode = (root: ExploredItem, targetId: string): ExploredItem[] | null => {
  if (root.id === targetId) return [root];
  if (root.children) {
    for (const child of root.children) {
      const path = findPathToNode(child, targetId);
      if (path) {
        return [root, ...path];
      }
    }
  }
  return null;
};

// Helper to recursively find an item and update its children
const updateItemInTree = (root: ExploredItem, targetId: string, newChild: ExploredItem): ExploredItem => {
  if (root.id === targetId) {
    // If this is the parent, add the new child (avoiding duplicates)
    const existingChildren = root.children || [];
    const exists = existingChildren.some(c => c.id === newChild.id);
    return {
      ...root,
      children: exists ? existingChildren : [...existingChildren, newChild]
    };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(child => updateItemInTree(child, targetId, newChild))
    };
  }
  return root;
};

const reducer = (state: AppState, action: ExploreAction | { type: 'RECONFIGURE' }): AppState => {
  switch (action.type) {
    case 'UPDATE_SESSION': {
      const { currentItem, history, root } = action.payload;
      
      // Update Collection in memory with the new Root state
      let newCollection = [...state.collection];
      const existingIdx = newCollection.findIndex(i => i.id === root.id);
      if (existingIdx >= 0) {
        newCollection[existingIdx] = root;
      } else {
        newCollection = [root, ...newCollection];
      }
      
      return { 
        ...state, 
        currentItem, 
        history, 
        collection: newCollection 
      };
    }

    case 'INIT_COLLECTION': {
      return { ...state, collection: action.payload };
    }

    case 'REMOVE_FROM_COLLECTION': {
        return {
            ...state,
            collection: state.collection.filter(item => item.id !== action.payload)
        };
    }

    case 'LOAD_FROM_COLLECTION': {
      const rootItem = action.payload;
      return { 
        ...state, 
        currentItem: rootItem, 
        history: [rootItem],
        status: { isGenerating: false, stage: 'idle' }
      };
    }
    
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    
    case 'NAVIGATE_TO': {
      const targetId = action.payload;
      if (state.history.length === 0) return state;

      // Ensure we search the current root (history[0] is always the root of current session)
      const currentRoot = state.history[0];
      const newPath = findPathToNode(currentRoot, targetId);

      if (!newPath) return state; // Node not found in current tree

      return { 
        ...state, 
        currentItem: newPath[newPath.length - 1], 
        history: newPath 
      };
    }

    case 'SET_GENERATION_MODE':
      return { ...state, generationMode: action.payload };

    case 'SET_GENERATION_OPTIONS':
      return { ...state, generationOptions: { ...state.generationOptions, ...action.payload } };
    
    case 'CONFIGURE_ACCESS':
      return { ...state, isConfigured: true, isOffline: action.payload.isOffline };

    case 'RESET':
      return { 
        ...initialState, 
        collection: state.collection, 
        generationMode: state.generationMode, 
        generationOptions: state.generationOptions,
        isConfigured: state.isConfigured, 
        isOffline: state.isOffline 
      };

    case 'RECONFIGURE':
      return { 
        ...initialState, 
        collection: state.collection, 
        generationMode: state.generationMode, 
        generationOptions: state.generationOptions,
        isConfigured: false, 
        isOffline: false 
      };
      
    default:
      return state;
  }
};

export const ExplorerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initialize DB on mount
  useEffect(() => {
    const initDB = async () => {
      try {
        const items = await getAllExplorations();
        dispatch({ type: 'INIT_COLLECTION', payload: items });
      } catch (e) {
        console.error("Failed to initialize database", e);
      }
    };
    initDB();
  }, []);

  const configureAccess = (apiKey?: string) => {
    if (apiKey) {
      setUserApiKey(apiKey);
      dispatch({ type: 'CONFIGURE_ACCESS', payload: { isOffline: false } });
    } else {
      dispatch({ type: 'CONFIGURE_ACCESS', payload: { isOffline: true } });
    }
  };

  const setGenerationMode = (mode: 'fast' | 'full') => {
    dispatch({ type: 'SET_GENERATION_MODE', payload: mode });
  };

  const setGenerationOptions = (options: Partial<GenerationOptions>) => {
    dispatch({ type: 'SET_GENERATION_OPTIONS', payload: options });
  };

  const exportDatabase = async () => {
    try {
      const items = await getAllExplorations();
      const jsonString = JSON.stringify(items, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const date = new Date();
      // Format: YYYY-MM-DD_HH-MM-SS
      const timestamp = date.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      link.download = `curious_explorer_backup_${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export database.");
    }
  };

  const importDatabase = async (file: File) => {
    try {
      const text = await file.text();
      const items = JSON.parse(text);
      
      if (!Array.isArray(items)) {
        throw new Error("Invalid file format: Root must be an array.");
      }
      
      await bulkSaveExplorations(items);
      const updatedCollection = await getAllExplorations();
      dispatch({ type: 'INIT_COLLECTION', payload: updatedCollection });
      alert("Database imported successfully.");
    } catch (error) {
      console.error("Import failed", error);
      alert("Failed to import database. Check file format.");
    }
  };

  const removeExploration = async (id: string) => {
    try {
        await deleteExploration(id);
        dispatch({ type: 'REMOVE_FROM_COLLECTION', payload: id });
        
        // If the user deleted the item they are currently looking at (root of history), reset the view
        if (state.history.length > 0 && state.history[0].id === id) {
            dispatch({ type: 'RESET' });
        }
    } catch (error) {
        console.error("Failed to delete item", error);
        alert("Failed to delete item from database.");
    }
  };

  const explore = async (query: string, parentId?: string, referenceImage?: string) => {
    if (state.status.isGenerating) return;

    // CHECK MEMORY FIRST within the active session tree
    if (parentId && state.currentItem) {
       // Smart check: Does the child name contain the query, or query contain the child name?
       // e.g., if user clicks "Seed" but child is "Avocado Seed", we should match.
       const existingChild = state.currentItem.children?.find(c => 
           c.name.toLowerCase().includes(query.toLowerCase()) || 
           query.toLowerCase().includes(c.name.toLowerCase())
       );
       
       if (existingChild) {
         dispatch({ type: 'NAVIGATE_TO', payload: existingChild.id });
         return;
       }
    }

    // OFFLINE CHECK - MOVED AFTER MEMORY CHECK
    // This allows "Review Data" (navigating to existing children) to work even in Offline Mode.
    if (state.isOffline) {
        dispatch({ type: 'SET_STATUS', payload: { isGenerating: false, stage: 'error', message: 'Offline Mode: Cannot generate new explorations.' } });
        return;
    }

    try {
      const depth = parentId && state.currentItem ? state.currentItem.depth + 1 : 0;

      // CONSTRUCT CONTEXT AWARE QUERY
      let contextQuery = query;
      
      if (parentId && state.history.length > 0) {
          const currentRoot = state.history[0];
          const path = findPathToNode(currentRoot, parentId);
          
          if (path) {
             // Build lineage string to ensure full context (e.g. "Avocado" -> "Seed" -> "Avocado Seed")
             const parts = path.map(p => p.name);
             const cleanParts = [...parts];
             
             // Deduplicate: If "Avocado Seed" includes "Avocado", don't repeat "Avocado"
             for (let i = cleanParts.length - 1; i > 0; i--) {
                if (cleanParts[i].toLowerCase().includes(cleanParts[i-1].toLowerCase())) {
                    cleanParts[i-1] = '';
                }
             }
             
             const contextString = cleanParts.filter(p => p !== '').join(' ');
             // Strict "From" syntax for better generation context
             contextQuery = `${query} from ${contextString}`;
          }
      }

      // STEP 1: ANALYZE STRUCTURE & GET FACTS
      dispatch({ type: 'SET_STATUS', payload: { isGenerating: true, stage: 'analyzing', message: `Analyzing structure of ${query}...` } });
      
      const structure = await analyzeStructure(contextQuery, state.generationOptions);
      
      // FORCE STRICT NAMING FOR NESTED ITEMS
      // If we are in a nested view, override the AI-generated name with our strict context query.
      // This prevents "Ice Lemon Tea" + "Ice Cubes" becoming "Ice Lemon Tea with Ice Cubes".
      const effectiveName = parentId ? contextQuery : structure.name;
      
      // Update status with facts so UI can show them while rendering
      dispatch({ 
        type: 'SET_STATUS', 
        payload: { 
          isGenerating: true, 
          stage: 'rendering_assembled', 
          message: state.generationMode === 'full' ? 'Constructing base model...' : 'Generating schematic...',
          currentFacts: structure.facts 
        } 
      });
      
      // STEP 2: RENDER IMAGES (Assembled -> Cutaway & Exploded) OR (Exploded Only)
      // PASSING STATE OPTIONS HERE
      const images = await generateVisualAssets(
        effectiveName, 
        structure.partNames, 
        state.generationMode, 
        referenceImage,
        state.generationOptions
      );
      
      // STEP 3: SCAN IMAGE FOR COORDINATES (using Exploded View)
      let finalParts: any[] = [];
      if (images && images.exploded) {
        dispatch({ type: 'SET_STATUS', payload: { isGenerating: true, stage: 'scanning', message: 'Calibrating component locations...', currentFacts: structure.facts } });
        finalParts = await detectPartCoordinates(images.exploded, structure.partNames);
      } else {
        // Fallback
        finalParts = structure.partNames.map((name, i) => ({
            id: `${Date.now()}-${i}`,
            name: name,
            description: "Visual analysis unavailable.",
            x: 50,
            y: 50 + (i * 10)
        }));
      }

      // COMPILE FINAL ITEM
      const completeItem: ExploredItem = {
        id: structure.id,
        name: effectiveName, // Use the effective (strict) name
        category: structure.category,
        description: structure.description,
        parts: finalParts,
        images: images, 
        rootId: parentId ? state.history[0].id : structure.id, 
        parentId,
        depth,
        timestamp: Date.now(),
        children: [],
        facts: structure.facts,
        characteristics: structure.characteristics
      };

      // UPDATE STATE
      let newRoot: ExploredItem;
      let newHistory: ExploredItem[];

      if (!parentId) {
        newRoot = completeItem;
        newHistory = [completeItem];
      } else {
        const currentRoot = state.history[0];
        newRoot = updateItemInTree(currentRoot, parentId, completeItem);
        newHistory = findPathToNode(newRoot, completeItem.id) || [newRoot, completeItem];
      }

      // Dispatch state update
      dispatch({ 
        type: 'UPDATE_SESSION', 
        payload: { 
          currentItem: completeItem, 
          history: newHistory, 
          root: newRoot 
        } 
      });

      // ASYNC SAVE TO DB
      saveExploration(newRoot).catch(err => console.error("Auto-save failed:", err));

      dispatch({ type: 'SET_STATUS', payload: { isGenerating: false, stage: 'complete' } });

    } catch (error) {
      console.error(error);
      dispatch({ type: 'SET_STATUS', payload: { isGenerating: false, stage: 'error', message: 'Exploration failed. System Error.' } });
    }
  };

  const exploreFromDataUrl = async (base64: string) => {
    if (state.status.isGenerating) return;

    if (state.isOffline) {
        dispatch({ type: 'SET_STATUS', payload: { isGenerating: false, stage: 'error', message: 'Offline Mode: Cannot generate new explorations.' } });
        return;
    }
    
    dispatch({ type: 'SET_STATUS', payload: { isGenerating: true, stage: 'analyzing', message: 'Scanning image for object identification...' } });
      
    try {
      const objectName = await identifyMainObject(base64);
      // Start exploration with the identified name and the image as reference
      await explore(objectName, undefined, base64);
    } catch (error) {
      dispatch({ type: 'SET_STATUS', payload: { isGenerating: false, stage: 'error', message: 'Failed to identify object from image.' } });
    }
  };

  const exploreFromImage = async (file: File) => {
    // Convert to Base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        await exploreFromDataUrl(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const loadExploration = (item: ExploredItem) => {
    dispatch({ type: 'LOAD_FROM_COLLECTION', payload: item });
  };

  const navigateTo = (targetId: string) => {
    dispatch({ type: 'NAVIGATE_TO', payload: targetId });
  };

  const reset = () => dispatch({ type: 'RESET' });
  const reconfigure = () => dispatch({ type: 'RECONFIGURE' });

  return (
    <ExplorerContext.Provider value={{ state, explore, exploreFromImage, exploreFromDataUrl, loadExploration, removeExploration, navigateTo, setGenerationMode, setGenerationOptions, exportDatabase, importDatabase, reset, reconfigure, configureAccess }}>
      {children}
    </ExplorerContext.Provider>
  );
};

const useExplorer = () => {
  const context = useContext(ExplorerContext);
  if (!context) throw new Error("useExplorer must be used within ExplorerProvider");
  return context;
};

export { ExplorerContext, useExplorer };