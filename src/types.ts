export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'multiple_answer'
  | 'ordering'
  | 'matching'
  | 'short_answer'
  | 'case_study';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface OrderItem {
  id: string;
  text: string;
  correctPosition: number;
}

export interface Question {
  id: string;
  materialId: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  caseStudyScenario?: string;
  options?: QuestionOption[];
  matchingPairs?: MatchingPair[];
  orderItems?: OrderItem[];
  shortAnswerCorrect?: string;
  explanation: string;
  tags?: string[];
  bloomTaxonomy?: string;
  regulationRef?: string;
  createdAt: string;
}

export interface Material {
  id: string;
  title: string;
  category: string;
  filename: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'txt';
  uploadedAt: string;
  summary: string;
  keyConcepts: string[];
  regulations: string[];
  totalQuestions: number;
  difficultyCounts: {
    easy: number;
    medium: number;
    hard: number;
  };
  typeCounts: Record<QuestionType, number>;
  version: number;
}

export type GameMode = 'quiz' | 'exam' | 'training' | 'ice_breaking';

export interface QuizSession {
  id: string;
  pin: string;
  hostId: string;
  title: string;
  materialIds: string[];
  gameMode: GameMode;
  timerSeconds: number;
  questionIds: string[];
  currentQuestionIndex: number; // -1 = lobby, 0..N-1 = active question, N = completed
  status: 'lobby' | 'active' | 'paused' | 'finished';
  questionStartedAt?: number;
  questionEndsAt?: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  createdAt: string;
  lastHostActiveAt?: number;
}

export interface Participant {
  id: string;
  sessionPin: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  totalCorrect: number;
  joinedAt: string;
}

export interface ParticipantAnswer {
  id: string;
  sessionPin: string;
  participantId: string;
  questionId: string;
  answerData: any; // string, string[], pair map, array order
  isCorrect: boolean;
  pointsGained: number;
  timeTakenMs: number;
  submittedAt: number;
}

export interface SelfExamSession {
  id: string;
  nip: string;
  participantName: string;
  category: string;
  quizMode: 'exam';
  score: number; // percentage (0-100)
  totalQuestions: number;
  correctCount: number;
  status: 'LULUS' | 'TIDAK LULUS';
  completedAt: string;
  timeSpentSeconds: number;
  answers?: Array<{
    questionId: string;
    prompt: string;
    isCorrect: boolean;
    userAnswerText: string;
    correctAnswerText: string;
    explanation?: string;
  }>;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
}

export interface SystemAnalytics {
  totalMaterials: number;
  totalQuestions: number;
  totalSessions: number;
  totalParticipants: number;
  averageAccuracy: number;
  hardestQuestions: Array<{
    questionId: string;
    prompt: string;
    materialTitle: string;
    accuracyPercent: number;
    attempts: number;
  }>;
  easiestQuestions: Array<{
    questionId: string;
    prompt: string;
    materialTitle: string;
    accuracyPercent: number;
    attempts: number;
  }>;
  topPerformers: Array<{
    nickname: string;
    score: number;
    accuracy: number;
    totalPlayed: number;
  }>;
  selfExams?: SelfExamSession[];
}
