import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Property } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import { useLanguage } from '../../hooks/useLanguage';
import {
  MapPin,
  Play,
  X,
  Building,
  Building2,
  Warehouse,
  Store,
  Sparkles,
  Compass,
  ArrowRight,
  RotateCcw,
  Maximize2,
  Minimize2,
  Layers,
  Navigation,
  ExternalLink,
  Plus,
  Minus,
  CheckCircle2
} from 'lucide-react';

interface InteractiveProjectsMapProps {
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact' | 'clients', options?: { projectId?: number; unitId?: string }) => void;
  onQuickView?: (prop: Property) => void;
}

const getYouTubeEmbedUrl = (url?: string, autoplay: boolean = true): string => {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=${autoplay ? '1' : '0'}&rel=0&modestbranding=1`;
  }
  return url;
};

type BasemapStyle = 'dark' | 'satellite';
type RegionFilter = 'all' | 'riyadh' | 'ahsa';

export const InteractiveProjectsMap: React.FC<InteractiveProjectsMapProps> = ({
  onNavigate,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: number]: L.Marker }>({});
  const darkLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const satLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const allProjects = AdminStorage.getAllProjects().filter((p) => p.lat && p.lng);

  const [selectedProject, setSelectedProject] = useState<Property | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'video'>('photos');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('all');
  const [mapStyle, setMapStyle] = useState<BasemapStyle>('dark');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Default coordinate centers
  const riyadhCenter: [number, number] = [24.74, 46.71];
  const ahsaCenter: [number, number] = [25.38, 49.58];
  const initialCenter: [number, number] = riyadhCenter;
  const initialZoom = 11;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      minZoom: 6,
      maxZoom: 18,
    });

    // Layer 1: ESRI World Dark Gray Canvas (Clean roads & minimal geometries, NO WATERMARK)
    const darkBase = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, subdomains: ['server', 'services'] }
    );
    const darkRef = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, opacity: 0.85 }
    );
    const darkGroup = L.layerGroup([darkBase, darkRef]);
    darkLayerGroupRef.current = darkGroup;

    // Layer 2: ESRI High-Resolution Satellite World Imagery
    const satBase = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18 }
    );
    const satRef = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, opacity: 0.8 }
    );
    const satGroup = L.layerGroup([satBase, satRef]);
    satLayerGroupRef.current = satGroup;

    // Add initial dark layer
    darkGroup.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Map Style Switch (Dark vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !darkLayerGroupRef.current || !satLayerGroupRef.current) return;

    if (mapStyle === 'dark') {
      map.removeLayer(satLayerGroupRef.current);
      if (!map.hasLayer(darkLayerGroupRef.current)) {
        darkLayerGroupRef.current.addTo(map);
      }
    } else {
      map.removeLayer(darkLayerGroupRef.current);
      if (!map.hasLayer(satLayerGroupRef.current)) {
        satLayerGroupRef.current.addTo(map);
      }
    }
  }, [mapStyle]);

  // Handle FullScreen Resize Invalidation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isFullScreen]);

  // Filter projects by both type and region
  const filteredProjects = allProjects.filter((p) => {
    // Type filter
    if (filterType !== 'all' && p.type !== filterType) return false;
    // Region filter
    if (selectedRegion === 'riyadh' && p.city !== 'الرياض') return false;
    if (selectedRegion === 'ahsa' && p.city !== 'الأحساء') return false;
    return true;
  });

  // Update Markers with Luxury Jewel Beacon Architecture
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    filteredProjects.forEach((p) => {
      if (!p.lat || !p.lng) return;

      const isSelected = selectedProject?.id === p.id;

      // Icon selector based on project type
      let typeClass = 'type-commercial';
      let iconSvg = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      `;

      if (p.type === 'office') {
        typeClass = 'type-office';
        iconSvg = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
            <path d="M9 22v-4h6v4"/>
            <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
            <path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/>
            <path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
          </svg>
        `;
      } else if (p.type === 'logistics') {
        typeClass = 'type-logistics';
        iconSvg = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
        `;
      }

      // Compact display title for tooltip
      const shortTitle = p.title.split(' (')[0].trim();

      // Custom HTML Pin Element
      const pinHtml = `
        <div class="custom-map-beacon ${typeClass} ${isSelected ? 'is-selected' : ''}" data-project-id="${p.id}">
          <!-- Radiating Radar Pulse Ring -->
          <div class="beacon-pulse-ring"></div>
          
          <!-- Floating Interactive Tooltip -->
          <div class="beacon-tooltip">
            <div class="tooltip-content">
              <span class="tooltip-title">${shortTitle}</span>
              <span class="tooltip-type-badge">${p.priceType}</span>
            </div>
            <div class="tooltip-arrow"></div>
          </div>

          <!-- Jewel Circle Core -->
          <div class="beacon-core">
            <div class="beacon-icon-inner">
              ${iconSvg}
            </div>
          </div>

          <!-- Bottom Anchor Pointer -->
          <div class="beacon-pointer"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-beacon-icon',
        html: pinHtml,
        iconSize: [160, 60],
        iconAnchor: [80, 56],
      });

      const marker = L.marker([p.lat, p.lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      }).addTo(map);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        handleSelectProject(p);
      });

      markersRef.current[p.id] = marker;
    });
  }, [filteredProjects, selectedProject]);

  // Smart Camera Fly-To with Viewport Offset
  const handleSelectProject = (project: Property) => {
    setSelectedProject(project);
    setSelectedImage(project.image);
    setActiveMediaTab('photos');

    const map = mapInstanceRef.current;
    if (map && project.lat && project.lng) {
      const isDesktop = window.innerWidth >= 768;
      // In Arabic RTL, the drawer is on the right, so we offset center longitude slightly eastward
      // so that the marker remains visible in the open map area on the left.
      const offsetLng = isDesktop ? (isAr ? 0.018 : -0.018) : 0;
      const offsetLat = isDesktop ? 0 : -0.005;

      map.flyTo([project.lat + offsetLat, project.lng + offsetLng], 14, {
        duration: 1.1,
        easeLinearity: 0.25,
      });
    }
  };

  // Region switcher handler
  const handleRegionSelect = (region: RegionFilter) => {
    setSelectedRegion(region);
    setSelectedProject(null);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (region === 'ahsa') {
      map.flyTo(ahsaCenter, 13, { duration: 1.4 });
    } else if (region === 'riyadh') {
      map.flyTo(riyadhCenter, 11, { duration: 1.4 });
    } else {
      // Show all (Saudi bounds or center)
      map.flyTo([24.95, 47.8], 8, { duration: 1.4 });
    }
  };

  const handleResetView = () => {
    setSelectedProject(null);
    setSelectedRegion('riyadh');
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo(riyadhCenter, initialZoom, { duration: 1.1 });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <section className="py-20 relative overflow-hidden bg-canvas">
      {/* Luxury Map & Jewel Beacon Custom CSS Styles */}
      <style>{`
        .custom-leaflet-beacon-icon {
          background: transparent !important;
          border: none !important;
        }
        
        .custom-map-beacon {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          user-select: none;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .custom-map-beacon:hover {
          transform: translateY(-4px) scale(1.08);
          z-index: 2500 !important;
        }
        
        .custom-map-beacon.is-selected {
          transform: translateY(-7px) scale(1.18);
          z-index: 3000 !important;
        }

        /* Pulse wave under beacon */
        .beacon-pulse-ring {
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 10px;
          border-radius: 50%;
          background: rgba(217, 183, 124, 0.45);
          box-shadow: 0 0 16px rgba(217, 183, 124, 0.8);
          animation: beaconPulse 2.2s infinite ease-out;
          pointer-events: none;
        }
        
        .custom-map-beacon.type-office .beacon-pulse-ring {
          background: rgba(94, 177, 195, 0.45);
          box-shadow: 0 0 16px rgba(94, 177, 195, 0.8);
        }
        
        .custom-map-beacon.type-logistics .beacon-pulse-ring {
          background: rgba(245, 158, 11, 0.45);
          box-shadow: 0 0 16px rgba(245, 158, 11, 0.8);
        }

        @keyframes beaconPulse {
          0% { transform: translateX(-50%) scale(0.6); opacity: 0.9; }
          70% { transform: translateX(-50%) scale(2.4); opacity: 0; }
          100% { transform: translateX(-50%) scale(0.6); opacity: 0; }
        }

        /* Core Jewel Circle */
        .beacon-core {
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          background: #0b131e;
          border: 2px solid #d9b77c;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7), 0 0 15px rgba(217, 183, 124, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
        }

        .custom-map-beacon.type-office .beacon-core {
          border-color: #5eb1c3;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7), 0 0 15px rgba(94, 177, 195, 0.35);
        }

        .custom-map-beacon.type-logistics .beacon-core {
          border-color: #f59e0b;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7), 0 0 15px rgba(245, 158, 11, 0.35);
        }

        .custom-map-beacon.is-selected .beacon-core {
          border-color: #f2e2bd;
          background: #0f5f70;
          box-shadow: 0 0 25px rgba(217, 183, 124, 0.9), 0 8px 30px rgba(0, 0, 0, 0.9);
        }

        .beacon-icon-inner {
          color: #d9b77c;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.3s ease;
        }

        .custom-map-beacon.type-office .beacon-icon-inner {
          color: #5eb1c3;
        }

        .custom-map-beacon.type-logistics .beacon-icon-inner {
          color: #f59e0b;
        }

        .custom-map-beacon.is-selected .beacon-icon-inner {
          color: #ffffff;
        }

        /* Pointer triangle pointing down */
        .beacon-pointer {
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid #d9b77c;
          margin-top: -1px;
          position: relative;
          z-index: 1;
        }

        .custom-map-beacon.type-office .beacon-pointer {
          border-top-color: #5eb1c3;
        }

        .custom-map-beacon.type-logistics .beacon-pointer {
          border-top-color: #f59e0b;
        }

        .custom-map-beacon.is-selected .beacon-pointer {
          border-top-color: #f2e2bd;
        }

        /* Floating Tooltip */
        .beacon-tooltip {
          position: absolute;
          bottom: 44px;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          opacity: 0;
          visibility: hidden;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          white-space: nowrap;
          z-index: 10;
        }

        .custom-map-beacon:hover .beacon-tooltip,
        .custom-map-beacon.is-selected .beacon-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        .tooltip-content {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(10, 17, 26, 0.94);
          border: 1px solid rgba(217, 183, 124, 0.45);
          border-radius: 9999px;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
        }

        .custom-map-beacon.is-selected .tooltip-content {
          border-color: #d9b77c;
          background: rgba(15, 95, 112, 0.96);
        }

        .tooltip-title {
          font-size: 11px;
          font-weight: 800;
          color: #ffffff;
        }

        .tooltip-type-badge {
          font-size: 9px;
          font-weight: 700;
          color: #d9b77c;
          background: rgba(217, 183, 124, 0.15);
          padding: 1px 6px;
          border-radius: 9999px;
        }

        .tooltip-arrow {
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid rgba(10, 17, 26, 0.94);
          margin: 0 auto;
        }

        .leaflet-container {
          background: #090e15 !important;
          font-family: inherit !important;
        }

        /* Clean smooth tile filtering for midnight slate elegance */
        .leaflet-tile {
          filter: brightness(0.95) contrast(1.15);
        }
      `}</style>

      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-1/4 w-[750px] h-[450px] bg-accent/10 blur-[170px] rounded-full pointer-events-none -z-10"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-10 right-1/4 w-[650px] h-[380px] bg-gold/10 blur-[170px] rounded-full pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 brand-badge text-xs font-bold px-3.5 py-1 rounded-full mb-3 text-accent shadow-xs">
              <Compass className="w-3.5 h-3.5 text-accent animate-spin-slow" />
              <span>{isAr ? 'خريطة المشاريع الاستراتيجية' : 'Strategic Projects Map'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-heading tracking-tight leading-tight">
              {isAr ? 'اكتشف مواقع مشاريع أجدا على الخريطة' : 'Explore Ajda Developments on the Map'}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-text/70 mt-2 max-w-2xl leading-relaxed">
              {isAr
                ? 'حضور نوعي ومواقع استراتيجية مدروسة على المحاور الحيوية وشبكات الطرق الرئيسية. انقر على أي مشروع للاطلاع على كافة التفاصيل الهندسية والوسائط وجولة 4K.'
                : 'Strategic real estate footprints along prime commercial corridors and logistics thoroughfares. Select any pin to review full specs, video tours, and imagery.'}
            </p>
          </div>

          {/* Quick Filter Chips (Category) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                filterType === 'all'
                  ? 'brand-fill text-canvas border-accent shadow-sm'
                  : 'bg-surface/80 border-muted-border/40 text-neutral-text/80 hover:text-heading'
              }`}
            >
              {isAr ? 'الكل' : 'All'} ({allProjects.length})
            </button>
            <button
              onClick={() => setFilterType('commercial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                filterType === 'commercial'
                  ? 'brand-fill text-canvas border-accent shadow-sm'
                  : 'bg-surface/80 border-muted-border/40 text-neutral-text/80 hover:text-heading'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-gold" />
              <span>{isAr ? 'تجاري' : 'Commercial'}</span>
            </button>
            <button
              onClick={() => setFilterType('office')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                filterType === 'office'
                  ? 'brand-fill text-canvas border-accent shadow-sm'
                  : 'bg-surface/80 border-muted-border/40 text-neutral-text/80 hover:text-heading'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-accent" />
              <span>{isAr ? 'إداري ومكتبي' : 'Corporate'}</span>
            </button>
            <button
              onClick={() => setFilterType('logistics')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                filterType === 'logistics'
                  ? 'brand-fill text-canvas border-accent shadow-sm'
                  : 'bg-surface/80 border-muted-border/40 text-neutral-text/80 hover:text-heading'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-500" />
              <span>{isAr ? 'لوجستي' : 'Logistics'}</span>
            </button>
          </div>
        </div>

        {/* Map Interactive Canvas Shell */}
        <div
          className={`
            relative w-full overflow-hidden transition-all duration-300 border border-muted-border/60 shadow-2xl bg-[#090e15]
            ${
              isFullScreen
                ? 'fixed inset-0 z-[999] rounded-none h-screen w-screen border-none'
                : 'h-[620px] sm:h-[680px] lg:h-[720px] rounded-3xl sm:rounded-[36px]'
            }
          `}
        >
          {/* Leaflet Map Target */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Top Bar Floating Controls inside Map */}
          <div className="absolute top-4 inset-x-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
            {/* Left/Start: Radar Status & Region Selector */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Radar Live Indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-white shadow-lg">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-bold">
                  {isAr ? 'رادار أجدا العقاري' : 'Ajda Real Estate Radar'}
                </span>
              </div>

              {/* City / Region Switcher Tabs */}
              <div className="flex items-center p-1 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-white/15 shadow-lg text-xs font-bold">
                <button
                  onClick={() => handleRegionSelect('all')}
                  className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                    selectedRegion === 'all'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {isAr ? 'كافة المناطق' : 'All Regions'}
                </button>
                <button
                  onClick={() => handleRegionSelect('riyadh')}
                  className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                    selectedRegion === 'riyadh'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {isAr ? 'الرياض (6)' : 'Riyadh (6)'}
                </button>
                <button
                  onClick={() => handleRegionSelect('ahsa')}
                  className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                    selectedRegion === 'ahsa'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {isAr ? 'الأحساء (1)' : 'Al-Ahsa (1)'}
                </button>
              </div>
            </div>

            {/* Right/End: Basemap Style & Fullscreen & Reset Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Basemap Style Toggle (Dark Minimalist vs Satellite) */}
              <div className="flex items-center p-1 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-white/15 shadow-lg text-xs font-bold">
                <button
                  onClick={() => setMapStyle('dark')}
                  className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    mapStyle === 'dark'
                      ? 'bg-gold text-neutral-950 shadow-xs'
                      : 'text-white/75 hover:text-white'
                  }`}
                  title={isAr ? 'خريطة المحاور والشوارع الداكنة' : 'Dark Minimalist Map'}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isAr ? 'داكن فاخر' : 'Midnight Slate'}</span>
                </button>
                <button
                  onClick={() => setMapStyle('satellite')}
                  className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    mapStyle === 'satellite'
                      ? 'bg-gold text-neutral-950 shadow-xs'
                      : 'text-white/75 hover:text-white'
                  }`}
                  title={isAr ? 'صور الأقمار الصناعية عالية الدقة' : 'Satellite Imagery'}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{isAr ? 'قمر صناعي' : 'Satellite'}</span>
                </button>
              </div>

              {/* Reset Camera View */}
              <button
                onClick={handleResetView}
                title={isAr ? 'إعادة ضبط الخريطة' : 'Reset View'}
                className="w-8 h-8 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-white/80 hover:text-gold hover:border-gold/40 flex items-center justify-center transition cursor-pointer shadow-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* FullScreen Mode Toggle */}
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={
                  isFullScreen
                    ? isAr
                      ? 'إنهاء وضع ملء الشاشة'
                      : 'Exit Fullscreen'
                    : isAr
                    ? 'وضع ملء الشاشة'
                    : 'Fullscreen'
                }
                className="w-8 h-8 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-white/80 hover:text-gold hover:border-gold/40 flex items-center justify-center transition cursor-pointer shadow-lg"
              >
                {isFullScreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Dedicated Floating Zoom Buttons (+ / -) */}
          <div className="absolute bottom-24 ltr:left-4 rtl:right-4 z-10 flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-white/90 hover:text-gold hover:border-gold/40 flex items-center justify-center transition cursor-pointer shadow-lg active:scale-95"
              aria-label="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-white/90 hover:text-gold hover:border-gold/40 flex items-center justify-center transition cursor-pointer shadow-lg active:scale-95"
              aria-label="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Floating Projects Carousel / Strip */}
          <div className="absolute bottom-4 inset-x-4 z-10 flex items-center gap-2 overflow-x-auto pb-1 max-w-full pointer-events-auto no-scrollbar">
            <div className="flex items-center gap-2 bg-neutral-950/80 backdrop-blur-xl border border-white/15 p-1.5 rounded-2xl shadow-xl">
              {filteredProjects.map((proj) => {
                const isSelected = selectedProject?.id === proj.id;
                const shortTitle = proj.title.split(' (')[0].trim();
                return (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      isSelected
                        ? 'bg-gradient-to-r from-accent to-accent-dark text-white border border-accent-light shadow-md shadow-accent/30 scale-102'
                        : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-transparent'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        proj.type === 'commercial'
                          ? 'bg-gold'
                          : proj.type === 'office'
                          ? 'bg-accent-light'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span className="truncate max-w-[120px] sm:max-w-none">{shortTitle}</span>
                    <span className="text-[10px] text-white/60 bg-black/30 px-1.5 py-0.5 rounded-md">
                      {proj.priceType}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Luxury Obsidian Glass Side Drawer for Project Showcase */}
          {selectedProject && (
            <div
              className={`
                absolute z-20 transition-all duration-500 ease-out flex flex-col pointer-events-auto
                /* Mobile: Bottom Sheet */
                inset-x-2 bottom-2 max-h-[86%] rounded-3xl
                /* Desktop: Docked Side Drawer */
                sm:inset-y-3 sm:max-h-none sm:w-[420px] sm:max-w-[92%] sm:rounded-3xl
                ${isAr ? 'sm:left-auto sm:right-3' : 'sm:right-auto sm:left-3'}
                backdrop-blur-2xl bg-[#0a111a]/95 border border-gold/30 shadow-[0_25px_80px_rgba(0,0,0,0.85)]
                text-white overflow-hidden
              `}
            >
              {/* Gold Top Accent Line */}
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-gold to-transparent shrink-0" />

              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-start justify-between gap-3 bg-white/[0.02] shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40">
                      {selectedProject.badge || selectedProject.typeAr}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                      {selectedProject.priceType}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white truncate leading-tight">
                    {selectedProject.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-white/70 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                    <span className="truncate">{selectedProject.city}</span>
                    {selectedProject.locationHighlightsAr?.[0] && (
                      <>
                        <span>•</span>
                        <span className="truncate text-accent-light font-medium">
                          {selectedProject.locationHighlightsAr[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Close Side Drawer Button */}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer border border-white/10"
                  aria-label={isAr ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
                {/* Media Switcher: Images vs Video */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10 text-xs font-bold">
                      <button
                        onClick={() => setActiveMediaTab('photos')}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                          activeMediaTab === 'photos'
                            ? 'bg-gold text-neutral-950 shadow-xs font-black'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        <Building className="w-3 h-3" />
                        <span>{isAr ? 'الصور' : 'Photos'}</span>
                      </button>

                      {selectedProject.videoUrl && (
                        <button
                          onClick={() => setActiveMediaTab('video')}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                            activeMediaTab === 'video'
                              ? 'bg-gold text-neutral-950 shadow-xs font-black'
                              : 'text-white/70 hover:text-gold'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isAr ? 'فيديو 4K' : 'Video 4K'}</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] text-white/50 font-medium">
                      {activeMediaTab === 'photos'
                        ? `${selectedProject.gallery?.length || 1} ${isAr ? 'صور عالية الدقة' : 'HD Photos'}`
                        : 'Official 4K Presentation'}
                    </span>
                  </div>

                  {/* Media Viewport */}
                  {activeMediaTab === 'video' && selectedProject.videoUrl ? (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-gold/30">
                      <iframe
                        className="w-full h-full border-0"
                        src={getYouTubeEmbedUrl(selectedProject.videoUrl, true)}
                        title={selectedProject.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-md group">
                      <img
                        src={selectedImage || selectedProject.image}
                        alt={selectedProject.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {selectedProject.videoUrl && (
                        <button
                          onClick={() => setActiveMediaTab('video')}
                          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/65 hover:bg-gold hover:text-neutral-950 text-white backdrop-blur-md border border-white/30 flex items-center justify-center transition-all hover:scale-110 shadow-xl cursor-pointer"
                          aria-label="Play video"
                        >
                          <Play className="w-5 h-5 fill-current" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Thumbnail Strip */}
                  {activeMediaTab === 'photos' && selectedProject.gallery && selectedProject.gallery.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
                      {selectedProject.gallery.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(img)}
                          className={`relative w-14 h-10 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${
                            selectedImage === img
                              ? 'border-gold ring-1 ring-gold scale-105'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] text-white/50 block">{isAr ? 'المساحة الإجمالية' : 'Total Area'}</span>
                    <span className="text-xs sm:text-sm font-black text-white">
                      {selectedProject.area.toLocaleString()} م²
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/50 block">{isAr ? 'نوع التعاقد' : 'Contract Type'}</span>
                    <span className="text-xs sm:text-sm font-black text-gold">{selectedProject.priceType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/50 block">{isAr ? 'حالة المشروع' : 'Status'}</span>
                    <span className="text-xs font-bold text-white/90">{selectedProject.status || 'متاح للتأجير'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/50 block">{isAr ? 'الوحدات المتاحة' : 'Units'}</span>
                    <span className="text-xs font-bold text-white/90 truncate">{selectedProject.units || 'متعدد'}</span>
                  </div>
                </div>

                {/* Project Description Snippet */}
                <p className="text-xs text-white/75 leading-relaxed line-clamp-3">
                  {selectedProject.description}
                </p>

                {/* Strategic Location Highlights */}
                {selectedProject.locationHighlightsAr && selectedProject.locationHighlightsAr.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{isAr ? 'أبرز مميزات الموقع الاستراتيجي' : 'Strategic Location Highlights'}</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProject.locationHighlightsAr.slice(0, 4).map((item, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/90 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-accent-light shrink-0" />
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Google Maps Navigation Button */}
                {selectedProject.lat && selectedProject.lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedProject.lat},${selectedProject.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-gold transition flex items-center justify-between text-xs font-bold cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Navigation className="w-3.5 h-3.5 text-gold" />
                      <span>{isAr ? 'فتح المسار والاتجاهات في خرائط Google' : 'Directions in Google Maps'}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => onNavigate('works', { projectId: selectedProject.id })}
                  className="w-full bg-gradient-to-r from-gold to-[#bf8d3b] hover:from-[#e2c58f] hover:to-gold text-neutral-950 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-gold/20 transition-all active:scale-[0.99]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-950" />
                  <span>{isAr ? 'عرض تفاصيل المشروع بالكامل' : 'Explore Full Project Details'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>

                <button
                  onClick={() => onNavigate('booking', { projectId: selectedProject.id })}
                  className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/15 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:border-gold/40 hover:text-gold transition-all"
                >
                  <span>{isAr ? 'سجل اهتمامك / حجز وحدة' : 'Register Interest / Book Unit'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
