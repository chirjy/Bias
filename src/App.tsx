import React, { useState, useEffect } from 'react';
import { Material, QuizSession } from './types';
import { Navbar } from './components/Navbar';
import { MaterialBankList } from './components/MaterialBankList';
import { MaterialUploader } from './components/MaterialUploader';
import { QuestionEditor } from './components/QuestionEditor';
import { HostLobby } from './components/HostLobby';
import { HostLiveRoom } from './components/HostLiveRoom';
import { ParticipantView } from './components/ParticipantView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ExportImportModal } from './components/ExportImportModal';
import { Lock, Key, X, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'materials' | 'upload' | 'host' | 'analytics' | 'participant'>('participant');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [hostMaterial, setHostMaterial] = useState<Material | undefined>(undefined);
  const [activeHostSession, setActiveHostSession] = useState<QuizSession | null>(null);
  const [exportMaterial, setExportMaterial] = useState<Material | null>(null);
  const [participantPin, setParticipantPin] = useState<string>('');

  // Admin Security Modal State
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [inputPasscode, setInputPasscode] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaterials();

    // Read params from URL query
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin');
    const modeParam = params.get('mode');

    const isHostAuth = sessionStorage.getItem('mentiquiz_host_auth') === 'true';

    if (pinParam) {
      setParticipantPin(pinParam);
      setCurrentTab('participant');
    } else if (modeParam === 'admin' || isHostAuth) {
      setCurrentTab('materials');
    } else {
      // Default to participant view for published public visitors
      setCurrentTab('participant');
    }
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/materials');
      const data = await res.json();
      setMaterials(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdminAccess = () => {
    const isHostAuth = sessionStorage.getItem('mentiquiz_host_auth') === 'true';
    if (isHostAuth) {
      setCurrentTab('materials');
    } else {
      setInputPasscode('');
      setPasscodeError(null);
      setShowAdminAuthModal(true);
    }
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    // Default Admin PIN passcode is 1234 or admin
    if (inputPasscode === '1234' || inputPasscode.toLowerCase() === 'admin') {
      sessionStorage.setItem('mentiquiz_host_auth', 'true');
      setShowAdminAuthModal(false);
      setCurrentTab('materials');
    } else {
      setPasscodeError('PIN Admin salah. Gunakan PIN standar: 1234');
    }
  };

  const handleUploadSuccess = (newMat: Material) => {
    setMaterials((prev) => [newMat, ...prev]);
    setCurrentTab('materials');
  };

  const handleRegenerateBank = async (id: string) => {
    try {
      await fetch(`/api/questions/regenerate-bank/${id}`, { method: 'POST' });
      await fetchMaterials();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLaunchHost = (mat?: Material) => {
    setHostMaterial(mat);
    setCurrentTab('host');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* If in active Host Live Session, render HostLiveRoom full screen */}
      {activeHostSession ? (
        <HostLiveRoom
          session={activeHostSession}
          onClose={() => setActiveHostSession(null)}
        />
      ) : currentTab === 'participant' ? (
        <ParticipantView
          initialPin={participantPin}
          onExit={() => setCurrentTab('materials')}
          onRequestHostAccess={handleOpenAdminAccess}
        />
      ) : (
        <>
          <Navbar
            currentTab={currentTab}
            setCurrentTab={(tab) => {
              setEditingMaterial(null);
              setCurrentTab(tab);
            }}
            activeSessionPin={activeHostSession?.pin}
          />

          <main className="pb-16">
            {editingMaterial ? (
              <QuestionEditor
                material={editingMaterial}
                onBack={() => setEditingMaterial(null)}
              />
            ) : currentTab === 'materials' ? (
              <MaterialBankList
                materials={materials}
                onSelectMaterial={(mat) => setEditingMaterial(mat)}
                onLaunchHostSession={(mat) => handleLaunchHost(mat)}
                onRegenerateBank={handleRegenerateBank}
                onDeleteMaterial={handleDeleteMaterial}
                onExportMaterial={(mat) => setExportMaterial(mat)}
                onOpenUpload={() => setCurrentTab('upload')}
              />
            ) : currentTab === 'upload' ? (
              <MaterialUploader
                onUploadSuccess={handleUploadSuccess}
                onCancel={() => setCurrentTab('materials')}
              />
            ) : currentTab === 'host' ? (
              <HostLobby
                materials={materials}
                initialMaterial={hostMaterial}
                onSessionCreated={(session) => setActiveHostSession(session)}
                onCancel={() => setCurrentTab('materials')}
              />
            ) : currentTab === 'analytics' ? (
              <AnalyticsDashboard />
            ) : null}
          </main>

          {/* Export / Import Modal */}
          {exportMaterial && (
            <ExportImportModal
              material={exportMaterial}
              onClose={() => setExportMaterial(null)}
              onImportSuccess={fetchMaterials}
            />
          )}
        </>
      )}

      {/* Admin Passcode Authentication Modal */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setShowAdminAuthModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Akses Mode Host / Admin</h3>
              <p className="text-xs text-slate-400 mt-1">Masukkan PIN Host untuk mengelola bank soal</p>
            </div>

            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              {passcodeError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs text-center font-medium">
                  {passcodeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  PIN Passcode Admin:
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    value={inputPasscode}
                    onChange={(e) => setInputPasscode(e.target.value)}
                    placeholder="Masukkan PIN (Contoh: 1234)"
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  PIN bawaan untuk pengajar: <strong className="text-indigo-400 font-mono">1234</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Lock className="w-3.5 h-3.5" /> Masuk Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
