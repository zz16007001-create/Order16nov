/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Order, OrderItem } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import { SaleForm } from '../components/SaleForm';
import { SwipeRow } from '../components/SwipeRow';
import { formatArabicDate } from '../utils/dateFormat';
import { parseOrderNumber, getNextOrderNumber } from '../utils/orderNumber';
import { useConfirmDelete } from '../components/ConfirmDeleteDialog';

const sortOrdersDesc = (orders: Order[]): Order[] => {
  return [...orders].sort((a, b) => {
    const numA = parseOrderNumber(a.code);
    const numB = parseOrderNumber(b.code);
    if (numA !== numB) {
      return numB - numA; // الأكبر رقماً في الأعلى، والكود بدون رقم في النهاية
    }
    return b.id.localeCompare(a.id);
  });
};

export const OrdersPage: React.FC = () => {
  const {
    state,
    deleteOrder,
    deleteOrderItem,
    addOrderItemToOrder,
    toggleOrderFinished,
    updateOrderItem,
    updateOrderInfo,
    returnOrderItem,
    settleOrderItem,
    getOrderProfitImpact,
    createNewOrder,
    customers,
    liquidity,
    setCurrentPage,
    focusOrderId,
    setFocusOrderId,
  } = useApp();
  const { confirmDelete } = useConfirmDelete();

  // الوضع الافتراضي: كل كروت الأوردرات مطوية عند كل دخول للصفحة
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // السحب (Swipe): كارت مسحوب واحد فقط في الصفحة كلها
  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);

  // Collapsible inline create order form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formOrderCode, setFormOrderCode] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([
    { name: '', quantity: 1, costPrice: 0 },
  ]);

  // نافذة البيع: كل حالة النموذج جوّه SaleForm
  const [sellingItemInfo, setSellingItemInfo] = useState<{
    orderId: string;
    item: OrderItem;
  } | null>(null);

  // إظهار/إخفاء أزرار التسوية لكل أوردر
  const [showSettlementOrders, setShowSettlementOrders] = useState<Record<string, boolean>>({});

  const toggleShowSettlement = (orderId: string) => {
    setShowSettlementOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const openSaleModal = (orderId: string, item: OrderItem) => {
    setSellingItemInfo({ orderId, item });
  };

  // Edit item modal state
  const [editingItemInfo, setEditingItemInfo] = useState<{
    orderId: string;
    item: OrderItem;
  } | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCost, setEditItemCost] = useState('');
  const [editItemSoldPrice, setEditItemSoldPrice] = useState('');

  // Return item confirmation dialog
  const [returningItemInfo, setReturningItemInfo] = useState<{
    orderId: string;
    item: OrderItem;
    orderCode: string;
  } | null>(null);

  // مبلغ الاسترداد للعميل عند الارتجاع
  const [returnRefundInput, setReturnRefundInput] = useState('');

  // Settle item confirmation dialog
  const [settlingItemInfo, setSettlingItemInfo] = useState<{
    orderId: string;
    item: OrderItem;
    orderCode: string;
  } | null>(null);

  // Order status filter: all / open / finished
  const [orderFilter, setOrderFilter] = useState<'all' | 'open' | 'finished'>('all');

  useEffect(() => {
    if (!focusOrderId) return;
    const target = state.orders.find((o) => o.id === focusOrderId);
    if (!target) {
      setFocusOrderId(null);
      return;
    }
    const hiddenByFilter =
      (orderFilter === 'open' && !!target.isFinished) ||
      (orderFilter === 'finished' && !target.isFinished);
    if (hiddenByFilter) {
      setOrderFilter('all');
      return;
    }
    setExpandedOrderId(focusOrderId);
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`order-card-${focusOrderId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setFocusOrderId(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusOrderId, state.orders, orderFilter, setFocusOrderId]);

  // Add item modal state (clean, empty by default)
  const [addingItemOrderId, setAddingItemOrderId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemCost, setNewItemCost] = useState('');

  const toggleExpand = (id: string) => {
    setSwipeOpenKey(null);
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  // Edit order info bottom sheet state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderCode, setEditOrderCode] = useState('');
  const [editOrderNotes, setEditOrderNotes] = useState('');

  const openEditOrderModal = (order: Order) => {
    setSwipeOpenKey(null);
    setEditingOrder(order);
    setEditOrderCode(order.code);
    setEditOrderNotes(order.notes || '');
  };

  const trimmedEditOrderCode = editOrderCode.trim();
  const isOrderCodeChanged = editingOrder ? trimmedEditOrderCode !== editingOrder.code.trim() : false;
  const isOrderCodeEmpty = editingOrder ? trimmedEditOrderCode === '' : false;
  const isDuplicateOrderCode = Boolean(
    editingOrder &&
      isOrderCodeChanged &&
      !isOrderCodeEmpty &&
      state.orders.some((o) => o.id !== editingOrder.id && o.code.trim() === trimmedEditOrderCode)
  );

  const handleSaveEditOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || isOrderCodeEmpty || isDuplicateOrderCode) return;
    updateOrderInfo(editingOrder.id, {
      ...(isOrderCodeChanged ? { code: trimmedEditOrderCode } : {}),
      notes: editOrderNotes,
    });
    setEditingOrder(null);
    setSwipeOpenKey(null);
  };

  const requestDeleteItem = (orderId: string, item: OrderItem, orderCode: string) => {
    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف الصنف "${item.name}" فقط من ${orderCode} دون حذف الأوردر أو الأصناف الأخرى؟`,
      details: (
        <div className="p-3 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4] space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span>الكمية:</span>
            <strong className="font-bold tabular-nums">
              {item.quantity} قطعة{item.size ? ` (مقاس ${item.size})` : ''}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>سعر التكلفة:</span>
            <strong className="text-[#E2574C] font-black tabular-nums">
              {item.costPrice} {state.settings.currency}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>حالة البيع:</span>
            <strong className="font-bold">
              {item.isSold ? 'تم بيعه سابقاً (سيتم عكس أثره المالي بأمان)' : 'متاح في المخزون'}
            </strong>
          </div>
        </div>
      ),
      onConfirm: () => deleteOrderItem(orderId, item.id),
    });
  };

  const handleSaveAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingItemOrderId || !newItemName.trim()) return;
    const qty = parseInt(newItemQuantity) || 1;
    const cost = parseFloat(newItemCost) || 0;
    addOrderItemToOrder(addingItemOrderId, {
      name: newItemName.trim(),
      quantity: qty,
      costPrice: cost,
    });
    setAddingItemOrderId(null);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemCost('');
  };



  const openEditModal = (orderId: string, item: OrderItem) => {
    setEditingItemInfo({ orderId, item });
    setEditItemName(item.name);
    setEditItemCost(item.costPrice.toString());
    setEditItemSoldPrice(item.soldPrice !== undefined ? item.soldPrice.toString() : '');
  };

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemInfo || !editItemName.trim()) return;
    const cost = parseFloat(editItemCost) || 0;
    const updates: Partial<OrderItem> = {
      name: editItemName.trim(),
      costPrice: cost,
    };
    if (editingItemInfo.item.isSold && editItemSoldPrice) {
      updates.soldPrice = parseFloat(editItemSoldPrice) || 0;
    }
    updateOrderItem(editingItemInfo.orderId, editingItemInfo.item.id, updates);
    setEditingItemInfo(null);
  };

  const handleConfirmReturn = () => {
    if (!returningItemInfo) return;
    const refund = parseFloat(returnRefundInput);
    returnOrderItem(
      returningItemInfo.orderId,
      returningItemInfo.item.id,
      returningItemInfo.item.customerId && refund > 0 ? refund : undefined
    );
    setReturnRefundInput('');
    setReturningItemInfo(null);
  };

  const handleConfirmSettle = () => {
    if (!settlingItemInfo) return;
    settleOrderItem(settlingItemInfo.orderId, settlingItemInfo.item.id);
    setSettlingItemInfo(null);
  };

  const requestDeleteOrder = (order: Order) => {
    const impact = getOrderProfitImpact(order.id);
    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف ${order.code}؟ سيتم حذف الأوردر وإلغاء كل الأثر المالي المرتبط به من جميع الخزن:`,
      details: (
        <div className="p-3 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4] space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span>استرجاع نمو رأس المال:</span>
            <strong className="text-[#5F2967] tabular-nums font-bold">
              -{impact.capitalGrowth.toLocaleString('en-US')} {state.settings.currency}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>استرجاع دعم بوكيت:</span>
            <strong className="text-[#5F2967] tabular-nums font-bold">
              -{impact.pocketSupport.toLocaleString('en-US')} {state.settings.currency}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>استرجاع أثر الصدقة:</span>
            <strong className="text-[#5F2967] tabular-nums font-bold">
              -{impact.charityInflow.toLocaleString('en-US')} {state.settings.currency}
            </strong>
          </div>
        </div>
      ),
      onConfirm: () => deleteOrder(order.id),
    });
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = formItems.filter((it) => it.name.trim() !== '' && it.costPrice > 0);
    if (valid.length === 0) return;

    createNewOrder(formOrderCode.trim() || '', valid, formNotes || undefined);
    setFormOrderCode('');
    setFormNotes('');
    setFormItems([{ name: '', quantity: 1, costPrice: 0 }]);
    setShowCreateForm(false);
  };

  const displayedOrders = sortOrdersDesc(
    state.orders.filter((order) => {
      if (orderFilter === 'open') return !order.isFinished;
      if (orderFilter === 'finished') return !!order.isFinished;
      return true;
    })
  );

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
          سجل الأوردرات
        </span>

        <div className="flex items-center gap-[8px]">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="h-[26px] px-[10px] rounded-full bg-[#2F7F5F] hover:bg-[#25664C] text-white text-[12px] font-[700] flex items-center gap-1 flex-none shadow-sm cursor-pointer"
          >
            <span className="text-[12px] leading-none">{showCreateForm ? '✕' : '＋'}</span>
            <span>أوردر جديد</span>
          </button>

          <button
            onClick={() => setCurrentPage('entry')}
            className="btn-back-transparent"
            title="رجوع للرئيسية"
          >
            ➜
          </button>
        </div>
      </div>

      {/* 2. فلترة الأوردرات: كل الأوردرات / الأوردرات المفتوحة / الأوردرات المنتهية */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-[#D4D0E0] shadow-2xs text-[11px] font-bold">
        {[
          { id: 'all', label: `كل الأوردرات (${state.orders.length})` },
          { id: 'open', label: `الأوردرات المفتوحة (${state.orders.filter((o) => !o.isFinished).length})` },
          { id: 'finished', label: `الأوردرات المنتهية (${state.orders.filter((o) => !!o.isFinished).length})` },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setOrderFilter(pill.id as any)}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center whitespace-nowrap ${
              orderFilter === pill.id
                ? 'bg-[#5F2967] text-white shadow-xs'
                : 'text-[#666079] hover:text-[#1F1A2E]'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Collapsible Create Order Section */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateOrderSubmit}
          className="card-main p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#D4D0E0]">
            <span className="font-extrabold text-[#5F2967]">
              إنشاء أوردر تسلسلي جديد
            </span>
            <span className="text-[10px] text-[#2F7F5F] font-bold bg-[#E3F2EA] px-2 py-0.5 rounded-full tabular-nums">
              السيولة: {liquidity.toLocaleString('en-US')} {state.settings.currency}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder={`أوردر رقم ${getNextOrderNumber(state.orders, state.orderCounter)}`}
              value={formOrderCode}
              onChange={(e) => setFormOrderCode(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] font-bold outline-none focus:border-[#5F2967]"
            />
            <input
              type="text"
              placeholder="ملاحظات اختيارية..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
            />
          </div>

          <div className="space-y-1.5">
            {formItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  placeholder="اسم الصنف / الموديل..."
                  value={item.name}
                  onChange={(e) => {
                    const c = [...formItems];
                    c[idx].name = e.target.value;
                    setFormItems(c);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] text-xs font-bold outline-none"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="العدد"
                  value={item.quantity}
                  onChange={(e) => {
                    const c = [...formItems];
                    c[idx].quantity = parseInt(e.target.value) || 1;
                    setFormItems(c);
                  }}
                  className="w-16 px-1.5 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] text-center font-bold outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="سعر التكلفة"
                  value={item.costPrice || ''}
                  onChange={(e) => {
                    const c = [...formItems];
                    c[idx].costPrice = parseFloat(e.target.value) || 0;
                    setFormItems(c);
                  }}
                  className="w-24 px-2 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] text-center font-black text-[#5F2967] outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormItems([...formItems, { name: '', quantity: 1, costPrice: 0 }])}
              className="px-3 py-1.5 rounded-xl bg-purple-50 text-[#5F2967] font-bold text-xs transition cursor-pointer"
            >
              + إضافة صنف
            </button>
            <button
              type="submit"
              className="flex-1 py-1.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs transition cursor-pointer shadow-xs"
            >
              حفظ الأوردر
            </button>
          </div>
        </form>
      )}

      {/* كارت عنوان ثابت للأعمدة (أخضر/تيل) */}
      {displayedOrders.length > 0 && (
        <div
          className="sticky top-[54px] z-20 w-full h-[30px] rounded-[11px] order-grid px-[10px] select-none text-white text-[10px] font-[700] border border-transparent shadow-[0_4px_10px_rgba(46,138,130,0.25)]"
          style={{ background: 'linear-gradient(to left, #2DB5A8, #2E8A82)' }}
        >
          {/* 1 & 2. البيان (يمتد على عمودي مربع الرقم + الاسم) ومحاذاته للمنتصف */}
          <div className="col-span-2 text-center truncate">
            البيان
          </div>

          {/* 3. التكلفة مع فاصل رأسي */}
          <div className="h-[14px] flex items-center justify-center border-s border-white/45">
            <span>التكلفة</span>
          </div>

          {/* 4. المبيعات مع فاصل رأسي */}
          <div className="h-[14px] flex items-center justify-center border-s border-white/45">
            <span>المبيعات</span>
          </div>

          {/* 5. الربح مع فاصل رأسي */}
          <div className="h-[14px] flex items-center justify-center border-s border-white/45">
            <span>الربح</span>
          </div>

          {/* 6. مساحة السهم الفارغة 12px */}
          <div className="w-[12px] shrink-0"></div>
        </div>
      )}

      {/* Orders Cards List */}
      {displayedOrders.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-[#ECECF4] rounded-3xl bg-white p-6">
          <p className="text-xs text-[#9A98B0]">
            {orderFilter === 'finished'
              ? 'لا توجد أوردرات منتهية حالياً'
              : orderFilter === 'open'
              ? 'لا توجد أوردرات مفتوحة حالياً'
              : 'لا توجد أوردرات مسجلة حالياً'}
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-[7px]">
          {displayedOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const itemsCost = order.items.reduce((s, it) => s + it.costPrice * (it.quantity || 1), 0);
            const totalCost = itemsCost + (order.additionalBagCost || 0);
            const regularItems = order.items.filter((it) => it.name.trim() !== 'مصاريف');
            const soldItems = regularItems.filter((it) => it.isSold);
            const totalCollected = order.items.filter((it) => it.isSold).reduce((s, it) => {
              const fullPrice = (it.soldPrice || 0) * (it.quantity || 1);
              return s + (it.paidAmount !== undefined ? it.paidAmount : fullPrice);
            }, 0);
            const netProfit = totalCollected - totalCost;
            const isAllSold = regularItems.length > 0 && regularItems.every((it) => it.isSold);
            const hasRemainingDebt = soldItems.some((it) => {
              const fullPrice = (it.soldPrice || 0) * (it.quantity || 1);
              const paidAmt = it.paidAmount !== undefined ? it.paidAmount : fullPrice;
              return fullPrice - paidAmt > 0.001;
            });

            let status: 'مقفول' | 'خسارة' | 'مفتوح' | 'بانتظار التحصيل' | 'منتهي';
            if (order.isFinished) {
              status = 'منتهي';
            } else if (isAllSold) {
              if (hasRemainingDebt) {
                status = 'بانتظار التحصيل';
              } else {
                status = netProfit >= 0 ? 'مقفول' : 'خسارة';
              }
            } else {
              status = 'مفتوح';
            }

            // لون مربع الرقم حسب الأولوية:
            // a. order.isFinished أو (كل الأصناف اتباعت وبدون دين متبقي) → أسود #111111
            // b. كل الأصناف اتباعت وفيه دين متبقي → برتقالي #C99A2E
            // c. فيه أصناف لسه ما اتباعتش و netProfit > 0 → أخضر #2E8C69
            // d. غير كده (مفتوح) → بنفسجي #8A4B90
            const numberBoxBg =
              order.isFinished || (isAllSold && !hasRemainingDebt)
                ? '#111111'
                : isAllSold && hasRemainingDebt
                ? '#C99A2E'
                : !isAllSold && netProfit > 0
                ? '#2E8C69'
                : '#8A4B90';

            const parsedNum = parseOrderNumber(order.code);
            const displayNumber = parsedNum > 0 ? parsedNum : '#';
            const formattedDate = formatArabicDate(order.date);

            return (
              <div
                key={order.id}
                id={`order-card-${order.id}`}
                className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
              >
                <div className="w-full">
                  {/* صف الهيدر المقفول / القابل للضغط */}
                  <SwipeRow
                    rowKey={`order_${order.id}`}
                    swipeOpenKey={swipeOpenKey}
                    onOpenChange={setSwipeOpenKey}
                    disabled={isExpanded}
                    leftSwipeContent={
                      <div className="w-full h-full flex items-center ps-3 pe-[32%] text-right">
                        <p
                          className={`text-[12px] leading-[1.35] font-[600] line-clamp-2 break-words ${
                            order.notes?.trim() ? 'text-white' : 'text-white/60'
                          }`}
                        >
                          {order.notes?.trim() || 'لا توجد ملاحظة'}
                        </p>
                      </div>
                    }
                    rightSwipeContent={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditOrderModal(order);
                        }}
                        className="w-full h-full bg-[#3B3550] hover:bg-[#312C44] active:opacity-90 text-white cursor-pointer relative rounded-[inherit]"
                      >
                        <span className="absolute left-0 top-0 bottom-0 w-[28%] flex items-center justify-center gap-1 text-[11.5px] font-[700] whitespace-nowrap">
                          <svg
                            className="w-3.5 h-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                          <span>تعديل</span>
                        </span>
                      </button>
                    }
                    className="rounded-[11px]"
                  >
                    <div
                      onClick={() => toggleExpand(order.id)}
                      className="order-grid p-[8px_10px] cursor-pointer select-none bg-white"
                    >
                      {/* 1. مربع الرقم */}
                      <div
                        style={{ backgroundColor: numberBoxBg }}
                        className="w-[20px] h-[34px] rounded-[6px] text-white text-[10px] font-[800] flex items-center justify-center shrink-0"
                      >
                        {displayNumber}
                      </div>

                      {/* 2. كتلة الاسم والتاريخ (بدون قلم) */}
                      <div className="min-w-0 pr-0.5">
                        <span className="font-[800] text-[11px] text-[#211B24] truncate leading-tight block">
                          {order.code}
                        </span>
                        <span className="text-[9px] font-[400] text-[#857D89] leading-tight block truncate mt-0.5">
                          {formattedDate}
                        </span>
                      </div>

                      {/* 3. التكلفة (رقم كبير 11px/800 + ج.م 8px/600) */}
                      <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center gap-0.5 overflow-hidden">
                        <span className="text-[11px] font-[800] text-[#3B9AC4] tabular-nums whitespace-nowrap leading-none">
                          {totalCost.toLocaleString('en-US')}
                        </span>
                        <span className="text-[8px] font-[600] text-[#857D89] leading-none">
                          {state.settings.currency}
                        </span>
                      </div>

                      {/* 4. المبيعات (رقم كبير 11px/800 + ج.م 8px/600) */}
                      <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center gap-0.5 overflow-hidden">
                        <span className="text-[11px] font-[800] text-[#5F2967] tabular-nums whitespace-nowrap leading-none">
                          {totalCollected.toLocaleString('en-US')}
                        </span>
                        <span className="text-[8px] font-[600] text-[#857D89] leading-none">
                          {state.settings.currency}
                        </span>
                      </div>

                      {/* 5. الربح (جوه مربع شفاف أحمر/أخضر) */}
                      <div className="border-s border-[#E4E1EC] h-[22px] flex items-center justify-center overflow-hidden">
                        <div
                          className={`min-w-[46px] h-[22px] px-1 rounded-[6px] flex items-center justify-center gap-0.5 border ${
                            netProfit > 0
                              ? 'bg-[rgba(38,115,86,0.12)] border-[rgba(38,115,86,0.30)] text-[#267356]'
                              : 'bg-[rgba(163,59,86,0.12)] border-[rgba(163,59,86,0.30)] text-[#A33B56]'
                          }`}
                        >
                          <span className="text-[11px] font-[800] tabular-nums whitespace-nowrap leading-none">
                            {netProfit > 0
                              ? `+${netProfit.toLocaleString('en-US')}`
                              : netProfit.toLocaleString('en-US')}
                          </span>
                          <span className="text-[8px] font-[600] opacity-75 leading-none">
                            {state.settings.currency}
                          </span>
                        </div>
                      </div>

                      {/* 6. سهم الطي */}
                      <div className="w-[12px] flex items-center justify-center text-[#857D89] shrink-0">
                        <svg
                          className={`w-3 h-3 transition-transform duration-200 ${
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
                    </div>
                  </SwipeRow>

                  {/* لوحة الأصناف (بعد فتح الكارت) */}
                  {isExpanded && (
                    <div className="relative pt-[8px] pb-[10px] pe-[6px] ps-[30px] border-t border-[#E9E3EB] bg-[#3C3F4A]">
                      {/* قائمة الأصناف */}
                      <div className="relative space-y-[4px]">
                        <div className="absolute start-[-16px] top-[16px] bottom-[16px] w-[2px] rounded-full bg-[#E2B84F]" />
                        {order.items.map((it) => {
                          const itemCostTotal = it.costPrice * (it.quantity || 1);
                          const itemSoldTotal =
                            it.isSold && it.soldPrice !== undefined
                              ? it.soldPrice * (it.quantity || 1)
                              : null;

                          const totalDue = itemSoldTotal !== null ? itemSoldTotal : 0;
                          const paid =
                            it.paidAmount !== undefined
                              ? it.paidAmount
                              : it.paymentType === 'cash' || it.isSettled
                              ? totalDue
                              : 0;
                          const remaining = Math.max(0, totalDue - paid);

                          const isFullyPaid =
                            it.isSold &&
                            (it.isSettled ||
                              it.paymentType === 'cash' ||
                              it.paidAmount === undefined ||
                              it.paidAmount >= totalDue ||
                              remaining <= 0.001);

                          const isDebtItem =
                            it.isSold &&
                            !isFullyPaid &&
                            (it.paymentType === 'credit' ||
                              it.paymentType === 'partial' ||
                              remaining > 0.001);

                          const customerObj = it.customerId
                            ? customers.find((c) => c.id === it.customerId)
                            : null;

                          const isExpense = it.name.trim() === 'مصاريف';

                          return (
                            <div key={it.id} className="relative">
                              <span className="absolute start-[-16px] top-1/2 -translate-y-1/2 h-[2px] w-[14px] bg-[#E2B84F]" />
                              <span className="absolute start-[-19px] top-1/2 -translate-y-1/2 h-[8px] w-[8px] rounded-full bg-[#E2B84F]" />
                              <SwipeRow
                                rowKey={`item_${it.id}`}
                                swipeOpenKey={swipeOpenKey}
                                onOpenChange={setSwipeOpenKey}
                                onEdit={() => openEditModal(order.id, it)}
                                onDelete={() => {
                                  setSwipeOpenKey(null);
                                  requestDeleteItem(order.id, it, order.code);
                                }}
                                className="rounded-[7px] border border-[#EBE6ED] overflow-hidden"
                              >
                                <div
                                  className={`order-grid p-[4px_3px] min-h-[30px] w-full ${
                                    isDebtItem
                                      ? 'bg-[#FBF1DB]'
                                      : it.isSold
                                      ? ''
                                      : 'bg-[#FFFFFF]'
                                  }`}
                                  style={
                                    it.isSold && !isDebtItem
                                      ? { background: 'linear-gradient(rgba(163,59,86,0.12), rgba(163,59,86,0.12)), #ffffff' }
                                      : undefined
                                  }
                                >
                                  {/* اسم الصنف يمتد على عمودي (المربع + الاسم) */}
                                  <div className="col-span-2 min-w-0 pr-1">
                                    <div className="text-[11px] font-[700] text-[#211B24] truncate leading-tight">
                                      {it.name}
                                      {it.quantity && it.quantity > 1 ? (
                                        <span className="text-[9px] text-[#857D89] font-normal mr-1">
                                          ×{it.quantity}
                                        </span>
                                      ) : null}
                                      {it.size ? (
                                        <span className="text-[9px] text-[#857D89] font-normal mr-1">
                                          ({it.size})
                                        </span>
                                      ) : null}
                                    </div>
                                    {isDebtItem && (
                                      <div className="text-[9px] text-[#857D89] leading-tight truncate mt-0.5">
                                        متبقي {remaining.toLocaleString('en-US')} {state.settings.currency} ·{' '}
                                        {customerObj ? customerObj.name : 'عميل'}
                                      </div>
                                    )}
                                  </div>

                                  {/* تحت عمود التكلفة (Col 3) مع خط فاصل */}
                                  <div className="text-center overflow-hidden border-s border-[#E4E1EC] ps-[5px] box-border">
                                    <span className="text-[9px] font-[700] text-[#211B24] tabular-nums whitespace-nowrap block leading-tight">
                                      {itemCostTotal.toLocaleString('en-US')} {state.settings.currency}
                                    </span>
                                  </div>

                                  {/* تحت عمود المبيعات (Col 4) مع خط فاصل */}
                                  <div className="text-center overflow-hidden border-s border-[#E4E1EC] ps-[5px] box-border">
                                    {itemSoldTotal !== null ? (
                                      <span className="text-[9px] font-[700] text-[#3B9AC4] tabular-nums whitespace-nowrap block leading-tight">
                                        {itemSoldTotal.toLocaleString('en-US')} {state.settings.currency}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-[#857D89] block leading-tight">
                                        —
                                      </span>
                                    )}
                                  </div>

                                  {/* الزرار يمتد على العمودين الأخيرين (Col 5 + Col 6) */}
                                  <div className="col-span-2 flex items-center justify-center gap-1">
                                    {isExpense ? (
                                      <span className="text-[9px] font-[600] text-[#857D89] whitespace-nowrap">
                                        مصروف أوردر
                                      </span>
                                    ) : it.isSold ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReturnRefundInput(
                                            paid > 0 && it.customerId ? String(paid) : ''
                                          );
                                          setReturningItemInfo({
                                            orderId: order.id,
                                            item: it,
                                            orderCode: order.code,
                                          });
                                        }}
                                        className="h-[18px] px-2 rounded-full bg-[#FAE9ED] text-[#AE455E] font-[600] text-[9px] flex items-center justify-center cursor-pointer transition active:scale-95 whitespace-nowrap"
                                        title="ارتجاع الصنف"
                                      >
                                        ارتجاع
                                      </button>
                                    ) : (
                                      <>
                                        {showSettlementOrders[order.id] && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setSettlingItemInfo({
                                                orderId: order.id,
                                                item: it,
                                                orderCode: order.code,
                                              })
                                            }
                                            className="h-[18px] px-2 rounded-full bg-[#FBF1DE] text-[#B7791F] font-[600] text-[9px] flex items-center justify-center cursor-pointer transition whitespace-nowrap"
                                            title="تسوية الصنف بالتكلفة"
                                          >
                                            تسوية
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => openSaleModal(order.id, it)}
                                          className="h-[18px] px-2 rounded-full bg-[#E7F4EE] text-[#267356] font-[600] text-[9px] flex items-center justify-center cursor-pointer transition active:scale-95 whitespace-nowrap shadow-none"
                                        >
                                          تسجيل بيع
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </SwipeRow>
                            </div>
                          );
                        })}
                      </div>

                      {/* الملاحظات أسفل اللوحة إن وجدت */}
                      {order.notes && (
                        <div className="mt-1.5 text-[9px] font-[400] text-[#E8E9EE] leading-snug -ms-[24px]">
                          {order.notes}
                        </div>
                      )}

                      {/* أزرار أسفل اللوحة */}
                      <div className="flex items-center justify-between gap-2 mt-2 -ms-[24px]">
                        <div className="flex items-center gap-[6px] flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingItemOrderId(order.id);
                              setNewItemName('');
                              setNewItemQuantity('');
                              setNewItemCost('');
                            }}
                            className="px-3 py-1.5 rounded-[7px] bg-[#2E8C69] hover:bg-[#267356] text-white font-[700] text-[11px] flex items-center justify-center cursor-pointer transition active:scale-95"
                            title="إضافة صنف إلى هذا الأوردر"
                          >
                            إضافة صنف
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleShowSettlement(order.id)}
                            className="px-3 py-1.5 rounded-[7px] bg-[#EBE6ED] text-[#746C78] font-[700] text-[11px] flex items-center justify-center cursor-pointer transition active:scale-95"
                            title={
                              showSettlementOrders[order.id]
                                ? 'إخفاء أزرار التسوية'
                                : 'إظهار أزرار التسوية للأصناف غير المباعة'
                            }
                          >
                            {showSettlementOrders[order.id] ? 'إخفاء التسوية' : 'إظهار التسوية'}
                          </button>

                          {order.isFinished ? (
                            <button
                              type="button"
                              onClick={() => toggleOrderFinished(order.id)}
                              className="px-3 py-1.5 rounded-[7px] bg-[#5F2967] hover:bg-[#4E2155] text-white font-[700] text-[11px] flex items-center justify-center cursor-pointer transition active:scale-95"
                              title="إعادة فتح الأوردر"
                            >
                              إعادة فتح الأوردر
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleOrderFinished(order.id)}
                              className="px-3 py-1.5 rounded-[7px] bg-[#B8405E] hover:bg-[#A33B56] text-white font-[700] text-[11px] flex items-center justify-center cursor-pointer transition active:scale-95"
                              title="إقفال الأوردر"
                            >
                              إقفال الأوردر
                            </button>
                          )}
                        </div>

                        {/* زرار نصي لحذف الأوردر على أقصى الشمال */}
                        <button
                          type="button"
                          onClick={() => requestDeleteOrder(order)}
                          className="flex items-center gap-1 text-[10px] font-[600] text-[#FFC1CE] hover:opacity-80 transition cursor-pointer shrink-0 bg-transparent border-0 p-1"
                          title="حذف الأوردر بالكامل"
                        >
                          <Icon3D name="trash" size={12} />
                          <span>حذف الأوردر</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: تسجيل بيع (نفس النموذج المستخدم في البيع السريع) */}
      {sellingItemInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right shadow-2xl text-xs my-auto">
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4]">
              <h3 className="font-extrabold text-sm text-[#2B2340] flex items-center gap-1.5">
                <Icon3D name="sell" size={20} />
                بيع: {sellingItemInfo.item.name}
              </h3>
              <button
                type="button"
                onClick={() => setSellingItemInfo(null)}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>
            <SaleForm
              orderId={sellingItemInfo.orderId}
              item={sellingItemInfo.item}
              onDone={() => setSellingItemInfo(null)}
              onCancel={() => setSellingItemInfo(null)}
            />
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Order Item Modal */}
      {editingItemInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveEditItem}
            className="w-full max-w-xs bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4]">
              <h3 className="font-extrabold text-sm text-[#2B2340] flex items-center gap-1.5">
                <Icon3D name="edit" size={18} />
                تعديل الصنف
              </h3>
              <button
                type="button"
                onClick={() => setEditingItemInfo(null)}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">اسم الصنف *</label>
              <input
                type="text"
                required
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">سعر التكلفة *</label>
              <input
                type="number"
                step="0.01"
                required
                value={editItemCost}
                onChange={(e) => setEditItemCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center text-[#E2574C] outline-none"
              />
            </div>

            {editingItemInfo.item.isSold && (
              <div>
                <label className="block font-bold text-[#2B2340] mb-1">سعر البيع</label>
                <input
                  type="number"
                  step="0.01"
                  value={editItemSoldPrice}
                  onChange={(e) => setEditItemSoldPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center text-[#3B9AC4] outline-none"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={() => setEditingItemInfo(null)}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-[#2B2340] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Return Item Confirmation (مع توضيح ما سيحدث) */}
      {returningItemInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right shadow-2xl text-xs">
            <div className="flex items-center gap-2 text-[#E2574C]">
              <Icon3D name="warning" size={22} />
              <h3 className="font-extrabold text-sm text-[#2B2340]">
                تأكيد ارتجاع الصنف: {returningItemInfo.item.name}
              </h3>
            </div>

            <div className="p-3 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4] space-y-1.5 text-[11px] leading-relaxed">
              <p className="font-bold text-[#2B2340]">
                ما سيحدث عند تأكيد الارتجاع:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#9A98B0]">
                <li>سيعود الصنف غير مباع ويرجع متاحاً للبيع مجدداً.</li>
                <li>يتم استرجاع تكلفته المحبوسة في الأوردر.</li>
                {returningItemInfo.item.isSettled && (
                  <li className="font-bold text-amber-600">
                    الصنف ده كان «مُسوّى»: هتتلغى حركة التسوية بتاعته من رأس المال وتتشال علامة «مُسوّى»، فالتكلفة ماتتخصمش مرتين.
                  </li>
                )}
                <li>في حال كان الأوردر مغطياً لتكلفته وحقق أرباحاً موزعة، سيتم عكس الأرباح الناتجة عن بيعه تلقائياً بنسب التوزيع:
                  <span className="block font-bold text-[#5F2967] mr-2">
                    70% نمو رأس مال - 20% دعم بوكيت - 10% صدقة
                  </span>
                </li>
              </ul>
            </div>

            {returningItemInfo.item.customerId && (
              <div>
                <label className="block font-bold text-[#2B2340] mb-1">
                  الفلوس اللي رجّعتيها للعميل (اتركيه فاضي لو ما رجّعتيش حاجة)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={returnRefundInput}
                  onChange={(e) => setReturnRefundInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center outline-none focus:border-[#5F2967]"
                />
                <span className="text-[10px] text-[#9A98B0] block mt-1">
                  هيتسجل سطر "استرداد" في كشف حساب العميل، والمدفوع على الصنف ده هيتشال من حسابه.
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmReturn}
                className="flex-1 py-2.5 rounded-xl bg-[#E2574C] hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                تأكيد الارتجاع
              </button>
              <button
                type="button"
                onClick={() => {
                  setReturningItemInfo(null);
                  setReturnRefundInput('');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-[#2B2340] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Settle Unsold Item Confirmation (تسوية) */}
      {settlingItemInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right shadow-2xl text-xs">
            <div className="flex items-center gap-2 text-amber-600">
              <Icon3D name="warning" size={22} />
              <h3 className="font-extrabold text-sm text-[#2B2340]">
                تأكيد تسوية الصنف: {settlingItemInfo.item.name}
              </h3>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1.5 text-[11px] text-amber-950 leading-relaxed">
              <p className="font-bold">ما سيحدث عند التسوية:</p>
              <p>
                - سيتم إخراج الصنف بسعر تكلفته ({settlingItemInfo.item.costPrice} {state.settings.currency}) بدون أي أرباح، وتحرير قيمته المحبوسة في الأوردر.
              </p>
              <p>
                - تسجيل حركة تسوية في رأس المال بنفس القيمة ({settlingItemInfo.item.costPrice * (settlingItemInfo.item.quantity || 1)} {state.settings.currency}) مع ربطها بالأوردر.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                تأكيد التسوية
              </button>
              <button
                type="button"
                onClick={() => setSettlingItemInfo(null)}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-[#2B2340] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Add Item to Existing Order */}
      {addingItemOrderId && (() => {
        const targetOrder = state.orders.find((o) => o.id === addingItemOrderId);
        const orderLabel = targetOrder
          ? targetOrder.code.includes('أوردر')
            ? targetOrder.code
            : `أوردر رقم ${targetOrder.code}`
          : 'الأوردر';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <form
              onSubmit={handleSaveAddItem}
              className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right shadow-2xl text-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#ECECF4]">
                <h3 className="font-extrabold text-sm text-[#2F7F5F] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#E3F2EA] text-[#2F7F5F] flex items-center justify-center text-sm font-black leading-none">＋</span>
                  <span>إضافة صنف إلى {orderLabel}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setAddingItemOrderId(null)}
                  className="text-[#9A98B0] hover:text-[#2B2340] p-1 rounded-lg"
                  aria-label="إغلاق"
                >
                  <Icon3D name="close" size={16} />
                </button>
              </div>

              <div>
                <label className="block font-bold text-[#2B2340] mb-1">
                  اسم الصنف / الموديل *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#2F7F5F]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2B2340] mb-1">
                  الكمية (العدد) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white text-center font-bold outline-none focus:border-[#2F7F5F]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2B2340] mb-1">
                  سعر التكلفة ({state.settings.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newItemCost}
                  onChange={(e) => setNewItemCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center text-[#2F7F5F] outline-none focus:border-[#2F7F5F] text-sm tabular-nums"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#2F7F5F] hover:bg-[#25664C] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  إضافة الصنف للأوردر
                </button>
                <button
                  type="button"
                  onClick={() => setAddingItemOrderId(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-[#2B2340] font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        );
      })()}
      {/* MODAL 8: Edit Order Info Bottom Sheet */}
      {editingOrder && (
        <div
          onClick={() => setEditingOrder(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSaveEditOrder}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] bg-white rounded-t-[24px] p-5 border-t border-[#D4D0E0] space-y-4 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967]">
                تعديل بيانات الأوردر
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">اسم الأوردر *</label>
              <input
                type="text"
                required
                value={editOrderCode}
                onChange={(e) => setEditOrderCode(e.target.value)}
                className={`input-field w-full px-3 py-2 text-xs font-bold text-[#1F1A2E] ${
                  isDuplicateOrderCode ? 'border-[#D13026] focus:border-[#D13026]' : ''
                }`}
              />
              {isDuplicateOrderCode && (
                <p className="text-[11px] font-bold text-[#D13026] mt-1">
                  الاسم ده مستخدم
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">ملاحظات الأوردر</label>
              <textarea
                rows={3}
                value={editOrderNotes}
                onChange={(e) => setEditOrderNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                className="input-field w-full px-3 py-2 text-xs text-[#1F1A2E] resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isOrderCodeEmpty || isDuplicateOrderCode}
                className="flex-1 py-2.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-[#2B2340] font-bold text-xs cursor-pointer"
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
