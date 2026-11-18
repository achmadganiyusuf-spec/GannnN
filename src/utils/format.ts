import type { EventStatus, MediaItem, MediaType } from '../types/app.ts';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, exp);
  return `${val < 10 && exp > 0 ? val.toFixed(1) : Math.round(val)} ${units[exp]}`;
}

export function formatAudioDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [year, month, day] = parts;
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  const dayName = INDONESIAN_DAYS[dateObj.getUTCDay()];
  const monthName = INDONESIAN_MONTHS[month - 1] || '';
  return `${dayName}, ${day} ${monthName} ${year}`;
}

export function formatRelativeTime(isoString: string, nowMs: number = Date.now()): string {
  const ts = Date.parse(isoString);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

export function calculateDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '-';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function getEventStatusLabel(status: EventStatus): string {
  switch (status) {
    case 'planned':
      return 'Direncanakan';
    case 'active':
      return 'Sedang Berlangsung';
    case 'completed':
      return 'Selesai';
  }
}

export function validateEventInput(input: {
  title: string;
  companionName: string;
  date: string;
  time: string;
  locationName: string;
}): string | null {
  if (!input.title.trim()) return 'Judul acara wajib diisi.';
  if (!input.companionName.trim()) return 'Nama pasangan/rekan acara wajib diisi.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Tanggal acara harus valid (YYYY-MM-DD).';
  if (!/^\d{2}:\d{2}$/.test(input.time)) return 'Jam acara harus valid (HH:MM).';
  if (!input.locationName.trim()) return 'Nama lokasi pertemuan wajib diisi.';
  return null;
}

export function validatePersonalNoteInput(input: {
  recipientName: string;
  senderName: string;
  message: string;
}): string | null {
  if (!input.recipientName.trim()) return 'Nama penerima wajib diisi.';
  if (!input.senderName.trim()) return 'Nama pengirim wajib diisi.';
  if (input.message.trim().length < 5) return 'Isi kalimat kata-kata minimal 5 karakter.';
  return null;
}

export function filterMediaItems(
  items: MediaItem[],
  filter: 'all' | MediaType,
  query: string
): MediaItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.caption.toLowerCase().includes(q) ||
      item.uploadedBy.toLowerCase().includes(q)
    );
  });
}

export function upsertById<T extends { id: string }>(
  list: T[],
  incoming: T,
  prepend = true
): T[] {
  const idx = list.findIndex((item) => item.id === incoming.id);
  if (idx === -1) {
    return prepend ? [incoming, ...list] : [...list, incoming];
  }
  const copy = [...list];
  copy[idx] = incoming;
  return copy;
}
