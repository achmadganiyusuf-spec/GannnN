import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  AppStateSnapshot,
  EventStatus,
  MediaItem,
  NoteTone,
  ParticipantLocation,
  PersonalNote,
  RealtimeNotification,
  ServerWSMessage,
  SharedEvent,
  VoiceMessage,
} from './src/types/app.ts';
import { formatIndonesianDate } from './src/utils/format.ts';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_PATH = path.resolve(DATA_DIR, 'db.json');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function synthesizeSeedWav(targetPath: string): number {
  if (fs.existsSync(targetPath)) {
    return fs.statSync(targetPath).size;
  }
  const sampleRate = 22050;
  const durationSec = 4;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t));
    const localT = t - noteIdx;
    const freq = notes[noteIdx];
    const env = Math.sin(Math.min(1, localT * 12) * (Math.PI / 2)) * Math.exp(-localT * 2.4);
    const sample =
      (0.65 * Math.sin(2 * Math.PI * freq * t) +
        0.25 * Math.sin(2 * Math.PI * freq * 2 * t)) *
      env *
      0.38;
    const pcm = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
    buffer.writeInt16LE(pcm, 44 + i * 2);
  }

  fs.writeFileSync(targetPath, buffer);
  return buffer.length;
}

function getAssetByteSize(relativeUrl: string): number {
  const cleanRel = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
  const fullPath = path.resolve(ROOT_DIR, cleanRel);
  if (fs.existsSync(fullPath)) {
    return fs.statSync(fullPath).size;
  }
  return 0;
}

function createSeedDatabase(): AppStateSnapshot {
  const seedWavPath = path.resolve(UPLOADS_DIR, 'seed-melodi-sapaan.wav');
  const seedWavSize = synthesizeSeedWav(seedWavPath);

  const seedVideoRel = '/uploads/seed-kenangan-senja.mp4';
  const seedVideoFull = path.resolve(UPLOADS_DIR, 'seed-kenangan-senja.mp4');
  const seedVideoSize = fs.existsSync(seedVideoFull) ? fs.statSync(seedVideoFull).size : 0;

  const photo1 = '/src/assets/images/vault_sunset_coast_1795040894657.jpg';
  const photo2 = '/src/assets/images/vault_coffee_morning_1795040894911.jpg';
  const photo3 = '/src/assets/images/vault_city_rain_1795040895510.jpg';
  const photo4 = '/src/assets/images/vault_mountain_picnic_1795040896023.jpg';

  const media: MediaItem[] = [
    {
      id: 'media-seed-1',
      title: 'Senja di Tepian Pantai',
      caption: 'Momen tenang menjelang matahari terbenam sebelum pulang bersama.',
      type: 'photo',
      url: photo1,
      mimeType: 'image/jpeg',
      fileName: 'senja-tepian-pantai.jpg',
      sizeBytes: getAssetByteSize(photo1),
      uploadedBy: 'Gani',
      createdAt: '2026-11-16T17:40:00.000Z',
    },
    {
      id: 'media-seed-2',
      title: 'Kopi Pagi & Catatan Kecil',
      caption: 'Dua cangkir hangat di sudut jendela yang selalu jadi tempat favorit.',
      type: 'photo',
      url: photo2,
      mimeType: 'image/jpeg',
      fileName: 'kopi-pagi-catatan.jpg',
      sizeBytes: getAssetByteSize(photo2),
      uploadedBy: 'Fida',
      createdAt: '2026-11-17T08:15:00.000Z',
    },
    {
      id: 'media-seed-3',
      title: 'Lampu Kafe Selepas Hujan',
      caption: 'Pantulan cahaya hangat di trotoar basah sepulang kerja.',
      type: 'photo',
      url: photo3,
      mimeType: 'image/jpeg',
      fileName: 'kafe-selepas-hujan.jpg',
      sizeBytes: getAssetByteSize(photo3),
      uploadedBy: 'Gani',
      createdAt: '2026-11-17T19:30:00.000Z',
    },
    {
      id: 'media-seed-4',
      title: 'Piknik Senja Perbukitan',
      caption: 'Kabut tipis di lembah dan lentera kecil yang menemani obrolan panjang.',
      type: 'photo',
      url: photo4,
      mimeType: 'image/jpeg',
      fileName: 'piknik-senja-perbukitan.jpg',
      sizeBytes: getAssetByteSize(photo4),
      uploadedBy: 'Fida',
      createdAt: '2026-11-18T06:20:00.000Z',
    },
  ];

  if (seedVideoSize > 0) {
    media.unshift({
      id: 'media-seed-video-1',
      title: 'Klip Singkat Senja Pantai',
      caption: 'Cuplikan video 4 detik dari perjalanan sore minggu lalu, siap diunduh.',
      type: 'video',
      url: seedVideoRel,
      mimeType: 'video/mp4',
      fileName: 'klip-senja-pantai.mp4',
      sizeBytes: seedVideoSize,
      uploadedBy: 'Gani',
      createdAt: '2026-11-18T10:15:00.000Z',
    });
  }

  const notes: PersonalNote[] = [
    {
      id: 'note-seed-1',
      title: 'Untuk Kamu yang Membuka Halaman Ini',
      recipientName: 'Fida',
      senderName: 'Gani',
      message:
        'Terima kasih sudah selalu menjadi rumah yang tenang di tengah hari-hari yang ramai. Setiap foto, catatan kecil, dan rencana perjalanan kita di sini adalah pengingat bahwa hal-hal sederhana selalu layak dirayakan bersama. Sampai bertemu di acara akhir pekan ini.',
      tone: 'hangat',
      createdAt: '2026-11-18T09:00:00.000Z',
      isPinned: true,
    },
    {
      id: 'note-seed-2',
      title: 'Catatan Kecil Sebelum Hujan Reda',
      recipientName: 'Gani',
      senderName: 'Fida',
      message:
        'Kalau hari ini terasa panjang, jangan lupa tarik napas sebentar. Aku sudah menandai tanggal pertemuan kita berikutnya—tinggal tunggu kamu siap berangkat.',
      tone: 'santai',
      createdAt: '2026-11-17T14:20:00.000Z',
      isPinned: false,
    },
  ];

  const voiceMessages: VoiceMessage[] = [
    {
      id: 'voice-seed-1',
      title: 'Sapaan Melodi Pagi & Pengingat Sore Ini',
      senderName: 'Gani',
      recipientName: 'Fida',
      note: 'Putar sebentar sebelum kamu berangkat ke titik kumpul nanti sore ya.',
      audioUrl: '/uploads/seed-melodi-sapaan.wav',
      mimeType: 'audio/wav',
      fileName: 'sapaan-melodi-pagi.wav',
      sizeBytes: seedWavSize,
      durationSec: 4,
      createdAt: '2026-11-18T08:45:00.000Z',
    },
  ];

  const events: SharedEvent[] = [
    {
      id: 'event-seed-1',
      title: 'Kopi Sore & Jalan Santai Taman Menteng',
      companionName: 'Fida',
      organizerName: 'Gani',
      description: 'Bertemu di area taman utama, bawa kamera untuk tambah foto ke galeri.',
      date: '2026-11-18',
      time: '16:30',
      locationName: 'Taman Menteng, Jakarta Pusat',
      lat: -6.1964,
      lng: 106.8294,
      status: 'active',
      createdAt: '2026-11-18T07:30:00.000Z',
      updatedAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'event-seed-2',
      title: 'Sarapan Pagi & Galeri Seni Akhir Pekan',
      companionName: 'Gani',
      organizerName: 'Fida',
      description: 'Melihat pameran fotografi lalu makan siang bersama di dekat kota tua.',
      date: '2026-11-22',
      time: '09:30',
      locationName: 'Museum MACAN, Jakarta Barat',
      lat: -6.1909,
      lng: 106.7681,
      status: 'planned',
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
    },
  ];

  const locations: ParticipantLocation[] = [
    {
      id: 'event-seed-1:Gani',
      eventId: 'event-seed-1',
      userName: 'Gani',
      lat: -6.1951,
      lng: 106.8279,
      accuracy: 12,
      updatedAt: '2026-11-18T14:20:00.000Z',
      isSharing: true,
    },
    {
      id: 'event-seed-1:Fida',
      eventId: 'event-seed-1',
      userName: 'Fida',
      lat: -6.1982,
      lng: 106.8315,
      accuracy: 15,
      updatedAt: '2026-11-18T14:22:00.000Z',
      isSharing: true,
    },
  ];

  const notifications: RealtimeNotification[] = [
    {
      id: 'notif-seed-1',
      kind: 'location_started',
      title: 'Acara Sedang Berlangsung',
      message: 'Gani dan Fida sedang membagikan lokasi untuk "Kopi Sore & Jalan Santai Taman Menteng".',
      actorName: 'Gani',
      eventId: 'event-seed-1',
      createdAt: '2026-11-18T14:20:00.000Z',
      readBy: [],
    },
    {
      id: 'notif-seed-2',
      kind: 'event_created',
      title: 'Acara Baru Dijadwalkan',
      message: 'Fida membuat acara "Sarapan Pagi & Galeri Seni Akhir Pekan" untuk Minggu, 22 November 2026.',
      actorName: 'Fida',
      eventId: 'event-seed-2',
      createdAt: '2026-11-18T08:00:00.000Z',
      readBy: [],
    },
  ];

  return {
    media,
    notes,
    voiceMessages,
    events,
    locations,
    notifications,
  };
}

function loadState(): AppStateSnapshot {
  if (!fs.existsSync(DB_PATH)) {
    const initial = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as AppStateSnapshot;
    // Ensure seed wav exists if referenced
    synthesizeSeedWav(path.resolve(UPLOADS_DIR, 'seed-melodi-sapaan.wav'));
    return parsed;
  } catch {
    const fallback = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

let state: AppStateSnapshot = loadState();

function saveState(): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf8');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    const safeBase = path
      .basename(file.originalname || 'file', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40);
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcast(msg: ServerWSMessage) {
    const serialized = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  function pushNotification(
    partial: Omit<RealtimeNotification, 'id' | 'createdAt' | 'readBy'>
  ): RealtimeNotification {
    const notification: RealtimeNotification = {
      id: `notif-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      readBy: [partial.actorName],
      ...partial,
    };
    state.notifications = [notification, ...state.notifications].slice(0, 50);
    saveState();
    broadcast({ type: 'notification:new', payload: notification });
    return notification;
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'init', payload: state } satisfies ServerWSMessage));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        if (msg.type === 'sync:request') {
          ws.send(JSON.stringify({ type: 'init', payload: state } satisfies ServerWSMessage));
        }
      } catch {
        // ignore malformed client frames
      }
    });
  });

  app.get('/api/config', (_req, res) => {
    const googleMapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ googleMapsApiKey });
  });

  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  // Media endpoints
  app.post('/api/media', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Pilih file foto atau video terlebih dahulu.' });
      return;
    }

    const mime = file.mimetype || 'application/octet-stream';
    const isVideo = mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.originalname);
    const isPhoto = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname);

    if (!isVideo && !isPhoto) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Format file harus berupa foto atau video.' });
      return;
    }

    const title = String(req.body.title || '').trim() || file.originalname;
    const caption = String(req.body.caption || '').trim();
    const uploadedBy = String(req.body.uploadedBy || '').trim() || 'Pengguna';

    const item: MediaItem = {
      id: `media-${crypto.randomUUID()}`,
      title,
      caption,
      type: isVideo ? 'video' : 'photo',
      url: `/uploads/${file.filename}`,
      mimeType: mime,
      fileName: file.originalname || file.filename,
      sizeBytes: file.size,
      uploadedBy,
      createdAt: new Date().toISOString(),
    };

    state.media = [item, ...state.media];
    saveState();
    broadcast({ type: 'media:created', payload: item });
    pushNotification({
      kind: 'media_added',
      title: isVideo ? 'Video Baru Diunggah' : 'Foto Baru Diunggah',
      message: `${uploadedBy} menyimpan "${title}" ke dalam galeri.`,
      actorName: uploadedBy,
    });

    res.status(201).json(item);
  });

  app.get('/api/media/:id/download', (req, res) => {
    const item = state.media.find((m) => m.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Media tidak ditemukan.' });
      return;
    }

    let diskPath = '';
    if (item.url.startsWith('/uploads/')) {
      diskPath = path.resolve(UPLOADS_DIR, item.url.replace('/uploads/', ''));
    } else if (item.url.startsWith('/src/')) {
      const rel = item.url.slice(1);
      const rootCandidate = path.resolve(ROOT_DIR, rel);
      const distCandidate = path.resolve(ROOT_DIR, 'dist', rel);
      diskPath = fs.existsSync(rootCandidate) ? rootCandidate : distCandidate;
    }

    if (!diskPath || !fs.existsSync(diskPath)) {
      res.status(404).json({ error: 'File media tidak tersedia di penyimpanan.' });
      return;
    }

    res.download(diskPath, item.fileName);
  });

  app.delete('/api/media/:id', (req, res) => {
    const idx = state.media.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Media tidak ditemukan.' });
      return;
    }
    const [removed] = state.media.splice(idx, 1);
    if (removed.url.startsWith('/uploads/') && !removed.url.includes('seed-')) {
      const diskPath = path.resolve(UPLOADS_DIR, removed.url.replace('/uploads/', ''));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
    saveState();
    broadcast({ type: 'media:deleted', payload: { id: removed.id } });
    res.json({ ok: true });
  });

  // Personal notes ("kalimat kata-kata")
  app.post('/api/notes', (req, res) => {
    const title = String(req.body.title || '').trim() || 'Pesan Untukmu';
    const recipientName = String(req.body.recipientName || '').trim();
    const senderName = String(req.body.senderName || '').trim();
    const message = String(req.body.message || '').trim();
    const toneRaw = String(req.body.tone || 'hangat');
    const tone: NoteTone =
      toneRaw === 'puitis' || toneRaw === 'santai' ? toneRaw : 'hangat';

    if (!recipientName || !senderName || message.length < 5) {
      res.status(400).json({ error: 'Nama penerima, pengirim, dan isi pesan wajib dilengkapi.' });
      return;
    }

    // Unpin existing pinned note and pin the newest one so recipient sees it immediately
    state.notes = state.notes.map((n) => ({ ...n, isPinned: false }));
    const note: PersonalNote = {
      id: `note-${crypto.randomUUID()}`,
      title,
      recipientName,
      senderName,
      message,
      tone,
      createdAt: new Date().toISOString(),
      isPinned: true,
    };

    state.notes = [note, ...state.notes];
    saveState();
    broadcast({ type: 'note:created', payload: note });
    pushNotification({
      kind: 'note_added',
      title: 'Pesan Kata Baru',
      message: `${senderName} menuliskan kalimat khusus untuk ${recipientName}.`,
      actorName: senderName,
    });

    res.status(201).json(note);
  });

  app.patch('/api/notes/:id/pin', (req, res) => {
    const target = state.notes.find((n) => n.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Pesan tidak ditemukan.' });
      return;
    }
    state.notes = state.notes.map((n) => ({
      ...n,
      isPinned: n.id === req.params.id,
    }));
    saveState();
    broadcast({ type: 'note:pinned', payload: { id: req.params.id } });
    res.json({ ok: true });
  });

  // Voice messages
  app.post('/api/voice', upload.single('audio'), (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Pilih atau rekam file pesan suara terlebih dahulu.' });
      return;
    }

    const mime = file.mimetype || 'audio/webm';
    const isAudio =
      mime.startsWith('audio/') ||
      mime === 'video/webm' ||
      /\.(mp3|wav|ogg|m4a|webm|aac|flac)$/i.test(file.originalname);

    if (!isAudio) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Format file pesan suara harus berupa audio.' });
      return;
    }

    const title = String(req.body.title || '').trim() || 'Pesan Suara Personal';
    const senderName = String(req.body.senderName || '').trim() || 'Pengirim';
    const recipientName = String(req.body.recipientName || '').trim() || 'Kamu';
    const note = String(req.body.note || '').trim();
    const durationSec = Math.max(1, Math.round(Number(req.body.durationSec) || 0));

    const voice: VoiceMessage = {
      id: `voice-${crypto.randomUUID()}`,
      title,
      senderName,
      recipientName,
      note,
      audioUrl: `/uploads/${file.filename}`,
      mimeType: mime,
      fileName: file.originalname || file.filename,
      sizeBytes: file.size,
      durationSec,
      createdAt: new Date().toISOString(),
    };

    state.voiceMessages = [voice, ...state.voiceMessages];
    saveState();
    broadcast({ type: 'voice:created', payload: voice });
    pushNotification({
      kind: 'voice_added',
      title: 'Pesan Suara Baru',
      message: `${senderName} mengunggah pesan suara "${title}" untuk ${recipientName}.`,
      actorName: senderName,
    });

    res.status(201).json(voice);
  });

  app.get('/api/voice/:id/download', (req, res) => {
    const voice = state.voiceMessages.find((v) => v.id === req.params.id);
    if (!voice) {
      res.status(404).json({ error: 'Pesan suara tidak ditemukan.' });
      return;
    }
    const diskPath = path.resolve(UPLOADS_DIR, voice.audioUrl.replace('/uploads/', ''));
    if (!fs.existsSync(diskPath)) {
      res.status(404).json({ error: 'File suara tidak ditemukan.' });
      return;
    }
    res.download(diskPath, voice.fileName);
  });

  app.delete('/api/voice/:id', (req, res) => {
    const idx = state.voiceMessages.findIndex((v) => v.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Pesan suara tidak ditemukan.' });
      return;
    }
    const [removed] = state.voiceMessages.splice(idx, 1);
    if (removed.audioUrl.startsWith('/uploads/') && !removed.audioUrl.includes('seed-')) {
      const diskPath = path.resolve(UPLOADS_DIR, removed.audioUrl.replace('/uploads/', ''));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
    saveState();
    broadcast({ type: 'voice:deleted', payload: { id: removed.id } });
    res.json({ ok: true });
  });

  // Events & real-time updates
  app.post('/api/events', (req, res) => {
    const title = String(req.body.title || '').trim();
    const companionName = String(req.body.companionName || '').trim();
    const organizerName = String(req.body.organizerName || '').trim() || 'Pengguna';
    const description = String(req.body.description || '').trim();
    const date = String(req.body.date || '').trim();
    const time = String(req.body.time || '').trim();
    const locationName = String(req.body.locationName || '').trim();
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const statusRaw = String(req.body.status || 'planned');
    const status: EventStatus =
      statusRaw === 'active' || statusRaw === 'completed' ? statusRaw : 'planned';

    if (!title || !companionName || !date || !time || !locationName) {
      res.status(400).json({ error: 'Lengkapi judul, nama pasangan/rekan, tanggal, jam, dan lokasi.' });
      return;
    }

    const now = new Date().toISOString();
    const event: SharedEvent = {
      id: `event-${crypto.randomUUID()}`,
      title,
      companionName,
      organizerName,
      description,
      date,
      time,
      locationName,
      lat: Number.isFinite(lat) ? lat : -6.1964,
      lng: Number.isFinite(lng) ? lng : 106.8294,
      status,
      createdAt: now,
      updatedAt: now,
    };

    state.events = [event, ...state.events];
    saveState();
    broadcast({ type: 'event:created', payload: event });
    pushNotification({
      kind: 'event_created',
      title: 'Acara Baru Dibuat',
      message: `${organizerName} membuat acara "${title}" bersama ${companionName} pada ${formatIndonesianDate(date)} pukul ${time}.`,
      actorName: organizerName,
      eventId: event.id,
    });

    res.status(201).json(event);
  });

  app.patch('/api/events/:id', (req, res) => {
    const idx = state.events.findIndex((e) => e.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Acara tidak ditemukan.' });
      return;
    }

    const prev = state.events[idx];
    const actorName = String(req.body.actorName || prev.organizerName).trim() || prev.organizerName;
    const nextDate = req.body.date !== undefined ? String(req.body.date).trim() : prev.date;
    const nextTime = req.body.time !== undefined ? String(req.body.time).trim() : prev.time;
    const nextTitle = req.body.title !== undefined ? String(req.body.title).trim() : prev.title;
    const nextLocationName =
      req.body.locationName !== undefined ? String(req.body.locationName).trim() : prev.locationName;
    const nextStatus = (req.body.status as EventStatus) || prev.status;

    const updated: SharedEvent = {
      ...prev,
      title: nextTitle || prev.title,
      description:
        req.body.description !== undefined ? String(req.body.description).trim() : prev.description,
      date: nextDate || prev.date,
      time: nextTime || prev.time,
      locationName: nextLocationName || prev.locationName,
      lat: Number.isFinite(Number(req.body.lat)) ? Number(req.body.lat) : prev.lat,
      lng: Number.isFinite(Number(req.body.lng)) ? Number(req.body.lng) : prev.lng,
      status:
        nextStatus === 'planned' || nextStatus === 'active' || nextStatus === 'completed'
          ? nextStatus
          : prev.status,
      updatedAt: new Date().toISOString(),
    };

    state.events[idx] = updated;
    saveState();
    broadcast({ type: 'event:updated', payload: updated });

    let summary = `${actorName} memperbarui acara "${updated.title}".`;
    let kind: RealtimeNotification['kind'] = 'event_updated';
    let notifTitle = 'Pembaruan Acara';

    if (prev.status !== updated.status && updated.status === 'active') {
      kind = 'location_started';
      notifTitle = 'Acara Sedang Berlangsung';
      summary = `${actorName} memulai acara "${updated.title}". Pelacak lokasi bersama kini aktif.`;
    } else if (prev.date !== updated.date || prev.time !== updated.time) {
      summary = `${actorName} mengubah jadwal "${updated.title}" ke ${formatIndonesianDate(updated.date)} pukul ${updated.time}.`;
    } else if (prev.status !== updated.status && updated.status === 'completed') {
      summary = `${actorName} menandai acara "${updated.title}" telah selesai.`;
    }

    pushNotification({
      kind,
      title: notifTitle,
      message: summary,
      actorName,
      eventId: updated.id,
    });

    res.json(updated);
  });

  // Live location tracking during events
  app.post('/api/locations', (req, res) => {
    const eventId = String(req.body.eventId || '').trim();
    const userName = String(req.body.userName || '').trim();
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const accuracy = Number.isFinite(Number(req.body.accuracy)) ? Number(req.body.accuracy) : undefined;
    const isSharing = req.body.isSharing !== false;

    if (!eventId || !userName || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Data koordinat lokasi atau identitas acara tidak valid.' });
      return;
    }

    const id = `${eventId}:${userName}`;
    const existing = state.locations.find((l) => l.id === id);
    const wasSharing = existing?.isSharing ?? false;

    const loc: ParticipantLocation = {
      id,
      eventId,
      userName,
      lat,
      lng,
      accuracy,
      updatedAt: new Date().toISOString(),
      isSharing,
    };

    const existingIdx = state.locations.findIndex((l) => l.id === id);
    if (existingIdx === -1) {
      state.locations = [loc, ...state.locations];
    } else {
      state.locations[existingIdx] = loc;
    }
    saveState();
    broadcast({ type: 'location:updated', payload: loc });

    if (!wasSharing && isSharing) {
      const ev = state.events.find((e) => e.id === eventId);
      pushNotification({
        kind: 'location_started',
        title: 'Lokasi Bersama Dibagikan',
        message: `${userName} mulai membagikan lokasi langsung untuk acara "${ev?.title || 'Acara Bersama'}".`,
        actorName: userName,
        eventId,
      });
    }

    res.json(loc);
  });

  app.post('/api/notifications/read', (req, res) => {
    const userName = String(req.body.userName || '').trim() || 'Pengguna';
    state.notifications = state.notifications.map((n) =>
      n.readBy.includes(userName) ? n : { ...n, readBy: [...n.readBy, userName] }
    );
    saveState();
    broadcast({ type: 'notifications:read', payload: { userName } });
    res.json({ ok: true });
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kenang server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
