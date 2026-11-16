/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Icon3D } from '../components/icons3d/Icon3D';
import { SwipeRow } from '../components/SwipeRow';
import { CapitalTransaction, Order } from '../types';
import { formatArabicDate } from '../utils/dateFormat';
import { parseOrderNumber } from '../utils/orderNumber';
import { stripBagDisplayPrefix } from '../utils/arabicText';
import { useConfirmDelete } from '../components/ConfirmDeleteDialog';

type CapitalSectionTab = 'all' | 'orders' | 'advances' | 'settlements';
type OrdersSubFilter = 'all' | 'tied' | 'covered' | 'done' | 'profit';

const ORDERS_FILTER_OPTIONS: { id: OrdersSubFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'tied', label: 'محبوسة' },
  { id: 'covered', label: 'مغطاة' },
  { id: 'done', label: 'منتهية' },
  { id: 'profit', label: 'ربح' },
];

const ORANGE_TEXT_CLASS = 'text-[#B86500]';

const ShoppingCartIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

const ArrowUpIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);

const MinusIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);

const ArrowUpRightIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

const YellowLockIcon: React.FC = () => (
  <svg className="w-3 h-3 text-[#F2B01E] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Z" />
  </svg>
);

export const CapitalPage: React.FC = () => {
  const {
    state,
    baseCapital,
    liquidity,
    tiedInOrders,
    capitalAdvancesOpen,
    capitalGrowthTotal,
    capitalErosionSettled,
    addCapitalAdvance,
    addCapitalSettlement,
    addCapitalRepayment,
    updateCapitalEntry,
    deleteCapitalEntry,
    setCurrentPage,
    setFocusOrderId,
  } = useApp();

  const { confirmDelete } = useConfirmDelete();

  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementType, setMovementType] = useState<'advance' | 'settlement' | 'repayment'>('advance');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [activeTab, setActiveTab] = useState<CapitalSectionTab>('orders');
  const [ordersFilter, setOrdersFilter] = useState<OrdersSubFilter>('all');
  const [showOrdersFilterMenu, setShowOrdersFilterMenu] = useState(false);
  const ordersFilterRef = useRef<HTMLDivElement>(null);
  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [expandedAdvanceId, setExpandedAdvanceId] = useState<string | null>(null);
  const [inlineRepayAmount, setInlineRepayAmount] = useState('');
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const pressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showOrdersFilterMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (ordersFilterRef.current && !ordersFilterRef.current.contains(e.target as Node)) {
        setShowOrdersFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showOrdersFilterMenu]);

  const advanceIds = useMemo(
    () => new Set(state.capitalTransactions.filter((t) => t.type === 'advance').map((t) => t.id)),
    [state.capitalTransactions]
  );

  // ربط دفعات السداد بالسلف عن طريق debtId
  const repaymentsByAdvanceId = useMemo(() => {
    const map = new Map<string, CapitalTransaction[]>();
    for (const tx of state.capitalTransactions) {
      if (tx.type === 'repayment' && tx.debtId && advanceIds.has(tx.debtId)) {
        const list = map.get(tx.debtId) || [];
        list.push(tx);
        map.set(tx.debtId, list);
      }
    }
    return map;
  }, [state.capitalTransactions, advanceIds]);

  const advanceStatsMap = useMemo(() => {
    const map = new Map<string, { repaid: number; remaining: number; progressPercent: number; isRepaid: boolean }>();
    for (const tx of state.capitalTransactions) {
      if (tx.type !== 'advance') continue;
      const linked = repaymentsByAdvanceId.get(tx.id) || [];
      const repaid = linked.reduce((s, r) => s + (r.amount || 0), 0);
      const remaining = Math.max(0, tx.amount - repaid);
      const progressPercent = tx.amount > 0 ? Math.min(100, Math.max(0, (repaid / tx.amount) * 100)) : 0;
      map.set(tx.id, {
        repaid,
        remaining,
        progressPercent,
        isRepaid: remaining <= 0.001,
      });
    }
    return map;
  }, [state.capitalTransactions, repaymentsByAdvanceId]);

  const openAdvances = useMemo(() => {
    return state.capitalTransactions
      .filter((tx) => tx.type === 'advance')
      .map((tx) => ({
        tx,
        remaining: advanceStatsMap.get(tx.id)?.remaining ?? tx.amount,
      }))
      .filter((entry) => entry.remaining > 0.001);
  }, [state.capitalTransactions, advanceStatsMap]);

  const ordersById = useMemo(() => {
    const map = new Map<string, Order>();
    for (const ord of state.orders) {
      map.set(ord.id, ord);
    }
    return map;
  }, [state.orders]);

  const orderStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { cost: number; cash: number; recovered: number; tied: number; unsoldCount: number; progressPercent: number }
    >();
    for (const ord of state.orders) {
      const cost =
        ord.items.reduce((s, it) => s + (it.costPrice || 0) * (it.quantity || 1), 0) +
        (ord.additionalBagCost || 0);
      const cash = ord.items
        .filter((it) => it.isSold)
        .reduce((s, it) => {
          const paid = it.paidAmount !== undefined ? it.paidAmount : (it.soldPrice || 0) * (it.quantity || 1);
          return s + (paid || 0);
        }, 0);
      const recovered = Math.min(cost, cash);
      const tied = Math.max(0, cost - recovered);
      const unsoldCount = ord.items.filter((it) => !it.isSold && it.name.trim() !== 'مصاريف').length;
      const progressPercent =
        cost > 0 ? Math.min(100, Math.max(0, ((cost - tied) / cost) * 100)) : tied <= 0.0001 ? 100 : 0;
      map.set(ord.id, { cost, cash, recovered, tied, unsoldCount, progressPercent });
    }
    return map;
  }, [state.orders]);

  const resolveOrderForTx = React.useCallback(
    (tx: CapitalTransaction): Order | undefined => {
      if (tx.orderId) {
        const found = ordersById.get(tx.orderId);
        if (found) return found;
      }
      if (tx.description) {
        return state.orders.find((o) => tx.description.includes(o.code));
      }
      return undefined;
    },
    [ordersById, state.orders]
  );

  const sectionTransactions = useMemo(() => {
    const indexed = state.capitalTransactions
      .map((tx, idx) => ({ tx, idx }))
      .filter(({ tx }) => {
        // حركات السداد لا تظهر كروت مستقلة في أي قسم
        if (tx.type === 'repayment') return false;
        if (activeTab === 'orders') {
          if (tx.type !== 'order_creation' && tx.type !== 'growth') return false;
          if (ordersFilter === 'all') return true;
          if (ordersFilter === 'profit') return tx.type === 'growth';
          if (tx.type !== 'order_creation') return false;
          const resolvedOrder = resolveOrderForTx(tx);
          const orderStats = resolvedOrder ? orderStatsMap.get(resolvedOrder.id) : undefined;
          const tied = orderStats ? orderStats.tied : tx.amount;
          const unsoldCount = orderStats ? orderStats.unsoldCount : 0;
          const isCovered = tied <= 0.0001;
          const isFullyDone = isCovered && unsoldCount === 0;
          if (ordersFilter === 'tied') return !isCovered;
          if (ordersFilter === 'covered') return isCovered && !isFullyDone;
          if (ordersFilter === 'done') return isFullyDone;
          return true;
        }
        if (activeTab === 'advances') return tx.type === 'advance';
        if (activeTab === 'settlements') return tx.type === 'settlement';
        return true;
      });

    const compareChronoDesc = (a: { tx: CapitalTransaction; idx: number }, b: { tx: CapitalTransaction; idx: number }) => {
      const dateCmp = (b.tx.date || '').localeCompare(a.tx.date || '');
      if (dateCmp !== 0) return dateCmp;
      return a.idx - b.idx;
    };

    if (activeTab === 'advances') {
      indexed.sort((a, b) => {
        const aOpen = (advanceStatsMap.get(a.tx.id)?.remaining ?? a.tx.amount) > 0.001;
        const bOpen = (advanceStatsMap.get(b.tx.id)?.remaining ?? b.tx.amount) > 0.001;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return compareChronoDesc(a, b);
      });
    } else {
      indexed.sort(compareChronoDesc);
    }

    return indexed.map((entry) => entry.tx);
  }, [state.capitalTransactions, activeTab, ordersFilter, advanceStatsMap, orderStatsMap, resolveOrderForTx]);

  const selectedOpenAdvance = openAdvances.find((a) => a.tx.id === selectedAdvanceId) || null;
  const parsedMovementAmt = parseFloat(movementAmount) || 0;
  const isRepayOverRemaining =
    !editingTransactionId &&
    movementType === 'repayment' &&
    !!selectedOpenAdvance &&
    parsedMovementAmt > selectedOpenAdvance.remaining + 0.0001;

  const handleSelectMovementType = (type: 'advance' | 'settlement' | 'repayment') => {
    setMovementType(type);
    if (type === 'repayment' && !editingTransactionId) {
      if (openAdvances.length === 1) {
        setSelectedAdvanceId(openAdvances[0].tx.id);
        setMovementAmount(openAdvances[0].remaining.toString());
      } else {
        setSelectedAdvanceId('');
        setMovementAmount('');
      }
      setMovementDesc('');
    }
  };

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(movementAmount);
    if (!num || num <= 0) return;
    if (editingTransactionId) {
      updateCapitalEntry(editingTransactionId, {
        amount: num,
        description: movementDesc || (movementType === 'advance' ? 'سلفة رأس مال' : 'تسوية رأس مال'),
        type: movementType,
      });
      setEditingTransactionId(null);
    } else {
      if (movementType === 'advance') {
        addCapitalAdvance(num, movementDesc || 'سلفة رأس مال');
      } else if (movementType === 'settlement') {
        addCapitalSettlement(num, movementDesc || 'تسوية رأس مال');
      } else {
        if (!selectedOpenAdvance || num > selectedOpenAdvance.remaining + 0.0001) return;
        const advName =
          stripBagDisplayPrefix(selectedOpenAdvance.tx.description, 'advance') || 'سلفة رأس مال';
        addCapitalRepayment(
          num,
          advName,
          selectedOpenAdvance.tx.id,
          selectedOpenAdvance.tx.isForPocketCompensation ? 'تعويض بوكيت' : undefined
        );
      }
    }
    setSelectedAdvanceId('');
    setMovementAmount('');
    setMovementDesc('');
    setShowMovementForm(false);
  };

  const handleStartEdit = (tx: CapitalTransaction) => {
    setSwipeOpenKey(null);
    setEditingTransactionId(tx.id);
    setMovementType(tx.type === 'advance' ? 'advance' : 'settlement');
    setMovementAmount(tx.amount.toString());
    setMovementDesc(stripBagDisplayPrefix(tx.description, tx.type) || '');
    setSelectedAdvanceId('');
    setShowMovementForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setEditingTransactionId(null);
    setSelectedAdvanceId('');
    setMovementAmount('');
    setMovementDesc('');
    setShowMovementForm(false);
  };

  const handleToggleForm = () => {
    if (showMovementForm) {
      handleCancelForm();
    } else {
      setEditingTransactionId(null);
      setMovementType('advance');
      setSelectedAdvanceId('');
      setMovementAmount('');
      setMovementDesc('');
      setShowMovementForm(true);
    }
  };

  const handleToggleAdvancePanel = (tx: CapitalTransaction, remaining: number) => {
    if (expandedAdvanceId === tx.id) {
      setExpandedAdvanceId(null);
    } else {
      setExpandedAdvanceId(tx.id);
      setInlineRepayAmount(remaining > 0.001 ? remaining.toString() : '');
    }
  };

  const handleInlineRepaySubmit = (
    e: React.FormEvent,
    tx: CapitalTransaction,
    remaining: number,
    advName: string
  ) => {
    e.preventDefault();
    const num = parseFloat(inlineRepayAmount);
    if (!num || num <= 0 || num > remaining + 0.0001) return;
    addCapitalRepayment(
      num,
      advName,
      tx.id,
      tx.isForPocketCompensation ? 'تعويض بوكيت' : undefined
    );
    const nextRemaining = Math.max(0, remaining - num);
    setInlineRepayAmount(nextRemaining > 0.001 ? nextRemaining.toString() : '');
  };

  const navigateToOrder = (orderId?: string) => {
    if (!orderId) return;
    setFocusOrderId(orderId);
    setCurrentPage('orders');
  };

  const handleOrderCardTap = (txId: string, orderId?: string) => {
    if (!orderId) return;
    setPressedCardId(txId);
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = window.setTimeout(() => {
      setPressedCardId((prev) => (prev === txId ? null : prev));
    }, 150);

    const now = Date.now();
    if (lastTapRef.current.id === txId && now - lastTapRef.current.time < 350) {
      lastTapRef.current = { id: '', time: 0 };
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      setPressedCardId(null);
      navigateToOrder(orderId);
      return;
    }

    lastTapRef.current = { id: txId, time: now };
  };

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E]">
      {/* 1) كارت اسم الصفحة «خزنة رأس المال والسيولة»: ارتفاع 52px، حشو 15px، بنفسجي متدرج */}
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
            خزنة رأس المال والسيولة
          </span>
        </div>

        <button
          onClick={handleToggleForm}
          className="h-[32px] px-[14px] bg-white text-[#5F2967] rounded-full text-[13px] font-[700] inline-flex items-center gap-1 border-0 cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
        >
          <Icon3D name={showMovementForm ? 'close' : 'plus'} size={13} />
          <span>{editingTransactionId ? 'تعديل' : 'حركة'}</span>
        </button>
      </div>

      {/* 2) نموذج تسجيل الحركة (Collapsible Movement Form) */}
      {showMovementForm && (
        <form
          onSubmit={handleMovementSubmit}
          className="card-main p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#D4D0E0]">
            <span className="font-extrabold text-[#5F2967]">
              {editingTransactionId ? 'تعديل حركة رأس مال' : 'تسجيل حركة رأس مال'}
            </span>
            <button
              type="button"
              onClick={handleCancelForm}
              className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
            >
              <Icon3D name="close" size={16} />
            </button>
          </div>

          <div className={`grid ${editingTransactionId ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5`}>
            {(editingTransactionId
              ? [
                  { id: 'advance', label: 'سلفة' },
                  { id: 'settlement', label: 'تسوية (خصم)' },
                ]
              : [
                  { id: 'advance', label: 'سلفة' },
                  { id: 'settlement', label: 'تسوية (خصم)' },
                  { id: 'repayment', label: 'سداد سلفة' },
                ]
            ).map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => handleSelectMovementType(t.id as 'advance' | 'settlement' | 'repayment')}
                className={`py-2 rounded-[12px] text-xs font-bold text-center border transition cursor-pointer ${
                  movementType === t.id
                    ? 'bg-[#5F2967] text-white border-[#5F2967]'
                    : 'bg-white text-[#1F1A2E] border-[#D4D0E0]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!editingTransactionId && movementType === 'repayment' ? (
            openAdvances.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#F5F4F9] text-center text-[11px] font-bold text-[#666079]">
                لا توجد سلف مفتوحة للسداد حالياً
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-[#666079] mb-0.5 font-bold">
                    اختر السلفة *
                  </label>
                  <select
                    required
                    value={selectedAdvanceId}
                    onChange={(e) => {
                      const advId = e.target.value;
                      setSelectedAdvanceId(advId);
                      const found = openAdvances.find((a) => a.tx.id === advId);
                      setMovementAmount(found ? found.remaining.toString() : '');
                    }}
                    className="input-field w-full px-3 py-2 text-xs font-bold"
                  >
                    <option value="">-- اختر السلفة --</option>
                    {openAdvances.map(({ tx: adv, remaining }) => (
                      <option key={adv.id} value={adv.id}>
                        {stripBagDisplayPrefix(adv.description, 'advance') || 'سلفة رأس مال'} — المتبقي {remaining.toLocaleString('en-US')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-[#666079] mb-0.5 font-bold">
                    المبلغ المسدد ({state.settings.currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={selectedOpenAdvance?.remaining}
                    required
                    placeholder="0.00"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
                  />
                  {isRepayOverRemaining && selectedOpenAdvance && (
                    <p className="text-[10px] font-bold text-[#A23B5A] mt-1">
                      المبلغ لا يمكن أن يتجاوز المتبقي ({selectedOpenAdvance.remaining.toLocaleString('en-US')} {state.settings.currency})
                    </p>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#666079] mb-0.5 font-bold">
                  المبلغ ({state.settings.currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="input-field w-full px-3 py-2 text-sm font-extrabold text-center tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#666079] mb-0.5 font-bold">
                  البيان
                </label>
                <input
                  type="text"
                  placeholder="تفاصيل الحركة..."
                  value={movementDesc}
                  onChange={(e) => setMovementDesc(e.target.value)}
                  className="input-field w-full px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                !editingTransactionId &&
                movementType === 'repayment' &&
                (!selectedOpenAdvance || parsedMovementAmt <= 0 || isRepayOverRemaining)
              }
              className="btn-primary flex-1 py-2.5 text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editingTransactionId ? 'حفظ التعديلات' : 'تأكيد الحركة'}
            </button>
            {editingTransactionId && (
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-[14px] bg-[#EDEEF2] text-[#1F1A2E] font-bold text-xs cursor-pointer hover:bg-[#E4E1EC] transition"
              >
                إلغاء
              </button>
            )}
          </div>
        </form>
      )}

      {/* 3) الكارت الأخضر «السيولة المتاحة»: ارتفاع 92px، حشو 15px، أخضر تيل متدرج */}
      <div className="w-full h-[92px] card-hero-teal relative px-[15px] flex items-center justify-between">
        <div>
          <div className="text-[11px] font-[700] text-white/85 leading-none mb-[3px]">
            السيولة المتاحة
          </div>
          <div className="flex items-baseline gap-[8px]">
            <span className="text-[30px] font-[900] leading-[34px] text-white tabular-nums">
              {liquidity.toLocaleString('en-US')}
            </span>
            <span className="text-[13px] font-[700] text-white/85 leading-none">
              ج.م
            </span>
          </div>
        </div>

        <div className="bg-[rgba(255,255,255,0.18)] rounded-[14px] py-[7px] px-[12px] text-center shrink-0">
          <div className="text-[10px] font-[700] text-white/90 leading-tight">
            الأساسي
          </div>
          <div className="text-[14px] font-[800] text-white tabular-nums leading-tight mt-[1px]">
            {baseCapital.toLocaleString('en-US')}
          </div>
        </div>
      </div>

      {/* 4) شبكة الأربع كروت الصغيرة: عمودين متساويين، ارتفاع كل كارت 58px بالظبط */}
      <div className="grid grid-cols-2 gap-[13px]">
        {/* الصف الأول - اليمين: المحبوس بالأوردرات */}
        <div className="h-[58px] px-[12px] card-main flex items-center gap-[9px]">
          <div className="w-[28px] h-[28px] rounded-full bg-[#FBF1DE] text-[#B7791F] flex items-center justify-center shrink-0">
            <Icon3D name="orders" size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-[600] text-[#666079] leading-tight block truncate">
              المحبوس بالأوردرات
            </span>
            <span className={`text-[17px] font-[900] ${ORANGE_TEXT_CLASS} tabular-nums leading-tight block`}>
              {tiedInOrders.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* الصف الأول - الشمال: إجمالي النمو */}
        <div className="h-[58px] px-[12px] card-main flex items-center gap-[9px]">
          <div className="w-[28px] h-[28px] rounded-full bg-[#E3F2EA] text-[#2F7F5F] flex items-center justify-center shrink-0">
            <Icon3D name="profit" size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-[600] text-[#666079] leading-tight block truncate">
              إجمالي النمو
            </span>
            <span className="text-[17px] font-[900] text-[#258D40] tabular-nums leading-tight block">
              +{capitalGrowthTotal.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* الصف الثاني - اليمين: إجمالي التسويات */}
        <div className="h-[58px] px-[12px] card-main flex items-center gap-[9px]">
          <div className="w-[28px] h-[28px] rounded-full bg-[#FBF1DE] text-[#B7791F] flex items-center justify-center shrink-0">
            <Icon3D name="reconcile" size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-[600] text-[#666079] leading-tight block truncate">
              إجمالي التسويات
            </span>
            <span className="text-[17px] font-[900] text-[#D13026] tabular-nums leading-tight block">
              {capitalErosionSettled.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* الصف الثاني - الشمال: إجمالي السلف */}
        <div className="h-[58px] px-[12px] card-main flex items-center gap-[9px]">
          <div className="w-[28px] h-[28px] rounded-full bg-[#F8E6EC] text-[#A23B5A] flex items-center justify-center shrink-0">
            <Icon3D name="advance" size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-[600] text-[#666079] leading-tight block truncate">
              إجمالي السلف
            </span>
            <span className={`text-[17px] font-[900] ${ORANGE_TEXT_CLASS} tabular-nums leading-tight block`}>
              {capitalAdvancesOpen.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>

      {/* 5) أقسام الصفحة: الكل | الأوردرات | السلف | التسويات + زرار تصفية ثابت المكان */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_68px] gap-1.5 items-center">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'orders', label: 'الأوردرات' },
              { id: 'advances', label: 'السلف' },
              { id: 'settlements', label: 'التسويات' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowOrdersFilterMenu(false);
                  if (tab.id !== 'orders') {
                    setOrdersFilter('all');
                  }
                }}
                className={`h-[30px] px-0.5 rounded-[11px] text-[12px] font-[700] text-center transition cursor-pointer border whitespace-nowrap ${
                  isActive
                    ? 'bg-[#5F2967] text-white border-[#5F2967] shadow-xs'
                    : 'bg-white text-[#1F1A2E] border-[#E4E1EC] hover:bg-[#F8F7FB]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          <div ref={ordersFilterRef} className="relative h-[30px]">
            {activeTab === 'orders' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowOrdersFilterMenu((prev) => !prev)}
                  className={`w-full h-[30px] px-1 rounded-[11px] text-[11px] font-[700] flex items-center justify-center gap-0.5 whitespace-nowrap cursor-pointer border transition ${
                    ordersFilter !== 'all'
                      ? 'bg-[#F1E8F4] text-[#5F2967] border-[#5F2967]/40'
                      : 'bg-white text-[#5F2967] border-[#E4E1EC] hover:bg-[#F8F7FB]'
                  }`}
                >
                  <span className="truncate">
                    {ordersFilter === 'all'
                      ? 'تصفية'
                      : ORDERS_FILTER_OPTIONS.find((opt) => opt.id === ordersFilter)?.label || 'تصفية'}
                  </span>
                  <span className="text-[10px] leading-none shrink-0">▾</span>
                </button>

                {showOrdersFilterMenu && (
                  <div className="absolute left-0 top-[34px] z-30 w-[112px] bg-white rounded-[12px] border border-[#E4E1EC] shadow-[0_6px_18px_rgba(31,26,46,0.14)] py-1 overflow-hidden">
                    {ORDERS_FILTER_OPTIONS.map((opt) => {
                      const isSelected = ordersFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setOrdersFilter(opt.id);
                            setShowOrdersFilterMenu(false);
                          }}
                          className={`w-full px-3 py-1.5 text-right text-[11.5px] transition cursor-pointer block ${
                            isSelected
                              ? 'bg-[#F1E8F4] text-[#5F2967] font-[800]'
                              : 'text-[#1F1A2E] font-[600] hover:bg-[#F8F7FB]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {sectionTransactions.length === 0 ? (
          <div className="py-8 text-center text-[12px] font-[600] text-[#857D89]">
            {activeTab === 'orders' && ordersFilter !== 'all'
              ? 'لا توجد أوردرات بهذه الحالة'
              : 'لا توجد حركات'}
          </div>
        ) : (
          <div className="space-y-[7px]">
            {sectionTransactions.map((tx) => {
              const formattedDate = formatArabicDate(tx.date);
              const resolvedOrder =
                tx.type === 'order_creation' || tx.type === 'growth'
                  ? resolveOrderForTx(tx)
                  : undefined;

              // أ) كارت شراء الأوردر
              if (tx.type === 'order_creation') {
                const orderStats = resolvedOrder ? orderStatsMap.get(resolvedOrder.id) : undefined;
                const totalCost = orderStats ? orderStats.cost : tx.amount;
                const tied = orderStats ? orderStats.tied : tx.amount;
                const unsoldCount = orderStats ? orderStats.unsoldCount : 0;
                const progressPercent = orderStats ? orderStats.progressPercent : 0;
                const isCovered = tied <= 0.0001;
                const isFullyDone = isCovered && unsoldCount === 0;

                const parsedNum = resolvedOrder
                  ? parseOrderNumber(resolvedOrder.code)
                  : parseOrderNumber(tx.description || '');
                const title =
                  parsedNum > 0
                    ? `شراء أوردر رقم ${parsedNum}`
                    : stripBagDisplayPrefix(tx.description, 'order_creation') || 'شراء أوردر';

                const targetOrderId = resolvedOrder?.id || tx.orderId;
                const isPressed = pressedCardId === tx.id;

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleOrderCardTap(tx.id, targetOrderId)}
                    style={{ touchAction: 'manipulation' }}
                    className={`relative rounded-[11px] overflow-hidden border border-[#EBE6ED] shadow-[0_2px_6px_rgba(43,35,64,0.10)] select-none transition-colors duration-150 ${
                      isPressed ? 'bg-[#F1EFF6]' : 'bg-white'
                    } ${targetOrderId ? 'cursor-pointer' : ''}`}
                  >
                    <div className="h-[54px] px-[10px] flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        <div
                          style={{
                            background: 'linear-gradient(to bottom, #0174F3, #0065CF)',
                            boxShadow: '0 3px 8px rgba(0, 101, 207, 0.28)',
                          }}
                          className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center shrink-0 text-white"
                        >
                          <ShoppingCartIcon />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="text-[13.5px] font-[800] text-[#1F1A2E] truncate leading-[1.25] block">
                            {title}
                          </span>
                          <span className="text-[10.5px] font-[500] text-[#857D89] truncate leading-[1.2] block mt-[2px]">
                            {formattedDate} ·{' '}
                            <span className="text-[#0065CF] font-[700]">
                              التكلفة {totalCost.toLocaleString('en-US')}
                            </span>
                            {isCovered && unsoldCount > 0 ? ` · باقي ${unsoldCount} قطع` : ''}
                          </span>
                        </div>
                      </div>

                      {!isCovered ? (
                        <div className={`flex items-baseline gap-1 ${ORANGE_TEXT_CLASS} shrink-0`}>
                          <span className="text-[10px] font-[600]">محبوس</span>
                          <span dir="ltr" className="text-[13px] font-[900] tabular-nums">
                            -{tied.toLocaleString('en-US')}
                          </span>
                        </div>
                      ) : !isFullyDone ? (
                        <div className="px-2 py-[3px] rounded-[7px] bg-[#0065CF]/12 border border-[#0065CF] text-[#0065CF] text-[10px] font-[800] whitespace-nowrap shrink-0">
                          مغطى التكلفة
                        </div>
                      ) : (
                        <div className="px-2 py-[3px] rounded-[7px] bg-[#0065CF]/12 border border-[#0065CF] text-[#0065CF] text-[10px] font-[800] inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                          <span>مغطى ومنتهي</span>
                          <YellowLockIcon />
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-0 inset-x-0 h-[4px] bg-[#E5E3EC]">
                      <div
                        className="h-full bg-[#258D40] transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                );
              }

              // ب) كارت ربح الأوردر
              if (tx.type === 'growth') {
                const parsedNum = resolvedOrder
                  ? parseOrderNumber(resolvedOrder.code)
                  : parseOrderNumber(tx.description || '');
                const title =
                  parsedNum > 0
                    ? `ربح أوردر رقم ${parsedNum}`
                    : resolvedOrder
                    ? `ربح ${resolvedOrder.code}`
                    : (tx.description || '').replace(/^نمو رأس المال\s*(?:من\s*)?/u, '').trim() || 'ربح أوردر';

                const sign = tx.amount >= 0 ? '+' : '-';
                const targetOrderId = resolvedOrder?.id || tx.orderId;
                const isPressed = pressedCardId === tx.id;

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleOrderCardTap(tx.id, targetOrderId)}
                    style={{ touchAction: 'manipulation' }}
                    className={`relative rounded-[11px] overflow-hidden border border-[#EBE6ED] shadow-[0_2px_6px_rgba(43,35,64,0.10)] select-none transition-colors duration-150 ${
                      isPressed ? 'bg-[#F1EFF6]' : 'bg-white'
                    } ${targetOrderId ? 'cursor-pointer' : ''}`}
                  >
                    <div className="h-[54px] px-[10px] flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        <div
                          style={{
                            background: 'linear-gradient(to bottom, #34B852, #258D40)',
                            boxShadow: '0 3px 8px rgba(37, 141, 64, 0.28)',
                          }}
                          className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center shrink-0 text-white"
                        >
                          <ArrowUpIcon />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="text-[13.5px] font-[800] text-[#1F1A2E] truncate leading-[1.25] block">
                            {title}
                          </span>
                          <span className="text-[10.5px] font-[500] text-[#857D89] truncate leading-[1.2] block mt-[2px]">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      <div className="text-[#258D40] font-[800] tabular-nums text-[13px] whitespace-nowrap shrink-0 flex items-baseline gap-0.5">
                        <span>{sign}{Math.abs(tx.amount).toLocaleString('en-US')}</span>
                        <span className="text-[9.5px] font-[600] opacity-85">{state.settings.currency}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // ج) كارت التسوية
              if (tx.type === 'settlement') {
                const title = stripBagDisplayPrefix(tx.description, 'settlement') || 'تسوية رأس مال';
                const isManualSwipeable = !tx.orderId && !tx.itemId;

                const rowBody = (
                  <div className="h-[54px] px-[10px] bg-white flex items-center justify-between gap-2.5 select-none">
                    <div className="min-w-0 flex-1 flex items-center gap-2.5">
                      <div
                        style={{
                          background: 'linear-gradient(to bottom, #F3392D, #D13026)',
                          boxShadow: '0 3px 8px rgba(209, 48, 38, 0.28)',
                        }}
                        className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center shrink-0 text-white"
                      >
                        <MinusIcon />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-[13.5px] font-[800] text-[#1F1A2E] truncate leading-[1.25] block">
                          {title}
                        </span>
                        <span className="text-[10.5px] font-[500] text-[#857D89] truncate leading-[1.2] block mt-[2px]">
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    <div className="text-[#D13026] font-[800] tabular-nums text-[13px] whitespace-nowrap shrink-0 flex items-baseline gap-0.5">
                      <span>-{Math.abs(tx.amount).toLocaleString('en-US')}</span>
                      <span className="text-[9.5px] font-[600] opacity-85">{state.settings.currency}</span>
                    </div>
                  </div>
                );

                if (!isManualSwipeable) {
                  return (
                    <div
                      key={tx.id}
                      className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                    >
                      {rowBody}
                    </div>
                  );
                }

                return (
                  <div
                    key={tx.id}
                    className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                  >
                    <SwipeRow
                      rowKey={`capital_${tx.id}`}
                      swipeOpenKey={swipeOpenKey}
                      onOpenChange={setSwipeOpenKey}
                      onEdit={() => handleStartEdit(tx)}
                      onDelete={() =>
                        confirmDelete({
                          title: 'تأكيد الحذف',
                          message: `هل أنت متأكد من حذف حركة التسوية «${title}» بمبلغ ${tx.amount.toLocaleString('en-US')} ${state.settings.currency}؟`,
                          details: 'سيتم تحديث الأرصدة تلقائياً وعكس أثر الحركة فوراً.',
                          onConfirm: () => {
                            deleteCapitalEntry(tx.id);
                            setSwipeOpenKey(null);
                          },
                        })
                      }
                      className="rounded-[11px]"
                    >
                      {rowBody}
                    </SwipeRow>
                  </div>
                );
              }

              // د) كارت السلفة + قائمة السداد السفلية السوداء
              const advStats = advanceStatsMap.get(tx.id) || {
                repaid: 0,
                remaining: tx.amount,
                progressPercent: 0,
                isRepaid: tx.amount <= 0.001,
              };
              const linkedReps = repaymentsByAdvanceId.get(tx.id) || [];
              const advTitle = stripBagDisplayPrefix(tx.description, 'advance') || 'سلفة رأس مال';
              const isManualSwipeable = !tx.orderId && !tx.itemId;
              const isExpanded = expandedAdvanceId === tx.id;
              const parsedInlineAmt = parseFloat(inlineRepayAmount) || 0;
              const isInlineInvalid =
                parsedInlineAmt <= 0 || parsedInlineAmt > advStats.remaining + 0.0001;

              const advanceRow = (
                <div
                  onClick={() => handleToggleAdvancePanel(tx, advStats.remaining)}
                  className="relative h-[54px] px-[10px] bg-white flex items-center justify-between gap-2.5 cursor-pointer select-none"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2.5">
                    <div
                      style={{
                        background: 'linear-gradient(to bottom, #F3960A, #D07C08)',
                        boxShadow: '0 3px 8px rgba(208, 124, 8, 0.28)',
                      }}
                      className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center shrink-0 text-white"
                    >
                      <ArrowUpRightIcon />
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[13.5px] font-[800] text-[#1F1A2E] truncate leading-[1.25] block">
                        {advTitle}
                      </span>
                      <span className="text-[10.5px] font-[500] text-[#857D89] truncate leading-[1.2] block mt-[2px]">
                        {formattedDate} ·{' '}
                        <span className="text-[#5F2967] font-[700]">
                          السلفة {tx.amount.toLocaleString('en-US')}
                        </span>
                      </span>
                    </div>
                  </div>

                  {!advStats.isRepaid ? (
                    <div className={`flex items-baseline gap-1 ${ORANGE_TEXT_CLASS} shrink-0`}>
                      <span className="text-[10px] font-[600]">متبقي</span>
                      <span className="text-[13px] font-[900] tabular-nums">
                        {advStats.remaining.toLocaleString('en-US')}
                      </span>
                    </div>
                  ) : (
                    <div className={`px-2 py-[3px] rounded-[7px] bg-[#D07C08]/12 border border-[#D07C08] ${ORANGE_TEXT_CLASS} text-[10px] font-[800] inline-flex items-center gap-1 whitespace-nowrap shrink-0`}>
                      <span>مسددة</span>
                      <YellowLockIcon />
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 h-[4px] bg-[#E5E3EC]">
                    <div
                      className="h-full bg-[#258D40] transition-all duration-300"
                      style={{ width: `${advStats.progressPercent}%` }}
                    />
                  </div>
                </div>
              );

              const advancePanel = isExpanded && (
                <div className="bg-[#17151C] px-3 py-2.5 border-t border-white/10 space-y-2 text-xs">
                  {!advStats.isRepaid && (
                    <form
                      onSubmit={(e) => handleInlineRepaySubmit(e, tx, advStats.remaining, advTitle)}
                      className="flex items-center gap-2"
                    >
                      <span className="text-[11px] font-[700] text-white/80 shrink-0">
                        السداد
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        max={advStats.remaining}
                        required
                        value={inlineRepayAmount}
                        onChange={(e) => setInlineRepayAmount(e.target.value)}
                        className="flex-1 h-[30px] px-2.5 rounded-[8px] bg-white/10 border border-white/15 text-white text-xs font-extrabold text-center tabular-nums outline-none focus:border-[#5F2967]"
                      />
                      <button
                        type="submit"
                        disabled={isInlineInvalid}
                        className="h-[30px] px-3.5 rounded-[8px] bg-[#5F2967] hover:bg-[#4A1E52] text-white text-[11px] font-[800] cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        سداد
                      </button>
                    </form>
                  )}

                  <div className="space-y-1">
                    <div className="text-[10px] font-[700] text-white/60">
                      سجل السداد
                    </div>
                    {linkedReps.length === 0 ? (
                      <div className="text-[11px] text-white/50 py-0.5">
                        لا توجد دفعات
                      </div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {linkedReps.map((rep) => (
                          <div
                            key={rep.id}
                            className="py-1 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="text-[#9CA3AF]">
                              {formatArabicDate(rep.date)}
                            </span>
                            <span className="text-[#34B852] font-[800] tabular-nums">
                              +{rep.amount.toLocaleString('en-US')} {state.settings.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <div
                  key={tx.id}
                  className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                >
                  {isManualSwipeable ? (
                    <SwipeRow
                      rowKey={`capital_${tx.id}`}
                      swipeOpenKey={swipeOpenKey}
                      onOpenChange={setSwipeOpenKey}
                      onEdit={() => handleStartEdit(tx)}
                      onDelete={() =>
                        confirmDelete({
                          title: 'تأكيد الحذف',
                          message: `هل أنت متأكد من حذف حركة السلفة «${advTitle}» بمبلغ ${tx.amount.toLocaleString('en-US')} ${state.settings.currency}؟`,
                          details: 'سيتم تحديث الأرصدة تلقائياً وعكس أثر الحركة فوراً.',
                          onConfirm: () => {
                            deleteCapitalEntry(tx.id);
                            setSwipeOpenKey(null);
                            if (expandedAdvanceId === tx.id) setExpandedAdvanceId(null);
                          },
                        })
                      }
                    >
                      {advanceRow}
                    </SwipeRow>
                  ) : (
                    advanceRow
                  )}
                  {advancePanel}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
