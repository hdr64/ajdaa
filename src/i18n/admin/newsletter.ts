import { defineStrings } from './core';

export const LOCALE_AR = 'العربية';
export const LOCALE_EN = 'English';
export const LOCALE_UNKNOWN = '—';

export interface SectionCopy {
  loading: string;
  loadError: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;
  searching: string;
  countAll: string;
  countFiltered: string;
  colEmail: string;
  colLocale: string;
  colSource: string;
  colCreatedAt: string;
  exportCsv: string;
  exportTitle: string;
  exportError: string;
  deleteTitle: (email: string) => string;
  deleteMessage: string;
  deleteConfirm: string;
  deleteButton: string;
  deletedToast: string;
  deleteError: string;
  emptyTitle: string;
  emptyDescription: string;
  noMatchesTitle: string;
  clearFilters: string;
}

/** One object per language, referenced by reference so memoized columns stay stable. */
export const COPY: Record<'ar' | 'en', SectionCopy> = {
  ar: {
    loading: 'جاري تحميل مشتركي النشرة...',
    loadError: 'تعذر تحميل مشتركي النشرة',
    searchPlaceholder: 'ابحث بالبريد الإلكتروني...',
    searchLabel: 'البحث في مشتركي النشرة',
    clearSearch: 'مسح البحث',
    searching: 'جاري البحث...',
    countAll: 'مشترك',
    countFiltered: 'نتيجة',
    colEmail: 'البريد الإلكتروني',
    colLocale: 'اللغة',
    colSource: 'المصدر',
    colCreatedAt: 'تاريخ الاشتراك',
    exportCsv: 'تصدير CSV',
    exportTitle: 'تصدير كل مشتركي النشرة',
    exportError: 'تعذر تصدير الملف',
    deleteTitle: (email) => `حذف المشترك "${email}"؟`,
    deleteMessage: 'سيتم حذف هذا البريد من قائمة النشرة نهائياً ولا يمكن التراجع عن ذلك.',
    deleteConfirm: 'حذف المشترك',
    deleteButton: 'حذف المشترك',
    deletedToast: 'تم حذف المشترك',
    deleteError: 'تعذر حذف المشترك',
    emptyTitle: 'لا يوجد مشتركون في النشرة بعد',
    emptyDescription: 'ستظهر هنا العناوين المسجلة من نموذج الاشتراك في النشرة.',
    noMatchesTitle: 'لا توجد نتائج مطابقة',
    clearFilters: 'مسح البحث',
  },
  en: {
    loading: 'Loading newsletter subscribers...',
    loadError: 'Could not load newsletter subscribers',
    searchPlaceholder: 'Search by email...',
    searchLabel: 'Search newsletter subscribers',
    clearSearch: 'Clear search',
    searching: 'Searching...',
    countAll: 'Subscribers',
    countFiltered: 'Results',
    colEmail: 'Email',
    colLocale: 'Language',
    colSource: 'Source',
    colCreatedAt: 'Subscribed',
    exportCsv: 'Export CSV',
    exportTitle: 'Export all newsletter subscribers',
    exportError: 'Could not export the file',
    deleteTitle: (email) => `Delete subscriber "${email}"?`,
    deleteMessage: 'This address will be permanently removed from the newsletter list. This cannot be undone.',
    deleteConfirm: 'Delete subscriber',
    deleteButton: 'Delete subscriber',
    deletedToast: 'Subscriber deleted',
    deleteError: 'Could not delete the subscriber',
    emptyTitle: 'No newsletter subscribers yet',
    emptyDescription: 'Addresses collected by the newsletter signup form will appear here.',
    noMatchesTitle: 'No matching results',
    clearFilters: 'Clear search',
  },
};

export const newsletter = defineStrings('newsletter', {}, {});
