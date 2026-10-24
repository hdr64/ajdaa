import { defineStrings } from './core';

/** Owner lane: roles and their permission sets. */
export const roles = defineStrings('roles', {
  'section.deleteConfirmTitle': 'حذف الدور "{name}"؟',
  'section.deleteConfirmMessage': 'لن يظهر هذا الدور في قائمة أدوار المستخدمين بعد الآن. لا يمكن التراجع عن ذلك.',
  'section.deleteConfirmLabel': 'حذف الدور',
  'section.deleteSuccess': 'تم حذف الدور {name}',
  'section.deleteError': 'تعذر حذف الدور',
  'section.newRole': 'دور جديد',
  'section.loading': 'جاري تحميل الأدوار...',
  'section.emptyTitle': 'لا توجد أدوار',
  'section.emptyDescription': 'أنشئ دوراً وحدّد صلاحياته، ثم أسنده إلى المستخدمين من قسم المستخدمين.',
  'section.createFirst': 'إنشاء أول دور',
}, {
  'section.deleteConfirmTitle': 'Delete role "{name}"?',
  'section.deleteConfirmMessage': 'This role will no longer appear in the user roles list. This cannot be undone.',
  'section.deleteConfirmLabel': 'Delete role',
  'section.deleteSuccess': 'Role {name} deleted',
  'section.deleteError': 'Could not delete the role',
  'section.newRole': 'New role',
  'section.loading': 'Loading roles...',
  'section.emptyTitle': 'No roles',
  'section.emptyDescription': 'Create a role and set its permissions, then assign it to users from the Users section.',
  'section.createFirst': 'Create first role',
});
