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
      setEditableEquation(segment.latexPreview || '');
      setIsEditing(false);
    }
  }, [segment]);

  if (!isOpen || !segment) return null;

  const handleConfirm = () => {
    if (!croppedImageUri) return;
    onConfirmAndSolve(editableEquation.trim(), croppedImageUri);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-surface border border-line rounded-2xl p-6 sm:p-8 shadow-app-shell space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-[8px] text-ink-muted hover:text-ink bg-surface-subtle hover:bg-[#e2e8f0]/60 dark:hover:bg-[#1e293b] transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-brand-tint text-xs font-medium text-brand-ink">
            <Sparkles className="w-3.5 h-3.5 text-brand-fg" />
            <span>Verification Gate • KaTeX Confirmation</span>
          </div>
          <h2 className="text-xl font-semibold text-ink mt-2">
            Confirm Selected Problem
          </h2>
          <p className="text-xs text-ink-muted mt-1 leading-[1.6]">
            Verify that SolvAm accurately captured the equation from your exam page before triggering the solver.
          </p>
        </div>

        {/* Side-by-Side: Cropped Camera Image & Rendered KaTeX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cropped Camera Snippet */}
          <div className="p-4 bg-surface-subtle rounded-[12px] border border-line flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] text-ink-muted font-semibold uppercase tracking-wider">
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
              <div className="h-24 flex items-center justify-center text-xs text-ink-muted">
                Cropping region...
              </div>
            )}
          </div>

          {/* KaTeX Rendered Mathematical Truth */}
          <div className="p-4 bg-surface-subtle rounded-[12px] border border-line flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] text-brand-ink font-semibold uppercase tracking-wider">
              KaTeX Rendered Formula
            </span>
            <div className="p-3 min-h-16 flex items-center justify-center text-center">
              <MathDisplay
                value={editableEquation}
                displayMode
                className="text-ink font-semibold text-lg"
              />
            </div>
          </div>
        </div>

        {/* Quick Edit Input Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-ink">
            <label htmlFor="editableMath">Formula String (Editable):</label>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-brand-fg hover:text-[#1d4ed8] font-semibold flex items-center gap-1"
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
            className="w-full bg-surface-subtle border border-line rounded-[8px] px-4 py-3 text-sm font-mono text-ink focus:bg-white dark:focus:bg-[#0b1120] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
            placeholder="e.g. Find the 10th term of A.P: 3, 7, 11, 15 or 3x^2 - 5x - 2 = 0"
          />
        </div>

        {/* Learning Mode & Language Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-fg" />
              <span>Pedagogy Level:</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-sunken rounded-[8px]">
              {(['beginner', 'intermediate', 'expert'] as PedagogicalLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChangePedagogicalLevel(lvl)}
                  className={`py-1.5 rounded-[8px] text-xs font-medium capitalize transition ${
                    pedagogicalLevel === lvl
                      ? 'bg-brand text-white shadow-card'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-brand-fg" />
              <span>Explanation Language:</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-sunken rounded-[8px]">
              <button
                type="button"
                onClick={() => onChangeLanguageMode('standard')}
                className={`py-1.5 rounded-[8px] text-xs font-medium transition ${
                  languageMode === 'standard'
                    ? 'bg-brand text-white shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Standard English
              </button>
              <button
                type="button"
                onClick={() => onChangeLanguageMode('pidgin')}
                className={`py-1.5 rounded-[8px] text-xs font-medium transition ${
                  languageMode === 'pidgin'
                    ? 'bg-brand text-white shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Pidgin 🇳🇬
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-[8px] border border-line text-ink-muted hover:text-ink hover:bg-[#f8fafc] dark:hover:bg-[#0b1120] text-xs font-medium transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSolving || !croppedImageUri}
            className="w-full sm:w-auto px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-medium rounded-[8px] transition flex items-center justify-center gap-2 shadow-card disabled:opacity-50"
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
