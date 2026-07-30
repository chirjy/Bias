import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { store } from './server/store';
import { registerSSEClient, broadcastSessionEvent } from './server/realtime';
import { parseDocumentBuffer } from './server/ai/DocumentReader';
import { generateMaterialSummary } from './server/ai/SummaryGenerator';
import { generateQuestionBank, regenerateSingleQuestion } from './server/ai/QuestionGenerator';
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
      const { fileName, fileType, fileBase64 } = req.body;
      if (!fileName || !fileBase64) {
        return res.status(400).json({ error: 'Filename and base64 file content are required' });
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      const parsedDoc = parseDocumentBuffer(fileName, fileType || 'pptx', buffer);

      const materialId = `mat-${Date.now()}`;

      // 1. Generate Summary & Key Concepts via Gemini AI
      const summaryResult = await generateMaterialSummary(parsedDoc.title, parsedDoc.rawText);

      // 2. Generate Question Bank (20 Easy, 20 Medium, 20 Hard across 7 types) via Gemini AI
      const questions = await generateQuestionBank({
        materialId,
        materialTitle: parsedDoc.title,
        rawText: parsedDoc.rawText,
        countEasy: 20,
        countMedium: 20,
        countHard: 20,
      });

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

      const newMaterial: Material = {
        id: materialId,
        title: parsedDoc.title,
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

    // Gather question IDs from selected materials
    let allQuestionIds: string[] = [];
    (materialIds || []).forEach((matId: string) => {
      const qs = store.getQuestionsByMaterial(matId);
      qs.forEach((q) => allQuestionIds.push(q.id));
    });

    if (randomizeQuestions) {
      allQuestionIds.sort(() => Math.random() - 0.5);
    }

    if (questionLimit && questionLimit > 0) {
      allQuestionIds = allQuestionIds.slice(0, questionLimit);
    }

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

  app.get('/api/quiz/session/:pin', (req, res) => {
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'Sesi quiz tidak ditemukan' });

    // Fetch question objects
    const currentQuestionObj =
      session.currentQuestionIndex >= 0 && session.currentQuestionIndex < session.questionIds.length
        ? store.getQuestion(session.questionIds[session.currentQuestionIndex])
        : null;

    const participants = store.getParticipants(req.params.pin);
    const answers = store.getParticipantAnswers(req.params.pin);

    res.json({
      session,
      currentQuestion: currentQuestionObj,
      totalQuestions: session.questionIds.length,
      participants,
      answersCount: answers.length,
    });
  });

  app.post('/api/quiz/session/:pin/join', (req, res) => {
    const { nickname, avatar } = req.body;
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'PIN Quiz tidak valid' });

    const participant: Participant = {
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionPin: req.params.pin,
      nickname: nickname || `Peserta ${Math.floor(Math.random() * 100)}`,
      avatar: avatar || '😊',
      score: 0,
      streak: 0,
      totalCorrect: 0,
      joinedAt: new Date().toISOString(),
    };

    const added = store.addParticipant(req.params.pin, participant);
    broadcastSessionEvent(req.params.pin, 'PARTICIPANT_JOINED', { participant: added });

    res.json({ success: true, participant: added, session });
  });

  app.post('/api/quiz/session/:pin/start', (req, res) => {
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'active';
    session.currentQuestionIndex = 0;
    session.questionStartedAt = Date.now();
    session.questionEndsAt = Date.now() + session.timerSeconds * 1000;

    store.updateSession(session);
    broadcastSessionEvent(req.params.pin, 'QUESTION_CHANGED', { currentQuestionIndex: 0 });

    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/next', (req, res) => {
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentQuestionIndex < session.questionIds.length - 1) {
      session.currentQuestionIndex += 1;
      session.status = 'active';
      session.questionStartedAt = Date.now();
      session.questionEndsAt = Date.now() + session.timerSeconds * 1000;

      store.updateSession(session);
      broadcastSessionEvent(req.params.pin, 'QUESTION_CHANGED', { currentQuestionIndex: session.currentQuestionIndex });
      res.json({ success: true, session });
    } else {
      session.status = 'finished';
      session.currentQuestionIndex = session.questionIds.length;
      store.updateSession(session);
      broadcastSessionEvent(req.params.pin, 'QUIZ_FINISHED', {});
      res.json({ success: true, finished: true, session });
    }
  });

  app.post('/api/quiz/session/:pin/prev', (req, res) => {
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentQuestionIndex > 0) {
      session.currentQuestionIndex -= 1;
      session.status = 'active';
      session.questionStartedAt = Date.now();
      session.questionEndsAt = Date.now() + session.timerSeconds * 1000;

      store.updateSession(session);
      broadcastSessionEvent(req.params.pin, 'QUESTION_CHANGED', { currentQuestionIndex: session.currentQuestionIndex });
    }
    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/pause', (req, res) => {
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = session.status === 'paused' ? 'active' : 'paused';
    store.updateSession(session);
    broadcastSessionEvent(req.params.pin, 'STATUS_CHANGED', { status: session.status });

    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/stop', (req, res) => {
    const session = store.getSession(req.params.pin);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'finished';
    store.updateSession(session);
    broadcastSessionEvent(req.params.pin, 'QUIZ_FINISHED', {});

    res.json({ success: true, session });
  });

  app.post('/api/quiz/session/:pin/submit-answer', (req, res) => {
    const { participantId, questionId, answerData, timeTakenMs } = req.body;
    const session = store.getSession(req.params.pin);
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
  app.get('/api/analytics', (req, res) => {
    res.json(store.getAnalytics());
  });

  app.get('/api/logs', (req, res) => {
    res.json(store.getLogs());
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
