/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BagExpense, BagExpenseRoute, BagFundSource, TreasurySourceType } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import { SwipeRow } from '../components/SwipeRow';
import { useConfirmDelete } from '../components/ConfirmDeleteDialog';
import {
  getBagDestinationAvailable,
  getBagTripOverages,
  isBagExpenseOverLimit,
} from '../utils/bagAvailability';

export const BagPage: React.FC = () => {
  const {
    state,
    pocketBalance,
    liquidity,
    updateBagSources,
    addBagExpense,
    updateBagExpense,
    deleteBagExpense,
    reconcileCurrentTrip,
    setCurrentPage,
  } = useApp();
  const { confirmDelete } = useConfirmDelete();
  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);

  const currentTrip = state.currentTrip;
  const sources =
    currentTrip.sources && currentTrip.sources.length > 0
      ? currentTrip.sources
      : [
          { id: 'src_cap', sourceName: 'رأس المال', amount: 0, treasuryType: 'capital' as TreasurySourceType },
          { id: 'src_sal', sourceName: 'القبض', amount: 0, treasuryType: 'salary' as TreasurySourceType },
        ];
  const expenses = currentTrip.expenses;

  // Accordions open/close state (closed by default)
  const [isOpenStart, setIsOpenStart] = useState(false);
  const [isOpenReconcile, setIsOpenReconcile] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isSalaryBreakdownOpen, setIsSalaryBreakdownOpen] = useState(false);

  // New source form state
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceAmount, setNewSourceAmount] = useState('');
  const [newSourceTreasury, setNewSourceTreasury] = useState<TreasurySourceType>('other');
  const [showAddSource, setShowAddSource] = useState(false);

  // Add / Edit expense state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseRoute, setExpenseRoute] = useState<BagExpenseRoute>('unclassified');
  const [expenseTargetId, setExpenseTargetId] = useState('');

  // Reconciliation state
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [reconcileResult, setReconcileResult] = useState<{ success: boolean; message: string } | null>(null);

  // Calculations
  const startingTotal = sources.reduce((sum, s) => sum + (s.amount || 0), 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const expectedRemaining = startingTotal - expensesTotal;

  const actualNum = parseFloat(actualCashInput) || 0;
  const isInputProvided = actualCashInput.trim() !== '';
  const difference = isInputProvided ? actualNum - expectedRemaining : 0;
  const isBalanced = isInputProvided && Math.abs(difference) < 0.001;

  const tripOverages = useMemo(
    () =>
      getBagTripOverages({
        expenses,
        salaryBudget: state.salaryBudget,
        pocketBalance,
        liquidity,
      }),
    [expenses, state.salaryBudget, pocketBalance, liquidity]
  );

  const overageKeys = useMemo(
    () => new Set(tripOverages.map((o) => o.key)),
    [tripOverages]
  );

  const currentRouteAvailable = useMemo(
    () =>
      getBagDestinationAvailable({
        route: expenseRoute,
        targetId: expenseTargetId || undefined,
        expenses,
        excludeExpenseId: editingExpenseId || undefined,
        salaryBudget: state.salaryBudget,
        pocketBalance,
        liquidity,
      }),
    [expenseRoute, expenseTargetId, expenses, editingExpenseId, state.salaryBudget, pocketBalance, liquidity]
  );

  const parsedExpenseAmount = parseFloat(expenseAmount) || 0;
  const expenseExcess =
    currentRouteAvailable !== null && parsedExpenseAmount > currentRouteAvailable + 0.001
      ? parsedExpenseAmount - currentRouteAvailable
      : 0;



  // Contributing treasuries summary
  const treasuryContributions = React.useMemo(() => {
    const map: Record<TreasurySourceType, { label: string; amount: number }> = {
      capital: { label: 'رأس المال', amount: 0 },
      salary: { label: 'القبض', amount: 0 },
      pocket: { label: 'بوكيت', amount: 0 },
      other: { label: 'عهدة أخرى', amount: 0 },
    };
    for (const s of sources) {
      const t =
        s.treasuryType ||
        (s.sourceName.includes('رأس المال')
          ? 'capital'
          : s.sourceName.includes('قبض')
          ? 'salary'
          : s.sourceName.includes('بوكيت')
          ? 'pocket'
          : 'other');
      if (map[t]) map[t].amount += s.amount || 0;
      else map.other.amount += s.amount || 0;
    }
    return Object.entries(map)
      .map(([type, data]) => ({ type: type as TreasurySourceType, ...data }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [sources]);

  // Projected Custody Return based on actual remaining
  const custodyReturnPreview = React.useMemo(() => {
    let rem = actualNum;
    return treasuryContributions.map((cont) => {
      const ret = Math.min(rem, cont.amount);
      rem = Math.max(0, rem - ret);
      return { ...cont, returned: ret };
    });
  }, [actualNum, treasuryContributions]);

  // Analysis breakdown from real recorded data (عرض فقط دون أي تغيير مالي)
  const salaryTripExpenses = useMemo(() => expenses.filter((e) => e.route === 'salary'), [expenses]);
  const totalSalaryTripExpenses = useMemo(() => salaryTripExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [salaryTripExpenses]);

  const totalCapitalAdvanceTrip = useMemo(
    () => expenses.filter((e) => e.route === 'capital_advance').reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  const totalCapitalSettlementTrip = useMemo(
    () => expenses.filter((e) => e.route === 'capital_settlement').reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  const totalPocketAdvanceTrip = useMemo(
    () => expenses.filter((e) => e.route === 'pocket_advance').reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  // Group salary expenses by budget item
  const salaryBudgetBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; amount: number }>();
    for (const exp of salaryTripExpenses) {
      const budgetItem = state.salaryBudget.find((b) => b.id === exp.targetId);
      const name = budgetItem ? budgetItem.name : (exp.targetName || exp.description || 'بند غير محدد');
      const key = exp.targetId || name;
      const current = map.get(key) || { name, amount: 0 };
      current.amount += exp.amount || 0;
      map.set(key, current);
    }
    return Array.from(map.values());
  }, [salaryTripExpenses, state.salaryBudget]);

  // Handlers
  const handleUpdateSourceAmount = (id: string, amount: number) => {
    const updated = sources.map((s) => (s.id === id ? { ...s, amount } : s));
    updateBagSources(updated);
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    const newSrc: BagFundSource = {
      id: 'src_' + Date.now(),
      sourceName: newSourceName.trim(),
      amount: parseFloat(newSourceAmount) || 0,
      treasuryType: newSourceTreasury,
    };
    updateBagSources([...sources, newSrc]);
    setNewSourceName('');
    setNewSourceAmount('');
    setShowAddSource(false);
  };

  const handleDeleteSource = (src: BagFundSource) => {
    if (sources.length <= 1) return;
    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف مصدر العهدة "${src.sourceName}"؟`,
      details: src.amount ? `المبلغ المسجل: ${src.amount.toLocaleString('en-US')} ${state.settings.currency}` : undefined,
      onConfirm: () => updateBagSources(sources.filter((s) => s.id !== src.id)),
    });
  };

  const openAddExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseAmount('');
    setExpenseDesc('');
    setExpenseRoute('unclassified');
    setExpenseTargetId('');
    setShowExpenseForm(true);
  };

  const openEditExpenseForm = (exp: BagExpense) => {
    setEditingExpenseId(exp.id);
    setExpenseAmount(exp.amount.toString());
    setExpenseDesc(exp.description);
    setExpenseRoute(exp.route);
    setExpenseTargetId(exp.targetId || '');
    setShowExpenseForm(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseAmount);
    if (!amt || amt <= 0 || !expenseDesc.trim()) return;

    if (editingExpenseId) {
      updateBagExpense(editingExpenseId, {
        amount: amt,
        description: expenseDesc.trim(),
        route: expenseRoute,
        targetId: expenseTargetId || undefined,
      });
    } else {
      addBagExpense({
        amount: amt,
        description: expenseDesc.trim(),
        route: expenseRoute,
        targetId: expenseTargetId || undefined,
      });
    }

    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpenseAmount('');
    setExpenseDesc('');
    setExpenseRoute('unclassified');
    setExpenseTargetId('');
  };

  const handleReconcile = () => {
    if (!isInputProvided) return;
    const res = reconcileCurrentTrip(actualNum);
    setReconcileResult(res);
    if (res.success) {
      setActualCashInput('');
    }
  };

  return (
    <div className="w-full space-y-[13px] text-[#1F1A2E]">
      {/* 1) كارت العنوان العلوي «سجل الشنطة»: بنفسجي متدرج، ارتفاع 52px، حشو 15px */}
      <div className="card-header-purple">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent"
            title="رجوع"
          >
            ➜
          </button>
          <div className="text-[18px] font-[800] text-white flex items-center gap-[8px] leading-none">
            <Icon3D name="bag" size={16} />
            <span>سجل الشنطة</span>
          </div>
        </div>

        <button
          onClick={openAddExpenseForm}
          className="btn-header-white-pill"
        >
          ＋ مصروف
        </button>
      </div>

      {reconcileResult && (
        <div
          className={`p-[10px] rounded-[16px] border text-[12px] font-[700] flex items-center gap-2 ${
            reconcileResult.success
              ? 'bg-[#E3F2EA] border-[#2F7F5F]/40 text-[#2F7F5F]'
              : 'bg-[#F8E6EC] border-[#A23B5A]/40 text-[#A23B5A]'
          }`}
        >
          <Icon3D name={reconcileResult.success ? 'shield_ok' : 'warning'} size={16} />
          <span>{reconcileResult.message}</span>
        </div>
      )}

      {/* 2) كارت «بداية الرحلة» الأخضر المدمج مع مصادر العهدة */}
      <div className="w-full rounded-[20px] overflow-hidden shadow-[0_6px_16px_rgba(46,138,130,0.28)]">
        <div
          onClick={() => setIsOpenStart(!isOpenStart)}
          style={{ background: 'linear-gradient(to left, #2DB5A8, #2E8A82)' }}
          className="w-full h-[70px] text-white relative px-[15px] flex items-center justify-between cursor-pointer select-none"
        >
          <div>
            <div className="text-[11px] text-white/85 font-[600] leading-none mb-[3px]">
              بداية الرحلة
            </div>
            <div className="flex items-baseline gap-[6px]">
              <span className="text-[24px] font-[900] leading-none text-white tabular-nums">
                {startingTotal.toLocaleString('en-US')}
              </span>
              <span className="text-[12px] text-white/85 font-[700] leading-none">
                ج.م
              </span>
            </div>
          </div>

          <div className="flex items-center gap-[10px]">
            <div className="w-[28px] h-[28px] rounded-full bg-[rgba(255,255,255,0.2)] flex items-center justify-center text-white shrink-0">
              <Icon3D name="shield_ok" size={14} />
            </div>
            <span className="text-white text-[12px] font-bold">
              {isOpenStart ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {isOpenStart && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#F5F4F9] px-[12px] pb-[12px] pt-[10px] border-t border-[#E4E1EC]"
          >
            <div className="grid grid-cols-2 gap-[8px]">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="bg-white rounded-[11px] border border-[#EBE6ED] p-2 shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-[800] truncate text-[#1F1A2E]">
                      {src.sourceName}
                    </span>
                    {sources.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSource(src);
                        }}
                        className="w-[20px] h-[20px] flex items-center justify-center text-[#A23B5A] p-0 hover:opacity-80 cursor-pointer shrink-0 border-0 bg-transparent"
                        title="حذف المصدر"
                      >
                        <Icon3D name="trash" size={12} />
                      </button>
                    )}
                  </div>

                  <small className="block text-[#666079] font-[500] text-[9px] mt-[1px]">
                    {src.treasuryType === 'capital' ? 'رأس مال' : src.treasuryType === 'salary' ? 'قبض' : 'عهدة أخرى'}
                  </small>

                  <div className="h-[26px] rounded-full bg-white border border-[#D4D0E0] flex items-center justify-center px-2 mt-[4px]">
                    <input
                      type="number"
                      step="any"
                      value={src.amount === 0 ? '' : src.amount}
                      placeholder="0"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateSourceAmount(src.id, parseFloat(e.target.value) || 0)}
                      className="w-full text-center bg-transparent outline-none font-[800] text-[12px] text-[#5F2967] tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddSource(true);
              }}
              className="bg-white border-[1.5px] border-dashed border-[#D4D0E0] text-[#5F2967] h-[30px] rounded-[11px] font-[800] text-[11px] mt-[8px] w-full cursor-pointer transition hover:opacity-95"
            >
              ＋ إضافة مصدر عهدة
            </button>
          </div>
        )}
      </div>

      {/* 3) كارتين «المصاريف» و«رصيد الشنطة المتبقي»: ارتفاع مصغر */}
      <div className="grid grid-cols-2 gap-[13px] items-start">
        {/* الكارت اليمين: المصاريف */}
        <div className="card-main py-[8px] px-[12px]">
          <div className="text-[11px] font-[600] text-[#666079] leading-none">
            المصاريف
          </div>
          <div className="flex items-baseline gap-[4px] mt-[2px]">
            <span className="text-[17px] font-[900] text-[#A23B5A] tabular-nums leading-tight">
              {expensesTotal.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-[#666079] font-normal">
              ج.م
            </span>
          </div>
        </div>

        {/* الكارت الشمال: رصيد الشنطة المتبقي */}
        <div className="card-main py-[8px] px-[12px]">
          <div className="text-[11px] font-[600] text-[#666079] leading-none">
            رصيد الشنطة المتبقي
          </div>
          <div className="flex items-baseline gap-[4px] mt-[2px]">
            <span className="text-[17px] font-[900] text-[#2F7F5F] tabular-nums leading-tight">
              {expectedRemaining.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-[#666079] font-normal">
              ج.م
            </span>
          </div>
        </div>
      </div>

      {/* 4) قائمة مصاريف الشنطة على الخلفية الرمادي ككروت منفصلة قابلة للسحب */}
      <div>
        {expenses.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-[#666079] rounded-[11px] border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]">
            لا توجد مصاريف مسجلة في الشنطة
          </div>
        ) : (
          <div className="space-y-[6px]">
            {expenses.map((exp) => {
              const isOverLimit = isBagExpenseOverLimit(exp, overageKeys);
              return (
              <div
                key={exp.id}
                className={`rounded-[11px] overflow-hidden border shadow-[0_2px_6px_rgba(43,35,64,0.10)] ${
                  isOverLimit
                    ? 'border-[#C0394F] bg-[#F8E6EC]/40'
                    : 'border-[#EBE6ED] bg-white'
                }`}
              >
                <SwipeRow
                  rowKey={`bag_exp_${exp.id}`}
                  swipeOpenKey={swipeOpenKey}
                  onOpenChange={setSwipeOpenKey}
                  onEdit={() => openEditExpenseForm(exp)}
                  onDelete={() =>
                    confirmDelete({
                      title: 'تأكيد الحذف',
                      message: `هل أنت متأكد من حذف مصروف "${exp.description}"؟`,
                      details: `المبلغ: ${exp.amount.toLocaleString('en-US')} ${state.settings.currency}`,
                      onConfirm: () => {
                        deleteBagExpense(exp.id);
                        setSwipeOpenKey(null);
                      },
                    })
                  }
                  className="rounded-[11px]"
                >
                  <div className={`py-[7px] px-[10px] flex items-center justify-between gap-2 ${isOverLimit ? 'bg-[#FFF5F7]' : 'bg-white'}`}>
                    <div className="flex items-center gap-[6px] min-w-0 flex-1">
                      <span className="text-[11px] font-[800] text-[#211B24] truncate leading-tight">
                        {exp.description}
                      </span>
                      {exp.route !== 'unclassified' && (
                        <span className="bg-[#F1E8F4] text-[#5F2967] rounded-md px-1.5 py-[1px] text-[9px] font-[700] shrink-0 leading-none">
                          {exp.route === 'order' ? 'أوردر' : exp.route === 'salary' ? 'قبض' : 'سلفة'}
                        </span>
                      )}
                      {isOverLimit && (
                        <span className="bg-[#F8E6EC] text-[#A23B5A] rounded-md px-1.5 py-[1px] text-[9px] font-[800] shrink-0 leading-none">
                          يتجاوز المتاح
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1 shrink-0 text-[#B23A48] tabular-nums">
                      <span className="text-[11px] font-[800] leading-none">
                        {exp.amount.toLocaleString('en-US')}
                      </span>
                      <span className="text-[8px] font-[600] opacity-75 leading-none">
                        {state.settings.currency}
                      </span>
                    </div>
                  </div>
                </SwipeRow>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6) قايمة «مطابقة النقدية ورد العهدة»: هيدر 50px، انحناء ثابت 20px، فتح فوري */}
      <div className="card-main overflow-hidden select-none">
        <div
          onClick={() => setIsOpenReconcile(!isOpenReconcile)}
          className="accordion-header justify-between"
        >
          <div className="flex items-center gap-[8px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[#F1E8F4] text-[#5F2967] flex items-center justify-center shrink-0 text-[15px]">
              ⚖️
            </div>
            <span className="text-[14px] font-[800] text-[#1F1A2E]">
              مطابقة النقدية ورد العهدة
            </span>
          </div>

          <div className="flex items-center gap-[8px]">
            <span
              className={`text-[13px] font-[800] tabular-nums ${
                difference === 0 ? 'text-[#5F2967]' : 'text-[#A23B5A]'
              }`}
            >
              فرق {Math.abs(difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[12px] text-[#666079]">
              {isOpenReconcile ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {isOpenReconcile && (
          <div className="bg-[#3C3F4A] px-[12px] pb-[12px] border-t border-white/15 pt-[10px] space-y-[8px]">
            <div className="grid grid-cols-2 gap-[8px]">
              <div className="bg-white rounded-[11px] p-2">
                <div className="text-[10px] text-[#666079] font-[600]">
                  المتبقي المتوقع
                </div>
                <div className="text-[12px] font-[800] mt-[3px] text-[#1F1A2E] tabular-nums">
                  {expectedRemaining.toLocaleString('en-US')} ج.م
                </div>
              </div>

              <div className="bg-white rounded-[11px] p-2">
                <div className="text-[10px] text-[#666079] font-[600]">
                  النقدية الفعلية المتبقية
                </div>
                <div className="h-[26px] rounded-full bg-white border border-[#D4D0E0] flex items-center justify-center px-2 mt-[3px]">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                    className="w-full text-center bg-transparent outline-none font-[800] text-[12px] text-[#1F1A2E] tabular-nums"
                  />
                </div>
              </div>

              <div
                className={`col-span-2 bg-white rounded-[11px] p-2 text-center font-[800] text-[11px] py-[6px] ${
                  isBalanced ? 'text-[#2F7F5F]' : 'text-[#A23B5A]'
                }`}
              >
                شرط الفرق = {difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {isInputProvided && (
              <div className="bg-white rounded-[11px] p-2 space-y-[4px]">
                <span className="font-[600] text-[10px] text-[#666079] block mb-1">
                  خطة رد العهدة النقدية للخزن:
                </span>
                {custodyReturnPreview.map((item) => (
                  <div key={item.type} className="flex items-center justify-between text-[11px]">
                    <span className="text-[#666079] font-[500]">
                      {item.label} (مساهمة: {item.amount.toLocaleString('en-US')})
                    </span>
                    <span className="font-[700] text-[#2F7F5F] tabular-nums">
                      المردود: {item.returned.toLocaleString('en-US')} ج.م
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleReconcile}
              disabled={!isBalanced}
              className={`w-full h-[34px] rounded-[11px] font-[800] text-[11px] flex items-center justify-center border-0 mt-[6px] ${
                isBalanced
                  ? 'bg-[#5F2967] text-white hover:bg-[#4A1E52] cursor-pointer active:scale-95'
                  : 'bg-white/20 text-white/75 cursor-not-allowed'
              }`}
            >
              تأكيد تقفيل ومطابقة العهدة
            </button>
          </div>
        )}
      </div>

      {/* 5. كارت تحليل: يعرض 4 كروت صغيرة متناسقة بناءً على الداتا الحقيقية */}
      <div className="card-main">
        <div
          onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
          className="min-h-[50px] px-[15px] py-[8px] flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-[10px]">
            <Icon3D name="pie" size={24} />
            <h3 className="font-[800] text-[14px] text-[#5F2967]">
              تحليل
            </h3>
          </div>
          <span className="text-[12px] text-[#666079]">
            {isAnalysisOpen ? '▲' : '▼'}
          </span>
        </div>

        {isAnalysisOpen && (
          <div className="px-[15px] pb-[15px] border-t border-[#E4E1EC] pt-[12px] space-y-[10px]">
            {/* 4 كروت صغيرة مربعة في شبكة 2x2 */}
            <div className="grid grid-cols-2 gap-[10px]">
              {/* 1. مصروفات من القبض (قابل للضغط) */}
              <div
                onClick={() => setIsSalaryBreakdownOpen(!isSalaryBreakdownOpen)}
                className={`p-3.5 rounded-[18px] border flex flex-col justify-between min-h-[96px] text-right cursor-pointer transition-all active:scale-95 select-none ${
                  isSalaryBreakdownOpen
                    ? 'bg-[#F1E8F4] border-[#5F2967] shadow-xs'
                    : 'bg-[#F8F8FC] border-[#E4E1EC] hover:border-[#5F2967]/50'
                }`}
              >
                <div>
                  <span className="text-[11px] text-[#666079] font-[700] block leading-tight">
                    مصروفات من القبض
                  </span>
                  <span className="text-[14px] font-[800] text-[#5F2967] tabular-nums block mt-1">
                    {totalSalaryTripExpenses.toLocaleString('en-US')} {state.settings.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#5F2967] font-bold pt-1.5 border-t border-[#E4E1EC]/60">
                  <span>{isSalaryBreakdownOpen ? 'إخفاء' : 'التفاصيل'}</span>
                  <span>{isSalaryBreakdownOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* 2. سلفة من رأس المال (للعرض فقط) */}
              <div className="p-3.5 rounded-[18px] bg-[#F8F8FC] border border-[#E4E1EC] flex flex-col justify-between min-h-[96px] text-right select-none">
                <div>
                  <span className="text-[11px] text-[#666079] font-[700] block leading-tight">
                    سلفة من رأس المال
                  </span>
                  <span className="text-[14px] font-[800] text-[#B7791F] tabular-nums block mt-1">
                    {totalCapitalAdvanceTrip.toLocaleString('en-US')} {state.settings.currency}
                  </span>
                </div>
                <div className="text-[10px] text-[#9A98B0] font-semibold pt-1.5 border-t border-[#E4E1EC]/60">
                  رأس المال
                </div>
              </div>

              {/* 3. تسوية من رأس المال (للعرض فقط) */}
              <div className="p-3.5 rounded-[18px] bg-[#F8F8FC] border border-[#E4E1EC] flex flex-col justify-between min-h-[96px] text-right select-none">
                <div>
                  <span className="text-[11px] text-[#666079] font-[700] block leading-tight">
                    تسوية من رأس المال
                  </span>
                  <span className="text-[14px] font-[800] text-[#A23B5A] tabular-nums block mt-1">
                    {totalCapitalSettlementTrip.toLocaleString('en-US')} {state.settings.currency}
                  </span>
                </div>
                <div className="text-[10px] text-[#9A98B0] font-semibold pt-1.5 border-t border-[#E4E1EC]/60">
                  تسوية
                </div>
              </div>

              {/* 4. سلفة بوكيت (للعرض فقط - الاسم الصحيح سلفة بوكيت) */}
              <div className="p-3.5 rounded-[18px] bg-[#F8F8FC] border border-[#E4E1EC] flex flex-col justify-between min-h-[96px] text-right select-none">
                <div>
                  <span className="text-[11px] text-[#666079] font-[700] block leading-tight">
                    سلفة بوكيت
                  </span>
                  <span className="text-[14px] font-[800] text-[#3D6A8F] tabular-nums block mt-1">
                    {totalPocketAdvanceTrip.toLocaleString('en-US')} {state.settings.currency}
                  </span>
                </div>
                <div className="text-[10px] text-[#9A98B0] font-semibold pt-1.5 border-t border-[#E4E1EC]/60">
                  خزنة بوكيت
                </div>
              </div>
            </div>

            {/* تفاصيل بنود القبض عند الضغط على الكارت الأول */}
            {isSalaryBreakdownOpen && (
              <div className="p-3.5 rounded-[18px] bg-[#F1E8F4]/60 border border-[#5F2967]/30 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#5F2967]/20 font-bold text-[#5F2967] text-[11px]">
                  <span>بند القبض</span>
                  <span>المبلغ المنصرف</span>
                </div>

                {salaryBudgetBreakdown.length === 0 ? (
                  <p className="text-[11px] text-[#666079] py-1 text-center">
                    لا توجد مصروفات محملة على بنود القبض في هذه العهدة.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {salaryBudgetBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] py-0.5"
                      >
                        <span className="text-[#1F1A2E] font-medium">
                          {item.name}
                        </span>
                        <strong className="text-[#5F2967] tabular-nums font-bold">
                          {item.amount.toLocaleString('en-US')} {state.settings.currency}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: إضافة مصدر عهدة */}
      {showAddSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <form
            onSubmit={handleAddSource}
            className="w-full max-w-xs bg-white rounded-[20px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967]">
                إضافة مصدر نقدية للعهدة
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSource(false)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                اسم المصدر *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: سلفة بوكيت، فلوس شخصية..."
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                الخزنة التابع لها
              </label>
              <select
                value={newSourceTreasury}
                onChange={(e) => setNewSourceTreasury(e.target.value as TreasurySourceType)}
                className="input-field w-full px-3 py-2 text-xs font-bold"
              >
                <option value="other">عهدة أخرى / شخصي</option>
                <option value="capital">رأس المال</option>
                <option value="salary">القبض</option>
                <option value="pocket">بوكيت</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                المبلغ المودع ({state.settings.currency}) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={newSourceAmount}
                onChange={(e) => setNewSourceAmount(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary flex-1 py-2 text-xs shadow-sm"
              >
                إضافة المصدر
              </button>
              <button
                type="button"
                onClick={() => setShowAddSource(false)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: إضافة أو تعديل مصروف الشنطة */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <form
            onSubmit={handleSaveExpense}
            className="w-full max-w-xs bg-white rounded-[20px] p-5 border border-[#D4D0E0] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-[14px] text-[#A23B5A]">
                {editingExpenseId ? 'تعديل مصروف الشنطة' : 'تسجيل مصروف من الشنطة'}
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                بيان المصروف *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: بنزين، شحن، كارتة، غداء..."
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                المبلغ ({state.settings.currency}) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
              />
              {expenseExcess > 0 && (
                <p className="text-[11px] font-bold text-[#D97706] mt-1 leading-snug">
                  يتجاوز المتاح بـ {expenseExcess.toLocaleString('en-US')} {state.settings.currency}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">
                توجيه وخصم المصروف (التصنيف)
              </label>
              <select
                value={expenseRoute}
                onChange={(e) => {
                  setExpenseRoute(e.target.value as BagExpenseRoute);
                  setExpenseTargetId('');
                }}
                className="input-field w-full px-3 py-2 text-xs font-bold"
              >
                <option value="unclassified">غير مصنف (مصروف عام للشنطة)</option>
                <option value="order">يُحمّل على أوردر محدد</option>
                <option value="salary">يُخصم من بند ميزانية القبض</option>
                <option value="pocket_advance">سلفة بوكيت (سحب شخصي)</option>
                <option value="capital_advance">سلفة رأس مال</option>
                <option value="capital_settlement">تسوية خسارة برأس المال</option>
              </select>
            </div>

            {expenseRoute === 'order' && (
              <div>
                <label className="block font-bold text-[#1F1A2E] mb-1">
                  اختر الأوردر:
                </label>
                <select
                  required
                  value={expenseTargetId}
                  onChange={(e) => setExpenseTargetId(e.target.value)}
                  className="input-field w-full px-3 py-2 text-xs"
                >
                  <option value="">-- اختر الأوردر المرتبط --</option>
                  {state.orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {expenseRoute === 'salary' && (
              <div>
                <label className="block font-bold text-[#1F1A2E] mb-1">
                  اختر بند القبض للخصم منه:
                </label>
                <select
                  required
                  value={expenseTargetId}
                  onChange={(e) => setExpenseTargetId(e.target.value)}
                  className="input-field w-full px-3 py-2 text-xs"
                >
                  <option value="">-- اختر بند الميزانية --</option>
                  {state.salaryBudget.map((b) => {
                    const avail =
                      getBagDestinationAvailable({
                        route: 'salary',
                        targetId: b.id,
                        expenses,
                        excludeExpenseId: editingExpenseId || undefined,
                        salaryBudget: state.salaryBudget,
                        pocketBalance,
                        liquidity,
                      }) ?? b.budgeted - b.spent;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} (المتبقي: {avail.toLocaleString('en-US')})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary flex-1 py-2.5 text-xs shadow-sm"
              >
                {editingExpenseId ? 'حفظ التعديل' : 'تسجيل المصروف'}
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="btn-secondary px-4 py-2.5 text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
