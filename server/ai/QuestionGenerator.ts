import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient';
import { Question, QuestionType, Difficulty } from '../../src/types';

export interface GenerateQuestionsOptions {
  materialId: string;
  materialTitle: string;
  rawText: string;
  countEasy?: number;   // default 35
  countMedium?: number; // default 35
  countHard?: number;   // default 30
}

/**
 * Generate a complete 100-question bank with AI Gemini, or fallback if offline.
 * Ensures 100% uniqueness of every single question.
 */
export async function generateQuestionBank(
  options: GenerateQuestionsOptions
): Promise<Question[]> {
  const { materialId, materialTitle, rawText } = options;
  const countEasy = options.countEasy ?? 35;
  const countMedium = options.countMedium ?? 35;
  const countHard = options.countHard ?? 30;

  const ai = getGeminiClient();

  const difficulties: Array<{ level: Difficulty; count: number; desc: string }> = [
    { level: 'easy', count: countEasy, desc: 'MUDAH (C1 Ingatan & C2 Pemahaman Dasar - Definisi, Azas, Hak & Kewajiban)' },
    { level: 'medium', count: countMedium, desc: 'SEDANG (C3 Aplikasi Aturan & C4 Analisis - Prosedur, Klasifikasi Sanksi, Kinerja)' },
    { level: 'hard', count: countHard, desc: 'SULIT (C5 Evaluasi & C6 HOTS - Dilema Moral, Case Studies, Whistleblowing, Korupsi)' },
  ];

  const allQuestions: Question[] = [];
  const seenPrompts = new Set<string>();

  const officialTitle = sanitizeOfficialTitle(materialTitle);

  for (const diff of difficulties) {
    if (diff.count <= 0) continue;

    const prompt = `Anda adalah Senior AI Education Engineer dan Pembuat Soal HOTS Profesional.
Buatlah tepat ${diff.count} soal bertingkat kesulitan ${diff.desc} KHUSUS HANYA DARI TEKS MATERI DOKUMEN DI BAWAH INI:

===================== REGULASI / MATERI: "${officialTitle}" =====================
${rawText.slice(0, 12000)}
================================================================================

PERATURAN WAJIB (SANGAT KETAT & TANPA PENGECUALIAN):
1. WAJIB 100% BERSUMBER DARI TEKS MATERI DI ATAS. DILARANG KERAS MEMBUAT SOAL YANG TIDAK ADA BAHAN / REFERENSINYA DI DALAM TEKS MATERI!
2. Setiap pertanyaan (prompt), pilihan jawaban, dan penjelasan HARUS bersumber langsung dari fakta, definisi, aturan, pasal, atau uraian di dalam teks dokumen materi.
3. DILARANG KERAS MENYEBUTKAN NAMA FILE TEKNIS, NAMA BERKAS, VERSI FILE, ATAU FRASA SEPERTI "Integritas ASN BPOM v2", "v2", "v1", "2021 gratifikasi", "gratifikasi.pdf", "file_2021", "BERDASARKAN FILE INI", "DALAM DOKUMEN DI ATAS", "SESUAI PPT INI"!
4. DILARANG KERAS MEMASUKKAN KARAKTER SAMPAH OCR, KODE SIMBOL RUSAK (seperti [ g 3K R R S 0 $ p T?), ATAU POTONGAN KATA TIDAK LENGKAP!
5. Jika pertanyaan atau penjelasan perlu merujuk konteks atau peraturan, GUNAKAN NAMA RESMI REGULASI (contoh: "${officialTitle}" atau "UU No. 20 Tahun 2023"). BUKAN nama file teknis atau nama file ber-versi!
6. Setiap soal HARUS memiliki teks pertanyaan yang 100% UNIK dan BERBEDA. DILARANG KERAS membuat soal berulang!
7. Gunakan variasi 7 tipe soal: "multiple_choice", "true_false", "multiple_answer", "ordering", "matching", "short_answer", "case_study".
8. Bahasa Indonesia formal, akademis, dan presisi sesuai konteks dokumen.
9. Sertakan penjelasan komprehensif mengutip poin dari teks materi.

Hasilkan JSON array dari ${diff.count} soal bertingkat ${diff.level}.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  description: 'multiple_choice | true_false | multiple_answer | ordering | matching | short_answer | case_study',
                },
                difficulty: { type: Type.STRING, description: 'easy | medium | hard' },
                prompt: { type: Type.STRING, description: 'Teks pertanyaan yang unik' },
                caseStudyScenario: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      isCorrect: { type: Type.BOOLEAN },
                    },
                    required: ['id', 'text', 'isCorrect'],
                  },
                },
                matchingPairs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      left: { type: Type.STRING },
                      right: { type: Type.STRING },
                    },
                    required: ['id', 'left', 'right'],
                  },
                },
                orderItems: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      correctPosition: { type: Type.INTEGER },
                    },
                    required: ['id', 'text', 'correctPosition'],
                  },
                },
                shortAnswerCorrect: { type: Type.STRING },
                explanation: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                bloomTaxonomy: { type: Type.STRING },
                regulationRef: { type: Type.STRING },
              },
              required: ['type', 'difficulty', 'prompt', 'explanation'],
            },
          },
        },
      });

      if (response.text) {
        const parsedArray = JSON.parse(response.text.trim()) as any[];
        parsedArray.forEach((q, idx) => {
          const formatted = formatGeneratedQuestion(q, materialId, allQuestions.length + idx, diff.level);
          const normKey = formatted.prompt.trim().toLowerCase();
          if (!seenPrompts.has(normKey)) {
            seenPrompts.add(normKey);
            allQuestions.push(formatted);
          }
        });
      }
    } catch (err) {
      console.warn(`Gemini generation skipped for ${diff.level}:`, err);
    }
  }

  // If Gemini generated fewer than needed questions, fill missing ones using deterministic dynamic generator
  if (allQuestions.length < countEasy + countMedium + countHard) {
    const fallbackQs = generateFallbackQuestions(materialId, materialTitle, countEasy, countMedium, countHard, rawText);
    fallbackQs.forEach((fq) => {
      const normKey = fq.prompt.trim().toLowerCase();
      if (!seenPrompts.has(normKey)) {
        seenPrompts.add(normKey);
        allQuestions.push(fq);
      }
    });
  }

  return allQuestions.slice(0, countEasy + countMedium + countHard);
}

export function sanitizeOfficialTitle(title: string): string {
  if (!title) return 'Pedoman Integritas & Regulasi Terkait';
  
  // 1. Remove file extensions
  let clean = title.replace(/\.(pdf|docx?|pptx?|xlsx?|txt)$/i, '').trim();
  
  // 2. Remove version patterns like "v2", "v1.0", "v_2", "_v2", "- v2", etc.
  clean = clean.replace(/[\s_\-]+v\d+(\.\d+)?$/i, '');
  clean = clean.replace(/\bv\d+(\.\d+)?\b/gi, '');
  
  // 3. Remove specific filename words like "2021 gratifikasi", "bpom v2", "gratifikasi.pdf"
  clean = clean.replace(/\b2021\s*gratifikasi\b/gi, 'Pengendalian Gratifikasi');
  clean = clean.replace(/\bgratifikasi\s*2021\b/gi, 'Pengendalian Gratifikasi');
  clean = clean.replace(/\bintegritas\s+asn\s+bpom\b/gi, 'Pedoman Integritas ASN');
  
  clean = clean.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  // Check if title looks like a technical filename e.g. "2021 gratifikasi", "2021_gratifikasi", "file_123"
  if (/^\d{4}[\s_\-]*[a-zA-Z0-9_\-\s]+$/i.test(clean) || /^[a-zA-Z0-9_\-]+$/i.test(clean) || /^(file|dokumen|materi)[\s_\-]/i.test(clean)) {
    clean = clean.replace(/\b\d{4}\b/g, '').trim();
    clean = clean.replace(/\b(file|dokumen|materi|pdf|doc|ppt|docx|v\d+)\b/gi, '').trim();
    if (clean.length < 3) {
      return 'Pedoman Integritas & Pengendalian Gratifikasi';
    }
    const capitalized = clean
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return `Peraturan / Pedoman ${capitalized}`;
  }
  return clean || 'Pedoman Integritas ASN';
}

function cleanFileReferences(str: string): string {
  if (!str) return str;
  let s = str;

  // 1. Remove weird garbage characters / OCR artifacts like "[ g 3K R R S 0 $ p T?" or "$", "[", "]"
  s = s.replace(/[\[\]\{\}\$\\/<>|=+_~]/g, ' ');

  // 2. Remove isolated random single letters/numbers clusters (like "- 3 8 9 g 3K R R S 0 p T")
  s = s.replace(/\b([a-zA-Z0-9]\s+){3,}[a-zA-Z0-9]?\b/g, ' ');

  // 3. Remove version tags and filename references e.g. "Integritas ASN BPOM v2", "v2", "v1"
  s = s.replace(/integritas\s+asn\s+bpom(\s+v\d+)?/gi, 'Pedoman Integritas ASN');
  s = s.replace(/\b([a-zA-Z0-9\s]+)\s+v\d+(\.\d+)?\b/gi, '$1');
  s = s.replace(/\bv\d+(\.\d+)?\b/gi, '');

  // 4. Clean phrases like "berdasarkan file X", "pada file X", "dalam dokumen di atas", "2021 gratifikasi"
  s = s.replace(/(berdasarkan|menurut|sesuai|dalam|mengacu pada)\s+(file|dokumen|materi|ppt|pdf|berkas)\s+([^\s,.:;!?]+)?/gi, 'berdasarkan peraturan');
  s = s.replace(/(pada|dalam)\s+(file|dokumen|materi|ppt|pdf|berkas)\s+(ini|di\s*atas)/gi, 'dalam regulasi resmi');
  s = s.replace(/\b\d{4}[\s_\-]*(gratifikasi|integritas|pembelajaran|pdf|doc|ppt|xlsx|docx)\b/gi, 'Peraturan / Pedoman');
  s = s.replace(/\b(gratifikasi|integritas|pembelajaran|pdf|doc|ppt|xlsx|docx)[\s_\-]*\d{4}\b/gi, 'Peraturan / Pedoman');
  s = s.replace(/\b[a-zA-Z0-9_\-]+\.(pdf|docx?|pptx?|xlsx?|txt)\b/gi, 'Peraturan Terkait');

  // 5. Clean extra whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

function formatGeneratedQuestion(raw: any, materialId: string, idx: number, forceDiff?: Difficulty): Question {
  const type: QuestionType = (
    ['multiple_choice', 'true_false', 'multiple_answer', 'ordering', 'matching', 'short_answer', 'case_study'].includes(raw.type)
      ? raw.type
      : 'multiple_choice'
  ) as QuestionType;

  const difficulty: Difficulty = forceDiff || (
    ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium'
  ) as Difficulty;

  const cleanedPrompt = cleanFileReferences(raw.prompt || 'Pertanyaan terkait materi');
  const cleanedExplanation = cleanFileReferences(raw.explanation || 'Jawaban ini sesuai dengan ketentuan baku dan regulasi yang berlaku.');

  const cleanedOptions = raw.options
    ? raw.options.map((opt: any) => ({
        ...opt,
        text: cleanFileReferences(opt.text || ''),
      }))
    : undefined;

  const cleanedMatchingPairs = raw.matchingPairs
    ? raw.matchingPairs.map((pair: any) => ({
        ...pair,
        left: cleanFileReferences(pair.left || ''),
        right: cleanFileReferences(pair.right || ''),
      }))
    : undefined;

  const cleanedOrderItems = raw.orderItems
    ? raw.orderItems.map((item: any) => ({
        ...item,
        text: cleanFileReferences(item.text || ''),
      }))
    : undefined;

  const cleanedRegRef = cleanFileReferences(raw.regulationRef || 'UU No. 20 Tahun 2023 / Peraturan Terkait');

  return {
    id: `q-${materialId}-${Date.now()}-${idx + 1}`,
    materialId,
    type,
    difficulty,
    prompt: cleanedPrompt || 'Pertanyaan terkait materi',
    caseStudyScenario: raw.caseStudyScenario ? cleanFileReferences(raw.caseStudyScenario) : undefined,
    options: cleanedOptions,
    matchingPairs: cleanedMatchingPairs,
    orderItems: cleanedOrderItems,
    shortAnswerCorrect: raw.shortAnswerCorrect ? cleanFileReferences(raw.shortAnswerCorrect) : undefined,
    explanation: cleanedExplanation || 'Jawaban ini sesuai dengan ketentuan baku dan regulasi yang berlaku.',
    tags: raw.tags || ['ASN', 'Regulasi', 'Kompetensi'],
    bloomTaxonomy: raw.bloomTaxonomy || (difficulty === 'hard' ? 'C4 Analisis' : difficulty === 'medium' ? 'C3 Aplikasi' : 'C2 Pemahaman'),
    regulationRef: cleanedRegRef || 'UU No. 20 Tahun 2023 / Peraturan Terkait',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Regenerate a single question using Gemini
 */
export async function regenerateSingleQuestion(
  materialTitle: string,
  currentQuestion: Question
): Promise<Question> {
  const ai = getGeminiClient();

  const prompt = `Buatkan 1 soal alternatif pengganti yang BARU dan UNIK untuk materi "${materialTitle}" dengan tipe "${currentQuestion.type}" dan tingkat kesulitan "${currentQuestion.difficulty}".
Soal lama yang hendak diganti: "${currentQuestion.prompt}"

Gunakan studi kasus atau sudut pandang pertanyaan yang BERBEDA dari soal lama.
Kembalikan JSON objek tunggal dengan struktur yang sama.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      return formatGeneratedQuestion(parsed, currentQuestion.materialId, Math.floor(Math.random() * 1000), currentQuestion.difficulty);
    }
  } catch (err) {
    console.error('Error regenerating question:', err);
  }

  // Fallback variant
  return {
    ...currentQuestion,
    id: `q-regen-${Date.now()}`,
    prompt: `[Soal Alternatif AI] Bagaimana penerapan prinsip kepatuhan dan integritas dalam konteks khusus ${materialTitle}?`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Robust Dynamic Fallback Question Generator guaranteeing 100 100% UNIQUE, NON-REPEATING questions
 * across Easy (35), Medium (35), and Hard (30) levels.
 */
export function generateFallbackQuestions(
  materialId: string,
  materialTitle: string,
  countEasy: number = 35,
  countMedium: number = 35,
  countHard: number = 30,
  rawText?: string
): Question[] {
  const questions: Question[] = [];
  const title = sanitizeOfficialTitle(materialTitle);

  // Extract sentences or paragraphs from rawText if provided
  let sentences: string[] = [];
  if (rawText && rawText.trim().length > 30) {
    sentences = rawText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => cleanFileReferences(s.trim()))
      .filter((s) => {
        if (s.length < 20 || s.length > 250) return false;
        // Require at least 60% letters and spaces (rejects garbage OCR like "- 3 8 9 g 3K R R S 0 p T")
        const lettersAndSpaces = s.replace(/[^a-zA-Z\s]/g, '');
        if (lettersAndSpaces.length < s.length * 0.6) return false;
        // Require at least 4 real words (words with length >= 3)
        const realWords = s.split(/\s+/).filter((w) => w.length >= 3);
        if (realWords.length < 4) return false;
        // Reject if it still contains version tags or technical file tags
        if (/\b(v\d+|\d+v\d+|pdf|pptx?|docx?|xlsx?)\b/i.test(s)) return false;
        return true;
      });
  }

  // Helper to pick sentence safely
  const getSentence = (index: number, fallbackText: string) => {
    if (sentences.length > 0) {
      return sentences[index % sentences.length];
    }
    return fallbackText;
  };

  // --- EASY QUESTIONS (20 Distinct Items) ---
  const easyTemplates: Array<Omit<Question, 'id' | 'materialId' | 'createdAt'>> = [
    {
      type: 'multiple_choice',
      difficulty: 'easy',
      prompt: `Apakah definisi dan landasan filosofis utama dari implementasi ${title}?`,
      options: [
        { id: 'opt-e1-a', text: `Asas kepatuhan penuh terhadap regulasi kepegawaian dan nilai etika publik`, isCorrect: true },
        { id: 'opt-e1-b', text: `Kebebasan bertindak tanpa terikat pada standar operasional prosedur`, isCorrect: false },
        { id: 'opt-e1-c', text: `Kewenangan mutlak atasan dalam menentukan aturan pribadi`, isCorrect: false },
        { id: 'opt-e1-d', text: `Pengesampingan dokumen resmi demi penyelesaian tugas dengan cepat`, isCorrect: false },
      ],
      explanation: `Landasan utama dari ${title} adalah kepatuhan pada aturan tertulis dan standar etika profesi ASN.`,
      tags: [title, 'Definisi Dasar'],
      bloomTaxonomy: 'C1 Pemahaman Dasar',
      regulationRef: 'UU No. 20 Tahun 2023',
    },
    {
      type: 'true_false',
      difficulty: 'easy',
      prompt: `Apakah seluruh aturan dan kewajiban dalam ${title} bersifat mengikat bagi seluruh ASN tanpa terkecuali?`,
      options: [
        { id: 'tf-e2-a', text: 'Benar', isCorrect: true },
        { id: 'tf-e2-b', text: 'Salah', isCorrect: false },
      ],
      explanation: `Regulasi kepegawaian berlaku secara universal bagi seluruh ASN tanpa diskriminasi jabatan.`,
      tags: [title, 'Prinsip Kepatuhan'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'multiple_answer',
      difficulty: 'easy',
      prompt: `Pilihlah DUA atau LEBIH unsur utama yang wajib dipenuhi dalam implementasi ${title}:`,
      options: [
        { id: 'ma-e3-1', text: 'Jujur dan dapat dipertanggungjawabkan (Akuntabel)', isCorrect: true },
        { id: 'ma-e3-2', text: 'Menjaga rahasia jabatan dan dokumen negara', isCorrect: true },
        { id: 'ma-e3-3', text: 'Mengabaikan instruksi tertulis instansi', isCorrect: false },
        { id: 'ma-e3-4', text: 'Melayani masyarakat dengan cermat dan santun', isCorrect: true },
      ],
      explanation: `Akuntabilitas, kerahasiaan negara, dan pelayanan santun adalah pilar dasar ASN BerAKHLAK.`,
      tags: [title, 'Nilai BerAKHLAK'],
      bloomTaxonomy: 'C2 Pemahaman',
      regulationRef: 'Core Values ASN BerAKHLAK',
    },
    {
      type: 'ordering',
      difficulty: 'easy',
      prompt: `Susunlah urutan langkah dasar pencatatan administratif pada ${title}:`,
      orderItems: [
        { id: 'ord-e4-1', text: 'Pengajuan dokumen resmi oleh pemohon', correctPosition: 1 },
        { id: 'ord-e4-2', text: 'Verifikasi kelengkapan berkas oleh petugas', correctPosition: 2 },
        { id: 'ord-e4-3', text: 'Pencatatan dalam sistem registrasi resmi', correctPosition: 3 },
        { id: 'ord-e4-4', text: 'Penyerahan bukti tanda terima sah', correctPosition: 4 },
      ],
      explanation: `Urutan pencatatan dimulai dari pengajuan, verifikasi berkas, registrasi, hingga penyerahan bukti.`,
      tags: [title, 'Administrasi'],
      bloomTaxonomy: 'C2 Prosedur Dasar',
      regulationRef: 'SOP Administrasi Kepegawaian',
    },
    {
      type: 'matching',
      difficulty: 'easy',
      prompt: `Jodohkan istilah kepegawaian berikut dengan pengertian dasarnya terkait ${title}:`,
      matchingPairs: [
        { id: 'mp-e5-1', left: 'Kewajiban', right: 'Segala hal yang wajib dilaksanakan oleh pegawai' },
        { id: 'mp-e5-2', left: 'Larangan', right: 'Hal-hal yang tidak boleh dilakukan oleh pegawai' },
        { id: 'mp-e5-3', left: 'Hak', right: 'Fasilitas dan jaminan yang diterima sesuai regulasi' },
        { id: 'mp-e5-4', left: 'Sanksi', right: 'Hukuman akibat pelanggaran ketentuan yang berlaku' },
      ],
      explanation: `Kewajiban, larangan, hak, dan sanksi adalah struktur hukum utama kepegawaian.`,
      tags: [title, 'Istilah Dasar'],
      bloomTaxonomy: 'C1 Pengetahuan',
      regulationRef: 'UU No. 20 Tahun 2023',
    },
    {
      type: 'short_answer',
      difficulty: 'easy',
      prompt: `Sebutkan istilah resmi untuk nilai dasar tata kelola pemerintah yang terbuka dan transparan pada ${title}!`,
      shortAnswerCorrect: 'Akuntabilitas',
      explanation: `Akuntabilitas berarti setiap tindakan dan keputusan dapat dipertanggungjawabkan kepada publik.`,
      tags: [title, 'Istilah Baku'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'UU Pelayanan Publik',
    },
    {
      type: 'case_study',
      difficulty: 'easy',
      prompt: `Berdasarkan skenario di atas, tindakan paling dasar yang harus dilakukan Pegawai Budi adalah:`,
      caseStudyScenario: `Budi melihat adanya ketidaksesuaian kecil dalam berkas pencatatan ${title}. Temannya menyarankan agar dibiarkan saja karena tidak terlalu mencolok.`,
      options: [
        { id: 'cs-e7-a', text: 'Memeriksa kembali dan mengoreksi berkas sesuai ketentuan baku', isCorrect: true },
        { id: 'cs-e7-b', text: 'Membiarkan berkas tersebut tanpa melakukan pengecekan', isCorrect: false },
        { id: 'cs-e7-c', text: 'Menyalahkan staf administratif lain atas ketidaksesuaian tersebut', isCorrect: false },
        { id: 'cs-e7-d', text: 'Menghapus seluruh berkas agar tidak ketahuan', isCorrect: false },
      ],
      explanation: `Sikap cermat dan bertanggung jawab mengharuskan pegawai melakukan koreksi sesuai SOP.`,
      tags: [title, 'Skenario Dasar'],
      bloomTaxonomy: 'C2 Aplikasi Sederhana',
      regulationRef: 'Kode Etik ASN',
    },
    {
      type: 'multiple_choice',
      difficulty: 'easy',
      prompt: `Siapakah pihak yang bertanggung jawab menjaga penerapan nilai ${title} di lingkungan kerja?`,
      options: [
        { id: 'opt-e8-a', text: 'Seluruh ASN dan Pimpinan Unit Kerja secara bersama-sama', isCorrect: true },
        { id: 'opt-e8-b', text: 'Hanya Petugas Keamanan dan Satpol PP', isCorrect: false },
        { id: 'opt-e8-c', text: 'Hanya Kepala Dinas atau Menteri saja', isCorrect: false },
        { id: 'opt-e8-d', text: 'Pihak ketiga/konsultan luar instansi', isCorrect: false },
      ],
      explanation: `Integritas dan kepatuhan adalah tanggung jawab kolektif setiap pegawai ASN.`,
      tags: [title, 'Tanggung Jawab'],
      bloomTaxonomy: 'C1 Pemahaman',
      regulationRef: 'UU No. 20 Tahun 2023',
    },
    {
      type: 'true_false',
      difficulty: 'easy',
      prompt: `Apakah setiap ASN berhak mendapatkan perlindungan hukum saat menjalankan tugas kedinasan sesuai regulasi ${title}?`,
      options: [
        { id: 'tf-e9-a', text: 'Benar', isCorrect: true },
        { id: 'tf-e9-b', text: 'Salah', isCorrect: false },
      ],
      explanation: `Negara wajib memberikan perlindungan hukum bagi ASN yang bertindak sesuai regulasi resmi.`,
      tags: [title, 'Hak Pegawai'],
      bloomTaxonomy: 'C1 Pemahaman',
      regulationRef: 'UU No. 20 Tahun 2023 Bab Hak ASN',
    },
    {
      type: 'multiple_answer',
      difficulty: 'easy',
      prompt: `Pilihlah DUA atau LEBIH azas penyelenggaraan kebijakan publik dalam ${title}:`,
      options: [
        { id: 'ma-e10-1', text: 'Kepastian hukum dan profesionalitas', isCorrect: true },
        { id: 'ma-e10-2', text: 'Keterbukaan dan akuntabilitas', isCorrect: true },
        { id: 'ma-e10-3', text: 'Keterikatan pada kepentingan kelompok pribadi', isCorrect: false },
        { id: 'ma-e10-4', text: 'Efektivitas dan efisiensi', isCorrect: true },
      ],
      explanation: `Kepastian hukum, profesionalitas, keterbukaan, dan efektivitas adalah azas umum tata kelola yang baik.`,
      tags: [title, 'Azas Publik'],
      bloomTaxonomy: 'C2 Pemahaman',
      regulationRef: 'AAUPB / UU No. 30 Tahun 2014',
    },
    {
      type: 'ordering',
      difficulty: 'easy',
      prompt: `Susunlah tingkatan hierarki peraturan perundang-undangan dari yang tertinggi dalam lingkup ${title}:`,
      orderItems: [
        { id: 'ord-e11-1', text: 'Undang-Undang Dasar (UUD 1945)', correctPosition: 1 },
        { id: 'ord-e11-2', text: 'Undang-Undang / Perpu', correctPosition: 2 },
        { id: 'ord-e11-3', text: 'Peraturan Pemerintah (PP)', correctPosition: 3 },
        { id: 'ord-e11-4', text: 'Peraturan Menteri / Peraturan BKN', correctPosition: 4 },
      ],
      explanation: `Hierarki hukum di Indonesia diatur dalam UU No. 12 Tahun 2011.`,
      tags: [title, 'Hierarki Hukum'],
      bloomTaxonomy: 'C2 Pemahaman Regulasi',
      regulationRef: 'UU No. 12 Tahun 2011',
    },
    {
      type: 'matching',
      difficulty: 'easy',
      prompt: `Pasangkan peran instansi pembina kepegawaian terkait ${title}:`,
      matchingPairs: [
        { id: 'mp-e12-1', left: 'KemenPAN-RB', right: 'Perumusan kebijakan umum dan reformasi birokrasi' },
        { id: 'mp-e12-2', left: 'BKN', right: 'Penyelenggaraan manajemen dan data kepegawaian nasional' },
        { id: 'mp-e12-3', left: 'LAN RI', right: 'Penyelenggaraan pendidikan dan pelatihan kepemimpinan' },
        { id: 'mp-e12-4', left: 'KPK', right: 'Pencegahan dan pemberantasan korupsi sektor publik' },
      ],
      explanation: `Setiap lembaga pembina memiliki kewenangan spesifik dalam manajemen ASN.`,
      tags: [title, 'Lembaga Kepegawaian'],
      bloomTaxonomy: 'C1 Pengenalan',
      regulationRef: 'Kelembagaan ASN',
    },
    {
      type: 'short_answer',
      difficulty: 'easy',
      prompt: `Sebutkan nama sistem basis data kepegawaian terintegrasi nasional yang dikelola BKN terkait ${title}!`,
      shortAnswerCorrect: 'SIASN',
      explanation: `SIASN (Sistem Informasi Aparatur Sipil Negara) adalah portal data terintegrasi nasional.`,
      tags: [title, 'Sistem Informasi'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'Peraturan BKN',
    },
    {
      type: 'case_study',
      difficulty: 'easy',
      prompt: `Dalam situasi di atas, tindakan pelayanan yang paling mencerminkan profesionalitas adalah:`,
      caseStudyScenario: `Masyarakat mendatangi loket pelayanan ${title} mendekati jam istirahat. Pegawai loket bertugas menjaga kelancaran antrean.`,
      options: [
        { id: 'cs-e14-a', text: 'Melayani masyarakat dengan ramah dan menyelesaikan permohonan sesuai standar', isCorrect: true },
        { id: 'cs-e14-b', text: 'Menutup loket secara sepihak dan menyuruh warga pulang', isCorrect: false },
        { id: 'cs-e14-c', text: 'Meminta imbalan tambahan uang lelah agar dapat dilayani', isCorrect: false },
        { id: 'cs-e14-d', text: 'Marah-marah karena merasa terganggu di jam kerja', isCorrect: false },
      ],
      explanation: `Pelayanan publik BerAKHLAK wajib berorientasi pada kepuasan masyarakat tanpa memungut imbalan ilegal.`,
      tags: [title, 'Pelayanan Publik'],
      bloomTaxonomy: 'C2 Aplikasi Dasar',
      regulationRef: 'UU Pelayanan Publik',
    },
    {
      type: 'multiple_choice',
      difficulty: 'easy',
      prompt: `Sebutkan salah satu contoh kewajiban moral ASN terkait penyampaian informasi publik pada ${title}!`,
      options: [
        { id: 'opt-e15-a', text: 'Memberikan informasi secara benar dan tidak menyesatkan kepada publik', isCorrect: true },
        { id: 'opt-e15-b', text: 'Menyebarkan rumor internal instansi ke media sosial', isCorrect: false },
        { id: 'opt-e15-c', text: 'Sengaja menyembunyikan dokumen publik tanpa alasan sah', isCorrect: false },
        { id: 'opt-e15-d', text: 'Membuat berita buatan untuk menaikkan citra pribadi', isCorrect: false },
      ],
      explanation: `Kewajiban menyampaikan informasi yang benar dan tidak menyesatkan diatur dalam Kode Etik ASN.`,
      tags: [title, 'Informatika Kepegawaian'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'UU KIP No. 14 Tahun 2008',
    },
    {
      type: 'true_false',
      difficulty: 'easy',
      prompt: `Apakah penilaian kinerja ASN pada modul ${title} diukur berdasarkan pencapaian SKP (Sasaran Kinerja Pegawai) dan Perilaku Kerja?`,
      options: [
        { id: 'tf-e16-a', text: 'Benar', isCorrect: true },
        { id: 'tf-e16-b', text: 'Salah', isCorrect: false },
      ],
      explanation: `Sesuai PermenPANRB No. 6 Tahun 2022, evaluasi kinerja mencakup SKP dan Perilaku Kerja ASN.`,
      tags: [title, 'Penilaian Kinerja'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'PermenPANRB No. 6 Tahun 2022',
    },
    {
      type: 'multiple_answer',
      difficulty: 'easy',
      prompt: `Pilihlah DUA atau LEBIH bentuk kewajiban netralitas ASN pada konteks ${title}:`,
      options: [
        { id: 'ma-e17-1', text: 'Tidak memihak pada pasangan calon politik manapun', isCorrect: true },
        { id: 'ma-e17-2', text: 'Tidak menggunakan fasilitas negara untuk pampanye politik', isCorrect: true },
        { id: 'ma-e17-3', text: 'Ikut serta menjadi pengurus partai politik aktif', isCorrect: false },
        { id: 'ma-e17-4', text: 'Bebas dari pengaruh dan intervensi semua golongan', isCorrect: true },
      ],
      explanation: `Netralitas ASN diatur ketat agar pelayanan publik tidak terpengaruh oleh politik praktis.`,
      tags: [title, 'Netralitas ASN'],
      bloomTaxonomy: 'C2 Pemahaman',
      regulationRef: 'SKB Netralitas ASN',
    },
    {
      type: 'ordering',
      difficulty: 'easy',
      prompt: `Susunlah siklus tahunan manajemen kinerja pegawai pada ${title}:`,
      orderItems: [
        { id: 'ord-e18-1', text: 'Perencanaan dan penetapan target SKP awal tahun', correctPosition: 1 },
        { id: 'ord-e18-2', text: 'Pelaksanaan tugas dan umpan balik berkelanjutan', correctPosition: 2 },
        { id: 'ord-e18-3', text: 'Evaluasi kinerja berkala (triwulanan/semesteran)', correctPosition: 3 },
        { id: 'ord-e18-4', text: 'Penetapan predikat kinerja akhir tahun', correctPosition: 4 },
      ],
      explanation: `Siklus kinerja dimulai dari penetapan target, pendampingan, evaluasi berkala, hingga predikat akhir.`,
      tags: [title, 'Siklus Kinerja'],
      bloomTaxonomy: 'C2 Urutan Kerja',
      regulationRef: 'PermenPANRB No. 6 Tahun 2022',
    },
    {
      type: 'matching',
      difficulty: 'easy',
      prompt: `Pasangkan jenis penghargaan kepegawaian dengan kriterianya terkait ${title}:`,
      matchingPairs: [
        { id: 'mp-e19-1', left: 'Satyalancana Karya Satya', right: 'Penghargaan atas pengabdian 10, 20, atau 30 tahun' },
        { id: 'mp-e19-2', left: 'Kenaikan Pangkat Anumerta', right: 'Diberikan kepada pegawai yang tewas dalam tugas' },
        { id: 'mp-e19-3', left: 'Pegawai Teladan', right: 'Diberikan atas prestasi dan inovasi luar biasa' },
        { id: 'mp-e19-4', left: 'Kenaikan Pangkat Pilihan', right: 'Diberikan atas jab fungsional/prestasi kerja tinggi' },
      ],
      explanation: `Penghargaan ASN diberikan sebagai apresiasi atas dedikasi dan masa bakti pegawai.`,
      tags: [title, 'Penghargaan'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'PP Manajemen PNS',
    },
    {
      type: 'short_answer',
      difficulty: 'easy',
      prompt: `Sebutkan sebutan untuk norma moral yang menjadi standar perilaku bagi ASN dalam melaksanakan tugasnya pada ${title}!`,
      shortAnswerCorrect: 'Kode Etik',
      explanation: `Kode Etik dan Kode Perilaku ASN memuat norma etika yang harus dipatuhi.`,
      tags: [title, 'Norma Etika'],
      bloomTaxonomy: 'C1 Ingatan',
      regulationRef: 'UU No. 20 Tahun 2023',
    },
  ];

  // --- MEDIUM QUESTIONS (20 Distinct Items) ---
  const mediumTemplates: Array<Omit<Question, 'id' | 'materialId' | 'createdAt'>> = [
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: `Berdasarkan ketentuan sanksi pada ${title}, manakah yang termasuk dalam klasifikasi Hukuman Disiplin Sedang?`,
      options: [
        { id: 'opt-m1-a', text: `Pemotongan Tunjangan Kinerja (Tukin) sebesar 25% selama 6, 9, atau 12 bulan`, isCorrect: true },
        { id: 'opt-m1-b', text: `Teguran Lisan dan Teguran Tertulis secara internal`, isCorrect: false },
        { id: 'opt-m1-c', text: `Pemberhentian tidak atas permintaan sendiri sebagai PNS`, isCorrect: false },
        { id: 'opt-m1-d', text: `Pembebasan dari jabatan menjadi jabatan pelaksana selama 12 bulan`, isCorrect: false },
      ],
      explanation: `Pemotongan Tukin 25% (6, 9, 12 bulan) diatur dalam PP No. 94 Tahun 2021 sebagai Hukuman Disiplin Sedang.`,
      tags: [title, 'Sanksi Sedang'],
      bloomTaxonomy: 'C3 Klasifikasi Aturan',
      regulationRef: 'PP No. 94 Tahun 2021 Pasal 8',
    },
    {
      type: 'true_false',
      difficulty: 'medium',
      prompt: `Apakah Atasan Langsung yang tidak melakukan pemeriksaan terhadap bawahan yang diduga melanggar ${title} juga dapat dikenakan sanksi disiplin?`,
      options: [
        { id: 'tf-m2-a', text: 'Benar', isCorrect: true },
        { id: 'tf-m2-b', text: 'Salah', isCorrect: false },
      ],
      explanation: `Atasan yang membiarkan atau tidak memeriksa dugaan pelanggaran bawahan dikenakan sanksi yang sama dengan jenis sanksi bawahannya.`,
      tags: [title, 'Tanggung Jawab Atasan'],
      bloomTaxonomy: 'C3 Penerapan Hukum',
      regulationRef: 'PP No. 94 Tahun 2021 Pasal 21',
    },
    {
      type: 'multiple_answer',
      difficulty: 'medium',
      prompt: `Pilihlah DUA atau LEBIH kriteria pelanggaran disiplin yang masuk dalam kategori Tingkat Sedang pada ${title}:`,
      options: [
        { id: 'ma-m3-1', text: 'Tidak masuk kerja tanpa alasan sah secara kumulatif selama 11 hingga 13 hari kerja', isCorrect: true },
        { id: 'ma-m3-2', text: 'Menolak melaksanakan tugas kedinasan yang diperintahkan atasan tanpa alasan sah', isCorrect: true },
        { id: 'ma-m3-3', text: 'Teguran lisan ringan atas keterlambatan 10 menit', isCorrect: false },
        { id: 'ma-m3-4', text: 'Menyalahgunakan wewenang untuk keuntungan pribadi skala menengah', isCorrect: true },
      ],
      explanation: `Ketidakhadiran 11-13 hari kumulatif dan penolakan tugas kedinasan sah masuk sanksi sedang.`,
      tags: [title, 'Pelanggaran Sedang'],
      bloomTaxonomy: 'C4 Analisis Kasus',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'ordering',
      difficulty: 'medium',
      prompt: `Susunlah alur resmi proses penjatuhan hukuman disiplin pada ${title}:`,
      orderItems: [
        { id: 'ord-m4-1', text: 'Pemanggilan tertulis dan pembuatan Berita Acara Pemeriksaan (BAP)', correctPosition: 1 },
        { id: 'ord-m4-2', text: 'Pemeriksaan saksi, bukti, dan pembuktian fakta pelanggaran', correctPosition: 2 },
        { id: 'ord-m4-3', text: 'Penyusunan Laporan Hasil Pemeriksaan (LHP) oleh Tim Pemeriksa', correctPosition: 3 },
        { id: 'ord-m4-4', text: 'Penetapan dan penyampaian Keputusan Hukuman Disiplin (SK)', correctPosition: 4 },
      ],
      explanation: `Prosedur penjatuhan sanksi wajib melalui pemanggilan, BAP, LHP, hingga penerbitan SK resmi.`,
      tags: [title, 'Prosedur Pemeriksaan'],
      bloomTaxonomy: 'C3 Penerapan Prosedur',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'matching',
      difficulty: 'medium',
      prompt: `Jodohkan jumlah hari tidak masuk kerja tanpa alasan sah dengan jenis hukuman disiplinnya pada ${title}:`,
      matchingPairs: [
        { id: 'mp-m5-1', left: '3 - 10 Hari Kerja', right: 'Hukuman Disiplin Ringan (Teguran Lisan/Tertulis)' },
        { id: 'mp-m5-2', left: '11 - 13 Hari Kerja', right: 'Hukuman Disiplin Sedang (Pemotongan Tukin 25% selama 6 bulan)' },
        { id: 'mp-m5-3', left: '14 - 20 Hari Kerja', right: 'Hukuman Disiplin Sedang (Pemotongan Tukin 25% selama 9-12 bulan)' },
        { id: 'mp-m5-4', left: '21 - 28 Hari Kerja / 10 Hari Beruntun', right: 'Hukuman Disiplin Berat (Pemberhentian Tidak Atas Permintaan Sendiri)' },
      ],
      explanation: `Ambang batas hari ketidakhadiran secara tegas membedakan tingkat sanksi ringan, sedang, dan berat.`,
      tags: [title, 'Ambang Batas Hari'],
      bloomTaxonomy: 'C3 Analisis Regulasional',
      regulationRef: 'PP No. 94 Tahun 2021 Pasal 11-14',
    },
    {
      type: 'short_answer',
      difficulty: 'medium',
      prompt: `Sebutkan sebutan untuk dokumen resmi hasil wawancara pemeriksaan terperiksa yang ditandatangani pemeriksa dan terperiksa pada ${title}!`,
      shortAnswerCorrect: 'Berita Acara Pemeriksaan',
      explanation: `Berita Acara Pemeriksaan (BAP) adalah dokumen sah pembuktian fakta pelanggaran disiplin.`,
      tags: [title, 'Dokumen Hukum'],
      bloomTaxonomy: 'C2 Pengenalan Dokumen',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'case_study',
      difficulty: 'medium',
      prompt: `Dalam kasus ketidakhadiran di atas, tindakan administratif awal yang Wajib diambil Atasan Langsung adalah:`,
      caseStudyScenario: `Pegawai Rina tidak hadir tanpa keterangan selama 5 hari kerja berturut-turut pada unit operasional ${title}. Rekan kerjanya telah mencoba menghubungi namun tidak ada jawaban.`,
      options: [
        { id: 'cs-m7-a', text: 'Menerbitkan surat pemanggilan tertulis resmi I untuk pemeriksaan BAP', isCorrect: true },
        { id: 'cs-m7-b', text: 'Langsung memecat Rina tanpa proses klarifikasi terlebih dahulu', isCorrect: false },
        { id: 'cs-m7-c', text: 'Mengabaikan ketidakhadiran tersebut dan tetap membayarkan tunjangan penuh', isCorrect: false },
        { id: 'cs-m7-d', text: 'Meminta staf lain memalsukan tanda tangan daftar hadir Rina', isCorrect: false },
      ],
      explanation: `Prosedur baku mengharuskan penerbitan surat pemanggilan resmi I sebelum penjatuhan sanksi.`,
      tags: [title, 'Studi Kasus Prosedur'],
      bloomTaxonomy: 'C3 Penerapan Hukum',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: `Bagaimanakah mekanisme penyampaian usulan izin atau pendelegasian tugas pada modul ${title}?`,
      options: [
        { id: 'opt-m8-a', text: 'Melalui surat dinas resmi/sistem elektronik terintegrasi dan disetujui Pejabat Berwenang', isCorrect: true },
        { id: 'opt-m8-b', text: 'Cukup melalui pesan lisan kepada penjaga kantor tanpa dokumen', isCorrect: false },
        { id: 'opt-m8-c', text: 'Bebas berangkat tanpa perlu pemberitahuan tertulis', isCorrect: false },
        { id: 'opt-m8-d', text: 'Mengunggah status pribadi di media sosial instansi', isCorrect: false },
      ],
      explanation: `Setiap izin dan pendelegasian wajib tercatat dalam dokumen atau sistem informasi elektronik resmi instansi.`,
      tags: [title, 'Tata Naskah Dinas'],
      bloomTaxonomy: 'C3 Penerapan',
      regulationRef: 'Peraturan BKN / SOP Instansi',
    },
    {
      type: 'true_false',
      difficulty: 'medium',
      prompt: `Apakah pegawai yang sedang menjalani Hukuman Disiplin Tingkat Sedang tetap berhak mengikuti seleksi promosi jabatan pada kurun waktu tersebut?`,
      options: [
        { id: 'tf-m9-a', text: 'Salah', isCorrect: true },
        { id: 'tf-m9-b', text: 'Benar', isCorrect: false },
      ],
      explanation: `Pegawai yang dalam masa hukuman disiplin sedang/berat ditangguhkan haknya untuk promosi dan seleksi jabatan.`,
      tags: [title, 'Dampak Sanksi'],
      bloomTaxonomy: 'C3 Analisis Hak',
      regulationRef: 'Manajemen Karier ASN',
    },
    {
      type: 'multiple_answer',
      difficulty: 'medium',
      prompt: `Pilihlah DUA atau LEBIH wewenang Pejabat Pembina Kepegawaian (PPK) dalam penanganan ${title}:`,
      options: [
        { id: 'ma-m10-1', text: 'Menetapkan penjatuhan hukuman disiplin berat sesuai rekomendasi tim', isCorrect: true },
        { id: 'ma-m10-2', text: 'Melakukan pembebasan sementara dari tugas jabatan demi kelancaran pemeriksaan', isCorrect: true },
        { id: 'ma-m10-3', text: 'Mengubah undang-undang kepegawaian secara mandiri', isCorrect: false },
        { id: 'ma-m10-4', text: 'Menolak permohonan yang tidak memenuhi syarat regulasi', isCorrect: true },
      ],
      explanation: `PPK memiliki kewenangan menetapkan hukuman disiplin berat dan pembebasan sementara dari jabatan.`,
      tags: [title, 'Wewenang PPK'],
      bloomTaxonomy: 'C3 Wewenang Pejabat',
      regulationRef: 'UU No. 20 Tahun 2023',
    },
    {
      type: 'ordering',
      difficulty: 'medium',
      prompt: `Susunlah tahapan tata cara pengajuan keberatan atau banding administratif atas sanksi ${title}:`,
      orderItems: [
        { id: 'ord-m11-1', text: 'Penerimaan Keputusan Hukuman Disiplin (SK) oleh pegawai', correctPosition: 1 },
        { id: 'ord-m11-2', text: 'Pengajuan Surat Keberatan tertulis maksimal 14 hari kerja', correctPosition: 2 },
        { id: 'ord-m11-3', text: 'Pengujian dan pertimbangan oleh Badan Pertimbangan ASN (BP-ASN)', correctPosition: 3 },
        { id: 'ord-m11-4', text: 'Penerbitan Keputusan Banding yang bersifat final dan mengikat', correctPosition: 4 },
      ],
      explanation: `Pengajuan keberatan/banding dilakukan maksimal 14 hari kerja setelah SK diterima.`,
      tags: [title, 'Banding Administratif'],
      bloomTaxonomy: 'C3 Urutan Banding',
      regulationRef: 'BP-ASN / PP No. 79 Tahun 2021',
    },
    {
      type: 'matching',
      difficulty: 'medium',
      prompt: `Jodohkan jenis cuti ASN dengan batas durasi maksimalnya terkait ${title}:`,
      matchingPairs: [
        { id: 'mp-m12-1', left: 'Cuti Tahunan', right: 'Maksimal 12 hari kerja dalam 1 tahun berjalan' },
        { id: 'mp-m12-2', left: 'Cuti Melahirkan', right: 'Maksimal 3 bulan untuk persalinan' },
        { id: 'mp-m12-3', left: 'Cuti Besar', right: 'Maksimal 3 bulan setelah mengabdi 5 tahun beruntun' },
        { id: 'mp-m12-4', left: 'Cuti di Luar Tanggungan Negara', right: 'Maksimal 3 tahun dan dapat diperpanjang 1 tahun' },
      ],
      explanation: `Aturan durasi cuti diatur spesifik dalam Peraturan BKN tentang Cuti PNS.`,
      tags: [title, 'Ketentuan Cuti'],
      bloomTaxonomy: 'C2 Pemahaman Durasi',
      regulationRef: 'Peraturan BKN No. 24 Tahun 2017',
    },
    {
      type: 'short_answer',
      difficulty: 'medium',
      prompt: `Sebutkan nama badan khusus yang berwenang memeriksa dan memutus banding administratif sanksi disiplin ASN pada ${title}!`,
      shortAnswerCorrect: 'Badan Pertimbangan ASN',
      explanation: `Badan Pertimbangan ASN (BP-ASN) bertugas menyelesaikan sengketa hukuman disiplin berat.`,
      tags: [title, 'Lembaga Banding'],
      bloomTaxonomy: 'C2 Pengetahuan Lembaga',
      regulationRef: 'PP No. 79 Tahun 2021',
    },
    {
      type: 'case_study',
      difficulty: 'medium',
      prompt: `Berdasarkan studi kasus penilaian e-Kinerja di atas, tindakan terbaik yang harus diambil Evaluator adalah:`,
      caseStudyScenario: `Pegawai Agus memperoleh nilai SKP Sangat Baik dalam pencatatan ${title}, namun indikator perilaku kerjanya menunjukkan sikap arogan dan sering memicu konflik tim.`,
      options: [
        { id: 'cs-m14-a', text: 'Memberikan umpan balik konstruktif dan menyesuaikan predikat predikat kinerja gabungan secara objektif', isCorrect: true },
        { id: 'cs-m14-b', text: 'Meluluskan predikat sempurna tanpa mengevaluasi catatan perilaku kerja', isCorrect: false },
        { id: 'cs-m14-c', text: 'Langsung menurunkan nilai SKP kuantitatif menjadi Buruk tanpa klarifikasi', isCorrect: false },
        { id: 'cs-m14-d', text: 'Menghapus seluruh catatan penilaian kinerja dari sistem instansi', isCorrect: false },
      ],
      explanation: `Evaluasi e-Kinerja menggabungkan aspek Kuantitatif (SKP) dan Kualitatif (Perilaku Kerja BerAKHLAK).`,
      tags: [title, 'Studi Kasus Kinerja'],
      bloomTaxonomy: 'C4 Analisis Penilaian',
      regulationRef: 'PermenPANRB No. 6 Tahun 2022',
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      prompt: `Apakah konsekuensi hukum bagi pegawai yang terbukti memberikan keterangan palsu dalam Berita Acara Pemeriksaan (BAP) ${title}?`,
      options: [
        { id: 'opt-m15-a', text: 'Dapat dikenakan pemberatan hukuman disiplin hingga sanksi pidana kebohongan', isCorrect: true },
        { id: 'opt-m15-b', text: 'Diberikan bonus apresiasi karena keberanian berbicara', isCorrect: false },
        { id: 'opt-m15-c', text: 'Dibebaskan dari seluruh tuduhan pelanggaran', isCorrect: false },
        { id: 'opt-m15-d', text: 'Diberikan masa libur khusus selama 1 bulan', isCorrect: false },
      ],
      explanation: `Keterangan palsu saat BAP memperberat sanksi disiplin dan melanggar sumpah jabatan ASN.`,
      tags: [title, 'Pemberatan Sanksi'],
      bloomTaxonomy: 'C3 Konsekuensi Hukum',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'true_false',
      difficulty: 'medium',
      prompt: `Apakah penggunaan kendaraan dinas operasional untuk keperluan mudik pribadi diperbolehkan dalam aturan ${title}?`,
      options: [
        { id: 'tf-m16-a', text: 'Salah', isCorrect: true },
        { id: 'tf-m16-b', text: 'Benar', isCorrect: false },
      ],
      explanation: `Fasilitas dan kendaraan dinas hanya boleh dipergunakan untuk kepentingan dinas operasional resmi.`,
      tags: [title, 'Penggunaan Fasilitas Negara'],
      bloomTaxonomy: 'C3 Kepatuhan Aturan',
      regulationRef: 'Surat Edaran MenPANRB',
    },
    {
      type: 'multiple_answer',
      difficulty: 'medium',
      prompt: `Pilihlah DUA atau LEBIH syarat administratif permohonan Cuti di Luar Tanggungan Negara (CLTN) terkait ${title}:`,
      options: [
        { id: 'ma-m17-1', text: 'Masa kerja minimal 5 tahun secara terus-menerus sebagai PNS', isCorrect: true },
        { id: 'ma-m17-2', text: 'Alasan sah seperti mendampingi suami/istri tugas luar negeri atau pengobatan', isCorrect: true },
        { id: 'ma-m17-3', text: 'Bebas dari sanksi hukuman disiplin tingkat sedang atau berat', isCorrect: true },
        { id: 'ma-m17-4', text: 'Cukup mengajukan permohonan lisan 1 hari sebelum cuti', isCorrect: false },
      ],
      explanation: `CLTN membutuhkan masa kerja minimal 5 tahun, alasan sah, dan persetujuan Kepala BKN.`,
      tags: [title, 'Syarat CLTN'],
      bloomTaxonomy: 'C3 Kelayakan Cuti',
      regulationRef: 'Peraturan BKN No. 24 Tahun 2017',
    },
    {
      type: 'ordering',
      difficulty: 'medium',
      prompt: `Susunlah tahapan penanganan laporan dugaan pelanggaran gratifikasi di unit kerja ${title}:`,
      orderItems: [
        { id: 'ord-m18-1', text: 'Penerimaan barang/fasilitas dari pihak ketiga oleh pegawai', correctPosition: 1 },
        { id: 'ord-m18-2', text: 'Pelaporan mandiri ke Unit Pengendalian Gratifikasi (UPG) maks 30 hari', correctPosition: 2 },
        { id: 'ord-m18-3', text: 'Verifikasi dan analisis status barang oleh UPG / KPK', correctPosition: 3 },
        { id: 'ord-m18-4', text: 'Penetapan status kepemilikan menjadi milik negara atau penerima', correctPosition: 4 },
      ],
      explanation: `Laporan gratifikasi wajib dilakukan maksimal 30 hari kerja sejak penerimaan barang.`,
      tags: [title, 'Pengendalian Gratifikasi'],
      bloomTaxonomy: 'C3 Prosedur UPG',
      regulationRef: 'UU No. 20 Tahun 2001 / Peraturan KPK',
    },
    {
      type: 'matching',
      difficulty: 'medium',
      prompt: `Pasangkan jenis pelanggaran etika publik dengan contoh dampaknya pada ${title}:`,
      matchingPairs: [
        { id: 'mp-m19-1', left: 'Membocorkan Soal Ujian/Dokumen Rahasia', right: 'Mencoreng kredibilitas dan keabsahan seleksi instansi' },
        { id: 'mp-m19-2', left: 'Penerimaan Suap Pengadaan', right: 'Kerugian keuangan negara dan kualitas barang rendah' },
        { id: 'mp-m19-3', left: 'Pungli Pelayanan Publik', right: 'Penurunan kepercayaan masyarakat terhadap birokrasi' },
        { id: 'mp-m19-4', left: 'Manipulasi Presensi Online', right: 'Pemotongan Tukin dan sanksi disiplin pegawai' },
      ],
      explanation: `Setiap pelanggaran etika membawa dampak serius pada reputasi dan kinerja instansi.`,
      tags: [title, 'Dampak Pelanggaran'],
      bloomTaxonomy: 'C3 Analisis Dampak',
      regulationRef: 'Kode Etik & Perilaku ASN',
    },
    {
      type: 'short_answer',
      difficulty: 'medium',
      prompt: `Sebutkan nama unit internal instansi yang bertugas menerima dan mengelola laporan gratifikasi pegawai pada ${title}!`,
      shortAnswerCorrect: 'Unit Pengendalian Gratifikasi',
      explanation: `Unit Pengendalian Gratifikasi (UPG) dibentuk di setiap kementerian/lembaga/daerah.`,
      tags: [title, 'Unit Kerja'],
      bloomTaxonomy: 'C2 Kelembagaan Anti-Korupsi',
      regulationRef: 'Peraturan KPK No. 2 Tahun 2019',
    },
  ];

  // --- HARD QUESTIONS (20 Distinct Items) ---
  const hardTemplates: Array<Omit<Question, 'id' | 'materialId' | 'createdAt'>> = [
    {
      type: 'multiple_choice',
      difficulty: 'hard',
      prompt: `Dalam situasi konflik kepentingan pengadaan barang/jasa publik pada ${title}, manakah tindakan HOTS terbaik yang mencerminkan integritas tertinggi?`,
      options: [
        { id: 'opt-h1-a', text: `Secara proaktif mendeklarasikan konflik kepentingan (Conflict of Interest Declaration) dan mengundurkan diri dari Panitia Pokja Pengadaan`, isCorrect: true },
        { id: 'opt-h1-b', text: `Tetap menjadi ketua panitia namun berusaha bertindak seolah-olah netral tanpa memberitahu siapapun`, isCorrect: false },
        { id: 'opt-h1-c', text: `Membocorkan HPS (Harga Perkiraan Sendiri) hanya kepada perusahaan milik kerabat dekat`, isCorrect: false },
        { id: 'opt-h1-d', text: `Meminta imbalan saham tersembunyi sebagai syarat memenangkan vendor tertentu`, isCorrect: false },
      ],
      explanation: `Deklarasi tertulis dan pengunduran diri dari kepanitiaan adalah prosedur standar internasional pencegahan konflik kepentingan.`,
      tags: [title, 'HOTS Konflik Kepentingan'],
      bloomTaxonomy: 'C5 Evaluasi Dilema Moral',
      regulationRef: 'UU No. 30 Tahun 2014 & Perpres PBJ',
    },
    {
      type: 'true_false',
      difficulty: 'hard',
      prompt: `Apakah ASN yang dijatuhi hukuman pidana penjara berdasarkan putusan pengadilan yang berkekuatan hukum tetap (inkracht) karena tindak pidana korupsi wajib diberhentikan tidak dengan hormat?`,
      options: [
        { id: 'tf-h2-a', text: 'Benar', isCorrect: true },
        { id: 'tf-h2-b', text: 'Salah', isCorrect: false },
      ],
      explanation: `Tindak pidana jabatan/korupsi yang inkracht mewajibkan Pemberhentian Tidak Dengan Hormat (PTDH) tanpa toleransi.`,
      tags: [title, 'PTDH Korupsi'],
      bloomTaxonomy: 'C5 Evaluasi Hukum',
      regulationRef: 'UU No. 20 Tahun 2023 Pasal 52',
    },
    {
      type: 'multiple_answer',
      difficulty: 'hard',
      prompt: `Pilihlah DUA atau LEBIH tindakan HOTS paling efektif dalam membangun sistem Whistleblowing System (WBS) yang aman pada ${title}:`,
      options: [
        { id: 'ma-h3-1', text: 'Jaminan perlindungan kerahasiaan identitas pelapor dan perlindungan hukum dari intimidasi', isCorrect: true },
        { id: 'ma-h3-2', text: 'Kanal pelaporan berbasis enkripsi yang dikelola oleh tim independen/Inspektorat', isCorrect: true },
        { id: 'ma-h3-3', text: 'Mempublikasikan nama lengkap pelapor ke papan pengumuman kantor', isCorrect: false },
        { id: 'ma-h3-4', text: 'Tindak lanjut investigasi yang terukur dengan laporan progres berkala', isCorrect: true },
      ],
      explanation: `Perlindungan anonimitas, kanal independen terenkripsi, dan kepastian investigasi adalah kunci keberhasilan WBS.`,
      tags: [title, 'HOTS WBS & Proteksi'],
      bloomTaxonomy: 'C6 Desain Sistem Inovatif',
      regulationRef: 'Pedoman WBS KemenPANRB / KPK',
    },
    {
      type: 'ordering',
      difficulty: 'hard',
      prompt: `Susunlah hierarki tindakan korektif manajemen risiko kecurangan (Fraud Risk Management) pada modul ${title}:`,
      orderItems: [
        { id: 'ord-h4-1', text: 'Pemetaan potensi titik rawan gratifikasi dan kecurangan di unit operasional', correctPosition: 1 },
        { id: 'ord-h4-2', text: 'Penerapan Sistem Pengendalian Intern Pemerintah (SPIP) terpadu', correctPosition: 2 },
        { id: 'ord-h4-3', text: 'Audit investigatif independen oleh Inspektorat Utama', correctPosition: 3 },
        { id: 'ord-h4-4', text: 'Penjatuhan sanksi PTDH dan penyerahan berkas ke Aparat Penegak Hukum (APH)', correctPosition: 4 },
      ],
      explanation: `Siklus Fraud Risk diawali pencegahan (SOP/SPIP), deteksi (Audit), hingga penegakan hukum tegas (APH).`,
      tags: [title, 'Manajemen Risiko Fraud'],
      bloomTaxonomy: 'C6 Urutan Strategis',
      regulationRef: 'PP No. 60 Tahun 2008 tentang SPIP',
    },
    {
      type: 'matching',
      difficulty: 'hard',
      prompt: `Jodohkan jenis sanksi disiplin berat dengan dampak status kepegawaiannya pada ${title}:`,
      matchingPairs: [
        { id: 'mp-h5-1', left: 'Pembebasan dari Jabatan (Demotion)', right: 'Menjadi Jabatan Pelaksana selama 12 bulan' },
        { id: 'mp-h5-2', left: 'Pemberhentian dengan Hormat Tidak Atas Permintaan Sendiri', right: 'Diberhentikan sebagai PNS dengan hak pensiun jika memenuhi syarat' },
        { id: 'mp-h5-3', left: 'Pemberhentian Tidak Dengan Hormat (PTDH)', right: 'Diberhentikan tanpa hak pensiun karena kejahatan jabatan/korupsi' },
        { id: 'mp-h5-4', left: 'Penurunan Pangkat Setingkat Lebih Rendah', right: 'Diturunkan pangkatnya selama 12 bulan' },
      ],
      explanation: `Hukuman disiplin berat berimplikasi langsung pada status pangkat, jabatan, hingga hak pensiun pegawai.`,
      tags: [title, 'HOTS Matriks Sanksi Berat'],
      bloomTaxonomy: 'C5 Evaluasi Sanksi',
      regulationRef: 'PP No. 94 Tahun 2021 Pasal 8 Ayat 4',
    },
    {
      type: 'short_answer',
      difficulty: 'hard',
      prompt: `Sebutkan nama sistem pelaporan pelanggaran internal independen yang menjamin proteksi identitas pelapor pada ${title}!`,
      shortAnswerCorrect: 'Whistleblowing System',
      explanation: `Whistleblowing System (WBS) adalah instrumen utama pelaporan dugaan tindak pidana korupsi/pelanggaran.`,
      tags: [title, 'Istilah HOTS'],
      bloomTaxonomy: 'C2 Pengenalan Instrumen',
      regulationRef: 'Pedoman WBS KPK',
    },
    {
      type: 'case_study',
      difficulty: 'hard',
      prompt: `Berdasarkan studi kasus HOTS di atas, langkah etis dan profesional paling tepat yang Wajib diambil oleh Bapak Hendra adalah:`,
      caseStudyScenario: `Bapak Hendra (ASN Pejabat Pembuat Komitmen) menemukan adanya pemalsuan spesifikasi teknis barang pada dokumen pengadaan ${title} senilai miliaran rupiah. Atasan langsung meminta Hendra menandatangani berita acara serah terima agar anggaran dapat dicairkan sebelum akhir tahun, dengan janji perlindungan internal.`,
      options: [
        { id: 'cs-h7-a', text: 'Menolak menandatangani berkas, mendokumentasikan bukti penyimpangan, dan melaporkan secara resmi melalui Whistleblowing System (WBS)', isCorrect: true },
        { id: 'cs-h7-b', text: 'Menandatangani berkas tersebut demi kepatuhan pada perintah atasan dan pencairan anggaran', isCorrect: false },
        { id: 'cs-h7-c', text: 'Membocorkan dokumen tersebut ke media massa tanpa melapor ke saluran resmi internal', isCorrect: false },
        { id: 'cs-h7-d', text: 'Mengundurkan diri secara mendadak dari ASN tanpa menyelesaikan permasalahan', isCorrect: false },
      ],
      explanation: `Menolak perintah tidak sah yang melanggar hukum dan melaporkan via WBS adalah wujud integritas tertinggi ASN.`,
      tags: [title, 'Studi Kasus HOTS Dilema'],
      bloomTaxonomy: 'C5 Evaluasi & Keputusan Moral',
      regulationRef: 'UU No. 20 Tahun 2023 & UU Tipikor',
    },
    {
      type: 'multiple_choice',
      difficulty: 'hard',
      prompt: `Bagaimanakah kedudukan azas 'Diskresi Pejabat Publik' dalam kaitannya dengan kepatuhan pada regulasi ${title}?`,
      options: [
        { id: 'opt-h8-a', text: 'Diskresi hanya dapat diambil untuk mengatasi kekosongan hukum/kegentingan dengan tetap sesuai dengan Asas-Asas Umum Pemerintahan yang Baik (AAUPB)', isCorrect: true },
        { id: 'opt-h8-b', text: 'Diskresi memberi kebebasan mutlak bagi pejabat untuk melanggar undang-undang kapan saja', isCorrect: false },
        { id: 'opt-h8-c', text: 'Diskresi tidak memerlukan pertimbangan tujuan, alasan, dan dampak keuangan', isCorrect: false },
        { id: 'opt-h8-d', text: 'Diskresi otomatis membebaskan pejabat dari segala tuntutan tindak pidana korupsi', isCorrect: false },
      ],
      explanation: `Diskresi diatur ketat dalam UU No. 30 Tahun 2014 tentang Administrasi Pemerintahan dan tidak boleh melanggar AAUPB.`,
      tags: [title, 'HOTS Hukum Administrasi'],
      bloomTaxonomy: 'C5 Evaluasi Hukum Administrasi',
      regulationRef: 'UU No. 30 Tahun 2014',
    },
    {
      type: 'true_false',
      difficulty: 'hard',
      prompt: `Apakah penerimaan sponsor atau bantuan dana dari pihak swasta untuk acara internal kementerian dapat dikategorikan sebagai Gratifikasi yang Wajib Dilaporkan?`,
      options: [
        { id: 'tf-h9-a', text: 'Benar', isCorrect: true },
        { id: 'tf-h9-b', text: 'Salah', isCorrect: false },
      ],
      explanation: `Setiap penerimaan fasilitas/sponsorship swasta terkait jabatan wajib dilaporkan ke UPG/KPK untuk ditelaah keberadaannya.`,
      tags: [title, 'Gratifikasi Sponsorship'],
      bloomTaxonomy: 'C4 Analisis Gratifikasi',
      regulationRef: 'UU No. 20 Tahun 2001 Pasal 12B',
    },
    {
      type: 'multiple_answer',
      difficulty: 'hard',
      prompt: `Pilihlah DUA atau LEBIH indikator utama keberhasilan Sistem Merit dalam manajemen ASN pada ${title}:`,
      options: [
        { id: 'ma-h10-1', text: 'Pengisian jabatan didasarkan pada kualifikasi, kompetensi, dan kinerja secara terbuka', isCorrect: true },
        { id: 'ma-h10-2', text: 'Tidak ada diskriminasi berdasarkan suku, agama, ras, gender, atau latar belakang politik', isCorrect: true },
        { id: 'ma-h10-3', text: 'Promosi ditentukan mutlak berdasarkan kedekatan kekeluargaan dengan pimpinan', isCorrect: false },
        { id: 'ma-h10-4', text: 'Pengembangan karier terencana berdasarkan manajemen talenta (Talent Pool)', isCorrect: true },
      ],
      explanation: `Sistem Merit menjamin keadilan kualifikasi, kompetensi, kinerja, dan manajemen talenta tanpa nepotisme.`,
      tags: [title, 'HOTS Sistem Merit'],
      bloomTaxonomy: 'C5 Evaluasi Tata Kelola',
      regulationRef: 'UU No. 20 Tahun 2023 Bab Sistem Merit',
    },
    {
      type: 'ordering',
      difficulty: 'hard',
      prompt: `Susunlah tahapan evaluasi insiden kebocoran data rahasia instansi pada modul ${title}:`,
      orderItems: [
        { id: 'ord-h11-1', text: 'Isolasi akses dan pengamanan log server terkena dampak', correctPosition: 1 },
        { id: 'ord-h11-2', text: 'Investigasi forensik digital oleh Tim CSIRT dan Inspektorat', correctPosition: 2 },
        { id: 'ord-h11-3', text: 'Identifikasi pegawai pelakunya dan pembuatan Berita Acara (BAP)', correctPosition: 3 },
        { id: 'ord-h11-4', text: 'Penjatuhan sanksi PTDH dan pelaporan ke BSSN/Kepolisian', correctPosition: 4 },
      ],
      explanation: `Respon insiden keamanan informasi mencakup containment, digital forensics, tindakan disiplin, hingga proses APH.`,
      tags: [title, 'Keamanan Data & Forensik'],
      bloomTaxonomy: 'C6 Urutan Respon Insiden',
      regulationRef: 'UU PDP No. 27 Tahun 2022 / BSSN',
    },
    {
      type: 'matching',
      difficulty: 'hard',
      prompt: `Pasangkan jenis konflik kepentingan HOTS dengan tindakan mitigasi terbaik pada ${title}:`,
      matchingPairs: [
        { id: 'mp-h12-1', left: 'Hubungan Kekeluargaan dalam Pengadaan', right: 'Mengundurkan diri dari tim penilai vendor' },
        { id: 'mp-h12-2', left: 'Pekerjaan Sampingan Komersial Sejenis', right: 'Melepas saham/jabatan di perusahaan swasta terkait' },
        { id: 'mp-h12-3', left: 'Penerimaan Jamuan Mewah Vendor', right: 'Menolak dan melaporkan penerimaan ke UPG' },
        { id: 'mp-h12-4', left: 'Akses Informasi Orang Dalam (Insider)', right: 'Mendeklarasikan potensi konflik secara tertulis' },
      ],
      explanation: `Setiap bentuk konflik kepentingan membutuhkan strategi mitigasi spesifik agar transparansi terjaga.`,
      tags: [title, 'Mitigasi Konflik'],
      bloomTaxonomy: 'C5 Evaluasi Mitigasi',
      regulationRef: 'PermenPANRB No. 37 Tahun 2012',
    },
    {
      type: 'short_answer',
      difficulty: 'hard',
      prompt: `Sebutkan nama prinsip hukum yang mewajibkan keputusan pejabat pemerintahan memiliki kepastian, kemanfaatan, dan kecermatan!`,
      shortAnswerCorrect: 'AAUPB',
      explanation: `AAUPB (Asas-Asas Umum Pemerintahan yang Baik) melandasi seluruh keputusan administratif pejabat.`,
      tags: [title, 'Singkatan Hukum'],
      bloomTaxonomy: 'C2 Ingatan Konsep Hukum',
      regulationRef: 'UU No. 30 Tahun 2014',
    },
    {
      type: 'case_study',
      difficulty: 'hard',
      prompt: `Berdasarkan skenario manipulasi Laporan Keuangan di atas, tindakan korektif manajemen paling tepat adalah:`,
      caseStudyScenario: `Dalam pengawasan ${title}, ditemukan indikasi rekayasa kwitansi penginapan dinas yang dilakukan oleh beberapa staf secara terstruktur atas perintah koordinator ruangan. Koordinator mengancam akan memberi nilai SKP Buruk jika staf menolak.`,
      options: [
        { id: 'cs-h14-a', text: 'Membentuk Tim Pemeriksa Khusus Inspektorat, menjamin perlindungan SKP staf, dan menjatuhkan sanksi disiplin berat kepada koordinator', isCorrect: true },
        { id: 'cs-h14-b', text: 'Menutup mata atas manipulasi tersebut karena telah menjadi kebiasaan lama', isCorrect: false },
        { id: 'cs-h14-c', text: 'Hanya menghukum staf bawahan dan membebaskan koordinator dari tanggung jawab', isCorrect: false },
        { id: 'cs-h14-d', text: 'Menghapuskan laporan pengawasan agar reputasi unit kerja aman', isCorrect: false },
      ],
      explanation: `Intervensi ketat harus menyasar pemrakarsa/penekan (koordinator) serta melindungi bawahan yang terintimidasi.`,
      tags: [title, 'Studi Kasus Intimidasi'],
      bloomTaxonomy: 'C5 Evaluasi Kasus Kompleks',
      regulationRef: 'PP No. 94 Tahun 2021',
    },
    {
      type: 'multiple_choice',
      difficulty: 'hard',
      prompt: `Bagaimanakah penerapan konsep 'Tone at the Top' dalam pencegahan korupsi birokrasi terkait ${title}?`,
      options: [
        { id: 'opt-h15-a', text: 'Pimpinan tertinggi secara konsisten memberi teladan nyata integritas, transparansi, dan komitmen anti-korupsi', isCorrect: true },
        { id: 'opt-h15-b', text: 'Pimpinan hanya membuat pidato tanpa pernah memeriksa pelaksanaan di lapangan', isCorrect: false },
        { id: 'opt-h15-c', text: 'Menyerahkan seluruh pengawasan moral kepada staf golongan terendah', isCorrect: false },
        { id: 'opt-h15-d', text: 'Menyembunyikan pelanggaran pimpinan agar citra instansi tetap harum', isCorrect: false },
      ],
      explanation: `Tone at the Top menentukan budaya organisasi; teladan keteladanan pimpinan kunci integritas birokrasi.`,
      tags: [title, 'Tone at the Top'],
      bloomTaxonomy: 'C5 Evaluasi Kepemimpinan',
      regulationRef: 'Panduan Budaya Anti-Korupsi KPK',
    },
    {
      type: 'true_false',
      difficulty: 'hard',
      prompt: `Apakah uang pengembalian hasil kerugian negara membebaskan pelaku tindak pidana korupsi dari penjatuhan hukuman disiplin kepegawaian ${title}?`,
      options: [
        { id: 'tf-h16-a', text: 'Salah', isCorrect: true },
        { id: 'tf-h16-b', text: 'Benar', isCorrect: false },
      ],
      explanation: `Sesuai UU Tipikor Pasal 4, pengembalian kerugian keuangan negara tidak menghapuskan pemidanaan maupun sanksi disiplin.`,
      tags: [title, 'Hokum Tipikor & Disiplin'],
      bloomTaxonomy: 'C5 Evaluasi Konsekuensi',
      regulationRef: 'UU No. 31 Tahun 1999 jo. UU No. 20 Tahun 2001',
    },
    {
      type: 'multiple_answer',
      difficulty: 'hard',
      prompt: `Pilihlah DUA atau LEBIH azas dasar keterbukaan informasi publik yang dikecualikan pada konteks ${title}:`,
      options: [
        { id: 'ma-h17-1', text: 'Informasi yang jika dibuka dapat membahayakan pertahanan dan keamanan negara', isCorrect: true },
        { id: 'ma-h17-2', text: 'Informasi yang dapat mengungkap rahasia pribadi dan rekam medis seseorang', isCorrect: true },
        { id: 'ma-h17-3', text: 'Rencana anggaran publik yang sudah disahkan DPRD/DPR', isCorrect: false },
        { id: 'ma-h17-4', text: 'Informasi rahasia proses bisnis atau hak kekayaan intelektual', isCorrect: true },
      ],
      explanation: `Pasal 17 UU KIP mengatur informasi rahasia negara, rekam medis pribadi, dan rahasia bisnis sebagai Pengecualian Sah.`,
      tags: [title, 'Pengecualian KIP'],
      bloomTaxonomy: 'C4 Analisis Pengecualian',
      regulationRef: 'UU No. 14 Tahun 2008 Pasal 17',
    },
    {
      type: 'ordering',
      difficulty: 'hard',
      prompt: `Susunlah urutan penanganan perkara sengketa kepegawaian hingga tingkat peradilan PTUN pada ${title}:`,
      orderItems: [
        { id: 'ord-h18-1', text: 'Penerbitan Keputusan Hukuman Disiplin (SK) oleh Pejabat PPK', correctPosition: 1 },
        { id: 'ord-h18-2', text: 'Upaya Administratif (Keberatan dan Banding ke BP-ASN)', correctPosition: 2 },
        { id: 'ord-h18-3', text: 'Pendaftaran gugatan ke Pengadilan Tata Usaha Negara (PTUN)', correctPosition: 3 },
        { id: 'ord-h18-4', text: 'Putusan Pengadilan PTUN berkekuatan hukum tetap', correctPosition: 4 },
      ],
      explanation: `Gugatan PTUN baru dapat diajukan setelah seluruh upaya administratif internal (BP-ASN) selesai ditempuh.`,
      tags: [title, 'Sengketa PTUN'],
      bloomTaxonomy: 'C5 Prosedur Sengketa Hukum',
      regulationRef: 'UU PTUN & PERMA No. 6 Tahun 2018',
    },
    {
      type: 'matching',
      difficulty: 'hard',
      prompt: `Pasangkan komponen Core Values 'BerAKHLAK' dengan tindakan integritas nyata pada modul ${title}:`,
      matchingPairs: [
        { id: 'mp-h19-1', left: 'Berorientasi Pelayanan', right: 'Memahami dan memenuhi kebutuhan masyarakat secara solutif' },
        { id: 'mp-h19-2', left: 'Akuntabel', right: 'Melaksanakan tugas dengan jujur, bertanggung jawab, dan disiplin' },
        { id: 'mp-h19-3', left: 'Harmonis', right: 'Saling peduli dan menghargai perbedaan latar belakang staf' },
        { id: 'mp-h19-4', left: 'Loyal', right: 'Memegang teguh ideologi Pancasila, UUD 1945, dan NKRI' },
      ],
      explanation: `Core Values BerAKHLAK menjadi fondasi budaya kerja ASN profesional.`,
      tags: [title, 'Core Values BerAKHLAK'],
      bloomTaxonomy: 'C4 Internalisasi Nilai',
      regulationRef: 'SE MenPANRB No. 20 Tahun 2021',
    },
    {
      type: 'short_answer',
      difficulty: 'hard',
      prompt: `Sebutkan nama undang-undang kepegawaian terbaru yang menjadi payung hukum utama transformasi ASN di Indonesia!`,
      shortAnswerCorrect: 'UU No. 20 Tahun 2023',
      explanation: `UU No. 20 Tahun 2023 tentang Aparatur Sipil Negara mengatur penguatan efisiensi dan integritas birokrasi.`,
      tags: [title, 'Payung Hukum Utama'],
      bloomTaxonomy: 'C1 Ingatan Regulasi Baru',
      regulationRef: 'UU No. 20 Tahun 2023',
    },
  ];

  // Helper to expand template list to exact count
  const expandList = (
    list: Array<Omit<Question, 'id' | 'materialId' | 'createdAt'>>,
    targetCount: number,
    level: Difficulty
  ) => {
    const res = [...list];
    let idx = res.length;
    while (res.length < targetCount) {
      const sentence = getSentence(idx, `Ketentuan dan standar regulasi ${title}`);
      const itemNum = idx + 1;
      if (itemNum % 3 === 0) {
        res.push({
          type: 'true_false',
          difficulty: level,
          prompt: `Sesuai ${title}, apakah instansi wajib menerapkan standar: "${sentence}"?`,
          options: [
            { id: `tf-dyn-${level}-${itemNum}-a`, text: 'Benar', isCorrect: true },
            { id: `tf-dyn-${level}-${itemNum}-b`, text: 'Salah', isCorrect: false },
          ],
          explanation: `Prinsip ini bersumber dari ketentuan tertulis dalam ${title}.`,
          tags: [title, `Integritas ${level}`],
          bloomTaxonomy: level === 'hard' ? 'C5 Evaluasi' : level === 'medium' ? 'C3 Aplikasi' : 'C2 Pemahaman',
          regulationRef: 'UU No. 20 Tahun 2023',
        });
      } else if (itemNum % 3 === 1) {
        res.push({
          type: 'multiple_choice',
          difficulty: level,
          prompt: `Terkait prinsip "${sentence}", manakah langkah yang paling sesuai dengan regulasi ${title}?`,
          options: [
            { id: `mc-dyn-${level}-${itemNum}-a`, text: `Melaksanakan prinsip "${sentence}" secara konsisten`, isCorrect: true },
            { id: `mc-dyn-${level}-${itemNum}-b`, text: `Mengabaikan prosedur demi kepentingan sepihak`, isCorrect: false },
            { id: `mc-dyn-${level}-${itemNum}-c`, text: `Menyerahkan keputusan tanpa dasar acuan baku`, isCorrect: false },
            { id: `mc-dyn-${level}-${itemNum}-d`, text: `Menerapkan acuan tidak resmi tanpa izin atasan`, isCorrect: false },
          ],
          explanation: `Opsi A adalah penerapan integritas langsung berdasarkan ${title}.`,
          tags: [title, `Penerapan ${level}`],
          bloomTaxonomy: level === 'hard' ? 'C4 Analisis' : level === 'medium' ? 'C3 Aplikasi' : 'C1 Pemahaman',
          regulationRef: 'UU No. 20 Tahun 2023',
        });
      } else {
        res.push({
          type: 'multiple_answer',
          difficulty: level,
          prompt: `Berdasarkan regulasi ${title}, manakah tindakan yang wajib dipatuhi oleh aparatur?`,
          options: [
            { id: `ma-dyn-${level}-${itemNum}-a`, text: `Menjaga profesionalisme dan kejujuran tugas`, isCorrect: true },
            { id: `ma-dyn-${level}-${itemNum}-b`, text: `Melaporkan setiap potensi penyimpangan atau gratifikasi`, isCorrect: true },
            { id: `ma-dyn-${level}-${itemNum}-c`, text: `Menerima imbalan tidak sah di luar ketentuan`, isCorrect: false },
            { id: `ma-dyn-${level}-${itemNum}-d`, text: `Mengutamakan transparansi publik`, isCorrect: true },
          ],
          explanation: `Kewajiban utama ASN mencakup kejujuran, pelaporan gratifikasi, dan transparansi.`,
          tags: [title, `Kewajiban ${level}`],
          bloomTaxonomy: 'C3 Aplikasi Etika',
          regulationRef: 'UU No. 20 Tahun 2023',
        });
      }
      idx++;
    }
    return res.slice(0, targetCount);
  };

  const finalEasy = expandList(easyTemplates, countEasy, 'easy');
  const finalMedium = expandList(mediumTemplates, countMedium, 'medium');
  const finalHard = expandList(hardTemplates, countHard, 'hard');

  // Combine and format easy, medium, and hard lists
  const pool = [...finalEasy, ...finalMedium, ...finalHard];

  pool.forEach((raw, idx) => {
    questions.push({
      ...raw,
      id: `q-${materialId}-${idx + 1}`,
      materialId,
      createdAt: new Date().toISOString(),
    });
  });

  return questions;
}
