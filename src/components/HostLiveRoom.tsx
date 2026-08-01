import React, { useState, useEffect } from 'react';
import { QuizSession, Question, Participant, ParticipantAnswer } from '../types';
import { Play, Pause, SkipForward, SkipBack, StopCircle, Eye, EyeOff, Trophy, Users, Clock, CheckCircle2, QrCode, Copy, Sparkles, LogOut, X, AlertTriangle, UserPlus, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HostLiveRoomProps {
  session: QuizSession;
  onClose: () => void;
}

export const HostLiveRoom: React.FC<HostLiveRoomProps> = ({ session: initialSession, onClose }) => {
  const [session, setSession] = useState<QuizSession>(initialSession);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answers, setAnswers] = useState<ParticipantAnswer[]>([]);
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(initialSession.timerSeconds);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [showStopConfirmModal, setShowStopConfirmModal] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchSessionData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Poll session data continuously to maintain sync
  useEffect(() => {
    const cleanPin = (session?.pin || '').replace(/\D/g, '').trim() || (session?.pin || '').trim();
    fetchSessionData();

    const interval = setInterval(() => {
      fetchSessionData();
    }, 1000);

    const eventSource = new EventSource(`/api/quiz/live-stream/${cleanPin}?role=host`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.session) setSession(payload.session);
        if (Array.isArray(payload.participants)) setParticipants(payload.participants);
        if (Array.isArray(payload.answers)) setAnswers(payload.answers);

        if (payload.type === 'QUIZ_FINISHED') {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }
      } catch (err) {
        console.error('SSE JSON error', err);
      }
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, [session.pin]);

  // Fetch session detail whenever currentQuestionIndex changes
  useEffect(() => {
    fetchSessionData();
    setTimeLeft(session.timerSeconds);
    setAutoAdvanceCountdown(null);
  }, [session.currentQuestionIndex]);

  // Countdown timer for question
  useEffect(() => {
    if (session.status !== 'active') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowAnswerKey(true);
          if (autoAdvance) {
            setAutoAdvanceCountdown(4);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session.status, session.currentQuestionIndex, autoAdvance]);

  // Auto Advance countdown effect (4s -> 3s -> 2s -> 1s -> Next)
  useEffect(() => {
    if (autoAdvanceCountdown === null || autoAdvanceCountdown <= 0) return;

    const timer = setTimeout(() => {
      if (autoAdvanceCountdown === 1) {
        setAutoAdvanceCountdown(null);
        handleNext();
      } else {
        setAutoAdvanceCountdown((prev) => (prev !== null ? prev - 1 : null));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoAdvanceCountdown]);

  // Compute option submission distribution for current question
  const currentQuestionAnswers = currentQuestion
    ? answers.filter((a) => a.questionId === currentQuestion.id)
    : [];

  // Speed up timer if all connected participants answered
  useEffect(() => {
    if (
      session.status === 'active' &&
      participants.length > 0 &&
      currentQuestionAnswers.length >= participants.length &&
      timeLeft > 2 &&
      autoAdvanceCountdown === null
    ) {
      setTimeLeft(2);
    }
  }, [currentQuestionAnswers.length, participants.length, session.status, timeLeft, autoAdvanceCountdown]);

  const fetchSessionData = async () => {
    try {
      const cleanPin = (session?.pin || '').replace(/\D/g, '').trim() || (session?.pin || '').trim();
      if (!cleanPin) return;
      const res = await fetch(`/api/quiz/session/${cleanPin}?role=host`);
      const data = await res.json();
      if (data.session) setSession(data.session);
      if (data.currentQuestion) setCurrentQuestion(data.currentQuestion);
      if (Array.isArray(data.participants)) setParticipants(data.participants);
      if (Array.isArray(data.answers)) setAnswers(data.answers);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDemoParticipant = async () => {
    try {
      const res = await fetch(`/api/quiz/session/${session.pin}/add-demo-participant`, { method: 'POST' });
      const data = await res.json();
      if (data.participants) {
        setParticipants(data.participants);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStart = async () => {
    setAutoAdvanceCountdown(null);
    const res = await fetch(`/api/quiz/session/${session.pin}/start`, { method: 'POST' });
    const data = await res.json();
    if (data.session) {
      setSession(data.session);
      fetchSessionData();
    }
  };

  const handleNext = async () => {
    setShowAnswerKey(false);
    setAutoAdvanceCountdown(null);
    const res = await fetch(`/api/quiz/session/${session.pin}/next`, { method: 'POST' });
    const data = await res.json();
    if (data.session) {
      setSession(data.session);
      fetchSessionData();
    }
  };

  const handlePrev = async () => {
    setShowAnswerKey(false);
    setAutoAdvanceCountdown(null);
    const res = await fetch(`/api/quiz/session/${session.pin}/prev`, { method: 'POST' });
    const data = await res.json();
    if (data.session) {
      setSession(data.session);
      fetchSessionData();
    }
  };

  const handlePause = async () => {
    setAutoAdvanceCountdown(null);
    const res = await fetch(`/api/quiz/session/${session.pin}/pause`, { method: 'POST' });
    const data = await res.json();
    if (data.session) {
      setSession(data.session);
      fetchSessionData();
    }
  };

  const executeStopSession = async () => {
    setAutoAdvanceCountdown(null);
    setShowStopConfirmModal(false);
    try {
      const res = await fetch(`/api/quiz/session/${session.pin}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        fetchSessionData();
      } else {
        setSession((prev) => ({ ...prev, status: 'finished' }));
      }
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 } });
    } catch (err) {
      console.error('Error stopping quiz:', err);
      setSession((prev) => ({ ...prev, status: 'finished' }));
    }
  };

  const handleStop = () => {
    setShowStopConfirmModal(true);
  };

  const copyPinUrl = () => {
    const url = `${window.location.origin}?pin=${session.pin}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const optionCounts: Record<string, number> = {};
  if (currentQuestion?.options) {
    currentQuestion.options.forEach((opt) => {
      optionCounts[opt.id] = 0;
    });
    currentQuestionAnswers.forEach((ans) => {
      if (typeof ans.answerData === 'string' && optionCounts[ans.answerData] !== undefined) {
        optionCounts[ans.answerData] += 1;
      }
    });
  }

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
      {/* Top Mentimeter PIN Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center gap-3 shadow-lg shadow-indigo-500/25">
            <span className="text-xs uppercase font-extrabold text-indigo-200 tracking-wider">PIN QUIZ:</span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-widest">{session.pin}</span>
          </div>

          <button
            onClick={copyPinUrl}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 flex items-center gap-2 text-xs font-semibold transition-all"
          >
            <Copy className="w-4 h-4 text-indigo-400" />
            {isCopied ? 'Tersalin!' : 'Salin Tautan'}
          </button>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          {/* Active participants badge */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 rounded-xl border border-slate-700 text-xs font-semibold">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>{participants.length} Peserta Terhubung</span>
            <button
              onClick={handleManualRefresh}
              className={`p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-all ${
                isRefreshing ? 'animate-spin text-emerald-400' : ''
              }`}
              title="Refresh Peserta Terhubung"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Submitted answers meter */}
          {currentQuestion && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 rounded-xl border border-slate-700 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>
                {currentQuestionAnswers.length} / {participants.length || 1} Masuk
              </span>
            </div>
          )}

          {/* Live countdown timer circle */}
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl font-bold font-mono text-sm">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>{timeLeft}s</span>
          </div>

          {/* Close/Exit Host Room button */}
          <button
            onClick={onClose}
            className="p-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl border border-rose-500/30 flex items-center gap-2 text-xs font-bold transition-all"
            title="Keluar dari Sesi Live Host"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Tutup Room</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="my-8 max-w-6xl mx-auto w-full">
        {session.status === 'lobby' ? (
          /* Lobby Wait Screen */
          <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-3xl mb-6 border border-indigo-500/30">
              <QrCode className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-white">Menunggu Peserta Bergabung...</h2>
            <p className="text-base text-slate-400 max-w-md mx-auto mb-8">
              Minta peserta membuka tautan atau memasukkan <strong className="text-indigo-400 font-mono">PIN {session.pin}</strong> di perangkat mereka.
            </p>

            <div className="mb-10 max-w-2xl mx-auto">
              <p className="text-xs uppercase font-bold text-slate-500 mb-4 tracking-wider">
                Peserta Terhubung ({participants.length}):
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {participants.length === 0 ? (
                  <span className="text-sm italic text-slate-500">Belum ada peserta yang masuk...</span>
                ) : (
                  participants.map((p) => (
                    <div
                      key={p.id}
                      className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md animate-fade-in"
                    >
                      <span className="text-base">{p.avatar || '😊'}</span>
                      <span className="text-slate-200">{p.nickname}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleAddDemoParticipant}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-2xl border border-indigo-500/30 flex items-center gap-2 shadow-lg transition-all"
              >
                <UserPlus className="w-4 h-4 text-indigo-400" /> + Simulasi Peserta Demo
              </button>
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/20 transition-all scale-105"
              >
                🚀 Mulai Soal Pertama Sekarang
              </button>
            </div>
          </div>
        ) : showLeaderboard || session.status === 'finished' ? (
          /* Leaderboard Screen */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Klasemen Leaderboard Realtime</h2>
                  <p className="text-xs text-slate-400">Dihitung berdasarkan Jawaban Benar, Kecepatan, dan Bonus Streak</p>
                </div>
              </div>

              {session.status !== 'finished' ? (
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
                >
                  Kembali ke Soal
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
                >
                  <LogOut className="w-4 h-4" /> Selesai & Keluar ke Dashboard Admin
                </button>
              )}
            </div>

            {/* Podium for top 3 */}
            <div className="grid grid-cols-3 gap-4 mb-8 max-w-xl mx-auto items-end text-center">
              {/* 2nd Place */}
              {sortedParticipants[1] && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
                  <div className="text-2xl mb-1">{sortedParticipants[1].avatar || '🥈'}</div>
                  <p className="font-bold text-xs text-slate-200 line-clamp-1">{sortedParticipants[1].nickname}</p>
                  <p className="text-sm font-black text-slate-300 font-mono mt-1">{sortedParticipants[1].score} pts</p>
                  <span className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">Juara 2</span>
                </div>
              )}

              {/* 1st Place */}
              {sortedParticipants[0] && (
                <div className="bg-gradient-to-b from-amber-500/20 to-slate-800 border-2 border-amber-500/60 rounded-2xl p-5 flex flex-col items-center scale-105 shadow-xl shadow-amber-500/10">
                  <div className="text-3xl mb-1">{sortedParticipants[0].avatar || '👑'}</div>
                  <p className="font-bold text-sm text-amber-300 line-clamp-1">{sortedParticipants[0].nickname}</p>
                  <p className="text-lg font-black text-amber-400 font-mono mt-1">{sortedParticipants[0].score} pts</p>
                  <span className="mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">Juara 1</span>
                </div>
              )}

              {/* 3rd Place */}
              {sortedParticipants[2] && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
                  <div className="text-2xl mb-1">{sortedParticipants[2].avatar || '🥉'}</div>
                  <p className="font-bold text-xs text-slate-200 line-clamp-1">{sortedParticipants[2].nickname}</p>
                  <p className="text-sm font-black text-amber-500 font-mono mt-1">{sortedParticipants[2].score} pts</p>
                  <span className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">Juara 3</span>
                </div>
              )}
            </div>

            {/* List for rest */}
            <div className="space-y-2 max-w-2xl mx-auto max-h-60 overflow-y-auto">
              {sortedParticipants.map((p, index) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 text-xs font-semibold"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-slate-400 font-mono font-bold">#{index + 1}</span>
                    <span>{p.avatar || '😊'}</span>
                    <span className="text-slate-200">{p.nickname}</span>
                    {p.streak > 1 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-full">
                        🔥 {p.streak} Streak
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-indigo-400">{p.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active Question View with Live Bar Chart */
          currentQuestion && (
            <div className="space-y-6">
              {/* Question Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
                    Soal {session.currentQuestionIndex + 1} dari {session.questionIds.length}
                  </span>

                  <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300">
                    Tipe: {currentQuestion.type}
                  </span>
                </div>

                {currentQuestion.caseStudyScenario && (
                  <div className="mb-4 p-4 bg-slate-800/80 border-l-4 border-indigo-500 rounded-r-2xl text-xs text-slate-200 italic">
                    <strong className="text-indigo-400 block not-italic font-bold mb-1">Skenario Studi Kasus:</strong>
                    {currentQuestion.caseStudyScenario}
                  </div>
                )}

                <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">{currentQuestion.prompt}</h3>
              </div>

              {/* Mentimeter Realtime Answer Bar Distribution Chart */}
              {currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                  <p className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-6">
                    Distribusi Jawaban Masuk Realtime:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end min-h-[220px]">
                    {currentQuestion.options.map((opt, idx) => {
                      const count = optionCounts[opt.id] || 0;
                      const totalAns = currentQuestionAnswers.length || 1;
                      const percentage = Math.round((count / totalAns) * 100);

                      const colors = [
                        'from-indigo-600 to-indigo-500 text-indigo-300',
                        'from-purple-600 to-purple-500 text-purple-300',
                        'from-emerald-600 to-emerald-500 text-emerald-300',
                        'from-amber-600 to-amber-500 text-amber-300',
                      ];

                      const barColor = colors[idx % colors.length];

                      return (
                        <div key={opt.id} className="flex flex-col items-center gap-3 h-full justify-end">
                          <span className="text-xs font-bold font-mono text-white">{count} ({percentage}%)</span>

                          {/* Dynamic Height Bar */}
                          <div className="w-full bg-slate-800 rounded-2xl h-36 flex items-end overflow-hidden p-1">
                            <div
                              style={{ height: `${Math.max(12, percentage)}%` }}
                              className={`w-full bg-gradient-to-t ${barColor} rounded-xl transition-all duration-500 flex items-center justify-center text-xs font-black text-white shadow-lg`}
                            >
                              {count > 0 && count}
                            </div>
                          </div>

                          <p
                            className={`text-xs font-bold text-center line-clamp-2 ${
                              showAnswerKey && opt.isCorrect ? 'text-emerald-400 underline font-black' : 'text-slate-300'
                            }`}
                          >
                            {opt.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reveal Explanation if toggled */}
              {showAnswerKey && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 animate-fade-in">
                  <strong className="block font-bold mb-1 text-emerald-400">Penjelasan Resmi AI:</strong>
                  {currentQuestion.explanation}
                </div>
              )}

              {/* Auto Advance Countdown Banner */}
              {autoAdvanceCountdown !== null && (
                <div className="p-4 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500/50 rounded-2xl text-xs text-white flex flex-col sm:flex-row items-center justify-between gap-3 animate-bounce shadow-xl">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                    <span>Waktu Habis! Pindah ke soal berikutnya dalam <span className="text-amber-300 font-mono text-base font-black">{autoAdvanceCountdown}s</span>...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoAdvanceCountdown(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700"
                    >
                      Batal Auto
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md"
                    >
                      Lanjut Sekarang 🚀
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Host Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={session.currentQuestionIndex <= 0}
            className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl border border-slate-700 transition-all"
            title="Soal Sebelumnya"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={handlePause}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 transition-all"
            title="Jeda Timer"
          >
            {session.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={handleNext}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            Lanjut Soal Berikutnya <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              autoAdvance
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Otomatis Pindah Soal Saat Waktu Habis"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Auto-Advance: {autoAdvance ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowAnswerKey(!showAnswerKey)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5"
          >
            {showAnswerKey ? <EyeOff className="w-4 h-4 text-rose-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
            {showAnswerKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}
          </button>

          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/30 flex items-center gap-1.5"
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>

          <button
            onClick={handleStop}
            className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/30 flex items-center gap-1.5"
          >
            <StopCircle className="w-4 h-4" /> Hentikan Quiz
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Stop Quiz */}
      {showStopConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl relative text-center">
            <div className="w-12 h-12 mx-auto bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Hentikan Quiz Sekarang?</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Semua peserta akan langsung diarahkan ke layar Klasemen / Podium Hasil Akhir.
            </p>

            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setShowStopConfirmModal(false)}
                className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeStopSession}
                className="w-1/2 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all"
              >
                <StopCircle className="w-3.5 h-3.5" /> Ya, Hentikan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
