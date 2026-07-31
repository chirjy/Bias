import React, { useState } from 'react';
import { Material, Question } from '../types';
import { Download, Upload, FileText, CheckCircle2, AlertCircle, X, Printer } from 'lucide-react';

interface ExportImportModalProps {
  material?: Material;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({ material, onClose, onImportSuccess }) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleExportJson = async () => {
    if (!material) return;
    try {
      const res = await fetch(`/api/materials/export/${material.id}`);
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Soal_${material.title.replace(/\s+/g, '_')}.json`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCsv = async () => {
    if (!material) return;
    try {
      const res = await fetch(`/api/questions/material/${material.id}`);
      const questions: Question[] = await res.json();

      let csv = 'ID,Kesulitan,Tipe,Pertanyaan,KunciJawaban,Penjelasan\n';
      questions.forEach((q) => {
        const correctOpt = q.options?.find((o) => o.isCorrect)?.text || q.shortAnswerCorrect || '';
        const cleanPrompt = (q.prompt || '').replace(/"/g, '""');
        const cleanExp = (q.explanation || '').replace(/"/g, '""');
        csv += `"${q.id}","${q.difficulty}","${q.type}","${cleanPrompt}","${correctOpt}","${cleanExp}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Soal_${material.title.replace(/\s+/g, '_')}.csv`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintPdf = async () => {
    if (!material) return;
    const res = await fetch(`/api/questions/material/${material.id}`);
    const questions: Question[] = await res.json();

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    let html = `
      <html>
        <head>
          <title>Bank Soal - ${material.title}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.5; color: #111; }
            h1 { text-align: center; margin-bottom: 5px; }
            p.sub { text-align: center; color: #555; font-size: 14px; margin-bottom: 30px; }
            .question-box { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 8px; page-break-inside: avoid; }
            .q-title { font-weight: bold; font-size: 15px; margin-bottom: 8px; }
            .badge { display: inline-block; padding: 2px 8px; font-size: 10px; background: #eee; border-radius: 4px; font-weight: bold; margin-bottom: 8px; }
            .options { margin-left: 20px; font-size: 13px; }
            .explanation { margin-top: 10px; font-size: 12px; background: #f9f9f9; padding: 8px; border-left: 3px solid #6366f1; }
          </style>
        </head>
        <body>
          <h1>Bank Soal Resmi: ${material.title}</h1>
          <p class="sub">Total ${questions.length} Soal HOTS • Mentiquiz AI Platform</p>
    `;

    questions.forEach((q, idx) => {
      html += `
        <div class="question-box">
          <div class="badge">${q.difficulty.toUpperCase()} • ${q.type.toUpperCase()}</div>
          <div class="q-title">${idx + 1}. ${q.prompt}</div>
      `;

      if (q.options) {
        html += '<div class="options"><ul>';
        q.options.forEach((o) => {
          html += `<li>${o.text} ${o.isCorrect ? '<strong>(Kunci Jawaban)</strong>' : ''}</li>`;
        });
        html += '</ul></div>';
      }

      html += `<div class="explanation"><strong>Penjelasan:</strong> ${q.explanation}</div></div>`;
    });

    html += `</body></html>`;

    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  };

  const handleImportJsonSubmit = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await fetch('/api/materials/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (res.ok) {
        setImportMessage(`Berhasil mengimpor ${data.questionsCount} soal!`);
        setTimeout(() => {
          onImportSuccess();
          onClose();
        }, 1000);
      } else {
        setImportMessage('Gagal impor: ' + data.error);
      }
    } catch (e: any) {
      setImportMessage('Format JSON tidak valid: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Header */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'export' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" /> Export Soal
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'import' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" /> Import Soal
          </button>
        </div>

        {activeTab === 'export' ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Pilih format ekspor bank soal untuk materi <strong className="text-white">{material?.title}</strong>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleExportJson}
                className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 text-left space-y-1 group transition-all"
              >
                <Download className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-xs text-white">Format JSON</p>
                <p className="text-[10px] text-slate-400">Lengkap dengan metadata</p>
              </button>

              <button
                onClick={handleExportCsv}
                className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 text-left space-y-1 group transition-all"
              >
                <FileText className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-xs text-white">Format CSV</p>
                <p className="text-[10px] text-slate-400">Tabel Excel / Spreadsheet</p>
              </button>

              <button
                onClick={handlePrintPdf}
                className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 text-left space-y-1 group transition-all"
              >
                <Printer className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-xs text-white">Cetak PDF / Word</p>
                <p className="text-[10px] text-slate-400">Tampilan siap cetak</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Tempelkan struktur data JSON bank soal yang ingin diimpor ke dalam sistem:
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              rows={8}
              placeholder='{\n  "material": { "title": "Materi Impor Contoh" },\n  "questions": [ ... ]\n}'
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs font-mono text-white outline-none focus:border-indigo-500"
            />

            {importMessage && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs">
                {importMessage}
              </div>
            )}

            <button
              onClick={handleImportJsonSubmit}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-600/30"
            >
              Proses Import Bank Soal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
