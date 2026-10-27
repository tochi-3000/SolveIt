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
  ShieldAlert,
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

  // Sync initial equation preview whenever segment changes
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Verification Gate • KaTeX Confirmation</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Confirm Selected Problem</h2>
          <p className="text-xs text-slate-400 mt-1">
            Ensure SolvAm correctly captured the equation from your exam page before solving.
          </p>
        </div>

        {/* Side-by-Side: Cropped Camera Image & Rendered KaTeX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cropped Camera Snippet */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Camera Crop (Offscreen Canvas)
            </span>
            {croppedImageUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={croppedImageUri}
                alt="Cropped Math Segment"
                className="max-h-28 object-contain rounded-lg border border-slate-700 bg-white"
              />
            ) : (
              <div className="h-24 flex items-center justify-center text-xs text-slate-500">
                Cropping region...
              </div>
            )}
          </div>

          {/* KaTeX Rendered Mathematical Truth */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-500/30 flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              KaTeX Rendered Formula
            </span>
            <div className="p-2 min-h-16 flex items-center justify-center text-center">
              <MathDisplay
                value={editableEquation}
                displayMode
                className="text-emerald-300 font-bold text-lg"
              />
            </div>
          </div>
        </div>

        {/* Quick Edit Input Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <label htmlFor="editableMath">Formula String (Editable):</label>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Done Editing' : 'Edit Formula'}</span>
            </button>
          </div>

          <div className="relative">
            <input
              id="editableMath"
              type="text"
              value={editableEquation}
              onChange={(e) => setEditableEquation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="e.g. 3x^2 - 5x - 2 = 0"
            />
          </div>
        </div>

        {/* Learning Mode & Language Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          {/* Scaffolding Selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pedagogy Level:</span>
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(['beginner', 'intermediate', 'expert'] as PedagogicalLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChangePedagogicalLevel(lvl)}
                  className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    pedagogicalLevel === lvl
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Language Mode Selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Language:</span>
            </span>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onChangeLanguageMode('standard')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  languageMode === 'standard'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => onChangeLanguageMode('pidgin')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  languageMode === 'pidgin'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Pidgin 🇳🇬
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-semibold transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSolving || !editableEquation.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            {isSolving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Muse Spark Loop...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm & Solve with SolvAm</span>
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
