import { defineStrings } from './core';

/** Owner lane: departments and work groups. */
export const departments = defineStrings('departments', {
  'delete.confirmTitle': 'حذف القسم "{name}"؟',
  'delete.confirmMessage': 'لن يظهر هذا القسم في قائمة أقسام المستخدمين بعد الآن. لا يمكن التراجع عن ذلك.',
  'delete.confirmLabel': 'حذف القسم',
  'delete.success': 'تم حذف القسم {name}',
  'delete.error': 'تعذر حذف القسم',
  'new': 'قسم جديد',
  'loading': 'جاري تحميل الأقسام...',
}, {
  'delete.confirmTitle': 'Delete department "{name}"?',
  'delete.confirmMessage': 'This department will no longer appear in the user department list. This cannot be undone.',
  'delete.confirmLabel': 'Delete department',
  'delete.success': 'Department {name} deleted',
  'delete.error': 'Could not delete the department',
  'new': 'New department',
  'loading': 'Loading departments...',
});
