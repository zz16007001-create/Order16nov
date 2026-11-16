/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  AuditPeriod,
  AuditLogItem,
  AuditActionType,
} from '../types';
import {
  getAuditPeriod,
  recordAuditEntry,
  updateAuditEntry,
  deleteAuditEntry,
  resetAuditPeriod,
} from '../services/auditStorage';
import { Icon3D } from '../components/icons3d/Icon3D';
import { SwipeRow } from '../components/SwipeRow';
import { formatArabicDate } from '../utils/dateFormat';
import { useConfirmDelete } from '../components/ConfirmDeleteDialog';

function formatAuditAmount(item: AuditLogItem, currency: string): string | null {
  if (item.amount === undefined) return null;
  const isReturn = item.type === 'return';
  const numStr = item.amount.toLocaleString('en-US');
  return isReturn ? `-${numStr} ${currency}` : `${numStr} ${currency}`;
}

export const AuditPage: React.FC = () => {
  const { state, setCurrentPage } = useApp();
  const { confirmDelete } = useConfirmDelete();

  const [period, setPeriod] = useState<AuditPeriod>(getAuditPeriod);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);

  // Search & Filter (Side-by-side in one row)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Modal: Add Manual Note (حقلان فقط: اسم الحركة والمبلغ)
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteAmount, setNoteAmount] = useState('');
  const [noteDetails, setNoteDetails] = useState('');

  // Modal: Edit Audit Record (Audit ledger copy only)
  const [editingItem, setEditingItem] = useState<AuditLogItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemSize, setEditItemSize] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Modal: Confirm Reset / Reconcile Period
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Refresh period state whenever updated
  const refreshPeriod = useCallback(() => {
    setPeriod(getAuditPeriod());
  }, []);

  useEffect(() => {
    const handleUpdate = () => refreshPeriod();
    window.addEventListener('audit-period-updated', handleUpdate);
    return () => window.removeEventListener('audit-period-updated', handleUpdate);
  }, [refreshPeriod]);

  // Synchronize past actions since period start date to prevent missing entries
  // (Items manually deleted from audit log are stored in deletedSourceIds and never re-added)
  useEffect(() => {
    const currentP = getAuditPeriod();
    const periodStart = currentP.startDate;
    const periodStartedAt = currentP.startedAt;

    // هل الحركة حصلت بعد بداية الفترة؟
    // - لو للحركة وقت تسجيل دقيق: بنقارنه بلحظة التقفيل (حتى لو في نفس اليوم)
    // - لو حركة قديمة من غير وقت: بنعتبرها بعد التقفيل بس لو في يوم بعد يوم التقفيل
    // - لو الفترة نفسها قديمة ومفيهاش لحظة بداية: السلوك القديم بالتاريخ
    const isAfterStart = (timestamp: string | undefined, date: string): boolean => {
      if (periodStartedAt) {
        if (timestamp) return timestamp >= periodStartedAt;
        return date > periodStart;
      }
      return date >= periodStart;
    };

    // 1. Orders and sold items
    state.orders.forEach((order) => {
      order.items.forEach((it) => {
        if (it.isSold && it.soldDate && isAfterStart(it.soldAt, it.soldDate)) {
          const cust = it.customerId
            ? (state.customers || []).find((c) => c.id === it.customerId)
            : undefined;
          recordAuditEntry({
            sourceId: `sale_${order.id}_${it.id}_${it.soldDate}`,
            type: 'sale',
            title: `${it.name}${it.size ? ` (مقاس ${it.size})` : ''}`,
            itemName: it.name,
            itemSize: it.size,
            orderCode: order.code,
            customerName: cust?.name,
            amount: (it.soldPrice || 0) * (it.quantity || 1),
            actionDate: it.soldDate,
            details: `الكمية: ${it.quantity} | سعر البيع: ${it.soldPrice || 0} ${state.settings.currency} | طريقة الدفع: ${it.paymentMethod || 'نقدية (كاش)'}`,
          });
        }
      });
    });

    // 2. Customer Payments
    (state.customerPayments || []).forEach((pay) => {
      if (isAfterStart(pay.createdAt, pay.date) && !pay.appliedToItemId && pay.kind !== 'refund') {
        const cust = (state.customers || []).find((c) => c.id === pay.customerId);
        const linkedOrder = pay.orderId ? state.orders.find((o) => o.id === pay.orderId) : undefined;
        recordAuditEntry({
          sourceId: `pay_${pay.id}`,
          type: 'collection',
          title: cust?.name || 'عميل مسجل',
          customerName: cust?.name || 'عميل مسجل',
          orderCode: linkedOrder?.code,
          amount: pay.amount,
          actionDate: pay.date,
          details: `سداد دين / دفعة نقدية${pay.notes ? ` (${pay.notes})` : ''}`,
        });
      }
    });

    refreshPeriod();
  }, [
    state.orders,
    state.customerPayments,
    state.customers,
    state.settings.currency,
    refreshPeriod,
  ]);

  // Handle Save Manual Note
  const handleSaveManualNote = (e: React.FormEvent) => {
    e.preventDefault();
    const text = noteDetails.trim();
    if (!text) return;

    const parsedAmount = noteAmount.trim() ? parseFloat(noteAmount) : undefined;
    const today = new Date().toISOString().split('T')[0];

    recordAuditEntry({
      type: 'note',
      title: text,
      itemName: text,
      amount: parsedAmount !== undefined && !isNaN(parsedAmount) ? parsedAmount : undefined,
      actionDate: today,
      details: text,
    });

    setNoteAmount('');
    setNoteDetails('');
    setShowNoteModal(false);
    refreshPeriod();
  };

  // Open Edit Modal for an audit entry
  const handleOpenEditModal = (item: AuditLogItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditItemName(item.itemName || '');
    setEditItemSize(item.itemSize || '');
    setEditAmount(item.amount !== undefined ? String(item.amount) : '');
    setEditDetails(item.details || '');
    setEditNotes(item.notes || '');
  };

  // Save Edit (Audit ledger copy only)
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedAmount = editAmount.trim() ? parseFloat(editAmount) : undefined;
    updateAuditEntry(editingItem.id, {
      title: editTitle.trim() || editingItem.title,
      itemName: editItemName.trim() || undefined,
      itemSize: editItemSize.trim() || undefined,
      amount: parsedAmount,
      details: editDetails.trim(),
      notes: editNotes.trim() || undefined,
    });

    setEditingItem(null);
    refreshPeriod();
  };

  // Handle Reset / Reconcile Period
  const handleConfirmReset = () => {
    resetAuditPeriod();
    setShowResetConfirm(false);
    refreshPeriod();
  };

const ALLOWED_AUDIT_TYPES: AuditActionType[] = ['sale', 'return', 'collection', 'note'];

function getDisplayTitle(item: AuditLogItem): string {
  if (item.type === 'sale') {
    const base = (item.itemName || item.title || '').replace(/^بيع\s*(صنف)?\s*[:\-]?\s*/, '').trim();
    if (item.itemSize && !base.includes(item.itemSize)) {
      return `${base} (مقاس ${item.itemSize})`;
    }
    return base || 'صنف مباع';
  }
  if (item.type === 'return') {
    return (item.itemName || item.title || '').replace(/^مرتجع\s*(صنف)?\s*[:\-]?\s*/, '').trim() || 'صنف مرتجع';
  }
  if (item.type === 'collection') {
    return item.customerName || (item.title || '').replace(/^تحصيل\s*(من\s*عميل)?\s*[:\-]?\s*/, '').trim() || 'تحصيل';
  }
  return item.title;
}

  // Filtered Items: Search and Dropdown filter work simultaneously
  const filteredItems = useMemo(() => {
    return period.items.filter((item) => {
      // Allowed types only: sale, return, collection, note
      if (!ALLOWED_AUDIT_TYPES.includes(item.type)) return false;

      // 1. Dropdown Type Filter
      if (filterType !== 'all') {
        if (item.type !== filterType) return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const displayTitle = getDisplayTitle(item).toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q) || displayTitle.includes(q);
        const matchDetails = (item.details || '').toLowerCase().includes(q);
        const matchItem = (item.itemName || '').toLowerCase().includes(q);
        const matchSize = (item.itemSize || '').toLowerCase().includes(q);
        const matchOrder = (item.orderCode || '').toLowerCase().includes(q);
        const matchCust = (item.customerName || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchDetails &&
          !matchItem &&
          !matchSize &&
          !matchOrder &&
          !matchCust &&
          !matchNotes
        ) {
          return false;
        }
      }

      return true;
    });
  }, [period.items, filterType, searchQuery]);

  // Statistics: only count allowed types
  const totalMovements = period.items.filter((it) => ALLOWED_AUDIT_TYPES.includes(it.type)).length;
  const manualNotesCount = period.items.filter((it) => it.type === 'note').length;

  const getTypeMeta = (type: AuditActionType) => {
    switch (type) {
      case 'sale':
        return {
          label: 'بيع',
          stripe: 'bg-[#2F7F5F]',
          badgeBg: 'bg-[#E3F2EA]',
          badgeText: 'text-[#2F7F5F]',
        };
      case 'return':
        return {
          label: 'مرتجع',
          stripe: 'bg-[#A23B5A]',
          badgeBg: 'bg-[#F8E6EC]',
          badgeText: 'text-[#A23B5A]',
        };
      case 'collection':
        return {
          label: 'تحصيل',
          stripe: 'bg-[#3D6A8F]',
          badgeBg: 'bg-[#EBF2F7]',
          badgeText: 'text-[#3D6A8F]',
        };
      case 'note':
      default:
        return {
          label: 'ملاحظة',
          stripe: 'bg-[#2F9F91]',
          badgeBg: 'bg-[#E0F4F2]',
          badgeText: 'text-[#2F9F91]',
        };
    }
  };

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج من #6B2D7A إلى #5F2967، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent"
            title="رجوع للرئيسية"
          >
            ➜
          </button>
          <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
            سجل المراجعة
          </span>
        </div>
        <div className="w-6 h-6 flex items-center justify-center opacity-80">
          <Icon3D name="verified" size={22} />
        </div>
      </div>

      {/* 2. كارت تيل متدرج (#2F9F91 إلى #2DB2A5): فترة التسجيل الحالية */}
      <div className="rounded-[20px] bg-gradient-to-l from-[#2F9F91] to-[#2DB2A5] p-[15px] text-white shadow-[0_6px_16px_rgba(47,159,145,0.25)] select-none">
        <div
          onClick={() => setIsStatsOpen(!isStatsOpen)}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-[800]">فترة التسجيل الحالية</span>
              <span className="h-[22px] px-2.5 rounded-full bg-white/20 text-white text-[10px] font-bold inline-flex items-center gap-1 border border-white/30 backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                التسجيل شغال
              </span>
            </div>
            <p className="text-[11px] text-white/90 font-medium">
              بدأت بتاريخ: <span className="font-bold tabular-nums">{period.startDate}</span> ({period.startTime})
            </p>
          </div>

          <span className="text-sm font-bold text-white/80">
            {isStatsOpen ? '▲' : '▼'}
          </span>
        </div>

        {/* الإحصائيات (مخفية افتراضياً وتظهر عند الضغط) */}
        {isStatsOpen && (
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs">
              <span className="text-[10px] text-white/80 block font-medium">عدد الحركات</span>
              <strong className="text-[16px] font-black tabular-nums block mt-0.5">
                {totalMovements}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs">
              <span className="text-[10px] text-white/80 block font-medium">الملاحظات اليدوية</span>
              <strong className="text-[16px] font-black tabular-nums block mt-0.5">
                {manualNotesCount}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* 3. زر إضافة ملاحظة صغير بدون عداد */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => {
            setNoteDetails('');
            setNoteAmount('');
            setShowNoteModal(true);
          }}
          className="h-[28px] px-3 rounded-full bg-[#5F2967] hover:bg-[#4A1E52] text-white text-[11px] font-[700] flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all"
        >
          <span className="text-[#4ADE80] font-black text-[13px] leading-none">＋</span>
          <span>إضافة ملاحظة</span>
        </button>
      </div>

      {/* 4. شريط البحث وقائمة اختيار نوع الحركة في صف أفقي واحد */}
      <div className="flex items-center gap-[8px]">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="ابحث باسم الصنف أو الأوردر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[36px] pr-3 pl-7 rounded-[12px] border border-[#D4D0E0] bg-white text-[12px] font-[700] text-[#1F1A2E] placeholder:text-[#9A98B0] outline-none focus:border-[#5F2967]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A98B0] hover:text-[#1F1A2E] cursor-pointer text-xs"
              title="مسح البحث"
            >
              ✕
            </button>
          )}
        </div>

        <div className="relative w-[112px] shrink-0">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full h-[36px] pr-2.5 pl-6 rounded-[12px] border border-[#D4D0E0] bg-white text-[12px] font-[700] text-[#1F1A2E] outline-none cursor-pointer appearance-none text-right"
          >
            <option value="all">كل الحركات</option>
            <option value="sale">بيع</option>
            <option value="return">مرتجع</option>
            <option value="collection">تحصيل</option>
            <option value="note">ملاحظات</option>
          </select>
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7A7585] text-[11px] font-bold">
            ∨
          </div>
        </div>
      </div>

      {/* 5. قائمة كروت الحركات: ثابتة بدون توسع وبستايل كارت الأوردر */}
      {filteredItems.length === 0 ? (
        <div className="py-10 text-center card-main p-6 text-xs text-[#666079] space-y-1">
          <p className="font-bold">لا توجد حركات مسجلة تطابق البحث أو نوع الحركة المختار.</p>
          <p className="text-[11px]">أي حركة بيع أو مرتجع أو تحصيل جديدة سيتم توثيقها هنا تلقائياً.</p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-[7px]">
          {filteredItems.map((item) => {
            const meta = getTypeMeta(item.type);
            const formattedAmount = formatAuditAmount(item, state.settings.currency);
            const displayTitle = getDisplayTitle(item);

            return (
              <div
                key={item.id}
                className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
              >
                <SwipeRow
                  rowKey={`audit_${item.id}`}
                  swipeOpenKey={swipeOpenKey}
                  onOpenChange={setSwipeOpenKey}
                  onEdit={() => handleOpenEditModal(item)}
                  onDelete={() =>
                    confirmDelete({
                      title: 'تأكيد الحذف',
                      message: `هل أنت متأكد من حذف حركة «${displayTitle}» من سجل المراجعة؟`,
                      details: 'سيتم حذف نسخة الحركة من سجل المراجعة فقط، ولن تتأثر الفواتير أو الأرصدة الأصلية.',
                      onConfirm: () => {
                        deleteAuditEntry(item.id);
                        setSwipeOpenKey(null);
                        refreshPeriod();
                      },
                    })
                  }
                  className="rounded-[11px]"
                >
                  <div className="p-[7px_10px] flex items-center justify-between gap-2.5 bg-white">
                    {/* الجهة اليمنى: الشريط الملون + العنوان وتحته التاريخ */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-[4px] h-[28px] rounded-full shrink-0 ${meta.stripe}`} />

                      <div className="min-w-0 flex-1">
                        <div className="font-[800] text-[11px] text-[#211B24] truncate leading-tight">
                          {displayTitle}
                        </div>
                        <div className="text-[9px] font-[400] text-[#857D89] leading-tight mt-0.5 tabular-nums">
                          {formatArabicDate(item.actionDate)}
                        </div>
                      </div>
                    </div>

                    {/* الجهة اليسرى: المبلغ */}
                    {formattedAmount && (
                      <span
                        className={`text-[11px] font-[800] tabular-nums whitespace-nowrap leading-none shrink-0 ${
                          item.type === 'note'
                            ? 'text-[#4BA3E3]'
                            : 'text-[#211B24]'
                        }`}
                      >
                        {formattedAmount}
                      </span>
                    )}
                  </div>
                </SwipeRow>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. زر سفلي مطابق تماماً للصورة المرجعية: بنفسجي عريض */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="w-full py-3.5 px-4 rounded-[20px] bg-[#5F2967] hover:bg-[#4C1F53] text-white flex flex-col items-center justify-center gap-1 cursor-pointer shadow-[0_6px_20px_rgba(95,41,103,0.3)] active:scale-98 transition-all"
        >
          <span className="font-[800] text-[15px] leading-tight">
            ✓ التقفيل صحيح – ابدأ من جديد
          </span>
          <span className="text-[11px] text-white/80 font-medium leading-tight">
            يمسح سجل المراجعة فقط ولا يغير حسابات البرنامج
          </span>
        </button>
      </div>

      {/* MODAL 1: تعديل نسخة الحركة في سجل المراجعة فقط */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-sm bg-white rounded-[24px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967]">
                تعديل نسخة الحركة في سجل المراجعة
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-[#666079] hover:text-[#1F1A2E]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                عنوان الحركة / الاسم الظاهر *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#1F1A2E] mb-1">
                  اسم الصنف / البيان
                </label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F1A2E] mb-1">
                  المقاس (إن وجد)
                </label>
                <input
                  type="text"
                  value={editItemSize}
                  onChange={(e) => setEditItemSize(e.target.value)}
                  className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                المبلغ المعروض في السجل ({state.settings.currency})
              </label>
              <input
                type="number"
                step="any"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-center font-black text-sm text-[#5F2967] outline-none focus:border-[#5F2967] tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                تفاصيل ووصف الحركة
              </label>
              <textarea
                rows={2}
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#D4D0E0] bg-white text-xs font-medium outline-none focus:border-[#5F2967]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                ملاحظات السجل
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="ملاحظة خاصة بسجل المراجعة..."
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-[#F1E8F4] text-[#5F2967] text-[11px] leading-relaxed">
              ✓ التعديل يخص نسخة السجل فقط ولا يمس أو يغير الحركة الأصلية أو الفاتورة أو المخزون.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 h-[36px] rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                حفظ التعديل في السجل
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 h-[36px] rounded-xl bg-[#ECECF4] text-[#1F1A2E] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: إضافة ملاحظة يدوية (حقلان فقط بدون placeholder) */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveManualNote}
            className="w-full max-w-sm bg-white rounded-[24px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967]">
                إضافة ملاحظة
              </h3>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="text-[#666079] hover:text-[#1F1A2E]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                اسم الحركة / البيان *
              </label>
              <input
                type="text"
                required
                value={noteDetails}
                onChange={(e) => setNoteDetails(e.target.value)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                المبلغ ({state.settings.currency})
              </label>
              <input
                type="number"
                step="any"
                value={noteAmount}
                onChange={(e) => setNoteAmount(e.target.value)}
                className="w-full h-[36px] px-3 rounded-xl border border-[#D4D0E0] bg-white text-center font-bold outline-none focus:border-[#5F2967] tabular-nums"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 h-[36px] rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                حفظ الملاحظة
              </button>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 h-[36px] rounded-xl bg-[#ECECF4] text-[#1F1A2E] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: تأكيد التقفيل وبدء فترة مراجعة جديدة */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-[24px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-[#5F2967]">
              <Icon3D name="shield_ok" size={24} />
              <h3 className="font-extrabold text-[15px] text-[#1F1A2E]">
                تأكيد تقفيل سجل المراجعة
              </h3>
            </div>

            <p className="text-[11px] text-[#666079] leading-relaxed">
              سيتم أرشفة/تصفير سجل المراجعة الحالي والبدء بفترة مراجعة جديدة بتاريخ ووقت الآن.
            </p>

            <div className="p-3 rounded-2xl bg-[#E3F2EA] text-[#2F7F5F] text-[11px] font-bold leading-relaxed">
              ✓ لن يتم حذف أو تعديل أي حركة مالية أو أوردر أو رصيد في البرنامج على الإطلاق.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 h-[38px] rounded-xl bg-[#5F2967] hover:bg-[#4C1F53] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                تأكيد التقفيل والبدء من جديد
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 h-[38px] rounded-xl bg-[#ECECF4] text-[#1F1A2E] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
