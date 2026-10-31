'use client';

import React, { useState } from 'react';
import {
  X,
  UserCheck,
  LogIn,
  LogOut,
  Mail,
  User,
  Coins,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export interface UserProfileData {
  id: string;
  name: string;
  email?: string | null;
  is_guest: boolean;
  credits: number;
  clerkEnabled?: boolean;
}

interface AuthProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfileData | null;
  onProfileUpdated: (updated: UserProfileData) => void;
}

export default function AuthProfileModal({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
}: AuthProfileModalProps) {
  const [name, setName] = useState<string>(
    userProfile && !userProfile.is_guest ? userProfile.name : ''
  );
  const [email, setEmail] = useState<string>(
    userProfile && !userProfile.is_guest && userProfile.email ? userProfile.email : ''
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLoggedIn = Boolean(userProfile && !userProfile.is_guest);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to sign in');
      }

      onProfileUpdated(data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Chinedu Okafor',
          email: 'chinedu.okafor@waec-prep.ng',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Demo sign in failed');
      }

      onProfileUpdated(data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Demo authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/user/auth', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sign out failed');
      }

      onProfileUpdated(data);
      setName('');
      setEmail('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign out');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (fullName?: string) => {
    if (!fullName) return 'ST';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[16px] max-w-md w-full p-6 sm:p-8 shadow-app-shell relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-[8px] bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#e2e8f0]/60 dark:hover:bg-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {isLoggedIn && userProfile ? (
          /* LOGGED-IN USER PROFILE VIEW */
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#2563eb] text-white font-bold text-base flex items-center justify-center">
                {getInitials(userProfile.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#0f172a] dark:text-[#f8fafc] truncate">
                    {userProfile.name}
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px]">
                    Pro
                  </span>
                </div>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate mt-0.5">
                  {userProfile.email || 'Authenticated WAEC Candidate'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">
                  <Coins className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                  <span>Solver Credits</span>
                </div>
                <div className="text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-1 font-mono">
                  {userProfile.credits}
                </div>
                <span className="text-[10px] text-[#1e3a8a] dark:text-[#93c5fd] font-medium">
                  Active Exam Quota
                </span>
              </div>

              <div className="p-3.5 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                  <span>Account Status</span>
                </div>
                <div className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
                  Verified Student
                </div>
                <span className="text-[10px] text-[#1e3a8a] dark:text-[#93c5fd] font-medium">
                  Cloud Sync Active
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-[8px] bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#0b1120] text-xs font-semibold transition"
              >
                Keep Studying
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="px-4 py-2 rounded-[8px] bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* UNAUTHENTICATED SIGN-IN VIEW */
          <div className="space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold mb-2">
                <UserCheck className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                <span>Student Account</span>
              </div>
              <h2 className="text-xl font-bold text-[#0f172a] dark:text-[#f8fafc]">
                Sign In to SolvAm
              </h2>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
                Save your WAEC scan history, sync custom pedagogy settings, and unlock 100 Pro solver credits.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-[8px] bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSignInSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chinedu Okafor"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] text-sm text-[#0f172a] dark:text-[#f8fafc] focus:bg-white dark:focus:bg-[#0b1120] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@school.edu.ng"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] text-sm text-[#0f172a] dark:text-[#f8fafc] focus:bg-white dark:focus:bg-[#0b1120] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In &amp; Claim 100 Credits</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#e2e8f0] dark:border-[#1e293b]" />
              <span className="flex-shrink mx-3 text-[10px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                Or 1-Click Demo Access
              </span>
              <div className="flex-grow border-t border-[#e2e8f0] dark:border-[#1e293b]" />
            </div>

            <button
              type="button"
              onClick={handleQuickDemoSignIn}
              disabled={loading}
              className="w-full py-2.5 bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] font-semibold text-xs rounded-[8px] transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>1-Click Demo Student Login (Chinedu Okafor)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
