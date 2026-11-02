'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MathDisplay from './MathDisplay';
import { PedagogicalSolution } from '@/lib/ai/types';
import {
  History,
  Sparkles,
  Award,
  BookOpen,
  RotateCcw,
  Trash2,
  Search,
  RefreshCw,
  Clock,
  ArrowRight,
  AlertCircle,
  Filter,
  Layers,
  ArrowUpRight,
  X,
  CheckCircle2,
} from 'lucide-react';

export interface HistoryItem {
  id: string;
  user_id: string;
  activity_type: 'learn' | 'practice';
  topic: string;
  raw_problem: string;
  latex_equation?: string | null;
  score_earned?: number | null;
  score_total?: number | null;
  solution_payload?: string | null;
  created_at: string;
}

interface HistoryWorkspaceViewProps {
  onRevisitLesson: (solution: PedagogicalSolution, equation: string) => void;
  onPracticeProblem: (problemText: string) => void;
  onNavigateToLearn: () => void;
  onNavigateToPractice: () => void;
}

type FilterTab = 'all' | 'learn' | 'practice';

/**
 * Format timestamp into human-readable relative or calendar time.
 */
function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60);
      return `${mins} min${mins > 1 ? 's' : ''} ago`;
    }
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    }
    if (diffSeconds < 172800) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recently';
  }
}

export default function HistoryWorkspaceView({
  onRevisitLesson,
  onPracticeProblem,
  onNavigateToLearn,
  onNavigateToPractice,
}: HistoryWorkspaceViewProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/history?limit=100');
      if (!res.ok) {
        throw new Error(`Failed to load history (${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setHistoryItems(data.history);
      } else {
        setHistoryItems([]);
      }
    } catch (err: any) {
      console.error('Study history fetch error:', err);
      setError(err?.message || 'Could not load your history. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete record');
      }
    } catch (err) {
      console.error('Delete item error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllHistory = async () => {
    setIsClearingAll(true);
    try {
      const res = await fetch('/api/history?all=true', {
        method: 'DELETE',
      });
      if (res.ok) {
        setHistoryItems([]);
        setShowClearConfirmModal(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to clear history');
      }
    } catch (err) {
      console.error('Clear all history error:', err);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleItemRevisit = (item: HistoryItem) => {
    if (item.activity_type === 'learn' && item.solution_payload) {
      try {
        const parsed: PedagogicalSolution =
          typeof item.solution_payload === 'string'
            ? JSON.parse(item.solution_payload)
            : item.solution_payload;
        onRevisitLesson(parsed, item.latex_equation || item.raw_problem);
        return;
      } catch (err) {
        console.warn('Could not parse stored solution payload, redirecting to learn:', err);
      }
    }
    // Fallback if no payload or practice
    onPracticeProblem(item.raw_problem);
  };

  // Filtered list based on tab and search
  const filteredItems = useMemo(() => {
    let list = historyItems;
    if (filterTab !== 'all') {
      list = list.filter((i) => i.activity_type === filterTab);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.topic.toLowerCase().includes(q) ||
          i.raw_problem.toLowerCase().includes(q) ||
          (i.latex_equation && i.latex_equation.toLowerCase().includes(q))
      );
    }
    return list;
  }, [historyItems, filterTab, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: historyItems.length,
      learn: historyItems.filter((i) => i.activity_type === 'learn').length,
      practice: historyItems.filter((i) => i.activity_type === 'practice').length,
    };
  }, [historyItems]);

  return (
    <div className="space-y-7 animate-fadeIn">
      {/* Header Banner */}
      <section className="space-y-5 pb-6 border-b border-line">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-fg">
              <History className="w-4 h-4" />
              <span>Personal Study Archive</span>
            </div>
            <h2 className="text-[24px] sm:text-[26px] leading-tight font-semibold text-ink">
              Study &amp; Practice History
            </h2>
            <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
              Replay instant step-by-step AI breakdowns with zero token cost, revisit verified WAEC exam methods, and re-attempt past practice drills.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 self-start flex-shrink-0">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={isLoading}
              title="Refresh study history"
              className="h-9 px-3 rounded-[10px] bg-surface hover:bg-surface-subtle text-ink border border-line hover:border-line-strong shadow-card text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {historyItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="h-9 px-3 rounded-[10px] bg-surface hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-line hover:border-rose-200 dark:hover:border-rose-900 shadow-card text-[13px] font-medium transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Activity Filter Tabs */}
          <div className="inline-flex p-1 rounded-[11px] bg-surface-subtle border border-line/80 self-start">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition-all flex items-center gap-2 ${
                filterTab === 'all'
                  ? 'bg-surface text-ink font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span>All Activity</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10.5px] bg-surface-subtle font-mono text-ink-soft">
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('learn')}
              className={`h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition-all flex items-center gap-2 ${
                filterTab === 'learn'
                  ? 'bg-surface text-ink font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-fg" />
              <span>Lessons</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10.5px] bg-surface-subtle font-mono text-ink-soft">
                {counts.learn}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('practice')}
              className={`h-8 px-3 rounded-[8px] text-[12.5px] font-medium transition-all flex items-center gap-2 ${
                filterTab === 'practice'
                  ? 'bg-surface text-ink font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-indigo-500" />
              <span>Drills</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10.5px] bg-surface-subtle font-mono text-ink-soft">
                {counts.practice}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic or equation..."
              className="w-full h-9 pl-9 pr-8 bg-surface border border-line hover:border-line-strong rounded-[10px] text-[13px] text-ink placeholder:text-ink-muted/70 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-ink-muted hover:text-ink rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-brand-fg animate-spin mx-auto" />
          <p className="text-sm font-medium text-ink">Loading your study history...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-900 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={fetchHistory}
            className="px-4 py-2 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="p-10 sm:p-14 rounded-2xl bg-surface border border-line text-center space-y-4 max-w-xl mx-auto shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-brand-tint flex items-center justify-center mx-auto text-brand-fg">
            <History className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-ink">
              {searchQuery
                ? 'No matching history entries found'
                : filterTab === 'learn'
                ? 'No learned lessons recorded yet'
                : filterTab === 'practice'
                ? 'No practice drills recorded yet'
                : 'No study history recorded yet'}
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed max-w-sm mx-auto">
              {searchQuery
                ? `No sessions match "${searchQuery}". Clear your search query to see all recorded sessions.`
                : 'Any lesson explained by Meta Muse Spark 1.3 or drill verified by SymPy CAS is automatically recorded here for instant replay.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="h-9 px-4 rounded-[10px] bg-surface-subtle hover:bg-surface border border-line text-xs font-medium text-ink transition"
              >
                Clear Search
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onNavigateToLearn}
                  className="h-9 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-xs font-medium transition flex items-center gap-2 shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Start Learning</span>
                </button>
                <button
                  type="button"
                  onClick={onNavigateToPractice}
                  className="h-9 px-4 rounded-[10px] bg-surface hover:bg-surface-subtle text-ink border border-line text-xs font-medium transition flex items-center gap-2 shadow-sm"
                >
                  <Award className="w-3.5 h-3.5 text-brand-fg" />
                  <span>Practice a Problem</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* History Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isLearn = item.activity_type === 'learn';
            const hasScore = item.score_earned !== null && item.score_earned !== undefined;
            const isPerfectScore = hasScore && item.score_earned === item.score_total;

            return (
              <div
                key={item.id}
                className="group p-5 rounded-2xl bg-surface border border-line hover:border-brand/40 shadow-card hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.12)] transition-all flex flex-col justify-between gap-4"
              >
                {/* Card Top: Badges & Timestamp */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isLearn ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200/60 dark:border-emerald-800/60">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          <span>Learned Lesson</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium border border-indigo-200/60 dark:border-indigo-800/60">
                          <Award className="w-3 h-3 text-indigo-500" />
                          <span>Practice Drill</span>
                        </span>
                      )}

                      {/* Score Badge (for practice) */}
                      {hasScore && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10.5px] font-semibold font-mono ${
                            isPerfectScore
                              ? 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                              : item.score_earned && item.score_earned > 0
                              ? 'bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                              : 'bg-rose-100/80 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200'
                          }`}
                        >
                          <span>WAEC Marks:</span>
                          <span>
                            {item.score_earned} / {item.score_total ?? 10}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Time & Delete Button */}
                    <div className="flex items-center gap-2 text-ink-muted">
                      <span className="flex items-center gap-1 text-[11px] text-ink-muted font-medium">
                        <Clock className="w-3 h-3 text-ink-muted" />
                        <span>{formatTimeAgo(item.created_at)}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        disabled={deletingId === item.id}
                        aria-label="Delete entry"
                        title="Delete entry"
                        className="p-1 rounded-[6px] text-ink-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-60 group-hover:opacity-100 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Topic Title */}
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-brand-fg">
                    {item.topic}
                  </div>

                  {/* Math Formula Preview Box */}
                  <div className="p-3.5 rounded-[12px] bg-surface-subtle border border-line/80 min-h-[60px] flex items-center justify-center overflow-x-auto">
                    <MathDisplay
                      value={item.latex_equation || item.raw_problem}
                      displayMode
                      className="text-ink font-medium text-sm text-center"
                    />
                  </div>
                </div>

                {/* Card Bottom: Action Buttons */}
                <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                  {isLearn && item.solution_payload ? (
                    <button
                      type="button"
                      onClick={() => handleItemRevisit(item)}
                      className="h-8 px-3 rounded-[8px] bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Revisit Lesson (0ms)</span>
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onPracticeProblem(item.raw_problem)}
                    className={`h-8 px-3 rounded-[8px] text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isLearn
                        ? 'bg-surface-subtle hover:bg-surface text-ink border border-line'
                        : 'bg-brand hover:bg-brand-hover text-white font-semibold shadow-sm'
                    } active:scale-[0.98]`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Practice in Pad</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Clear All */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface border border-line shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-ink">Clear All Study History?</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                This will permanently delete all your recorded lessons, practice drill scores, and cached step breakdowns from local and cloud storage. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isClearingAll}
                className="h-9 px-4 rounded-[10px] bg-surface-subtle hover:bg-surface text-ink text-xs font-medium border border-line transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllHistory}
                disabled={isClearingAll}
                className="h-9 px-4 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isClearingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Clear Everything</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
