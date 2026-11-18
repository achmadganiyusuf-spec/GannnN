import { Download, Mic, Pause, Play, Square, Trash2, Upload, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { VoiceMessage } from '../types/app';
import { formatAudioDuration, formatBytes, formatRelativeTime } from '../utils/format';

interface VoiceMessageViewProps {
  voiceMessages: VoiceMessage[];
  currentUser: string;
  onVoiceCreated: (voice: VoiceMessage) => void;
  onVoiceDeleted: (id: string) => void;
}

function VoicePlayerCard({
  voice,
  isPlaying,
  onTogglePlay,
  onDelete,
}: {
  voice: VoiceMessage;
  isPlaying: boolean;
  onTogglePlay: (id: string, audioEl: HTMLAudioElement | null) => void;
  onDelete: (id: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(voice.durationSec || 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!isPlaying && !el.paused) {
      el.pause();
    }
  }, [isPlaying]);

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <article className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
      <audio
        ref={audioRef}
        src={voice.audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setCurrentTime(0);
          onTogglePlay(voice.id, null);
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="font-medium text-teal-800">Dari {voice.senderName}</span>
            <span aria-hidden="true">·</span>
            <span>Untuk {voice.recipientName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{formatBytes(voice.sizeBytes)}</span>
          </div>
          <h3 className="font-display text-lg font-semibold text-zinc-900">{voice.title}</h3>
          {voice.note && <p className="text-sm text-zinc-600">{voice.note}</p>}
        </div>

        <span className="font-mono tabular-nums text-xs text-zinc-500">
          {formatRelativeTime(voice.createdAt)}
        </span>
      </div>

      {/* Custom Audio Scrubber */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onTogglePlay(voice.id, audioRef.current)}
          aria-label={isPlaying ? `Jeda ${voice.title}` : `Putar ${voice.title}`}
          className="w-11 h-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            aria-label={`Posisi audio ${voice.title}`}
            onChange={(e) => {
              const nextTime = Number(e.target.value);
              setCurrentTime(nextTime);
              if (audioRef.current) {
                audioRef.current.currentTime = nextTime;
              }
            }}
            style={{
              background: `linear-gradient(to right, #0F766E ${progressPct}%, #E7E5E4 ${progressPct}%)`,
            }}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-teal-700"
          />
          <div className="flex items-center justify-between font-mono tabular-nums text-[11px] text-zinc-500">
            <span>{formatAudioDuration(currentTime)}</span>
            <span>{formatAudioDuration(duration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Volume2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span className="truncate max-w-[180px]">{voice.fileName}</span>
        </div>

        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDelete(voice.id)}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
              >
                Hapus
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-md cursor-pointer"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Hapus pesan suara ${voice.title}`}
              className="p-2 text-zinc-400 hover:text-red-600 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <a
            href={`/api/voice/${encodeURIComponent(voice.id)}/download`}
            download={voice.fileName}
            aria-label={`Unduh pesan suara ${voice.title}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Unduh Audio</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export function VoiceMessageView({
  voiceMessages,
  currentUser,
  onVoiceCreated,
  onVoiceDeleted,
}: VoiceMessageViewProps) {
  const [title, setTitle] = useState('');
  const [recipientName, setRecipientName] = useState('Fida');
  const [note, setNote] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Browser MediaRecorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleTogglePlay = (id: string, audioEl: HTMLAudioElement | null) => {
    if (!audioEl) {
      setPlayingId(null);
      return;
    }
    if (playingId === id && !audioEl.paused) {
      audioEl.pause();
      setPlayingId(null);
    } else {
      setPlayingId(id);
      audioEl.play().catch(() => {
        setPlayingId(null);
      });
    }
  };

  const inspectAudioDuration = (file: File) => {
    const tempUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(tempUrl);
    tempAudio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(tempAudio.duration)) {
        setDetectedDuration(Math.max(1, Math.round(tempAudio.duration)));
      }
      URL.revokeObjectURL(tempUrl);
    });
  };

  const startRecording = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Perekam mikrofon tidak tersedia di browser ini. Silakan unggah file audio langsung.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };

      let secondsElapsed = 0;
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        secondsElapsed += 1;
        setRecordSeconds(secondsElapsed);
      }, 1000);

      recorder.onstop = () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const recordedFile = new File([blob], `rekaman-suara-${Date.now()}.webm`, {
          type: blob.type || 'audio/webm',
        });
        setAudioFile(recordedFile);
        setDetectedDuration(Math.max(1, secondsElapsed));
        if (!title) setTitle('Rekaman Suara Personal');
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('Izin mikrofon ditolak atau perangkat audio tidak ditemukan. Anda tetap dapat mengunggah file suara (.mp3, .wav, .m4a).');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      setErrorMsg('Pilih file suara atau rekam suara terlebih dahulu.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Judul pesan suara wajib diisi.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', title.trim());
      formData.append('senderName', currentUser);
      formData.append('recipientName', recipientName.trim() || 'Kamu');
      formData.append('note', note.trim());
      formData.append('durationSec', String(detectedDuration || 1));

      const res = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal mengunggah pesan suara.');
        return;
      }
      onVoiceCreated(data as VoiceMessage);
      setTitle('');
      setNote('');
      setAudioFile(null);
      setDetectedDuration(0);
    } catch {
      setErrorMsg('Gagal mengirim pesan suara ke server.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/voice/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onVoiceDeleted(id);
        if (playingId === id) setPlayingId(null);
      }
    } catch {
      // ignore error
    }
  };

  return (
    <section aria-labelledby="pesan-suara-heading" className="space-y-8">
      <div className="border-b border-stone-200 pb-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-teal-800 tracking-wide">
            Arsip Audio Personal · <span className="font-mono tabular-nums">{voiceMessages.length}</span>{' '}
            Pesan Suara
          </p>
          <h1 id="pesan-suara-heading" className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Unggah &amp; Dengarkan Pesan Suara
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Kirimkan rekaman suara atau unggah file audio agar pesan terasa jauh lebih hangat dan personal saat didengarkan penerima.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload / Record Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 space-y-5"
        >
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            Kirim Pesan Suara Baru
          </h2>

          {/* Audio Source Options: File Upload OR Mic Record */}
          <div className="space-y-3">
            <label
              htmlFor="voice-file-input"
              className="flex flex-col items-center justify-center gap-1.5 p-5 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50/70 hover:bg-stone-100/70 transition-colors cursor-pointer text-center"
            >
              <Upload className="w-5 h-5 text-teal-700" aria-hidden="true" />
              <span className="text-sm font-medium text-zinc-800">
                {audioFile ? audioFile.name : 'Pilih File Suara (.mp3, .wav, .m4a, .ogg)'}
              </span>
              <span className="text-xs text-zinc-500">
                {audioFile
                  ? `${formatBytes(audioFile.size)} · Durasi ${formatAudioDuration(detectedDuration)}`
                  : 'Klik untuk memilih file audio dari perangkat'}
              </span>
            </label>
            <input
              id="voice-file-input"
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const picked = e.target.files?.[0] || null;
                setAudioFile(picked);
                setErrorMsg(null);
                if (picked) {
                  inspectAudioDuration(picked);
                  if (!title) setTitle(picked.name.replace(/\.[^.]+$/, ''));
                }
              }}
              className="sr-only"
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-zinc-500">Atau rekam langsung via mikrofon:</span>
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    Berhenti ({formatAudioDuration(recordSeconds)})
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-800 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Rekam Suara</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label htmlFor="voice-title" className="block text-sm font-medium text-zinc-900 mb-1">
                Judul Pesan Suara
              </label>
              <input
                id="voice-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ucapan Selamat Pagi"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label htmlFor="voice-recipient" className="block text-sm font-medium text-zinc-900 mb-1">
                Untuk Penerima
              </label>
              <input
                id="voice-recipient"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nama penerima"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label htmlFor="voice-note" className="block text-sm font-medium text-zinc-900 mb-1">
                Catatan Pengantar (opsional)
              </label>
              <textarea
                id="voice-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Dengarkan saat sedang santai..."
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isUploading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {isUploading ? 'Mengunggah Suara...' : 'Unggah Pesan Suara'}
          </button>
        </form>

        {/* Voice List */}
        <div className="lg:col-span-7 space-y-4">
          {voiceMessages.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center space-y-2">
              <p className="font-display text-xl font-medium text-zinc-900">
                Belum ada pesan suara
              </p>
              <p className="text-sm text-zinc-600">
                Unggah file rekaman atau rekam langsung dari mikrofon di panel sebelah kiri.
              </p>
            </div>
          ) : (
            voiceMessages.map((voice) => (
              <VoicePlayerCard
                key={voice.id}
                voice={voice}
                isPlaying={playingId === voice.id}
                onTogglePlay={handleTogglePlay}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
