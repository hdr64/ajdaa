import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';
import {
  findSaudiCityByName,
  getPopularSaudiCities,
  searchSaudiCities,
  type SaudiCity,
} from '../../../data/saudiCities';

const INPUT_CLASS =
  'w-full ps-8 pe-8 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent placeholder:text-neutral-text/45 disabled:opacity-50 disabled:cursor-not-allowed';

const CHIP_CLASS =
  'px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed';

export interface CitySelectProps {
  valueAr: string;
  valueEn?: string;
  onChange: (city: { nameAr: string; nameEn: string; center?: { lat: number; lng: number } }) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const CitySelect: React.FC<CitySelectProps> = ({
  valueAr,
  valueEn,
  onChange,
  error,
  disabled = false,
  id,
  className = '',
}) => {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-city`;
  const listboxId = `${generatedId}-city-listbox`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const [draft, setDraft] = useState(valueAr);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // The draft follows the parent unless the parent is echoing our own keystrokes back.
  useEffect(() => {
    setDraft((current) => (current === valueAr ? current : valueAr));
  }, [valueAr]);

  const selected = useMemo(
    () => findSaudiCityByName(valueAr) ?? findSaudiCityByName(valueEn ?? ''),
    [valueAr, valueEn],
  );
  const results = useMemo(() => searchSaudiCities(draft), [draft]);
  const active = results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);
  const popular = getPopularSaudiCities();

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const pick = useCallback(
    (city: SaudiCity) => {
      setDraft(city.nameAr);
      setActiveIndex(0);
      setOpen(false);
      onChange({ nameAr: city.nameAr, nameEn: city.nameEn, center: city.center });
    },
    [onChange],
  );

  const type = (next: string) => {
    setDraft(next);
    setActiveIndex(0);
    setOpen(true);
    const exact = findSaudiCityByName(next);
    if (exact) {
      onChange({ nameAr: exact.nameAr, nameEn: exact.nameEn, center: exact.center });
      return;
    }
    // Districts and towns outside the dataset stay editable: pass the text through as typed.
    onChange({ nameAr: next, nameEn: '' });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (results.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + results.length) % results.length);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open || results.length === 0) return;
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : results.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      // Closed, Enter must stay available to submit the surrounding form.
      if (open && active >= 0) {
        event.preventDefault();
        pick(results[active]);
      }
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && rootRef.current?.contains(next)) return;
    setOpen(false);
  };

  const clear = () => {
    setDraft('');
    setActiveIndex(0);
    onChange({ nameAr: '', nameEn: '' });
    inputRef.current?.focus();
  };

  return (
    <div className={className}>
      <div role="group" aria-label="مدن شائعة" className="mb-2 flex flex-wrap items-center gap-1.5">
        {popular.map((city) => {
          const isActive = valueAr.trim() === city.nameAr || draft.trim() === city.nameAr;
          return (
            <button
              key={city.id}
              type="button"
              disabled={disabled}
              aria-pressed={isActive}
              onClick={() => {
                pick(city);
                inputRef.current?.focus();
              }}
              className={`${CHIP_CLASS} ${
                isActive
                  ? 'brand-fill border-transparent'
                  : 'bg-canvas border-muted-border/50 text-neutral-text hover:border-accent hover:text-accent'
              }`}
            >
              {city.nameAr}
            </button>
          );
        })}
      </div>

      <div ref={rootRef} className="relative" onBlur={handleBlur}>
        <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-text/45" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={draft}
          placeholder="اكتب اسم المدينة…"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listboxId}-${results[active].id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${listboxId}-error` : undefined}
          onChange={(event) => type(event.target.value)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
        />
        {draft ? (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            aria-label="مسح المدينة"
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-neutral-text/55 hover:text-red-500 cursor-pointer disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown
            className={`pointer-events-none absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-text/45 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}

        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-muted-border/40 bg-surface shadow-lg">
            <ul ref={listRef} id={listboxId} role="listbox" aria-label="قائمة المدن" className="max-h-60 overflow-y-auto overscroll-contain py-1">
              {results.map((city, index) => {
                const isSelected = selected?.id === city.id;
                return (
                  <li
                    key={city.id}
                    id={`${listboxId}-${city.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === active ? 'true' : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(city)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors ${
                      index === active ? 'bg-accent/10' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-heading">{city.nameAr}</span>
                        <span dir="ltr" className="truncate text-[10px] text-neutral-text/70">
                          {city.nameEn}
                        </span>
                      </span>
                      <span className="mt-0.5 inline-block rounded-full bg-canvas px-1.5 py-px text-[9px] font-bold text-neutral-text/70">
                        {city.regionAr}
                      </span>
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>

            {results.length === 0 && (
              <p className="px-3 py-4 text-center text-[11px] font-bold text-neutral-text/70">
                لا توجد مدينة مطابقة — سيُحفظ الاسم كما هو.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-1.5 flex min-h-4 items-center gap-1.5 text-[10px] text-neutral-text/70">
        {selected ? (
          <>
            <span dir="ltr" className="font-bold text-heading">
              {selected.nameEn}
            </span>
            <span aria-hidden="true">·</span>
            <span>{selected.regionAr}</span>
            <span className="ms-auto inline-flex items-center gap-1 font-mono" dir="ltr">
              <MapPin className="h-3 w-3 text-accent" aria-hidden="true" />
              {selected.center.lat.toFixed(4)}, {selected.center.lng.toFixed(4)}
            </span>
          </>
        ) : valueAr.trim() ? (
          <span>اسم مخصص خارج قائمة المدن — سيُحفظ كما هو.</span>
        ) : null}
      </p>

      <p aria-live="polite" className="sr-only">
        {open ? `${results.length} نتيجة` : ''}
      </p>

      {error && (
        <p id={`${listboxId}-error`} className="mt-1 text-[10px] font-bold text-red-500">
          {error}
        </p>
      )}
    </div>
  );
};
