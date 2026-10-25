import { defineStrings } from './core';

/** Owner lane: departments and work groups. */
export const departments = defineStrings(
  'departments',
  {
    'delete.confirmTitle': 'حذف القسم "{name}"؟',
    'delete.confirmMessage': 'لن يظهر هذا القسم في قائمة أقسام المستخدمين بعد الآن. لا يمكن التراجع عن ذلك.',
    'delete.confirmLabel': 'حذف القسم',
    'delete.success': 'تم حذف القسم {name}',
    'delete.error': 'تعذر حذف القسم',
    new: 'قسم جديد',
    loading: 'جاري تحميل الأقسام...',

    // Dialog
    dialogCreateTitle: 'إنشاء قسم جديد',
    dialogEditTitle: 'تعديل القسم: {name}',
    nameArLabel: 'الاسم بالعربية',
    nameArRequired: 'الاسم بالعربية مطلوب',
    nameArHint: 'الاسم المعتمد في النظام، ويظهر في قائمة أقسام المستخدمين.',
    nameArPlaceholder: 'مثال: إدارة المبيعات',
    nameEnLabel: 'الاسم بالإنجليزية',
    nameEnPlaceholder: 'Sales Department',
    updateNote: 'تغيير الاسم يُحدّث اسم القسم لدى أعضائه تلقائياً.',
    cancelBtn: 'إلغاء',
    createBtn: 'إنشاء القسم',
    saveBtn: 'حفظ التعديلات',
    toastCreated: 'تم إنشاء القسم {name}',
    toastUpdated: 'تم تحديث القسم {name}',
    toastSaveError: 'تعذر حفظ بيانات القسم',

    // Table
    colNameAr: 'الاسم بالعربية',
    colNameEn: 'الاسم بالإنجليزية',
    colUsers: 'المستخدمون',
    emptyTitle: 'لا توجد أقسام',
    emptyDescription: 'أضف أقسام العمل لتوزيع أعضاء الفريق عليها.',
    createFirst: 'إنشاء أول قسم',
    editDepartment: 'تعديل اسم القسم',
    editDepartmentName: 'تعديل قسم {name}',
    deleteDepartment: 'حذف القسم',
    deleteDepartmentName: 'حذف قسم {name}',
    inUseHint: 'لا يمكن حذف قسم مرتبط بـ {count} مستخدم — انقلهم إلى قسم آخر أولاً',
  },
  {
    'delete.confirmTitle': 'Delete department "{name}"?',
    'delete.confirmMessage': 'This department will no longer appear in the user department list. This cannot be undone.',
    'delete.confirmLabel': 'Delete department',
    'delete.success': 'Department {name} deleted',
    'delete.error': 'Could not delete the department',
    new: 'New department',
    loading: 'Loading departments...',

    // Dialog
    dialogCreateTitle: 'Create New Department',
    dialogEditTitle: 'Edit Department: {name}',
    nameArLabel: 'Arabic Name',
    nameArRequired: 'Arabic name is required',
    nameArHint: 'Official name used across the system, displayed in user department lists.',
    nameArPlaceholder: 'e.g. Sales Department',
    nameEnLabel: 'English Name',
    nameEnPlaceholder: 'Sales Department',
    updateNote: 'Updating the name automatically updates all members belonging to this department.',
    cancelBtn: 'Cancel',
    createBtn: 'Create Department',
    saveBtn: 'Save Changes',
    toastCreated: 'Department {name} created successfully',
    toastUpdated: 'Department {name} updated successfully',
    toastSaveError: 'Could not save department',

    // Table
    colNameAr: 'Arabic Name',
    colNameEn: 'English Name',
    colUsers: 'Users',
    emptyTitle: 'No departments',
    emptyDescription: 'Add departments to assign and organize team members.',
    createFirst: 'Create first department',
    editDepartment: 'Edit department name',
    editDepartmentName: 'Edit department {name}',
    deleteDepartment: 'Delete department',
    deleteDepartmentName: 'Delete department {name}',
    inUseHint: 'Cannot delete department linked to {count} user(s) — reassign them first',
  }
);
