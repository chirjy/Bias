import React, { useState, useEffect } from 'react';
import { SystemAnalytics, ActivityLog, SelfExamSession } from '../types';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Trophy, FileText, ShieldAlert, Clock, RefreshCw, GraduationCap, CheckCircle2, XCircle, Search, Eye, X, Award, BookOpen, User } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedExamDetail, setSelectedExamDetail] = useState<SelfExamSession | null>(null);
  const [examSearch, setExamSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('Semua Kategori');

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

  // Demo fallback for Self Exams if store is empty
  const defaultSelfExams: SelfExamSession[] = [
    {
      id: 'exam-demo-1',
      nip: '198503152010121002',
      participantName: 'Budi Santoso, S.Kom',
      category: 'Integritas & Anti-Korupsi',
      quizMode: 'exam',
      score: 85,
      totalQuestions: 10,
      correctCount: 8,
      status: 'LULUS',
      completedAt: '01 Aug 2026, 11:15',
      timeSpentSeconds: 340,
      answers: [
        {
          questionId: 'q1',
          prompt: 'Apa prinsip utama zona integritas di lingkungan BPOM?',
          isCorrect: true,
          userAnswerText: 'Bebas dari Korupsi (WBK) dan Wilayah Birokrasi Bersih dan Melayani (WBBM)',
          correctAnswerText: 'Bebas dari Korupsi (WBK) dan Wilayah Birokrasi Bersih dan Melayani (WBBM)',
          explanation: 'Sesuai PermenPANRB Nomor 90 Tahun 2021 tentang Pembangunan Zona Integritas.',
        },
        {
          questionId: 'q2',
          prompt: 'Sebutkan batas maksimal penerimaan gratifikasi yang tidak wajib dilaporkan.',
          isCorrect: false,
          userAnswerText: 'Rp 500.000',
          correctAnswerText: 'Gratifikasi dalam bentuk barang makanan cepat basi senilai maksimal Rp 200.000',
          explanation: 'Sesuai Peraturan KPK No. 2 Tahun 2019 tentang Pelaporan Gratifikasi.',
        },
      ],
    },
    {
      id: 'exam-demo-2',
      nip: '199008202015032005',
      participantName: 'Siti Rahmawati, S.Farm, Apt',
      category: 'Pengawasan Obat & Makanan',
      quizMode: 'exam',
      score: 90,
      totalQuestions: 10,
      correctCount: 9,
      status: 'LULUS',
      completedAt: '01 Aug 2026, 10:40',
      timeSpentSeconds: 280,
    },
    {
      id: 'exam-demo-3',
      nip: '198811122012011003',
      participantName: 'Ahmad Fauzi, S.H',
      category: 'Disiplin & Kode Etik ASN',
      quizMode: 'exam',
      score: 60,
      totalQuestions: 10,
      correctCount: 6,
      status: 'TIDAK LULUS',
      completedAt: '01 Aug 2026, 09:20',
      timeSpentSeconds: 420,
    },
  ];

  const selfExamsList: SelfExamSession[] =
    analytics?.selfExams && analytics.selfExams.length > 0
      ? analytics.selfExams
      : defaultSelfExams;

  const categoryOptions = [
    'Semua Kategori',
    ...Array.from(new Set(selfExamsList.map((e) => e.category || 'Umum'))),
  ];

  const filteredSelfExams = selfExamsList.filter((ex) => {
    const matchesSearch =
      ex.participantName.toLowerCase().includes(examSearch.toLowerCase()) ||
      ex.nip.includes(examSearch) ||
      ex.category.toLowerCase().includes(examSearch.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'Semua Kategori' || ex.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalSelfExams = filteredSelfExams.length;
  const passedCount = filteredSelfExams.filter((e) => e.status === 'LULUS').length;
  const passRate = totalSelfExams > 0 ? Math.round((passedCount / totalSelfExams) * 100) : 0;
  const avgScore =
    totalSelfExams > 0
      ? Math.round(filteredSelfExams.reduce((acc, curr) => acc + curr.score, 0) / totalSelfExams)
      : 0;

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

      {/* CARD BARU: MONITORING & EVALUASI SESI UJIAN MANDIRI (EXAM MODE) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg text-white">Monitoring & Evaluasi Sesi Ujian Mandiri</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Exam Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Laporan pelaksanaan ujian mandiri tanpa host oleh pegawai SSO SIASN BPOM
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-blue-500 font-medium"
            >
              {categoryOptions.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Cari NIP, Nama..."
                className="bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Self Exam Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Ujian Mandiri</p>
              <p className="text-xl font-black text-white font-mono">{totalSelfExams} Sesi</p>
            </div>
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Tingkat Kelulusan</p>
              <p className="text-xl font-black text-emerald-400 font-mono">{passRate}%</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Rata-Rata Nilai</p>
              <p className="text-xl font-black text-blue-400 font-mono">{avgScore} / 100</p>
            </div>
            <Award className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Self Exam Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 rounded-l-xl">Pegawai SSO SIASN</th>
                <th className="p-3">Folder Kategori Ujian</th>
                <th className="p-3">Skor (%) & Hasil</th>
                <th className="p-3">Status</th>
                <th className="p-3">Waktu Pengerjaan</th>
                <th className="p-3">Tanggal Selesai</th>
                <th className="p-3 rounded-r-xl text-center">Aksi Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSelfExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                    Belum ada data sesi ujian mandiri yang ditemukan
                  </td>
                </tr>
              ) : (
                filteredSelfExams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-white leading-snug">{ex.participantName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">NIP: {ex.nip}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 border border-slate-700 font-medium">
                        {ex.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-sm text-white">
                        {ex.score}% <span className="text-[11px] font-normal text-slate-400">({ex.correctCount}/{ex.totalQuestions} Soal)</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {ex.status === 'LULUS' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> LULUS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-[10px]">
                          <XCircle className="w-3 h-3" /> TIDAK LULUS
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {Math.floor((ex.timeSpentSeconds || 120) / 60)}m {(ex.timeSpentSeconds || 120) % 60}s
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {ex.completedAt}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedExamDetail(ex)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-md shadow-indigo-600/20"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detail Evaluasi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETAIL EVALUASI UJIAN MANDIRI */}
      {selectedExamDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Sesi Ujian Mandiri (Exam Mode)
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${selectedExamDetail.status === 'LULUS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                    {selectedExamDetail.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{selectedExamDetail.participantName}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  NIP: {selectedExamDetail.nip} • Category: {selectedExamDetail.category}
                </p>
              </div>
              <button
                onClick={() => setSelectedExamDetail(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Skor Akhir:</p>
                  <p className="text-lg font-black font-mono text-emerald-400">{selectedExamDetail.score}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Benar / Total:</p>
                  <p className="text-lg font-black font-mono text-white">
                    {selectedExamDetail.correctCount} / {selectedExamDetail.totalQuestions} Soal
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Durasi Ujian:</p>
                  <p className="text-lg font-black font-mono text-indigo-300">
                    {Math.floor((selectedExamDetail.timeSpentSeconds || 0) / 60)}m {(selectedExamDetail.timeSpentSeconds || 0) % 60}s
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Waktu Selesai:</p>
                  <p className="text-xs font-bold text-slate-300 mt-1">{selectedExamDetail.completedAt}</p>
                </div>
              </div>

              <h4 className="font-bold text-sm text-white pt-2">Breakdown Jawaban & Evaluasi per Soal:</h4>

              {!selectedExamDetail.answers || selectedExamDetail.answers.length === 0 ? (
                <div className="p-4 bg-slate-800/40 rounded-xl text-slate-400 text-center italic">
                  Detail rincian per soal untuk sesi ini telah diarsip.
                </div>
              ) : (
                selectedExamDetail.answers.map((ans, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border space-y-2 ${
                      ans.isCorrect
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-xs">
                        Soal #{idx + 1}
                      </span>
                      {ans.isCorrect ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                          BENAR (+10 pts)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                          SALAH (0 pts)
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-slate-100 text-xs">{ans.prompt}</p>

                    <div className="space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-[11px]">
                      <p className="text-slate-300">
                        <strong className="text-slate-400">Jawaban Peserta:</strong>{' '}
                        <span className={ans.isCorrect ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                          {ans.userAnswerText || '(Tidak dijawab)'}
                        </span>
                      </p>
                      {!ans.isCorrect && (
                        <p className="text-slate-300">
                          <strong className="text-slate-400">Jawaban Benar:</strong>{' '}
                          <span className="text-emerald-400 font-bold">{ans.correctAnswerText}</span>
                        </p>
                      )}
                    </div>

                    {ans.explanation && (
                      <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                        💡 <strong className="text-slate-300 font-medium">Pembahasan:</strong> {ans.explanation}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedExamDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Tutup Evaluasi
              </button>
            </div>
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
