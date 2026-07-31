import React, { useState } from 'react';
import { UploadCloud, Sparkles, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, X, FolderPlus, Tag } from 'lucide-react';
import { Material } from '../types';

interface MaterialUploaderProps {
  onUploadSuccess: (material: Material) => void;
  onCancel?: () => void;
}

export const MaterialUploader: React.FC<MaterialUploaderProps> = ({ onUploadSuccess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<string>('Integritas & Etika');
  const [isUploading, setIsUploading] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const presetCategories = [
    'Integritas & Etika',
    'Disiplin PNS',
    'Core Values ASN',
    'Pelayanan Publik',
    'SOP Organisasi',
    'Manajemen Kepegawaian',
    'Hukum & Regulasi',
    'Teknis Operasional',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...dropped]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = () => reject(new Error(`Gagal membaca berkas ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  const processUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    let lastUploadedMaterial: Material | null = null;

    try {
      for (let i = 0; i < files.length; i++) {
        const currentFile = files[i];
        setCurrentProcessingIndex(i);
        setCurrentStep(1); // Reading

        const base64Content = await readFileAsBase64(currentFile);

        setCurrentStep(2); // AI Analysis

        await new Promise((r) => setTimeout(r, 600));
        setCurrentStep(3); // Question Generation

        const res = await fetch('/api/materials/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: currentFile.name,
            fileType: currentFile.name.split('.').pop()?.toLowerCase() || 'pptx',
            fileBase64: base64Content,
            category: category.trim() || 'Umum',
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        let data: any = null;

        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const rawText = await res.text();
          throw new Error(
            rawText.includes('<!doctype') || rawText.includes('<html')
              ? `Server mengalami kesalahan (${res.status}). Silakan coba lagi dengan berkas yang lebih kecil atau format TXT/PDF.`
              : rawText || `Gagal memproses berkas "${currentFile.name}"`
          );
        }

        if (!res.ok) {
          throw new Error(data?.error || `Gagal memproses berkas "${currentFile.name}"`);
        }

        lastUploadedMaterial = data.material;
        setCurrentStep(4); // Done for current file
        await new Promise((r) => setTimeout(r, 400));
      }

      setTimeout(() => {
        setIsUploading(false);
        if (lastUploadedMaterial) {
          onUploadSuccess(lastUploadedMaterial);
        }
      }, 500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat memproses berkas');
      setIsUploading(false);
      setCurrentStep(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Upload Referensi & Materi Pembelajaran (Multi-File)</h2>
            <p className="text-sm text-slate-400">
              Unggah 1 atau lebih berkas materi sekaligus. AI Gemini akan membaca dan membedah dokumen secara ketat.
            </p>
          </div>
        </div>

        {/* Manual Category Input & Quick Presets */}
        {!isUploading && (
          <div className="mb-6 bg-slate-800/60 border border-slate-700/80 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <Tag className="w-4 h-4 text-indigo-400" />
              <span>Kategori Materi (Input Manual):</span>
            </div>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ketik kategori materi (contoh: Disiplin PNS / Core Values ASN)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <div>
              <p className="text-xs text-slate-400 mb-2">Saran Kategori Cepat:</p>
              <div className="flex flex-wrap gap-2">
                {presetCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 text-xs rounded-xl transition-all border ${
                      category === cat
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Drag & Drop Box */}
        {!isUploading && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 rounded-2xl p-8 text-center transition-colors cursor-pointer group"
          >
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              accept=".ppt,.pptx,.pdf,.docx,.txt,.md"
              multiple
              className="hidden"
            />
            <label htmlFor="fileInput" className="cursor-pointer block">
              <UploadCloud className="w-12 h-12 mx-auto text-indigo-400 group-hover:scale-110 transition-transform mb-3" />
              <p className="text-base font-semibold text-white mb-1">
                Pilih atau Seret 1 atau Lebih File Materi Ke Sini
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                Dapat memilih beberapa file sekaligus (PPT, PPTX, PDF, DOCX, TXT). AI akan memproses setiap file menjadi Bank Soal terpisah berdasar teks materi.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30">
                <FolderPlus className="w-4 h-4" /> Tambah File Referensi Materi
              </div>
            </label>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Selected files list */}
        {files.length > 0 && !isUploading && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Daftar File Referensi Ditambahkan ({files.length} Berkas):</span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-rose-400 hover:underline text-[11px]"
              >
                Hapus Semua
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {files.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{f.name}</p>
                      <p className="text-[10px] text-slate-400">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={processUpload}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Mulai AI Generator Soal ({files.length} Berkas)
              </button>
            </div>
          </div>
        )}

        {/* Progress steps when uploading */}
        {isUploading && (
          <div className="mt-8 space-y-6">
            <div className="text-center space-y-1">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-400 mb-2" />
              <h3 className="text-base font-bold text-white">
                Memproses Berkas {currentProcessingIndex + 1} dari {files.length}: "{files[currentProcessingIndex]?.name}"
              </h3>
              <p className="text-xs text-indigo-300 font-semibold">
                Kategori: <span className="text-white px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-md">{category}</span>
              </p>
              <p className="text-xs text-slate-400">AI Gemini sedang menganalisis teks materi dan membuat 60 soal HOTS.</p>
            </div>

            <div className="space-y-3 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/80">
              <StepItem
                stepNumber={1}
                title="Ekstraksi Teks Materi & Slide"
                description="Membaca dan memisahkan konten bab, poin utama, dan definisi"
                currentStep={currentStep}
              />
              <StepItem
                stepNumber={2}
                title="AI Analisis Konsep & Regulasi (Gemini 3.6 Flash)"
                description="Mengidentifikasi pasal perundang-undangan dan angka penting"
                currentStep={currentStep}
              />
              <StepItem
                stepNumber={3}
                title="Generasi Bank Soal HOTS (Hanya Mengacu Pada Teks File)"
                description="Membuat 20 Mudah, 20 Sedang, 20 Sulit untuk 7 Tipe Soal"
                currentStep={currentStep}
              />
              <StepItem
                stepNumber={4}
                title="Penyimpanan & Validasi Kualitas Soal"
                description="Soal berhasil disimpan dan siap digunakan dalam Live Quiz"
                currentStep={currentStep}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface StepItemProps {
  stepNumber: number;
  title: string;
  description: string;
  currentStep: number;
}

const StepItem: React.FC<StepItemProps> = ({ stepNumber, title, description, currentStep }) => {
  const isDone = currentStep > stepNumber;
  const isCurrent = currentStep === stepNumber;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${isCurrent ? 'bg-indigo-500/10 border border-indigo-500/30' : ''}`}>
      <div className="mt-0.5">
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        ) : isCurrent ? (
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        ) : (
          <div className="w-5 h-5 rounded-full border border-slate-600 text-[10px] text-slate-500 flex items-center justify-center font-bold">
            {stepNumber}
          </div>
        )}
      </div>
      <div>
        <p className={`text-sm font-semibold ${isDone ? 'text-emerald-300' : isCurrent ? 'text-indigo-300' : 'text-slate-400'}`}>
          {title}
        </p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
};

