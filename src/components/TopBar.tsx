import { Bell, CheckCheck, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ActiveMenuTab, RealtimeNotification } from '../types/app';
import { formatRelativeTime } from '../utils/format';

interface TopBarProps {
  activeTab: ActiveMenuTab;
  onSelectTab: (tab: ActiveMenuTab) => void;
  notifications: RealtimeNotification[];
  currentUser: string;
  isConnected: boolean;
  onMarkAllRead: () => void;
  onOpenEventFromNotification: (eventId?: string) => void;
}

const NAV_ITEMS: { id: ActiveMenuTab; label: string }[] = [
  { id: 'galeri', label: 'Galeri' },
  { id: 'pesan-kata', label: 'Pesan Kata' },
  { id: 'pesan-suara', label: 'Pesan Suara' },
  { id: 'acara', label: 'Acara & Lokasi' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  notifications,
  currentUser,
  isConnected,
  onMarkAllRead,
  onOpenEventFromNotification,
}: TopBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported'
  );
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.readBy.includes(currentUser)).length;

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    if (drawerOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [drawerOpen]);

  const requestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await window.Notification.requestPermission();
    setBrowserPerm(perm);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-sm border-b border-stone-200/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('galeri')}
          className="font-display text-2xl font-bold tracking-tight text-zinc-900 hover:text-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded"
        >
          Kenang
        </button>

        {/* Zone 2: 4 Clean Single-Line Nav Links */}
        <nav aria-label="Navigasi utama" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                  isActive
                    ? 'border-teal-700 text-zinc-900'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:border-stone-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action (Notification Center) */}
        <div className="relative shrink-0" ref={drawerRef}>
          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
            aria-expanded={drawerOpen}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <Bell className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <span>Notifikasi</span>
            {unreadCount > 0 && (
              <span className="font-mono tabular-nums text-xs font-semibold text-teal-800">
                ({unreadCount})
              </span>
            )}
          </button>

          {drawerOpen && (
            <div
              role="dialog"
              aria-label="Pusat Notifikasi Real-time"
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-sans text-sm font-semibold text-zinc-900">
                    Pembaruan Real-time
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 text-xs text-zinc-500"
                    title={isConnected ? 'WebSocket terhubung' : 'Menghubungkan ulang'}
                  >
                    {isConnected ? (
                      <Wifi className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                    )}
                    <span>{isConnected ? 'Aktif' : 'Offline'}</span>
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tandai dibaca</span>
                  </button>
                )}
              </div>

              {browserPerm === 'default' && (
                <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-600">
                    Aktifkan notifikasi desktop Chrome agar tak terlewat.
                  </p>
                  <button
                    type="button"
                    onClick={requestBrowserNotifications}
                    className="px-2.5 py-1 text-xs font-medium bg-teal-700 text-white rounded-md hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Izinkan
                  </button>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
                {notifications.length === 0 ? (
                  <p className="p-6 text-sm text-center text-zinc-500">
                    Belum ada pembaruan acara atau kiriman baru.
                  </p>
                ) : (
                  notifications.map((notif) => {
                    const isUnread = !notif.readBy.includes(currentUser);
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          if (notif.eventId) {
                            onOpenEventFromNotification(notif.eventId);
                          } else if (notif.kind === 'note_added') {
                            onSelectTab('pesan-kata');
                          } else if (notif.kind === 'voice_added') {
                            onSelectTab('pesan-suara');
                          } else if (notif.kind === 'media_added') {
                            onSelectTab('galeri');
                          }
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors cursor-pointer ${
                          isUnread ? 'bg-teal-50/40' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-900">
                            {notif.title}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-zinc-500 shrink-0">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                          {notif.message}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom-of-header compact navigation row */}
      <nav
        aria-label="Navigasi seluler"
        className="md:hidden border-t border-stone-200 px-3 flex items-center justify-between overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-2.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-teal-700 text-zinc-900'
                  : 'border-transparent text-zinc-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
