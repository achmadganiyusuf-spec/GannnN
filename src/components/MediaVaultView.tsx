import { Download, Film, Image as ImageIcon, Play, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { MediaItem, MediaType } from '../types/app';
import { filterMediaItems, formatBytes, formatRelativeTime } from '../utils/format';

interface MediaVaultViewProps {
  media: MediaItem[];
  currentUser: string;
  onMediaCreated: (item: MediaItem) => void;
  onMediaDeleted: (id: string) => void;
}

export function MediaVaultView({
  media,
  currentUser,
  onMediaCreated,
  onMediaDeleted,
}: MediaVaultViewProps) {
  const [filter, setFilter] = useState<'all' | MediaType>('all');
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const filtered = filterMediaItems(media, filter, query);
  const photoCount = media.filter((m) => m.type === 'photo').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Pilih file foto atau video dari perangkat Anda terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim() || file.name);
      formData.append('caption', caption.trim());
      formData.append('uploadedBy', currentUser);

      const res = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Gagal mengunggah media.');
        return;
      }

      onMediaCreated(data as MediaItem);
      setFile(null);
      setTitle('');
      setCaption('');
      setUploadOpen(false);
    } catch {
      setUploadError('Terjadi kendala koneksi saat mengunggah file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onMediaDeleted(id);
        if (selectedItem?.id === id) setSelectedItem(null);
        setConfirmDeleteId(null);
      }
    } catch {
      // ignore network error
    }
  };

  return (
    <section aria-labelledby="galeri-heading" className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 pb-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-teal-800 tracking-wide">
            Ruang Penyimpanan Bersama · <span className="font-mono tabular-nums">{photoCount}</span> Foto ·{' '}
            <span className="font-mono tabular-nums">{videoCount}</span> Video
          </p>
          <h1 id="galeri-heading" className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Galeri Foto &amp; Video
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Simpan momen foto dan rekaman video pilihan di sini. Siapa pun yang membuka ruang ini dapat melihat pratinjau penuh dan langsung mengunduh file aslinya.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadError(null);
            setUploadOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Unggah Foto / Video</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div role="tablist" aria-label="Filter tipe media" className="inline-flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg self-start">
          {(
            [
              { id: 'all', label: `Semua (${media.length})` },
              { id: 'photo', label: `Foto (${photoCount})` },
              { id: 'video', label: `Video (${videoCount})` },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <label htmlFor="media-search" className="sr-only">
            Cari foto atau video
          </label>
          <input
            id="media-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul atau pengunggah..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>
      </div>

      {/* Gallery Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center space-y-3">
          <p className="font-display text-xl font-medium text-zinc-900">
            Belum ada foto atau video yang cocok
          </p>
          <p className="text-sm text-zinc-600 max-w-md mx-auto">
            {query
              ? 'Coba ubah kata kunci pencarian atau pilih kategori Semua.'
              : 'Mulai unggah foto atau video pertama Anda agar bisa diunduh oleh penerima.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setQuery('');
              if (media.length === 0) setUploadOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
          >
            {media.length === 0 ? 'Unggah Media Pertama' : 'Tampilkan Semua'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const isBroken = brokenImages[item.id];
            return (
              <article
                key={item.id}
                className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    aria-label={`Buka pratinjau ${item.title}`}
                    className="relative w-full aspect-[4/3] bg-stone-100 overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                  >
                    {item.type === 'video' ? (
                      <>
                        <video
                          src={`${item.url}#t=0.5`}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent flex items-center justify-center">
                          <span className="w-12 h-12 rounded-full bg-white/95 text-zinc-900 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                          </span>
                        </div>
                      </>
                    ) : isBroken ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-stone-100 text-zinc-500 p-4">
                        <ImageIcon className="w-8 h-8" aria-hidden="true" />
                        <span className="text-xs font-medium text-center">{item.title}</span>
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    )}
                  </button>

                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                        {item.type === 'video' ? (
                          <Film className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        )}
                        {item.type === 'video' ? 'Video' : 'Foto'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(item.sizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Oleh {item.uploadedBy}</span>
                    </div>

                    <h2 className="font-display text-lg font-semibold text-zinc-900 leading-snug">
                      {item.title}
                    </h2>

                    {item.caption && (
                      <p className="text-sm text-zinc-600 line-clamp-2 leading-relaxed">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-between gap-3">
                  <span className="font-mono tabular-nums text-xs text-zinc-500">
                    {formatRelativeTime(item.createdAt)}
                  </span>

                  <div className="flex items-center gap-2">
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-md cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label={`Hapus ${item.title}`}
                        className="p-2 text-zinc-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}

                    <a
                      href={`/api/media/${encodeURIComponent(item.id)}/download`}
                      download={item.fileName}
                      aria-label={`Unduh ${item.title}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Unduh</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-media-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h2 id="upload-media-title" className="font-display text-xl font-semibold text-zinc-900">
                Unggah Foto atau Video
              </h2>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                aria-label="Tutup dialog unggah"
                className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="media-file-input"
                  className="block text-sm font-medium text-zinc-900 mb-1.5"
                >
                  Pilih File Foto / Video (maks. 100 MB)
                </label>
                <label
                  htmlFor="media-file-input"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50/70 hover:bg-stone-100/70 transition-colors cursor-pointer text-center"
                >
                  <Upload className="w-6 h-6 text-teal-700" aria-hidden="true" />
                  <span className="text-sm font-medium text-zinc-800">
                    {file ? file.name : 'Klik untuk memilih foto atau video dari Chrome'}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {file
                      ? `${formatBytes(file.size)} · ${file.type || 'Media'}`
                      : 'Mendukung JPG, PNG, WebP, MP4, WebM, MOV'}
                  </span>
                </label>
                <input
                  id="media-file-input"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] || null;
                    setFile(picked);
                    if (picked && !title) {
                      setTitle(picked.name.replace(/\.[^.]+$/, ''));
                    }
                    setUploadError(null);
                  }}
                  className="sr-only"
                />
              </div>

              <div>
                <label htmlFor="media-title-input" className="block text-sm font-medium text-zinc-900 mb-1">
                  Judul Momen
                </label>
                <input
                  id="media-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Jalan Sore di Kota Tua"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label htmlFor="media-caption-input" className="block text-sm font-medium text-zinc-900 mb-1">
                  Cerita Singkat (opsional)
                </label>
                <textarea
                  id="media-caption-input"
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Tulis catatan kecil untuk foto atau video ini..."
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              {uploadError && (
                <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {isUploading ? 'Mengunggah...' : 'Simpan ke Galeri'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau ${selectedItem.title}`}
          className="fixed inset-0 z-50 bg-zinc-950/90 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-zinc-900 truncate">
                  {selectedItem.title}
                </h2>
                <p className="text-xs text-zinc-500">
                  {selectedItem.type === 'video' ? 'Video' : 'Foto'} ·{' '}
                  <span className="font-mono tabular-nums">{formatBytes(selectedItem.sizeBytes)}</span> · Oleh{' '}
                  {selectedItem.uploadedBy}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/media/${encodeURIComponent(selectedItem.id)}/download`}
                  download={selectedItem.fileName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Unduh File</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Tutup pratinjau"
                  className="p-2 text-zinc-600 hover:text-zinc-900 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-950 flex items-center justify-center max-h-[70vh]">
              {selectedItem.type === 'video' ? (
                <video
                  src={selectedItem.url}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <img
                  src={selectedItem.url}
                  alt={selectedItem.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>

            {selectedItem.caption && (
              <div className="px-6 py-4 bg-white border-t border-stone-200">
                <p className="text-sm text-zinc-700 leading-relaxed">{selectedItem.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
