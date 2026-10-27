'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SAMSegment, BoundingBox } from '@solvam/shared-types';
import MathDisplay from './MathDisplay';
import { Sparkles, Scan, Move, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';

interface SamSegmentationCanvasProps {
  imageUrl: string;
  segments: SAMSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (segment: SAMSegment) => void;
  onCustomCrop?: (box: BoundingBox) => void;
  isLoading?: boolean;
}

export const SamSegmentationCanvas: React.FC<SamSegmentationCanvasProps> = ({
  imageUrl,
  segments,
  selectedSegmentId,
  onSelectSegment,
  onCustomCrop,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState<boolean>(false);

  // Manual Drag Box State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<BoundingBox | null>(null);

  // Handle Mouse / Touch down for manual bounding box
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!manualMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setIsDragging(true);
    setDragStart({ x, y });
    setCurrentDragBox({ xMin: x, yMin: y, xMax: x, yMax: y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const xMin = Math.min(dragStart.x, currentX);
    const xMax = Math.max(dragStart.x, currentX);
    const yMin = Math.min(dragStart.y, currentY);
    const yMax = Math.max(dragStart.y, currentY);

    setCurrentDragBox({ xMin, yMin, xMax, yMax });
  };

  const handlePointerUp = () => {
    if (!isDragging || !currentDragBox) return;
    setIsDragging(false);

    // If box has meaningful area (> 2% width & height)
    if (
      currentDragBox.xMax - currentDragBox.xMin > 0.03 &&
      currentDragBox.yMax - currentDragBox.yMin > 0.03
    ) {
      if (onCustomCrop) {
        onCustomCrop(currentDragBox);
      }
      // Create ephemeral custom segment
      const customSeg: SAMSegment = {
        id: `custom_${Date.now()}`,
        label: 'Custom Selected Problem Region',
        boundingBox: currentDragBox,
        confidence: 1.0,
      };
      onSelectSegment(customSeg);
      setManualMode(false);
      setCurrentDragBox(null);
    } else {
      setCurrentDragBox(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Meta SAM 3.1 Multi-Equation Perception</span>
          </div>
          <h3 className="text-xl font-black text-white mt-1">Interactive Page Segmentation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tap any glowing equation box to isolate and solve that specific problem.
          </p>
        </div>

        {/* Manual Drag Toggle Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setManualMode(!manualMode)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-2 ${
              manualMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Move className="w-4 h-4" />
            <span>{manualMode ? 'Cancel Manual Box' : 'Drag Custom Box'}</span>
          </button>

          <span className="text-xs font-mono px-3 py-1.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 rounded-xl flex items-center gap-1.5">
            <Scan className="w-3.5 h-3.5" />
            <span>{segments.length} Equations Isolated</span>
          </span>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Image with Bounding Boxes (8 cols) */}
        <div className="lg:col-span-8 flex justify-center">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`relative max-w-full rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl select-none ${
              manualMode ? 'cursor-crosshair' : 'cursor-default'
            }`}
            style={{ touchAction: 'none' }}
          >
            {/* The Base Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="WAEC Exam Sheet"
              className="w-full h-auto block max-h-[720px] object-contain bg-slate-950"
              draggable={false}
            />

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold text-emerald-300">
                  Meta SAM 3.1 Segmenting Page...
                </span>
              </div>
            )}

            {/* SAM 3.1 Bounding Box Overlays */}
            {!manualMode &&
              segments.map((seg) => {
                const isSelected = selectedSegmentId === seg.id;
                const isHovered = hoveredSegmentId === seg.id;

                const top = `${seg.boundingBox.yMin * 100}%`;
                const left = `${seg.boundingBox.xMin * 100}%`;
                const width = `${(seg.boundingBox.xMax - seg.boundingBox.xMin) * 100}%`;
                const height = `${(seg.boundingBox.yMax - seg.boundingBox.yMin) * 100}%`;

                return (
                  <div
                    key={seg.id}
                    onClick={() => onSelectSegment(seg)}
                    onMouseEnter={() => setHoveredSegmentId(seg.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                    className={`absolute transition-all duration-200 cursor-pointer rounded-lg ${
                      isSelected
                        ? 'border-2 border-emerald-400 bg-emerald-500/25 shadow-lg shadow-emerald-500/30 z-20'
                        : isHovered
                        ? 'border-2 border-amber-400 bg-amber-400/20 shadow-md shadow-amber-500/20 z-10 scale-[1.005]'
                        : 'border-2 border-dashed border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400'
                    }`}
                    style={{ top, left, width, height }}
                  >
                    {/* Floating Label Badge */}
                    <div
                      className={`absolute -top-3.5 left-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow-md'
                          : isHovered
                          ? 'bg-amber-400 text-slate-950 shadow-md'
                          : 'bg-slate-900/90 text-emerald-300 border border-emerald-500/40 backdrop-blur'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{seg.label}</span>
                      <span className="opacity-80">({Math.round(seg.confidence * 100)}%)</span>
                    </div>

                    {/* Checkmark indicator when selected */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-emerald-500 text-slate-950 rounded-full shadow-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Manual Dragging Box Visualization */}
            {manualMode && currentDragBox && (
              <div
                className="absolute border-2 border-amber-400 bg-amber-500/20 rounded z-30 pointer-events-none"
                style={{
                  top: `${currentDragBox.yMin * 100}%`,
                  left: `${currentDragBox.xMin * 100}%`,
                  width: `${(currentDragBox.xMax - currentDragBox.xMin) * 100}%`,
                  height: `${(currentDragBox.yMax - currentDragBox.yMin) * 100}%`,
                }}
              >
                <div className="absolute -top-3 left-1 px-1.5 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-bold rounded">
                  Release to Select
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Equation Selector List & Preview (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Segmented Equations ({segments.length})</span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {segments.map((seg, idx) => {
                const isSelected = selectedSegmentId === seg.id;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => onSelectSegment(seg)}
                    onMouseEnter={() => setHoveredSegmentId(seg.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950'
                        : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Q{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white line-clamp-1">{seg.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        {Math.round(seg.confidence * 100)}%
                      </span>
                    </div>

                    {seg.latexPreview && (
                      <div className="p-2 bg-slate-900/80 rounded-xl text-center border border-slate-800/80 overflow-x-auto">
                        <MathDisplay
                          value={seg.latexPreview}
                          displayMode
                          className="text-xs text-emerald-300 font-semibold"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Meta SAM 3.1 Box</span>
                      <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                        Select & Solve <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Perception Invariant:</strong> SAM 3.1 runs page segmentation with 0% arithmetic hallucination risk. Mathematical computation is strictly reserved for SymPy.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SamSegmentationCanvas;
