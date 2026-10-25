import { defineStrings } from './core';

/** Chart titles, legends, tooltips and the accessible table view of each chart. */
export const charts = defineStrings(
  'charts',
  {
    'unitStatus.title': 'حالة الوحدات حسب المشروع',
    'unitStatus.subtitle': 'عدد الوحدات في كل مشروع موزعة حسب الحالة',
    'unitStatus.empty': 'لا توجد وحدات مسجلة بعد.',
    'unitStatus.total': 'الإجمالي',
    'unitStatus.count': '{count} من {total}',
    'unitStatus.share': '{percent}%',
    'unitStatus.barAria': '{project} — {status}: {count} من {total}',

    'inquiriesTrend.title': 'طلبات الاهتمام أسبوعياً',
    'inquiriesTrend.subtitle': 'آخر {weeks} أسبوعاً · {total} طلب · هذا الأسبوع {thisWeek} (الأسبوع الماضي {lastWeek})',
    'inquiriesTrend.empty': 'لا توجد طلبات في آخر {weeks} أسبوعاً',
    'inquiriesTrend.week': 'الأسبوع',
    'inquiriesTrend.count': 'عدد الطلبات',
    'inquiriesTrend.weekOf': 'من {date}',
    'inquiriesTrend.weekStarting': 'أسبوع يبدأ {date}',
    'inquiriesTrend.requests': '{count} طلب',
    'inquiriesTrend.barAria': 'أسبوع {date}: {count} طلب',
  },
  {
    'unitStatus.title': 'Unit status by project',
    'unitStatus.subtitle': 'Units in each project, split by status',
    'unitStatus.empty': 'No units registered yet.',
    'unitStatus.total': 'Total',
    'unitStatus.count': '{count} of {total}',
    'unitStatus.share': '{percent}%',
    'unitStatus.barAria': '{project} — {status}: {count} of {total}',

    'inquiriesTrend.title': 'Inquiries per week',
    'inquiriesTrend.subtitle': 'Last {weeks} weeks · {total} inquiries · this week {thisWeek} (last week {lastWeek})',
    'inquiriesTrend.empty': 'No inquiries in the last {weeks} weeks',
    'inquiriesTrend.week': 'Week',
    'inquiriesTrend.count': 'Inquiries',
    'inquiriesTrend.weekOf': 'Week of {date}',
    'inquiriesTrend.weekStarting': 'Week of {date}',
    'inquiriesTrend.requests': '{count} inquiries',
    'inquiriesTrend.barAria': 'Week of {date}: {count} inquiries',
  }
);
