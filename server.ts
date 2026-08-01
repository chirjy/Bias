import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { store } from './server/store';
import { registerSSEClient, broadcastSessionEvent } from './server/realtime';
import { parseDocumentBuffer } from './server/ai/DocumentReader';
import { generateMaterialSummary } from './server/ai/SummaryGenerator';
import { generateQuestionBank, regenerateSingleQuestion, generateFallbackQuestions } from './server/ai/QuestionGenerator';
import { generateMathCaptcha, verifyMathCaptcha, authenticateSiasn, verifyJwt } from './server/auth';
import { Material, Question, QuizSession, Participant, ParticipantAnswer } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // SIASN SSO & Captcha Endpoints
  app.get('/api/auth/captcha', (req, res) => {
    const captcha = generateMathCaptcha();
    res.json(captcha);
  });

  app.post('/api/auth/siasn-login', async (req, res) => {
    try {
      const { nip, username, password, captchaAnswer, captchaToken } = req.body;

      if (!nip || !password) {
        return res.status(400).json({ error: 'NIP dan Password SIASN wajib diisi!' });
      }

      if (nip.trim().length !== 18 || !/^\d+$/.test(nip.trim())) {
        return res.status(400).json({ error: 'NIP Pegawai harus tepat 18 digit angka!' });
      }

      // Server-side Captcha Verification
      const isCaptchaValid = verifyMathCaptcha(captchaAnswer, captchaToken);
      if (!isCaptchaValid) {
        return res.status(400).json({ error: 'Jawaban Captcha Matematika salah atau telah kadaluarsa!' });
      }

      // Authenticate via SIASN SSO
      const authResult = await authenticateSiasn(nip.trim(), username || nip.trim(), password);
      res.json({
        success: true,
        token: authResult.clientToken,
        user: authResult.user,
      });
    } catch (err: any) {
      res.status(401).json({ error: err.message || 'Gagal autentikasi SIASN BPOM' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ authenticated: false, error: 'Token Authorization tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    const verified = verifyJwt(token);

    if (!verified) {
      return res.status(401).json({ authenticated: false, error: 'Token tidak valid atau telah kadaluarsa' });
    }

    res.json({
      authenticated: true,
      user: verified,
    });
  });

  // Material endpoints
  app.get('/api/materials', (req, res) => {
    res.json(store.getMaterials());
  });

  app.get('/api/materials/:id', (req, res) => {
    const mat = store.getMaterial(req.params.id);
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    res.json(mat);
  });

  // Upload document & AI automatic generation of 60 questions
  app.post('/api/materials/upload', async (req, res) => {
    try {
      const { fileName, fileType, fileBase64, category } = req.body;
      if (!fileName || !fileBase64) {
        return res.status(400).json({ error: 'Filename and base64 file content are required' });
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      const parsedDoc = parseDocumentBuffer(fileName, fileType || 'pptx', buffer);

      const materialId = `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Generate Summary & Key Concepts via Gemini AI
      const summaryResult = await generateMaterialSummary(parsedDoc.title, parsedDoc.rawText);

      // 2. Generate Question Bank (35 Easy, 35 Medium, 30 Hard = 100 questions across 7 types) via Gemini AI
      let questions: Question[] = [];
      try {
        questions = await generateQuestionBank({
          materialId,
          materialTitle: parsedDoc.title,
          rawText: parsedDoc.rawText,
          countEasy: 35,
          countMedium: 35,
          countHard: 30,
        });
      } catch (genErr) {
        console.error('AI Question generation warning, fallback will be used:', genErr);
      }

      // Guarantee that every uploaded material has generated questions
      if (!questions || questions.length === 0) {
        questions = generateFallbackQuestions(materialId, parsedDoc.title, 35, 35, 30, parsedDoc.rawText);
      }

      // Calculate difficulty & type counts
      const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
      const typeCounts: Record<string, number> = {
        multiple_choice: 0,
        true_false: 0,
        multiple_answer: 0,
        ordering: 0,
        matching: 0,
        short_answer: 0,
        case_study: 0,
      };

      questions.forEach((q) => {
        if (q.difficulty in difficultyCounts) {
          difficultyCounts[q.difficulty as keyof typeof difficultyCounts]++;
        }
        typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
      });

      const assignedCategory = category && typeof category === 'string' && category.trim().length > 0 
        ? category.trim() 
        : 'Umum';

      const newMaterial: Material = {
        id: materialId,
        title: parsedDoc.title,
        category: assignedCategory,
        filename: fileName,
        fileType: (fileType || 'pptx') as any,
        uploadedAt: new Date().toISOString(),
        summary: summaryResult.summary,
        keyConcepts: summaryResult.keyConcepts,
        regulations: summaryResult.regulations,
        totalQuestions: questions.length,
        difficultyCounts,
        typeCounts: typeCounts as any,
        version: 1,
      };

      store.addMaterial(newMaterial, questions);

      res.json({
        material: newMaterial,
        questionsCount: questions.length,
        summary: summaryResult,
      });
    } catch (err: any) {
      console.error('Error uploading and parsing material:', err);
      res.status(500).json({ error: err.message || 'Failed to process document' });
    }
  });

  app.delete('/api/materials/:id', (req, res) => {
    store.deleteMaterial(req.params.id);
    res.json({ success: true });
  });

  // Questions endpoints
  app.get('/api/questions/material/:materialId', (req, res) => {
    const questions = store.getQuestionsByMaterial(req.params.materialId);
    res.json(questions);
  });

  app.post('/api/questions/save', (req, res) => {
    const q: Question = req.body;
    if (!q.id || !q.materialId || !q.prompt) {
      return res.status(400).json({ error: 'Invalid question payload' });
    }
    store.saveQuestion(q);
    res.json({ success: true, question: q });
  });

  app.delete('/api/questions/:id', (req, res) => {
    store.deleteQuestion(req.params.id);
    res.json({ success: true });
  });

  // AI Regenerate Single Question
  app.post('/api/questions/regenerate-single', async (req, res) => {
    try {
      const { question } = req.body;
      const mat = store.getMaterial(question.materialId);
      const newQ = await regenerateSingleQuestion(mat?.title || 'Materi Pembelajaran', question);
      store.saveQuestion(newQ);
      res.json({ success: true, question: newQ });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to regenerate question' });
    }
  });

  // AI Regenerate Entire Bank
  app.post('/api/questions/regenerate-bank/:materialId', async (req, res) => {
    try {
      const materialId = req.params.materialId;
      const mat = store.getMaterial(materialId);
      if (!mat) return res.status(404).json({ error: 'Material not found' });

      const newQuestions = await generateQuestionBank({
        materialId,
        materialTitle: mat.title,
        rawText: `${mat.summary} ${mat.keyConcepts.join(' ')} ${mat.regulations.join(' ')}`,
        countEasy: 20,
        countMedium: 20,
        countHard: 20,
      });

      store.setQuestionsForMaterial(materialId, newQuestions);
      res.json({ success: true, totalQuestions: newQuestions.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to regenerate bank' });
    }
  });

  // Export / Import
  app.get('/api/materials/export/:materialId', (req, res) => {
    const mat = store.getMaterial(req.params.materialId);
    const questions = store.getQuestionsByMaterial(req.params.materialId);
    res.json({
      material: mat,
      questions,
      exportedAt: new Date().toISOString(),
    });
  });

  app.post('/api/materials/import', (req, res) => {
    try {
      const { material, questions } = req.body;
      if (!material || !questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'Invalid import payload structure' });
      }

      const matId = `mat-import-${Date.now()}`;
      const importedMat: Material = {
        ...material,
        id: matId,
        title: `${material.title || 'Materi Impor'} (Impor)`,
        uploadedAt: new Date().toISOString(),
      };

      const importedQuestions = questions.map((q: any, idx: number) => ({
        ...q,
        id: `q-${matId}-${idx + 1}`,
        materialId: matId,
      }));

      store.addMaterial(importedMat, importedQuestions);
      res.json({ success: true, material: importedMat, questionsCount: importedQuestions.length });
    } catch (err: any) {
      res.status(500).json({ error: 'Import failed: ' + err.message });
    }
  });

  // Quiz Live Session Endpoints
  app.post('/api/quiz/session/create', (req, res) => {
    const { title, materialIds, gameMode, timerSeconds, questionLimit, randomizeQuestions, randomizeOptions } = req.body;

    // Generate random 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Gather and balance question selection across ALL selected materials
    const selectedMatIds: string[] = Array.isArray(materialIds) && materialIds.length > 0 ? materialIds : [];
    const materialQuestionsMap: Record<string, Question[]> = {};

    selectedMatIds.forEach((matId: string) => {
      let qs = store.getQuestionsByMaterial(matId);
      if (!qs || qs.length === 0) {
        // Guarantee questions exist for every selected material
        const mat = store.getMaterial(matId);
        if (mat) {
          const fallbackQs = generateFallbackQuestions(mat.id, mat.title, 35, 35, 30, mat.summary);
          fallbackQs.forEach((q) => store.saveQuestion(q));
          qs = fallbackQs;
        }
      }
      if (randomizeQuestions) {
        qs = [...qs].sort(() => Math.random() - 0.5);
      }
      materialQuestionsMap[matId] = qs;
    });

    const activeMatIds = selectedMatIds.filter((mId) => materialQuestionsMap[mId] && materialQuestionsMap[mId].length > 0);
    const targetLimit = (questionLimit && questionLimit > 0) ? questionLimit : 20;
    const selectedQuestions: Question[] = [];

    if (activeMatIds.length > 0) {
      // Calculate fair base quota per material so every material is represented
      const baseQuotaPerMat = Math.max(1, Math.floor(targetLimit / activeMatIds.length));
      const usedIndices: Record<string, number> = {};

      activeMatIds.forEach((mId) => {
        usedIndices[mId] = 0;
      });

      // 1. Assign base quota from each material
      activeMatIds.forEach((mId) => {
        const pool = materialQuestionsMap[mId];
        const countToTake = Math.min(pool.length, baseQuotaPerMat);
        for (let i = 0; i < countToTake; i++) {
          selectedQuestions.push(pool[i]);
        }
        usedIndices[mId] = countToTake;
      });

      // 2. Fill remaining slots up to targetLimit by round-robin picking from materials with extra questions
      let addedMore = true;
      while (selectedQuestions.length < targetLimit && addedMore) {
        addedMore = false;
        for (const mId of activeMatIds) {
          if (selectedQuestions.length >= targetLimit) break;
          const pool = materialQuestionsMap[mId];
          const currIdx = usedIndices[mId];
          if (currIdx < pool.length) {
            selectedQuestions.push(pool[currIdx]);
            usedIndices[mId] = currIdx + 1;
            addedMore = true;
          }
        }
      }
    }

    // Safety Fallback: If no material selected or questions empty, pull from all stored questions
    if (selectedQuestions.length === 0) {
      const allMats = store.getMaterials();
      for (const mat of allMats) {
        const qs = store.getQuestionsByMaterial(mat.id);
        selectedQuestions.push(...qs);
      }
    }

    // Secondary Safety Fallback: Generate emergency questions if store is completely empty
    if (selectedQuestions.length === 0) {
      const emergencyQs = generateFallbackQuestions('mat-emergency', 'Integritas ASN BPOM', 35, 35, 30);
      emergencyQs.forEach((q) => store.saveQuestion(q));
      selectedQuestions.push(...emergencyQs);
    }

    // 3. Shuffle or interleave final questions if randomizeQuestions is requested
    if (randomizeQuestions) {
      selectedQuestions.sort(() => Math.random() - 0.5);
    }

    const allQuestionIds = selectedQuestions.slice(0, targetLimit).map((q) => q.id);

    const session: QuizSession = {
      id: `session-${Date.now()}`,
      pin,
      hostId: 'host-admin',
      title: title || 'Sesi Quiz Interaktif',
      materialIds: materialIds || [],
      gameMode: gameMode || 'quiz',
      timerSeconds: timerSeconds || 30,
      questionIds: allQuestionIds,
      currentQuestionIndex: -1, // -1 means lobby
      status: 'lobby',
      randomizeQuestions: !!randomizeQuestions,
      randomizeOptions: !!randomizeOptions,
      createdAt: new Date().toISOString(),
    };

    store.createSession(session);
    res.json({ success: true, session });
  });

  app.get('/api/quiz/active-sessions', (req, res) => {
    const sessions = store.getActiveSessions();
    const result = sessions.map((s) => ({
      ...s,
      participantsCount: store.getParticipants(s.pin).length,
    }));
    res.json(result);
  });

  app.post('/api/quiz/admin/reset-sessions', (req, res) => {
    store.finishAllSessions();
    res.json({ success: true, message: 'Seluruh sesi aktif telah dibersihkan.' });
  });

  app.get('/api/quiz/session/:pin', (req, res) => {
    const pin = (req.params.pin || '').trim();
    if (req.query.role === 'host' || req.headers['x-role'] === 'host') {
      store.touchSessionHost(pin);
    }
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: `PIN Quiz [${pin}] tidak ditemukan atau telah berakhir` });

    // Fetch question objects
    const currentQuestionObj =
      session.currentQuestionIndex >= 0 && session.currentQuestionIndex < session.questionIds.length
        ? store.getQuestion(session.questionIds[session.currentQuestionIndex])
        : null;

    const participants = store.getParticipants(pin);
    const answers = store.getParticipantAnswers(pin);

    res.json({
      session,
      currentQuestion: currentQuestionObj,
      totalQuestions: session.questionIds.length,
      participants,
      answersCount: answers.length,
    });
  });

  // Handle joins via /api/quiz/session/:pin/join OR /api/quiz/session/join OR /api/quiz/join
  const handleJoinRequest = (req: express.Request, res: express.Response) => {
    const rawPin = req.params.pin || req.body?.pin || req.query?.pin || '';
    const pin = String(rawPin).replace(/\D/g, '').trim() || String(rawPin).trim();
    const { nickname, avatar } = req.body || {};

    if (!pin) {
      return res.status(400).json({ error: 'PIN Sesi Quiz wajib diisi' });
    }

    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: `PIN Quiz [${pin}] tidak ditemukan atau telah berakhir` });

    if (req.method === 'GET') {
      return res.json({ success: true, session, message: 'Sesi aktif dan siap untuk bergabung' });
    }

    const participant: Participant = {
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionPin: session.pin,
      nickname: (nickname || `Peserta ${Math.floor(Math.random() * 100)}`).trim(),
      avatar: avatar || '😊',
      score: 0,
      streak: 0,
      totalCorrect: 0,
      joinedAt: new Date().toISOString(),
    };

    const added = store.addParticipant(session.pin, participant);
    broadcastSessionEvent(session.pin, 'PARTICIPANT_JOINED', { participant: added });

    res.json({ success: true, participant: added, session, participants: store.getParticipants(session.pin) });
  };

  app.all('/api/quiz/session/:pin/join', handleJoinRequest);
  app.all('/api/quiz/session/join', handleJoinRequest);
  app.all('/api/quiz/join', handleJoinRequest);

  app.post('/api/quiz/session/:pin/add-demo-participant', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const demoNames = [
      'Budi Santoso (KemenPANRB)',
      'Siti Rahmawati (BKN)',
      'Ahmad Fauzi (LAN RI)',
      'Dewi Lestari (Kemenkeu)',
      'Rudi Hermawan (BPOM)',
      'Anisa Putri (Inspektorat)',
      'Hendra Kusuma (Pusdiklat)',
    ];
    const demoAvatars = ['😊', '🚀', '💡', '🎓', '👑', '🔥', '🌟', '🦁', '🦊'];

    const currentList = store.getParticipants(pin);
    const unusedNames = demoNames.filter((n) => !currentList.some((p) => p.nickname === n));
    const chosenName = unusedNames.length > 0 ? unusedNames[0] : `Peserta Demo ${currentList.length + 1}`;
    const chosenAvatar = demoAvatars[currentList.length % demoAvatars.length];

    const participant: Participant = {
      id: `p-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionPin: pin,
      nickname: chosenName,
      avatar: chosenAvatar,
      score: 0,
      streak: 0,
      totalCorrect: 0,
      joinedAt: new Date().toISOString(),
    };

    const added = store.addParticipant(pin, participant);
    broadcastSessionEvent(pin, 'PARTICIPANT_JOINED', { participant: added });

    res.json({ success: true, participant: added, session, participants: store.getParticipants(pin) });
  });

  app.post('/api/quiz/session/:pin/start', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'active';
    session.currentQuestionIndex = 0;
    session.questionStartedAt = Date.now();
    session.questionEndsAt = Date.now() + session.timerSeconds * 1000;

    store.updateSession(session);
    broadcastSessionEvent(pin, 'QUESTION_CHANGED', { currentQuestionIndex: 0 });

    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/next', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentQuestionIndex < session.questionIds.length - 1) {
      session.currentQuestionIndex += 1;
      session.status = 'active';
      session.questionStartedAt = Date.now();
      session.questionEndsAt = Date.now() + session.timerSeconds * 1000;

      store.updateSession(session);
      broadcastSessionEvent(pin, 'QUESTION_CHANGED', { currentQuestionIndex: session.currentQuestionIndex });
      res.json({ success: true, session });
    } else {
      session.status = 'finished';
      session.currentQuestionIndex = session.questionIds.length;
      store.updateSession(session);
      broadcastSessionEvent(pin, 'QUIZ_FINISHED', {});
      res.json({ success: true, finished: true, session });
    }
  });

  app.post('/api/quiz/session/:pin/prev', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentQuestionIndex > 0) {
      session.currentQuestionIndex -= 1;
      session.status = 'active';
      session.questionStartedAt = Date.now();
      session.questionEndsAt = Date.now() + session.timerSeconds * 1000;

      store.updateSession(session);
      broadcastSessionEvent(pin, 'QUESTION_CHANGED', { currentQuestionIndex: session.currentQuestionIndex });
    }
    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/pause', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = session.status === 'paused' ? 'active' : 'paused';
    store.updateSession(session);
    broadcastSessionEvent(pin, 'STATUS_CHANGED', { status: session.status });

    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/stop', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'finished';
    store.updateSession(session);
    broadcastSessionEvent(pin, 'QUIZ_FINISHED', {});

    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/submit-answer', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const { participantId, questionId, answerData, timeTakenMs } = req.body;
    const session = store.getSession(pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const question = store.getQuestion(questionId);
    if (!question) return res.status(400).json({ error: 'Question not found' });

    // Check correctness logic
    let isCorrect = false;

    if (question.type === 'multiple_choice' || question.type === 'true_false' || question.type === 'case_study') {
      const correctOption = question.options?.find((o) => o.isCorrect);
      isCorrect = correctOption ? correctOption.id === answerData : false;
    } else if (question.type === 'multiple_answer') {
      const correctOptionIds = (question.options || []).filter((o) => o.isCorrect).map((o) => o.id);
      const userSelectedIds = Array.isArray(answerData) ? answerData : [];
      isCorrect =
        correctOptionIds.length === userSelectedIds.length &&
        correctOptionIds.every((id) => userSelectedIds.includes(id));
    } else if (question.type === 'short_answer') {
      const correctStr = (question.shortAnswerCorrect || '').trim().toLowerCase();
      const userStr = (String(answerData) || '').trim().toLowerCase();
      isCorrect = correctStr === userStr;
    } else if (question.type === 'ordering') {
      // answerData is array of ordered item IDs
      const correctOrderedIds = [...(question.orderItems || [])]
        .sort((a, b) => a.correctPosition - b.correctPosition)
        .map((item) => item.id);
      isCorrect = JSON.stringify(correctOrderedIds) === JSON.stringify(answerData);
    } else if (question.type === 'matching') {
      // answerData is object map { leftId: rightValue }
      const pairs = question.matchingPairs || [];
      isCorrect = pairs.every((pair) => answerData && answerData[pair.id] === pair.right);
    }

    // Calculate score based on correctness, speed bonus, and streak
    let basePoints = isCorrect ? 1000 : 0;
    let speedBonus = 0;
    if (isCorrect && timeTakenMs && session.timerSeconds) {
      const maxMs = session.timerSeconds * 1000;
      const speedRatio = Math.max(0, (maxMs - timeTakenMs) / maxMs);
      speedBonus = Math.round(speedRatio * 500); // Up to 500 bonus points for speed
    }

    const pointsGained = basePoints + speedBonus;

    const answerRecord: ParticipantAnswer = {
      id: `ans-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionPin: req.params.pin,
      participantId,
      questionId,
      answerData,
      isCorrect,
      pointsGained,
      timeTakenMs: timeTakenMs || 0,
      submittedAt: Date.now(),
    };

    store.submitAnswer(req.params.pin, answerRecord);

    broadcastSessionEvent(req.params.pin, 'ANSWER_SUBMITTED', {
      participantId,
      questionId,
      isCorrect,
      pointsGained,
    });

    res.json({ success: true, isCorrect, pointsGained });
  });

  // SSE Stream endpoint
  app.get('/api/quiz/live-stream/:pin', (req, res) => {
    const pin = req.params.pin;
    const role = (req.query.role as 'host' | 'participant') || 'participant';
    const clientId = `${role}-${Date.now()}-${Math.random()}`;
    registerSSEClient(pin, res, role, clientId);
  });

  // Analytics & Logs
  app.post('/api/quiz/self-exam', (req, res) => {
    try {
      const { nip, participantName, category, score, totalQuestions, correctCount, status, timeSpentSeconds, answers } = req.body;
      
      let formattedDate = '';
      try {
        formattedDate = new Date().toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        formattedDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
      }

      const examSession = {
        id: `self-exam-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nip: nip ? String(nip).trim() : '198503152010121002',
        participantName: participantName || 'Peserta Mandiri',
        category: category ? String(category).trim() : 'Umum',
        quizMode: 'exam' as const,
        score: typeof score === 'number' ? score : 0,
        totalQuestions: totalQuestions || 0,
        correctCount: correctCount || 0,
        status: status || 'LULUS',
        completedAt: formattedDate,
        timeSpentSeconds: timeSpentSeconds || 0,
        answers: Array.isArray(answers) ? answers : [],
      };
      
      store.addSelfExam(examSession);
      console.log('Successfully saved self exam session:', examSession.id, 'NIP:', examSession.nip, 'Category:', examSession.category);
      res.json({ success: true, exam: examSession });
    } catch (err: any) {
      console.error('Failed to save self exam session:', err);
      res.status(500).json({ error: err.message || 'Gagal menyimpan sesi ujian mandiri' });
    }
  });

  app.get('/api/quiz/self-exam', (req, res) => {
    let exams = store.getSelfExams();
    const { nip, category } = req.query;
    
    if (nip && typeof nip === 'string' && nip.trim().length > 0) {
      const trimmedNip = nip.trim().toLowerCase();
      exams = exams.filter((e) => (e.nip || '').trim().toLowerCase() === trimmedNip);
    }
    if (category && typeof category === 'string' && category.trim().length > 0 && category !== 'Semua') {
      const trimmedCat = category.trim().toLowerCase();
      exams = exams.filter((e) => (e.category || '').trim().toLowerCase() === trimmedCat);
    }
    res.json(exams);
  });

  app.get('/api/analytics', (req, res) => {
    res.json(store.getAnalytics());
  });

  app.get('/api/logs', (req, res) => {
    res.json(store.getLogs());
  });

  // Catch unmatched /api/* routes so they return JSON 404 instead of falling through to Vite SPA index.html
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint tidak ditemukan: ${req.originalUrl}` });
  });

  // Global API Error Handler Middleware - Guarantees JSON response on express errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Middleware Error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || 'Terjadi kesalahan internal pada server.',
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
