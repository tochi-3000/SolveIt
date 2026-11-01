'use client';

import React, { useState, useRef } from 'react';
import { SAMSegment, BoundingBox } from '@solvam/shared-types';
import MathDisplay from './MathDisplay';
import { Sparkles, Scan, Move, CheckCircle2, ChevronRight, Info } from 'lucide-react';

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

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<BoundingBox | null>(null);

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

    if (
      currentDragBox.xMax - currentDragBox.xMin > 0.03 &&
      currentDragBox.yMax - currentDragBox.yMin > 0.03
    ) {
      if (onCustomCrop) {
        onCustomCrop(currentDragBox);
      }
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
    <div className="bg-surface border border-line rounded-[12px] p-6 sm:p-7 space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-brand-tint text-xs font-medium text-brand-ink">
            <Sparkles className="w-3.5 h-3.5 text-brand-fg" />
            <span>Meta SAM 3.1 Multi-Equation Perception</span>
          </div>
          <h3 className="text-lg font-semibold text-ink mt-2">
            Interactive Page Segmentation
          </h3>
          <p className="text-xs text-ink-muted mt-0.5 leading-[1.6]">
            Select any isolated equation mask on the exam sheet or pick from the detected list on the right.
          </p>
        </div>

        {/* Manual Drag Toggle Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setManualMode(!manualMode)}
            className={`px-3.5 py-2 text-xs font-medium rounded-[8px] transition flex items-center gap-2 ${
              manualMode
                ? 'bg-brand text-white shadow-card'
                : 'bg-brand-tint hover:bg-brand/15 text-brand-ink'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>{manualMode ? 'Cancel Manual Box' : 'Drag Custom Region'}</span>
          </button>

          <span className="text-xs font-mono font-semibold px-3 py-2 bg-surface text-brand-ink border border-line rounded-[8px] flex items-center gap-1.5">
            <Scan className="w-3.5 h-3.5 text-brand-fg" />
            <span>{segments.length} Equations</span>
          </span>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Image with Bounding Boxes (8 cols) */}
        <div className="lg:col-span-8 flex justify-center bg-surface rounded-[12px] p-4 border border-line">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`relative max-w-full rounded-[8px] overflow-hidden border border-line select-none bg-white ${
              manualMode ? 'cursor-crosshair' : 'cursor-default'
            }`}
            style={{ touchAction: 'none' }}
          >
            {/* The Base Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="WAEC Exam Sheet"
              className="w-full h-auto block max-h-[700px] object-contain bg-white"
              draggable={false}
            />

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/85 dark:bg-[#0b1120]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
                <div className="w-9 h-9 border-3 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-brand-ink">
                  Meta SAM 3.1 Segmenting Exam Sheet...
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
                    className={`absolute transition-all duration-150 cursor-pointer rounded-[8px] ${
                      isSelected
                        ? 'border-2 border-brand bg-[#2563eb]/15 shadow-md z-20'
                        : isHovered
                        ? 'border-2 border-brand bg-[#dbeafe]/45 z-10'
                        : 'border border-dashed border-[#2563eb]/70 bg-[#dbeafe]/20 hover:border-[#2563eb]'
                    }`}
                    style={{ top, left, width, height }}
                  >
                    <div
                      className={`absolute -top-3 left-2 px-2 py-0.5 rounded-[8px] text-[10px] font-semibold font-mono tracking-tight flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-brand text-white shadow-card'
                          : isHovered
                          ? 'bg-[#1e3a8a] text-white shadow-card'
                          : 'bg-white text-[#1e3a8a] border border-[#dbeafe] shadow-card'
                      }`}
                    >
                      <span>{seg.label}</span>
                      <span className="opacity-80">({Math.round(seg.confidence * 100)}%)</span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-brand text-white rounded-full shadow-card">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Manual Dragging Box Visualization */}
            {manualMode && currentDragBox && (
              <div
                className="absolute border-2 border-brand bg-[#dbeafe]/40 rounded-[8px] z-30 pointer-events-none"
                style={{
                  top: `${currentDragBox.yMin * 100}%`,
                  left: `${currentDragBox.xMin * 100}%`,
                  width: `${(currentDragBox.xMax - currentDragBox.xMin) * 100}%`,
                  height: `${(currentDragBox.yMax - currentDragBox.yMin) * 100}%`,
                }}
              >
                <div className="absolute -top-3 left-1 px-2 py-0.5 bg-brand text-white text-[10px] font-semibold rounded-[8px]">
                  Release to Select
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Equation Selector List & Preview (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-medium text-ink-muted uppercase tracking-wider flex items-center justify-between">
              <span>Detected Questions ({segments.length})</span>
              <span className="text-[11px] font-semibold text-brand-ink">
                Select to Solve
              </span>
            </div>

            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {segments.map((seg, idx) => {
                const isSelected = selectedSegmentId === seg.id;
                const stepNum = String(idx + 1).padStart(2, '0');
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => onSelectSegment(seg)}
                    onMouseEnter={() => setHoveredSegmentId(seg.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                    className={`w-full text-left p-4 rounded-[12px] border transition flex flex-col gap-3 ${
                      isSelected
                        ? 'bg-brand-tint border-[#2563eb]/40 dark:border-[#3b82f6]/50 shadow-card'
                        : 'bg-surface hover:bg-surface-sunken/60 border-line text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-[8px] font-mono text-xs font-medium flex-shrink-0 ${
                            isSelected
                              ? 'bg-brand text-white'
                              : 'bg-brand-tint text-brand-ink'
                          }`}
                        >
                          {stepNum}
                        </span>
                        <span className="text-xs font-medium text-ink truncate">
                          {seg.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-brand-ink bg-brand-tint px-2 py-0.5 rounded-[8px] font-semibold flex-shrink-0">
                        {Math.round(seg.confidence * 100)}%
                      </span>
                    </div>

                    {seg.latexPreview && (
                      <div className="py-3 px-3 bg-surface rounded-[8px] text-center border border-[#e2e8f0]/80 dark:border-[#1e293b] overflow-x-auto">
                        <MathDisplay
                          value={seg.latexPreview}
                          displayMode
                          className="text-xs text-ink font-semibold"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                      <span>SAM 3.1 Region</span>
                      <span className="flex items-center gap-0.5 text-brand-fg font-semibold">
                        Verify Formula <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 bg-[#dbeafe]/55 dark:bg-[#1e3a8a]/30 rounded-[8px] text-xs text-brand-ink flex items-start gap-2.5 leading-[1.6]">
            <Info className="w-4 h-4 text-brand-fg flex-shrink-0 mt-0.5" />
            <span>
              <strong>Zero-Hallucination Invariant:</strong> SAM 3.1 isolates regions visually while exact roots are verified by SymPy AST.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SamSegmentationCanvas;
