import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  MapPin,
  Navigation,
  Plus,
  Radio,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { EventStatus, ParticipantLocation, SharedEvent } from '../types/app';
import {
  calculateDistanceMeters,
  formatDistance,
  formatIndonesianDate,
  formatRelativeTime,
  getEventStatusLabel,
  validateEventInput,
} from '../utils/format';

interface EventsAndTrackerViewProps {
  events: SharedEvent[];
  locations: ParticipantLocation[];
  currentUser: string;
  googleMapsApiKey: string;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onEventCreated: (ev: SharedEvent) => void;
  onEventUpdated: (ev: SharedEvent) => void;
  onLocationUpdated: (loc: ParticipantLocation) => void;
}

interface PlaceCandidate {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

interface PlaceDetailsResult {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
  fetchFields?: (opts: { fields: string[] }) => Promise<void>;
}

interface AutocompleteSuggestionItem {
  placePrediction?: {
    placeId?: string;
    text: { text: string };
    toPlace: () => PlaceDetailsResult;
  };
}

interface GeocoderResultItem {
  place_id?: string;
  formatted_address?: string;
  geometry: {
    location: { lat: () => number; lng: () => number };
  };
}

function StatusIndicator({ status }: { status: EventStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
        <Radio className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
        <span>{getEventStatusLabel(status)}</span>
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
        <span>{getEventStatusLabel(status)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
      <Clock className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
      <span>{getEventStatusLabel(status)}</span>
    </span>
  );
}

function VenueMarker({ event }: { event: SharedEvent }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: event.lat, lng: event.lng }}
        onClick={() => setOpen((prev) => !prev)}
        title={`Titik Temu: ${event.locationName}`}
      >
        <Pin background="#0F766E" borderColor="#134E4A" glyphColor="#FFFFFF" scale={1.15} />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-1 text-xs space-y-1 max-w-[220px]">
            <p className="font-semibold text-zinc-900">{event.locationName}</p>
            <p className="text-zinc-600">
              Titik temu {event.title} · {event.time}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function ParticipantPin({
  participant,
  isSelf,
}: {
  participant: ParticipantLocation;
  isSelf: boolean;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: participant.lat, lng: participant.lng }}
        onClick={() => setOpen((prev) => !prev)}
        title={`${participant.userName} (Lokasi Langsung)`}
      >
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-md border-2 border-white flex items-center gap-1.5 ${
            isSelf ? 'bg-zinc-900 text-white' : 'bg-amber-600 text-white'
          }`}
        >
          <span>{participant.userName}</span>
        </div>
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-1 text-xs space-y-1">
            <p className="font-semibold text-zinc-900">
              {participant.userName} {isSelf ? '(Anda)' : ''}
            </p>
            <p className="font-mono tabular-nums text-zinc-600">
              {participant.lat.toFixed(5)}, {participant.lng.toFixed(5)}
            </p>
            <p className="text-zinc-500">
              Diperbarui {formatRelativeTime(participant.updatedAt)}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

/**
 * Manual place/cafe/city input with Google Places Autocomplete (all of Indonesia)
 * and fallback Place.searchByText. Manual typing always works independently too.
 */
function IndonesiaLocationInput({
  id,
  label,
  value,
  lat,
  lng,
  hasApiProvider,
  onChangeText,
  onSelectCoordinates,
}: {
  id: string;
  label: string;
  value: string;
  lat: number;
  lng: number;
  hasApiProvider: boolean;
  onChangeText: (text: string) => void;
  onSelectCoordinates: (name: string, nextLat: number, nextLng: number) => void;
}) {
  if (!hasApiProvider) {
    return (
      <ManualLocationFields
        id={id}
        label={label}
        value={value}
        lat={lat}
        lng={lng}
        onChangeText={onChangeText}
        onSelectCoordinates={onSelectCoordinates}
      />
    );
  }

  return (
    <PlacesPoweredLocationInput
      id={id}
      label={label}
      value={value}
      lat={lat}
      lng={lng}
      onChangeText={onChangeText}
      onSelectCoordinates={onSelectCoordinates}
    />
  );
}

function ManualLocationFields({
  id,
  label,
  value,
  lat,
  lng,
  onChangeText,
  onSelectCoordinates,
}: {
  id: string;
  label: string;
  value: string;
  lat: number;
  lng: number;
  onChangeText: (text: string) => void;
  onSelectCoordinates: (name: string, nextLat: number, nextLng: number) => void;
}) {
  const [showCoords, setShowCoords] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-900">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowCoords((prev) => !prev)}
          className="text-xs font-medium text-teal-800 hover:underline cursor-pointer"
        >
          {showCoords ? 'Sembunyikan koordinat' : 'Atur koordinat manual'}
        </button>
      </div>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="Ketik nama kafe, jalan, atau kota di seluruh Indonesia..."
        className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
      />
      {showCoords && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <input
            type="number"
            step="0.0001"
            aria-label="Latitude"
            value={lat}
            onChange={(e) => onSelectCoordinates(value, Number(e.target.value), lng)}
            className="px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-lg"
            placeholder="Latitude"
          />
          <input
            type="number"
            step="0.0001"
            aria-label="Longitude"
            value={lng}
            onChange={(e) => onSelectCoordinates(value, lat, Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-lg"
            placeholder="Longitude"
          />
        </div>
      )}
    </div>
  );
}

function PlacesPoweredLocationInput({
  id,
  label,
  value,
  lat,
  lng,
  onChangeText,
  onSelectCoordinates,
}: {
  id: string;
  label: string;
  value: string;
  lat: number;
  lng: number;
  onChangeText: (text: string) => void;
  onSelectCoordinates: (name: string, nextLat: number, nextLng: number) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const sessionTokenRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [suggestions, setSuggestions] = useState<AutocompleteSuggestionItem[]>([]);
  const [textCandidates, setTextCandidates] = useState<PlaceCandidate[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [showCoords, setShowCoords] = useState(false);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Fetch Indonesia-wide suggestions as user types manually
  useEffect(() => {
    if (!placesLib || !dropdownOpen) return;
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current as never,
          includedRegionCodes: ['id'],
          language: 'id',
        });
        setSuggestions((res.suggestions || []) as AutocompleteSuggestionItem[]);
        setSearchMessage(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [placesLib, value, dropdownOpen]);

  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestionItem) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      if (place.fetchFields) {
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
      }
      const placeName =
        place.displayName && place.formattedAddress
          ? `${place.displayName} — ${place.formattedAddress}`
          : place.formattedAddress || place.displayName || suggestion.placePrediction.text.text;
      const loc = place.location;
      if (loc) {
        onSelectCoordinates(placeName, loc.lat(), loc.lng());
        setSearchMessage('Titik lokasi berhasil disematkan ke peta.');
      } else {
        onChangeText(placeName);
      }
      sessionTokenRef.current = null;
      setSuggestions([]);
      setTextCandidates([]);
      setDropdownOpen(false);
    } catch {
      onChangeText(suggestion.placePrediction.text.text);
      setDropdownOpen(false);
    }
  };

  const handleManualTextSearch = async () => {
    const query = value.trim();
    if (!query) return;
    if (!placesLib && !geocodingLib) {
      setSearchMessage('Pencarian tempat siap digunakan setelah Google Maps termuat, atau ketik nama tempat langsung.');
      return;
    }

    setIsSearching(true);
    setSearchMessage(null);
    let results: PlaceCandidate[] = [];

    if (placesLib) {
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: query,
          fields: ['displayName', 'formattedAddress', 'location'],
          region: 'id',
          language: 'id',
          maxResultCount: 5,
        });

        results = ((places || []) as PlaceDetailsResult[])
          .filter((p) => Boolean(p.location))
          .map((p, idx) => ({
            id: p.id || `cand-${idx}`,
            label:
              p.displayName && p.formattedAddress
                ? `${p.displayName} — ${p.formattedAddress}`
                : p.formattedAddress || p.displayName || query,
            lat: p.location!.lat(),
            lng: p.location!.lng(),
          }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    }

    if (results.length === 0 && geocodingLib) {
      try {
        const geocoder = new geocodingLib.Geocoder();
        const geoRes = await geocoder.geocode({
          address: query,
          componentRestrictions: { country: 'ID' },
        });
        results = ((geoRes.results || []) as GeocoderResultItem[]).slice(0, 5).map((r, idx) => ({
          id: r.place_id || `geo-${idx}`,
          label: r.formatted_address || query,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    }

    if (results.length === 1) {
      onSelectCoordinates(results[0].label, results[0].lat, results[0].lng);
      setTextCandidates([]);
      setDropdownOpen(false);
      setSearchMessage('Lokasi ditemukan dan dipindahkan di peta.');
    } else if (results.length > 1) {
      setTextCandidates(results);
      setDropdownOpen(true);
    } else {
      setTextCandidates([]);
      setSearchMessage(
        'Nama lokasi manual tetap tersimpan. Anda juga bisa klik langsung pada peta atau atur koordinat manual.'
      );
    }

    setIsSearching(false);
  };

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-900">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowCoords((prev) => !prev)}
          className="text-xs font-medium text-teal-800 hover:underline cursor-pointer"
        >
          {showCoords ? 'Sembunyikan koordinat' : 'Atur koordinat manual'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          value={value}
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            onChangeText(e.target.value);
            setTextCandidates([]);
            setDropdownOpen(true);
          }}
          placeholder="Ketik bebas nama kafe, jalan, atau kota di seluruh Indonesia..."
          className="flex-1 min-w-0 px-3.5 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
        />
        <button
          type="button"
          onClick={handleManualTextSearch}
          disabled={isSearching || !value.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isSearching ? 'Mencari...' : 'Cari di Peta'}</span>
        </button>
      </div>

      {/* Indonesia-wide Autocomplete / Search Results Dropdown */}
      {dropdownOpen && (suggestions.length > 0 || textCandidates.length > 0) && (
        <ul
          role="listbox"
          aria-label="Saran lokasi di Indonesia"
          className="absolute left-0 right-0 z-30 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-stone-100"
        >
          {textCandidates.map((cand) => (
            <li key={cand.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectCoordinates(cand.label, cand.lat, cand.lng);
                  setTextCandidates([]);
                  setDropdownOpen(false);
                  setSearchMessage('Titik lokasi diperbarui di peta.');
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-800 hover:bg-teal-50 flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{cand.label}</span>
              </button>
            </li>
          ))}
          {suggestions.map((s, idx) => (
            <li key={`${s.placePrediction?.placeId || idx}`}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-800 hover:bg-teal-50 flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{s.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCoords && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <input
            type="number"
            step="0.0001"
            aria-label="Latitude"
            value={lat}
            onChange={(e) => onSelectCoordinates(value, Number(e.target.value), lng)}
            className="px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-lg"
            placeholder="Latitude"
          />
          <input
            type="number"
            step="0.0001"
            aria-label="Longitude"
            value={lng}
            onChange={(e) => onSelectCoordinates(value, lat, Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-lg"
            placeholder="Longitude"
          />
        </div>
      )}

      <p className="text-[11px] text-zinc-500">
        {searchMessage ||
          'Ketik bebas nama kafe, tempat, atau kota mana pun di Indonesia, lalu pilih saran atau klik "Cari di Peta".'}
      </p>
    </div>
  );
}

function MapViewportSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map) return;
    const prev = prevRef.current;
    if (!prev || Math.abs(prev.lat - lat) > 0.00001 || Math.abs(prev.lng - lng) > 0.00001) {
      map.panTo({ lat, lng });
      prevRef.current = { lat, lng };
    }
  }, [map, lat, lng]);

  return null;
}

function LiveEventMapCanvas({
  event,
  participants,
  currentUser,
  pinPickMode,
  onMapClickPickLocation,
}: {
  event: SharedEvent;
  participants: ParticipantLocation[];
  currentUser: string;
  pinPickMode: boolean;
  onMapClickPickLocation: (coords: { lat: number; lng: number }) => void;
}) {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-[380px] w-full bg-stone-100 border border-stone-200 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2">
        <MapPin className="w-7 h-7 text-teal-700" aria-hidden="true" />
        <p className="font-medium text-sm text-zinc-900">
          Peta Google Maps tidak dapat dimuat saat ini
        </p>
        <p className="text-xs text-zinc-600 max-w-sm">
          Koordinat langsung dan jarak antar peserta di bawah tetap diperbarui secara real-time melalui WebSocket.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`h-[380px] w-full rounded-xl overflow-hidden border relative ${
        pinPickMode ? 'border-teal-700 ring-2 ring-teal-700/30 cursor-crosshair' : 'border-stone-200'
      }`}
    >
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={{ lat: event.lat, lng: event.lng }}
        defaultZoom={15}
        gestureHandling="greedy"
        disableDefaultUI={false}
        onClick={(e) => {
          if (pinPickMode && e.detail.latLng) {
            onMapClickPickLocation({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
          }
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <MapViewportSync lat={event.lat} lng={event.lng} />
        <VenueMarker event={event} />
        {participants
          .filter((p) => p.isSharing)
          .map((participant) => (
            <ParticipantPin
              key={participant.id}
              participant={participant}
              isSelf={participant.userName === currentUser}
            />
          ))}
      </GoogleMap>
    </div>
  );
}

function EventsAndTrackerContent({
  events,
  locations,
  currentUser,
  hasApiProvider,
  selectedEventId,
  onSelectEvent,
  onEventCreated,
  onEventUpdated,
  onLocationUpdated,
}: Omit<EventsAndTrackerViewProps, 'googleMapsApiKey'> & { hasApiProvider: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDateEventId, setEditingDateEventId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editingLocEventId, setEditingLocEventId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocLat, setEditLocLat] = useState(-6.1964);
  const [editLocLng, setEditLocLng] = useState(106.8294);
  const [pinPickMode, setPinPickMode] = useState(false);

  // Create form state (manual typing enabled for all cities/cafes in Indonesia)
  const [title, setTitle] = useState('');
  const [companionName, setCompanionName] = useState('Fida');
  const [date, setDate] = useState('2026-11-20');
  const [time, setTime] = useState('17:00');
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState(-6.1964);
  const [lng, setLng] = useState(106.8294);
  const [description, setDescription] = useState('');
  const [startImmediately, setStartImmediately] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live location sharing state
  const [isSharingMyLocation, setIsSharingMyLocation] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const selectedEvent = useMemo(() => {
    if (selectedEventId) {
      const found = events.find((e) => e.id === selectedEventId);
      if (found) return found;
    }
    return events.find((e) => e.status === 'active') || events[0] || null;
  }, [events, selectedEventId]);

  const eventLocations = useMemo(() => {
    if (!selectedEvent) return [];
    return locations.filter((l) => l.eventId === selectedEvent.id);
  }, [locations, selectedEvent]);

  const sendLocationUpdate = useCallback(
    async (
      eventId: string,
      coords: { lat: number; lng: number; accuracy?: number },
      isSharing: boolean
    ) => {
      try {
        const res = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            userName: currentUser,
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
            isSharing,
          }),
        });
        if (res.ok) {
          const updated = (await res.json()) as ParticipantLocation;
          onLocationUpdated(updated);
        }
      } catch {
        // ignore transient network error
      }
    },
    [currentUser, onLocationUpdated]
  );

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const stopLocationSharing = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharingMyLocation(false);
    setGpsStatusMessage('Berbagi lokasi dihentikan.');
    if (selectedEvent) {
      const existing = eventLocations.find((l) => l.userName === currentUser);
      sendLocationUpdate(
        selectedEvent.id,
        {
          lat: existing?.lat ?? selectedEvent.lat,
          lng: existing?.lng ?? selectedEvent.lng,
        },
        false
      );
    }
  }, [currentUser, eventLocations, selectedEvent, sendLocationUpdate]);

  const startLocationSharing = () => {
    if (!selectedEvent) return;
    setGpsStatusMessage(null);
    setIsSharingMyLocation(true);

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsStatusMessage('Lokasi GPS perangkat aktif & tersinkronisasi.');
          sendLocationUpdate(
            selectedEvent.id,
            {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            },
            true
          );
        },
        () => {
          const fallbackLat = selectedEvent.lat + (Math.random() - 0.5) * 0.004;
          const fallbackLng = selectedEvent.lng + (Math.random() - 0.5) * 0.004;
          setGpsStatusMessage(
            'GPS perangkat tidak tersedia; menggunakan koordinat sekitar titik acara. Anda dapat memperbarui titik secara manual.'
          );
          sendLocationUpdate(
            selectedEvent.id,
            { lat: fallbackLat, lng: fallbackLng, accuracy: 25 },
            true
          );
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );
    } else {
      const fallbackLat = selectedEvent.lat + 0.0012;
      const fallbackLng = selectedEvent.lng - 0.0011;
      setGpsStatusMessage('Geolokasi browser tidak didukung; posisi sekitar titik temu dikirim.');
      sendLocationUpdate(selectedEvent.id, { lat: fallbackLat, lng: fallbackLng }, true);
    }
  };

  const handleUpdateSimulatedStep = () => {
    if (!selectedEvent) return;
    const existing = eventLocations.find((l) => l.userName === currentUser);
    const baseLat = existing ? existing.lat : selectedEvent.lat + 0.0025;
    const baseLng = existing ? existing.lng : selectedEvent.lng + 0.0025;
    const nextLat = baseLat + (selectedEvent.lat - baseLat) * 0.35 + (Math.random() - 0.5) * 0.0005;
    const nextLng = baseLng + (selectedEvent.lng - baseLng) * 0.35 + (Math.random() - 0.5) * 0.0005;
    setIsSharingMyLocation(true);
    setGpsStatusMessage('Koordinat lokasi terbaru berhasil dikirim ke semua peserta.');
    sendLocationUpdate(selectedEvent.id, { lat: nextLat, lng: nextLng, accuracy: 10 }, true);
  };

  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    const validationErr = validateEventInput({
      title,
      companionName,
      date,
      time,
      locationName,
    });
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          companionName: companionName.trim(),
          organizerName: currentUser,
          description: description.trim(),
          date,
          time,
          locationName: locationName.trim(),
          lat,
          lng,
          status: startImmediately ? 'active' : 'planned',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal membuat acara baru.');
        return;
      }
      const created = data as SharedEvent;
      onEventCreated(created);
      onSelectEvent(created.id);
      setTitle('');
      setLocationName('');
      setDescription('');
      setStartImmediately(false);
      setCreateOpen(false);
    } catch {
      setFormError('Gagal terhubung ke server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (ev: SharedEvent, nextStatus: EventStatus) => {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(ev.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          actorName: currentUser,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as SharedEvent;
        onEventUpdated(updated);
        if (nextStatus === 'active') {
          onSelectEvent(updated.id);
        }
      }
    } catch {
      // ignore error
    }
  };

  const handleSaveSchedule = async (ev: SharedEvent) => {
    if (!editDate || !editTime) return;
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(ev.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editDate,
          time: editTime,
          actorName: currentUser,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as SharedEvent;
        onEventUpdated(updated);
        setEditingDateEventId(null);
      }
    } catch {
      // ignore error
    }
  };

  const handleSaveLocationEdit = async (ev: SharedEvent) => {
    if (!editLocName.trim()) return;
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(ev.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: editLocName.trim(),
          lat: editLocLat,
          lng: editLocLng,
          actorName: currentUser,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as SharedEvent;
        onEventUpdated(updated);
        setEditingLocEventId(null);
      }
    } catch {
      // ignore error
    }
  };

  const handleMapClickPick = async (coords: { lat: number; lng: number }) => {
    if (!selectedEvent) return;
    setPinPickMode(false);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(selectedEvent.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          actorName: currentUser,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as SharedEvent;
        onEventUpdated(updated);
        setGpsStatusMessage('Titik pertemuan peta berhasil dipindahkan ke lokasi yang diklik.');
      }
    } catch {
      // ignore
    }
  };

  return (
    <section aria-labelledby="acara-heading" className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 pb-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-teal-800 tracking-wide">
            Agenda &amp; Pelacak Lokasi Real-Time ·{' '}
            <span className="font-mono tabular-nums">{events.length}</span> Acara
          </p>
          <h1 id="acara-heading" className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Acara Baru &amp; Lokasi Bersama
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Jadwalkan acara bersama seseorang lengkap dengan pengaturan tanggal, ketik bebas lokasi kafe atau kota di seluruh Indonesia, dan pantau posisi di peta saat acara berlangsung.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setCreateOpen((prev) => !prev);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          {createOpen ? (
            <>
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Tutup Formulir</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Buat Acara Baru</span>
            </>
          )}
        </button>
      </div>

      {/* Create New Event Form */}
      {createOpen && (
        <form
          onSubmit={handleCreateEvent}
          className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            Jadwalkan Acara Baru
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="event-title" className="block text-sm font-medium text-zinc-900 mb-1">
                Nama Acara
              </label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ngopi Sore & Jalan Santai"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label htmlFor="event-companion" className="block text-sm font-medium text-zinc-900 mb-1">
                Bersama Siapa
              </label>
              <input
                id="event-companion"
                type="text"
                value={companionName}
                onChange={(e) => setCompanionName(e.target.value)}
                placeholder="Nama pasangan / rekan"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-zinc-900 mb-1">
                  Tanggal
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <div>
                <label htmlFor="event-time" className="block text-sm font-medium text-zinc-900 mb-1">
                  Jam
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>

          <IndonesiaLocationInput
            id="event-location"
            label="Alamat / Nama Kafe / Kota Pertemuan (Ketik Manual)"
            value={locationName}
            lat={lat}
            lng={lng}
            hasApiProvider={hasApiProvider}
            onChangeText={setLocationName}
            onSelectCoordinates={(name, nextLat, nextLng) => {
              setLocationName(name);
              setLat(nextLat);
              setLng(nextLng);
            }}
          />

          <div>
            <label htmlFor="event-desc" className="block text-sm font-medium text-zinc-900 mb-1">
              Catatan Acara (opsional)
            </label>
            <textarea
              id="event-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail agenda, titik temu, atau pesan singkat..."
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={startImmediately}
                onChange={(e) => setStartImmediately(e.target.checked)}
                className="w-4 h-4 accent-teal-700 rounded"
              />
              <span>Tandai sedang berlangsung sekarang (aktifkan pelacak lokasi)</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Acara'}
              </button>
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}
        </form>
      )}

      {/* Main 2-column Split: Event List + Live Location Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Events List */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-sans text-sm font-semibold text-zinc-700">
            Daftar Acara ({events.length})
          </h2>

          {events.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3">
              <p className="font-display text-lg font-medium text-zinc-900">
                Belum ada acara terjadwal
              </p>
              <p className="text-sm text-zinc-600">
                Buat acara baru untuk mengatur tanggal pertemuan dan mengaktifkan pelacak lokasi bersama.
              </p>
            </div>
          ) : (
            events.map((ev) => {
              const isSelected = selectedEvent?.id === ev.id;
              const isEditingDate = editingDateEventId === ev.id;
              const isEditingLoc = editingLocEventId === ev.id;

              return (
                <article
                  key={ev.id}
                  className={`bg-white border rounded-2xl p-5 space-y-4 transition-colors ${
                    isSelected ? 'border-teal-700 ring-1 ring-teal-700/20' : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <StatusIndicator status={ev.status} />
                      <h3 className="font-display text-lg font-semibold text-zinc-900 leading-snug">
                        {ev.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectEvent(ev.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-teal-700 text-white'
                          : 'bg-stone-100 text-zinc-800 hover:bg-stone-200'
                      }`}
                    >
                      {isSelected ? 'Dipantau' : 'Pantau Lokasi'}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-zinc-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                      <span>
                        {ev.organizerName} &amp; {ev.companionName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                      <span className="font-mono tabular-nums">
                        {formatIndonesianDate(ev.date)} · {ev.time} WIB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                      <span>{ev.locationName}</span>
                    </div>
                  </div>

                  {ev.description && (
                    <p className="text-sm text-zinc-600 leading-relaxed">{ev.description}</p>
                  )}

                  {/* Inline Date Reschedule */}
                  {isEditingDate && (
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
                      <p className="text-xs font-semibold text-zinc-800">Atur Ulang Tanggal &amp; Jam</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          aria-label="Tanggal baru"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="px-2.5 py-1.5 text-xs font-mono border border-stone-300 rounded-md bg-white"
                        />
                        <input
                          type="time"
                          aria-label="Jam baru"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="px-2.5 py-1.5 text-xs font-mono border border-stone-300 rounded-md bg-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDateEventId(null)}
                          className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSchedule(ev)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                        >
                          Simpan Tanggal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Location Edit */}
                  {isEditingLoc && (
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
                      <IndonesiaLocationInput
                        id={`edit-loc-${ev.id}`}
                        label="Ubah Nama Lokasi / Kafe / Kota"
                        value={editLocName}
                        lat={editLocLat}
                        lng={editLocLng}
                        hasApiProvider={hasApiProvider}
                        onChangeText={setEditLocName}
                        onSelectCoordinates={(name, nextLat, nextLng) => {
                          setEditLocName(name);
                          setEditLocLat(nextLat);
                          setEditLocLng(nextLng);
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingLocEventId(null)}
                          className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveLocationEdit(ev)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                        >
                          Simpan Lokasi
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDateEventId(ev.id);
                          setEditDate(ev.date);
                          setEditTime(ev.time);
                        }}
                        className="text-xs font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                      >
                        Atur Tanggal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocEventId(ev.id);
                          setEditLocName(ev.locationName);
                          setEditLocLat(ev.lat);
                          setEditLocLng(ev.lng);
                        }}
                        className="text-xs font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                      >
                        Ubah Lokasi
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {ev.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(ev, 'active')}
                          className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Mulai Acara
                        </button>
                      )}
                      {ev.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(ev, 'completed')}
                          className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Right: Shared Live Location Tracker */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
          {!selectedEvent ? (
            <div className="py-16 text-center space-y-2">
              <Compass className="w-8 h-8 text-zinc-400 mx-auto" aria-hidden="true" />
              <p className="font-display text-lg font-medium text-zinc-900">
                Pilih atau buat acara untuk melacak lokasi bersama
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold text-teal-800">Pelacak Lokasi Bersama</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedEvent.locationName}</span>
                  </div>
                  <h2 className="font-display text-xl font-semibold text-zinc-900">
                    {selectedEvent.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isSharingMyLocation ? (
                    <button
                      type="button"
                      onClick={stopLocationSharing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Hentikan Berbagi Lokasi</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startLocationSharing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Bagikan Lokasi Saya</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleUpdateSimulatedStep}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>Perbarui Posisi</span>
                  </button>

                  {hasApiProvider && (
                    <button
                      type="button"
                      onClick={() => setPinPickMode((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap ${
                        pinPickMode
                          ? 'bg-zinc-900 text-white'
                          : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{pinPickMode ? 'Klik Peta Sekarang...' : 'Tandai di Peta'}</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedEvent.status !== 'active' && (
                <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
                  <span>
                    Acara ini berstatus <strong>{getEventStatusLabel(selectedEvent.status)}</strong>. Klik &ldquo;Mulai Acara&rdquo; agar notifikasi lokasi aktif terkirim ke pasangan Anda.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedEvent, 'active')}
                    className="px-3 py-1 font-semibold bg-amber-800 text-white rounded-md hover:bg-amber-900 shrink-0 cursor-pointer"
                  >
                    Aktifkan
                  </button>
                </div>
              )}

              {pinPickMode && (
                <p className="text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2">
                  Mode tandai aktif: klik atau geser peta ke kota/kafe mana saja di Indonesia, lalu klik di titik tujuan untuk memindahkan pin acara.
                </p>
              )}

              {gpsStatusMessage && (
                <p className="text-xs text-zinc-600 bg-stone-50 border border-stone-200 rounded-lg px-3.5 py-2">
                  {gpsStatusMessage}
                </p>
              )}

              {/* Map Area */}
              {hasApiProvider ? (
                <LiveEventMapCanvas
                  event={selectedEvent}
                  participants={eventLocations}
                  currentUser={currentUser}
                  pinPickMode={pinPickMode}
                  onMapClickPickLocation={handleMapClickPick}
                />
              ) : (
                <div className="h-[340px] w-full bg-stone-100 border border-stone-200 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <MapPin className="w-7 h-7 text-teal-700" aria-hidden="true" />
                  <p className="text-sm font-medium text-zinc-900">
                    Menunggu konfigurasi Google Maps API Key
                  </p>
                  <p className="text-xs text-zinc-600 max-w-md">
                    Koordinat peserta dan jarak menuju lokasi pertemuan tetap tersinkronisasi secara real-time di panel bawah ini.
                  </p>
                </div>
              )}

              {/* Live Participant Coordinates & Distance Readout */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">
                    Peserta yang Membagikan Lokasi
                  </span>
                  <span className="font-mono tabular-nums">
                    Titik Temu: {selectedEvent.lat.toFixed(4)}, {selectedEvent.lng.toFixed(4)}
                  </span>
                </div>

                {eventLocations.filter((l) => l.isSharing).length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3">
                    Belum ada peserta yang menyalakan berbagi lokasi untuk acara ini. Klik &ldquo;Bagikan Lokasi Saya&rdquo; untuk memulai.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                    {eventLocations
                      .filter((l) => l.isSharing)
                      .map((loc) => {
                        const distMeters = calculateDistanceMeters(
                          { lat: loc.lat, lng: loc.lng },
                          { lat: selectedEvent.lat, lng: selectedEvent.lng }
                        );
                        return (
                          <div
                            key={loc.id}
                            className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-white text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-semibold text-zinc-900">
                                {loc.userName}{' '}
                                {loc.userName === currentUser ? '(Anda)' : ''}
                              </p>
                              <p className="font-mono tabular-nums text-zinc-500">
                                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                              </p>
                            </div>

                            <div className="text-right space-y-0.5">
                              <p className="font-mono tabular-nums font-medium text-teal-800">
                                {formatDistance(distMeters)} dari titik temu
                              </p>
                              <p className="font-mono tabular-nums text-zinc-500">
                                {formatRelativeTime(loc.updatedAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Berbagi lokasi hanya aktif atas persetujuan Anda dan dapat dihentikan kapan saja. Penggunaan peta tunduk pada Persyaratan Layanan Google Maps Platform.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function EventsAndTrackerView({
  googleMapsApiKey,
  ...rest
}: EventsAndTrackerViewProps) {
  if (!googleMapsApiKey) {
    return <EventsAndTrackerContent {...rest} hasApiProvider={false} />;
  }

  return (
    <APIProvider
      apiKey={googleMapsApiKey}
      libraries={['marker', 'places', 'geocoding']}
      language="id"
      region="ID"
    >
      <EventsAndTrackerContent {...rest} hasApiProvider={true} />
    </APIProvider>
  );
}
