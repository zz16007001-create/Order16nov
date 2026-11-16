/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, DeliveryMode } from '../types';
import { Icon3D } from '../components/icons3d/Icon3D';
import { getWhatsAppUrl, openWhatsApp, formatMessengerUrl, getTelUrl, toEnglishDigits } from '../utils/contact';
import { smartTextMatch } from '../utils/arabicText';
import { SwipeRow } from '../components/SwipeRow';
import { useConfirmDelete } from '../components/ConfirmDeleteDialog';

export const CustomersPage: React.FC = () => {
  const {
    state,
    customers,
    customerPayments,
    customerNotes,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addCustomerNote,
    deleteCustomerNote,
    recordCustomerPayment,
    cancelCustomerPayment,
  } = useApp();
  const { confirmDelete } = useConfirmDelete();
  const [swipeOpenKey, setSwipeOpenKey] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addressQuery, setAddressQuery] = useState(''); // فلتر العنوان (بحث ذكي وسط الكلام)
  const [selectedOrderFilter, setSelectedOrderFilter] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<'all' | 'debt' | 'paid'>('all');

  // Filter bottom sheet state
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [draftOrderFilter, setDraftOrderFilter] = useState<string>('all');
  const [draftAddressQuery, setDraftAddressQuery] = useState('');
  const [draftDebtFilter, setDraftDebtFilter] = useState<'all' | 'debt' | 'paid'>('all');

  // Add customer modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustSize, setNewCustSize] = useState('');
  const [newCustMessenger, setNewCustMessenger] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [newCustDelivery, setNewCustDelivery] = useState<DeliveryMode | ''>('');
  // لو فيه قيمة هنا يبقى الفورم في وضع «تعديل عميل» بدل «إضافة عميل جديد»
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Collect Payment Modal
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentItemId, setPaymentItemId] = useState(''); // '' = الأقدم أول تلقائي

  // Add Note Modal
  const [noteCustomerId, setNoteCustomerId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);

  // Blocked customer deletion alert dialog (works reliably inside sandboxed iframes)
  const [deleteModal, setDeleteModal] = useState<{
    customerId: string;
    customerName: string;
    blocked: boolean;
    blockedMessage?: string;
  } | null>(null);

  // Active customer profile tab: 'statement' | 'notes'
  const [activeCustomerTab, setActiveCustomerTab] = useState<'statement' | 'payments' | 'notes'>('statement');

  // Customer Summary Statistics
  const customerStatsMap = useMemo(() => {
    const map: Record<string, { totalPurchases: number; totalPaid: number; remainingDebt: number; itemsCount: number }> = {};

    customers.forEach((c) => {
      map[c.id] = { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
    });

    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (it.customerId && it.isSold) {
          if (!map[it.customerId]) {
            map[it.customerId] = { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
          }
          const price = (it.soldPrice || 0) * (it.quantity || 1);
          const paid = it.paidAmount !== undefined ? it.paidAmount : price;
          const debt = Math.max(0, price - paid);

          map[it.customerId].totalPurchases += price;
          map[it.customerId].totalPaid += paid;
          map[it.customerId].remainingDebt += debt;
          map[it.customerId].itemsCount += 1;
        }
      });
    });

    return map;
  }, [customers, state.orders]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let debt = 0;
    let purchases = 0;
    let paid = 0;
    Object.values(customerStatsMap).forEach((st) => {
      debt += st.remainingDebt;
      purchases += st.totalPurchases;
      paid += st.totalPaid;
    });
    return { debt, purchases, paid };
  }, [customerStatsMap]);

  // Undelivered items for selected customer (بند 3-ب)
  const undeliveredItems = useMemo(() => {
    if (!selectedCustomerId) return [];
    const list: Array<{ id: string; itemName: string; orderCode: string; quantity?: number; size?: string; suggestedSellPrice?: number }> = [];
    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (!it.isSold && (it.requestedByCustomerId === selectedCustomerId || it.customerId === selectedCustomerId)) {
          list.push({
            id: it.id,
            itemName: it.name,
            orderCode: ord.code,
            quantity: it.quantity,
            size: it.size,
            suggestedSellPrice: it.suggestedSellPrice,
          });
        }
      });
    });
    return list;
  }, [selectedCustomerId, state.orders]);

  // Filtered customers (بند 3-ج)
  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (selectedOrderFilter !== 'all') {
      const targetOrder = state.orders.find((o) => o.id === selectedOrderFilter);
      if (!targetOrder) {
        list = [];
      } else {
        list = list.filter((c) =>
          targetOrder.items.some(
            (it) => it.requestedByCustomerId === c.id || it.customerId === c.id
          )
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = toEnglishDigits(q);
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && toEnglishDigits(c.phone).includes(qDigits)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    // فلتر العنوان: بيدوّر على الكلمة في أي مكان وسط العنوان (بنها ـ مسجد كذا ← يطلع لما تكتب «بنها»)
    if (addressQuery.trim()) {
      list = list.filter((c) => smartTextMatch(c.address, addressQuery));
    }

    if (debtFilter === 'debt') {
      list = list.filter((c) => (customerStatsMap[c.id]?.remainingDebt || 0) > 0.001);
    } else if (debtFilter === 'paid') {
      list = list.filter((c) => (customerStatsMap[c.id]?.remainingDebt || 0) <= 0.001);
    }

    return list;
  }, [customers, selectedOrderFilter, searchQuery, addressQuery, debtFilter, customerStatsMap, state.orders]);

  const activeFiltersCount =
    (selectedOrderFilter !== 'all' ? 1 : 0) +
    (addressQuery.trim() ? 1 : 0) +
    (debtFilter !== 'all' ? 1 : 0);

  const openFilterSheet = () => {
    setDraftOrderFilter(selectedOrderFilter);
    setDraftAddressQuery(addressQuery);
    setDraftDebtFilter(debtFilter);
    setShowFilterSheet(true);
  };

  const applyFilterSheet = () => {
    setSelectedOrderFilter(draftOrderFilter);
    setAddressQuery(draftAddressQuery);
    setDebtFilter(draftDebtFilter);
    setShowFilterSheet(false);
  };

  const resetFilterSheet = () => {
    setDraftOrderFilter('all');
    setDraftAddressQuery('');
    setDraftDebtFilter('all');
    setSelectedOrderFilter('all');
    setAddressQuery('');
    setDebtFilter('all');
    setShowFilterSheet(false);
  };

  // Selected customer object
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  // Selected customer purchases details
  const selectedCustomerPurchases = useMemo(() => {
    if (!selectedCustomerId) return [];
    const list: Array<{
      itemId: string;
      itemName: string;
      orderCode: string;
      orderDate: string;
      soldDate: string;
      price: number;
      paid: number;
      debt: number;
      paymentType: string;
      quantity: number;
      size?: string;
      suggestedSellPrice?: number;
    }> = [];

    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (it.customerId === selectedCustomerId && it.isSold) {
          const totalSale = (it.soldPrice || 0) * (it.quantity || 1);
          const paid = it.paidAmount !== undefined ? it.paidAmount : totalSale;
          const debt = Math.max(0, totalSale - paid);
          list.push({
            itemId: it.id,
            itemName: it.name,
            orderCode: ord.code,
            orderDate: ord.date,
            soldDate: it.soldDate || ord.date,
            price: totalSale,
            paid,
            debt,
            paymentType: it.paymentType || 'cash',
            quantity: it.quantity || 1,
            size: it.size,
            suggestedSellPrice: it.suggestedSellPrice,
          });
        }
      });
    });

    return list.sort((a, b) => b.soldDate.localeCompare(a.soldDate));
  }, [selectedCustomerId, state.orders]);

  // Selected customer payments history
  const selectedCustomerPayments = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerPayments
      .filter((p) => p.customerId === selectedCustomerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomerId, customerPayments]);

  // Selected customer notes history
  const selectedCustomerNotes = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerNotes
      .filter((n) => n.customerId === selectedCustomerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomerId, customerNotes]);

  const resetCustomerForm = () => {
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustSize('');
    setNewCustMessenger('');
    setNewCustNotes('');
    setNewCustDelivery('');
    setEditingCustomerId(null);
  };

  const openAddCustomerForm = () => {
    resetCustomerForm();
    setShowAddCustomerModal(true);
  };

  const openEditCustomerForm = (cust: Customer) => {
    setEditingCustomerId(cust.id);
    setNewCustName(cust.name);
    setNewCustPhone(toEnglishDigits(cust.phone || ''));
    setNewCustAddress(cust.address || '');
    setNewCustSize(cust.size || '');
    setNewCustMessenger(cust.messengerLink || '');
    setNewCustNotes(cust.notes || '');
    setNewCustDelivery(cust.deliveryMode || '');
    setShowAddCustomerModal(true);
  };

  const closeCustomerForm = () => {
    setShowAddCustomerModal(false);
    resetCustomerForm();
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    if (editingCustomerId) {
      // تعديل عميل موجود: القيمة الفاضية بتمسح الحقل (undefined)
      updateCustomer(editingCustomerId, {
        name: newCustName.trim(),
        phone: newCustPhone.trim() ? toEnglishDigits(newCustPhone.trim()) : undefined,
        address: newCustAddress.trim() || undefined,
        size: newCustSize.trim() || undefined,
        messengerLink: newCustMessenger.trim() || undefined,
        notes: newCustNotes.trim() || undefined,
        deliveryMode: newCustDelivery || undefined,
      });
      closeCustomerForm();
      return;
    }

    const created = addCustomer(
      newCustName.trim(),
      newCustPhone.trim() ? toEnglishDigits(newCustPhone.trim()) : undefined,
      newCustNotes.trim() || undefined,
      {
        address: newCustAddress.trim() || undefined,
        size: newCustSize.trim() || undefined,
        messengerLink: newCustMessenger.trim() || undefined,
        deliveryMode: newCustDelivery || undefined,
      }
    );
    closeCustomerForm();
    setSelectedCustomerId(created.id);
  };

  // حذف عميل (بحماية): لو عليه دين مايتحذفش، ولو ليه طلبات/أصناف معلقة بنحذّرك الأول في مودال داخل البرنامج
  const handleDeleteCustomer = (cust: Customer) => {
    const st = customerStatsMap[cust.id] || { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };

    if (st.remainingDebt > 0.001) {
      setDeleteModal({
        customerId: cust.id,
        customerName: cust.name,
        blocked: true,
        blockedMessage: `ماينفعش تحذف "${cust.name}" لأن عليه دين ${st.remainingDebt.toLocaleString('en-US')} ${state.settings.currency}.\nحصّل الدين الأول أو سدّده، وبعدها احذف العميل.`,
      });
      return;
    }

    const pendingOrderItems = state.orders.reduce(
      (n, ord) =>
        n +
        ord.items.filter(
          (it) => !it.isSold && (it.requestedByCustomerId === cust.id || it.customerId === cust.id)
        ).length,
      0
    );
    const pendingOfficeItems = state.officeItems.filter(
      (it) => !it.isTransferredToOrder && it.customerId === cust.id
    ).length;

    const warnings: string[] = [];
    if (pendingOrderItems > 0) warnings.push(`له ${pendingOrderItems} صنف لسه ماتباعش في الأوردرات`);
    if (pendingOfficeItems > 0) warnings.push(`له ${pendingOfficeItems} صنف في بضاعة المكاتب`);
    if (st.itemsCount > 0) warnings.push('سجل مشترياته ودفعاته هيتمسح من الشاشة دي');

    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف العميل "${cust.name}" نهائياً؟`,
      details: warnings.length > 0 ? warnings.join(' • ') : undefined,
      onConfirm: () => {
        deleteCustomer(cust.id);
        if (selectedCustomerId === cust.id) setSelectedCustomerId(null);
        setSwipeOpenKey(null);
      },
    });
  };

  // أصناف العميل اللي عليها باقي (للدفع على صنف معيّن)
  const paymentDebtItems = useMemo(() => {
    if (!paymentCustomerId) return [];
    const list: Array<{ id: string; label: string; debt: number }> = [];
    state.orders.forEach((ord) => {
      ord.items.forEach((it) => {
        if (it.customerId === paymentCustomerId && it.isSold) {
          const total = (it.soldPrice || 0) * (it.quantity || 1);
          const paid = it.paidAmount !== undefined ? it.paidAmount : total;
          const debt = Math.max(0, total - paid);
          if (debt > 0.001) list.push({ id: it.id, label: `${it.name} (${ord.code})`, debt });
        }
      });
    });
    return list;
  }, [paymentCustomerId, state.orders]);

  const currentCollectingCustDebt = paymentCustomerId
    ? paymentItemId
      ? paymentDebtItems.find((x) => x.id === paymentItemId)?.debt || 0
      : customerStatsMap[paymentCustomerId]?.remainingDebt || 0
    : 0;
  const isPaymentOverDebt = parseFloat(paymentAmount) > currentCollectingCustDebt;

  const handleCollectPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!paymentCustomerId || !amt || amt <= 0 || amt > currentCollectingCustDebt) return;
    recordCustomerPayment(paymentCustomerId, amt, paymentDate, paymentNotes.trim() || undefined, paymentItemId || undefined);
    setPaymentItemId('');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentCustomerId(null);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteCustomerId || !noteText.trim()) return;
    addCustomerNote(noteCustomerId, noteText.trim(), noteDate);
    setNoteText('');
    setNoteCustomerId(null);
  };

  return (
    <div className="w-full flex flex-col gap-[13px] text-[#1F1A2E]">
      {/* 1. كارت اسم الصفحة: بنفسجي متدرج، ارتفاع 52px */}
      <div className="card-header-purple flex items-center justify-between">
        <div className="flex items-center gap-[8px] min-w-0">
          {selectedCustomer && (
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="btn-back-transparent"
              title="الرجوع لقائمة العملاء"
            >
              ➜
            </button>
          )}
          <span className="text-[18px] font-[800] text-white leading-none whitespace-nowrap">
            {selectedCustomer ? selectedCustomer.name : `سجل العملاء والمديونيات (${customers.length})`}
          </span>
        </div>

        <button
          onClick={openAddCustomerForm}
          className="h-[26px] px-[10px] rounded-full bg-[#2F7F5F] hover:bg-[#25664C] text-white text-[12px] font-[700] flex items-center gap-1 flex-none shadow-sm cursor-pointer"
        >
          <span className="text-[12px] leading-none">＋</span>
          <span>عميل جديد</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* VIEW A: DETAILED CUSTOMER PROFILE VIEW                    */}
      {/* ========================================================= */}
      {selectedCustomer ? (
        <div className="w-full flex flex-col gap-[13px]">
          {/* Customer Summary Card */}
          {(() => {
            const st = customerStatsMap[selectedCustomer.id] || { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
            const paidPercent = st.totalPurchases > 0 ? Math.min(100, Math.max(0, (st.totalPaid / st.totalPurchases) * 100)) : 0;

            return (
              <div className="card-main p-3 space-y-2">
                {/* الصف الأول: اسم العميل وشارة مدين / خالص الحساب */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-[11px] font-[800] text-[#211B24] truncate">
                      {selectedCustomer.name}
                    </h3>
                    {st.remainingDebt > 0 ? (
                      <span className="text-[9px] px-1.5 py-[1px] rounded-full bg-[#F8E6EC] text-[#A23B5A] font-[700] shrink-0">
                        مدين
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-[1px] rounded-full bg-[#E3F2EA] text-[#2F7F5F] font-[700] shrink-0">
                        خالص الحساب
                      </span>
                    )}
                    {selectedCustomer.deliveryMode === 'delivery' && (
                      <span className="text-[9px] px-1.5 py-[1px] rounded-full bg-[#E3F2EA] text-[#2F7F5F] font-[800] border border-[#2F7F5F]/30 shrink-0">
                        شحن
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditCustomerForm(selectedCustomer)}
                      className="p-1 text-slate-400 hover:text-blue-500 transition cursor-pointer"
                      title="تعديل العميل"
                    >
                      <Icon3D name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(selectedCustomer)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      title="حذف العميل"
                    >
                      <Icon3D name="trash" size={16} />
                    </button>
                  </div>
                </div>

                {/* سطر معلومات صغير */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] font-[400] text-[#857D89]">
                  {selectedCustomer.address && (
                    <span>العنوان: {selectedCustomer.address}</span>
                  )}
                  {selectedCustomer.size && (
                    <span>المقاس: {selectedCustomer.size}</span>
                  )}
                  {selectedCustomer.deliveryMode && (
                    <span>التسليم: {selectedCustomer.deliveryMode === 'delivery' ? 'توصيل (شحن)' : 'استلام من البيت'}</span>
                  )}
                  <span>عميل منذ {selectedCustomer.createdAt}</span>
                </div>

                {/* ثلاثة أزرار بعرض متساوي: واتساب وماسنجر واتصال */}
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCustomer.phone ? (getWhatsAppUrl(selectedCustomer.phone) || '#') : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!selectedCustomer.phone) {
                        e.preventDefault();
                        return;
                      }
                      openWhatsApp(e, selectedCustomer.phone);
                    }}
                    className={`flex-1 h-[30px] rounded-xl flex items-center justify-center font-[700] text-[11px] bg-[#E3F2EA] text-[#2F7F5F] transition ${
                      !selectedCustomer.phone ? 'opacity-40 pointer-events-none' : 'hover:opacity-90'
                    }`}
                  >
                    واتساب
                  </a>
                  <a
                    href={selectedCustomer.messengerLink ? (formatMessengerUrl(selectedCustomer.messengerLink) || '#') : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 h-[30px] rounded-xl flex items-center justify-center font-[700] text-[11px] bg-[#E8F0FA] text-[#2563EB] transition ${
                      !selectedCustomer.messengerLink ? 'opacity-40 pointer-events-none' : 'hover:opacity-90'
                    }`}
                  >
                    ماسنجر
                  </a>
                  {(() => {
                    const telUrl = getTelUrl(selectedCustomer.phone);
                    return (
                      <a
                        href={telUrl || '#'}
                        onClick={(e) => {
                          if (!telUrl) e.preventDefault();
                        }}
                        aria-disabled={!telUrl}
                        className={`flex-1 h-[30px] rounded-xl flex items-center justify-center font-[700] text-[11px] bg-[#F1E8F4] text-[#5F2967] transition ${
                          !telUrl ? 'opacity-40 pointer-events-none' : 'hover:opacity-90'
                        }`}
                      >
                        اتصال
                      </a>
                    );
                  })()}
                </div>

                {/* فاصل رفيع ثم منطقة المبلغ */}
                <div className="border-t border-[#E4E1EC] pt-2">
                  {st.remainingDebt > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[9px] font-[400] text-[#857D89]">
                          المتبقي عليه
                        </span>
                        <div className="text-[#A23B5A] tabular-nums flex items-baseline gap-1">
                          <span className="text-[18px] font-[900] leading-none">
                            {st.remainingDebt.toLocaleString('en-US')}
                          </span>
                          <span className="text-[8px] font-[600] opacity-75 leading-none">
                            {state.settings.currency}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-[4px] rounded-full bg-[#E4E1EC] overflow-hidden">
                        <div
                          className="h-full bg-[#2F7F5F] rounded-full transition-all duration-300"
                          style={{ width: `${paidPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-[400] text-[#857D89]">
                        <span>
                          اشترى بـ <strong className="text-[11px] font-[800] text-[#211B24] tabular-nums">{st.totalPurchases.toLocaleString('en-US')}</strong> <span className="text-[8px] font-[600] opacity-75">{state.settings.currency}</span>
                        </span>
                        <span>
                          دفع <strong className="text-[11px] font-[800] text-[#2F7F5F] tabular-nums">{st.totalPaid.toLocaleString('en-US')}</strong> <span className="text-[8px] font-[600] opacity-75">{state.settings.currency}</span>
                        </span>
                      </div>
                    </div>
                  ) : st.totalPurchases > 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-[400] text-[#857D89] block">
                          الحساب
                        </span>
                        <div className="text-[14px] font-[900] text-[#2F7F5F] leading-tight">
                          خالص
                        </div>
                      </div>
                      <div className="text-[9px] font-[400] text-[#857D89] text-left">
                        إجمالي المشتريات{' '}
                        <strong className="text-[11px] font-[800] text-[#211B24] tabular-nums">
                          {st.totalPurchases.toLocaleString('en-US')}
                        </strong>{' '}
                        <span className="text-[8px] font-[600] opacity-75">{state.settings.currency}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-[400] text-[#857D89]">
                        لا توجد مشتريات بعد
                      </span>
                      <div className="text-[11px] font-[800] text-[#2F7F5F] tabular-nums">
                        0 <span className="text-[8px] font-[600] opacity-75">{state.settings.currency}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* صف الأزرار */}
                <div className="flex items-center gap-2 pt-0.5">
                  {st.remainingDebt > 0 && (
                    <button
                      onClick={() => {
                        setPaymentCustomerId(selectedCustomer.id);
                        setPaymentItemId('');
                        setPaymentAmount(st.remainingDebt > 0 ? st.remainingDebt.toString() : '');
                        setPaymentDate(new Date().toISOString().split('T')[0]);
                        setPaymentNotes('');
                      }}
                      className="flex-1 h-[32px] px-3 rounded-full bg-[#2F7F5F] hover:bg-[#25664C] text-white text-[11px] font-[800] flex items-center justify-center cursor-pointer transition shadow-xs"
                    >
                      تحصيل دفعة
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNoteCustomerId(selectedCustomer.id);
                      setNoteText('');
                      setNoteDate(new Date().toISOString().split('T')[0]);
                    }}
                    className={`${
                      st.remainingDebt > 0 ? 'px-3.5' : 'w-full'
                    } h-[32px] rounded-full bg-[#F5F4F9] text-[11px] font-[700] text-[#1F1A2E] flex items-center justify-center cursor-pointer hover:bg-[#EBE9F2] transition`}
                  >
                    + ملاحظة
                  </button>
                </div>
              </div>
            );
          })()}

          {/* كارت طلبات لم تُسلَّم (بند 3-ب) */}
          <div className="card-main p-2.5 space-y-1.5">
            <h4 className="text-[11px] font-[800] text-[#211B24]">
              طلبات لم تُسلَّم ({undeliveredItems.length})
            </h4>
            {undeliveredItems.length === 0 ? (
              <p className="text-[9px] font-[400] text-[#857D89]">
                لا توجد طلبات معلقة لم تُسلَّم لهذا العميل.
              </p>
            ) : (
              <div className="divide-y divide-[#E4E1EC]">
                {undeliveredItems.map((item) => (
                  <div key={item.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-[800] text-[#211B24] truncate">
                        {item.itemName}
                        {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        {item.size ? ` (مقاس ${item.size})` : ''}
                      </span>
                      {item.suggestedSellPrice ? (
                        <span className="text-[9px] font-bold text-[#2F7F5F] shrink-0">
                          بيع {item.suggestedSellPrice}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[9px] font-[400] text-[#857D89] shrink-0">{item.orderCode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub Navigation Bar for Customer Details */}
          <div className="flex items-center gap-1.5 p-1 rounded-full card-main">
            {[
              { id: 'statement', label: `الأصناف (${selectedCustomerPurchases.length})` },
              { id: 'payments', label: `الدفعات (${selectedCustomerPayments.length})` },
              { id: 'notes', label: `ملاحظات (${selectedCustomerNotes.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCustomerTab(tab.id as 'statement' | 'payments' | 'notes')}
                className={`flex-1 py-1.5 px-3 rounded-full text-[12px] font-[700] text-center whitespace-nowrap transition cursor-pointer ${
                  activeCustomerTab === tab.id
                    ? 'bg-[#5F2967] text-white shadow-xs'
                    : 'text-[#666079]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* (1) TAB: الأصناف - كارت لكل صنف بخلفية سوداء مطابقة للأوردرات */}
          {activeCustomerTab === 'statement' && (
            <div className="space-y-2">
              {selectedCustomerPurchases.length === 0 ? (
                <div className="card-main p-4 text-center py-8 space-y-1">
                  <p className="text-[13px] font-[700] text-[#666079]">لا توجد أصناف بعد.</p>
                  <p className="text-[11px] text-[#666079]/80">
                    أي صنف يتباع للعميل (آجل أو جزئي) من الأوردرات أو البيع السريع هيظهر هنا.
                  </p>
                </div>
              ) : (
                selectedCustomerPurchases.map((p) => {
                  const itemPayments = selectedCustomerPayments.flatMap((pay) =>
                    pay.kind === 'refund'
                      ? []
                      : (pay.allocations || [])
                          .filter((a) => a.itemId === p.itemId)
                          .map((a) => ({ id: pay.id, date: pay.date, amount: a.amount }))
                  );
                  const done = p.debt <= 0.001;
                  return (
                    <div
                      key={p.itemId}
                      className={`bg-[#3C3F4A] rounded-[11px] p-2.5 space-y-1.5 shadow-[0_2px_6px_rgba(43,35,64,0.10)] ${
                        done ? 'border border-white/10' : 'border-[1.5px] border-[#E6B93F]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] font-[800] text-white block truncate leading-tight">
                            {p.itemName}
                            <span className="text-[9px] font-[400] text-[#C9CAD3] mx-1">
                              (الكمية: {p.quantity || 1})
                            </span>
                            {p.size ? ` - مقاس ${p.size}` : ''}
                          </span>
                          <span className="text-[9px] font-[400] text-[#C9CAD3] block mt-0.5 leading-tight">
                            {p.orderCode} • تاريخ الشراء: {p.soldDate}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-[800] shrink-0 ${
                            done
                              ? 'bg-[#162E23] text-[#7FE0B0] border border-[#2F7F5F]/40'
                              : 'bg-[#3A2E0E] text-[#FDE68A] border border-[#E6B93F]/40'
                          }`}
                        >
                          {done ? 'خالص' : 'لسه'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-center pt-0.5">
                        <div>
                          <span className="block text-[9px] font-[400] text-[#C9CAD3]">السعر</span>
                          <span className="text-[11px] font-[800] tabular-nums text-white">{p.price.toLocaleString('en-US')}</span>
                          {p.suggestedSellPrice !== undefined && (p.suggestedSellPrice * (p.quantity || 1)) !== p.price && (
                            <span className="block text-[8px] text-[#C9CAD3] font-normal">
                              (مقترح: {(p.suggestedSellPrice * (p.quantity || 1)).toLocaleString('en-US')})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="block text-[9px] font-[400] text-[#C9CAD3]">دفعت</span>
                          <span className="text-[11px] font-[800] tabular-nums text-[#7FE0B0]">{p.paid.toLocaleString('en-US')}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-[400] text-[#C9CAD3]">الباقي</span>
                          <span className={`text-[11px] font-[800] tabular-nums ${done ? 'text-[#7FE0B0]' : 'text-[#FCA5A5]'}`}>
                            {p.debt.toLocaleString('en-US')}
                          </span>
                        </div>
                      </div>

                      {itemPayments.length > 0 && (
                        <div className="border-t border-white/15 pt-1.5 space-y-0.5">
                          {itemPayments.map((ip, idx) => (
                            <div key={ip.id + idx} className="flex items-center justify-between text-[9px] text-[#C9CAD3]">
                              <span>{ip.date}</span>
                              <span className="tabular-nums text-[10px] font-[700] text-[#7FE0B0]">
                                +{ip.amount.toLocaleString('en-US')} <span className="text-[8px] font-[600] opacity-75">{state.settings.currency}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* (1-ب) TAB: الدفعات */}
          {activeCustomerTab === 'payments' && (
            <div className="card-main p-4">
              {selectedCustomerPayments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] font-[700] text-[#666079]">لا توجد دفعات.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E4E1EC]">
                  {selectedCustomerPayments.map((pay) => {
                    const isRefund = pay.kind === 'refund';
                    const itemNames = (pay.allocations || [])
                      .map((a) => {
                        const ord = state.orders.find((o) => o.id === a.orderId);
                        const it = ord?.items.find((i) => i.id === a.itemId);
                        return it ? it.name : null;
                      })
                      .filter(Boolean)
                      .join('، ');
                    return (
                      <div key={pay.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className={`text-[14px] font-[800] tabular-nums block ${isRefund ? 'text-[#A23B5A]' : 'text-[#2F7F5F]'}`}>
                            {isRefund ? '-' : '+'}{pay.amount.toLocaleString('en-US')} {state.settings.currency}
                            <span className="text-[11px] font-[700] text-[#666079] mr-1.5">
                              {isRefund ? 'استرداد' : 'دفعة'}
                            </span>
                          </span>
                          <span className="text-[11px] text-[#666079] block mt-0.5">
                            {pay.date}
                            {itemNames ? ` • ${itemNames}` : ''}
                            {pay.notes ? ` • ${pay.notes}` : ''}
                          </span>
                        </div>
                        {!isRefund && pay.allocations && pay.allocations.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              confirmDelete({
                                title: 'تأكيد الحذف',
                                message: `هل أنت متأكد من إلغاء دفعة ${pay.amount} ${state.settings.currency}؟`,
                                details: 'الدين هيرجع على العميل والأرباح المرتبطة بيها هتتعكس.',
                                onConfirm: () => cancelCustomerPayment(pay.id),
                              })
                            }
                            className="text-[11px] font-[700] text-[#A23B5A] hover:underline cursor-pointer shrink-0"
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* (2) TAB: ملاحظات */}
          {activeCustomerTab === 'notes' && (
            <div className="card-main p-4">
              {selectedCustomerNotes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] font-[700] text-[#666079]">
                    لا توجد ملاحظات.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E4E1EC]">
                  {selectedCustomerNotes.map((n) => (
                    <div
                      key={n.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-[#666079] block">
                          {n.date}
                        </span>
                        <p className="text-[13px] font-[600] text-[#1F1A2E] mt-1 leading-relaxed">
                          {n.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          confirmDelete({
                            title: 'تأكيد الحذف',
                            message: 'هل أنت متأكد من حذف هذه الملاحظة؟',
                            details: n.text,
                            onConfirm: () => deleteCustomerNote(n.id),
                          })
                        }
                        className="text-[11px] font-[700] text-[#A23B5A] hover:underline cursor-pointer shrink-0 pt-0.5"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW B: ALL CUSTOMERS LIST                                */
        /* ========================================================= */
        <div className="w-full flex flex-col gap-[13px]">
          {/* Overall Debt Summary Box: Solid Teal Hero Card */}
          <div className="w-full h-[92px] card-hero-teal relative px-[15px] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-[600] text-white/85 leading-none mb-[6px] block">
                إجمالي ديون العملاء المطلوبة
              </span>
              <div className="flex items-baseline gap-[8px]">
                <span className="text-[30px] font-[900] leading-none text-white tabular-nums">
                  {overallTotals.debt.toLocaleString('en-US')}
                </span>
                <span className="text-[13px] font-[700] text-white/85 leading-none">
                  {state.settings.currency}
                </span>
              </div>
            </div>
            <div className="text-left text-[12px] font-[700] text-white/90 space-y-1 shrink-0">
              <div>المشتريات: {overallTotals.purchases.toLocaleString('en-US')}</div>
              <div>المحصّل: {overallTotals.paid.toLocaleString('en-US')}</div>
            </div>
          </div>

          {/* Search Bar + Compact Filter Button: Single Row */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-[34px] rounded-full card-main px-3 flex items-center gap-2">
              <div className="text-[#666079] shrink-0">
                <Icon3D name="search" size={15} />
              </div>
              <input
                type="text"
                placeholder="بحث باسم العميل أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-[12px] font-[700] text-[#1F1A2E] placeholder:text-[#666079]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#9A98B0] hover:text-[#2B2340] shrink-0 cursor-pointer"
                  title="مسح البحث"
                >
                  <Icon3D name="close" size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={openFilterSheet}
              className={`h-[34px] rounded-full card-main px-3 flex items-center gap-1.5 shrink-0 text-[12px] font-[700] cursor-pointer transition ${
                activeFiltersCount > 0 ? 'text-[#5F2967] ring-1 ring-[#5F2967]/30' : 'text-[#1F1A2E]'
              }`}
            >
              <span>تصفية</span>
              {activeFiltersCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#5F2967] text-white text-[10px] font-[800] flex items-center justify-center tabular-nums">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Active filter chips row (only when at least one filter is active) */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedOrderFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1E8F4] text-[#5F2967] text-[11px] font-[700]">
                  <span>
                    الأوردر: {state.orders.find((o) => o.id === selectedOrderFilter)?.code || ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderFilter('all')}
                    className="text-[#5F2967]/80 hover:text-[#5F2967] cursor-pointer leading-none"
                    aria-label="إزالة فلتر الأوردر"
                  >
                    ✕
                  </button>
                </span>
              )}
              {addressQuery.trim() && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1E8F4] text-[#5F2967] text-[11px] font-[700]">
                  <span>العنوان: {addressQuery.trim()}</span>
                  <button
                    type="button"
                    onClick={() => setAddressQuery('')}
                    className="text-[#5F2967]/80 hover:text-[#5F2967] cursor-pointer leading-none"
                    aria-label="إزالة فلتر العنوان"
                  >
                    ✕
                  </button>
                </span>
              )}
              {debtFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1E8F4] text-[#5F2967] text-[11px] font-[700]">
                  <span>{debtFilter === 'debt' ? 'عليهم دين' : 'خالص'}</span>
                  <button
                    type="button"
                    onClick={() => setDebtFilter('all')}
                    className="text-[#5F2967]/80 hover:text-[#5F2967] cursor-pointer leading-none"
                    aria-label="إزالة فلتر الدين"
                  >
                    ✕
                  </button>
                </span>
              )}
              <span className="text-[11px] font-[700] text-[#666079] mr-auto">
                {filteredCustomers.length} عميل
              </span>
            </div>
          )}

          {/* Customers Cards List */}
          {filteredCustomers.length === 0 ? (
            <div className="py-8 text-center border-[1.5px] border-dashed border-[#D4D0E0] rounded-[14px] bg-white p-5 text-[12px] font-[600] text-[#666079]">
              {selectedOrderFilter !== 'all' && debtFilter === 'all' && !addressQuery.trim() && !searchQuery.trim()
                ? 'لا يوجد عملاء مرتبطين بهذا الأوردر.'
                : activeFiltersCount > 0 || searchQuery.trim()
                ? 'مفيش عملاء مطابقين للبحث أو التصفية.'
                : 'لا يوجد عملاء مسجلين حالياً. اضغط "عميل جديد" لإضافة أول عميل.'}
            </div>
          ) : (
            <div className="w-full flex flex-col gap-[7px]">
              {filteredCustomers.map((cust) => {
                const st = customerStatsMap[cust.id] || { totalPurchases: 0, totalPaid: 0, remainingDebt: 0, itemsCount: 0 };
                const targetOrder = selectedOrderFilter !== 'all' ? state.orders.find((o) => o.id === selectedOrderFilter) : null;
                const custOrderItems = targetOrder ? targetOrder.items.filter((it) => it.requestedByCustomerId === cust.id || it.customerId === cust.id) : [];

                return (
                  <div
                    key={cust.id}
                    className="rounded-[11px] overflow-hidden border border-[#EBE6ED] bg-white shadow-[0_2px_6px_rgba(43,35,64,0.10)]"
                  >
                    <SwipeRow
                      rowKey={`cust_${cust.id}`}
                      swipeOpenKey={swipeOpenKey}
                      onOpenChange={setSwipeOpenKey}
                      onEdit={() => openEditCustomerForm(cust)}
                      onDelete={() => handleDeleteCustomer(cust)}
                      className="rounded-[11px]"
                    >
                      <div
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className="p-2.5 cursor-pointer space-y-1.5 bg-white"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-[26px] h-[26px] rounded-full bg-[#F1E8F4] text-[#5F2967] flex items-center justify-center shrink-0">
                              <Icon3D name="customers" size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="text-[11px] font-[800] text-[#211B24] truncate leading-tight">
                                  {cust.name}
                                </h4>
                                {cust.deliveryMode === 'delivery' && (
                                  <span className="text-[9px] px-1.5 py-[1px] rounded-md bg-[#E3F2EA] text-[#2F7F5F] font-[800] shrink-0 leading-none">
                                    شحن
                                  </span>
                                )}
                              </div>
                              {cust.address && !targetOrder && (
                                <span className="text-[9px] font-[400] text-[#857D89] block truncate leading-tight mt-0.5">
                                  {cust.address}
                                </span>
                              )}
                            </div>
                          </div>

                          {!targetOrder && (
                            <div className="text-left shrink-0">
                              <span className="text-[9px] font-[400] text-[#857D89] block leading-tight">
                                الدين المتبقي:
                              </span>
                              <div className={`tabular-nums leading-none mt-0.5 ${st.remainingDebt > 0 ? 'text-[#A23B5A]' : 'text-[#2F7F5F]'}`}>
                                {st.remainingDebt > 0 ? (
                                  <>
                                    <strong className="text-[11px] font-[800]">{st.remainingDebt.toLocaleString('en-US')}</strong>{' '}
                                    <span className="text-[8px] font-[600] opacity-75">{state.settings.currency}</span>
                                  </>
                                ) : (
                                  <strong className="text-[11px] font-[800]">خالص</strong>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {targetOrder ? (
                          <div className="space-y-0.5 text-[9px] font-[400] pt-1 border-t border-[#E4E1EC] text-[#857D89]">
                            <div>العنوان: <strong className="text-[#211B24] font-[700]">{cust.address || 'بدون عنوان'}</strong></div>
                            {cust.notes && <div>الملاحظات: <span className="text-[#211B24]">{cust.notes}</span></div>}
                            <div>
                              أصناف الأوردر: <strong className="text-[#5F2967] font-[700]">{custOrderItems.map((i) => i.name).join('، ')}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E4E1EC]">
                            <span className="text-[9px] font-[400] text-[#857D89]">
                              إجمالي الشراء:{' '}
                              <strong className="text-[11px] font-[800] text-[#211B24] tabular-nums">
                                {st.totalPurchases.toLocaleString('en-US')}
                              </strong>
                            </span>
                            <span className="text-[9px] font-[400] text-[#2F7F5F] text-left">
                              المسدد:{' '}
                              <strong className="text-[11px] font-[800] tabular-nums">
                                {st.totalPaid.toLocaleString('en-US')}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </SwipeRow>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Add New Customer */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddCustomerSubmit}
            className="w-full max-w-xs bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4]">
              <h3 className="font-extrabold text-sm text-[#2B2340]">
                {editingCustomerId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h3>
              <button
                type="button"
                onClick={closeCustomerForm}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">اسم العميل *</label>
              <input
                type="text"
                required
                autoFocus
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] font-bold outline-none focus:border-[#5F2967]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(toEnglishDigits(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">العنوان</label>
              <input
                type="text"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">المقاس</label>
              <input
                type="text"
                value={newCustSize}
                onChange={(e) => setNewCustSize(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">لينك الماسنجر</label>
              <input
                type="text"
                value={newCustMessenger}
                onChange={(e) => setNewCustMessenger(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">التسليم</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'delivery', label: 'توصيل (شحن)' },
                  { id: 'pickup', label: 'استلام من البيت' },
                ] as Array<{ id: DeliveryMode; label: string }>).map((opt) => {
                  const active = newCustDelivery === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewCustDelivery(active ? '' : opt.id)}
                      className={`py-2 rounded-xl border font-bold text-[12px] cursor-pointer transition ${
                        active
                          ? opt.id === 'delivery'
                            ? 'bg-[#E3F2EA] border-[#2F7F5F] text-[#2F7F5F]'
                            : 'bg-[#F1E8F4] border-[#5F2967] text-[#5F2967]'
                          : 'bg-[#F1F1FA] border-[#ECECF4] text-[#666079]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">ملاحظات</label>
              <input
                type="text"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                {editingCustomerId ? 'حفظ التعديل' : 'إضافة العميل'}
              </button>
              <button
                type="button"
                onClick={closeCustomerForm}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Collect Payment (تحصيل دفعة) */}
      {paymentCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCollectPaymentSubmit}
            className="w-full max-w-xs bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4]">
              <h3 className="font-extrabold text-sm text-[#2FA36B] flex items-center gap-1.5">
                <Icon3D name="money_in" size={20} />
                تحصيل دفعة نقدية
              </h3>
              <button
                type="button"
                onClick={() => setPaymentCustomerId(null)}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">الدفعة على أنهي صنف؟</label>
              <select
                value={paymentItemId}
                onChange={(e) => {
                  const v = e.target.value;
                  setPaymentItemId(v);
                  const d = v
                    ? paymentDebtItems.find((x) => x.id === v)?.debt || 0
                    : paymentCustomerId
                    ? customerStatsMap[paymentCustomerId]?.remainingDebt || 0
                    : 0;
                  setPaymentAmount(d > 0 ? d.toString() : '');
                }}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] font-bold outline-none"
              >
                <option value="">الأقدم أول (تلقائي)</option>
                {paymentDebtItems.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} - باقي {x.debt.toLocaleString('en-US')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-[#2B2340]">المبلغ المحصل *</label>
                <span className="text-[11px] font-[700] text-[#666079]">
                  المتبقي: <strong className="text-[#A23B5A] tabular-nums">{currentCollectingCustDebt.toLocaleString('en-US')} {state.settings.currency}</strong>
                </span>
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                max={currentCollectingCustDebt}
                required
                autoFocus
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border ${
                  isPaymentOverDebt
                    ? 'border-rose-500 bg-rose-50/50'
                    : 'border-[#ECECF4] bg-[#F1F1FA]'
                } font-black text-center text-base outline-none focus:border-[#2FA36B]`}
              />
              {isPaymentOverDebt && (
                <p className="text-[10px] text-rose-600 font-bold mt-1">
                  المبلغ يتجاوز إجمالي الدين المتبقي للعميل ({currentCollectingCustDebt.toLocaleString('en-US')} {state.settings.currency})
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">تاريخ التحصيل</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">ملاحظة</label>
              <input
                type="text"
                placeholder="طريقة التحصيل، ملاحظات..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <p className="text-[10px] text-slate-500 bg-slate-100 p-2 rounded-xl">
              * لو ما اخترتيش صنف، الدفعة بتنزل على أقدم صنف عليه باقي وبعده اللي بعده. وتقدري تلغيها بعد كده من تبويب "الدفعات".
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isPaymentOverDebt}
                className="flex-1 py-2.5 rounded-xl bg-[#2FA36B] hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                تأكيد التحصيل
              </button>
              <button
                type="button"
                onClick={() => setPaymentCustomerId(null)}
                className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Add Date-Stamped Note */}
      {noteCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddNoteSubmit}
            className="w-full max-w-xs bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4]">
              <h3 className="font-extrabold text-sm text-[#5F2967]">
                إضافة ملاحظة بتاريخ
              </h3>
              <button
                type="button"
                onClick={() => setNoteCustomerId(null)}
                className="text-[#9A98B0] hover:text-[#2B2340]"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">الملاحظة *</label>
              <textarea
                required
                rows={3}
                placeholder="مثال: وعد بدفع 500 يوم الأحد..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-[#5F2967] text-white font-bold text-xs cursor-pointer hover:bg-[#4A1E52]"
              >
                حفظ الملاحظة
              </button>
              <button
                type="button"
                onClick={() => setNoteCustomerId(null)}
                className="px-4 py-2 rounded-xl bg-[#ECECF4] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* تنبيه عدم إمكانية حذف العميل عند وجود دين */}
      {deleteModal && deleteModal.blocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#ECECF4] space-y-3.5 text-right shadow-2xl text-xs">
            <div className="flex items-center gap-2 text-[#E2574C]">
              <Icon3D name="danger" size={22} />
              <h3 className="font-extrabold text-sm text-[#2B2340]">
                لا يمكن حذف العميل
              </h3>
            </div>

            <p className="text-[12px] text-[#2B2340] leading-relaxed whitespace-pre-line">
              {deleteModal.blockedMessage}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="w-full h-[38px] rounded-xl bg-[#5F2967] hover:bg-[#4C1F53] text-white font-bold text-xs flex items-center justify-center transition cursor-pointer active:scale-95 shadow-sm"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bottom Sheet */}
      {showFilterSheet && (
        <div
          onClick={() => setShowFilterSheet(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] bg-white rounded-t-[24px] p-5 border-t border-[#D4D0E0] space-y-4 text-right text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E1EC]">
              <h3 className="font-extrabold text-[14px] text-[#5F2967]">
                تصفية العملاء
              </h3>
              <button
                type="button"
                onClick={() => setShowFilterSheet(false)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            {/* أ) الأوردر */}
            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">الأوردر</label>
              <select
                value={draftOrderFilter}
                onChange={(e) => setDraftOrderFilter(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs font-bold text-[#1F1A2E] cursor-pointer"
              >
                <option value="all">كل الأوردرات</option>
                {state.orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </div>

            {/* ب) العنوان / البلد */}
            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">العنوان / البلد</label>
              <input
                type="text"
                placeholder="مثال: بنها..."
                value={draftAddressQuery}
                onChange={(e) => setDraftAddressQuery(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs font-bold text-[#1F1A2E]"
              />
            </div>

            {/* ج) حالة الدين */}
            <div>
              <label className="block font-bold text-[#1F1A2E] mb-1">حالة الدين</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F5F4F9] border border-[#E4E1EC]">
                {([
                  { id: 'all', label: 'الكل' },
                  { id: 'debt', label: 'عليهم دين' },
                  { id: 'paid', label: 'خالص' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraftDebtFilter(opt.id)}
                    className={`py-2 rounded-lg text-[11px] font-[800] transition cursor-pointer ${
                      draftDebtFilter === opt.id
                        ? 'bg-[#5F2967] text-white shadow-xs'
                        : 'text-[#666079] hover:text-[#1F1A2E]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={applyFilterSheet}
                className="btn-primary flex-1 py-2.5 text-xs shadow-sm"
              >
                تطبيق
              </button>
              <button
                type="button"
                onClick={resetFilterSheet}
                className="px-4 py-2.5 rounded-[14px] bg-[#EDEEF2] text-[#1F1A2E] font-bold text-xs cursor-pointer hover:bg-[#E4E1EC] transition"
              >
                مسح الكل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
