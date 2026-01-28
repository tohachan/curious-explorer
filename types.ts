

export interface ItemPart {
  id: string;
  name: string;
  description: string;
  // Normalized coordinates (0-100) for placement on the canvas
  x: number;
  y: number;
}

export interface ItemImages {
  assembled?: string;
  cutaway?: string;
  exploded: string;
}

export interface ItemCharacteristic {
  label: string;
  value: string;
}

export interface ExploredItem {
  id: string;
  rootId: string; // ID of the top-level parent
  name: string;
  category: string;
  description: string;
  images?: ItemImages;
  parts: ItemPart[];
  facts?: string[]; // Interesting technical facts
  characteristics?: ItemCharacteristic[]; // Specs, Nutrition, etc.
  parentId?: string;
  children?: ExploredItem[]; // Recursive storage of explored parts
  depth: number;
  timestamp: number;
}

export interface GenerationStatus {
  isGenerating: boolean;
  stage: 'idle' | 'analyzing' | 'rendering_assembled' | 'rendering_details' | 'scanning' | 'complete' | 'error';
  message?: string;
  currentFacts?: string[]; // Facts to cycle through during loading
}

export type PerspectiveType = 'General' | 'Industrial' | 'Scientific' | 'Conceptual';
export type StyleType = 'Default' | 'Schematic' | 'Drawing';
export type DetailLevelType = 'Simple' | 'Normal' | 'Detailed';

export interface GenerationOptions {
  perspective: PerspectiveType;
  style: StyleType;
  detailLevel: DetailLevelType;
}

export interface AppState {
  currentItem: ExploredItem | null;
  history: ExploredItem[]; // Linear path from root to current
  collection: ExploredItem[]; // Saved roots (Explorations)
  status: GenerationStatus;
  generationMode: 'fast' | 'full';
  generationOptions: GenerationOptions;
  isConfigured: boolean;
  isOffline: boolean;
}

export type ExploreAction = 
  | { type: 'UPDATE_SESSION'; payload: { currentItem: ExploredItem; history: ExploredItem[]; root: ExploredItem } }
  | { type: 'INIT_COLLECTION'; payload: ExploredItem[] }
  | { type: 'REMOVE_FROM_COLLECTION'; payload: string } // payload is id
  | { type: 'LOAD_FROM_COLLECTION'; payload: ExploredItem } // Loads a root item
  | { type: 'SET_STATUS'; payload: GenerationStatus }
  | { type: 'NAVIGATE_TO'; payload: string } // payload is id of item to go to
  | { type: 'SET_GENERATION_MODE'; payload: 'fast' | 'full' }
  | { type: 'SET_GENERATION_OPTIONS'; payload: Partial<GenerationOptions> }
  | { type: 'CONFIGURE_ACCESS'; payload: { isOffline: boolean } }
  | { type: 'RESET' };

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}