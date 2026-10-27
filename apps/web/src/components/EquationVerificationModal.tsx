'use client';

import React, { useState, useEffect } from 'react';
import { SAMSegment, PedagogicalLevel, LanguageMode } from '@solvam/shared-types';
import MathDisplay from './MathDisplay';
import {
  Sparkles,
  Check,
  Edit3,
  X,
  Layers,
  Globe2,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

interface EquationVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment: SAMSegment | null;
  croppedImageUri: string | null;
  pedagogicalLevel: PedagogicalLevel;
  onChangePedagogicalLevel: (level: PedagogicalLevel) => void;
  languageMode: LanguageMode;
  onChangeLanguageMode: (mode: LanguageMode) => void;
  onConfirmAndSolve: (verifiedEquation: string, croppedImage: string) => void;
  isSolving?: boolean;
}

export const EquationVerificationModal: React.FC<EquationVerificationModalProps> = ({
  isOpen,
  onClose,
  segment,
  croppedImageUri,
  pedagogicalLevel,
  onChangePedagogicalLevel,
  languageMode,
  onChangeLanguageMode,
  onConfirmAndSolve,
  isSolving = false,
}) => {
  const [editableEquation, setEditableEquation] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    if (segment) {
      setEditableEquation(segment.latexPreview || '3x^2 - 5x - 2 = 0');
      setIsEditing(false);
    }
  }, [segment]);

  if (!isOpen || !segment) return null;

  const handleConfirm = () => {
    if (!editableEquation.trim() || !croppedImageUri) return;
    onConfirmAndSolve(editableEquation.trim(), croppedImageUri);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[16px] p-6 sm:p-8 shadow-app-shell space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-[8px] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#e2e8f0]/60 dark:hover:bg-[#1e293b] transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
            <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>Verification Gate • KaTeX Confirmation</span>
          </div>
          <h2 className="text-xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
            Confirm Selected Problem
          </h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
            Verify that SolvAm accurately captured the equation from your exam page before triggering the solver.
          </p>
        </div>

        {/* Side-by-Side: Cropped Camera Image & Rendered KaTeX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cropped Camera Snippet */}
          <div className="p-4 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-semibold uppercase tracking-wider">
              Camera Crop (Offscreen Canvas)
            </span>
            {croppedImageUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={croppedImageUri}
                alt="Cropped Math Segment"
                className="max-h-28 object-contain rounded-[8px] border border-[#e2e8f0] bg-white"
              />
            ) : (
              <div className="h-24 flex items-center justify-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                Cropping region...
              </div>
            )}
          </div>

          {/* KaTeX Rendered Mathematical Truth */}
          <div className="p-4 bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] text-[#1e3a8a] dark:text-[#93c5fd] font-semibold uppercase tracking-wider">
              KaTeX Rendered Formula
            </span>
            <div className="p-3 min-h-16 flex items-center justify-center text-center">
              <MathDisplay
                value={editableEquation}
                displayMode
                className="text-[#0f172a] dark:text-[#f8fafc] font-bold text-lg"
              />
            </div>
          </div>
        </div>

        {/* Quick Edit Input Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            <label htmlFor="editableMath">Formula String (Editable):</label>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-[#2563eb] dark:text-[#60a5fa] hover:text-[#1d4ed8] font-semibold flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Done Editing' : 'Edit Formula'}</span>
            </button>
          </div>

          <input
            id="editableMath"
            type="text"
            value={editableEquation}
            onChange={(e) => setEditableEquation(e.target.value)}
            className="w-full bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-3 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:bg-white dark:focus:bg-[#0b1120] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
            placeholder="e.g. 3x^2 - 5x - 2 = 0"
          />
        </div>

        {/* Learning Mode & Language Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b]">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Pedagogy Level:</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f0f5fa] dark:bg-[#0b1120] rounded-[8px]">
              {(['beginner', 'intermediate', 'expert'] as PedagogicalLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChangePedagogicalLevel(lvl)}
                  className={`py-1.5 rounded-[8px] text-xs font-semibold capitalize transition ${
                    pedagogicalLevel === lvl
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Explanation Language:</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#f0f5fa] dark:bg-[#0b1120] rounded-[8px]">
              <button
                type="button"
                onClick={() => onChangeLanguageMode('standard')}
                className={`py-1.5 rounded-[8px] text-xs font-semibold transition ${
                  languageMode === 'standard'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                }`}
              >
                Standard English
              </button>
              <button
                type="button"
                onClick={() => onChangeLanguageMode('pidgin')}
                className={`py-1.5 rounded-[8px] text-xs font-semibold transition ${
                  languageMode === 'pidgin'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                }`}
              >
                Pidgin 🇳🇬
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#0b1120] text-xs font-semibold transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSolving || !editableEquation.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSolving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Muse Spark Loop...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm &amp; Solve with SolvAm</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquationVerificationModal;
