import React, { useState } from 'react';
import type { Property } from '../../types/property';
import {
  MapPin,
  Maximize2,
  BedDouble,
  Bath,
  Heart,
  Eye,
  ArrowLeft,
  ArrowRight,
  Images,
  Warehouse,
  Store,
  Building2,
  FileText,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { isDownloadableMediaUrl } from '../../utils/urlValidation';
import { getPropertyDisplay } from '../../data/properties';

interface PropertyCardProps {
  property: Property;
  onSelect: (prop: Property) => void;
  onQuickView?: (prop: Property) => void;
  onFavToast?: (msg: string) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onSelect,
  onQuickView,
  onFavToast,
}) => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const [fav, setFav] = useState(false);

  const display = getPropertyDisplay(property, language);
  const galleryCount = property.gallery?.length || 1;
  const brochureUrl = isDownloadableMediaUrl(property.brochureUrl) ? property.brochureUrl : undefined;

  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !fav;
    setFav(nextState);
    if (onFavToast) {
      onFavToast(nextState ? t.propertyCard.favAddedToast : t.propertyCard.favRemovedToast);
    }
  };

  return (
    <div
      onClick={() => onQuickView?.(property)}
      className="glass-card rounded-2xl overflow-hidden group flex flex-col justify-between hover:-translate-y-0.5 transition-all duration-300 cursor-pointer border border-muted-border/30 hover:border-accent/40"
    >
      <div className="relative h-60 overflow-hidden img-shine">
        <img
          src={property.image}
          alt={display.title}
          loading="lazy"
          className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

        {/* Top Badges */}
        <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between z-[3]">
          <span
            className={`text-[11px] font-extrabold px-3 py-1 rounded-full backdrop-blur-md border border-white/20 ${
              display.isBooked
                ? 'bg-amber-500 text-black font-black'
                : property.type === 'logistics'
                ? 'bg-blue-600 text-white font-bold'
                : property.type === 'commercial'
                ? 'bg-emerald-600 text-white font-bold'
                : property.priceType === 'بيع'
                ? 'brand-fill'
                : 'bg-success text-canvas font-black'
            }`}
          >
            {display.badge}
          </span>

          <div className="flex items-center gap-2">
            {/* Gallery photos badge */}
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-canvas/80 backdrop-blur-md text-neutral-text flex items-center gap-1 border border-muted-border/30">
              <Images className="w-3 h-3 text-accent" />
              {galleryCount}
            </span>

            <button
              onClick={toggleFav}
              aria-label={fav ? t.propertyCard.removeFav : t.propertyCard.addFav}
              className="w-8 h-8 rounded-xl bg-canvas/80 backdrop-blur-md flex items-center justify-center border border-muted-border/40 hover:border-accent/80 hover:bg-surface transition-all duration-300 cursor-pointer"
            >
              <Heart
                className={`w-3.5 h-3.5 transition-all duration-300 ${
                  fav
                    ? 'fill-red-400 text-red-400'
                    : 'text-neutral-text/70 group-hover:text-accent'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Hover Quick View Overlay */}
        <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-canvas/40 backdrop-blur-[2px]">
          <span className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-full inline-flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-accent" />
            {t.propertyCard.viewDetails}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-text/60 mb-2">
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-accent" /> {display.city}
            </span>
            <span className="brand-badge text-accent-light px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">
              {display.type}
            </span>
          </div>

          <h3 className="font-bold text-base leading-snug mb-3 group-hover:text-accent transition-colors line-clamp-1">
            {display.title}
          </h3>

          <div className="flex items-center justify-between text-xs text-neutral-text/70 mb-4 border-y border-muted-border/20 py-2.5">
            <span className="flex items-center gap-1.5 font-semibold">
              <Maximize2 className="w-3.5 h-3.5 text-accent" />{' '}
              {property.area.toLocaleString(isAr ? 'ar-SA' : 'en-US')} {t.propertyCard.sqm}
            </span>
            {property.rooms && property.rooms > 0 ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <BedDouble className="w-3.5 h-3.5 text-accent" /> {property.rooms}{' '}
                  {t.propertyCard.rooms}
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Bath className="w-3.5 h-3.5 text-accent" /> {property.bathrooms}{' '}
                  {t.propertyCard.baths}
                </span>
              </>
            ) : property.type === 'logistics' ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Warehouse className="w-3.5 h-3.5 text-accent" />{' '}
                  {t.propertyCard.storage}
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {t.propertyCard.loadingDocks}
                </span>
              </>
            ) : property.type === 'commercial' ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Store className="w-3.5 h-3.5 text-accent" />{' '}
                  {t.propertyCard.glassFacades}
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {t.propertyCard.visitorParking}
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-accent" />{' '}
                  {t.propertyCard.strategicHub}
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {t.propertyCard.primeLocation}
                </span>
              </>
            )}
          </div>
          {brochureUrl && (
            <a
              href={brochureUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-accent hover:underline rounded-lg px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <FileText className="w-3.5 h-3.5" />
              {t.propertyCard.downloadBrochure}
            </a>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-[10px] text-neutral-text/50 font-medium">
              {t.propertyCard.projectStatus}
            </div>
            <div
              className={`text-xs sm:text-sm font-black transition-colors ${
                display.isBooked
                  ? 'text-amber-400 font-bold'
                  : 'text-accent group-hover:brand-gradient-text'
              }`}
            >
              {display.status}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(property);
            }}
            className="brand-btn-primary font-extrabold text-xs px-4 py-2.5 rounded-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer inline-flex items-center gap-1.5"
          >
            {display.isBooked ? t.propertyCard.inquireNow : t.propertyCard.registerInterest}
            {isAr ? (
              <ArrowLeft className="w-3.5 h-3.5" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
