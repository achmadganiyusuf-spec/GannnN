import { BookmarkCheck, PenLine, Quote, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { NoteTone, PersonalNote } from '../types/app';
import { formatRelativeTime, validatePersonalNoteInput } from '../utils/format';

interface PersonalNoteViewProps {
  notes: PersonalNote[];
  currentUser: string;
  onNoteCreated: (note: PersonalNote) => void;
  onNotePinned: (id: string) => void;
}

const TONE_LABELS: Record<NoteTone, string> = {
  hangat: 'Hangat',
  puitis: 'Puitis',
  santai: 'Santai',
};

export function PersonalNoteView({
  notes,
  currentUser,
  onNoteCreated,
  onNotePinned,
}: PersonalNoteViewProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [recipientName, setRecipientName] = useState('Fida');
  const [senderName, setSenderName] = useState(currentUser);
  const [tone, setTone] = useState<NoteTone>('hangat');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const featuredNote = notes.find((n) => n.isPinned) || notes[0] || null;
  const archiveNotes = notes.filter((n) => n.id !== featuredNote?.id);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErr = validatePersonalNoteInput({
      recipientName,
      senderName,
      message,
    });
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || `Untuk ${recipientName.trim()}`,
          recipientName: recipientName.trim(),
          senderName: senderName.trim(),
          tone,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal menyimpan pesan kata.');
        return;
      }
      onNoteCreated(data as PersonalNote);
      setTitle('');
      setMessage('');
      setComposerOpen(false);
    } catch {
      setFormError('Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinNote = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(id)}/pin`, {
        method: 'PATCH',
      });
      if (res.ok) {
        onNotePinned(id);
      }
    } catch {
      // ignore error
    }
  };

  return (
    <section aria-labelledby="pesan-kata-heading" className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 pb-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-teal-800 tracking-wide">
            Lembar Kata Personal · <span className="font-mono tabular-nums">{notes.length}</span>{' '}
            Pesan Tersimpan
          </p>
          <h1 id="pesan-kata-heading" className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Pesan Kata Untuk Seseorang
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Sampaikan kalimat tulus, surat singkat, atau sapaan bermakna bagi siapa saja yang membuka menu ini.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSenderName(currentUser);
            setFormError(null);
            setComposerOpen((prev) => !prev);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          {composerOpen ? (
            <>
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Tutup Penulis</span>
            </>
          ) : (
            <>
              <PenLine className="w-4 h-4" aria-hidden="true" />
              <span>Tulis Kalimat Baru</span>
            </>
          )}
        </button>
      </div>

      {/* Composer Panel */}
      {composerOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <h2 className="font-display text-xl font-semibold text-zinc-900">
              Tulis Kalimat untuk Penerima
            </h2>
            <div role="tablist" aria-label="Nuansa tulisan" className="inline-flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              {(['hangat', 'puitis', 'santai'] as NoteTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tone === t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    tone === t
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="note-recipient" className="block text-sm font-medium text-zinc-900 mb-1">
                Untuk (Penerima)
              </label>
              <input
                id="note-recipient"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nama penerima"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label htmlFor="note-sender" className="block text-sm font-medium text-zinc-900 mb-1">
                Dari (Pengirim)
              </label>
              <input
                id="note-sender"
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Nama Anda"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label htmlFor="note-title" className="block text-sm font-medium text-zinc-900 mb-1">
                Judul Pesan (opsional)
              </label>
              <input
                id="note-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Sebelum Hari Berakhir"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="note-message" className="block text-sm font-medium text-zinc-900 mb-1">
              Kalimat Kata-Kata
            </label>
            <textarea
              id="note-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tuliskan pesan tulus yang akan langsung terbaca saat dia membuka menu ini..."
              className="w-full px-4 py-3 text-base font-display border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700 leading-relaxed"
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-stone-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Menyimpan...' : 'Simpan & Tampilkan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Featured Personal Letter */}
      {featuredNote ? (
        <article className="bg-white border border-stone-200 rounded-2xl p-8 sm:p-12 space-y-6 max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold text-teal-800">Pesan Utama</span>
              <span aria-hidden="true">·</span>
              <span>Untuk {featuredNote.recipientName}</span>
              <span aria-hidden="true">·</span>
              <span>Dari {featuredNote.senderName}</span>
              <span aria-hidden="true">·</span>
              <span>Nuansa {TONE_LABELS[featuredNote.tone]}</span>
            </div>
            <span className="font-mono tabular-nums text-xs text-zinc-500">
              {formatRelativeTime(featuredNote.createdAt)}
            </span>
          </div>

          <div className="space-y-5">
            <Quote className="w-7 h-7 text-teal-700/60" aria-hidden="true" />
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
              {featuredNote.title}
            </h2>
            <p
              className={`font-display text-lg sm:text-2xl leading-relaxed text-zinc-800 whitespace-pre-line ${
                featuredNote.tone === 'puitis' ? 'italic' : ''
              }`}
            >
              {featuredNote.message}
            </p>
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-sm text-zinc-600">
            <span>
              Tertanda, <strong className="font-semibold text-zinc-900">{featuredNote.senderName}</strong>
            </span>
          </div>
        </article>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center space-y-3">
          <p className="font-display text-xl font-medium text-zinc-900">
            Belum ada kalimat kata-kata yang ditulis
          </p>
          <p className="text-sm text-zinc-600">
            Klik &ldquo;Tulis Kalimat Baru&rdquo; untuk meninggalkan pesan personal bagi seseorang yang membuka menu ini.
          </p>
        </div>
      )}

      {/* Archive of previous notes */}
      {archiveNotes.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-sans text-sm font-semibold text-zinc-700">
            Arsip Kalimat Lainnya ({archiveNotes.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {archiveNotes.map((note) => (
              <article
                key={note.id}
                className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                    <span>
                      Untuk <strong className="text-zinc-800">{note.recipientName}</strong> · Dari{' '}
                      {note.senderName}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatRelativeTime(note.createdAt)}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-zinc-900">
                    {note.title}
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                    {note.message}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handlePinNote(note.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-900 cursor-pointer"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Jadikan Pesan Utama</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
