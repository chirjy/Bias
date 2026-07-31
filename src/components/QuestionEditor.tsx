import React, { useState, useEffect } from 'react';
import { Question, Material, Difficulty, QuestionType } from '../types';
import { ArrowLeft, RefreshCw, Plus, Trash2, Edit2, Check, Sparkles, AlertCircle, HelpCircle, FileCheck, Layers } from 'lucide-react';

interface QuestionEditorProps {
  material: Material;
  onBack: () => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({ material, onBack }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');
  const [selectedType, setSelectedType] = useState<QuestionType | 'all'>('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [material.id]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/material/${material.id}`);
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (updated: Question) => {
    try {
      const res = await fetch('/api/questions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
        setEditingQuestion(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setDeletingQuestion(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateSingle = async (q: Question) => {
    setRegeneratingId(q.id);
    try {
      const res = await fetch('/api/questions/regenerate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (data.question) {
        setQuestions((prev) => prev.map((item) => (item.id === q.id ? data.question : item)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingId(null);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
    if (selectedType !== 'all' && q.type !== selectedType) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Kelola Bank Soal: <span className="text-indigo-400">{material.title}</span>
            </h1>
            <p className="text-xs text-slate-400">
              Total {questions.length} Soal HOTS (20 Mudah, 20 Sedang, 20 Sulit)
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Difficulty filter */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <span className="px-2 text-slate-400">Kesulitan:</span>
            {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${
                  selectedDifficulty === diff
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {diff === 'all' ? 'Semua' : diff}
              </button>
            ))}
          </div>

          {/* Question Type Filter */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <span className="px-2 text-slate-400">Tipe:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="bg-transparent text-slate-200 outline-none pr-2"
            >
              <option value="all" className="bg-slate-900">Semua Tipe (7 Tipe)</option>
              <option value="multiple_choice" className="bg-slate-900">Pilihan Ganda</option>
              <option value="true_false" className="bg-slate-900">Benar / Salah</option>
              <option value="multiple_answer" className="bg-slate-900">Multiple Answer</option>
              <option value="ordering" className="bg-slate-900">Urutan (Ordering)</option>
              <option value="matching" className="bg-slate-900">Pasangan (Matching)</option>
              <option value="short_answer" className="bg-slate-900">Isian Singkat</option>
              <option value="case_study" className="bg-slate-900">Studi Kasus</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-400">
          Menampilkan {filteredQuestions.length} Soal
        </div>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-2" />
          Memuat daftar soal...
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, index) => (
            <div
              key={q.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                    #{index + 1}
                  </span>

                  {/* Difficulty Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      q.difficulty === 'easy'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : q.difficulty === 'medium'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  {/* Type Badge */}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {getTypeLabel(q.type)}
                  </span>

                  {q.bloomTaxonomy && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {q.bloomTaxonomy}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRegenerateSingle(q)}
                    disabled={regeneratingId === q.id}
                    className="p-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 rounded-lg border border-indigo-500/20 flex items-center gap-1 transition-all"
                    title="Regenerate Soal Ini Menggunakan AI"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingId === q.id ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">AI Regenerate</span>
                  </button>
                  <button
                    onClick={() => setEditingQuestion(q)}
                    className="p-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg border border-slate-700 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingQuestion(q)}
                    className="p-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 transition-all"
                    title="Hapus Soal Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Case Study Context if applicable */}
              {q.caseStudyScenario && (
                <div className="mb-3 p-3 bg-slate-800/60 border-l-4 border-indigo-500 rounded-r-xl text-xs text-slate-300 italic">
                  <strong className="text-indigo-400 block mb-1 not-italic">Skenario Studi Kasus:</strong>
                  {q.caseStudyScenario}
                </div>
              )}

              {/* Prompt Text */}
              <p className="text-sm font-semibold text-white mb-3">{q.prompt}</p>

              {/* Choices / Display based on question type */}
              <div className="mb-3">
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          opt.isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium'
                            : 'bg-slate-800/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span>{opt.text}</span>
                        {opt.isCorrect && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'short_answer' && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold">
                    Kunci Jawaban Singkat: "{q.shortAnswerCorrect}"
                  </div>
                )}

                {q.type === 'ordering' && q.orderItems && (
                  <div className="space-y-1.5 text-xs">
                    <p className="text-[11px] text-slate-400 font-medium">Urutan Langkah Benar:</p>
                    {q.orderItems.map((item, idx) => (
                      <div key={item.id} className="p-2 bg-slate-800/60 rounded-lg text-slate-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'matching' && q.matchingPairs && (
                  <div className="space-y-1 text-xs">
                    <p className="text-[11px] text-slate-400 font-medium">Pasangan Benar:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.matchingPairs.map((pair) => (
                        <div key={pair.id} className="p-2 bg-slate-800/60 rounded-lg border border-slate-700/60 flex items-center justify-between text-slate-300">
                          <span className="font-semibold text-indigo-300">{pair.left}</span>
                          <span className="text-slate-400">➔ {pair.right}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Explanation */}
              <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-300">Penjelasan:</strong> {q.explanation}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onSave={handleSaveQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {/* Delete Question Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Hapus Soal</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
              Apakah Anda yakin ingin menghapus soal berikut?
              <span className="block font-semibold text-white mt-2 italic">"{deletingQuestion.prompt}"</span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingQuestion(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteQuestion(deletingQuestion.id)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Ya, Hapus Soal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getTypeLabel(type: QuestionType): string {
  switch (type) {
    case 'multiple_choice':
      return 'Pilihan Ganda';
    case 'true_false':
      return 'Benar / Salah';
    case 'multiple_answer':
      return 'Multiple Answer';
    case 'ordering':
      return 'Urutan';
    case 'matching':
      return 'Pasangan';
    case 'short_answer':
      return 'Isian Singkat';
    case 'case_study':
      return 'Studi Kasus';
    default:
      return type;
  }
}

interface EditQuestionModalProps {
  question: Question;
  onSave: (q: Question) => void;
  onClose: () => void;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onSave, onClose }) => {
  const [prompt, setPrompt] = useState(question.prompt);
  const [explanation, setExplanation] = useState(question.explanation);
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...question,
      prompt,
      explanation,
      difficulty,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-white shadow-2xl">
        <h3 className="text-lg font-bold mb-4">Edit Soal #{question.id}</h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Pertanyaan Soal</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Tingkat Kesulitan</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none"
            >
              <option value="easy">Easy (Mudah)</option>
              <option value="medium">Medium (Sedang)</option>
              <option value="hard">Hard (Sulit)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Penjelasan Jawaban</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/30"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
