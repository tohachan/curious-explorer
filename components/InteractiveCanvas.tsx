

import React, { useState, useRef, MouseEvent, TouchEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Microscope, Layers, AlertTriangle, RefreshCw, Radar, Box, Maximize2, Info, Upload, X, Lightbulb, Camera } from 'lucide-react';
import { useExplorer } from '../context/ExplorerContext';
import { ItemPart } from '../types';

type ViewMode = 'assembled' | 'exploded';

export const InteractiveCanvas: React.FC = () => {
  const { state, explore, exploreFromImage, exploreFromDataUrl, reset, reconfigure } = useExplorer();
  const { currentItem, status } = state;
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 }); // Default to center
  const [isTouch, setIsTouch] = useState(false);
  
  // Controls
  const [viewMode, setViewMode] = useState<ViewMode>('assembled');
  const [isXRayActive, setIsXRayActive] = useState(false);
  
  // Info Popover State
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  // Characteristics Overlay State
  const [isCharacteristicsOpen, setIsCharacteristicsOpen] = useState(true);
  
  // Loading Facts State
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

  // Selected Part for Tooltip Persistence
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // X-Ray Loupe Radius (Responsive)
  const [loupeRadius, setLoupeRadius] = useState(128);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const hasAssembled = !!currentItem?.images?.assembled;

  // Detect touch device to disable parallax
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Monitor screen size for loupe radius
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      setLoupeRadius(isMobile ? 64 : 128); // 64px radius (w-32) for mobile, 128px radius (w-64) for desktop
    };
    
    handleResize(); // Initial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset controls when item changes
  useEffect(() => {
    // If no assembled image (Fast mode), force exploded view
    if (currentItem && !currentItem.images?.assembled) {
      setViewMode('exploded');
    } else {
      setViewMode('assembled');
    }
    setIsXRayActive(false);
    setIsInfoOpen(false);
    setIsCharacteristicsOpen(true);
    setSelectedPartId(null);
  }, [currentItem?.id]);

  // Rotate facts during loading
  useEffect(() => {
    if (status.isGenerating && status.currentFacts && status.currentFacts.length > 0) {
      const interval = setInterval(() => {
        setCurrentFactIndex((prev) => (prev + 1) % (status.currentFacts?.length || 1));
      }, 5000); // Change fact every 5 seconds
      return () => clearInterval(interval);
    }
  }, [status.isGenerating, status.currentFacts]);

  // Camera Management
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Prefer back camera
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Could not access camera. Please allow camera permissions.");
    }
  };

  // Attach stream to video element once it is mounted
  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [isCameraOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        stopCamera();
        exploreFromDataUrl(dataUrl);
      }
    }
  };

  // Cursor/Touch Position Handler
  const updateCursorPosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    
    // Clamp to 0-1 range to ensure loupe stays within bounds
    setMousePos({ 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    updateCursorPosition(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    updateCursorPosition(e.touches[0].clientX, e.touches[0].clientY);
  };

  // Clear selection on background click
  const handleBackgroundClick = () => {
    if (selectedPartId) setSelectedPartId(null);
  };

  // Determine which image to show based on mode
  const currentImageSrc = currentItem?.images 
    ? (viewMode === 'assembled' ? currentItem.images.assembled : currentItem.images.exploded)
    : undefined;

  // X-Ray image is the Cutaway view
  const xRayImageSrc = currentItem?.images?.cutaway;

  // 1. IDLE STATE
  if (!currentItem && status.stage === 'idle') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-cyber-subtext p-8 text-center bg-cyber-dark relative">
        <Scan size={64} className="text-cyber-dim mb-4 animate-pulse" />
        <h2 className="text-xl font-mono text-cyber-accent">SYSTEM IDLE</h2>
        <p className="mt-2 mb-8">Initiate object analysis to begin exploration.</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Upload Button */}
          <div className="relative group w-full sm:w-auto">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  exploreFromImage(e.target.files[0]);
                }
              }}
            />
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-cyber-panel border border-cyber-accent/50 text-cyber-accent rounded hover:bg-cyber-accent hover:text-cyber-dark transition-all group-hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Upload size={18} />
              <span className="font-mono font-bold">UPLOAD IMAGE</span>
            </button>
          </div>

          {/* Camera Button */}
          <button 
            onClick={startCamera}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-cyber-panel border border-cyber-accent/50 text-cyber-accent rounded hover:bg-cyber-accent hover:text-cyber-dark transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            <Camera size={18} />
            <span className="font-mono font-bold">TAKE PHOTO</span>
          </button>
        </div>
        
        <p className="text-[10px] text-cyber-subtext mt-4 uppercase tracking-widest">Supports PNG/JPG (Max 5MB)</p>

        {/* Camera Overlay */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col h-[100dvh] w-screen overflow-hidden">
            <div className="relative flex-1 bg-cyber-dark min-h-0">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              {/* Camera Grid Overlay */}
              <div className="absolute inset-0 pointer-events-none border-[20px] border-black/50">
                <div className="w-full h-full border border-cyber-dim/50 flex flex-col">
                  <div className="flex-1 border-b border-cyber-dim/50"></div>
                  <div className="flex-1 border-b border-cyber-dim/50"></div>
                  <div className="flex-1"></div>
                </div>
                <div className="absolute inset-0 flex">
                   <div className="flex-1 border-r border-cyber-dim/50"></div>
                   <div className="flex-1 border-r border-cyber-dim/50"></div>
                   <div className="flex-1"></div>
                </div>
                {/* Corner Brackets */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyber-accent"></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyber-accent"></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyber-accent"></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyber-accent"></div>
              </div>

              {/* Close Button */}
              <button 
                onClick={stopCamera}
                className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors z-50"
              >
                <X size={24} />
              </button>
            </div>

            {/* Controls Bar */}
            <div className="h-32 bg-cyber-panel flex items-center justify-center border-t border-cyber-dim shrink-0 z-50">
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-cyber-accent p-1 group transition-transform active:scale-95"
              >
                <div className="w-full h-full bg-cyber-accent rounded-full group-hover:bg-white transition-colors"></div>
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }

  // 2. ERROR STATE
  if (status.stage === 'error') {
     return (
      <div className="w-full h-full flex flex-col items-center justify-center text-cyber-subtext p-8 text-center bg-cyber-dark">
        <AlertTriangle size={64} className="text-red-500 mb-4" />
        <h2 className="text-xl font-mono text-red-500">SYSTEM FAILURE</h2>
        <p className="mt-2 text-white">{status.message || "An unknown error occurred during generation."}</p>
        <button 
          onClick={() => {
              if (state.isOffline) {
                  reconfigure();
              } else {
                  reset();
              }
          }}
          className="mt-6 flex items-center gap-2 px-4 py-2 border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-dark transition-colors"
        >
          <RefreshCw size={16} />
          RESET SYSTEM
        </button>
      </div>
    );
  }

  // 3. GENERATING STATES
  if (status.isGenerating) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-cyber-dark relative overflow-hidden">
        {/* Loading Grid Animation */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff10_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff10_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        
        {/* Icon Swap based on stage */}
        {status.stage === 'scanning' ? (
           <motion.div 
             animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
             transition={{ duration: 1.5, repeat: Infinity }}
             className="relative z-10 mb-8 text-cyber-accent"
           >
             <Radar size={80} />
             <div className="absolute inset-0 border-t-2 border-cyber-accent animate-spin rounded-full"></div>
           </motion.div>
        ) : (
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 border-4 border-cyber-dim border-t-cyber-accent rounded-full mb-8 relative z-10"
          />
        )}
        
        <div className="z-10 text-center max-w-md px-4">
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase">{status.stage.replace('_', ' ')}</h2>
          <p className="text-cyber-accent font-mono mt-2 animate-pulse">{status.message}</p>
          
          {/* Rotating Facts */}
          {status.currentFacts && status.currentFacts.length > 0 && (
            <div className="mt-8 h-16 relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFactIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-sm text-cyber-subtext italic font-mono border-l-2 border-cyber-dim pl-4 text-left"
                >
                  "DID YOU KNOW: {status.currentFacts[currentFactIndex]}"
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. MAIN INTERACTIVE STATE
  return (
    <div className="w-full h-full overflow-auto bg-cyber-dark relative scroll-smooth bg-[linear-gradient(to_right,#00f0ff02_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff02_1px,transparent_1px)] bg-[size:20px_20px]">
        {/* Main Content Area */}
        {currentItem && (
          <div className="min-h-full w-full flex items-center justify-center p-4 md:p-8 py-4 md:py-12">
            
            {/* Aspect Square Container for Responsive Canvas using Padding Hack for robust mobile support */}
            <div 
                className={`relative w-full max-w-[800px] mb-16 ${isXRayActive ? 'touch-none' : ''}`}
                // TODO: Revisit parallax effect later. Currently disabled.
                // style={{ perspective: isTouch ? 'none' : '1000px' }}
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchMove}
                onTouchMove={handleTouchMove}
                onClick={handleBackgroundClick}
            >
                {/* Padding Wrapper ensures 1:1 aspect ratio without relying on aspect-ratio CSS which can be buggy on some mobile renderers */}
                <div className="relative w-full pb-[100%]">
                    
                    {/* Controls Overlay - Positioned Absolute inside Container */}
                    <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 items-end">
                    
                        {/* View Toggle */}
                        <div className="flex bg-cyber-panel/90 border border-cyber-dim rounded-lg p-1 gap-1 shadow-xl backdrop-blur-md">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setViewMode('assembled'); }}
                                disabled={!hasAssembled}
                                className={`p-2 rounded flex items-center gap-2 text-[10px] sm:text-xs font-mono font-bold transition-all 
                                    ${!hasAssembled ? 'opacity-30 cursor-not-allowed' : viewMode === 'assembled' ? 'bg-cyber-accent text-cyber-dark' : 'text-cyber-subtext hover:text-white'}
                                `}
                            >
                                <Box size={14} /> <span className="hidden sm:inline">ASSEMBLED</span>
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewMode('exploded');
                                    setIsXRayActive(false); // Disable X-Ray when exploding
                                }}
                                className={`p-2 rounded flex items-center gap-2 text-[10px] sm:text-xs font-mono font-bold transition-all ${viewMode === 'exploded' ? 'bg-cyber-accent text-cyber-dark' : 'text-cyber-subtext hover:text-white'}
                            `}
                            >
                                <Maximize2 size={14} /> <span className="hidden sm:inline">EXPLODED</span>
                            </button>
                        </div>

                        {/* X-Ray Toggle (Only valid in Assembled Mode) */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsXRayActive(!isXRayActive); }}
                            disabled={viewMode === 'exploded' || !hasAssembled}
                            className={`p-2 sm:p-3 rounded-lg border backdrop-blur-md transition-all duration-300 shadow-lg flex items-center justify-center gap-2 font-mono text-[10px] sm:text-xs font-bold w-full sm:w-auto
                            ${(viewMode === 'exploded' || !hasAssembled) ? 'opacity-30 cursor-not-allowed bg-cyber-panel border-cyber-dim' : ''}
                            ${isXRayActive && viewMode === 'assembled' ? 'bg-cyber-accent text-cyber-dark border-cyber-accent' : 'bg-cyber-panel/80 text-cyber-accent border-cyber-dim hover:border-cyber-accent'}
                            `}
                        >
                            <Microscope size={16} /> <span className="hidden sm:inline">X-RAY VISION</span>
                        </button>
                    </div>

                    {/* Parallax Container - Absolute to fill the padding wrapper */}
                    <motion.div 
                        className="absolute inset-0 w-full h-full bg-cyber-panel/20 border border-cyber-dim/30 rounded-lg shadow-2xl overflow-hidden"
                        /* TODO: Revisit parallax effect later. Currently disabled.
                        style={{
                            rotateX: isTouch ? 0 : (mousePos.y - 0.5) * -2, 
                            rotateY: isTouch ? 0 : (mousePos.x - 0.5) * 2,
                            transformStyle: isTouch ? 'flat' : 'preserve-3d', // Flatten on touch to prevent glitches
                            backfaceVisibility: 'hidden',
                        }}
                        transition={isTouch ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 30 }}
                        */
                    >
                    {/* Image Layer - Simultaneous Transition */}
                    <AnimatePresence>
                        {currentImageSrc ? (
                        <motion.img 
                            key={viewMode} // Re-animate on mode switch
                            initial={{ 
                                opacity: 0, 
                                scale: viewMode === 'exploded' ? 0.9 : 1 
                            }}
                            animate={{ 
                                opacity: 1, 
                                scale: 1 
                            }}
                            exit={{ 
                                opacity: 0, 
                                scale: viewMode === 'exploded' ? 0.9 : 1
                            }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            src={currentImageSrc} 
                            alt={currentItem.name} 
                            className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(0,240,255,0.15)] p-4 sm:p-8"
                            draggable={false}
                        />
                        ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center relative">
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff05_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff05_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                            <AlertTriangle className="text-cyber-accent mb-4 opacity-50" size={48} />
                            <p className="text-cyber-subtext font-mono text-center max-w-xs px-4">
                                Visual schematics unavailable. Structure data loaded successfully.
                            </p>
                        </div>
                        )}
                    </AnimatePresence>

                    {/* X-Ray Loupe Overlay (Cutaway View) */}
                    {isXRayActive && viewMode === 'assembled' && xRayImageSrc && hasAssembled && (
                        <>
                            {/* 1. The X-Ray Image Layer - Exact duplicate of base position/size, clipped */}
                            <img
                                src={xRayImageSrc}
                                alt="X-Ray View"
                                className="absolute inset-0 w-full h-full object-contain p-4 sm:p-8" // Matches base image padding exactly, no drop-shadow
                                style={{
                                    clipPath: `circle(${loupeRadius}px at ${mousePos.x * 100}% ${mousePos.y * 100}%)`,
                                    zIndex: 20,
                                    pointerEvents: 'none' // Let clicks pass through
                                }}
                            />
                            
                            {/* 2. Grid Overlay - Clipped to same circle */}
                            <div 
                                className="absolute inset-0 pointer-events-none z-20"
                                style={{
                                    clipPath: `circle(${loupeRadius}px at ${mousePos.x * 100}% ${mousePos.y * 100}%)`,
                                    background: 'transparent'
                                }}
                            >
                                <div className="w-full h-full bg-cyber-accent/10 bg-[size:10px_10px] bg-[linear-gradient(to_right,#00f0ff40_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff40_1px,transparent_1px)]"></div>
                            </div>

                            {/* 3. The Loupe Ring UI - Visual border only */}
                            <div 
                                className="pointer-events-none absolute rounded-full border-2 border-cyber-accent shadow-[0_0_50px_rgba(0,240,255,0.3)] z-30"
                                style={{
                                    left: `${mousePos.x * 100}%`,
                                    top: `${mousePos.y * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                    width: `${loupeRadius * 2}px`,
                                    height: `${loupeRadius * 2}px`,
                                }}
                            />
                        </>
                    )}

                    {/* Hotspots (Only visible in EXPLODED mode) */}
                    {viewMode === 'exploded' && currentItem.parts.map((part) => {
                        // Check if this part has already been explored in the children list
                        const isExplored = currentItem.children?.some(child => 
                        child.name.toLowerCase().includes(part.name.toLowerCase()) || 
                        part.name.toLowerCase().includes(child.name.toLowerCase())
                        );
                        
                        return (
                        <Hotspot 
                            key={part.id} 
                            part={part} 
                            isExplored={!!isExplored}
                            isSelected={selectedPartId === part.id}
                            onSelect={(e) => {
                              e.stopPropagation();
                              setSelectedPartId(part.id);
                            }}
                            onAction={() => explore(part.name, currentItem.id)} 
                        />
                        );
                    })}

                    {/* Characteristics Overlay HUD - Bottom Left inside Container */}
                    {currentItem.characteristics && currentItem.characteristics.length > 0 && (
                        <AnimatePresence mode="wait">
                        {isCharacteristicsOpen ? (
                            <motion.div 
                            key="overlay"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 p-3 sm:p-4 bg-cyber-panel/90 border border-cyber-accent/30 rounded backdrop-blur-md max-w-[200px] sm:max-w-xs z-20 shadow-lg"
                            >
                                <div className="flex justify-between items-start mb-2 border-b border-cyber-dim pb-1">
                                <h4 className="text-[10px] text-cyber-accent uppercase tracking-widest font-bold">
                                    System Analysis // Specs
                                </h4>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsCharacteristicsOpen(false); }}
                                    className="text-cyber-subtext hover:text-white -mt-1 -mr-1 p-1"
                                >
                                    <X size={12} />
                                </button>
                                </div>
                                <div className="space-y-1">
                                    {currentItem.characteristics.map((item, i) => (
                                        <div key={i} className="flex justify-between gap-2 sm:gap-6 text-[10px] sm:text-xs font-mono">
                                            <span className="text-cyber-subtext uppercase opacity-75 truncate">{item.label}</span>
                                            <span className="text-white font-bold truncate text-right">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.button
                            key="collapsed-icon"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ duration: 0.1 }}
                            onClick={(e) => { e.stopPropagation(); setIsCharacteristicsOpen(true); }}
                            className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 p-3 rounded-full bg-cyber-panel/90 border border-cyber-accent/50 text-cyber-accent hover:bg-cyber-accent hover:text-cyber-dark transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] z-20 backdrop-blur-md"
                            >
                            <Lightbulb size={20} />
                            </motion.button>
                        )}
                        </AnimatePresence>
                    )}

                    {/* Interesting Facts Button - Bottom Right */}
                    {currentItem?.facts && currentItem.facts.length > 0 && (
                        <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 z-20" onClick={(e) => e.stopPropagation()}>
                            <div className="relative group">
                            {/* Popover */}
                            <div className={`absolute bottom-full right-0 mb-3 w-48 sm:w-64 bg-cyber-panel/95 backdrop-blur-md border border-cyber-accent/30 rounded p-4 shadow-2xl transition-all origin-bottom-right
                                ${isInfoOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto'}
                            `}>
                                <h4 className="text-[10px] text-cyber-accent uppercase tracking-widest font-bold mb-2 border-b border-cyber-dim pb-1">Interesting facts</h4>
                                <ul className="space-y-2">
                                {currentItem.facts.map((fact, idx) => (
                                    <li key={idx} className="text-[10px] sm:text-[11px] text-cyber-subtext font-mono leading-tight flex gap-2">
                                    <span className="text-cyber-dim select-none">•</span>
                                    {fact}
                                    </li>
                                ))}
                                </ul>
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsInfoOpen(!isInfoOpen); }}
                                className="p-3 rounded-full bg-cyber-panel/90 border border-cyber-accent/50 text-cyber-accent hover:bg-cyber-accent hover:text-cyber-dark transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] backdrop-blur-md"
                            >
                                <Info size={20} />
                            </button>
                            </div>
                        </div>
                    )}

                    </motion.div>

                    {/* Title Overlay - Relative to Container so it stays near image */}
                    {/* Positioned relative to the padding wrapper bottom */}
                    <div className="absolute -bottom-16 left-0 z-10 pointer-events-none w-full px-4 sm:px-0">
                        <h1 className="text-xl sm:text-3xl font-bold font-mono text-white tracking-tighter uppercase drop-shadow-lg truncate">
                            {currentItem.name}
                        </h1>
                        <p className="text-cyber-accent font-mono text-[10px] sm:text-xs mt-1 border-l-2 border-cyber-accent pl-2 uppercase">
                            {currentItem.category} // SYSTEM_DEPTH: {currentItem.depth}
                        </p>
                    </div>

                </div>
            </div>

          </div>
        )}
    </div>
  );
};

interface HotspotProps {
  part: ItemPart;
  onSelect: (e: React.MouseEvent) => void;
  onAction: () => void;
  isExplored?: boolean;
  isSelected: boolean;
}

const Hotspot: React.FC<HotspotProps> = ({ part, onSelect, onAction, isExplored, isSelected }) => {
  // Styles based on exploration status
  const baseColorClass = isExplored ? 'bg-green-500' : 'bg-cyber-accent';
  const shadowClass = isExplored ? 'shadow-[0_0_10px_#22c55e]' : 'shadow-[0_0_10px_#00f0ff]';
  const borderColorClass = isExplored ? 'border-green-500/50' : 'border-cyber-accent/50';
  const ringBorderClass = isExplored ? 'border-green-500/30' : 'border-cyber-accent/30';

  return (
    <div
      className="absolute z-20"
      style={{ left: `${part.x}%`, top: `${part.y}%` }}
    >
      <motion.div
        className="relative -translate-x-1/2 -translate-y-1/2 w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center cursor-pointer group"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 + Math.random() * 0.5 }}
        onClick={onSelect}
      >
        <div className={`absolute inset-0 border ${borderColorClass} rounded-full animate-ping opacity-20`}></div>
        <div className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full ${baseColorClass} ${shadowClass} group-hover:bg-white transition-colors`}></div>
        <div className={`absolute w-full h-full border ${isSelected ? 'scale-125 border-white' : `${ringBorderClass} scale-50 group-hover:scale-125`} rounded-full transition-transform duration-300`}></div>

        {/* Invisible Hover Bridge - Improves usability when moving cursor to tooltip */}
        <div className="hidden sm:block absolute right-full mr-0 w-6 h-8 top-1/2 -translate-y-1/2 bg-transparent z-40"></div>

        {/* TOOLTIP */}
        <div 
          className={`hidden sm:block absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-cyber-dark/95 border border-cyber-dim backdrop-blur-md px-4 py-3 rounded-sm min-w-[200px] shadow-2xl
                     transition-all duration-200 z-50 origin-right
                     ${isSelected 
                        ? 'opacity-100 translate-x-0 pointer-events-auto' 
                        : 'opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto'
                     }`}
           onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-1 border-b border-cyber-dim pb-1 justify-end">
             <span className={`text-[10px] uppercase tracking-widest font-mono ${isExplored ? 'text-green-500' : 'text-cyber-subtext'}`}>
               {isExplored ? 'Analysis Complete' : 'Component Analysis'}
             </span>
             <div className={`w-1 h-1 ${isExplored ? 'bg-green-500' : 'bg-cyber-accent'}`}></div>
          </div>
          <div className="text-white font-bold text-sm mb-1 text-right">{part.name}</div>
          <div className="text-[11px] text-cyber-subtext leading-tight text-right">{part.description}</div>
          
          <button
             className={`mt-2 pt-1 flex items-center justify-end gap-1 text-[10px] font-mono uppercase w-full hover:underline focus:outline-none ${isExplored ? 'text-green-400' : 'text-cyber-accent'}`}
             onClick={(e) => {
                 e.stopPropagation();
                 onAction();
             }}
          >
            <span>{isExplored ? 'Review Data' : 'Deconstruct'}</span>
            <Layers size={10} />
          </button>
        </div>
        
        <div className={`hidden sm:block absolute right-full mr-0 w-4 h-[1px] top-1/2 transition-opacity duration-200 
            ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            ${isExplored ? 'bg-green-500/50' : 'bg-cyber-accent/50'}`}></div>

      </motion.div>
    </div>
  );
};
