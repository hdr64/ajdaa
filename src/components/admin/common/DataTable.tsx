/**
 * Generic, client-side admin table: global search, per-column filters, column
 * visibility, density, sorting, row selection with bulk actions and pagination.
 * Rows arrive already loaded — nothing here fetches anything.
 *
 * Sort, hidden columns, density and page size are remembered per `storageKey`
 * through `usePersistentState`; search, filters and selection are per session.
 *
 * @example
 * ```tsx
 * const columns: Column<Inquiry>[] = [
 *   {
 *     id: 'name',
 *     header: 'العميل',
 *     cell: (row) => <span className="font-bold">{row.name}</span>,
 *     sortValue: (row) => row.name,
 *     filter: { type: 'text', value: (row) => row.name },
 *   },
 *   {
 *     id: 'status',
 *     header: 'الحالة',
 *     cell: (row) => <StatusChip value={row.status} />,
 *     sortValue: (row) => row.status,
 *     filter: { type: 'select', options: [{ value: 'new', label: 'جديد' }], value: (row) => row.status },
 *   },
 *   { id: 'phone', header: 'الجوال', cell: (row) => row.phone, sortValue: (row) => row.phone, align: 'end' },
 *   { id: 'createdAt', header: 'التاريخ', cell: (row) => formatAdminDateTime(row.createdAt), sortValue: (row) => row.createdAt, width: '150px' },
 * ];
 *
 * <DataTable
 *   storageKey="ajda.admin.inquiries"
 *   rows={inquiries}
 *   getRowId={(row) => row.id}
 *   columns={columns}
 *   searchText={(row) => `${row.name} ${row.phone} ${row.projectTitle}`}
 *   initialSort={{ columnId: 'createdAt', direction: 'desc' }}
 *   toolbarStart={<ViewSwitcher value={view} onChange={setView} modes={['table', 'list']} />}
 *   selectable
 *   bulkActions={[{ id: 'delete', label: 'حذف', icon: Trash2, danger: true, onRun: (rows) => admin.remove(rows) }]}
 *   rowActions={(row) => <RowMenu row={row} />}
 *   onRowClick={(row) => openDetails(row)}
 *   emptyState={<EmptyState icon={Inbox} title="لا توجد طلبات بعد" compact />}
 * />
 * ```
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LoaderCircle,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { EmptyState } from './EmptyState';
import {
  ALIGN_CLASS,
  ALIGN_FLEX_CLASS,
  DEFAULT_PAGE_SIZE,
  DENSITY_LABELS,
  PAGE_SIZES,
  SORT_ARIA,
  compareSortValues,
  cycleSort,
  isBlankSortValue,
  isDensity,
  isPageSize,
  isSortState,
  isStringArray,
  type BulkAction,
  type DataTableProps,
  type Density,
  type SortState,
} from './dataTableTypes';

const DENSITY_OPTIONS: readonly Density[] = ['comfortable', 'compact'];

/** Longest cell text kept on one line; the full value stays available as a tooltip. */
const TRUNCATE_CELL = 'truncate max-w-[20rem]';

/**
 * The scroll container caps its height so the sticky header actually has
 * something to stick to (a horizontally scrolling box is a scroll port in both
 * axes) while wide tables scroll sideways instead of pushing the page around.
 */
const TABLE_SCROLL = 'max-h-[70vh] overflow-auto';

const toText = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

export function DataTable<T>({
  rows,
  getRowId,
  columns,
  storageKey,
  searchText,
  selectable = false,
  bulkActions,
  rowActions,
  onRowClick,
  emptyState,
  toolbarStart,
  initialSort,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [sort, setSort] = usePersistentState<SortState | null>(`${storageKey}.sort`, initialSort ?? null, isSortState);
  const [density, setDensity] = usePersistentState<Density>(`${storageKey}.density`, 'comfortable', isDensity);
  const [pageSize, setPageSize] = usePersistentState<number>(`${storageKey}.pageSize`, DEFAULT_PAGE_SIZE, isPageSize);
  const [hiddenColumnIds, setHiddenColumnIds] = usePersistentState<string[]>(
    `${storageKey}.columns`,
    columns.filter((column) => column.defaultHidden).map((column) => column.id),
    isStringArray
  );

  const columnById = useMemo(() => new Map(columns.map((column) => [column.id, column] as const)), [columns]);
  const hiddenColumnSet = useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);
  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumnSet.has(column.id)),
    [columns, hiddenColumnSet]
  );
  const hideableColumns = useMemo(() => columns.filter((column) => column.hideable !== false), [columns]);
  const filterableColumns = useMemo(
    () => columns.flatMap((column) => (column.filter ? [{ column, filter: column.filter }] : [])),
    [columns]
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== '').length,
    [filters]
  );
  const isFiltered = query.trim() !== '' || activeFilterCount > 0;

  /* ---------------------------------------------------------------- *
   * Derived rows: filter → stable sort → page slice (each memoized)
   * ---------------------------------------------------------------- */

  const filteredRows = useMemo(() => {
    if (!searchText && query.trim() === '' && activeFilterCount === 0) return rows;

    const needle = query.trim().toLowerCase();
    const activeFilters = Object.entries(filters).filter(([, value]) => value !== '');
    return rows.filter((row) => {
      if (needle !== '' && searchText && !toText(searchText(row)).includes(needle)) return false;
      for (const [columnId, value] of activeFilters) {
        const filter = columnById.get(columnId)?.filter;
        if (!filter) continue;
        if (filter.type === 'select') {
          if ((filter.value(row) ?? '') !== value) return false;
        } else if (!toText(filter.value(row)).includes(toText(value))) return false;
      }
      return true;
    });
  }, [rows, searchText, columnById, filters, activeFilterCount, query]);

  const sortedRows = useMemo(() => {
    const read = sort ? columnById.get(sort.columnId)?.sortValue : undefined;
    if (!sort || !read) return filteredRows;

    const direction = sort.direction === 'asc' ? 1 : -1;
    return filteredRows
      .map((row, index) => ({ row, index, value: read(row) }))
      .sort((a, b) => {
        // Blanks stay at the bottom whichever way the column is sorted.
        if (isBlankSortValue(a.value) || isBlankSortValue(b.value)) {
          if (isBlankSortValue(a.value) && isBlankSortValue(b.value)) return a.index - b.index;
          return isBlankSortValue(a.value) ? 1 : -1;
        }
        const compared = compareSortValues(a.value as string | number | Date, b.value as string | number | Date) * direction;
        // Original position breaks ties, so re-sorting never shuffles equal rows.
        return compared !== 0 ? compared : a.index - b.index;
      })
      .map((entry) => entry.row);
  }, [filteredRows, sort, columnById]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = useMemo(
    () => sortedRows.slice(pageStart, pageStart + pageSize),
    [sortedRows, pageStart, pageSize]
  );

  /* ---------------------------------------------------------------- *
   * Selection
   * ---------------------------------------------------------------- */

  // Ids only: sorting, filtering and paginating can never disturb the selection.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIdSet.has(getRowId(row))),
    [rows, selectedIdSet, getRowId]
  );

  // Rows deleted or filtered out upstream drop out of the selection.
  useEffect(() => {
    setSelectedIds((previous) => {
      if (previous.length === 0) return previous;
      const present = new Set(rows.map(getRowId));
      const kept = previous.filter((id) => present.has(id));
      return kept.length === previous.length ? previous : kept;
    });
  }, [rows, getRowId]);

  const filteredIds = useMemo(() => sortedRows.map(getRowId), [sortedRows, getRowId]);
  const selectedInFiltered = useMemo(
    () => filteredIds.reduce((total, id) => (selectedIdSet.has(id) ? total + 1 : total), 0),
    [filteredIds, selectedIdSet]
  );
  const allFilteredSelected = filteredIds.length > 0 && selectedInFiltered === filteredIds.length;
  const someFilteredSelected = selectedInFiltered > 0 && !allFilteredSelected;

  const selectCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectCheckboxRef.current) selectCheckboxRef.current.indeterminate = someFilteredSelected;
  }, [someFilteredSelected]);

  const toggleRow = (id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((current) => current !== id) : [...previous, id]
    );
  };

  const toggleAllFiltered = () => {
    setSelectedIds((previous) => {
      if (allFilteredSelected) {
        const removed = new Set(filteredIds);
        return previous.filter((id) => !removed.has(id));
      }
      return [...new Set([...previous, ...filteredIds])];
    });
  };

  /* ---------------------------------------------------------------- *
   * Toolbar actions
   * ---------------------------------------------------------------- */

  const setFilter = (columnId: string, value: string) => {
    setFilters((previous) => ({ ...previous, [columnId]: value }));
  };

  const clearFilters = () => {
    setFilters({});
    setQuery('');
  };

  const toggleColumn = (columnId: string) => {
    // `usePersistentState` takes a plain value, not an updater.
    setHiddenColumnIds(
      hiddenColumnIds.includes(columnId)
        ? hiddenColumnIds.filter((id) => id !== columnId)
        : [...hiddenColumnIds, columnId]
    );
  };

  const runBulkAction = useCallback(
    async (action: BulkAction<T>) => {
      setBulkError(null);
      setPendingAction(action.id);
      try {
        await action.onRun(selectedRows);
      } catch (error) {
        setBulkError(error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء المحدد');
      } finally {
        setPendingAction(null);
      }
    },
    [selectedRows]
  );

  // Any narrowing of the data set starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  const columnsMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && columnsMenuRef.current && !columnsMenuRef.current.contains(target)) setColumnsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [columnsOpen]);

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  const comfortable = density === 'comfortable';
  const cellPadding = comfortable ? 'px-3.5 py-3.5' : 'px-2.5 py-2';
  const columnCount = visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const noRowsAtAll = rows.length === 0;

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden">
      {/* ------------------------------ Toolbar ------------------------------ */}
      <div className="p-3 sm:p-4 border-b border-muted-border/30 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <div className="relative flex-1 min-w-[11rem] max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث في النتائج..."
                aria-label="بحث في النتائج"
                className="w-full ps-9 pe-8 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              />
              {query !== '' && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="مسح البحث"
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {toolbarStart}

          <div className="ms-auto flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-neutral-text/60 tabular-nums" aria-live="polite">
              {sortedRows.length} من {rows.length}
            </span>

            {filterableColumns.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className="brand-btn-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                تصفية
                {activeFilterCount > 0 && (
                  <span className="brand-fill text-canvas rounded-full min-w-[1rem] px-1 text-[10px] tabular-nums">{activeFilterCount}</span>
                )}
              </button>
            )}

            {hideableColumns.length > 0 && (
              <div className="relative" ref={columnsMenuRef}>
                <button
                  type="button"
                  onClick={() => setColumnsOpen((open) => !open)}
                  aria-expanded={columnsOpen}
                  aria-haspopup="true"
                  className="brand-btn-secondary px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  الأعمدة
                  <ChevronDown className={`w-3 h-3 transition-transform ${columnsOpen ? 'rotate-180' : ''}`} />
                </button>

                {columnsOpen && (
                  <div
                    role="group"
                    aria-label="الأعمدة المعروضة"
                    className="absolute end-0 mt-2 z-30 w-52 rounded-2xl bg-surface border border-muted-border/40 shadow-lg p-2"
                  >
                    {hideableColumns.map((column) => {
                      const checked = !hiddenColumnSet.has(column.id);
                      return (
                        <label
                          key={column.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-heading hover:bg-canvas cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={checked && visibleColumns.length === 1}
                            onChange={() => toggleColumn(column.id)}
                            className="w-3.5 h-3.5 rounded accent-accent"
                          />
                          <span className="truncate">{column.header}</span>
                        </label>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setHiddenColumnIds(columns.filter((column) => column.defaultHidden).map((column) => column.id))}
                      className="w-full px-2 pt-2 mt-1 border-t border-muted-border/20 text-[11px] text-neutral-text/60 hover:text-accent cursor-pointer"
                    >
                      إعادة الضبط
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="inline-flex rounded-xl border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label="كثافة العرض">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDensity(option)}
                  aria-pressed={density === option}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                    density === option ? 'brand-fill text-canvas shadow-xs' : 'text-neutral-text/55 hover:text-heading'
                  }`}
                >
                  {DENSITY_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtersOpen && filterableColumns.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 rounded-xl bg-canvas/70 border border-muted-border/30 p-3">
            {filterableColumns.map(({ column, filter }) => (
              <label key={column.id} className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-bold text-neutral-text/60 truncate">{column.header}</span>
                {filter.type === 'select' ? (
                  <select
                    value={filters[column.id] ?? ''}
                    onChange={(event) => setFilter(column.id, event.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-surface border border-muted-border/50 text-xs text-heading outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">الكل</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="search"
                    value={filters[column.id] ?? ''}
                    onChange={(event) => setFilter(column.id, event.target.value)}
                    placeholder="بحث..."
                    aria-label={`تصفية حسب ${column.header}`}
                    className="w-full px-2 py-1.5 rounded-xl bg-surface border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                  />
                )}
              </label>
            ))}

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-end justify-self-start px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                مسح الكل
              </button>
            )}
          </div>
        )}
      </div>

      {/* --------------------------- Selection bar --------------------------- */}
      {selectable && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-accent/5 border-b border-muted-border/30">
          <span className="text-[11px] font-bold text-accent tabular-nums">تم تحديد {selectedIds.length}</span>
          {bulkActions?.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={pendingAction !== null}
                onClick={() => void runBulkAction(action)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  action.danger
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'brand-btn-secondary'
                }`}
              >
                {pendingAction === action.id ? (
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  Icon && <Icon className="w-3.5 h-3.5" />
                )}
                {action.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="ms-auto px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-neutral-text/60 hover:text-heading inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            إلغاء التحديد
          </button>
        </div>
      )}

      {bulkError && (
        <div role="alert" className="flex items-center justify-between gap-2 px-4 py-2.5 bg-red-500/10 text-[11px] font-bold text-red-500">
          <span className="truncate">{bulkError}</span>
          <button type="button" onClick={() => setBulkError(null)} aria-label="إغلاق الخطأ" className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------ Table ------------------------------ */}
      <div className={TABLE_SCROLL}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-canvas text-[11px] text-neutral-text/50">
              {selectable && (
                <th scope="col" className="sticky start-0 top-0 z-20 bg-canvas w-10 px-3 py-2.5">
                  <input
                    ref={selectCheckboxRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    disabled={filteredIds.length === 0}
                    aria-label="تحديد كل النتائج"
                    className="w-3.5 h-3.5 rounded accent-accent"
                  />
                </th>
              )}

              {visibleColumns.map((column) => {
                const align = column.align ?? 'start';
                const sortState = sort?.columnId === column.id ? sort : null;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={sortState ? SORT_ARIA[sortState.direction] : 'none'}
                    style={column.width ? { width: column.width } : undefined}
                    className={`sticky top-0 z-20 px-3 py-2.5 font-bold whitespace-nowrap bg-canvas ${ALIGN_CLASS[align]}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => setSort(cycleSort(sort, column.id))}
                        title={`ترتيب حسب ${column.header}`}
                        className={`inline-flex items-center gap-1 cursor-pointer transition hover:text-heading ${
                          sortState ? 'text-accent' : ''
                        } ${ALIGN_FLEX_CLASS[align]}`}
                      >
                        <span>{column.header}</span>
                        {sortState ? (
                          sortState.direction === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}

              {rowActions && (
                <th
                  scope="col"
                  className="sticky end-0 top-0 z-20 bg-canvas border-s border-muted-border/30 px-3 py-2.5 text-end font-bold whitespace-nowrap"
                >
                  إجراءات
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-muted-border/20">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columnCount)} className="p-4">
                  {emptyState ?? (
                    <EmptyState
                      icon={SearchX}
                      compact
                      title={noRowsAtAll || !isFiltered ? 'لا توجد بيانات لعرضها' : 'لا توجد نتائج مطابقة'}
                      description={
                        noRowsAtAll || !isFiltered
                          ? undefined
                          : 'جرّب تعديل كلمة البحث أو إزالة عوامل التصفية.'
                      }
                    />
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => {
                const id = getRowId(row);
                const selected = selectedIdSet.has(id);
                // Striped on the absolute index so the banding does not restart per page.
                const stripe = (pageStart + index) % 2 === 1 ? 'bg-canvas' : 'bg-surface';
                return (
                  <tr
                    key={id}
                    // `bg-inherit` on the sticky cells keeps their opaque background in
                    // step with the stripe and the hover state of the row.
                    className={`${stripe} hover:bg-surface-hover transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            // Keys pressed on a control inside the row belong to that control.
                            if (event.target !== event.currentTarget) return;
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {selectable && (
                      <td className="sticky start-0 z-10 bg-inherit px-3 py-3.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label="تحديد الصف"
                          className="w-3.5 h-3.5 rounded accent-accent"
                        />
                      </td>
                    )}

                    {visibleColumns.map((column) => {
                      const align = column.align ?? 'start';
                      // Text columns get a single line plus a tooltip instead of pushing the table wide.
                      const sortValue = column.sortValue?.(row);
                      const title = typeof sortValue === 'string' ? sortValue : undefined;
                      return (
                        <td
                          key={column.id}
                          style={column.width ? { width: column.width } : undefined}
                          className={`${cellPadding} ${ALIGN_CLASS[align]} ${align === 'start' ? '' : 'tabular-nums'}`}
                        >
                          {title === undefined ? (
                            column.cell(row)
                          ) : (
                            <div className={TRUNCATE_CELL} title={title}>
                              {column.cell(row)}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {rowActions && (
                      <td
                        className="sticky end-0 z-10 bg-inherit border-s border-muted-border/20 px-3 py-3.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end">{rowActions(row)}</div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------- Pagination ---------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-muted-border/30">
        {rows.length > PAGE_SIZES[0] ? (
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-text/60">
            <span>الصفوف</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              aria-label="عدد الصفوف في الصفحة"
              className="px-2 py-1.5 rounded-xl bg-canvas border border-muted-border/50 text-xs font-bold text-heading outline-none focus:border-accent cursor-pointer tabular-nums"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-[11px] font-bold text-neutral-text/60 tabular-nums">المجموع: {rows.length}</span>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-neutral-text/60 tabular-nums me-1">
            صفحة {currentPage} من {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            aria-label="الصفحة السابقة"
            className="brand-btn-secondary p-2 rounded-xl text-heading disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          </button>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
            aria-label="الصفحة التالية"
            className="brand-btn-secondary p-2 rounded-xl text-heading disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
