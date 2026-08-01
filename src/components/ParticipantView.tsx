import React, { useState, useEffect } from 'react';
import { QuizSession, Question, Participant, ParticipantAnswer, Material } from '../types';
import { Users, Clock, CheckCircle2, XCircle, Trophy, Flame, Sparkles, Send, ArrowRight, Lock, BookOpen, Search, Eye, FileText, ChevronRight, HelpCircle, X, Building2, RefreshCw, ShieldCheck, Folder, FolderOpen, Download, ArrowUp, ArrowDown, Check, CheckSquare, Square, ListOrdered, Link2, History } from 'lucide-react';
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
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedMultipleOptionIds, setSelectedMultipleOptionIds] = useState<string[]>([]);
  const [shortAnswerInput, setShortAnswerInput] = useState<string>('');
  const [orderedItems, setOrderedItems] = useState<any[]>([]);
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Initialize and reset answer states whenever currentQuestion changes
  useEffect(() => {
    if (!currentQuestion) return;
    setSelectedOptionId(null);
    setSelectedMultipleOptionIds([]);
    setShortAnswerInput('');
    setMatchingSelections({});

    if (
      (currentQuestion.type === 'ordering' || (currentQuestion as any).type === 'sequence') &&
      currentQuestion.orderItems
    ) {
      const items = [...currentQuestion.orderItems];
      const shuffled = items.sort(() => Math.random() - 0.5);
      setOrderedItems(shuffled);
    } else {
      setOrderedItems([]);
    }
  }, [currentQuestion?.id]);
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

  // Active Self Exam State (Exam Mode)
  const [activeSelfExam, setActiveSelfExam] = useState<{
    category: string;
    questions: Question[];
    currentIndex: number;
    userAnswers: Record<string, any>;
    answersList: Array<{
      questionId: string;
      prompt: string;
      isCorrect: boolean;
      userAnswerText: string;
      correctAnswerText: string;
      explanation?: string;
    }>;
    startTime: number;
    isFinished: boolean;
    finalResult?: any;
  } | null>(null);

  const [selfExamSelectedOptId, setSelfExamSelectedOptId] = useState<string | null>(null);
  const [selfExamSelectedMultipleIds, setSelfExamSelectedMultipleIds] = useState<string[]>([]);
  const [selfExamShortAnswer, setSelfExamShortAnswer] = useState<string>('');
  const [selfExamOrderingList, setSelfExamOrderingList] = useState<any[]>([]);
  const [selfExamMatchingUserAnswers, setSelfExamMatchingUserAnswers] = useState<Record<string, string>>({});
  const [selfExamTimeRemaining, setSelfExamTimeRemaining] = useState<number>(0);

  // History Ujian Mandiri Modal States
  const [historyModalCategory, setHistoryModalCategory] = useState<string | null>(null);
  const [historyExamsList, setHistoryExamsList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<any | null>(null);

  const handleOpenHistoryModal = async (catName: string) => {
    setHistoryModalCategory(catName);
    setIsLoadingHistory(true);
    setSelectedHistoryDetail(null);
    try {
      const nipParam = siasnUser?.nip ? `nip=${encodeURIComponent(siasnUser.nip.trim())}` : '';
      const catParam = catName !== 'Semua' ? `category=${encodeURIComponent(catName.trim())}` : '';
      const queryParts = [nipParam, catParam].filter(Boolean).join('&');
      const url = `/api/quiz/self-exam${queryParts ? `?${queryParts}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistoryExamsList(Array.isArray(data) ? data : []);
      } else {
        setHistoryExamsList([]);
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat ujian:', err);
      setHistoryExamsList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Sync answer state on question change
  useEffect(() => {
    if (!activeSelfExam || activeSelfExam.isFinished) return;
    const curQ = activeSelfExam.questions[activeSelfExam.currentIndex];
    if (!curQ) return;

    setSelfExamSelectedOptId(null);
    setSelfExamSelectedMultipleIds([]);
    setSelfExamShortAnswer('');

    if (curQ.type === 'ordering' && curQ.orderItems) {
      const shuffled = [...curQ.orderItems].sort(() => Math.random() - 0.5);
      setSelfExamOrderingList(shuffled);
    } else {
      setSelfExamOrderingList([]);
    }

    if (curQ.type === 'matching' && curQ.matchingPairs) {
      setSelfExamMatchingUserAnswers({});
    } else {
      setSelfExamMatchingUserAnswers({});
    }
  }, [activeSelfExam?.currentIndex, activeSelfExam?.startTime]);

  // Timer Countdown Effect
  useEffect(() => {
    if (!activeSelfExam || activeSelfExam.isFinished) return;

    const interval = setInterval(() => {
      setSelfExamTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoFinishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSelfExam?.isFinished, activeSelfExam?.startTime]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAutoFinishExam = async () => {
    if (!activeSelfExam || activeSelfExam.isFinished) return;

    const currentAnswersList = [...activeSelfExam.answersList];
    const questions = activeSelfExam.questions;

    for (let i = currentAnswersList.length; i < questions.length; i++) {
      const q = questions[i];
      let isCorrect = false;
      let userAnswerText = '(Waktu Habis)';
      let correctAnswerText = '';

      if (q.type === 'ordering') {
        const sorted = [...(q.orderItems || [])].sort((a, b) => a.correctPosition - b.correctPosition);
        correctAnswerText = sorted.map((item, idx) => `${idx + 1}. ${item.text}`).join(' → ');
      } else if (q.type === 'matching') {
        correctAnswerText = (q.matchingPairs || []).map((p) => `${p.left} ➔ ${p.right}`).join('; ');
      } else if (q.type === 'short_answer') {
        correctAnswerText = q.shortAnswerCorrect || '';
      } else {
        const correctOpt = q.options?.find((o) => o.isCorrect);
        correctAnswerText = correctOpt ? correctOpt.text : '';
      }

      currentAnswersList.push({
        questionId: q.id,
        prompt: q.prompt,
        isCorrect: false,
        userAnswerText,
        correctAnswerText,
        explanation: q.explanation,
      });
    }

    const correctCount = currentAnswersList.filter((a) => a.isCorrect).length;
    const totalQuestions = questions.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const status: 'LULUS' | 'TIDAK LULUS' = scorePercent >= 70 ? 'LULUS' : 'TIDAK LULUS';
    const timeSpentSeconds = Math.round((Date.now() - activeSelfExam.startTime) / 1000);

    const payload = {
      nip: siasnUser?.nip || '198503152010121002',
      participantName: siasnUser?.name || 'Peserta Mandiri BPOM',
      category: activeSelfExam.category,
      score: scorePercent,
      totalQuestions,
      correctCount,
      status,
      timeSpentSeconds,
      answers: currentAnswersList,
    };

    try {
      const res = await fetch('/api/quiz/self-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error('Gagal menyimpan hasil ujian mandiri:', errData);
      }
    } catch (e) {
      console.error('Network error saat menyimpan ujian mandiri:', e);
    }

    setActiveSelfExam({
      ...activeSelfExam,
      answersList: currentAnswersList,
      isFinished: true,
      finalResult: payload,
    });
  };

  const handleStartSelfExam = async (catName: string, matList: Material[]) => {
    setIsLoadingMaterials(true);
    try {
      // Gather all questions from backend for materials in this folder
      const questionsPromises = matList.map(async (m) => {
        try {
          const res = await fetch(`/api/questions/material/${m.id}`);
          if (res.ok) {
            const qData = await res.json();
            return Array.isArray(qData) ? qData : [];
          }
        } catch (e) {
          console.error(e);
        }
        return [];
      });

      const results = await Promise.all(questionsPromises);
      let allQuestions: Question[] = results.flat();

      if (allQuestions.length === 0) {
        // Fallback questions for this category
        allQuestions = [
          {
            id: `sq-1-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'multiple_choice',
            difficulty: 'medium',
            prompt: `Sesuai regulasi BPOM pada modul ${catName}, apakah prinsip utama integritas dan tata kelola pelayanan publik?`,
            options: [
              { id: 'opt-1', text: 'Pelayanan prima tanpa dipungut biaya di luar ketentuan resmi', isCorrect: true },
              { id: 'opt-2', text: 'Memberikan keutamaan kepada pihak yang membayar administrasi lebih', isCorrect: false },
              { id: 'opt-3', text: 'Memprioritaskan kenalan terdekat tanpa antrean resmi', isCorrect: false },
              { id: 'opt-4', text: 'Mengabaikan Standar Operasional Prosedur (SOP) demi percepatan', isCorrect: false },
            ],
            explanation: 'Pelayanan di lingkungan BPOM wajib mematuhi SOP dan Bebas Pungli sesuai prinsip WBK/WBBM.',
            createdAt: new Date().toISOString(),
          },
          {
            id: `sq-2-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'case_study',
            difficulty: 'hard',
            prompt: `Studi Kasus ${catName}: Seorang pegawai BPOM menerima tawaran gratifikasi berupa parsel bingkisan mahal dari pemohon izin edar obat. Apa tindakan yang benar sesuai aturan BPOM?`,
            options: [
              { id: 'opt-21', text: 'Menolak secara tegas atau melaporkan ke Unit Pengendalian Gratifikasi (UPG) BPOM maksimal 30 hari kerja', isCorrect: true },
              { id: 'opt-22', text: 'Menerima dan membagikan ke rekan kerja tanpa laporan resmi', isCorrect: false },
              { id: 'opt-23', text: 'Menyimpan parsel dan membalas dengan percepatan izin edar', isCorrect: false },
              { id: 'opt-24', text: 'Menjual parsel tersebut dan menyumbangkan hasilnya secara pribadi', isCorrect: false },
            ],
            explanation: 'Wajib dilaporkan ke UPG BPOM/KPK sesuai Peraturan KPK No. 2 Tahun 2019.',
            createdAt: new Date().toISOString(),
          },
          {
            id: `sq-3-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'true_false',
            difficulty: 'easy',
            prompt: `Sanksi pelanggaran kode etik ASN BPOM dapat berupa sanksi moral dan sanksi disiplin tertulis sesuai PP No. 94 Tahun 2021.`,
            options: [
              { id: 'tf-1', text: 'Benar', isCorrect: true },
              { id: 'tf-2', text: 'Salah', isCorrect: false },
            ],
            explanation: 'Sesuai PP No. 94 Tahun 2021 tentang Disiplin Pegawai Negeri Sipil.',
            createdAt: new Date().toISOString(),
          },
          {
            id: `sq-4-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'multiple_choice',
            difficulty: 'medium',
            prompt: `Berapa batas waktu penyampaian LHKPN / LHKASN secara tahunan bagi pejabat/pegawai BPOM?`,
            options: [
              { id: 'opt-31', text: 'Paling lambat tanggal 31 Maret tahun berikutnya', isCorrect: true },
              { id: 'opt-32', text: 'Paling lambat tanggal 31 Desember tahun berjalan', isCorrect: false },
              { id: 'opt-33', text: 'Paling lambat tanggal 30 Juni tahun berikutnya', isCorrect: false },
              { id: 'opt-34', text: 'Tidak ada batas waktu jika sudah menyampaikan sekali', isCorrect: false },
            ],
            explanation: 'Sesuai edaran MenPANRB dan Peraturan KPK tentang Kewajiban Pelaporan LHKPN.',
            createdAt: new Date().toISOString(),
          },
          {
            id: `sq-5-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'short_answer',
            difficulty: 'hard',
            prompt: `Sebutkan singkatan dari predikat unit kerja BPOM yang telah berhasil menciptakan area bebas korupsi (Tulis jawaban: WBK).`,
            shortAnswerCorrect: 'WBK',
            explanation: 'WBK singkatan dari Wilayah Bebas dari Korupsi.',
            createdAt: new Date().toISOString(),
          },
          {
            id: `sq-ordering-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'ordering',
            difficulty: 'medium',
            prompt: `Urutkan Tahapan Pengajuan Izin Edar Produk BPOM secara runtut dari awal hingga selesai:`,
            orderItems: [
              { id: 'o-1', text: 'Pendaftaran Akun Perusahaan & Unggah Dokumen Administrasi', correctPosition: 1 },
              { id: 'o-2', text: 'Verifikasi Berkas & Audit Fasilitas Produksi (CPOB/CPPOB)', correctPosition: 2 },
              { id: 'o-3', text: 'Evaluasi Produk, Pengujian Laboratorium & Evaluasi Formula', correctPosition: 3 },
              { id: 'o-4', text: 'Pembayaran PNBP & Penerbitan Nomor Izin Edar (NIE)', correctPosition: 4 },
            ],
            explanation: 'Sesuai Standar Pelayanan Publik BPOM tentang Alur Registrasi Obat & Makanan.',
            createdAt: new Date().toISOString(),
          },
          {
            id: `sq-matching-${Date.now()}`,
            materialId: matList[0]?.id || 'mat-1',
            type: 'matching',
            difficulty: 'hard',
            prompt: `Pasangkan Singkatan Istilah Reformasi Birokrasi BPOM dengan Deskripsi yang Sesuai:`,
            matchingPairs: [
              { id: 'm-1', left: 'WBK', right: 'Wilayah Bebas dari Korupsi' },
              { id: 'm-2', left: 'WBBM', right: 'Wilayah Birokrasi Bersih dan Melayani' },
              { id: 'm-3', left: 'UPG', right: 'Unit Pengendalian Gratifikasi' },
              { id: 'm-4', left: 'SPIP', right: 'Sistem Pengendalian Intern Pemerintah' },
            ],
            explanation: 'Pasangan istilah baku dalam Reformasi Birokrasi dan Zona Integritas BPOM.',
            createdAt: new Date().toISOString(),
          },
        ];
      }

      // Shuffle and limit to max 40 questions
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const questionsToUse = shuffled.slice(0, 40);

      // Total time formula = Total Questions x 30 Seconds
      const totalSeconds = questionsToUse.length * 30;
      setSelfExamTimeRemaining(totalSeconds);

      setActiveSelfExam({
        category: catName,
        questions: questionsToUse,
        currentIndex: 0,
        userAnswers: {},
        answersList: [],
        startTime: Date.now(),
        isFinished: false,
      });

      setSelfExamSelectedOptId(null);
      setSelfExamSelectedMultipleIds([]);
      setSelfExamShortAnswer('');
    } catch (err) {
      console.error('Gagal memulai ujian mandiri:', err);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  const handleSelfExamSubmitQuestion = async () => {
    if (!activeSelfExam) return;
    const curQ = activeSelfExam.questions[activeSelfExam.currentIndex];
    if (!curQ) return;

    let isCorrect = false;
    let userAnswerText = '(Tidak dijawab)';
    let correctAnswerText = '';

    if (curQ.type === 'multiple_choice' || curQ.type === 'case_study' || curQ.type === 'true_false') {
      const selectedOpt = curQ.options?.find((o) => o.id === selfExamSelectedOptId);
      const correctOpt = curQ.options?.find((o) => o.isCorrect);
      isCorrect = !!(selectedOpt && selectedOpt.isCorrect);
      userAnswerText = selectedOpt ? selectedOpt.text : '(Tidak dijawab)';
      correctAnswerText = correctOpt ? correctOpt.text : '';
    } else if (curQ.type === 'multiple_answer') {
      const selectedOpts = curQ.options?.filter((o) => selfExamSelectedMultipleIds.includes(o.id));
      const correctOpts = curQ.options?.filter((o) => o.isCorrect);
      const correctIds = (correctOpts || []).map((o) => o.id);
      isCorrect =
        selfExamSelectedMultipleIds.length === correctIds.length &&
        correctIds.every((id) => selfExamSelectedMultipleIds.includes(id));
      userAnswerText = selectedOpts && selectedOpts.length > 0 ? selectedOpts.map((o) => o.text).join('; ') : '(Tidak dijawab)';
      correctAnswerText = correctOpts ? correctOpts.map((o) => o.text).join('; ') : '';
    } else if (curQ.type === 'short_answer') {
      const userStr = selfExamShortAnswer.trim();
      const correctStr = (curQ.shortAnswerCorrect || '').trim();
      isCorrect = userStr.toLowerCase() === correctStr.toLowerCase();
      userAnswerText = userStr || '(Kosong)';
      correctAnswerText = correctStr;
    } else if (curQ.type === 'ordering') {
      const isOrderCorrect = selfExamOrderingList.length > 0 && selfExamOrderingList.every((item, idx) => item.correctPosition === idx + 1);
      isCorrect = isOrderCorrect;
      userAnswerText = selfExamOrderingList.length > 0
        ? selfExamOrderingList.map((item, idx) => `${idx + 1}. ${item.text}`).join(' → ')
        : '(Tidak dijawab)';
      const sortedCorrect = [...(curQ.orderItems || [])].sort((a, b) => a.correctPosition - b.correctPosition);
      correctAnswerText = sortedCorrect.map((item, idx) => `${idx + 1}. ${item.text}`).join(' → ');
    } else if (curQ.type === 'matching') {
      const pairs = curQ.matchingPairs || [];
      const allMatched = pairs.length > 0 && pairs.every((p) => selfExamMatchingUserAnswers[p.id] === p.right);
      isCorrect = allMatched;
      userAnswerText = pairs.length > 0
        ? pairs.map((p) => `${p.left} ➔ ${selfExamMatchingUserAnswers[p.id] || '(Belum dipasangkan)'}`).join('; ')
        : '(Tidak dijawab)';
      correctAnswerText = pairs.map((p) => `${p.left} ➔ ${p.right}`).join('; ');
    } else {
      isCorrect = true;
      userAnswerText = 'Jawaban telah dikirim';
      correctAnswerText = 'Sesuai ketentuan regulasi';
    }

    const answerRecord = {
      questionId: curQ.id,
      prompt: curQ.prompt,
      isCorrect,
      userAnswerText,
      correctAnswerText,
      explanation: curQ.explanation,
    };

    const newAnswersList = [...activeSelfExam.answersList, answerRecord];

    // Check if last question
    if (activeSelfExam.currentIndex < activeSelfExam.questions.length - 1) {
      setActiveSelfExam({
        ...activeSelfExam,
        currentIndex: activeSelfExam.currentIndex + 1,
        answersList: newAnswersList,
      });
      setSelfExamSelectedOptId(null);
      setSelfExamSelectedMultipleIds([]);
      setSelfExamShortAnswer('');
    } else {
      // Exam Completed!
      const correctCount = newAnswersList.filter((a) => a.isCorrect).length;
      const totalQuestions = activeSelfExam.questions.length;
      const scorePercent = Math.round((correctCount / totalQuestions) * 100);
      const status: 'LULUS' | 'TIDAK LULUS' = scorePercent >= 70 ? 'LULUS' : 'TIDAK LULUS';
      const timeSpentSeconds = Math.round((Date.now() - activeSelfExam.startTime) / 1000);

      const payload = {
        nip: siasnUser?.nip || '198503152010121002',
        participantName: siasnUser?.name || 'Peserta Mandiri BPOM',
        category: activeSelfExam.category,
        score: scorePercent,
        totalQuestions,
        correctCount,
        status,
        timeSpentSeconds,
        answers: newAnswersList,
      };

      try {
        const res = await fetch('/api/quiz/self-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          console.error('Gagal menyimpan hasil ujian mandiri:', errData);
        }
      } catch (e) {
        console.error('Network error saat menyimpan ujian mandiri:', e);
      }

      if (status === 'LULUS') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      setActiveSelfExam({
        ...activeSelfExam,
        answersList: newAnswersList,
        isFinished: true,
        finalResult: payload,
      });
    }
  };

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
    }, 800);

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
        } else if (data.session && data.session.currentQuestionIndex !== prevQuestionIndex) {
          setTimeLeft(data.session.timerSeconds || 30);
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
    if (activeSelfExam) {
      const curQ = activeSelfExam.questions[activeSelfExam.currentIndex];
      const totalQ = activeSelfExam.questions.length;
      const progressPercent = Math.round(((activeSelfExam.currentIndex + 1) / totalQ) * 100);

      if (activeSelfExam.isFinished) {
        // FINISHED RESULT VIEW
        const res = activeSelfExam.finalResult;
        return (
          <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Hasil Ujian Mandiri (Exam Mode)
                </span>
                <h2 className="text-2xl font-black text-white">{activeSelfExam.category}</h2>
                <p className="text-xs text-slate-400">
                  Peserta: <strong className="text-white">{siasnUser?.name || 'Peserta BPOM'}</strong> (NIP: {siasnUser?.nip || '-'})
                </p>
              </div>

              {/* Score Badge */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/60 rounded-2xl border border-slate-700/80 space-y-2">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center font-black text-3xl shadow-xl ${
                    res?.status === 'LULUS'
                      ? 'bg-emerald-500/20 text-emerald-400 border-4 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border-4 border-rose-500/40'
                  }`}
                >
                  {res?.score}%
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-lg text-white">
                    {res?.status === 'LULUS' ? 'LULUS UJIAN' : 'TIDAK LULUS'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Menjawab benar <strong className="text-emerald-400">{res?.correctCount}</strong> dari {res?.totalQuestions} soal
                  </p>
                </div>
              </div>

              {/* Question Breakdown Review */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                <h3 className="font-bold text-sm text-white">Rincian Evaluasi Jawaban:</h3>
                {activeSelfExam.answersList.map((ans, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      ans.isCorrect
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-100'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Soal #{idx + 1}</span>
                      <span className={ans.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                        {ans.isCorrect ? '✓ Benar' : '✕ Salah'}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-200">{ans.prompt}</p>
                    <p className="text-slate-300">
                      <strong>Jawaban Anda:</strong> {ans.userAnswerText}
                    </p>
                    {!ans.isCorrect && (
                      <p className="text-emerald-400 font-medium">
                        <strong>Jawaban Benar:</strong> {ans.correctAnswerText}
                      </p>
                    )}
                    {ans.explanation && (
                      <p className="text-[11px] text-slate-400 italic">💡 Pembahasan: {ans.explanation}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    const matList = materials.filter((m) => (m.category || 'Umum') === activeSelfExam.category);
                    handleStartSelfExam(activeSelfExam.category, matList);
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Ulangi Ujian Mandiri
                </button>
                <button
                  onClick={() => setActiveSelfExam(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Kembali ke Modul Materi
                </button>
              </div>
            </div>
          </div>
        );
      }

      // ACTIVE QUESTION EXAM VIEW
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Header Exam Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold font-mono">
                  EXAM MODE
                </span>
                <h3 className="font-bold text-sm text-white truncate max-w-[150px] sm:max-w-xs">{activeSelfExam.category}</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Timer Display */}
                <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-mono font-bold text-xs ${
                  selfExamTimeRemaining < 60
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-slate-800 text-amber-300 border-amber-500/30'
                }`}>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{formatTimer(selfExamTimeRemaining)}</span>
                </div>

                <button
                  onClick={() => {
                    if (confirm('Yakin ingin membatalkan ujian mandiri? Kemajuan akan hilang.')) {
                      setActiveSelfExam(null);
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 rounded-xl text-xs font-semibold transition-all"
                >
                  Batal
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-mono font-bold">
                <span>Soal {activeSelfExam.currentIndex + 1} dari {totalQ}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Question Box */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {curQ?.difficulty || 'Sedang'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Tipe: {
                    curQ?.type === 'multiple_choice' ? 'Pilihan Ganda' :
                    curQ?.type === 'case_study' ? 'Studi Kasus' :
                    curQ?.type === 'true_false' ? 'Benar / Salah' :
                    curQ?.type === 'multiple_answer' ? 'Jawaban Jamak' :
                    curQ?.type === 'ordering' ? 'Mengurutkan (Urutan)' :
                    curQ?.type === 'matching' ? 'Memasangkan (Pasangan)' :
                    'Isian Singkat'
                  }
                </span>
              </div>

              {/* Skenario Studi Kasus */}
              {(curQ?.caseStudyScenario || curQ?.type === 'case_study') && (
                <div className="p-4 bg-indigo-950/50 border border-indigo-500/40 rounded-2xl text-xs sm:text-sm text-indigo-100 space-y-2 leading-relaxed shadow-lg">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                    <BookOpen className="w-4 h-4 text-indigo-400" /> Skenario Studi Kasus:
                  </div>
                  <p className="whitespace-pre-line font-medium text-slate-200">
                    {curQ?.caseStudyScenario || curQ?.prompt}
                  </p>
                </div>
              )}

              <h2 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                {curQ?.prompt}
              </h2>

              {/* Options or Answer Input */}
              {curQ?.type === 'short_answer' ? (
                <div className="pt-2">
                  <input
                    type="text"
                    value={selfExamShortAnswer}
                    onChange={(e) => setSelfExamShortAnswer(e.target.value)}
                    placeholder="Ketik jawaban Anda..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>
              ) : curQ?.type === 'ordering' ? (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-slate-400 italic mb-2">
                    Gunakan tombol panah 🔼 / 🔽 untuk mengurutkan langkah dari posisi teratas ke terbawah:
                  </p>
                  {selfExamOrderingList.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between text-xs font-semibold text-white gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold font-mono flex items-center justify-center text-xs border border-indigo-500/30">
                          {idx + 1}
                        </span>
                        <span>{item.text}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            const newList = [...selfExamOrderingList];
                            const temp = newList[idx - 1];
                            newList[idx - 1] = newList[idx];
                            newList[idx] = temp;
                            setSelfExamOrderingList(newList);
                          }}
                          className="p-1.5 bg-slate-700 hover:bg-indigo-600 disabled:opacity-30 rounded-lg text-slate-200 transition-all"
                          title="Naikkan Posisi"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selfExamOrderingList.length - 1}
                          onClick={() => {
                            const newList = [...selfExamOrderingList];
                            const temp = newList[idx + 1];
                            newList[idx + 1] = newList[idx];
                            newList[idx] = temp;
                            setSelfExamOrderingList(newList);
                          }}
                          className="p-1.5 bg-slate-700 hover:bg-indigo-600 disabled:opacity-30 rounded-lg text-slate-200 transition-all"
                          title="Turunkan Posisi"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : curQ?.type === 'matching' ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-slate-400 italic mb-2">
                    Pilih pasangan yang tepat pada kolom pilihan di sebelah kanan untuk setiap item:
                  </p>
                  {curQ.matchingPairs?.map((pair) => {
                    const rightOptions = Array.from(
                      new Set(curQ.matchingPairs?.map((p) => p.right) || [])
                    );
                    return (
                      <div
                        key={pair.id}
                        className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <span className="text-xs font-bold text-indigo-200 sm:w-1/2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          {pair.left}
                        </span>
                        <select
                          value={selfExamMatchingUserAnswers[pair.id] || ''}
                          onChange={(e) => {
                            setSelfExamMatchingUserAnswers({
                              ...selfExamMatchingUserAnswers,
                              [pair.id]: e.target.value,
                            });
                          }}
                          className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500 sm:w-1/2 font-semibold"
                        >
                          <option value="">-- Pilih Pasangan --</option>
                          {rightOptions.map((r, rIdx) => (
                            <option key={rIdx} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ) : curQ?.type === 'multiple_answer' ? (
                <div className="space-y-2 pt-2">
                  {curQ?.options?.map((opt) => {
                    const isSelected = selfExamSelectedMultipleIds.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelfExamSelectedMultipleIds(selfExamSelectedMultipleIds.filter((id) => id !== opt.id));
                          } else {
                            setSelfExamSelectedMultipleIds([...selfExamSelectedMultipleIds, opt.id]);
                          }
                        }}
                        className={`w-full p-4 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>{opt.text}</span>
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {curQ?.options?.map((opt) => {
                    const isSelected = selfExamSelectedOptId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelfExamSelectedOptId(opt.id)}
                        className={`w-full p-4 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>{opt.text}</span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-600'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Submit Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSelfExamSubmitQuestion}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{activeSelfExam.currentIndex < totalQ - 1 ? 'Simpan & Lanjut ke Soal Berikutnya' : 'Selesai & Kirim Ujian Mandiri'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

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
                      <div className="w-full bg-slate-800/80 hover:bg-slate-800 border-b border-slate-700/80 p-4 flex items-center justify-between transition-colors text-left group">
                        <div
                          onClick={() => toggleFolder(catName)}
                          className="flex items-center gap-3 cursor-pointer flex-1"
                        >
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
                          {/* Tombol Akses - Khusus Peserta yang Sudah Login SSO SIASN */}
                          {siasnUser ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenHistoryModal(catName);
                                }}
                                className="px-3 py-2 bg-slate-800/90 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                                title="Lihat Riwayat Ujian Mandiri Kategori Ini"
                              >
                                <History className="w-3.5 h-3.5 text-indigo-400" /> History Ujian
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartSelfExam(catName, matList);
                                }}
                                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all transform hover:scale-105"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-200 animate-pulse" /> Mulai Ujian Mandiri
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTabMode('siasn');
                              }}
                              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
                              title="Login SSO SIASN BPOM untuk membuka Ujian Mandiri"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400" /> Login SSO Ujian
                            </button>
                          )}

                          <div
                            onClick={() => toggleFolder(catName)}
                            className="flex items-center gap-2 cursor-pointer ml-2"
                          >
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
                              {isExpanded ? 'Tutup' : 'Buka'}
                            </span>
                            <div className={`p-1.5 rounded-lg bg-slate-700/60 text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>

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

        {/* Modal History Ujian Mandiri */}
        {historyModalCategory && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header Modal */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Riwayat SSO SIASN
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      NIP: {siasnUser?.nip}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Riwayat Ujian Mandiri - Kategori {historyModalCategory}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setHistoryModalCategory(null);
                    setSelectedHistoryDetail(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {isLoadingHistory ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                    <p className="text-xs font-semibold">Memuat riwayat ujian mandiri...</p>
                  </div>
                ) : historyExamsList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/40 border border-slate-800 rounded-2xl p-6 text-slate-400 space-y-2">
                    <History className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-white">Belum Ada Riwayat Ujian Mandiri</p>
                    <p className="text-xs text-slate-400">
                      Anda belum pernah mengerjakan Ujian Mandiri untuk kategori <strong>{historyModalCategory}</strong>. Klik "Mulai Ujian Mandiri" untuk memulai ujian pertama Anda.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 uppercase text-[10px] font-mono text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">No</th>
                          <th className="py-3 px-4">Tanggal dan Waktu Ujian</th>
                          <th className="py-3 px-4 text-center">Score</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-center">View Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {historyExamsList.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4 text-slate-200">
                              <div className="font-bold text-white">{item.completedAt}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{item.totalQuestions} Soal • {Math.round((item.timeSpentSeconds || 0) / 60)} Menit</div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold font-mono text-sm">
                              <span className={item.score >= 70 ? 'text-emerald-400' : 'text-rose-400'}>
                                {item.score}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                item.status === 'LULUS'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => setSelectedHistoryDetail(item)}
                                className="p-2 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl border border-indigo-500/40 transition-all shadow-sm"
                                title="Lihat Detail Rincian Soal & Jawaban"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Detail Popup inside Modal if clicked */}
                {selectedHistoryDetail && (
                  <div className="mt-4 p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h4 className="font-bold text-sm text-white">Rincian Evaluasi Jawaban Ujian</h4>
                        <p className="text-xs text-slate-400 font-mono">
                          Waktu: {selectedHistoryDetail.completedAt} | Score: {selectedHistoryDetail.score}% ({selectedHistoryDetail.status})
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedHistoryDetail(null)}
                        className="px-2.5 py-1 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs"
                      >
                        Tutup Detail
                      </button>
                    </div>

                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {selectedHistoryDetail.answers?.map((ans: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                            ans.isCorrect
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
                              : 'bg-rose-950/20 border-rose-500/30 text-rose-100'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>Soal #{idx + 1}</span>
                            <span className={ans.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                              {ans.isCorrect ? '✓ Benar' : '✕ Salah'}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-200">{ans.prompt}</p>
                          <p className="text-slate-300">
                            <strong>Jawaban Anda:</strong> {ans.userAnswerText}
                          </p>
                          {!ans.isCorrect && (
                            <p className="text-emerald-400 font-medium">
                              <strong>Jawaban Benar:</strong> {ans.correctAnswerText}
                            </p>
                          )}
                          {ans.explanation && (
                            <p className="text-[11px] text-slate-400 italic">💡 Pembahasan: {ans.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
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
            <div className="space-y-4">
              {/* 1. Multiple Choice / True False / Case Study */}
              {(currentQuestion.type === 'multiple_choice' ||
                currentQuestion.type === 'true_false' ||
                currentQuestion.type === 'case_study') &&
                currentQuestion.options && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = selectedOptionId === opt.id;
                      const buttonColors = [
                        isSelected
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg ring-2 ring-indigo-400 scale-[1.01]'
                          : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200',
                        isSelected
                          ? 'bg-purple-600 border-purple-400 text-white shadow-lg ring-2 ring-purple-400 scale-[1.01]'
                          : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200',
                        isSelected
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg ring-2 ring-emerald-400 scale-[1.01]'
                          : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200',
                        isSelected
                          ? 'bg-amber-600 border-amber-400 text-white shadow-lg ring-2 ring-amber-400 scale-[1.01]'
                          : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200',
                      ];
                      const colorClass = buttonColors[idx % buttonColors.length];

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedOptionId(opt.id)}
                          className={`w-full p-4 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between gap-3 shadow-md ${colorClass}`}
                        >
                          <span>{opt.text}</span>
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected ? 'border-white bg-white/20' : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

              {/* 2. Multiple Answer */}
              {currentQuestion.type === 'multiple_answer' && currentQuestion.options && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-indigo-300">Pilih satu atau lebih jawaban yang benar:</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {currentQuestion.options.map((opt) => {
                      const isSelected = selectedMultipleOptionIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedMultipleOptionIds((prev) =>
                              prev.includes(opt.id) ? prev.filter((i) => i !== opt.id) : [...prev, opt.id]
                            );
                          }}
                          className={`w-full p-4 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between gap-3 shadow-md ${
                            isSelected
                              ? 'bg-indigo-600/30 border-indigo-500 text-white ring-2 ring-indigo-400/50'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                          }`}
                        >
                          <span>{opt.text}</span>
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Short Answer */}
              {currentQuestion.type === 'short_answer' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={50}
                    value={shortAnswerInput}
                    onChange={(e) => setShortAnswerInput(e.target.value)}
                    placeholder="Tulis jawaban singkat Anda..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && shortAnswerInput.trim()) {
                        handleSubmitAnswer(shortAnswerInput.trim());
                      }
                    }}
                  />
                  <p className="text-[10px] text-slate-500 text-center">Isi jawaban lalu klik tombol "Kirim Jawaban" di bawah</p>
                </div>
              )}

              {/* 4. Ordering / Sequence Question */}
              {(currentQuestion.type === 'ordering' || (currentQuestion as any).type === 'sequence') && (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-xs text-indigo-300">
                    <ListOrdered className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Gunakan tombol panah naik/turun untuk menyusun urutan dari teratas (#1) sampai terbawah.</span>
                  </div>

                  <div className="space-y-2">
                    {orderedItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between gap-3 shadow-md"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-white leading-relaxed truncate">{item.text}</span>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              if (idx === 0) return;
                              const updated = [...orderedItems];
                              const [temp] = updated.splice(idx, 1);
                              updated.splice(idx - 1, 0, temp);
                              setOrderedItems(updated);
                            }}
                            className="p-2 rounded-xl bg-slate-700/80 hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-700/80 text-white transition-all"
                            title="Naikkan Urutan"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === orderedItems.length - 1}
                            onClick={() => {
                              if (idx === orderedItems.length - 1) return;
                              const updated = [...orderedItems];
                              const [temp] = updated.splice(idx, 1);
                              updated.splice(idx + 1, 0, temp);
                              setOrderedItems(updated);
                            }}
                            className="p-2 rounded-xl bg-slate-700/80 hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-700/80 text-white transition-all"
                            title="Turunkan Urutan"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Matching Question (Penjodohan) */}
              {currentQuestion.type === 'matching' && currentQuestion.matchingPairs && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                    <Link2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Pasangkan setiap item di sebelah kiri dengan pilihan yang tepat di sebelah kanan:</span>
                  </div>

                  <div className="space-y-3">
                    {currentQuestion.matchingPairs.map((pair, idx) => {
                      const rightChoices = currentQuestion.matchingPairs?.map((p) => p.right) || [];

                      return (
                        <div key={pair.id || idx} className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl space-y-2 shadow-md">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-md font-mono text-[10px] font-bold">
                              Pernyataan {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-white">{pair.left}</span>
                          </div>

                          <div className="relative">
                            <select
                              value={matchingSelections[pair.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMatchingSelections((prev) => ({ ...prev, [pair.id]: val }));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 pr-8 text-xs text-emerald-300 outline-none focus:border-emerald-500 font-medium"
                            >
                              <option value="" disabled className="text-slate-500">
                                -- Pilih Pasangan Jawaban --
                              </option>
                              {rightChoices.map((rc, rIdx) => (
                                <option key={rIdx} value={rc} className="bg-slate-900 text-white">
                                  {rc}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dedicated Submit Button for Participant Choice */}
              <div className="pt-2">
                {(() => {
                  let isReadyToSubmit = false;
                  let submitPayload: any = null;
                  let buttonLabel = 'Kirim Jawaban';

                  if (
                    currentQuestion.type === 'multiple_choice' ||
                    currentQuestion.type === 'true_false' ||
                    currentQuestion.type === 'case_study'
                  ) {
                    isReadyToSubmit = !!selectedOptionId;
                    submitPayload = selectedOptionId;
                    buttonLabel = 'Kirim Jawaban Terpilih';
                  } else if (currentQuestion.type === 'multiple_answer') {
                    isReadyToSubmit = selectedMultipleOptionIds.length > 0;
                    submitPayload = selectedMultipleOptionIds;
                    buttonLabel = `Kirim ${selectedMultipleOptionIds.length} Jawaban Terpilih`;
                  } else if (currentQuestion.type === 'short_answer') {
                    isReadyToSubmit = shortAnswerInput.trim().length > 0;
                    submitPayload = shortAnswerInput.trim();
                    buttonLabel = 'Kirim Jawaban Singkat';
                  } else if (
                    currentQuestion.type === 'ordering' ||
                    (currentQuestion as any).type === 'sequence'
                  ) {
                    isReadyToSubmit = orderedItems.length > 0;
                    submitPayload = orderedItems.map((i) => i.id);
                    buttonLabel = 'Kirim Urutan Jawaban';
                  } else if (currentQuestion.type === 'matching') {
                    const totalPairs = currentQuestion.matchingPairs?.length || 0;
                    const matchedCount = Object.keys(matchingSelections).filter(
                      (k) => !!matchingSelections[k]
                    ).length;
                    isReadyToSubmit = totalPairs > 0 && matchedCount === totalPairs;
                    submitPayload = matchingSelections;
                    buttonLabel = matchedCount < totalPairs ? `Lengkapi ${totalPairs - matchedCount} Pasangan Lagi` : 'Kirim Pasangan Jawaban';
                  }

                  return (
                    <button
                      type="button"
                      disabled={!isReadyToSubmit}
                      onClick={() => {
                        if (isReadyToSubmit) {
                          handleSubmitAnswer(submitPayload);
                        }
                      }}
                      className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                        isReadyToSubmit
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 active:scale-95 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Send className="w-4 h-4" /> {buttonLabel}
                    </button>
                  );
                })()}
              </div>
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
