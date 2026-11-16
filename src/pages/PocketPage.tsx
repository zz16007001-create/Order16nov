/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import type { PocketCategory, PocketTransaction } from '../types';
import { useApp } from '../context/AppContext';
import { Icon3D } from '../components/icons3d/Icon3D';
import { SwipeRow } from '../components/SwipeRow';
import { useConfirmDelete } from '../components/ConfirmDeleteDialog';
import { stripBagDisplayPrefix } from '../utils/arabicText';
import { getPocketRemaining, getSettled, isFullySettled } from '../utils/pocketMath';

const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const dayMonth = (d: string): string => {
  if (!d || typeof d !== 'string') return d;
  const parts = d.split('-');
  if (parts.length >= 3) {
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(day) && !isNaN(month) && month >= 1 && month <= 12) {
      return `${day} ${ARABIC_MONTHS[month - 1]}`;
    }
  }
  return d;
};

const fullDate = (d: string): string => {
  if (!d || typeof d !== 'string') return d;
  const parts = d.split('-');
  if (parts.length >= 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && month >= 1 && month <= 12) {
      return `${day} ${ARABIC_MONTHS[month - 1]} ${year}`;
    }
  }
  return d;
};

export const PocketPage: React.FC = () => {
  const {
    state,
    pocketBalance,
    pocketCapital,
    pocketTotalWithdrawn,
    pocketTotalRepaid,
    pocketTotalSettled,
    pocketOpenDebt,
    pocketWarningActive,
    setCurrentPage,
    openQuickModal,
    updatePocketWithdrawal,
    deletePocketWithdrawal,
    settlePocketWithdrawal,
    unsettlePocketWithdrawal,
  } = useApp();
  const { confirmDelete } = useConfirmDelete();

  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);

  // تعديل سلفة
  const [editingWithdrawal, setEditingWithdrawal] = useState<PocketTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<PocketCategory>('ترفيه/أخرى');
  const [editNotes, setEditNotes] = useState('');
  const [settlingWithdrawal, setSettlingWithdrawal] = useState<PocketTransaction | null>(null);
  const [unsettlingWithdrawal, setUnsettlingWithdrawal] = useState<PocketTransaction | null>(null);

  const startEdit = (w: PocketTransaction) => {
    setEditingWithdrawal(w);
    setEditAmount(String(w.amount));
    setEditDate(w.date || '');
    setEditDescription(stripBagDisplayPrefix(w.description));
    setEditCategory(w.category || 'ترفيه/أخرى');
    setEditNotes(w.notes || '');
  };

  const editRepaid = editingWithdrawal ? editingWithdrawal.repaidAmount || 0 : 0;
  const editSettled = editingWithdrawal ? getSettled(editingWithdrawal) : 0;
  const editMinAmount = editRepaid + editSettled;
  const editAmountNum = parseFloat(editAmount);
  const editAmountInvalid = !editAmountNum || editAmountNum <= 0 || editAmountNum < editMinAmount;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWithdrawal || editAmountInvalid) return;
    updatePocketWithdrawal(editingWithdrawal.id, {
      amount: editAmountNum,
      date: editDate || undefined,
      description: editDescription.trim() || stripBagDisplayPrefix(editingWithdrawal.description) || editingWithdrawal.description,
      category: editCategory,
      notes: editNotes.trim() || undefined,
    });
    setEditingWithdrawal(null);
  };

  const handleDelete = (w: PocketTransaction) => {
    const hasRepayments = (w.repayments || []).length > 0;
    const details = hasRepayments
      ? 'سيتم حذف دفعات السداد المرتبطة بها أيضاً، وأي سداد تم خصمه من القبض سيتم عكسه.'
      : undefined;
    const displayDesc = stripBagDisplayPrefix(w.description) || w.description;
    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف سلفة "${displayDesc}" (${w.amount.toLocaleString('en-US')} ${state.settings.currency}) نهائياً؟`,
      details,
      onConfirm: () => {
        deletePocketWithdrawal(w.id);
        if (expandedWithdrawalId === w.id) setExpandedWithdrawalId(null);
      },
    });
  };

  const [expandedWithdrawalId, setExpandedWithdrawalId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'all' | 'custom'>('this_month');
  const [settlementFilter, setSettlementFilter] = useState<'normal' | 'settled' | 'all'>('normal');
  const [customMonth, setCustomMonth] = useState(new Date().toISOString().slice(0, 7));

  // Current month string YYYY-MM
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // 1. Withdrawals list
  const allWithdrawals = useMemo(
    () => state.pocketTransactions.filter((tx) => tx.type === 'withdrawal'),
    [state.pocketTransactions]
  );

  const filteredWithdrawals = useMemo(() => {
    const byPeriod =
      periodFilter === 'all'
        ? allWithdrawals
        : periodFilter === 'this_month'
        ? allWithdrawals.filter((w) => w.date.startsWith(currentMonthStr))
        : allWithdrawals.filter((w) => w.date.startsWith(customMonth));

    if (settlementFilter === 'normal') {
      return byPeriod.filter((w) => !isFullySettled(w));
    }
    if (settlementFilter === 'settled') {
      return byPeriod.filter((w) => isFullySettled(w));
    }
    return byPeriod;
  }, [allWithdrawals, periodFilter, settlementFilter, currentMonthStr, customMonth]);

  // 2. Support Transactions list (from order profit 20% or from salary)
  const supportTransactions = useMemo(
    () =>
      state.pocketTransactions.filter(
        (tx) => tx.type === 'support_profit' || tx.type === 'support_salary'
      ),
    [state.pocketTransactions]
  );

  // 3. Analytics & Summary Metrics
  const analytics = useMemo(() => {
    const totalWithdrawnForStats =
      pocketTotalWithdrawn + (state.settings.analyticsOpeningWithdrawn || 0);
    const totalRepaidForStats =
      pocketTotalRepaid + (state.settings.analyticsOpeningRepaid || 0);

    let monthsCount = 1;
    const startMatch = /^(\d{4})-(\d{2})$/.exec(
      (state.settings.analyticsStartMonth || '').trim()
    );
    if (startMatch) {
      const startYear = parseInt(startMatch[1], 10);
      const startMonth = parseInt(startMatch[2], 10);
      const curYear = parseInt(currentMonthStr.slice(0, 4), 10);
      const curMonth = parseInt(currentMonthStr.slice(5, 7), 10);
      monthsCount = Math.max(1, (curYear - startYear) * 12 + (curMonth - startMonth) + 1);
    } else {
      const monthMap: Record<string, number> = {};
      for (const w of allWithdrawals) {
        const m = w.date ? w.date.slice(0, 7) : 'أخرى';
        monthMap[m] = (monthMap[m] || 0) + w.amount;
      }
      monthsCount = Math.max(1, Object.keys(monthMap).length);
    }

    const monthlyAverage = totalWithdrawnForStats / monthsCount;
    const netWithdrawnForRepayment = totalWithdrawnForStats - pocketTotalSettled;
    const repaymentRate =
      netWithdrawnForRepayment > 0 ? (totalRepaidForStats / netWithdrawnForRepayment) * 100 : 100;
    const daysRemaining =
      monthlyAverage > 0 && pocketBalance > 0
        ? Math.round((pocketBalance / monthlyAverage) * 30)
        : null;

    return {
      monthlyAverage,
      repaymentRate,
      daysRemaining,
      totalWithdrawnForStats,
      totalRepaidForStats,
    };
  }, [
    allWithdrawals,
    pocketTotalWithdrawn,
    pocketTotalSettled,
    pocketTotalRepaid,
    pocketBalance,
    currentMonthStr,
    state.settings.analyticsOpeningWithdrawn,
    state.settings.analyticsOpeningRepaid,
    state.settings.analyticsStartMonth,
  ]);

  return (
    <div className="w-full flex flex-col gap-[10px] text-[#1F1A2E]">
      {/* 1) كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px */}
      <div className="card-header-purple">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent"
            title="رجوع للرئيسية"
          >
            ➜
          </button>
          <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
            خزنة بوكيت (طوارئ)
          </span>
        </div>

        <button
          onClick={() => openQuickModal('advances_and_settlements')}
          className="btn-header-white-pill"
        >
          ＋ سلفة / سداد
        </button>
      </div>

      {/* 2) تنبيه انخفاض الرصيد */}
      {pocketWarningActive && (
        <div className="p-3 rounded-[16px] bg-[#F8E6EC] border border-[#A23B5A]/40 text-[#A23B5A] flex items-center gap-2">
          <Icon3D name="warning" size={18} />
          <div className="leading-tight">
            <span className="font-[800] text-[12px] block">تنبيه انخفاض رصيد بوكيت!</span>
            <span className="text-[11px] font-[500]">
              الرصيد الحالي ({pocketBalance.toLocaleString('en-US')} {state.settings.currency}) أقل من حد الأمان المحدد.
            </span>
          </div>
        </div>
      )}

      {/* 3) الكارت الأخضر: ارتفاع 72px، أخضر تيل متدرج */}
      <div className="w-full h-[72px] card-hero-teal relative px-[14px] flex items-center justify-between">
        <div>
          <div className="text-[10px] font-[600] text-white/85 leading-none mb-[3px]">
            الرصيد الفعلي المتاح
          </div>
          <div className="flex items-baseline gap-[6px]">
            <span className="text-[26px] font-[900] leading-none text-white tabular-nums">
              {pocketBalance.toLocaleString('en-US')}
            </span>
            <span className="text-[12px] font-[700] text-white/85 leading-none">
              {state.settings.currency}
            </span>
          </div>
          <div className="text-[10px] font-[600] text-white/75 leading-none mt-[4px] tabular-nums">
            رأس مال الخزنة: {pocketCapital.toLocaleString('en-US')} {state.settings.currency}
          </div>
        </div>

        <div className="w-[30px] h-[30px] rounded-full bg-[rgba(255,255,255,0.2)] flex items-center justify-center text-white shrink-0">
          <Icon3D name="shield_ok" size={15} />
        </div>
      </div>

      {/* 4) الأربع كروت الصغيرة: grid-cols-4، ارتفاع 48px */}
      <div className="grid grid-cols-4 gap-[7px]">
        {/* الكارت 1: المطلوب سداده */}
        <div className="h-[48px] px-[5px] card-main flex flex-col items-center justify-center text-center min-w-0">
          <span className="text-[10px] font-[600] text-[#666079] leading-tight block truncate w-full">
            المطلوب سداده
          </span>
          <span className="text-[14px] font-[900] text-[#A23B5A] tabular-nums leading-tight block mt-0.5">
            {pocketOpenDebt.toLocaleString('en-US')}
          </span>
        </div>

        {/* الكارت 2: إجمالي التسوية */}
        <div className="h-[48px] px-[5px] card-main flex flex-col items-center justify-center text-center min-w-0">
          <span className="text-[10px] font-[600] text-[#666079] leading-tight block truncate w-full">
            إجمالي التسوية
          </span>
          <span className="text-[14px] font-[900] text-[#5F2967] tabular-nums leading-tight block mt-0.5">
            {pocketTotalSettled.toLocaleString('en-US')}
          </span>
        </div>

        {/* الكارت 3: السداد */}
        <div className="h-[48px] px-[5px] card-main flex flex-col items-center justify-center text-center min-w-0">
          <span className="text-[10px] font-[600] text-[#666079] leading-tight block truncate w-full">
            السداد
          </span>
          <span className="text-[14px] font-[900] text-[#2F7F5F] tabular-nums leading-tight block mt-0.5">
            {analytics.repaymentRate.toFixed(0)}%
          </span>
        </div>

        {/* الكارت 4: الاستنزاف */}
        <div className="h-[48px] px-[5px] card-main flex flex-col items-center justify-center text-center min-w-0">
          <span className="text-[10px] font-[600] text-[#666079] leading-tight block truncate w-full">
            الاستنزاف
          </span>
          <span className="text-[14px] font-[900] text-[#B7791F] tabular-nums leading-tight block mt-0.5">
            {analytics.monthlyAverage.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* 5) كارت سجل حركات بوكيت */}
      <div className="px-[2px]">
        {/* الهيدر: ارتفاع 38px */}
        <div className="h-[38px] flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-[6px] min-w-0">
            <div className="w-[28px] h-[28px] rounded-full bg-[#F1E8F4] text-[#5F2967] flex items-center justify-center shrink-0">
              <Icon3D name="history" size={14} />
            </div>
            <span className="text-[13px] font-[800] text-[#1F1A2E] truncate">
              سجل حركات بوكيت ({filteredWithdrawals.length})
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value as 'normal' | 'settled' | 'all')}
              className="h-[28px] rounded-full px-2 text-[11px] font-[700] bg-[#F5F4F9] border border-[#D4D0E0] outline-none text-[#1F1A2E] cursor-pointer"
            >
              <option value="normal">عادية</option>
              <option value="settled">متسوّاة</option>
              <option value="all">الكل</option>
            </select>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="h-[28px] rounded-full px-2 text-[11px] font-[700] bg-[#F5F4F9] border border-[#D4D0E0] outline-none text-[#1F1A2E] cursor-pointer"
            >
              <option value="this_month">هذا الشهر</option>
              <option value="all">كل الفترة</option>
              <option value="custom">اختيار شهر</option>
            </select>
          </div>
        </div>

        {/* سطر اختيار الشهر عند تحديد الفلتر المخصص */}
        {periodFilter === 'custom' && (
          <div className="pb-2">
            <input
              type="month"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
              className="w-full h-[30px] rounded-full px-3 text-[12px] font-[700] bg-[#F5F4F9] border border-[#D4D0E0] outline-none text-[#1F1A2E] text-center"
            />
          </div>
        )}

        {filteredWithdrawals.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#666079]">
            لا توجد حركات مسجلة في هذه الفترة
          </div>
        ) : (
          <div className="flex flex-col gap-[7px]">
            {filteredWithdrawals.map((w) => {
              const remaining = getPocketRemaining(w);
              const settled = getSettled(w);
              const settledFull = isFullySettled(w);
              const isExpanded = expandedWithdrawalId === w.id;

              const isPartial = (w.repaidAmount || 0) > 0 && (w.repaidAmount || 0) < w.amount;
              const isFull = (w.repaidAmount || 0) >= w.amount;

              const statusColor = settledFull
                ? '#7C4D85'
                : isFull
                ? '#2E8C69'
                : isPartial
                ? '#C99A2E'
                : '#B8405E';

              return (
                <div
                  key={w.id}
                  className="bg-white border border-[#E5E7EB] rounded-[10px] overflow-hidden shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                >
                  <SwipeRow
                    rowKey={`pocket_${w.id}`}
                    swipeOpenKey={swipeOpenKey}
                    onOpenChange={setSwipeOpenKey}
                    onEdit={() => startEdit(w)}
                    onDelete={() => handleDelete(w)}
                    className="bg-white"
                  >
                    <div
                      onClick={() => setExpandedWithdrawalId(isExpanded ? null : w.id)}
                      className="grid grid-cols-[20px_minmax(0,1fr)_64px_64px_12px] gap-x-[5px] items-center p-[8px_10px] cursor-pointer select-none bg-white"
                    >
                      {/* 1) المربع اللوني */}
                      <div
                        style={{ backgroundColor: statusColor }}
                        className="w-[14px] h-[30px] rounded-[6px] shrink-0"
                      />

                      {/* 2) الاسم والتاريخ */}
                      <div className="min-w-0 pr-0.5">
                        <span className="text-[11px] font-[800] text-[#211B24] truncate leading-tight block">
                          {stripBagDisplayPrefix(w.description)}
                        </span>
                        <span className="text-[9px] font-[400] text-[#857D89] leading-tight block truncate mt-0.5">
                          {dayMonth(w.date)}
                        </span>
                      </div>

                      {/* 3) القيمة */}
                      <div className="border-s border-[#E4E1EC] h-[30px] flex flex-col items-center justify-center overflow-hidden">
                        <span className="text-[9px] text-[#9A98B0] leading-none">
                          القيمة
                        </span>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <span className="text-[11px] font-[800] text-[#1F1A2E] tabular-nums leading-none whitespace-nowrap">
                            {w.amount.toLocaleString('en-US')}
                          </span>
                          <span className="text-[8px] font-[600] text-[#857D89] leading-none">
                            {state.settings.currency || 'ج.م'}
                          </span>
                        </div>
                      </div>

                      {/* 4) الحالة */}
                      <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center">
                        <span
                          className={`h-[16px] px-[6px] text-[9px] font-[700] leading-[16px] rounded-full whitespace-nowrap w-max ${
                            settledFull
                              ? 'bg-[#F1E8F4] text-[#5F2967]'
                              : isFull
                              ? 'bg-[#E3F2EA] text-[#2F7F5F]'
                              : isPartial
                              ? 'bg-[#FBF1DE] text-[#B7791F]'
                              : 'bg-[#F8E6EC] text-[#A23B5A]'
                          }`}
                        >
                          {settledFull ? 'متسوّاة' : isFull ? 'مسدد' : isPartial ? 'سداد جزئي' : 'غير مسدد'}
                        </span>
                      </div>

                      {/* 5) السهم */}
                      <svg
                        className={`w-3 h-3 text-[#857D89] transition-transform duration-200 shrink-0 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </SwipeRow>

                  {/* د-3) اللوحة المفتوحة */}
                  {isExpanded && (
                    <div className="bg-[#3C3F4A] border-t border-[#E9E3EB] pt-[8px] pb-[8px] pe-[10px] ps-[30px] space-y-[7px]">
                      {/* grid عمودين (أو 3 لو فيه تسوية) gap-[7px]: كارت "المسدد" (و"المتسوّى") وكارت "المتبقي" */}
                      <div className="relative">
                        <span className="absolute start-[-16px] top-1/2 -translate-y-1/2 h-[2px] w-[14px] bg-[#E2B84F]" />
                        <span className="absolute start-[-19px] top-1/2 -translate-y-1/2 h-[8px] w-[8px] rounded-full bg-[#E2B84F]" />
                        <div className={`grid ${settled > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-[7px]`}>
                          <div className={`bg-white border border-[#E5E7EB] rounded-[8px] ${settled > 0 ? 'p-[6px_8px]' : 'p-[6px_10px]'}`}>
                            <span className="text-[10px] text-[#9A98B0] block leading-tight">
                              المسدد
                            </span>
                            <span className="text-[12px] font-[800] text-[#2F7F5F] tabular-nums block mt-0.5 leading-tight whitespace-nowrap">
                              {(w.repaidAmount || 0).toLocaleString('en-US')} {state.settings.currency}
                            </span>
                          </div>
                          {settled > 0 && (
                            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-[6px_8px]">
                              <span className="text-[10px] text-[#9A98B0] block leading-tight">
                                المتسوّى
                              </span>
                              <span className="text-[12px] font-[800] text-[#5F2967] tabular-nums block mt-0.5 leading-tight whitespace-nowrap">
                                {settled.toLocaleString('en-US')} {state.settings.currency}
                              </span>
                            </div>
                          )}
                          <div className={`bg-white border border-[#E5E7EB] rounded-[8px] ${settled > 0 ? 'p-[6px_8px]' : 'p-[6px_10px]'}`}>
                            <span className="text-[10px] text-[#9A98B0] block leading-tight">
                              المتبقي
                            </span>
                            <span className="text-[12px] font-[800] text-[#A23B5A] tabular-nums block mt-0.5 leading-tight whitespace-nowrap">
                              {remaining.toLocaleString('en-US')} {state.settings.currency}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* لو فيه دفعات: عنوان "دفعات السداد" text-[#E8E9EE] */}
                      {w.repayments && w.repayments.length > 0 && (
                        <div className="space-y-[6px]">
                          <span className="text-[10px] font-[700] text-[#E8E9EE] block">
                            دفعات السداد
                          </span>
                          {w.repayments.map((rep, repIndex) => {
                            const isFirstRep = repIndex === 0;
                            const isLastRep = repIndex === w.repayments!.length - 1;
                            return (
                              <div key={rep.id} className="relative">
                                <span className={`absolute start-[-16px] w-[2px] bg-[#E2B84F] ${isFirstRep ? 'top-1/2' : '-top-[6px]'} ${isLastRep ? 'bottom-1/2' : 'bottom-0'}`} />
                                <span className="absolute start-[-16px] top-1/2 -translate-y-1/2 h-[2px] w-[14px] bg-[#E2B84F]" />
                                <span className="absolute start-[-19px] top-1/2 -translate-y-1/2 h-[8px] w-[8px] rounded-full bg-[#E2B84F]" />
                                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-[5px_10px] min-h-[38px] flex items-center justify-between">
                                  <div>
                                    <div className="text-[11px] font-[700] text-[#1F1A2E] leading-tight">
                                      {fullDate(rep.date)}
                                    </div>
                                    <div className="text-[9px] text-[#9A98B0] leading-tight mt-0.5">
                                      {rep.source || 'سداد'}
                                    </div>
                                  </div>
                                  <div className="text-[12px] font-[800] text-[#2F7F5F] tabular-nums">
                                    {rep.amount.toLocaleString('en-US')} {state.settings.currency}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* أزرار الإجراءات: سداد / تسوية من الأرباح / تراجع عن التسوية */}
                      {(remaining > 0 || settled > 0) && (
                        <div className="flex flex-wrap items-center justify-start gap-2 -ms-[20px]">
                          {remaining > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openQuickModal('advances_and_settlements', { mode: 'repay', pocketTxId: w.id })
                                }
                                className="bg-[#2E8C69] hover:bg-[#257356] text-white h-[28px] px-4 rounded-[8px] text-[11px] font-[700] border-0 cursor-pointer active:scale-95 transition"
                              >
                                تسجيل دفعة جديدة
                              </button>
                              <button
                                type="button"
                                onClick={() => setSettlingWithdrawal(w)}
                                className="bg-[#5F2967] hover:bg-[#4A1E52] text-white h-[28px] px-4 rounded-[8px] text-[11px] font-[700] border-0 cursor-pointer active:scale-95 transition"
                              >
                                تسوية من الأرباح
                              </button>
                            </>
                          )}
                          {settled > 0 && (
                            <button
                              type="button"
                              onClick={() => setUnsettlingWithdrawal(w)}
                              className="bg-[#666079] hover:bg-[#524C63] text-white h-[28px] px-4 rounded-[8px] text-[11px] font-[700] border-0 cursor-pointer active:scale-95 transition"
                            >
                              تراجع عن التسوية
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6) سجل إيداع ودعم بوكيت */}
      <div className="card-main p-4 space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#E4E1EC]">
          <span className="text-[14px] font-[800] text-[#1F1A2E] flex items-center gap-1.5">
            <Icon3D name="money_in" size={16} />
            سجل إيداع ودعم بوكيت ({supportTransactions.length})
          </span>
          <span className="text-[10px] text-[#666079]">قراءة فقط</span>
        </div>

        {supportTransactions.length === 0 ? (
          <div className="py-5 text-center text-[12px] text-[#666079]">
            لا توجد حركات إيداع أو دعم مسجلة حتى الآن
          </div>
        ) : (
          <div className="divide-y divide-[#E4E1EC] max-h-56 overflow-y-auto">
            {supportTransactions.map((tx) => {
              const isNegative = tx.amount < 0;
              const isFromSalary = tx.type === 'support_salary';
              const isFromOrder = tx.type === 'support_profit';

              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-[12px]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-[6px] font-[700] ${
                          isFromSalary
                            ? 'bg-[#FBF1DE] text-[#B7791F]'
                            : 'bg-[#F1E8F4] text-[#5F2967]'
                        }`}
                      >
                        {isFromSalary
                          ? 'من القبض'
                          : isFromOrder
                          ? 'من أرباح الأوردرات (20%)'
                          : 'إيداع يدوي'}
                      </span>
                      <strong className="text-[#1F1A2E] truncate font-[700]">
                        {stripBagDisplayPrefix(tx.description)}
                      </strong>
                    </div>
                    <span className="text-[10px] text-[#666079] block mt-0.5">
                      التاريخ: {tx.date}
                    </span>
                  </div>

                  <strong
                    className={`font-[800] tabular-nums text-[12px] whitespace-nowrap ${
                      isNegative
                        ? 'text-[#A23B5A]'
                        : 'text-[#2F7F5F]'
                    }`}
                  >
                    {isNegative ? '' : '+'}
                    {tx.amount.toLocaleString('en-US')} {state.settings.currency}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7) التحاليل الإضافية واستنزاف بوكيت */}
      <div className="card-main overflow-hidden">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="w-full p-3.5 flex items-center justify-between text-right cursor-pointer hover:bg-black/5 transition-none border-0 bg-transparent"
        >
          <div className="flex items-center gap-2">
            <Icon3D name="insights" size={16} />
            <h3 className="text-[14px] font-[800] text-[#1F1A2E]">
              تحليلات إضافية واستنزاف بوكيت
            </h3>
          </div>
          <Icon3D name={showAnalytics ? 'chevron_up' : 'chevron_down'} size={14} />
        </button>

        {showAnalytics && (
          <div className="p-3.5 pt-0 border-t border-[#E4E1EC] space-y-2 text-[12px]">
            <div className="p-2.5 rounded-[12px] bg-[#EDEEF2]/60 flex justify-between items-center">
              <span className="text-[#666079] text-[11px] font-[500]">المدة التقديرية لنفاد الرصيد:</span>
              <strong className="text-[#B7791F] font-[800] text-[12px]">
                {analytics.daysRemaining !== null ? `حوالي ${analytics.daysRemaining} يوم` : 'غير محدد'}
              </strong>
            </div>

            <div className="p-2.5 rounded-[12px] bg-[#EDEEF2]/60 flex justify-between items-center">
              <span className="text-[#666079] text-[11px] font-[500]">إجمالي ما تم سحبه تاريخياً:</span>
              <strong className="text-[#A23B5A] font-[800] text-[12px] tabular-nums">
                {analytics.totalWithdrawnForStats.toLocaleString('en-US')} {state.settings.currency}
              </strong>
            </div>

            <div className="p-2.5 rounded-[12px] bg-[#EDEEF2]/60 flex justify-between items-center">
              <span className="text-[#666079] text-[11px] font-[500]">إجمالي ما تم سداده تاريخياً:</span>
              <strong className="text-[#2F7F5F] font-[800] text-[12px] tabular-nums">
                {analytics.totalRepaidForStats.toLocaleString('en-US')} {state.settings.currency}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* مودال تعديل سلفة بوكيت: نفس تصميم مودالات صفحة القبض */}
      {editingWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-xs bg-white rounded-[20px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-sm text-[#5F2967]">تعديل السلفة</h3>
              <button
                type="button"
                onClick={() => setEditingWithdrawal(null)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                المبلغ ({state.settings.currency}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
              />
              {editMinAmount > 0 && (
                <p className="text-[10px] text-[#666079] mt-1">
                  {editRepaid > 0 && editSettled > 0
                    ? `تم سداد ${editRepaid.toLocaleString('en-US')} وتسوية ${editSettled.toLocaleString('en-US')} ${state.settings.currency} (الإجمالي ${editMinAmount.toLocaleString('en-US')})، فالمبلغ لازم يكون أكبر من أو يساوي ده.`
                    : editSettled > 0
                    ? `تم تسوية ${editSettled.toLocaleString('en-US')} ${state.settings.currency} من السلفة، فالمبلغ لازم يكون أكبر من أو يساوي ده.`
                    : `تم سداد ${editRepaid.toLocaleString('en-US')} ${state.settings.currency} من السلفة، فالمبلغ لازم يكون أكبر من أو يساوي ده.`}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">التاريخ:</label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">البيان:</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">التصنيف:</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as PocketCategory)}
                className="input-field w-full px-3 py-2 text-xs"
              >
                <option value="التزامات قبض">التزامات قبض</option>
                <option value="موسمي">موسمي</option>
                <option value="جديد/غير دائم">جديد/غير دائم</option>
                <option value="ترفيه/أخرى">ترفيه/أخرى</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">ملاحظات:</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editAmountInvalid}
                className="btn-primary flex-1 py-2 text-xs shadow-sm disabled:opacity-50"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={() => setEditingWithdrawal(null)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* مودال تأكيد تسوية السلفة من أرباح بوكيت */}
      {settlingWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-xs bg-white rounded-[20px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-sm text-[#5F2967]">تسوية من الأرباح</h3>
              <button
                type="button"
                onClick={() => setSettlingWithdrawal(null)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <p className="text-[12px] font-[600] text-[#1F1A2E] leading-relaxed">
              تسوية {getPocketRemaining(settlingWithdrawal).toLocaleString('en-US')} {state.settings.currency} من أرباح بوكيت؟ هتتخصم من رأس مال الخزنة ومش هتتحسب سداد.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  settlePocketWithdrawal(settlingWithdrawal.id);
                  if (expandedWithdrawalId === settlingWithdrawal.id) {
                    setExpandedWithdrawalId(null);
                  }
                  setSettlingWithdrawal(null);
                }}
                className="bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold rounded-xl flex-1 py-2 text-xs shadow-sm cursor-pointer border-0 transition"
              >
                تأكيد التسوية
              </button>
              <button
                type="button"
                onClick={() => setSettlingWithdrawal(null)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تأكيد التراجع عن التسوية */}
      {unsettlingWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-xs bg-white rounded-[20px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-sm text-[#5F2967]">تراجع عن التسوية</h3>
              <button
                type="button"
                onClick={() => setUnsettlingWithdrawal(null)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <p className="text-[12px] font-[600] text-[#1F1A2E] leading-relaxed">
              هل تريد التراجع عن تسوية {getSettled(unsettlingWithdrawal).toLocaleString('en-US')} {state.settings.currency} وإعادتها للمطلوب سداده؟
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  unsettlePocketWithdrawal(unsettlingWithdrawal.id);
                  if (expandedWithdrawalId === unsettlingWithdrawal.id && settlementFilter === 'settled') {
                    setExpandedWithdrawalId(null);
                  }
                  setUnsettlingWithdrawal(null);
                }}
                className="bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold rounded-xl flex-1 py-2 text-xs shadow-sm cursor-pointer border-0 transition"
              >
                تأكيد
              </button>
              <button
                type="button"
                onClick={() => setUnsettlingWithdrawal(null)}
                className="btn-secondary px-4 py-2 text-xs"
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
