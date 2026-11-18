import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceMeters,
  filterMediaItems,
  formatAudioDuration,
  formatBytes,
  formatDistance,
  formatIndonesianDate,
  formatRelativeTime,
  upsertById,
  validateEventInput,
  validatePersonalNoteInput,
} from './format';
import type { MediaItem } from '../types/app';

test('formatBytes formats bytes cleanly across scales', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB');
});

test('formatAudioDuration renders mm:ss consistently', () => {
  assert.equal(formatAudioDuration(0), '00:00');
  assert.equal(formatAudioDuration(9), '00:09');
  assert.equal(formatAudioDuration(75.8), '01:15');
});

test('formatIndonesianDate formats YYYY-MM-DD into Indonesian day and month', () => {
  assert.equal(formatIndonesianDate('2026-11-18'), 'Rabu, 18 November 2026');
  assert.equal(formatIndonesianDate('2026-01-01'), 'Kamis, 1 Januari 2026');
});

test('formatRelativeTime calculates relative Indonesian strings', () => {
  const base = Date.parse('2026-11-18T12:00:00.000Z');
  assert.equal(formatRelativeTime('2026-11-18T11:59:30.000Z', base), 'Baru saja');
  assert.equal(formatRelativeTime('2026-11-18T11:45:00.000Z', base), '15 mnt lalu');
  assert.equal(formatRelativeTime('2026-11-18T09:00:00.000Z', base), '3 jam lalu');
});

test('calculateDistanceMeters and formatDistance compute Haversine distance accurately', () => {
  const monas = { lat: -6.175392, lng: 106.827153 };
  const bundaranHI = { lat: -6.194957, lng: 106.823045 };
  const meters = calculateDistanceMeters(monas, bundaranHI);
  assert.ok(meters > 2100 && meters < 2300, `Expected ~2220m, got ${meters}`);
  assert.equal(calculateDistanceMeters(monas, monas), 0);
  assert.equal(formatDistance(450), '450 m');
  assert.equal(formatDistance(2220), '2.22 km');
});

test('validateEventInput rejects empty required fields and accepts valid event', () => {
  assert.ok(
    validateEventInput({
      title: '',
      companionName: 'Nadia',
      date: '2026-11-20',
      time: '19:00',
      locationName: 'Kafe Senja',
    })
  );
  assert.ok(
    validateEventInput({
      title: 'Makan Malam',
      companionName: 'Nadia',
      date: '20-11-2026',
      time: '19:00',
      locationName: 'Kafe Senja',
    })
  );
  assert.equal(
    validateEventInput({
      title: 'Makan Malam',
      companionName: 'Nadia',
      date: '2026-11-20',
      time: '19:00',
      locationName: 'Kafe Senja',
    }),
    null
  );
});

test('validatePersonalNoteInput validates recipient, sender, and message length', () => {
  assert.ok(validatePersonalNoteInput({ recipientName: '', senderName: 'Gani', message: 'Halo kamu' }));
  assert.ok(validatePersonalNoteInput({ recipientName: 'Fida', senderName: 'Gani', message: 'Hai' }));
  assert.equal(
    validatePersonalNoteInput({ recipientName: 'Fida', senderName: 'Gani', message: 'Terima kasih sudah hadir.' }),
    null
  );
});

test('filterMediaItems and upsertById work idempotently', () => {
  const sample: MediaItem[] = [
    {
      id: 'm1',
      title: 'Senja Pantai',
      caption: 'Jalan sore',
      type: 'photo',
      url: '/a.jpg',
      mimeType: 'image/jpeg',
      fileName: 'a.jpg',
      sizeBytes: 1000,
      uploadedBy: 'Gani',
      createdAt: '2026-11-18T10:00:00Z',
    },
    {
      id: 'm2',
      title: 'Klip Hujan',
      caption: 'Di kafe',
      type: 'video',
      url: '/b.mp4',
      mimeType: 'video/mp4',
      fileName: 'b.mp4',
      sizeBytes: 5000,
      uploadedBy: 'Fida',
      createdAt: '2026-11-18T11:00:00Z',
    },
  ];

  assert.equal(filterMediaItems(sample, 'video', '').length, 1);
  assert.equal(filterMediaItems(sample, 'all', 'pantai').length, 1);

  const updated = upsertById(sample, { ...sample[0], title: 'Senja Baru' });
  assert.equal(updated.length, 2);
  assert.equal(updated[0].title, 'Senja Baru');
});
