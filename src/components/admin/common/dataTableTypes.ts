import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ *
 * Column definition
 * ------------------------------------------------------------------ */

export type ColumnAlign = 'start' | 'end' | 'center';

/** Logical text alignment — `start`/`end` follow the document direction. */
export const ALIGN_CLASS: Record<ColumnAlign, string> = {
  start: 'text-start',
  end: 'text-end',
  center: 'text-center',
};

/** Same axes, for flex containers (sortable headers, action cells). */
export const ALIGN_FLEX_CLASS: Record<ColumnAlign, string> = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
};

/**
 * Accessors may legitimately return nothing (a nullable status, a row without
 * a phone number), so the declared return type is wider than `string` on
 * purpose: a `(row) => string` implementation stays assignable, and a `null`
 * coming from real data is handled instead of crashing the table.
 */
export interface SelectColumnFilter<T> {
  type: 'select';
  options: readonly { value: string; label: string }[];
  value: (row: T) => string | null | undefined;
}

export interface TextColumnFilter<T> {
  type: 'text';
  value: (row: T) => string | null | undefined;
}

export type ColumnFilter<T> = SelectColumnFilter<T> | TextColumnFilter<T>;

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Providing it makes the header sortable and enables a string tooltip on truncated cells. */
  sortValue?: (row: T) => string | number | Date | null;
  align?: ColumnAlign;
  /** Any CSS width, e.g. `'120px'`. */
  width?: string;
  /** Defaults to `true`; set `false` for columns a page must never let users hide. */
  hideable?: boolean;
  defaultHidden?: boolean;
  filter?: ColumnFilter<T>;
}

/* ------------------------------------------------------------------ *
 * Sorting
 * ------------------------------------------------------------------ */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export const SORT_ARIA: Record<SortDirection, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
};

/**
 * Arabic-aware ordering: the collator sorts letters, diacritics and embedded
 * numbers the way an Arabic reader expects ("ملحق 2" before "ملحق 10"), instead
 * of falling back to code-unit order.
 */
export const ARABIC_COLLATOR = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

/** Empty cells sort to the bottom in both directions rather than jumping to the top. */
export const isBlankSortValue = (value: string | number | Date | null | undefined): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** Compares two non-blank `sortValue` results; direction is applied by the caller. */
export function compareSortValues(
  a: string | number | Date,
  b: string | number | Date
): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' || typeof b === 'number') {
    const left = a instanceof Date ? a.getTime() : Number(a);
    const right = b instanceof Date ? b.getTime() : Number(b);
    if (!Number.isNaN(left) && !Number.isNaN(right)) return left - right;
  }
  return ARABIC_COLLATOR.compare(String(a), String(b));
}

/** asc → desc → unsorted, and a click on another column always starts ascending. */
export function cycleSort(current: SortState | null, columnId: string): SortState | null {
  if (current?.columnId !== columnId) return { columnId, direction: 'asc' };
  if (current.direction === 'asc') return { columnId, direction: 'desc' };
  return null;
}

/* ------------------------------------------------------------------ *
 * Selection & bulk actions
 * ------------------------------------------------------------------ */

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  /** Receives the selected rows as they appear in the source data, not the page slice. */
  onRun: (rows: T[]) => void | Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Display preferences
 * ------------------------------------------------------------------ */

export type Density = 'comfortable' | 'compact';

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'مريح',
  compact: 'مضغوط',
};

export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];

export const DEFAULT_PAGE_SIZE = 25;

/* ------------------------------------------------------------------ *
 * Validators for `usePersistentState`
 * ------------------------------------------------------------------ */

export const isDensity = (value: unknown): value is Density =>
  value === 'comfortable' || value === 'compact';

export const isPageSize = (value: unknown): value is number =>
  typeof value === 'number' && PAGE_SIZES.includes(value);

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isSortState = (value: unknown): value is SortState | null => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const candidate = value as { columnId?: unknown; direction?: unknown };
  return (
    typeof candidate.columnId === 'string' &&
    (candidate.direction === 'asc' || candidate.direction === 'desc')
  );
};

/* ------------------------------------------------------------------ *
 * Component props
 * ------------------------------------------------------------------ */

export interface DataTableProps<T> {
  /** Data is already loaded; the table only filters, sorts and paginates in memory. */
  rows: T[];
  getRowId: (row: T) => string;
  columns: Column<T>[];
  /** Prefix for the remembered preferences, e.g. `'ajda.admin.inquiries'`. */
  storageKey: string;
  /** Providing it turns on the global search box. */
  searchText?: (row: T) => string;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  /** Rendered in a sticky trailing column. */
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  /** Extra controls (e.g. a `ViewSwitcher`) rendered in the toolbar. */
  toolbarStart?: ReactNode;
  /** Used until the viewer picks a sort of their own; the choice is remembered after that. */
  initialSort?: SortState;
}
