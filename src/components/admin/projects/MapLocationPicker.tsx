import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, X, AlertTriangle, Loader2, Check } from 'lucide-react';
import { loadGoogleMaps, type GoogleMapsBundle, MapsConfigError } from '../../../services/googleMaps';

export interface MapLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  onClear?: () => void;
  /** When city changes, optionally fly to the new center */
  focusCenter?: { lat: number; lng: number } | null;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 }; // Riyadh
const DEFAULT_ZOOM = 12;

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  lat,
  lng,
  onChange,
  onClear,
  focusCenter,
  disabled = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const bundleRef = useRef<GoogleMapsBundle | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasCoords = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);

  // Initialize Google Maps instance
  useEffect(() => {
    let active = true;

    async function initMap() {
      try {
        setLoading(true);
        setLoadError(null);
        const bundle = await loadGoogleMaps();
        if (!active) return;
        bundleRef.current = bundle;

        if (!containerRef.current) return;

        const initialCenter = hasCoords ? { lat, lng } : focusCenter ?? DEFAULT_CENTER;

        const map = new bundle.Map(containerRef.current, {
          center: initialCenter,
          zoom: hasCoords ? 15 : DEFAULT_ZOOM,
          mapId: bundle.mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          clickableIcons: false,
        });

        mapInstanceRef.current = map;

        // Map click listener to place/move marker
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (disabled) return;
          if (!event.latLng) return;
          const newLat = Number(event.latLng.lat().toFixed(6));
          const newLng = Number(event.latLng.lng().toFixed(6));
          onChange({ lat: newLat, lng: newLng });
        });

        setLoading(false);
      } catch (err) {
        if (!active) return;
        setLoading(false);
        if (err instanceof MapsConfigError) {
          setLoadError(err.message);
        } else {
          setLoadError('تعذر تحميل خريطة جوجل، يمكنك إدخال الإحداثيات يدوياً.');
        }
      }
    }

    void initMap();

    return () => {
      active = false;
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update or create marker when lat/lng change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const bundle = bundleRef.current;
    if (!map || !bundle) return;

    if (!hasCoords) {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      return;
    }

    const position = { lat, lng };

    if (!markerRef.current) {
      // Create custom pin element
      const pinElement = document.createElement('div');
      pinElement.className =
        'flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white shadow-lg border-2 border-white ring-2 ring-accent/30 cursor-grab active:cursor-grabbing transition-transform hover:scale-110';
      pinElement.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      `;

      const marker = new bundle.AdvancedMarkerElement({
        map,
        position,
        gmpDraggable: !disabled,
        title: 'موقع المشروع المحدد',
        content: pinElement,
      });

      marker.addListener('dragend', () => {
        const pos = marker.position;
        if (!pos) return;
        const newLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
        const newLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
        if (typeof newLat === 'number' && typeof newLng === 'number') {
          onChange({
            lat: Number(newLat.toFixed(6)),
            lng: Number(newLng.toFixed(6)),
          });
        }
      });

      markerRef.current = marker;
    } else {
      markerRef.current.position = position;
      markerRef.current.gmpDraggable = !disabled;
    }
  }, [lat, lng, hasCoords, disabled, onChange]);

  // Handle focusCenter changes (e.g. from selecting a city)
  useEffect(() => {
    if (!focusCenter || !mapInstanceRef.current) return;
    mapInstanceRef.current.panTo(focusCenter);
    mapInstanceRef.current.setZoom(13);
  }, [focusCenter]);

  // Center on current marker
  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current || !hasCoords) return;
    mapInstanceRef.current.panTo({ lat, lng });
    mapInstanceRef.current.setZoom(16);
  }, [hasCoords, lat, lng]);

  const handleCopy = useCallback(() => {
    if (!hasCoords) return;
    const text = `${lat}, ${lng}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [hasCoords, lat, lng]);

  const handleManualLatChange = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onChange({ lat: num, lng: lng ?? DEFAULT_CENTER.lng });
    }
  };

  const handleManualLngChange = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onChange({ lat: lat ?? DEFAULT_CENTER.lat, lng: num });
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Map display */}
      <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-muted-border/50 bg-surface">
        <div ref={containerRef} className="w-full h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-canvas/80 backdrop-blur-xs">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-xs font-bold text-neutral-text/70">جاري تحميل الخريطة...</span>
          </div>
        )}

        {/* Error overlay */}
        {loadError && (
          <div className="absolute inset-0 z-10 p-6 flex flex-col items-center justify-center text-center gap-2 bg-canvas/95">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-xs font-bold text-heading max-w-sm">{loadError}</p>
            <p className="text-[11px] text-neutral-text/60">يمكنك تحديد الإحداثيات يدوياً من الحقول أدناه.</p>
          </div>
        )}

        {/* Helper instructions pill */}
        {!loading && !loadError && !disabled && (
          <div className="absolute top-2.5 start-2.5 z-5 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas/90 backdrop-blur-sm text-[10px] font-bold text-neutral-text border border-muted-border/40 shadow-xs">
              <MapPin className="w-3 h-3 text-accent" />
              انقر على الخريطة لتثبيت الموقع أو اسحب الدبوس
            </span>
          </div>
        )}

        {/* Controls Overlay */}
        {hasCoords && !loading && (
          <div className="absolute bottom-2.5 inset-x-2.5 z-5 flex items-center justify-between gap-2 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas/95 backdrop-blur-sm border border-muted-border/50 shadow-md text-xs text-heading font-mono pointer-events-auto">
              <span className="text-[10px] font-sans font-bold text-neutral-text/60">الإحداثيات:</span>
              <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="ms-1 p-1 hover:text-accent cursor-pointer transition text-neutral-text/60"
                title="نسخ الإحداثيات"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <MapPin className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={handleRecenter}
                className="p-2 rounded-xl bg-canvas/95 hover:bg-surface border border-muted-border/50 shadow-md text-neutral-text hover:text-heading cursor-pointer transition"
                title="التركيز على موقع المشروع"
              >
                <Navigation className="w-4 h-4 text-accent" />
              </button>
              {onClear && !disabled && (
                <button
                  type="button"
                  onClick={onClear}
                  className="p-2 rounded-xl bg-canvas/95 hover:bg-surface border border-muted-border/50 shadow-md text-red-500 hover:text-red-600 cursor-pointer transition"
                  title="مسح الموقع من الخريطة"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual numeric inputs fallback/precision control */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="manual-lat" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            خط العرض (Latitude)
          </label>
          <input
            id="manual-lat"
            type="number"
            step="any"
            dir="ltr"
            placeholder="24.7136"
            disabled={disabled}
            value={lat ?? ''}
            onChange={(e) => handleManualLatChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs font-mono text-heading outline-none focus:border-accent disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="manual-lng" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            خط الطول (Longitude)
          </label>
          <input
            id="manual-lng"
            type="number"
            step="any"
            dir="ltr"
            placeholder="46.6753"
            disabled={disabled}
            value={lng ?? ''}
            onChange={(e) => handleManualLngChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs font-mono text-heading outline-none focus:border-accent disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
};
