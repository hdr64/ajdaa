import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Upload,
  ExternalLink,
  Save,
  History,
  Search,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { api, getErrorMessage, resolveMediaUrl } from '../../../services/api';
import { uploadMedia } from '../../../services/mediaService';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { CmsClientsPageContent, CmsClientItem } from '../../../types/cms';
import { DEFAULT_CLIENTS_PAGE } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';

export const CmsClientsPanel: React.FC = () => {
  const { showToast, confirm, can } = useAdmin();
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'pageCopy'>('directory');

  // Directory state
  const [clients, setClients] = useState<CmsClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit/Add modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CmsClientItem | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tags input temporary state inside modal
  const [tagInputAr, setTagInputAr] = useState('');
  const [tagInputEn, setTagInputEn] = useState('');

  // Page copy state
  const [pageCopy, setPageCopy] = useState<CmsClientsPageContent>(DEFAULT_CLIENTS_PAGE);
  const [pageCopyVersion, setPageCopyVersion] = useState<number>(1);
  const [savingPageCopy, setSavingPageCopy] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManageClients = can('manageClients') || can('manageCms');
  const canManageCms = can('manageCms');

  // Fetch all clients (including hidden)
  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      const items = await api.get<CmsClientItem[]>('/cms/clients/all');
      setClients(items);
    } catch {
      showToast('تعذر تحميل سجل الشركاء');
    } finally {
      setClientsLoading(false);
    }
  };

  // Fetch page copy
  const fetchPageCopy = async () => {
    try {
      const res = await api.get<{ key: string; content: CmsClientsPageContent; version: number }>(
        '/cms/content/clientsPage'
      );
      if (res && res.content) {
        setPageCopy(res.content);
        setPageCopyVersion(res.version);
      }
    } catch {
      setPageCopy(DEFAULT_CLIENTS_PAGE);
    }
  };

  useEffect(() => {
    void fetchClients();
    void fetchPageCopy();
  }, []);

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.nameAr.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.sectorAr.toLowerCase().includes(q) ||
      c.sectorEn.toLowerCase().includes(q)
    );
  });

  // Client Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map((c) => c.id).filter(Boolean) as string[]));
    }
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingClient({
      id: '',
      nameAr: '',
      nameEn: '',
      sectorAr: '',
      sectorEn: '',
      descAr: '',
      descEn: '',
      logo: '',
      tagsAr: [],
      tagsEn: [],
      websiteUrl: '',
      order: clients.length + 1,
      visible: true,
    });
    setTagInputAr('');
    setTagInputEn('');
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (client: CmsClientItem) => {
    setEditingClient({ ...client });
    setTagInputAr('');
    setTagInputEn('');
    setModalOpen(true);
  };

  // Upload logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const uploaded = await uploadMedia(file);
      if (editingClient) {
        setEditingClient({ ...editingClient, logo: uploaded.url });
      }
      showToast('تم رفع الشعار بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل في رفع الشعار'));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save Client in modal
  const handleSaveClientModal = async () => {
    if (!editingClient) return;

    if (!editingClient.nameAr.trim() || !editingClient.nameEn.trim()) {
      showToast('يرجى إدخال اسم الشريك بالعربية والإنجليزية');
      return;
    }
    if (!editingClient.sectorAr.trim() || !editingClient.sectorEn.trim()) {
      showToast('يرجى إدخال قطاع الأعمال بالعربية والإنجليزية');
      return;
    }
    if (!editingClient.logo.trim()) {
      showToast('يرجى رفع شعار الشريك');
      return;
    }
    if (editingClient.websiteUrl && !editingClient.websiteUrl.startsWith('https://')) {
      showToast('رابط الموقع الإلكتروني يجب أن يبدأ بـ https://');
      return;
    }

    setSavingClient(true);
    try {
      if (editingClient.id) {
        // Update
        const updated = await api.put<CmsClientItem>(
          `/cms/clients/${editingClient.id}`,
          editingClient
        );
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast('تم تحديث بيانات الشريك بنجاح');
      } else {
        // Create
        const created = await api.post<CmsClientItem>('/cms/clients', editingClient);
        setClients((prev) => [...prev, created]);
        showToast('تمت إضافة الشريك بنجاح');
      }
      setModalOpen(false);
      setEditingClient(null);
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ بيانات الشريك'));
    } finally {
      setSavingClient(false);
    }
  };

  // Delete single client
  const handleDeleteClient = async (id: string, nameAr: string) => {
    const ok = await confirm({
      title: 'حذف الشريك',
      message: `هل أنت متأكد من حذف الشريك "${nameAr}" نهائياً من النظام؟`,
      confirmLabel: 'حذف الشريك',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/cms/clients/${id}`);
      setClients((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast('تم حذف الشريك بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل في حذف الشريك'));
    }
  };

  // Toggle single visibility
  const handleToggleVisibility = async (client: CmsClientItem) => {
    try {
      const nextVisible = !client.visible;
      await api.put(`/cms/clients/${client.id}`, { ...client, visible: nextVisible });
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, visible: nextVisible } : c))
      );
      showToast(nextVisible ? 'تم إظهار الشريك' : 'تم إخفاء الشريك');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل في تعديل حالة الظهور'));
    }
  };

  // Bulk visibility
  const handleBulkVisibility = async (visible: boolean) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await api.patch('/cms/clients/bulk-visibility', { ids, visible });
      setClients((prev) =>
        prev.map((c) => (c.id && ids.includes(c.id) ? { ...c, visible } : c))
      );
      showToast(`تم ${visible ? 'إظهار' : 'إخفاء'} ${ids.length} شريك بنجاح`);
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل الإجراء الجماعي'));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const ok = await confirm({
      title: 'حذف الشركاء المحددين',
      message: `هل أنت متأكد من حذف ${ids.length} شريك نهائياً؟`,
      confirmLabel: 'حذف نهائي',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete('/cms/clients/bulk', { ids });
      setClients((prev) => prev.filter((c) => !c.id || !ids.includes(c.id)));
      setSelectedIds(new Set());
      showToast(`تم حذف ${ids.length} شريك بنجاح`);
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل حذف الشركاء المحددين'));
    }
  };

  // Move client order
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= clients.length) return;
    const copy = [...clients];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setClients(copy);

    const ids = copy.map((c) => c.id).filter(Boolean) as string[];
    try {
      await api.put('/cms/clients/reorder', { ids });
    } catch {
      showToast('تعذر حفظ الترتيب');
      void fetchClients();
    }
  };

  // Save Page Copy
  const handleSavePageCopy = async () => {
    if (!canManageCms) {
      showToast('ليس لديك صلاحية لتعديل نصوص الصفحة');
      return;
    }
    setSavingPageCopy(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/clientsPage',
        pageCopy
      );
      setPageCopyVersion(res.version);
      showToast('تم حفظ نصوص صفحة العملاء بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ نصوص الصفحة'));
    } finally {
      setSavingPageCopy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-muted-border/30 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('directory')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'directory'
              ? 'brand-fill text-canvas shadow-xs'
              : 'text-neutral-text hover:text-heading hover:bg-canvas'
          }`}
        >
          <Users className="w-4 h-4" />
          دليل الشركاء والعملاء ({clients.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('pageCopy')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'pageCopy'
              ? 'brand-fill text-canvas shadow-xs'
              : 'text-neutral-text hover:text-heading hover:bg-canvas'
          }`}
        >
          <FileText className="w-4 h-4" />
          نصوص صفحة العملاء والإحصائيات
        </button>
      </div>

      {activeSubTab === 'directory' ? (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
              <button
                type="button"
                onClick={selectAll}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:text-heading transition cursor-pointer shrink-0"
                title="تحديد الكل"
              >
                {selectedIds.size > 0 && selectedIds.size === filteredClients.length ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-text/50" />
                )}
                <span>تحديد الكل</span>
              </button>
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو قطاع الأعمال..."
                  className="w-full pr-9 pl-4 py-2 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleBulkVisibility(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:text-emerald-500 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    إظهار ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkVisibility(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:text-amber-500 transition cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    إخفاء ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف ({selectedIds.size})
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleOpenCreate}
                disabled={!canManageClients}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl brand-fill text-canvas shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                إضافة شريك جديد
              </button>
            </div>
          </div>

          {/* Partners Grid */}
          {clientsLoading ? (
            <div className="flex items-center justify-center p-12 text-neutral-text/60">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
              جاري تحميل قائمة الشركاء...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center p-12 bg-surface rounded-2xl border border-muted-border/30 text-neutral-text/60 text-xs">
              لا يوجد شركاء مطابقون للبحث.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client, index) => {
                const isSelected = client.id ? selectedIds.has(client.id) : false;
                return (
                  <div
                    key={client.id || index}
                    className={`relative p-4 rounded-2xl border transition flex flex-col justify-between ${
                      client.visible
                        ? 'bg-surface border-muted-border/40 hover:border-primary/40'
                        : 'bg-surface/50 border-dashed border-muted-border/30 opacity-70'
                    }`}
                  >
                    {/* Top Row: Checkbox, Logo, Order Arrows */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => client.id && toggleSelect(client.id)}
                          className="text-neutral-text hover:text-heading cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-text/40" />
                          )}
                        </button>
                        <div className="w-14 h-14 rounded-xl bg-canvas p-1.5 border border-muted-border/30 flex items-center justify-center overflow-hidden">
                          <img
                            src={resolveMediaUrl(client.logo)}
                            alt={client.nameAr}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === filteredClients.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Partner Details */}
                    <div className="mt-3 space-y-1">
                      <h4 className="text-xs font-bold text-heading">{client.nameAr}</h4>
                      <p className="text-[11px] text-neutral-text/70">{client.nameEn}</p>
                      <div className="inline-block px-2 py-0.5 mt-1 rounded-md text-[10px] font-semibold bg-canvas text-primary">
                        {client.sectorAr}
                      </div>
                      <p className="text-[11px] text-neutral-text/80 line-clamp-2 mt-1">
                        {client.descAr}
                      </p>
                    </div>

                    {/* Tags preview */}
                    {client.tagsAr && client.tagsAr.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {client.tagsAr.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-1.5 py-0.5 text-[9px] rounded-md bg-canvas/80 text-neutral-text/70"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-muted-border/20">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(client)}
                          className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer ${
                            client.visible
                              ? 'text-emerald-500 hover:bg-emerald-500/10'
                              : 'text-neutral-text/50 hover:bg-canvas'
                          }`}
                          title={client.visible ? 'إخفاء الشريك' : 'إظهار الشريك'}
                        >
                          {client.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span className="text-[10px]">{client.visible ? 'مرئي' : 'مخفي'}</span>
                        </button>

                        {client.websiteUrl && (
                          <a
                            href={client.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-canvas transition"
                            title="زيارة الموقع"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(client)}
                          className="p-1.5 rounded-lg text-neutral-text/70 hover:text-heading hover:bg-canvas transition cursor-pointer"
                          title="تعديل الشريك"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => client.id && handleDeleteClient(client.id, client.nameAr)}
                          className="p-1.5 rounded-lg text-neutral-text/50 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                          title="حذف الشريك"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Page Copy and Stats Tab */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
            <div>
              <h3 className="text-base font-bold text-heading">نصوص صفحة العملاء وشريط الإحصائيات</h3>
              <p className="text-xs text-neutral-text/70">
                تعديل العناوين الترحيبية لصفحة العملاء، كتل الإحصائيات الأربع، وبانر الانضمام إلى الشركاء.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVersionModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-muted-border/40 hover:bg-canvas text-neutral-text hover:text-heading transition cursor-pointer"
              >
                <History className="w-4 h-4" />
                السجل (الإصدار #{pageCopyVersion})
              </button>
              <button
                type="button"
                onClick={handleSavePageCopy}
                disabled={savingPageCopy || !canManageCms}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl brand-fill text-canvas shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                {savingPageCopy ? (
                  <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ النصوص
              </button>
            </div>
          </div>

          {/* Headings */}
          <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
            <div className="flex items-center gap-2 text-heading font-bold text-sm">
              <FileText className="w-4 h-4 text-primary" />
              النصوص الترحيبية للقسم
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  شارة الصفحة (عربي)
                </label>
                <input
                  type="text"
                  value={pageCopy.badgeAr}
                  onChange={(e) => setPageCopy({ ...pageCopy, badgeAr: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  شارة الصفحة (إنجليزي)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={pageCopy.badgeEn}
                  onChange={(e) => setPageCopy({ ...pageCopy, badgeEn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  العنوان الرئيسي (عربي)
                </label>
                <input
                  type="text"
                  value={pageCopy.titleAr}
                  onChange={(e) => setPageCopy({ ...pageCopy, titleAr: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  العنوان الرئيسي (إنجليزي)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={pageCopy.titleEn}
                  onChange={(e) => setPageCopy({ ...pageCopy, titleEn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  الوصف والنبذة (عربي)
                </label>
                <textarea
                  rows={2}
                  value={pageCopy.subtitleAr}
                  onChange={(e) => setPageCopy({ ...pageCopy, subtitleAr: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  الوصف والنبذة (إنجليزي)
                </label>
                <textarea
                  rows={2}
                  dir="ltr"
                  value={pageCopy.subtitleEn}
                  onChange={(e) => setPageCopy({ ...pageCopy, subtitleEn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
            <div className="flex items-center gap-2 text-heading font-bold text-sm">
              <BarChart3 className="w-4 h-4 text-primary" />
              شريط الإحصائيات والأرقام (Stats Bar)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {pageCopy.stats?.map((st, sIdx) => (
                <div key={st.id || sIdx} className="p-3 rounded-xl bg-canvas border border-muted-border/30 space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-text/70 mb-0.5">
                      القيمة الرقمية (مثال: +50)
                    </label>
                    <input
                      type="text"
                      value={st.valueAr}
                      onChange={(e) => {
                        const copy = [...pageCopy.stats];
                        copy[sIdx] = { ...copy[sIdx], valueAr: e.target.value, valueEn: e.target.value };
                        setPageCopy({ ...pageCopy, stats: copy });
                      }}
                      className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-text/70 mb-0.5">
                      الوصف بالعربية
                    </label>
                    <input
                      type="text"
                      value={st.labelAr}
                      onChange={(e) => {
                        const copy = [...pageCopy.stats];
                        copy[sIdx] = { ...copy[sIdx], labelAr: e.target.value };
                        setPageCopy({ ...pageCopy, stats: copy });
                      }}
                      className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-text/70 mb-0.5">
                      الوصف بالإنجليزية
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={st.labelEn}
                      onChange={(e) => {
                        const copy = [...pageCopy.stats];
                        copy[sIdx] = { ...copy[sIdx], labelEn: e.target.value };
                        setPageCopy({ ...pageCopy, stats: copy });
                      }}
                      className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Banner */}
          <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
            <div className="flex items-center gap-2 text-heading font-bold text-sm">
              <MessageSquare className="w-4 h-4 text-primary" />
              بانر الانضمام إلى شبكة الشركاء (CTA)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  عنوان البانر (عربي)
                </label>
                <input
                  type="text"
                  value={pageCopy.ctaTitleAr}
                  onChange={(e) => setPageCopy({ ...pageCopy, ctaTitleAr: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  عنوان البانر (إنجليزي)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={pageCopy.ctaTitleEn}
                  onChange={(e) => setPageCopy({ ...pageCopy, ctaTitleEn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  نص الزر (عربي)
                </label>
                <input
                  type="text"
                  value={pageCopy.ctaButtonTextAr}
                  onChange={(e) => setPageCopy({ ...pageCopy, ctaButtonTextAr: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  نص الزر (إنجليزي)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={pageCopy.ctaButtonTextEn}
                  onChange={(e) => setPageCopy({ ...pageCopy, ctaButtonTextEn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <CmsVersionModal
            open={versionModalOpen}
            onClose={() => setVersionModalOpen(false)}
            sectionKey="clientsPage"
            sectionTitle="نصوص صفحة العملاء"
            currentVersion={pageCopyVersion}
            onRollbackSuccess={fetchPageCopy}
          />
        </div>
      )}

      {/* Add / Edit Partner Modal */}
      {modalOpen && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-surface border border-muted-border/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-muted-border/30">
              <h3 className="text-sm font-bold text-heading">
                {editingClient.id ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد إلى الدليل'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-text/60 hover:text-heading hover:bg-canvas transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Logo Upload Section */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-canvas border border-muted-border/30">
                <div className="w-20 h-20 rounded-2xl bg-surface border border-muted-border/40 flex items-center justify-center p-2 overflow-hidden shrink-0">
                  {editingClient.logo ? (
                    <img
                      src={resolveMediaUrl(editingClient.logo)}
                      alt="Logo preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Upload className="w-6 h-6 text-neutral-text/40" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-xs font-semibold text-heading">شعار الشريك (Logo)</p>
                  <p className="text-[11px] text-neutral-text/70">
                    يفضل رفع شعار شفاف بصيغة PNG أو WebP أو SVG بدقة واضحة.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl brand-fill text-canvas transition cursor-pointer disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <div className="w-3.5 h-3.5 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      اختيار وتحديث الشعار
                    </button>
                  </div>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    اسم الشريك (عربي) *
                  </label>
                  <input
                    type="text"
                    value={editingClient.nameAr}
                    onChange={(e) => setEditingClient({ ...editingClient, nameAr: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="مثال: شركة المنيع للأجهزة"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    اسم الشريك (إنجليزي) *
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingClient.nameEn}
                    onChange={(e) => setEditingClient({ ...editingClient, nameEn: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="e.g. Almanea Electronics"
                  />
                </div>
              </div>

              {/* Sectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    قطاع الأعمال (عربي) *
                  </label>
                  <input
                    type="text"
                    value={editingClient.sectorAr}
                    onChange={(e) =>
                      setEditingClient({ ...editingClient, sectorAr: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="مثال: الأجهزة الكهربائية والمنزلية"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    قطاع الأعمال (إنجليزي) *
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingClient.sectorEn}
                    onChange={(e) =>
                      setEditingClient({ ...editingClient, sectorEn: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="e.g. Appliances & Electronics"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  النبذة التعريفية بالشراكة (عربي)
                </label>
                <textarea
                  rows={2}
                  value={editingClient.descAr}
                  onChange={(e) => setEditingClient({ ...editingClient, descAr: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  placeholder="نبذة عن طبيعة التعاون والمشاريع المستفيدة..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                  النبذة التعريفية بالشراكة (إنجليزي)
                </label>
                <textarea
                  rows={2}
                  dir="ltr"
                  value={editingClient.descEn}
                  onChange={(e) => setEditingClient({ ...editingClient, descEn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  placeholder="English summary of partnership..."
                />
              </div>

              {/* Tags Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    شارات ووسوم (عربي) - اضغط Enter للإضافة
                  </label>
                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      value={tagInputAr}
                      onChange={(e) => setTagInputAr(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInputAr.trim()) {
                            setEditingClient({
                              ...editingClient,
                              tagsAr: [...(editingClient.tagsAr || []), tagInputAr.trim()],
                            });
                            setTagInputAr('');
                          }
                        }
                      }}
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                      placeholder="أدخل وسم واضغط Enter"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editingClient.tagsAr?.map((t, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md bg-canvas border border-muted-border/30 text-heading"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() =>
                            setEditingClient({
                              ...editingClient,
                              tagsAr: editingClient.tagsAr.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-neutral-text/60 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    Tags (English) - Press Enter to add
                  </label>
                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={tagInputEn}
                      onChange={(e) => setTagInputEn(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInputEn.trim()) {
                            setEditingClient({
                              ...editingClient,
                              tagsEn: [...(editingClient.tagsEn || []), tagInputEn.trim()],
                            });
                            setTagInputEn('');
                          }
                        }
                      }}
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                      placeholder="Add tag and press Enter"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editingClient.tagsEn?.map((t, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md bg-canvas border border-muted-border/30 text-heading"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() =>
                            setEditingClient({
                              ...editingClient,
                              tagsEn: editingClient.tagsEn.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-neutral-text/60 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Website URL & Visibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2 border-t border-muted-border/20">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    رابط الموقع الإلكتروني الرسمي
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={editingClient.websiteUrl || ''}
                    onChange={(e) =>
                      setEditingClient({ ...editingClient, websiteUrl: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={editingClient.visible}
                      onChange={(e) =>
                        setEditingClient({ ...editingClient, visible: e.target.checked })
                      }
                      className="rounded text-primary focus:ring-0"
                    />
                    <span className="text-heading font-medium text-xs">
                      إظهار الشريك في الموقع العام
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-muted-border/30 bg-surface/50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-canvas text-neutral-text hover:text-heading transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveClientModal}
                disabled={savingClient}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl brand-fill text-canvas shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                {savingClient ? (
                  <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ بيانات الشريك
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
