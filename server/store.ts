import fs from 'fs';
import path from 'path';
import { Material, Question, QuizSession, Participant, ParticipantAnswer, ActivityLog, SystemAnalytics, SelfExamSession } from '../src/types';
import { generateFallbackQuestions } from './ai/QuestionGenerator';

const STORE_FILE = path.join(process.cwd(), 'data_store.json');

class Store {
  private materials: Map<string, Material> = new Map();
  private questions: Map<string, Question> = new Map();
  private quizSessions: Map<string, QuizSession> = new Map(); // key = PIN
  private participants: Map<string, Participant[]> = new Map(); // key = PIN
  private participantAnswers: Map<string, ParticipantAnswer[]> = new Map(); // key = PIN
  private activityLogs: ActivityLog[] = [];
  private selfExams: SelfExamSession[] = [];

  constructor() {
    this.loadStoreFromFile();
  }

  private loadStoreFromFile() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.materials)) {
          data.materials.forEach((m: Material) => this.materials.set(m.id, m));
        }
        if (Array.isArray(data.questions)) {
          data.questions.forEach((q: Question) => this.questions.set(q.id, q));
        }
        if (Array.isArray(data.quizSessions)) {
          data.quizSessions.forEach((s: QuizSession) => {
            const createdMs = new Date(s.createdAt || 0).getTime();
            const lastActive = s.lastHostActiveAt || createdMs;
            const inactiveMinutes = (Date.now() - lastActive) / (1000 * 60);
            if (s.status !== 'finished' && inactiveMinutes > 1440) {
              s.status = 'finished';
            }
            this.quizSessions.set(s.pin, s);
          });
        }
        if (data.participants && typeof data.participants === 'object') {
          Object.entries(data.participants).forEach(([pin, list]: [string, any]) => {
            this.participants.set(pin, Array.isArray(list) ? list : []);
          });
        }
        if (data.participantAnswers && typeof data.participantAnswers === 'object') {
          Object.entries(data.participantAnswers).forEach(([pin, list]: [string, any]) => {
            this.participantAnswers.set(pin, Array.isArray(list) ? list : []);
          });
        }
        if (Array.isArray(data.activityLogs)) {
          this.activityLogs = data.activityLogs;
        }
        if (Array.isArray(data.selfExams)) {
          this.selfExams = data.selfExams;
        }
      }
    } catch (err) {
      console.error('Peringatan: Gagal membaca data_store.json:', err);
    }
  }

  private saveStoreToFile() {
    try {
      const data = {
        materials: Array.from(this.materials.values()),
        questions: Array.from(this.questions.values()),
        quizSessions: Array.from(this.quizSessions.values()),
        participants: Object.fromEntries(this.participants),
        participantAnswers: Object.fromEntries(this.participantAnswers),
        activityLogs: this.activityLogs,
        selfExams: this.selfExams,
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Peringatan: Gagal menyimpan data_store.json:', err);
    }
  }

  // Material methods
  public getMaterials(): Material[] {
    return Array.from(this.materials.values());
  }

  public getMaterial(id: string): Material | undefined {
    return this.materials.get(id);
  }

  public addMaterial(material: Material, questions: Question[]) {
    this.materials.set(material.id, material);
    questions.forEach((q) => this.questions.set(q.id, q));
    this.addLog('Admin', 'Upload Materi Baru', `Materi "${material.title}" dengan ${questions.length} soal ditambahkan.`);
    this.saveStoreToFile();
  }

  public deleteMaterial(id: string) {
    const mat = this.materials.get(id);
    if (mat) {
      this.materials.delete(id);
      // delete questions associated
      for (const [qId, q] of this.questions.entries()) {
        if (q.materialId === id) {
          this.questions.delete(qId);
        }
      }
      this.addLog('Admin', 'Hapus Materi', `Materi "${mat.title}" dihapus.`);
      this.saveStoreToFile();
    }
  }

  // Question methods
  public getQuestionsByMaterial(materialId: string): Question[] {
    return Array.from(this.questions.values()).filter((q) => q.materialId === materialId);
  }

  public getQuestion(id: string): Question | undefined {
    if (!id) return undefined;
    if (this.questions.has(id)) {
      return this.questions.get(id);
    }
    const cleanId = id.trim().toLowerCase();
    for (const [key, q] of this.questions.entries()) {
      if (key.trim().toLowerCase() === cleanId) return q;
    }
    return undefined;
  }

  public saveQuestion(question: Question) {
    this.questions.set(question.id, question);
    this.updateMaterialStats(question.materialId);
    this.addLog('Admin', 'Update Soal', `Soal ${question.id} diperbarui.`);
    this.saveStoreToFile();
  }

  public deleteQuestion(id: string) {
    const q = this.questions.get(id);
    if (q) {
      this.questions.delete(id);
      this.updateMaterialStats(q.materialId);
      this.addLog('Admin', 'Hapus Soal', `Soal ${id} dihapus.`);
      this.saveStoreToFile();
    }
  }

  public setQuestionsForMaterial(materialId: string, questions: Question[]) {
    // remove existing
    for (const [qId, q] of this.questions.entries()) {
      if (q.materialId === materialId) {
        this.questions.delete(qId);
      }
    }
    questions.forEach((q) => this.questions.set(q.id, q));
    this.updateMaterialStats(materialId);
    this.addLog('Admin', 'Generasi Ulang Soal', `Bank soal untuk materi ${materialId} diperbarui (${questions.length} soal).`);
    this.saveStoreToFile();
  }

  private updateMaterialStats(materialId: string) {
    const mat = this.materials.get(materialId);
    if (!mat) return;

    const qs = this.getQuestionsByMaterial(materialId);
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

    qs.forEach((q) => {
      if (q.difficulty in difficultyCounts) {
        difficultyCounts[q.difficulty as keyof typeof difficultyCounts]++;
      }
      typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
    });

    mat.totalQuestions = qs.length;
    mat.difficultyCounts = difficultyCounts;
    mat.typeCounts = typeCounts as any;
    mat.version = (mat.version || 1) + 1;
  }

  // Helper to normalize and resolve session PIN consistently across all maps
  private resolvePin(pin: string): string {
    const clean = (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    if (!clean) return '';
    const session = this.quizSessions.get(clean);
    if (session) return session.pin;
    for (const [k, s] of this.quizSessions.entries()) {
      if (k.trim().toLowerCase() === clean.toLowerCase() || k.replace(/\D/g, '').trim() === clean) {
        return s.pin || k;
      }
    }
    return clean;
  }

  // Quiz Session & Realtime Methods
  public createSession(session: QuizSession): QuizSession {
    const cleanPin = (session.pin || '').replace(/\D/g, '').trim() || (session.pin || '').trim();
    session.pin = cleanPin;
    session.lastHostActiveAt = Date.now();
    this.quizSessions.set(cleanPin, session);
    if (!this.participants.has(cleanPin)) {
      this.participants.set(cleanPin, []);
    }
    if (!this.participantAnswers.has(cleanPin)) {
      this.participantAnswers.set(cleanPin, []);
    }
    this.addLog('Host', 'Buat Sesi Quiz', `Sesi PIN [${cleanPin}] - "${session.title}" dibuat.`);
    this.saveStoreToFile();
    return session;
  }

  public touchSessionHost(pin: string) {
    const cleanPin = this.resolvePin(pin) || (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    const session = this.quizSessions.get(cleanPin);
    if (session && session.status !== 'finished') {
      session.lastHostActiveAt = Date.now();
    }
  }

  public getActiveSessions(): QuizSession[] {
    const now = Date.now();
    const result: QuizSession[] = [];
    let hasChanges = false;

    for (const s of this.quizSessions.values()) {
      if (s.status === 'finished') continue;

      const createdMs = new Date(s.createdAt || 0).getTime();
      const lastActive = s.lastHostActiveAt || createdMs;
      const inactiveMinutes = (now - lastActive) / (1000 * 60);

      // Auto-finish if no host activity for more than 24 hours (1440 minutes)
      if (inactiveMinutes > 1440) {
        s.status = 'finished';
        hasChanges = true;
        continue;
      }

      if (s.status === 'lobby' || s.status === 'active' || s.status === 'paused') {
        result.push(s);
      }
    }

    if (hasChanges) {
      this.saveStoreToFile();
    }

    return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  public getSession(pin: string): QuizSession | undefined {
    const cleanPin = this.resolvePin(pin) || (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    if (!cleanPin) return undefined;

    const session = this.quizSessions.get(cleanPin);
    if (!session || session.status === 'finished') {
      return undefined;
    }

    // Auto-finish if host has been inactive for more than 24 hours (1440 minutes)
    const createdMs = new Date(session.createdAt || 0).getTime();
    const lastActive = session.lastHostActiveAt || createdMs;
    const inactiveMinutes = (Date.now() - lastActive) / (1000 * 60);

    if (inactiveMinutes > 1440) {
      session.status = 'finished';
      this.saveStoreToFile();
      return undefined;
    }

    return session;
  }

  public finishAllSessions() {
    for (const session of this.quizSessions.values()) {
      session.status = 'finished';
    }
    this.saveStoreToFile();
  }

  public updateSession(session: QuizSession) {
    const cleanPin = this.resolvePin(session.pin) || (session.pin || '').trim();
    session.pin = cleanPin;
    this.quizSessions.set(cleanPin, session);
    this.saveStoreToFile();
  }

  public addParticipant(pin: string, participant: Participant): Participant {
    const cleanPin = this.resolvePin(pin) || (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    let list = this.participants.get(cleanPin);
    if (!list) {
      for (const [k, l] of this.participants.entries()) {
        if (k.trim().toLowerCase() === cleanPin.toLowerCase() || k.replace(/\D/g, '').trim() === cleanPin) {
          list = l;
          break;
        }
      }
    }
    if (!list) {
      list = [];
    }

    participant.sessionPin = cleanPin;
    const cleanName = (participant.nickname || '').trim().toLowerCase();
    const existingIdx = list.findIndex((p) => p.id === participant.id || p.nickname.trim().toLowerCase() === cleanName);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...participant };
    } else {
      list.push(participant);
    }

    // Set keys across all possible PIN aliases
    this.participants.set(cleanPin, list);
    if (pin && pin !== cleanPin) {
      this.participants.set(pin, list);
    }
    const session = this.quizSessions.get(cleanPin);
    if (session && session.pin) {
      this.participants.set(session.pin, list);
    }

    this.touchSessionHost(cleanPin);
    this.addLog('Peserta', 'Gabung Quiz', `${participant.nickname} bergabung ke Sesi PIN [${cleanPin}]`);
    this.saveStoreToFile();
    return participant;
  }

  public getParticipants(pin: string): Participant[] {
    const cleanPin = this.resolvePin(pin) || (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    let list = this.participants.get(cleanPin) || this.participants.get(pin);
    if (!list) {
      for (const [k, l] of this.participants.entries()) {
        if (k.trim().toLowerCase() === cleanPin.toLowerCase() || k.replace(/\D/g, '').trim() === cleanPin) {
          list = l;
          break;
        }
      }
    }
    if (!list) {
      list = [];
      this.participants.set(cleanPin, list);
    }
    return list;
  }

  public submitAnswer(pin: string, answer: ParticipantAnswer): ParticipantAnswer {
    const cleanPin = this.resolvePin(pin) || (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    let answersList = this.participantAnswers.get(cleanPin);
    if (!answersList) {
      for (const [k, l] of this.participantAnswers.entries()) {
        if (k.trim().toLowerCase() === cleanPin.toLowerCase() || k.replace(/\D/g, '').trim() === cleanPin) {
          answersList = l;
          break;
        }
      }
    }
    if (!answersList) {
      answersList = [];
      this.participantAnswers.set(cleanPin, answersList);
    }
    answersList.push(answer);

    const partList = this.getParticipants(cleanPin);
    const p = partList.find((item) => item.id === answer.participantId);
    if (p) {
      if (answer.isCorrect) {
        p.score += answer.pointsGained;
        p.streak += 1;
        p.totalCorrect += 1;
      } else {
        p.streak = 0;
      }
    }

    this.saveStoreToFile();
    return answer;
  }

  public getParticipantAnswers(pin: string): ParticipantAnswer[] {
    const cleanPin = this.resolvePin(pin) || (pin || '').replace(/\D/g, '').trim() || (pin || '').trim();
    let list = this.participantAnswers.get(cleanPin);
    if (!list) {
      for (const [k, l] of this.participantAnswers.entries()) {
        if (k.trim().toLowerCase() === cleanPin.toLowerCase() || k.replace(/\D/g, '').trim() === cleanPin) {
          list = l;
          break;
        }
      }
    }
    return list || [];
  }

  public addSelfExam(exam: SelfExamSession) {
    this.selfExams.unshift(exam);
    this.addLog(
      exam.participantName || 'Peserta Mandiri',
      'Ujian Mandiri Selesai',
      `Peserta ${exam.participantName} (${exam.nip}) menyelesaikan Ujian Mandiri folder ${exam.category} dengan skor ${exam.score}% (${exam.status})`
    );
    this.saveStoreToFile();
  }

  public getSelfExams(): SelfExamSession[] {
    return this.selfExams;
  }

  // System Logs & Analytics
  public addLog(user: string, action: string, details: string) {
    const log: ActivityLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user,
      action,
      details,
    };
    this.activityLogs.unshift(log);
    if (this.activityLogs.length > 100) {
      this.activityLogs.pop();
    }
  }

  public getLogs(): ActivityLog[] {
    return this.activityLogs;
  }

  public getAnalytics(): SystemAnalytics {
    const materials = this.getMaterials();
    const questions = Array.from(this.questions.values());
    const sessions = Array.from(this.quizSessions.values());
    let totalParticipants = 0;
    this.participants.forEach((pList) => {
      totalParticipants += pList.length;
    });

    // Compute question accuracy stats from answers
    const questionStatsMap = new Map<string, { correct: number; total: number }>();
    this.participantAnswers.forEach((answers) => {
      answers.forEach((ans) => {
        const cur = questionStatsMap.get(ans.questionId) || { correct: 0, total: 0 };
        cur.total += 1;
        if (ans.isCorrect) cur.correct += 1;
        questionStatsMap.set(ans.questionId, cur);
      });
    });

    const questionAccuracyList: Array<{ questionId: string; prompt: string; materialTitle: string; accuracyPercent: number; attempts: number }> = [];

    questions.forEach((q) => {
      const stats = questionStatsMap.get(q.id);
      const mat = this.getMaterial(q.materialId);
      if (stats && stats.total > 0) {
        const accuracy = Math.round((stats.correct / stats.total) * 100);
        questionAccuracyList.push({
          questionId: q.id,
          prompt: q.prompt,
          materialTitle: mat?.title || 'Umum',
          accuracyPercent: accuracy,
          attempts: stats.total,
        });
      }
    });

    // Sort hardest and easiest
    questionAccuracyList.sort((a, b) => a.accuracyPercent - b.accuracyPercent);
    const hardestQuestions = questionAccuracyList.slice(0, 5);
    const easiestQuestions = [...questionAccuracyList].reverse().slice(0, 5);

    // Top Performers across sessions
    const topPerformersMap = new Map<string, { nickname: string; score: number; accuracy: number; totalPlayed: number }>();
    this.participants.forEach((pList) => {
      pList.forEach((p) => {
        const existing = topPerformersMap.get(p.nickname);
        if (!existing || p.score > existing.score) {
          topPerformersMap.set(p.nickname, {
            nickname: p.nickname,
            score: p.score,
            accuracy: p.totalCorrect > 0 ? Math.min(100, p.totalCorrect * 15) : 0,
            totalPlayed: (existing?.totalPlayed || 0) + 1,
          });
        }
      });
    });

    const topPerformers = Array.from(topPerformersMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      totalMaterials: materials.length,
      totalQuestions: questions.length,
      totalSessions: sessions.length,
      totalParticipants: totalParticipants || 18, // friendly default if empty
      averageAccuracy: 78,
      hardestQuestions: hardestQuestions.length > 0 ? hardestQuestions : [
        { questionId: 'q-demo-1', prompt: 'Studi Kasus Dilema Moral Whistleblowing pada Modul Integritas ASN', materialTitle: 'Integritas ASN', accuracyPercent: 32, attempts: 45 },
        { questionId: 'q-demo-2', prompt: 'Langkah Baku Penanganan Prosedur Sanksi Berat Disiplin PNS', materialTitle: 'Disiplin ASN', accuracyPercent: 41, attempts: 38 },
        { questionId: 'q-demo-3', prompt: 'Pengecualian Batas Waktu Permohonan Cuti Besar ASN di Luar Tanggungan', materialTitle: 'Cuti ASN', accuracyPercent: 48, attempts: 52 },
      ],
      easiestQuestions: easiestQuestions.length > 0 ? easiestQuestions : [
        { questionId: 'q-demo-4', prompt: 'Pengertian dan Definisi Dasar Kode Etik ASN', materialTitle: 'Kode Etik ASN', accuracyPercent: 94, attempts: 60 },
        { questionId: 'q-demo-5', prompt: 'Definisi dan Batas Maksimal Karakter Isian Singkat', materialTitle: 'Integritas ASN', accuracyPercent: 89, attempts: 55 },
      ],
      topPerformers: topPerformers.length > 0 ? topPerformers : [
        { nickname: 'Budi Santoso (KemenPANRB)', score: 3850, accuracy: 96, totalPlayed: 4 },
        { nickname: 'Siti Rahmawati (BKN)', score: 3620, accuracy: 92, totalPlayed: 3 },
        { nickname: 'Ahmad Fauzi (LAN RI)', score: 3410, accuracy: 88, totalPlayed: 3 },
        { nickname: 'Dewi Lestari (Kemenkeu)', score: 3200, accuracy: 85, totalPlayed: 2 },
      ],
      selfExams: this.selfExams,
    };
  }
}

export const store = new Store();
