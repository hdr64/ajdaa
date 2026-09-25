import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
const CONFIGURED_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim();

/** Thrown when the app is misconfigured, as opposed to a network/auth failure. */
export class MapsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapsConfigError';
  }
}

export interface GoogleMapsBundle {
  Map: typeof google.maps.Map;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  /** The Map ID actually applied. Advanced markers refuse to load without one. */
  mapId: string;
  /** True when we fell back to Google's shared demo Map ID (development only). */
  usingDemoMapId: boolean;
}

let bundlePromise: Promise<GoogleMapsBundle> | null = null;
let demoMapIdWarned = false;

/**
 * Boots the Google Maps JS API exactly once per page load.
 *
 * The script is injected by the loader, so callers must treat the returned
 * constructors as the only supported way to touch `google.maps.*`.
 */
export function loadGoogleMaps(): Promise<GoogleMapsBundle> {
  if (bundlePromise) return bundlePromise;

  if (!API_KEY) {
    return Promise.reject(
      new MapsConfigError(
        'VITE_GOOGLE_MAPS_API_KEY is missing. Copy .env.example to .env.local and set it.'
      )
    );
  }

  bundlePromise = (async (): Promise<GoogleMapsBundle> => {
    // Label language is fixed at load time, so derive it from the document the
    // boot script has already stamped (index.html sets lang before React mounts).
    const docLang = document.documentElement.lang === 'en' ? 'en' : 'ar';
    setOptions({ key: API_KEY, v: 'weekly', language: docLang, region: 'SA' });

    const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ]);

    let mapId = CONFIGURED_MAP_ID;
    let usingDemoMapId = false;

    // AdvancedMarkerElement is a no-op without a Map ID. The demo ID lets the
    // map run locally, but it must never reach production.
    if (!mapId) {
      mapId = Map.DEMO_MAP_ID;
      usingDemoMapId = true;
      if (!demoMapIdWarned) {
        demoMapIdWarned = true;
        console.warn(
          '[maps] VITE_GOOGLE_MAPS_MAP_ID is not set — falling back to DEMO_MAP_ID. ' +
            'Create a Map ID in Google Cloud Console before shipping.'
        );
      }
    }

    return { Map, AdvancedMarkerElement, mapId, usingDemoMapId };
  })().catch((error: unknown) => {
    // Allow a later mount to retry instead of caching the failure forever.
    bundlePromise = null;
    throw error;
  });

  return bundlePromise;
}
