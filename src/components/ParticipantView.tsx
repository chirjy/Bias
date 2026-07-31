import React, { useState, useEffect } from 'react';
import { QuizSession, Question, Participant, ParticipantAnswer, Material } from '../types';
import { Users, Clock, CheckCircle2, XCircle, Trophy, Flame, Sparkles, Send, ArrowRight, Lock, BookOpen, Search, Eye, FileText, ChevronRight, HelpCircle, X, Building2, RefreshCw, ShieldCheck, Folder, FolderOpen, Download } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ParticipantViewProps {
  initialPin?: string;
  onExit?: () => void;
  onRequestHostAccess?: () => void;
}

export const ParticipantView: React.FC<ParticipantViewProps> = ({
  initialPin = '',
  onExit,
  onRequestHostAccess,
}) => {
  const [tabMode, setTabMode] = useState<'join' | 'materials' | 'siasn'>('join');
  const [pin, setPin] = useState<string>(initialPin);
  const [nickname, setNickname] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('😊');
  const [joinedParticipant, setJoinedParticipant] = useState<Participant | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswerData, setSelectedAnswerData] = useState<any>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [lastAnswerResult, setLastAnswerResult] = useState<{ isCorrect: boolean; pointsGained: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [startTimeMs, setStartTimeMs] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<Array<QuizSession & { participantsCount?: number }>>([]);

  const fetchActiveSessions = async () => {
    try {
      const res = await fetch('/api/quiz/active-sessions');
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Participant Materials Browser state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (catName: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  // SIASN SSO State
  const [siasnUser, setSiasnUser] = useState<{ nip: string; name: string } | null>(null);
  const [isNameLocked, setIsNameLocked] = useState<boolean>(false);

  // SIASN Login Form Inputs
  const [siasnNip, setSiasnNip] = useState<string>('');
  const [siasnPassword, setSiasnPassword] = useState<string>('');
  const [captchaQuestion, setCaptchaQuestion] = useState<string>('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState<boolean>(false);
  const [isSiasnLoggingIn, setIsSiasnLoggingIn] = useState<boolean>(false);
  const [siasnError, setSiasnError] = useState<string | null>(null);
  const [siasnSuccessMsg, setSiasnSuccessMsg] = useState<string | null>(null);

  const avatars = ['😊', '🚀', '💡', '🎓', '👑', '🔥', '🌟', '🎯', '🦁', '🦊'];

  // Revalidate JWT on component mount
  useEffect(() => {
    const existingToken = localStorage.getItem('bias_siasn_token');
    if (existingToken) {
      fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${existingToken}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated && data.user) {
            setSiasnUser(data.user);
            setNickname(data.user.name);
            setIsNameLocked(true);
          } else {
            localStorage.removeItem('bias_siasn_token');
          }
        })
        .catch((err) => console.error('Gagal verifikasi token SIASN', err));
    }
  }, []);

  // Fetch materials, captcha, or active sessions when tabMode changes
  useEffect(() => {
    if (tabMode === 'join' && !joinedParticipant) {
      fetchActiveSessions();
      const interval = setInterval(fetchActiveSessions, 3000);
      return () => clearInterval(interval);
    } else if (tabMode === 'materials') {
      fetchMaterials();
    } else if (tabMode === 'siasn') {
      fetchCaptcha();
    }
  }, [tabMode, joinedParticipant]);

  const fetchMaterials = async () => {
    setIsLoadingMaterials(true);
    try {
      const res = await fetch('/api/materials');
      const data = await res.json();
      setMaterials(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  const handleDownloadMaterial = (mat: Material) => {
    const content = `====================================================
 BAHAN AJAR LESSON / MODUL MATERI BIAS
 Judul: ${mat.title}
 Kategori: ${mat.category || 'Umum'}
 Nama File: ${mat.filename}
 Format: ${mat.fileType}
 Tanggal Upload: ${new Date(mat.uploadedAt || Date.now()).toLocaleDateString('id-ID')}
 ====================================================
 
 RINGKASAN MATERI:
 ${mat.summary}
 
 KONSEP UTAMA & POIN REGULASI:
 ${mat.keyConcepts ? mat.keyConcepts.map((k, i) => `${i + 1}. ${k}`).join('\n') : '-'}
 
 ====================================================
 NASKAH LENGKAP BAHAN AJAR:
 ====================================================
 ${mat.summary}
 `;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (mat.title || mat.filename || 'Materi_BIAS').replace(/[^a-zA-Z0-9_\-]/g, '_');
    link.download = `Materi_${safeTitle}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setCaptchaAnswer('');
    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json();
      setCaptchaQuestion(data.question);
      setCaptchaToken(data.captchaToken);
    } catch (err) {
      console.error('Gagal mengambil captcha', err);
    } finally {
      setIsLoadingCaptcha(false);
    }
  };

  const handleSiasnLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiasnError(null);
    setSiasnSuccessMsg(null);

    const cleanNip = siasnNip.trim();

    if (!cleanNip || cleanNip.length !== 18 || !/^\d+$/.test(cleanNip)) {
      setSiasnError('NIP Pegawai harus berupa 18 digit angka!');
      return;
    }

    if (!siasnPassword.trim()) {
      setSiasnError('Password SIASN BPOM wajib diisi!');
      return;
    }

    if (!captchaAnswer.trim()) {
      setSiasnError('Jawaban Captcha Matematika wajib diisi!');
      return;
    }

    setIsSiasnLoggingIn(true);

    try {
      const res = await fetch('/api/auth/siasn-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nip: cleanNip,
          username: cleanNip,
          password: siasnPassword.trim(),
          captchaAnswer: captchaAnswer.trim(),
          captchaToken: captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal autentikasi SIASN BPOM');
      }

      // Store client JWT in localStorage
      localStorage.setItem('bias_siasn_token', data.token);

      setSiasnUser(data.user);
      setNickname(data.user.name);
      setIsNameLocked(true);

      setSiasnSuccessMsg(`Otentikasi SIASN BPOM Berhasil! Nama terverifikasi: ${data.user.name}`);

      setSiasnPassword('');
      setCaptchaAnswer('');

      // Auto switch to Live Quiz tab after brief delay
      setTimeout(() => {
        setTabMode('join');
      }, 1000);
    } catch (err: any) {
      setSiasnError(err.message || 'Gagal terhubung ke server SIASN');
      fetchCaptcha();
    } finally {
      setIsSiasnLoggingIn(false);
    }
  };

  const handleSiasnLogout = () => {
    localStorage.removeItem('bias_siasn_token');
    setSiasnUser(null);
    setIsNameLocked(false);
    setNickname('');
  };

  const [prevQuestionIndex, setPrevQuestionIndex] = useState<number>(-1);

  // Listen to SSE updates
  useEffect(() => {
    if (!joinedParticipant || !pin) return;

    const eventSource = new EventSource(`/api/quiz/live-stream/${pin}?role=participant`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.session) {
          setSession(payload.session);
        }

        if (payload.type === 'QUESTION_CHANGED' || payload.type === 'INIT_STATE') {
          fetchCurrentQuestion(pin);
        }

        if (payload.type === 'QUIZ_FINISHED') {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }
      } catch (e) {
        console.error('SSE Error', e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [joinedParticipant, pin]);

  // Poll session state continuously to maintain sync
  useEffect(() => {
    if (!joinedParticipant || !pin) return;
    if (session?.status === 'finished') return;

    fetchCurrentQuestion(pin);

    const interval = setInterval(() => {
      fetchCurrentQuestion(pin);
    }, 1500);

    return () => clearInterval(interval);
  }, [joinedParticipant, pin, session?.status]);

  // Countdown timer for current question
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.status, session?.currentQuestionIndex]);

  const fetchCurrentQuestion = async (sessionPin: string) => {
    try {
      const cleanPin = (sessionPin || '').trim();
      if (!cleanPin) return;
      const res = await fetch(`/api/quiz/session/${cleanPin}`);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        if (data.session.currentQuestionIndex !== prevQuestionIndex) {
          setPrevQuestionIndex(data.session.currentQuestionIndex);
          setHasSubmitted(false);
          setSelectedAnswerData(null);
          setLastAnswerResult(null);
          setStartTimeMs(Date.now());
        }
      }
      if (data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
        if (data.session?.questionEndsAt) {
          const remaining = Math.max(0, Math.ceil((data.session.questionEndsAt - Date.now()) / 1000));
          setTimeLeft(remaining);
        } else {
          setTimeLeft(data.session?.timerSeconds || 30);
        }
      } else {
        setCurrentQuestion(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\D/g, '').trim() || pin.trim();
    if (!cleanPin) {
      setErrorMessage('Silakan masukkan PIN Quiz 6-digit');
      return;
    }
    if (!nickname.trim()) {
      setErrorMessage('Silakan masukkan nama panggilan Anda');
      return;
    }
    setPin(cleanPin);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/quiz/session/${cleanPin}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatar: selectedAvatar,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'PIN Quiz tidak ditemukan');
      }

      setJoinedParticipant(data.participant);
      setSession(data.session);
      fetchCurrentQuestion(cleanPin);
      setStartTimeMs(Date.now());
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal bergabung ke kuis');
    }
  };

  const handleSubmitAnswer = async (answerPayloadData: any) => {
    if (hasSubmitted || !currentQuestion || !joinedParticipant) return;

    setSelectedAnswerData(answerPayloadData);
    setHasSubmitted(true);
    const timeTakenMs = Date.now() - startTimeMs;
    const cleanPin = pin.trim();

    try {
      const res = await fetch(`/api/quiz/session/${cleanPin}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: joinedParticipant.id,
          questionId: currentQuestion.id,
          answerData: answerPayloadData,
          timeTakenMs,
        }),
      });

      const data = await res.json();
      setLastAnswerResult({
        isCorrect: data.isCorrect,
        pointsGained: data.pointsGained,
      });

      if (data.isCorrect) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        setJoinedParticipant((prev) =>
          prev
            ? {
                ...prev,
                score: prev.score + data.pointsGained,
                streak: prev.streak + 1,
              }
            : null
        );
      } else {
        setJoinedParticipant((prev) => (prev ? { ...prev, streak: 0 } : null));
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Step 1: Mode Peserta (Join Screen OR Material Browser Per Category) */
  if (!joinedParticipant) {
    const categories = ['Semua', ...Array.from(new Set(materials.map((m) => m.category || 'Umum')))];

    const filteredMaterials = materials.filter((m) => {
      const matchCat = selectedCategory === 'Semua' || (m.category || 'Umum') === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col items-center">
        {/* Top Header Mode Toggle */}
        <div className="max-w-4xl w-full mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              B
            </div>
            <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">BIAS</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Integritas
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Belajar Integritas Asyik dan Seru</p>
             <p className="text-xs text-slate-400 hidden sm:block">"Hilangkan Bias, Bangun Integritas."</p>
          </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700/80 w-full sm:w-auto overflow-x-auto scrollbar-none">
            <button
              onClick={() => setTabMode('join')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tabMode === 'join'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Ikut Live Quiz
            </button>
            <button
              onClick={() => setTabMode('materials')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tabMode === 'materials'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Modul Materi (Per Kategori)
            </button>
            <button
              onClick={() => setTabMode('siasn')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tabMode === 'siasn'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Internal BPOM
            </button>
          </div>
        </div>

        {/* TAB 1: JOIN LIVE QUIZ */}
        {tabMode === 'join' && (
          <div className="max-w-md w-full my-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-white">Gabung Live Quiz</h2>
              <p className="text-xs font-medium text-emerald-400 mt-0.5">Masukkan PIN 6-digit dari Pengajar/Host</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4 text-xs">
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-center font-semibold">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">PIN Quiz (6 Digit):</label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  placeholder="Contoh: 384621"
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3.5 text-center font-mono font-black text-xl text-emerald-400 tracking-widest outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-semibold">Nama Panggilan Anda:</label>
                  {isNameLocked && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Dikunci SSO SIASN
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => !isNameLocked && setNickname(e.target.value)}
                    disabled={isNameLocked}
                    placeholder="Masukkan nama Anda..."
                    className={`w-full border rounded-2xl p-3 text-sm transition-all outline-none ${
                      isNameLocked
                        ? 'bg-slate-800/90 border-emerald-500/50 text-emerald-300 font-bold cursor-not-allowed pr-10'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                    }`}
                  />
                  {isNameLocked && (
                    <Lock className="w-4 h-4 text-emerald-400 absolute right-3 top-3.5" />
                  )}
                </div>

                {isNameLocked && siasnUser && (
                  <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-[11px] text-emerald-300">
                    <span className="truncate font-medium">
                      ✓ Terverifikasi Pegawai SIASN (NIP: {siasnUser.nip})
                    </span>
                    <button
                      type="button"
                      onClick={handleSiasnLogout}
                      className="text-rose-400 hover:underline font-semibold ml-2 flex-shrink-0"
                    >
                      Keluar SSO
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Pilih Avatar Icon:</label>
                <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-slate-800/60 rounded-2xl border border-slate-800">
                  {avatars.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setSelectedAvatar(av)}
                      className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center transition-all ${
                        selectedAvatar === av ? 'bg-indigo-600 scale-110 shadow-md' : 'hover:bg-slate-700'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                Gabung Sesi Permainan <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Active Live Quiz Sessions Quick Join List */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${activeSessions.length > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'} inline-block`} />
                  Sesi Live Aktif ({activeSessions.length})
                </span>
                <button
                  type="button"
                  onClick={fetchActiveSessions}
                  className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh Sesi
                </button>
              </div>

              {activeSessions.length > 0 ? (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-none">
                  {activeSessions.map((s) => (
                    <button
                      key={s.pin}
                      type="button"
                      onClick={() => setPin(s.pin)}
                      className={`w-full p-3 bg-slate-800/80 hover:bg-slate-800 border rounded-2xl text-left transition-all flex items-center justify-between gap-3 ${
                        pin === s.pin ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10' : 'border-slate-700/60'
                      }`}
                    >
                      <div className="truncate flex-1">
                        <p className="font-bold text-xs text-slate-200 truncate">{s.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                              s.status === 'lobby'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {s.status === 'lobby' ? '● Lobby (Menunggu)' : '● Soal Berlangsung'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {s.participantsCount || 0} Peserta
                          </span>
                        </div>
                      </div>
                      <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs rounded-xl border border-emerald-500/30 flex-shrink-0 flex items-center gap-1">
                        PIN: {s.pin}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800/80 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-300">Tidak Ada Sesi Live Aktif</p>
                  <p className="text-[10px] text-slate-400">
                    Silakan minta Host / Pengajar Anda untuk membuat Sesi Quiz baru di panel Host untuk mendapatkan PIN 6 digit.
                  </p>
                </div>
              )}
            </div>

            {/* Host / Admin Access link */}
            {onRequestHostAccess && (
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Pengajar / Host Quiz?</span>
                <button
                  type="button"
                  onClick={onRequestHostAccess}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-medium rounded-xl border border-slate-700/60 transition-all"
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-400" /> Akses Admin / Host
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MATERI & MODUL PER KATEGORI (PARTICIPANT BROWSER) */}
        {tabMode === 'materials' && (
          <div className="max-w-4xl w-full space-y-6 animate-in fade-in duration-200">
            {/* Search & Category Filter */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" /> Modul & Referensi Pembelajaran
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari judul/kata kunci..."
                    className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs font-semibold text-slate-400 flex-shrink-0">Kategori:</span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Materials List Grouped per Category Folder */}
            {isLoadingMaterials ? (
              <div className="text-center py-12 text-slate-400">
                <Clock className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-2" />
                <p className="text-xs">Memuat daftar modul materi...</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-white">Tidak ada materi untuk kategori ini</p>
                <p className="text-xs">Pilih kategori lain atau tambahkan file materi baru dari menu Pengajar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  filteredMaterials.reduce<Record<string, Material[]>>((acc, mat) => {
                    const cat = mat.category || 'Umum';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(mat);
                    return acc;
                  }, {})
                ).map(([catName, matList]: [string, Material[]]) => {
                  const isExpanded = !!expandedFolders[catName];
                  return (
                    <div key={catName} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl transition-all">
                      {/* Folder Header - Click to toggle expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleFolder(catName)}
                        className="w-full bg-slate-800/80 hover:bg-slate-800 border-b border-slate-700/80 p-4 flex items-center justify-between transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 group-hover:scale-105 transition-transform">
                            {isExpanded ? <FolderOpen className="w-5 h-5 text-indigo-300" /> : <Folder className="w-5 h-5 text-indigo-400" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Folder Kategori
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {matList.length} Modul
                              </span>
                            </div>
                            <h4 className="text-base font-extrabold text-white group-hover:text-indigo-300 transition-colors">{catName}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
                            {isExpanded ? 'Tutup Folder' : 'Buka Folder'}
                          </span>
                          <div className={`p-1.5 rounded-lg bg-slate-700/60 text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </button>

                      {/* Folder Contents Grid - Rendered only when expanded */}
                      {isExpanded && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 border-t border-slate-800/80">
                          {matList.map((mat) => (
                            <div
                              key={mat.id}
                              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg space-y-3 transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold bg-slate-800 text-slate-300 rounded border border-slate-700">
                                    {mat.fileType}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-mono line-clamp-1">
                                    {mat.filename}
                                  </span>
                                </div>

                                <h5 className="font-bold text-base text-white leading-snug group-hover:text-indigo-300 transition-colors">
                                  {mat.title}
                                </h5>

                                <p className="text-xs text-slate-300 line-clamp-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800 leading-relaxed my-3">
                                  {mat.summary}
                                </p>

                                {/* Key Concepts */}
                                {mat.keyConcepts && mat.keyConcepts.length > 0 && (
                                  <div className="space-y-1 mb-3">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                      Konsep Utama:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {mat.keyConcepts.slice(0, 3).map((kc, i) => (
                                        <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700/80">
                                          • {kc}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadMaterial(mat)}
                                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                                  title="Download Naskah Teks Materi"
                                >
                                  <Download className="w-3.5 h-3.5 text-emerald-400" /> Download
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setViewingMaterial(mat)}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                                >
                                  <BookOpen className="w-3.5 h-3.5" /> Pelajari Materi
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INTERNAL BPOM (SSO SIASN LOGIN FORM) */}
        {tabMode === 'siasn' && (
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white my-auto animate-in fade-in duration-200">
            <div className="text-center mb-6 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Login SSO SIASN BPOM</h2>
                <p className="text-xs text-blue-400 font-medium mt-0.5">Badan Pengawas Obat dan Makanan</p>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium italic bg-slate-800/80 p-2 px-3 rounded-xl border border-slate-700/60 inline-block">
                Belajar Integritas Asyik dan Seru — "Hilangkan Bias, Bangun Integritas."
              </p>
            </div>

            <form onSubmit={handleSiasnLogin} className="space-y-4 text-xs">
              {siasnError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-center font-semibold">
                  {siasnError}
                </div>
              )}

              {siasnSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-center font-semibold space-y-1">
                  <p>{siasnSuccessMsg}</p>
                  <p className="text-[10px] text-slate-300 font-normal">Mengalihkan ke tab "Ikut Live Quiz"...</p>
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between">
                  <span>NIP Pegawai (18 Digit):</span>
                  <span className="text-[10px] text-slate-500 font-normal">Wajib 18 digit angka</span>
                </label>
                <input
                  type="text"
                  value={siasnNip}
                  onChange={(e) => setSiasnNip(e.target.value.replace(/\D/g, ''))}
                  maxLength={18}
                  placeholder="Contoh: 198503152010121002"
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 font-mono text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Password SIASN BPOM:</label>
                <input
                  type="password"
                  value={siasnPassword}
                  onChange={(e) => setSiasnPassword(e.target.value)}
                  placeholder="Masukkan password SIASN anda..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Server-Side Verified Math Captcha */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="w-4 h-4 text-blue-400" /> Captcha Keamanan Server:
                  </span>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={isLoadingCaptcha}
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} /> Muat Ulang
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-mono font-bold text-blue-300 flex-1 text-center shadow-inner">
                    {isLoadingCaptcha ? 'Memuat Soal...' : captchaQuestion || 'Memuat...'}
                  </div>
                  <input
                    type="text"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Jawaban angka..."
                    className="w-32 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-center font-mono font-bold text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  *Divalidasi via signed HMAC token server. Regenerate otomatis setiap submit.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSiasnLoggingIn}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isSiasnLoggingIn ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" /> Verifikasi SIASN BPOM...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Masuk SSO SIASN & Kunci Nama
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* MODAL: PELAJARI MATERI (SUMMARY, KONSEP & DOKUMEN - WITHOUT QUESTIONS) */}
        {viewingMaterial && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Kategori: {viewingMaterial.category || 'Umum'}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{viewingMaterial.title}</h3>
                  <p className="text-xs text-slate-400">Modul Bahan Ajar Resmi Pembelajaran Integritas</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadMaterial(viewingMaterial)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Naskah
                  </button>
                  <button
                    onClick={() => setViewingMaterial(null)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Section 1: Summary */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl space-y-2">
                  <h4 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" /> Ringkasan Komprehensif
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed">{viewingMaterial.summary}</p>
                </div>

                {/* Section 2: Key Concepts */}
                {viewingMaterial.keyConcepts && viewingMaterial.keyConcepts.length > 0 && (
                  <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl space-y-3">
                    <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" /> Konsep Utama & Poin Regulasi
                    </h4>
                    <div className="space-y-2">
                      {viewingMaterial.keyConcepts.map((kc, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[10px] rounded font-bold">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{kc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 3: Document Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-1">
                    <p className="text-slate-400 text-[10px] font-semibold">Nama File Berkas:</p>
                    <p className="font-mono text-white truncate">{viewingMaterial.filename}</p>
                  </div>
                  <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-1">
                    <p className="text-slate-400 text-[10px] font-semibold">Format & Kategori:</p>
                    <p className="text-indigo-300 font-bold">{viewingMaterial.fileType.toUpperCase()} • {viewingMaterial.category || 'Umum'}</p>
                  </div>
                </div>

                {/* Section 4: Document Raw Content Preview */}
                {viewingMaterial.rawText && (
                  <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
                    <h4 className="font-bold text-xs text-slate-300">Naskah Lengkap Bahan Ajar:</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      {viewingMaterial.rawText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* Step 2: Lobby Wait Screen */
  if (!session || session.status === 'lobby' || session.currentQuestionIndex === -1 || session.currentQuestionIndex === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-4xl animate-bounce">{joinedParticipant.avatar}</div>
          <h2 className="text-2xl font-black">Anda Berhasil Terhubung!</h2>
          <p className="text-xs text-slate-400">
            Halo <strong className="text-emerald-400">{joinedParticipant.nickname}</strong>, mohon menunggu host memulai soal pertama...
          </p>

          <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">PIN Sesi:</span>
            <span className="font-mono font-bold text-indigo-400">{session?.pin || pin}</span>
          </div>

          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-xs text-indigo-300 animate-pulse">
            Ready to play! Perhatikan layar host.
          </div>
        </div>
      </div>
    );
  }

  /* Step 3: Finished / Podium Screen */
  if (session?.status === 'finished') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-5xl">{joinedParticipant.avatar}</div>
          <h2 className="text-2xl font-black text-amber-400">Permainan Selesai!</h2>
          <p className="text-xs text-slate-300">Terima kasih telah berpartisipasi dalam quiz interaktif ini.</p>

          <div className="p-6 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-2">
            <p className="text-xs text-slate-400">Total Skor Akhir Anda:</p>
            <p className="text-3xl font-black text-emerald-400 font-mono">{joinedParticipant.score} Points</p>
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs"
            >
              Kembali ke Menu Utama
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Step 4: Active Question View */
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 flex flex-col justify-between max-w-lg mx-auto">
      {/* Top Participant Status Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{joinedParticipant.avatar}</span>
          <div>
            <p className="font-bold text-xs text-white line-clamp-1">{joinedParticipant.nickname}</p>
            <p className="text-[10px] text-emerald-400 font-mono font-bold">{joinedParticipant.score} pts</p>
          </div>
        </div>

        {joinedParticipant.streak > 1 && (
          <div className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-full text-[10px] font-bold flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-current animate-pulse" />
            <span>{joinedParticipant.streak} Streak!</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl font-mono text-xs font-bold">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>{timeLeft}s</span>
        </div>
      </div>

      {/* Main Question Card */}
      {!currentQuestion ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center my-auto space-y-4 shadow-2xl">
          <Clock className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-white">Menyiapkan Soal #{session.currentQuestionIndex + 1}...</h2>
          <p className="text-xs text-slate-400">Mohon tunggu sebentar, sedang memuat data soal...</p>
        </div>
      ) : (
        <div className="space-y-4 my-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-2">
              <span>
                Soal #{session.currentQuestionIndex + 1} / {session.questionIds.length}
              </span>
              <span className="uppercase text-indigo-400">{currentQuestion.type}</span>
            </div>

            {currentQuestion.caseStudyScenario && (
              <div className="mb-3 p-3 bg-slate-800/80 border-l-2 border-indigo-500 rounded-r-xl text-xs text-slate-300 italic">
                {currentQuestion.caseStudyScenario}
              </div>
            )}

            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{currentQuestion.prompt}</h3>
          </div>

          {/* Touch Options / Input Area */}
          {!hasSubmitted ? (
            <div className="space-y-2.5">
              {currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const buttonColors = [
                      'bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/40 text-indigo-200',
                      'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/40 text-purple-200',
                      'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-200',
                      'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/40 text-amber-200',
                    ];
                    const colorClass = buttonColors[idx % buttonColors.length];

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSubmitAnswer(opt.id)}
                        className={`w-full p-4 rounded-2xl border text-left text-sm font-semibold transition-all active:scale-95 shadow-md ${colorClass}`}
                      >
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'short_answer' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="Tulis jawaban singkat (max 30 karakter)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                  <p className="text-[10px] text-slate-500 text-center">Tekan Enter untuk mengirim jawaban</p>
                </div>
              )}
            </div>
          ) : (
            /* Answer Locked / Result Screen */
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 animate-fade-in shadow-2xl">
              {lastAnswerResult?.isCorrect ? (
                <div className="space-y-2">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-3xl">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h4 className="text-xl font-black text-emerald-400">Jawaban Benar!</h4>
                  <p className="text-sm font-mono font-bold text-amber-300">
                    +{lastAnswerResult.pointsGained} Points diperoleh
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-3xl">
                    <XCircle className="w-10 h-10 text-rose-400" />
                  </div>
                  <h4 className="text-xl font-black text-rose-400">Jawaban Belum Tepat</h4>
                  <p className="text-xs text-slate-400">Tetap semangat untuk soal berikutnya!</p>
                </div>
              )}

              <p className="text-xs text-slate-500 italic pt-2">
                Menunggu host melanjutkan ke soal berikutnya...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-4 text-center text-[10px] text-slate-500">
        Mentiquiz AI • Mobile First Interactive Engine
      </div>
    </div>
  );
};
