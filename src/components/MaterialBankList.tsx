import React, { useState } from 'react';
import { Material } from '../types';
import { FileText, Play, Edit3, RefreshCw, Download, Trash2, Sparkles, BookOpen, Layers } from 'lucide-react';

interface MaterialBankListProps {
  materials: Material[];
  onSelectMaterial: (material: Material) => void;
  onLaunchHostSession: (material: Material) => void;
  onRegenerateBank: (materialId: string) => void;
  onDeleteMaterial: (materialId: string) => void;
  onExportMaterial: (material: Material) => void;
  onOpenUpload: () => void;
}

export const MaterialBankList: React.FC<MaterialBankListProps> = ({
  materials,
  onSelectMaterial,
  onLaunchHostSession,
  onRegenerateBank,
  onDeleteMaterial,
  onExportMaterial,
  onOpenUpload,
}) => {
  const [loadingRegenId, setLoadingRegenId] = useState<string | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  const handleRegen = async (id: string) => {
    setLoadingRegenId(id);
    await onRegenerateBank(id);
    setLoadingRegenId(null);
  };

  const categories = ['Semua', ...Array.from(new Set(materials.map((m) => m.category || 'Umum')))];

  const filteredMaterials = selectedCategory === 'Semua'
    ? materials
    : materials.filter((m) => (m.category || 'Umum') === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-white">Bank Soal Per Kategori Materi</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {materials.length} Bank Terpisah
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Setiap file yang diupload dipisah berdasar kategori dan dibuatkan Bank Soal otomatis khusus mengacu pada materi.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all flex-shrink-0"
        >
          <Sparkles className="w-4 h-4 text-indigo-300" /> Upload Materi Baru
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1 flex-shrink-0">
          Filter Kategori:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {cat} {cat !== 'Semua' && `(${materials.filter((m) => (m.category || 'Umum') === cat).length})`}
          </button>
        ))}
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMaterials.map((mat) => {
          const isRegening = loadingRegenId === mat.id;

          return (
            <div
              key={mat.id}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all group hover:shadow-2xl hover:shadow-indigo-500/10"
            >
              <div>
                {/* Header Title & Format */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
                        Kategori Materi
                      </span>
                      <h3 className="font-extrabold text-base text-white line-clamp-1">
                        {mat.category || 'Umum'}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium line-clamp-1 mt-0.5">
                        {mat.title} <span className="text-slate-500 font-mono">({mat.filename})</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-800 text-slate-300 border border-slate-700 flex-shrink-0">
                    {mat.fileType}
                  </span>
                </div>

                {/* Summary / Concept snippet */}
                <p className="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  {mat.summary}
                </p>

                {/* Difficulty Badges */}
                <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    20 Mudah
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    20 Sedang
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    20 Sulit
                  </span>
                </div>

                {/* Question Types Count Badges */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" /> {mat.totalQuestions || 60} Soal Total
                  </span>
                  {mat.regulations?.[0] && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 line-clamp-1 max-w-[180px]">
                      {mat.regulations[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onLaunchHostSession(mat)}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Host Live
                  </button>

                  <button
                    onClick={() => onSelectMaterial(mat)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Kelola Soal
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                  <button
                    onClick={() => handleRegen(mat.id)}
                    disabled={isRegening}
                    className="flex items-center gap-1 hover:text-indigo-400 transition-colors py-1 px-2 rounded hover:bg-slate-800"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegening ? 'animate-spin text-indigo-400' : ''}`} />
                    {isRegening ? 'Generating...' : 'Regenerate AI'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onExportMaterial(mat)}
                      className="p-1.5 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                      title="Export Soal JSON/CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingMaterial(mat)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Hapus Bank Soal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Hapus Bank Soal</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
              Apakah Anda yakin ingin menghapus bank soal <strong className="text-white">"{deletingMaterial.title}"</strong> beserta seluruh <strong className="text-white">{deletingMaterial.totalQuestions || 60} soal</strong> di dalamnya?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingMaterial(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const id = deletingMaterial.id;
                  setDeletingMaterial(null);
                  onDeleteMaterial(id);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Ya, Hapus Bank Soal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
