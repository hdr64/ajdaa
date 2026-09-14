import React, { useState } from 'react';
import { AdminStorage, type AdminUser } from '../../services/adminStorage';
import {
  ShieldCheck,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  X
} from 'lucide-react';

interface UsersPermissionsManagerProps {
  onShowToast: (msg: string) => void;
}

export const UsersPermissionsManager: React.FC<UsersPermissionsManagerProps> = ({ onShowToast }) => {
  const [users, setUsers] = useState<AdminUser[]>(() => AdminStorage.getUsers());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'project_manager' as AdminUser['role'],
    department: 'التطوير العقاري',
    permissions: {
      manageProjects: true,
      manageUnits: true,
      viewInquiries: true,
      exportData: false,
      manageUsers: false,
    },
  });

  const refreshUsers = () => {
    setUsers(AdminStorage.getUsers());
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm({
      name: '',
      email: '',
      role: 'sales_agent',
      department: 'إدارة التأجير والمبيعات',
      permissions: {
        manageProjects: false,
        manageUnits: true,
        viewInquiries: true,
        exportData: false,
        manageUsers: false,
      },
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      permissions: { ...user.permissions },
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    const roleArMap: Record<AdminUser['role'], string> = {
      super_admin: 'مدير عام النظام (Super Admin)',
      project_manager: 'مدير التطوير والمشاريع',
      sales_agent: 'مسؤول تأجير ومبيعات',
      viewer: 'محلل استثماري ومتابع',
    };

    if (editingUser) {
      const updated: AdminUser = {
        ...editingUser,
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        roleAr: roleArMap[form.role],
        department: form.department.trim(),
        permissions: form.permissions,
      };
      AdminStorage.saveUser(updated);
      onShowToast('تم تحديث بيانات المستخدم والصلاحيات');
    } else {
      const newUser: AdminUser = {
        id: `usr-${Date.now()}`,
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        roleAr: roleArMap[form.role],
        department: form.department.trim(),
        permissions: form.permissions,
        lastLogin: 'لم يسجل دخول بعد',
        status: 'active',
      };
      AdminStorage.saveUser(newUser);
      onShowToast('تمت إضافة المستخدم الجديد بنجاح');
    }

    setModalOpen(false);
    refreshUsers();
  };

  const handleToggleStatus = (userId: string) => {
    AdminStorage.toggleUserStatus(userId);
    refreshUsers();
    onShowToast('تم تغيير حالة الحساب');
  };

  const handleDelete = (userId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المستخدم (${name})؟`)) {
      AdminStorage.deleteUser(userId);
      refreshUsers();
      onShowToast('تم حذف المستخدم');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-3xl bg-surface border border-muted-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/15 text-accent mb-2 inline-block">
            الأمان والصلاحيات
          </span>
          <h3 className="text-base font-black text-heading flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <span>إدارة المستخدمين وصلاحيات الوصول</span>
          </h3>
          <p className="text-xs text-neutral-text/60 mt-0.5">
            التحكم في أعضاء الفريق وتحديد أذونات إدارة المشاريع، تعديل الوحدات، والاطلاع على طلبات العملاء
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="brand-btn-primary text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((user) => (
          <div
            key={user.id}
            className="p-5 rounded-2xl bg-surface border border-muted-border/40 flex flex-col justify-between hover:border-accent/40 transition-all shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl brand-fill text-canvas font-black flex items-center justify-center text-sm">
                    {user.name.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-heading">{user.name}</h4>
                    <span className="text-[10px] text-neutral-text/60 font-mono block" dir="ltr">
                      {user.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleStatus(user.id)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                    user.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}
                >
                  {user.status === 'active' ? 'نشط' : 'معطل'}
                </button>
              </div>

              <div className="text-[11px] p-2.5 rounded-xl bg-canvas/60 border border-muted-border/30 space-y-1 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-text/50 text-[10px]">الدور:</span>
                  <span className="font-bold text-accent">{user.roleAr}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-text/50 text-[10px]">القسم:</span>
                  <span className="font-bold text-heading">{user.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-text/50 text-[10px]">آخر نشاط:</span>
                  <span className="text-neutral-text/60">{user.lastLogin || 'الآن'}</span>
                </div>
              </div>

              {/* Permissions Pills */}
              <div className="space-y-1.5 mb-4">
                <span className="text-[10px] font-bold text-neutral-text/50 block">الصلاحيات الممنوحة:</span>
                <div className="flex flex-wrap gap-1">
                  {user.permissions.manageProjects && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-surface border border-muted-border/40 text-heading flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> إدارة المشاريع
                    </span>
                  )}
                  {user.permissions.manageUnits && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-surface border border-muted-border/40 text-heading flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> تعديل الوحدات
                    </span>
                  )}
                  {user.permissions.viewInquiries && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-surface border border-muted-border/40 text-heading flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> متابعة الطلبات
                    </span>
                  )}
                  {user.permissions.exportData && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-surface border border-muted-border/40 text-heading flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> تصدير التقارير
                    </span>
                  )}
                  {user.permissions.manageUsers && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-surface border border-muted-border/40 text-heading flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> إدارة المستخدمين
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-muted-border/20">
              <button
                onClick={() => handleOpenEdit(user)}
                className="flex-1 py-1.5 rounded-lg border border-muted-border/40 hover:border-accent text-neutral-text/70 hover:text-accent font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer bg-surface/50"
              >
                <Edit2 className="w-3 h-3" />
                <span>تعديل الصلاحيات</span>
              </button>
              {user.role !== 'super_admin' && (
                <button
                  onClick={() => handleDelete(user.id, user.name)}
                  className="p-1.5 rounded-lg border border-muted-border/40 hover:border-red-400 text-neutral-text/40 hover:text-red-400 transition cursor-pointer"
                  title="حذف الحساب"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: ADD / EDIT USER */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-4 border-b border-muted-border/30 pb-3">
              <h4 className="text-sm font-black text-heading">
                {editingUser ? `تعديل صلاحيات (${editingUser.name})` : 'إضافة مستخدم جديد للنظام'}
              </h4>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full bg-surface border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: خالد المنصور"
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@ajdaa.sa"
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    الدور الوظيفي
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none cursor-pointer"
                  >
                    <option value="super_admin">مدير عام النظام</option>
                    <option value="project_manager">مدير التطوير والمشاريع</option>
                    <option value="sales_agent">مسؤول تأجير ومبيعات</option>
                    <option value="viewer">محلل استثماري ومتابع</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                    القسم / الإدارة
                  </label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="التطوير العقاري"
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none"
                  />
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="pt-2 border-t border-muted-border/30">
                <span className="block text-[11px] font-bold text-heading mb-2">تخصيص الصلاحيات:</span>
                <div className="space-y-2 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.permissions.manageProjects}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissions: { ...form.permissions, manageProjects: e.target.checked },
                        })
                      }
                      className="rounded accent-accent"
                    />
                    <span>إضافة وتعديل وحذف المشاريع العقارية</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.permissions.manageUnits}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissions: { ...form.permissions, manageUnits: e.target.checked },
                        })
                      }
                      className="rounded accent-accent"
                    />
                    <span>تعديل الأدوار وتبديل حالة الوحدات (متاح/مؤجر/محجوز)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.permissions.viewInquiries}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissions: { ...form.permissions, viewInquiries: e.target.checked },
                        })
                      }
                      className="rounded accent-accent"
                    />
                    <span>متابعة وتحديث حالات طلبات الاهتمام الواردة</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.permissions.exportData}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissions: { ...form.permissions, exportData: e.target.checked },
                        })
                      }
                      className="rounded accent-accent"
                    />
                    <span>تصدير التقارير وسجلات العقود</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.permissions.manageUsers}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissions: { ...form.permissions, manageUsers: e.target.checked },
                        })
                      }
                      className="rounded accent-accent"
                    />
                    <span>إدارة المستخدمين وتوزيع الصلاحيات</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted-border/30">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="brand-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {editingUser ? 'حفظ الصلاحيات' : 'تأكيد الإضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
