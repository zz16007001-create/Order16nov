/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { stripBagDisplayPrefix } from '../utils/arabicText';
import { Icon3D } from '../components/icons3d/Icon3D';
import { Order, OrderItem } from '../types';
import { ARABIC_MONTHS, formatArabicDate } from '../utils/dateFormat';

type ReportTab = 'capital' | 'pocket' | 'salary';
type FilterMode = 'month' | 'custom' | 'all';

interface SheetRowItem {
  id: string;
  description: string;
  date: string;
  amount: number;
  subLabel?: string;
}

interface ActiveSheetState {
  title: string;
  total: number;
  accentColorClass: string;
  items: SheetRowItem[];
}

const getLocalTodayDate = (): { year: number; month: number; day: number; str: string } => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const str = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, str };
};

// نفس دوال الربح المحقق الموجودة في AppContext
const itemCashReceived = (it: OrderItem): number =>
  it.isSold ? (it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * (it.quantity || 1)) : 0;

const orderCashReceived = (o: Order): number => o.items.reduce((s, it) => s + itemCashReceived(it), 0);

const orderTotalCost = (o: Order): number =>
  o.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0) + (o.additionalBagCost || 0);

const orderRealizedProfit = (o: Order): number => Math.max(0, orderCashReceived(o) - orderTotalCost(o));

const formatNum = (n: number): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const ReportsPage: React.FC = () => {
  const { state, pocketOpenDebt, setCurrentPage } = useApp();

  const [activeTab, setActiveTab] = useState<ReportTab>('capital');

  const todayInfo = useMemo(() => getLocalTodayDate(), []);
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedYear, setSelectedYear] = useState<number>(todayInfo.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayInfo.month);
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${todayInfo.year}-${String(todayInfo.month).padStart(2, '0')}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(todayInfo.str);

  const [activeSheet, setActiveSheet] = useState<ActiveSheetState | null>(null);

  useEffect(() => {
    if (!activeSheet) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveSheet(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSheet]);

  const isCurrentMonthOrFuture =
    selectedYear > todayInfo.year ||
    (selectedYear === todayInfo.year && selectedMonth >= todayInfo.month);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonthOrFuture) return;
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const dateRange = useMemo(() => {
    if (filterMode === 'month') {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      return { start, end };
    }
    if (filterMode === 'custom') {
      const start = customStartDate && customEndDate && customStartDate > customEndDate ? customEndDate : customStartDate;
      const end = customStartDate && customEndDate && customStartDate > customEndDate ? customStartDate : customEndDate;
      return { start, end };
    }
    return null;
  }, [filterMode, selectedYear, selectedMonth, customStartDate, customEndDate]);

  const isInDateRange = useMemo(() => {
    return (dateStr?: string): boolean => {
      if (!dateRange) return true;
      if (!dateStr) return false;
      if (dateRange.start && dateStr < dateRange.start) return false;
      if (dateRange.end && dateStr > dateRange.end) return false;
      return true;
    };
  }, [dateRange]);

  // حساب هل الفترة أطول من شهر وعدد الشهور (لعرض متوسط الربح الشهري)
  const periodMonthsInfo = useMemo(() => {
    if (filterMode === 'month') {
      return { isMultiMonth: false, monthsCount: 1 };
    }

    if (filterMode === 'custom') {
      if (!dateRange?.start || !dateRange?.end) {
        return { isMultiMonth: false, monthsCount: 1 };
      }
      const startD = new Date(dateRange.start);
      const endD = new Date(dateRange.end);
      if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD < startD) {
        return { isMultiMonth: false, monthsCount: 1 };
      }
      const diffDays = Math.floor((endD.getTime() - startD.getTime()) / 86400000) + 1;
      const isMultiMonth = diffDays > 31;
      const [sy, sm, sd] = dateRange.start.split('-').map(Number);
      const [ey, em, ed] = dateRange.end.split('-').map(Number);
      const daysInEndMonth = new Date(ey, em, 0).getDate();
      const monthsCount =
        sd === 1 && ed === daysInEndMonth
          ? Math.max(1, (ey - sy) * 12 + (em - sm) + 1)
          : Math.max(1, diffDays / 30);
      return { isMultiMonth, monthsCount };
    }

    // وضع "الكل": نحسب المدى الفعلي لتواريخ المبيعات/الأوردرات
    const saleDates: string[] = [];
    for (const o of state.orders) {
      for (const it of o.items) {
        if (it.isSold) {
          const d = it.soldDate || o.closedDate || o.date;
          if (d) saleDates.push(d);
        }
      }
    }
    if (saleDates.length < 2) {
      return { isMultiMonth: false, monthsCount: 1 };
    }
    saleDates.sort();
    const minD = new Date(saleDates[0]);
    const maxD = new Date(saleDates[saleDates.length - 1]);
    if (isNaN(minD.getTime()) || isNaN(maxD.getTime())) {
      return { isMultiMonth: false, monthsCount: 1 };
    }
    const diffDays = Math.floor((maxD.getTime() - minD.getTime()) / 86400000) + 1;
    const isMultiMonth = diffDays > 31;
    const [sy, sm] = saleDates[0].split('-').map(Number);
    const [ey, em] = saleDates[saleDates.length - 1].split('-').map(Number);
    const monthsCount = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    return { isMultiMonth, monthsCount };
  }, [filterMode, dateRange, state.orders]);

  // =========================================================
  // تبويب رأس المال والأرباح
  // =========================================================
  const capitalReport = useMemo(() => {
    let totalProfit = 0;
    let closedOrdersCount = 0;
    let soldOrdersCount = 0;

    for (const order of state.orders) {
      const soldItemsAll = order.items.filter((it) => it.isSold);
      if (soldItemsAll.length === 0) continue;

      // تاريخ البيع الفعلي للأوردر: أحدث تاريخ بيع بين أصنافه المباعة
      const saleDates = soldItemsAll
        .map((it) => it.soldDate || order.closedDate || order.date)
        .filter(Boolean)
        .sort();
      const orderSaleDate = saleDates[saleDates.length - 1];

      if (!isInDateRange(orderSaleDate)) continue;

      soldOrdersCount += 1;
      totalProfit += orderRealizedProfit(order);

      const regularItems = order.items.filter((it) => it.name.trim() !== 'مصاريف');
      const soldRegularItems = regularItems.filter((it) => it.isSold);
      const isAllSold = regularItems.length > 0 && regularItems.every((it) => it.isSold);
      const hasRemainingDebt = soldRegularItems.some((it) => {
        const fullPrice = (it.soldPrice || 0) * (it.quantity || 1);
        const paidAmt = it.paidAmount !== undefined ? it.paidAmount : fullPrice;
        return fullPrice - paidAmt > 0.001;
      });

      if (isAllSold && !hasRemainingDebt) {
        closedOrdersCount += 1;
      }
    }

    const avgProfitPerOrder = closedOrdersCount > 0 ? totalProfit / closedOrdersCount : 0;
    const avgMonthlyProfit =
      periodMonthsInfo.isMultiMonth && periodMonthsInfo.monthsCount > 0
        ? totalProfit / periodMonthsInfo.monthsCount
        : 0;

    const advances: SheetRowItem[] = [];
    const settlements: SheetRowItem[] = [];
    const repayments: SheetRowItem[] = [];
    let advancesTotal = 0;
    let settlementsTotal = 0;
    let repaymentsTotal = 0;

    const sortedCapitalTxs = [...state.capitalTransactions].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );

    for (const tx of sortedCapitalTxs) {
      if (!isInDateRange(tx.date)) continue;
      if (tx.type === 'advance') {
        advancesTotal += tx.amount;
        advances.push({
          id: tx.id,
          description: tx.description || 'سلفة رأس مال',
          date: tx.date,
          amount: tx.amount,
        });
      } else if (tx.type === 'settlement') {
        settlementsTotal += tx.amount;
        settlements.push({
          id: tx.id,
          description: tx.description || 'تسوية رأس مال',
          date: tx.date,
          amount: tx.amount,
        });
      } else if (tx.type === 'repayment') {
        repaymentsTotal += tx.amount;
        repayments.push({
          id: tx.id,
          description: tx.description || 'سداد سلفة رأس مال',
          date: tx.date,
          amount: tx.amount,
        });
      }
    }

    return {
      totalProfit,
      closedOrdersCount,
      soldOrdersCount,
      avgProfitPerOrder,
      avgMonthlyProfit,
      advancesTotal,
      advances,
      settlementsTotal,
      settlements,
      repaymentsTotal,
      repayments,
    };
  }, [state.orders, state.capitalTransactions, isInDateRange, periodMonthsInfo]);

  // =========================================================
  // تبويب بوكيت
  // =========================================================
  const pocketReport = useMemo(() => {
    const withdrawals: SheetRowItem[] = [];
    const repayments: SheetRowItem[] = [];
    const catTotals: Record<string, number> = {};
    let withdrawnTotal = 0;
    let repaidTotal = 0;

    for (const tx of state.pocketTransactions) {
      if (tx.type === 'withdrawal') {
        if (isInDateRange(tx.date)) {
          withdrawnTotal += tx.amount;
          withdrawals.push({
            id: tx.id,
            description: stripBagDisplayPrefix(tx.description) || 'سلفة بوكيت',
            date: tx.date,
            amount: tx.amount,
          });
          const cat = tx.category || 'غير مصنف';
          catTotals[cat] = (catTotals[cat] || 0) + tx.amount;
        }

        const reps = tx.repayments || [];
        if (reps.length > 0) {
          for (const rep of reps) {
            if (isInDateRange(rep.date)) {
              repaidTotal += rep.amount;
              repayments.push({
                id: rep.id,
                description: rep.notes || rep.source || 'سداد سلفة',
                date: rep.date,
                amount: rep.amount,
                subLabel: `السلفة: ${stripBagDisplayPrefix(tx.description)}`,
              });
            }
          }
        } else if ((tx.repaidAmount || 0) > 0 && isInDateRange(tx.date)) {
          repaidTotal += tx.repaidAmount;
          repayments.push({
            id: `${tx.id}_rep`,
            description: 'سداد سلفة',
            date: tx.date,
            amount: tx.repaidAmount,
            subLabel: `السلفة: ${stripBagDisplayPrefix(tx.description)}`,
          });
        }
      } else if (tx.type === 'repayment' && isInDateRange(tx.date)) {
        repaidTotal += tx.amount;
        repayments.push({
          id: tx.id,
          description: stripBagDisplayPrefix(tx.description) || 'سداد بوكيت',
          date: tx.date,
          amount: tx.amount,
          subLabel: tx.notes ? `السلفة: ${stripBagDisplayPrefix(tx.notes)}` : undefined,
        });
      }
    }

    withdrawals.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    repayments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const topCategories = Object.entries(catTotals)
      .map(([name, total]) => ({
        name,
        total,
        pct: withdrawnTotal > 0 ? (total / withdrawnTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    return {
      withdrawnTotal,
      withdrawals,
      repaidTotal,
      repayments,
      topCategories,
    };
  }, [state.pocketTransactions, isInDateRange]);

  // =========================================================
  // تبويب القبض
  // =========================================================
  const salaryReport = useMemo(() => {
    let totalSpent = 0;
    const itemMap = new Map<string, { id: string; name: string; total: number }>();

    for (const exp of state.salaryExpenses) {
      if (!isInDateRange(exp.date)) continue;
      totalSpent += exp.amount || 0;

      const budgetItem = state.salaryBudget.find((b) => b.id === exp.itemId);
      const name = budgetItem?.name || exp.itemName || 'بند غير محدد';
      const key = exp.itemId || name;
      const existing = itemMap.get(key) || { id: key, name, total: 0 };
      existing.total += exp.amount || 0;
      itemMap.set(key, existing);
    }

    const topItems = Array.from(itemMap.values())
      .map((item) => ({
        ...item,
        pct: totalSpent > 0 ? (item.total / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalSpent,
      topItems,
    };
  }, [state.salaryExpenses, state.salaryBudget, isInDateRange]);

  const currency = state.settings.currency;

  return (
    <div className="w-full flex flex-col gap-[13px] pb-24 text-[#1F1A2E]">
      {/* 1. كارت اسم الصفحة */}
      <div className="card-header-purple flex items-center justify-between">
        <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
          التقارير المالية والتحليلات
        </span>

        <button
          type="button"
          onClick={() => setCurrentPage('entry')}
          className="btn-back-transparent"
          title="رجوع للرئيسية"
        >
          ➜
        </button>
      </div>

      {/* 2. شريط اختيار الفترة (مشترك لكل التبويبات) */}
      <div className="card-main p-3 space-y-2.5 text-xs">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#F7F4F8] border border-[#EBE6ED] text-[11px] font-bold">
          {[
            { id: 'month' as FilterMode, label: 'شهر' },
            { id: 'custom' as FilterMode, label: 'فترة' },
            { id: 'all' as FilterMode, label: 'الكل' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setFilterMode(mode.id)}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center ${
                filterMode === mode.id
                  ? 'bg-[#5F2967] text-white shadow-xs'
                  : 'text-[#666079] hover:text-[#1F1A2E]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {filterMode === 'month' && (
          <div className="flex items-center justify-between px-3 py-1 rounded-xl bg-[#F7F4F8] border border-[#EBE6ED]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-[#5F2967] hover:bg-white transition cursor-pointer"
              title="الشهر السابق"
            >
              ›
            </button>
            <span className="font-[800] text-[13px] text-[#211B24]">
              {ARABIC_MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrentMonthOrFuture}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-[#5F2967] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white transition cursor-pointer"
              title="الشهر التالي"
            >
              ‹
            </button>
          </div>
        )}

        {filterMode === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[#666079] mb-1">
                من تاريخ
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#EBE6ED] bg-white font-bold text-[11px] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#666079] mb-1">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#EBE6ED] bg-white font-bold text-[11px] outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. التبويبات الرئيسية الثلاثة */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white border border-[#EBE6ED] shadow-[0_2px_6px_rgba(43,35,64,0.06)]">
        {[
          { id: 'capital' as ReportTab, label: 'رأس المال' },
          { id: 'pocket' as ReportTab, label: 'بوكيت' },
          { id: 'salary' as ReportTab, label: 'القبض' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 rounded-xl text-[12px] font-[800] transition cursor-pointer text-center ${
              activeTab === tab.id
                ? 'bg-[#5F2967] text-white shadow-xs'
                : 'text-[#666079] hover:text-[#1F1A2E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* تبويب 1: رأس المال والأرباح                               */}
      {/* ========================================================= */}
      {activeTab === 'capital' && (
        <div className="space-y-[13px]">
          {/* كارت كبير: إجمالي الربح في الفترة (100% قبل تقسيم 70/20/10) */}
          <div className="card-main p-4 text-center space-y-2">
            <div className="text-[11px] font-[700] text-[#666079]">
              إجمالي الربح في الفترة (100% قبل التقسيم)
            </div>

            {capitalReport.soldOrdersCount === 0 && capitalReport.totalProfit === 0 ? (
              <p className="text-[12px] font-[700] text-[#666079] py-2">
                لا توجد بيانات في هذه الفترة
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span
                    className={`text-[30px] font-[900] leading-tight tabular-nums ${
                      capitalReport.totalProfit > 0
                        ? 'text-[#2F7F5F]'
                        : 'text-[#1F1A2E]'
                    }`}
                  >
                    {formatNum(capitalReport.totalProfit)}
                  </span>
                  <span className="text-[12px] font-[700] text-[#666079]">
                    {currency}
                  </span>
                </div>

                <div className="pt-2 border-t border-[#E4E1EC] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[#666079] font-[700]">
                  <span>
                    الأوردرات المقفولة:{' '}
                    <strong className="text-[#1F1A2E] tabular-nums">
                      {capitalReport.closedOrdersCount}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    متوسط الربح للأوردر:{' '}
                    <strong className="text-[#5F2967] tabular-nums">
                      {formatNum(capitalReport.avgProfitPerOrder)} {currency}
                    </strong>
                  </span>
                  {periodMonthsInfo.isMultiMonth && (
                    <>
                      <span>·</span>
                      <span>
                        متوسط الربح الشهري:{' '}
                        <strong className="text-[#2F7F5F] tabular-nums">
                          {formatNum(capitalReport.avgMonthlyProfit)} {currency}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 3 كروت صغيرة قابلة للضغط: السلف / التسويات / المسدد من السلف */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveSheet({
                  title: 'حركات السلف في الفترة',
                  total: capitalReport.advancesTotal,
                  accentColorClass: 'text-[#A23B5A]',
                  items: capitalReport.advances,
                })
              }
              className="card-main p-3 text-right cursor-pointer transition active:scale-95 hover:border-[#5F2967]/40"
            >
              <span className="text-[10px] font-[700] text-[#666079] block truncate">
                السلف
              </span>
              <div className="text-[15px] font-[900] text-[#A23B5A] tabular-nums mt-1 leading-tight">
                {formatNum(capitalReport.advancesTotal)}
              </div>
              <span className="text-[9px] text-[#666079] font-[600]">
                {currency}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveSheet({
                  title: 'حركات التسويات في الفترة',
                  total: capitalReport.settlementsTotal,
                  accentColorClass: 'text-[#B7791F]',
                  items: capitalReport.settlements,
                })
              }
              className="card-main p-3 text-right cursor-pointer transition active:scale-95 hover:border-[#5F2967]/40"
            >
              <span className="text-[10px] font-[700] text-[#666079] block truncate">
                التسويات
              </span>
              <div className="text-[15px] font-[900] text-[#B7791F] tabular-nums mt-1 leading-tight">
                {formatNum(capitalReport.settlementsTotal)}
              </div>
              <span className="text-[9px] text-[#666079] font-[600]">
                {currency}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveSheet({
                  title: 'المسدد من السلف في الفترة',
                  total: capitalReport.repaymentsTotal,
                  accentColorClass: 'text-[#2F7F5F]',
                  items: capitalReport.repayments,
                })
              }
              className="card-main p-3 text-right cursor-pointer transition active:scale-95 hover:border-[#5F2967]/40"
            >
              <span className="text-[10px] font-[700] text-[#666079] block truncate">
                المسدد من السلف
              </span>
              <div className="text-[15px] font-[900] text-[#2F7F5F] tabular-nums mt-1 leading-tight">
                {formatNum(capitalReport.repaymentsTotal)}
              </div>
              <span className="text-[9px] text-[#666079] font-[600]">
                {currency}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* تبويب 2: بوكيت                                            */}
      {/* ========================================================= */}
      {activeTab === 'pocket' && (
        <div className="space-y-[13px]">
          {/* 3 كروت: المسحوبة في الفترة، المسدد في الفترة، المتبقي على البوكيت */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveSheet({
                  title: 'سلف البوكيت المسحوبة في الفترة',
                  total: pocketReport.withdrawnTotal,
                  accentColorClass: 'text-[#A23B5A]',
                  items: pocketReport.withdrawals,
                })
              }
              className="card-main p-3 text-right cursor-pointer transition active:scale-95"
            >
              <span className="text-[10px] font-[700] text-[#666079] block truncate">
                المسحوب في الفترة
              </span>
              <div className="text-[15px] font-[900] text-[#A23B5A] tabular-nums mt-1 leading-tight">
                {formatNum(pocketReport.withdrawnTotal)}
              </div>
              <span className="text-[9px] text-[#666079] font-[600]">
                {currency}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveSheet({
                  title: 'المسدد للبوكيت في الفترة',
                  total: pocketReport.repaidTotal,
                  accentColorClass: 'text-[#2F7F5F]',
                  items: pocketReport.repayments,
                })
              }
              className="card-main p-3 text-right cursor-pointer transition active:scale-95"
            >
              <span className="text-[10px] font-[700] text-[#666079] block truncate">
                المسدد في الفترة
              </span>
              <div className="text-[15px] font-[900] text-[#2F7F5F] tabular-nums mt-1 leading-tight">
                {formatNum(pocketReport.repaidTotal)}
              </div>
              <span className="text-[9px] text-[#666079] font-[600]">
                {currency}
              </span>
            </button>

            <div className="card-main p-3 text-right">
              <span className="text-[10px] font-[700] text-[#666079] block truncate">
                المتبقي على البوكيت
              </span>
              <div className="text-[15px] font-[900] text-[#B7791F] tabular-nums mt-1 leading-tight">
                {formatNum(pocketOpenDebt)}
              </div>
              <span className="text-[9px] text-[#666079] font-[600]">
                {currency}
              </span>
            </div>
          </div>

          {/* أعلى تصنيفات السحب في الفترة (بحد أقصى 4 صفوف) */}
          <div className="card-main p-4 space-y-3 text-xs">
            <h3 className="text-[13px] font-[800] text-[#5F2967]">
              أعلى تصنيفات السحب في الفترة
            </h3>

            {pocketReport.topCategories.length === 0 ? (
              <p className="text-[11px] font-[600] text-[#666079] text-center py-2">
                لا توجد بيانات في هذه الفترة
              </p>
            ) : (
              <div className="space-y-2.5">
                {pocketReport.topCategories.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-[700] text-[#1F1A2E]">
                        {cat.name}
                      </span>
                      <span className="font-[800] tabular-nums text-[#5F2967]">
                        {formatNum(cat.total)} {currency}
                      </span>
                    </div>
                    <div className="w-full h-[5px] rounded-full bg-[#ECECF4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#5F2967]"
                        style={{ width: `${Math.min(100, Math.max(4, cat.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* تبويب 3: القبض                                            */}
      {/* ========================================================= */}
      {activeTab === 'salary' && (
        <div className="space-y-[13px]">
          {/* كارت إجمالي المنصرف في الفترة */}
          <div className="card-main p-4 text-center space-y-1">
            <span className="text-[11px] font-[700] text-[#666079] block">
              إجمالي المنصرف في الفترة
            </span>
            {salaryReport.totalSpent === 0 ? (
              <p className="text-[12px] font-[700] text-[#666079] py-1">
                لا توجد بيانات في هذه الفترة
              </p>
            ) : (
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-[28px] font-[900] text-[#A23B5A] tabular-nums leading-tight">
                  {formatNum(salaryReport.totalSpent)}
                </span>
                <span className="text-[12px] font-[700] text-[#666079]">
                  {currency}
                </span>
              </div>
            )}
          </div>

          {/* أعلى 5 بنود صرفاً بنفس شكل صفوف التصنيفات */}
          <div className="card-main p-4 space-y-3 text-xs">
            <h3 className="text-[13px] font-[800] text-[#5F2967]">
              أعلى بنود القبض صرفاً
            </h3>

            {salaryReport.topItems.length === 0 ? (
              <p className="text-[11px] font-[600] text-[#666079] text-center py-2">
                لا توجد بيانات في هذه الفترة
              </p>
            ) : (
              <div className="space-y-2.5">
                {salaryReport.topItems.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-[700] text-[#1F1A2E]">
                        {item.name}
                      </span>
                      <span className="font-[800] tabular-nums text-[#5F2967]">
                        {formatNum(item.total)} {currency}
                      </span>
                    </div>
                    <div className="w-full h-[5px] rounded-full bg-[#ECECF4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#5F2967]"
                        style={{ width: `${Math.min(100, Math.max(4, item.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* Bottom Sheet لقائمة الحركات / الدفعات                       */}
      {/* ========================================================= */}
      {activeSheet && (
        <div
          onClick={() => setActiveSheet(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-t-[24px] p-4 pb-6 max-h-[75vh] flex flex-col border-t border-[#E4E1EC] shadow-2xl text-xs"
          >
            <div className="w-10 h-1 rounded-full bg-[#D4D0E0] mx-auto mb-3 shrink-0" />

            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E4E1EC] shrink-0">
              <div className="min-w-0">
                <h3 className="text-[14px] font-[800] text-[#1F1A2E] truncate">
                  {activeSheet.title}
                </h3>
                <span className={`text-[11px] font-[800] tabular-nums ${activeSheet.accentColorClass}`}>
                  الإجمالي: {formatNum(activeSheet.total)} {currency}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1.5 cursor-pointer bg-transparent border-0 shrink-0"
                aria-label="إغلاق"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div className="overflow-y-auto pt-2.5 space-y-1.5 flex-1">
              {activeSheet.items.length === 0 ? (
                <p className="text-[11px] font-[600] text-[#666079] text-center py-6">
                  لا توجد بيانات في هذه الفترة
                </p>
              ) : (
                activeSheet.items.map((row) => (
                  <div
                    key={row.id}
                    className="p-2.5 rounded-xl bg-[#F7F4F8] border border-[#EBE6ED] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-[800] text-[#1F1A2E] truncate">
                        {row.description}
                      </div>
                      <div className="text-[10px] text-[#666079] font-[600] mt-0.5 truncate">
                        {formatArabicDate(row.date)}
                        {row.subLabel ? ` · ${row.subLabel}` : ''}
                      </div>
                    </div>
                    <div className={`text-[12px] font-[800] tabular-nums shrink-0 ${activeSheet.accentColorClass}`}>
                      {formatNum(row.amount)} {currency}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
