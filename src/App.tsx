import { BellRing, UserCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EventsAndTrackerView } from './components/EventsAndTrackerView';
import { MediaVaultView } from './components/MediaVaultView';
import { PersonalNoteView } from './components/PersonalNoteView';
import { TopBar } from './components/TopBar';
import { VoiceMessageView } from './components/VoiceMessageView';
import { useRealtimeSocket } from './hooks/useRealtimeSocket';
import type { ActiveMenuTab, RealtimeNotification } from './types/app';
import { upsertById } from './utils/format';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveMenuTab>('galeri');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kenang_user_name');
      if (saved === 'Raka') {
        localStorage.setItem('kenang_user_name', 'Gani');
        return 'Gani';
      }
      if (saved === 'Alya') {
        localStorage.setItem('kenang_user_name', 'Fida');
        return 'Fida';
      }
      return saved || 'Gani';
    } catch {
      return 'Gani';
    }
  });
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(currentUser);
  const [toastNotif, setToastNotif] = useState<RealtimeNotification | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Listen for Google Maps Platform quota exhaustion events (Case A)
  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const handleIncomingNotification = useCallback((notif: RealtimeNotification) => {
    setToastNotif(notif);
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'granted' &&
      document.hidden
    ) {
      new window.Notification(notif.title, { body: notif.message });
    }
  }, []);

  useEffect(() => {
    if (!toastNotif) return;
    const t = window.setTimeout(() => setToastNotif(null), 6000);
    return () => window.clearTimeout(t);
  }, [toastNotif]);

  const { state, setState, isLoading, isConnected, googleMapsApiKey } = useRealtimeSocket(
    currentUser,
    handleIncomingNotification
  );

  const saveUserIdentity = (name: string) => {
    const clean = name.trim() || 'Gani';
    setCurrentUser(clean);
    setDraftName(clean);
    setEditingName(false);
    try {
      localStorage.setItem('kenang_user_name', clean);
    } catch {
      // ignore storage errors
    }
  };

  const handleMarkAllRead = async () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.readBy.includes(currentUser) ? n : { ...n, readBy: [...n.readBy, currentUser] }
      ),
    }));
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: currentUser }),
      });
    } catch {
      // ignore error
    }
  };

  const handleOpenEventFromNotification = (eventId?: string) => {
    if (eventId) setSelectedEventId(eventId);
    setActiveTab('acara');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F8F6] text-zinc-900">
      {/* Google Maps Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        notifications={state.notifications}
        currentUser={currentUser}
        isConnected={isConnected}
        onMarkAllRead={handleMarkAllRead}
        onOpenEventFromNotification={handleOpenEventFromNotification}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* Workspace Identity Strip (below header, keeping TopBar 3-zone contract clean) */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-zinc-600">
            <UserCheck className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <span>
              Masuk sebagai <strong className="text-zinc-900">{currentUser}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>Sinkronisasi real-time {isConnected ? 'terhubung' : 'menghubungkan'}</span>
          </div>

          <div className="flex items-center gap-2">
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveUserIdentity(draftName);
                }}
                className="flex items-center gap-1.5"
              >
                <label htmlFor="identity-input" className="sr-only">
                  Nama tampilan Anda
                </label>
                <input
                  id="identity-input"
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 font-semibold bg-teal-700 text-white rounded-md hover:bg-teal-800 cursor-pointer"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="px-2 py-1 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  Batal
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 hidden sm:inline">Ganti peran cepat:</span>
                <button
                  type="button"
                  onClick={() => saveUserIdentity('Gani')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    currentUser === 'Gani'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
                  }`}
                >
                  Gani
                </button>
                <button
                  type="button"
                  onClick={() => saveUserIdentity('Fida')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    currentUser === 'Fida'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
                  }`}
                >
                  Fida
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(currentUser);
                    setEditingName(true);
                  }}
                  className="px-2.5 py-1 text-teal-800 hover:underline font-medium cursor-pointer"
                >
                  Ubah Nama
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Viewport Content */}
        {isLoading ? (
          <div className="space-y-6" aria-label="Memuat data aplikasi">
            <div className="h-10 w-64 bg-stone-200/70 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-72 bg-white border border-stone-200 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'galeri' && (
              <MediaVaultView
                media={state.media}
                currentUser={currentUser}
                onMediaCreated={(item) =>
                  setState((prev) => ({
                    ...prev,
                    media: upsertById(prev.media, item, true),
                  }))
                }
                onMediaDeleted={(id) =>
                  setState((prev) => ({
                    ...prev,
                    media: prev.media.filter((m) => m.id !== id),
                  }))
                }
              />
            )}

            {activeTab === 'pesan-kata' && (
              <PersonalNoteView
                notes={state.notes}
                currentUser={currentUser}
                onNoteCreated={(note) =>
                  setState((prev) => ({
                    ...prev,
                    notes: upsertById(
                      prev.notes.map((n) => ({ ...n, isPinned: false })),
                      note,
                      true
                    ),
                  }))
                }
                onNotePinned={(id) =>
                  setState((prev) => ({
                    ...prev,
                    notes: prev.notes.map((n) => ({ ...n, isPinned: n.id === id })),
                  }))
                }
              />
            )}

            {activeTab === 'pesan-suara' && (
              <VoiceMessageView
                voiceMessages={state.voiceMessages}
                currentUser={currentUser}
                onVoiceCreated={(voice) =>
                  setState((prev) => ({
                    ...prev,
                    voiceMessages: upsertById(prev.voiceMessages, voice, true),
                  }))
                }
                onVoiceDeleted={(id) =>
                  setState((prev) => ({
                    ...prev,
                    voiceMessages: prev.voiceMessages.filter((v) => v.id !== id),
                  }))
                }
              />
            )}

            {activeTab === 'acara' && (
              <EventsAndTrackerView
                events={state.events}
                locations={state.locations}
                currentUser={currentUser}
                googleMapsApiKey={googleMapsApiKey}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
                onEventCreated={(ev) =>
                  setState((prev) => ({
                    ...prev,
                    events: upsertById(prev.events, ev, true),
                  }))
                }
                onEventUpdated={(ev) =>
                  setState((prev) => ({
                    ...prev,
                    events: upsertById(prev.events, ev, false),
                  }))
                }
                onLocationUpdated={(loc) =>
                  setState((prev) => ({
                    ...prev,
                    locations: upsertById(prev.locations, loc, true),
                  }))
                }
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white/60 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <p>Kenang — Ruang penyimpanan foto, video, pesan personal, dan agenda lokasi bersama.</p>
          <p>Dapat dibuka langsung di Google Chrome dan dibagikan antar perangkat.</p>
        </div>
      </footer>

      {/* Real-time Notification Toast */}
      {toastNotif && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100%-2.5rem)] bg-zinc-900 text-white rounded-xl p-4 shadow-xl border border-zinc-800 flex items-start gap-3"
        >
          <BellRing className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs font-semibold text-white">{toastNotif.title}</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{toastNotif.message}</p>
            {toastNotif.eventId && (
              <button
                type="button"
                onClick={() => {
                  handleOpenEventFromNotification(toastNotif.eventId);
                  setToastNotif(null);
                }}
                className="text-xs font-semibold text-teal-300 hover:text-teal-200 underline underline-offset-2 cursor-pointer"
              >
                Lihat detail acara
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToastNotif(null)}
            aria-label="Tutup notifikasi"
            className="text-zinc-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
