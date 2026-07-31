import React, { useState } from 'react';
import { Material, GameMode, QuizSession } from '../types';
import { Play, Sparkles, Clock, Shuffle, CheckCircle2, QrCode, Copy, ArrowRight, Shield } from 'lucide-react';

interface HostLobbyProps {
  materials: Material[];
  initialMaterial?: Material;
  onSessionCreated: (session: QuizSession) => void;
  onCancel: () => void;
}

export const HostLobby: React.FC<HostLobbyProps> = ({
  materials,
  initialMaterial,
  onSessionCreated,
  onCancel,
}) => {
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(
    initialMaterial ? [initialMaterial.id] : materials.length > 0 ? [materials[0].id] : []
  );
  const [title, setTitle] = useState<string>(
    initialMaterial ? `Live Quiz: ${initialMaterial.title}` : 'Sesi Live Quiz Interaktif'
  );
  const [gameMode, setGameMode] = useState<GameMode>('quiz');
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [questionLimit, setQuestionLimit] = useState<number>(20);
  const [randomizeQuestions, setRandomizeQuestions] = useState<boolean>(true);
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const toggleMaterial = (id: string) => {
    if (selectedMaterialIds.includes(id)) {
      if (selectedMaterialIds.length > 1) {
        setSelectedMaterialIds(selectedMaterialIds.filter((item) => item !== id));
      }
    } else {
      setSelectedMaterialIds([...selectedMaterialIds, id]);
    }
  };

  const handleCreate = async () => {
    if (selectedMaterialIds.length === 0) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/quiz/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          materialIds: selectedMaterialIds,
          gameMode,
          timerSeconds,
          questionLimit,
          randomizeQuestions,
          randomizeOptions,
        }),
      });

      const data = await res.json();
      if (data.session) {
        onSessionCreated(data.session);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-slate-100">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Play className="w-6 h-6 fill-current" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Konfigurasi Host Mode Live Quiz</h2>
            <p className="text-sm text-slate-400">
              Atur parameter sesi permainan Mentimeter interaktif untuk peserta
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Judul Sesi Quiz</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none"
              placeholder="Contoh: Evaluasi Pemahaman Disiplin & Integritas ASN"
            />
          </div>

          {/* Material Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Pilih Bank Soal Materi (Bisa Lebih Dari Satu):
              </label>
              <span className="text-[11px] text-indigo-400 font-medium">
                {selectedMaterialIds.length} Materi Terpilih
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>
                <strong>Representasi Adil:</strong> Setiap materi yang dipilih dijamin akan diambil soalnya secara proporsional ke dalam quiz.
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {materials.map((mat) => {
                const isSelected = selectedMaterialIds.includes(mat.id);
                return (
                  <div
                    key={mat.id}
                    onClick={() => toggleMaterial(mat.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-200">{mat.title}</p>
                      <p className="text-[10px] text-slate-400">{mat.totalQuestions || 60} Soal Tersedia</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Game Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mode Permainan:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { mode: 'quiz', label: 'Quiz Mode', desc: 'Standar Mentimeter / Kahoot' },
                { mode: 'exam', label: 'Exam Mode', desc: 'Ujian tanpa skor langsung' },
                { mode: 'training', label: 'Training Mode', desc: 'Penjelasan lengkap per soal' },
                { mode: 'ice_breaking', label: 'Ice Breaking', desc: 'Cepat & Interaktif' },
              ].map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setGameMode(item.mode as GameMode)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    gameMode === item.mode
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="font-bold">{item.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timer and Question Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Alokasi Waktu per Soal:
              </label>
              <select
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none"
              >
                <option value={15}>15 Detik (Sangat Cepat)</option>
                <option value={20}>20 Detik</option>
                <option value={30}>30 Detik (Rekomendasi Standar)</option>
                <option value={60}>60 Detik (Studi Kasus)</option>
                <option value={120}>120 Detik (Soal Analisis Kompleks)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Jumlah Soal Tampil:</label>
              <select
                value={questionLimit}
                onChange={(e) => setQuestionLimit(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none"
              >
                <option value={10}>10 Soal (Singkat)</option>
                <option value={20}>20 Soal (Standar)</option>
                <option value={30}>30 Soal (Lengkap)</option>
                <option value={60}>60 Soal (Seluruh Bank Soal)</option>
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-6 p-4 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeQuestions}
                onChange={(e) => setRandomizeQuestions(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
              <span className="text-slate-200 font-semibold">Acak Urutan Soal</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeOptions}
                onChange={(e) => setRandomizeOptions(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
              <span className="text-slate-200 font-semibold">Acak Pilihan Jawaban</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              {isSubmitting ? 'Membuat PIN Sesi...' : 'Mulai Sesi & Dapatkan PIN 6 Digit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
