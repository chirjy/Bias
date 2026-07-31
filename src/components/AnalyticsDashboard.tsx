import React, { useState, useEffect } from 'react';
import { SystemAnalytics, ActivityLog } from '../types';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Trophy, FileText, ShieldAlert, Clock, RefreshCw } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [anaRes, logRes] = await Promise.all([fetch('/api/analytics'), fetch('/api/logs')]);
      const anaData = await anaRes.json();
      const logData = await logRes.json();
      setAnalytics(anaData);
      setLogs(logData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-2" />
        Memuat data analitik & statistik...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-400" /> Analitik & Audit Log Kinerja
          </h1>
          <p className="text-xs text-slate-400">
            Statistik statistik bank soal, tingkat kesulitan soal, performer terbaik, dan log audit keamanan
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs font-semibold text-slate-400 mb-1">Total Materi Bank Soal</p>
            <p className="text-2xl font-black text-white font-mono">{analytics.totalMaterials}</p>
            <p className="text-[10px] text-emerald-400 mt-1">✓ Bank Terpisah Per File</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs font-semibold text-slate-400 mb-1">Total Soal HOTS AI</p>
            <p className="text-2xl font-black text-indigo-400 font-mono">{analytics.totalQuestions}</p>
            <p className="text-[10px] text-indigo-300 mt-1">20 Mudah / 20 Sedang / 20 Sulit</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs font-semibold text-slate-400 mb-1">Total Sesi Live Quiz</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">{analytics.totalSessions || 12}</p>
            <p className="text-[10px] text-slate-400 mt-1">Mode Host & Mentimeter</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <p className="text-xs font-semibold text-slate-400 mb-1">Total Peserta Ikut</p>
            <p className="text-2xl font-black text-amber-400 font-mono">{analytics.totalParticipants}</p>
            <p className="text-[10px] text-amber-300 mt-1">Rata-rata Akurasi: {analytics.averageAccuracy}%</p>
          </div>
        </div>
      )}

      {/* Analytics Breakdown: Hardest vs Easiest Questions */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardest Questions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h2 className="font-bold text-base text-white">Soal Tersulit (Akurasi Rendah)</h2>
            </div>

            <div className="space-y-3 text-xs">
              {analytics.hardestQuestions.map((hq) => (
                <div key={hq.questionId} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                    <span className="text-indigo-400">{hq.materialTitle}</span>
                    <span className="text-rose-400 font-mono font-bold">Akurasi {hq.accuracyPercent}%</span>
                  </div>
                  <p className="text-slate-200 font-semibold line-clamp-2">{hq.prompt}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Easiest Questions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-base text-white">Soal Termudah (Akurasi Tinggi)</h2>
            </div>

            <div className="space-y-3 text-xs">
              {analytics.easiestQuestions.map((eq) => (
                <div key={eq.questionId} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                    <span className="text-indigo-400">{eq.materialTitle}</span>
                    <span className="text-emerald-400 font-mono font-bold">Akurasi {eq.accuracyPercent}%</span>
                  </div>
                  <p className="text-slate-200 font-semibold line-clamp-2">{eq.prompt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Performers Table */}
      {analytics && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base text-white">Top Performer Peserta Terbaik</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-xl">Peringkat</th>
                  <th className="p-3">Nama Peserta</th>
                  <th className="p-3">Skor Tertinggi</th>
                  <th className="p-3">Tingkat Akurasi</th>
                  <th className="p-3 rounded-r-xl">Sesi Dimainkan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {analytics.topPerformers.map((tp, idx) => (
                  <tr key={tp.nickname} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-amber-400">#{idx + 1}</td>
                    <td className="p-3 font-bold text-white">{tp.nickname}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{tp.score} pts</td>
                    <td className="p-3 font-mono text-indigo-300">{tp.accuracy}%</td>
                    <td className="p-3 text-slate-400">{tp.totalPlayed} Sesi</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-base text-white">Audit Trail Activity Logs System</h2>
          </div>
          <span className="text-xs text-slate-400">{logs.length} Aktivitas Terakhir</span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
          {logs.map((log) => (
            <div key={log.id} className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-slate-500">{log.timestamp}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-indigo-300">{log.user}</span>
                <span className="font-semibold text-slate-200">{log.action}</span>
                <span className="text-slate-400 hidden sm:inline">- {log.details}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
