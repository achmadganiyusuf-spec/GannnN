export type MediaType = 'photo' | 'video';

export interface MediaItem {
  id: string;
  title: string;
  caption: string;
  type: MediaType;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export type NoteTone = 'hangat' | 'puitis' | 'santai';

export interface PersonalNote {
  id: string;
  title: string;
  recipientName: string;
  senderName: string;
  message: string;
  tone: NoteTone;
  createdAt: string;
  isPinned: boolean;
}

export interface VoiceMessage {
  id: string;
  title: string;
  senderName: string;
  recipientName: string;
  note: string;
  audioUrl: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  durationSec: number;
  createdAt: string;
}

export type EventStatus = 'planned' | 'active' | 'completed';

export interface SharedEvent {
  id: string;
  title: string;
  companionName: string;
  organizerName: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  locationName: string;
  lat: number;
  lng: number;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantLocation {
  id: string; // `${eventId}:${userName}`
  eventId: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
  isSharing: boolean;
}

export type NotificationKind =
  | 'event_created'
  | 'event_updated'
  | 'location_started'
  | 'note_added'
  | 'voice_added'
  | 'media_added';

export interface RealtimeNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  actorName: string;
  eventId?: string;
  createdAt: string;
  readBy: string[];
}

export interface AppStateSnapshot {
  media: MediaItem[];
  notes: PersonalNote[];
  voiceMessages: VoiceMessage[];
  events: SharedEvent[];
  locations: ParticipantLocation[];
  notifications: RealtimeNotification[];
}

export type ActiveMenuTab = 'galeri' | 'pesan-kata' | 'pesan-suara' | 'acara';

export type ServerWSMessage =
  | { type: 'init'; payload: AppStateSnapshot }
  | { type: 'media:created'; payload: MediaItem }
  | { type: 'media:deleted'; payload: { id: string } }
  | { type: 'note:created'; payload: PersonalNote }
  | { type: 'note:pinned'; payload: { id: string } }
  | { type: 'voice:created'; payload: VoiceMessage }
  | { type: 'voice:deleted'; payload: { id: string } }
  | { type: 'event:created'; payload: SharedEvent }
  | { type: 'event:updated'; payload: SharedEvent }
  | { type: 'location:updated'; payload: ParticipantLocation }
  | { type: 'notification:new'; payload: RealtimeNotification }
  | { type: 'notifications:read'; payload: { userName: string } };
