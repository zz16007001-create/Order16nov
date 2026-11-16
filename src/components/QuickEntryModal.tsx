/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { stripBagDisplayPrefix } from '../utils/arabicText';
import { BagExpenseRoute, PocketCategory, TreasurySourceType } from '../types';
import { Icon3D, Icon3DName } from './icons3d/Icon3D';
import { SaleForm } from './SaleForm';
import { OfficeItemFormFields } from './OfficeItemFormFields';
import { getNextOrderNumber, parseOrderNumber } from '../utils/orderNumber';
import { getBagDestinationAvailable } from '../utils/bagAvailability';
import { getPocketRemaining } from '../utils/pocketMath';
import { useConfirmDelete } from './ConfirmDeleteDialog';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'bag_balances',
}) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
    setSuccessMessage(null);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 1200);
  };

  const tabs: Array<{ id: string; label: string; iconName: Icon3DName }> = [
    { id: 'bag_balances', label: 'رصيد الشنطة', iconName: 'wallet' },
    { id: 'bag_expense', label: 'مصروف شنطة', iconName: 'bag' },
    { id: 'salary_expense', label: 'مصروفات القبض', iconName: 'salary' },
    { id: 'office_item', label: 'تجهيز مكاتب', iconName: 'offices' },
    { id: 'create_order', label: 'إنشاء أوردر', iconName: 'create_order' },
    { id: 'sell_item', label: 'تسجيل بيع', iconName: 'sell' },
    { id: 'advances_and_settlements', label: 'سلف وتسويات', iconName: 'advance' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg card-regular rounded-[24px] shadow-2xl my-auto overflow-hidden text-right flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#D4D0E0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Icon3D name="app_logo" size={24} />
            <h2 className="text-sm font-extrabold text-[#5F2967]">
              نافذة التسجيل السريع
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <Icon3D name="close" size={18} />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="px-3 py-2 border-b border-[#ECECF4] overflow-x-auto shrink-0 flex items-center gap-1.5 bg-white">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSuccessMessage(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#5F2967] text-white shadow-xs'
                    : 'text-[#2B2340] hover:bg-[#F1F1FA]'
                }`}
              >
                <Icon3D name={tab.iconName} size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Form */}
        <div className="p-4 overflow-y-auto flex-1">
          {successMessage ? (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
              <Icon3D name="check" size={48} />
              <p className="text-sm font-black text-[#2FA36B]">{successMessage}</p>
            </div>
          ) : (
            <>
              {activeTab === 'bag_balances' && <BagBalancesForm onDone={showSuccess} />}
              {activeTab === 'bag_expense' && <BagExpenseForm onDone={showSuccess} />}
              {activeTab === 'salary_expense' && <SalaryExpenseQuickForm onDone={showSuccess} />}
              {activeTab === 'office_item' && <OfficeItemForm onDone={showSuccess} onCancel={onClose} />}
              {activeTab === 'create_order' && <CreateOrderForm onDone={showSuccess} />}
              {activeTab === 'sell_item' && <SellItemForm onDone={showSuccess} />}
              {activeTab === 'advances_and_settlements' && <UnifiedAdvancesForm onDone={showSuccess} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Salary Expense Quick Form
// ==========================================
const SalaryExpenseQuickForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, recordSalaryExpense } = useApp();
  const sortedBudget = React.useMemo(() => {
    const pocketItem = state.salaryBudget.find((b) => b.isPocketSupport || b.isSystem);
    const regular = state.salaryBudget.filter((b) => !b.isPocketSupport && !b.isSystem);
    const safePocket = pocketItem
      ? { ...pocketItem, name: 'دعم بوكيت', isPocketSupport: true, isSystem: true }
      : { id: 'sb_pocket_support', name: 'دعم بوكيت', budgeted: 0, spent: 0, isPocketSupport: true, isSystem: true };
    return [...regular, safePocket];
  }, [state.salaryBudget]);

  const [selectedItemId, setSelectedItemId] = useState(sortedBudget[0]?.id || '');
  const [amount, setAmount] = useState('');

  const selectedItem = sortedBudget.find((b) => b.id === selectedItemId);
  const enteredAmount = parseFloat(amount);
  const isOverBudgeted = !!selectedItem && !isNaN(enteredAmount) && enteredAmount > selectedItem.budgeted;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!selectedItemId || !num || num <= 0) return;
    recordSalaryExpense(selectedItemId, num, false, undefined);
    onDone(`تم تسجيل صرف ${num} ${state.settings.currency} على بند ${selectedItem?.name || ''}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      <div>
        <label className="block font-bold text-[#2B2340] mb-1">اختر بند القبض *</label>
        <select
          required
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967]"
        >
          {sortedBudget.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} (المعيّن: {b.budgeted} | المتبقي: {b.budgeted - b.spent} {state.settings.currency})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-bold text-[#2B2340] mb-1">المبلغ المراد صرفه *</label>
        <input
          type="number"
          step="any"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center text-base outline-none focus:border-[#5F2967]"
        />
        {isOverBudgeted && (
          <p className="text-[11px] font-bold text-[#C0394F] mt-1 leading-snug">
            تنبيه: المبلغ أكبر من المبلغ المعيّن لهذا البند. راجع المبلغ لتجنب التسجيل الخاطئ
          </p>
        )}
      </div>

      {selectedItem && (selectedItem.isPocketSupport || selectedItem.isSystem) && (
        <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] leading-relaxed">
          * الصرف على بند "دعم بوكيت" يتم ترحيله فورياً كحركة دعم وإيداع في خزنة بوكيت ويزيد رصيدها تلقائياً.
        </div>
      )}

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        تسجيل مصروف القبض
      </button>
    </form>
  );
};

// ==========================================
// 1. FORM: Bag Balances (رصيد الشنطة)
// ==========================================
const BagBalancesForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, updateBagSources } = useApp();
  const { confirmDelete } = useConfirmDelete();

  const initialSources = (() => {
    const existing = state.currentTrip.sources || [];
    if (existing.length === 0) {
      return [
        { id: 'src_cap', sourceName: 'رأس المال', amount: 0, treasuryType: 'capital' as TreasurySourceType },
        { id: 'src_sal', sourceName: 'القبض', amount: 0, treasuryType: 'salary' as TreasurySourceType },
      ];
    }
    return existing;
  })();

  const [sources, setSources] = useState(initialSources);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceAmount, setNewSourceAmount] = useState('');
  const [newSourceTreasury, setNewSourceTreasury] = useState<TreasurySourceType>('other');
  const [showAdd, setShowAdd] = useState(false);

  const handleAmountChange = (id: string, amount: number) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, amount } : s)));
  };

  const handleDelete = (id: string) => {
    if (sources.length <= 1) return;
    const target = sources.find((s) => s.id === id);
    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف مصدر "${target?.sourceName || 'المصدر'}"؟`,
      onConfirm: () => {
        setSources((prev) => prev.filter((s) => s.id !== id));
      },
    });
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    const newSrc = {
      id: 'src_' + Date.now(),
      sourceName: newSourceName.trim(),
      amount: parseFloat(newSourceAmount) || 0,
      treasuryType: newSourceTreasury,
    };
    setSources((prev) => [...prev, newSrc]);
    setNewSourceName('');
    setNewSourceAmount('');
    setShowAdd(false);
  };

  const handleSave = () => {
    updateBagSources(sources);
    const total = sources.reduce((s, c) => s + (c.amount || 0), 0);
    onDone(`تم حفظ رصيد الشنطة: ${total.toLocaleString('en-US')} ${state.settings.currency}`);
  };

  const total = sources.reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="font-bold text-[#2B2340]">نقدية الشنطة الحالية:</span>
        <span className="font-extrabold text-[#5F2967] tabular-nums">
          الإجمالي: {total.toLocaleString('en-US')} {state.settings.currency}
        </span>
      </div>

      <div className="space-y-2">
        {sources.map((src) => (
          <div
            key={src.id}
            className="p-3 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon3D
                name={
                  src.sourceName.includes('رأس المال')
                    ? 'capital'
                    : src.sourceName.includes('القبض')
                    ? 'salary'
                    : src.sourceName.includes('بوكيت')
                    ? 'pocket'
                    : 'wallet'
                }
                size={24}
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#2B2340] block truncate">
                  {src.sourceName}
                </span>
                <span className="text-[10px] text-[#9A98B0]">
                  {src.treasuryType === 'capital' || src.sourceName.includes('رأس المال')
                    ? 'خزينة رأس المال'
                    : src.treasuryType === 'salary' || src.sourceName.includes('القبض')
                    ? 'خزينة القبض'
                    : 'مصدر عهدة'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={src.amount === 0 ? '' : src.amount}
                onChange={(e) => handleAmountChange(src.id, parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-1.5 text-center font-black text-xs rounded-xl border border-[#ECECF4] bg-white text-[#2B2340] outline-none focus:border-[#5F2967]"
              />
              {sources.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleDelete(src.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                  title="حذف"
                >
                  <Icon3D name="trash" size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <form onSubmit={handleAddSource} className="p-3.5 rounded-2xl bg-white border border-[#5F2967] space-y-2.5 text-xs">
          <input
            type="text"
            required
            placeholder="اسم المصدر..."
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              placeholder="المبلغ"
              value={newSourceAmount}
              onChange={(e) => setNewSourceAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs font-bold text-center bg-white"
            />
            <select
              value={newSourceTreasury}
              onChange={(e) => setNewSourceTreasury(e.target.value as TreasurySourceType)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
            >
              <option value="other">عهدة أخرى</option>
              <option value="pocket">بوكيت</option>
              <option value="capital">رأس المال</option>
              <option value="salary">القبض</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 rounded-xl bg-[#5F2967] text-white font-bold text-xs cursor-pointer">
              إضافة المصدر
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-xl bg-[#ECECF4] text-xs cursor-pointer">
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 rounded-2xl border-2 border-dashed border-[#5F2967]/30 text-[#5F2967] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#5F2967]/5 transition cursor-pointer"
        >
          <Icon3D name="plus" size={16} />
          <span>إضافة مصدر نقدية جديد</span>
        </button>
      )}

      <button
        type="button"
        onClick={handleSave}
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        حفظ وتحديث نقدية الشنطة
      </button>
    </div>
  );
};

// ==========================================
// 2. FORM: Bag Expense (مصروف شنطة)
// تعديل المرحلة 3: شيل التصنيف السريع، المبلغ والبيان في صف واحد، مسمى "قبض"
// ==========================================
const BagExpenseForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, pocketBalance, liquidity, addBagExpense } = useApp();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [route, setRoute] = useState<BagExpenseRoute>('unclassified');
  const [targetId, setTargetId] = useState('');

  const currentAvailable = React.useMemo(
    () =>
      getBagDestinationAvailable({
        route,
        targetId: targetId || undefined,
        expenses: state.currentTrip.expenses,
        salaryBudget: state.salaryBudget,
        pocketBalance,
        liquidity,
      }),
    [route, targetId, state.currentTrip.expenses, state.salaryBudget, pocketBalance, liquidity]
  );

  const parsedAmt = parseFloat(amount) || 0;
  const overageAmt =
    currentAvailable !== null && parsedAmt > currentAvailable + 0.001
      ? parsedAmt - currentAvailable
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0 || !description.trim()) return;

    let targetName: string | undefined = undefined;
    if (route === 'order') {
      const order = state.orders.find((o) => o.id === targetId);
      targetName = order ? order.code : undefined;
    } else if (route === 'salary') {
      const bItem = state.salaryBudget.find((b) => b.id === targetId);
      targetName = bItem ? bItem.name : undefined;
    }

    addBagExpense({
      amount: num,
      description: description.trim(),
      route,
      targetId: targetId || undefined,
      targetName,
    });
    onDone('تم تسجيل مصروف الشنطة بنجاح');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      {/* صف واحد: المبلغ وجنبه التفاصيل والبيان */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <label className="block font-bold text-[#2B2340] mb-1">المبلغ *</label>
          <input
            type="number"
            step="any"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center outline-none focus:border-[#5F2967]"
          />
          {overageAmt > 0 && (
            <p className="text-[10px] font-bold text-[#D97706] mt-1 leading-snug">
              يتجاوز المتاح بـ {overageAmt.toLocaleString('en-US')} {state.settings.currency}
            </p>
          )}
        </div>
        <div className="col-span-3">
          <label className="block font-bold text-[#2B2340] mb-1">التفاصيل والبيان *</label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="شحن، كارتة، غداء..."
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white outline-none focus:border-[#5F2967]"
          />
        </div>
      </div>

      {/* توجيه المصروف مع مسمى "قبض" بدل "بند ميزانية" */}
      <div className="p-3.5 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4] space-y-2.5">
        <label className="block font-extrabold text-[#2B2340]">توجيه التكلفة:</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'unclassified', label: 'غير مصنف' },
            { id: 'order', label: 'أوردر' },
            { id: 'salary', label: 'قبض' }, // مسمى "قبض"
            { id: 'pocket_advance', label: 'سلفة بوكيت' },
            { id: 'capital_advance', label: 'سلفة رأس مال' },
            { id: 'capital_settlement', label: 'تسوية رأس مال' },
          ].map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => {
                setRoute(r.id as BagExpenseRoute);
                setTargetId('');
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold text-center border transition cursor-pointer ${
                route === r.id
                  ? 'bg-[#5F2967] text-white border-[#5F2967] shadow-xs'
                  : 'bg-white text-[#2B2340] border-[#ECECF4]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {route === 'order' && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
          >
            <option value="">-- اختر الأوردر المرتبط --</option>
            {state.orders.map((o) => (
              <option key={o.id} value={o.id}>{o.code}</option>
            ))}
          </select>
        )}

        {route === 'salary' && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
          >
            <option value="">-- اختر بند القبض --</option>
            {state.salaryBudget.map((b) => {
              const avail =
                getBagDestinationAvailable({
                  route: 'salary',
                  targetId: b.id,
                  expenses: state.currentTrip.expenses,
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
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        تسجيل المصروف
      </button>
    </form>
  );
};

// ==========================================
// 3. FORM: Office Item (تجهيز مكاتب)
// ==========================================
const OfficeItemForm: React.FC<{ onDone: (msg: string) => void; onCancel?: () => void }> = ({ onDone, onCancel }) => {
  return <OfficeItemFormFields variant="modal" onDone={onDone} onCancel={onCancel} />;
};

// ==========================================
// 4. FORM: Create Order (إنشاء أوردر)
// ==========================================
const CreateOrderForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state, liquidity, createNewOrder } = useApp();
  const { confirmDelete } = useConfirmDelete();
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ name: string; quantity: number; costPrice: number }>>([
    { name: '', quantity: 1, costPrice: 0 },
  ]);

  const suggestedOrderNumber = getNextOrderNumber(state.orders, state.orderCounter);

  const addItemRow = () => {
    setItems([...items, { name: '', quantity: 1, costPrice: 0 }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    const target = items[idx];
    confirmDelete({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف الصنف "${target?.name?.trim() || `رقم ${idx + 1}`}" من القائمة؟`,
      onConfirm: () => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
      },
    });
  };

  const totalCost = items.reduce((s, it) => s + (it.costPrice || 0) * (it.quantity || 1), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.name.trim() !== '' && it.costPrice > 0);
    if (validItems.length === 0) return;
    const enteredCode = code.trim();
    const displayCode = enteredCode || `أوردر رقم ${suggestedOrderNumber}`;
    createNewOrder(enteredCode, validItems, notes.trim() || undefined);
    onDone(`تم إنشاء ${displayCode} بتكلفة ${totalCost} ${state.settings.currency}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
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
          placeholder={`أوردر رقم ${suggestedOrderNumber}`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] font-bold outline-none focus:border-[#5F2967]"
        />
        <input
          type="text"
          placeholder="ملاحظات اختيارية..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] outline-none"
        />
      </div>

      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              type="text"
              required
              placeholder="اسم الصنف / الموديل..."
              value={item.name}
              onChange={(e) => {
                const c = [...items];
                c[idx].name = e.target.value;
                setItems(c);
              }}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] text-xs font-bold outline-none"
            />
            <input
              type="number"
              min="1"
              placeholder="العدد"
              value={item.quantity}
              onChange={(e) => {
                const c = [...items];
                c[idx].quantity = parseInt(e.target.value) || 1;
                setItems(c);
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
                const c = [...items];
                c[idx].costPrice = parseFloat(e.target.value) || 0;
                setItems(c);
              }}
              className="w-24 px-2 py-1.5 rounded-xl border border-[#ECECF4] bg-[#F1F1FA] text-center font-black text-[#5F2967] outline-none"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItemRow(idx)}
                className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                title="حذف"
              >
                <Icon3D name="trash" size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={addItemRow}
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
  );
};

// ==========================================
// 5. FORM: Sell Item (تسجيل بيع)
// ==========================================
const SellItemForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const { state } = useApp();
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isOrderPickerOpen, setIsOrderPickerOpen] = useState(false);

  const sortedOrders = React.useMemo(() => {
    return [...state.orders].sort((a, b) => {
      const numA = parseOrderNumber(a.code);
      const numB = parseOrderNumber(b.code);
      if (numA !== numB) {
        return numB - numA;
      }
      return b.id.localeCompare(a.id);
    });
  }, [state.orders]);

  const currentOrder = state.orders.find((o) => o.id === selectedOrderId);
  const currentOrderUnsold =
    currentOrder?.items.filter((i) => !i.isSold && i.name.trim() !== 'مصاريف').length || 0;
  const unsoldItems = currentOrder?.items.filter((it) => !it.isSold && it.name.trim() !== 'مصاريف') || [];
  const selectedItem = currentOrder?.items.find((it) => it.id === selectedItemId);

  return (
    <div className="space-y-3.5 text-xs">
      <div>
        <label className="block font-bold text-[#2B2340] mb-1">اختر الأوردر *</label>
        <button
          type="button"
          onClick={() => setIsOrderPickerOpen(true)}
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967] flex items-center justify-between gap-2 text-right cursor-pointer"
        >
          {currentOrder ? (
            <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[11px] font-bold text-[#1F1A2E] shrink-0">
                  {currentOrder.code}
                </span>
                {currentOrder.notes && (
                  <span className="text-[11px] font-normal text-[#666079] truncate">
                    {currentOrder.notes}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-bold tabular-nums shrink-0 ${
                  currentOrderUnsold === 0 ? 'text-[#9A98B0]' : 'text-[#5F2967]'
                }`}
              >
                ({currentOrderUnsold})
              </span>
            </div>
          ) : (
            <span className="text-[#666079]">-- اختر الأوردر --</span>
          )}
          <span className="text-[10px] text-[#666079] shrink-0">▼</span>
        </button>
      </div>

      {isOrderPickerOpen && (
        <div
          onClick={() => setIsOrderPickerOpen(false)}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] bg-white rounded-t-[24px] border-t border-[#D4D0E0] max-h-[75vh] flex flex-col shadow-2xl text-right"
          >
            <div className="px-4 py-3 border-b border-[#E4E1EC] flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-[14px] text-[#5F2967]">اختر الأوردر</h3>
              <button
                type="button"
                onClick={() => setIsOrderPickerOpen(false)}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer border-0 bg-transparent"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-[#ECECF4] flex-1">
              {sortedOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#666079]">لا توجد أوردرات مسجلة</div>
              ) : (
                sortedOrders.map((o) => {
                  const unsold = o.items.filter((i) => !i.isSold && i.name.trim() !== 'مصاريف').length;
                  const isSelected = o.id === selectedOrderId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrderId(o.id);
                        setSelectedItemId('');
                        setIsOrderPickerOpen(false);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-right transition cursor-pointer ${
                        unsold === 0 ? 'opacity-50' : ''
                      } ${isSelected ? 'bg-[#F1E8F4]' : 'hover:bg-[#F8F8FC]'}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-bold text-[11px] text-[#1F1A2E] shrink-0">
                          {o.code}
                        </span>
                        {o.notes && (
                          <span className="text-[11px] font-normal text-[#666079] truncate">
                            {o.notes}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-bold tabular-nums shrink-0 ${
                          unsold === 0 ? 'text-[#9A98B0]' : 'text-[#5F2967]'
                        }`}
                      >
                        ({unsold})
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOrderId && (
        <div>
          <label className="block font-bold text-[#2B2340] mb-1">اختر الصنف المراد بيعه *</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967]"
          >
            <option value="">-- اختر الصنف --</option>
            {unsoldItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}{it.size ? ` - مقاس ${it.size}` : ''} (التكلفة: {it.costPrice} - العدد: {it.quantity})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* نفس نموذج البيع بتاع زرار "تسجيل بيع" في الأوردرات */}
      {selectedItem && (
        <SaleForm key={selectedItem.id} orderId={selectedOrderId} item={selectedItem} onDone={onDone} />
      )}
    </div>
  );
};

// ==========================================
// 6. FORM: Unified Advances & Settlements (السلف والتسويات)
// تعديل المرحلة 3: شيل شبكة الكروت، زرين كبار "سلفة" | "سداد"
// ==========================================
const UnifiedAdvancesForm: React.FC<{ onDone: (msg: string) => void }> = ({ onDone }) => {
  const {
    state,
    addCapitalAdvance,
    addCapitalSettlement,
    addCapitalRepayment,
    addPocketWithdrawal,
    addPocketRepayment,
    quickModalPreset,
  } = useApp();

  // Top toggle: سلفة vs سداد (لو اتفتحت من زرار «سداد» جوه كارت سلفة بتبدأ على السداد مباشرة)
  const [mainMode, setMainMode] = useState<'advance' | 'repay'>(quickModalPreset?.mode ?? 'advance');

  // Sub operations
  const [advanceSubOp, setAdvanceSubOp] = useState<'pocket_withdrawal' | 'capital_advance' | 'capital_settlement'>('pocket_withdrawal');
  const [repaySubOp, setRepaySubOp] = useState<'pocket_repay' | 'capital_repay'>('pocket_repay');

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pocketCategory, setPocketCategory] = useState<PocketCategory>('ترفيه/أخرى');
  const [isForPocketCompensation, setIsForPocketCompensation] = useState(false);
  const [pocketTxId, setPocketTxId] = useState(quickModalPreset?.pocketTxId ?? '');
  const [repaySource, setRepaySource] = useState<'salary' | 'cash' | 'other'>('salary');
  const [salaryBudgetItemId, setSalaryBudgetItemId] = useState('');

  const openPocketWithdrawals = state.pocketTransactions.filter(
    (p) => p.type === 'withdrawal' && p.status !== 'مسدد بالكامل' && getPocketRemaining(p) > 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    if (mainMode === 'advance') {
      if (advanceSubOp === 'pocket_withdrawal') {
        addPocketWithdrawal(amt, pocketCategory, description || 'سحب من بوكيت');
        onDone(`تم سحب ${amt} ${state.settings.currency} من بوكيت`);
      } else if (advanceSubOp === 'capital_advance') {
        addCapitalAdvance(amt, description || 'سلفة رأس مال', isForPocketCompensation);
        onDone(`تم تسجيل سلفة رأس مال بمبلغ ${amt} ${state.settings.currency}`);
      } else if (advanceSubOp === 'capital_settlement') {
        addCapitalSettlement(amt, description || 'تسوية رأس مال');
        onDone(`تم تسجيل تسوية رأس مال بمبلغ ${amt} ${state.settings.currency}`);
      }
    } else {
      if (repaySubOp === 'pocket_repay') {
        if (!pocketTxId) return;
        addPocketRepayment(
          pocketTxId,
          amt,
          description,
          repaySource === 'salary' ? 'من القبض' : 'نقدية',
          repaySource,
          repaySource === 'salary' ? salaryBudgetItemId : undefined
        );
        onDone(`تم تسجيل سداد سلفة بوكيت بمبلغ ${amt} ${state.settings.currency}`);
      } else if (repaySubOp === 'capital_repay') {
        addCapitalRepayment(amt, description || 'سداد سلفة رأس مال');
        onDone(`تم سداد سلفة رأس مال بمبلغ ${amt} ${state.settings.currency}`);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      {/* 1. الزران الكبيران: سلفة | سداد */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4]">
        <button
          type="button"
          onClick={() => {
            setMainMode('advance');
            setAmount('');
          }}
          className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            mainMode === 'advance'
              ? 'bg-[#5F2967] text-white shadow-sm'
              : 'text-[#2B2340] hover:bg-white/50'
          }`}
        >
          سلفة
        </button>
        <button
          type="button"
          onClick={() => {
            setMainMode('repay');
            setAmount('');
          }}
          className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            mainMode === 'repay'
              ? 'bg-[#5F2967] text-white shadow-sm'
              : 'text-[#2B2340] hover:bg-white/50'
          }`}
        >
          سداد
        </button>
      </div>

      {/* 2. الخيارات المتاحة حسب الوضع */}
      {mainMode === 'advance' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'pocket_withdrawal', label: 'سلفة بوكيت' },
            { id: 'capital_advance', label: 'سلفة رأس مال' },
            { id: 'capital_settlement', label: 'تسوية رأس مال' },
          ].map((op) => (
            <button
              type="button"
              key={op.id}
              onClick={() => setAdvanceSubOp(op.id as any)}
              className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition cursor-pointer ${
                advanceSubOp === op.id
                  ? 'bg-purple-100 text-[#5F2967] border-[#5F2967] font-black'
                  : 'bg-white text-[#2B2340] border-[#ECECF4]'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'pocket_repay', label: 'سداد سلفة بوكيت' },
            { id: 'capital_repay', label: 'سداد سلفة رأس مال' },
          ].map((op) => (
            <button
              type="button"
              key={op.id}
              onClick={() => setRepaySubOp(op.id as any)}
              className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition cursor-pointer ${
                repaySubOp === op.id
                  ? 'bg-purple-100 text-[#5F2967] border-[#5F2967] font-black'
                  : 'bg-white text-[#2B2340] border-[#ECECF4]'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. حقول الإدخال */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block font-bold text-[#2B2340] mb-1">المبلغ *</label>
          <input
            type="number"
            step="any"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center outline-none focus:border-[#5F2967]"
          />
        </div>
        {mainMode === 'advance' && advanceSubOp === 'pocket_withdrawal' && (
          <div>
            <label className="block font-bold text-[#2B2340] mb-1">التصنيف</label>
            <select
              value={pocketCategory}
              onChange={(e) => setPocketCategory(e.target.value as PocketCategory)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white outline-none"
            >
              <option value="التزامات قبض">التزامات قبض</option>
              <option value="موسمي">موسمي</option>
              <option value="جديد/غير دائم">جديد/غير دائم</option>
              <option value="ترفيه/أخرى">ترفيه/أخرى</option>
            </select>
          </div>
        )}
      </div>

      {mainMode === 'repay' && repaySubOp === 'pocket_repay' && (
        <div className="p-3.5 rounded-2xl bg-[#F1F1FA] border border-[#ECECF4] space-y-2.5">
          <div>
            <label className="block font-bold text-[#2B2340] mb-1">اختر السلفة المراد سدادها *</label>
            <select
              required
              value={pocketTxId}
              onChange={(e) => setPocketTxId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
            >
              <option value="">-- اختر السلفة --</option>
              {openPocketWithdrawals.map((w) => {
                const rem = getPocketRemaining(w);
                return (
                  <option key={w.id} value={w.id}>
                    {stripBagDisplayPrefix(w.description)} (المتبقي: {rem} {state.settings.currency})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-[#2B2340] mb-1">مصدر السداد</label>
              <select
                value={repaySource}
                onChange={(e) => setRepaySource(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
              >
                <option value="salary">من القبض</option>
                <option value="cash">نقدية كاش</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            {repaySource === 'salary' && (
              <div>
                <label className="block font-bold text-[#2B2340] mb-1">بند القبض *</label>
                <select
                  required
                  value={salaryBudgetItemId}
                  onChange={(e) => setSalaryBudgetItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] text-xs bg-white"
                >
                  <option value="">-- اختر البند --</option>
                  {state.salaryBudget.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (المتبقي: {b.budgeted - b.spent})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {mainMode === 'advance' && advanceSubOp === 'capital_advance' && (
        <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={isForPocketCompensation}
            onChange={(e) => setIsForPocketCompensation(e.target.checked)}
            className="w-4 h-4 rounded text-amber-600"
          />
          <span>سلفة لتعويض عجز بوكيت</span>
        </label>
      )}

      <div>
        <label className="block font-bold text-[#2B2340] mb-1">البيان والتفاصيل</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="تفاصيل الحركة..."
          className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
      >
        حفظ العملية
      </button>
    </form>
  );
};
