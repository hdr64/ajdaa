import { defineStrings } from './core';

/** Shared Files area: Drive and Library in one page, the upload manager's target chips, the Drive tab of the media picker. */
export const files = defineStrings(
  'files',
  {
    'tab.drive': 'الدرايف',
    'tab.library': 'المكتبة',
    'tab.driveHint': 'خاص بالإدارة، مجلدات وسلة محذوفات ومشاركة برابط',
    'tab.libraryHint': 'عام ومنشور على الموقع، مع تتبع الاستخدام',
    'filter.all': 'الكل',
    'filter.image': 'صور',
    'filter.video': 'فيديو',
    'filter.pdf': 'PDF',
    'filter.other': 'أخرى',
    'picker.tabDrive': 'من الدرايف',
    'picker.tooLarge': 'الملف أكبر من 2 جيجابايت ولا تقبله المكتبة',
    'picker.publishFailed': 'تعذّر نشر الملف في المكتبة',
    'upload.targetLibrary': 'المكتبة',
    'upload.targetDrive': 'الدرايف',
  },
  {
    'tab.drive': 'Drive',
    'tab.library': 'Library',
    'tab.driveHint': 'Private to admins: folders, trash and share links',
    'tab.libraryHint': 'Public and published on the site, with usage tracking',
    'filter.all': 'All',
    'filter.image': 'Images',
    'filter.video': 'Videos',
    'filter.pdf': 'PDF',
    'filter.other': 'Other',
    'picker.tabDrive': 'From Drive',
    'picker.tooLarge': 'The file is over 2 GB, which the library does not accept',
    'picker.publishFailed': 'Could not publish the file to the library',
    'upload.targetLibrary': 'Library',
    'upload.targetDrive': 'Drive',
  }
);
