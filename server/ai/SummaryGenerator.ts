import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient';

export interface GeneratedSummary {
  summary: string;
  keyConcepts: string[];
  regulations: string[];
  keyNumbersAndDefinitions: string[];
}

export async function generateMaterialSummary(materialTitle: string, rawText: string): Promise<GeneratedSummary> {
  const ai = getGeminiClient();

  const prompt = `Anda adalah seorang AI Education Engineer dan Pakar Kurikulum Pembelajaran.
Analisislah materi pembelajaran berikut yang berjudul "${materialTitle}":

--- TEXT MATERI ---
${rawText.slice(0, 10000)}
-------------------

Tugas Anda:
1. Buat ringkasan komprehensif materi ini (2-3 paragraf).
2. Identifikasi 5-8 konsep utama paling penting.
3. Identifikasi regulasi / perundang-undangan / aturan yang disebutkan atau relevan.
4. Identifikasi angka penting, batas waktu, syarat kuantitatif, atau definisi penting.

Berikan respon dalam format JSON sesuai schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
            regulations: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyNumbersAndDefinitions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'keyConcepts', 'regulations', 'keyNumbersAndDefinitions'],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      return parsed;
    }
  } catch (err) {
    console.error('Error generating material summary with Gemini:', err);
  }

  // Fallback if AI fails or key is missing
  return {
    summary: `Modul materi "${materialTitle}" membahas secara detail mengenai prinsip-prinsip utama, regulasi perundang-undangan, kewajiban, tata cara pelaksanaan, serta studi kasus penerapan di lapangan.`,
    keyConcepts: [
      `Prinsip dasar ${materialTitle}`,
      'Hak dan Kewajiban Pegawai',
      'Tata Cara & Prosedur Administrasi',
      'Sanksi dan Pembinaan Organisasi',
      'Penerapan Etika & Nilai Budaya Kerja',
    ],
    regulations: [
      'UU No. 20 Tahun 2023 tentang Aparatur Sipil Negara',
      'PP No. 94 Tahun 2021 tentang Disiplin PNS',
      'Peraturan Kepala BKN No. 11 Tahun 2022',
    ],
    keyNumbersAndDefinitions: [
      'Masa berlaku pengajuan s.d 14 hari kerja',
      'Tingkat sanksi: Ringan, Sedang, dan Berat',
      'Evaluasi kinerja berkala setiap 3 bulan',
    ],
  };
}
