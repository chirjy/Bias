import React from 'react';
import { Sparkles, Play, Users, BarChart3, FileText, PlusCircle, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentTab: 'materials' | 'upload' | 'host' | 'analytics' | 'participant';
  setCurrentTab: (tab: 'materials' | 'upload' | 'host' | 'analytics' | 'participant') => void;
  activeSessionPin?: string;
  onJoinPin?: (pin: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeSessionPin,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => setCurrentTab('materials')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform tracking-wider">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">BIAS</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Integritas
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Belajar Integritas Asyik dan Seru — "Hilangkan Bias, Bangun Integritas."</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setCurrentTab('materials')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'materials'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-4 h-4" /> Bank Soal
          </button>

          <button
            onClick={() => setCurrentTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Upload Materi AI
          </button>

          <button
            onClick={() => setCurrentTab('host')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'host'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Play className="w-4 h-4 text-emerald-400" /> Host Live Quiz
          </button>

          <button
            onClick={() => setCurrentTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Analitik
          </button>
        </nav>

        {/* Right CTA / Participant Join */}
        <div className="flex items-center gap-3">
          {activeSessionPin && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live PIN: <span className="font-mono text-sm tracking-wider font-bold">{activeSessionPin}</span>
            </div>
          )}

          <button
            onClick={() => setCurrentTab('participant')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'participant'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 scale-105'
                : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40'
            }`}
          >
            <Users className="w-4 h-4" /> Mode Peserta
          </button>
        </div>
      </div>
    </header>
  );
};
