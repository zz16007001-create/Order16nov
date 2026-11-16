/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OrderItem, PaymentMethod } from '../types';
import { normalizePhoneForComparison, toEnglishDigits } from '../utils/contact';

interface SaleFormProps {
  orderId: string;
  item: OrderItem;
  /** يُستدعى بعد تأكيد البيع بنجاح */
  onDone: (summary: string) => void;
  /** لو موجود يظهر زر إلغاء */
  onCancel?: () => void;
}

/**
 * نموذج تسجيل البيع الموحّد (كاش / آجل / دفع جزء + العميل).
 * مستخدم في زرار "تسجيل بيع" في الأوردرات وفي البيع السريع، عشان الاتنين يبقوا نفس الواجهة ونفس الحساب.
 */
export const SaleForm: React.FC<SaleFormProps> = ({ orderId, item, onDone, onCancel }) => {
  const { state, customers, addCustomer, registerItemSale } = useApp();

  const [salePrice, setSalePrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('نقدية (كاش)');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(item.requestedByCustomerId || item.customerId || '');
  const [partialPaidInput, setPartialPaidInput] = useState<string>('');
  const [customerSelectionMode, setCustomerSelectionMode] = useState<'registered' | 'new'>('registered');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [inlineCustName, setInlineCustName] = useState('');
  const [inlineCustPhone, setInlineCustPhone] = useState('');
  const [inlineCustSize, setInlineCustSize] = useState('');
  const [inlineCustAddress, setInlineCustAddress] = useState('');
  const [inlineCustMessenger, setInlineCustMessenger] = useState('');
  const [inlineCustNotes, setInlineCustNotes] = useState('');

  const normalizedInputPhone = normalizePhoneForComparison(inlineCustPhone);
  const existingCustomerWithPhone =
    normalizedInputPhone && normalizedInputPhone.length >= 7
      ? customers.find((c) => normalizePhoneForComparison(c.phone) === normalizedInputPhone)
      : null;

  const handleConfirmSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salePrice) return;
    const price = parseFloat(salePrice);
    if (!price || price <= 0) return;

    let custId = selectedCustomerId;
    if (customerSelectionMode === 'new' && inlineCustName.trim() && !existingCustomerWithPhone) {
      const created = addCustomer(
        inlineCustName.trim(),
        inlineCustPhone.trim() || undefined,
        inlineCustNotes.trim() || undefined,
        {
          size: inlineCustSize.trim() || undefined,
          address: inlineCustAddress.trim() || undefined,
          messengerLink: inlineCustMessenger.trim() || undefined,
        }
      );
      custId = created.id;
    } else if (customerSelectionMode === 'new' && existingCustomerWithPhone) {
      custId = existingCustomerWithPhone.id;
    }

    if ((paymentType === 'credit' || paymentType === 'partial') && !custId) {
      alert('يرجى اختيار أو إضافة العميل للبيع الآجل أو الجزئي');
      return;
    }

    const totalDue = price * (item.quantity || 1);
    const initialPaid =
      paymentType === 'cash'
        ? totalDue
        : paymentType === 'credit'
        ? 0
        : parseFloat(partialPaidInput) || 0;

    registerItemSale(
      orderId,
      item.id,
      price,
      paymentMethod,
      undefined,
      paymentType,
      custId || undefined,
      initialPaid
    );

    const typeText =
      paymentType === 'cash' ? 'كاش' : paymentType === 'credit' ? 'آجل بالكامل' : `دفع جزء (${Math.min(totalDue, initialPaid)})`;
    onDone(`تم بيع ${item.name} بمبلغ ${totalDue} ${state.settings.currency} - ${typeText}`);
  };

  return (
    <form onSubmit={handleConfirmSale} className="space-y-3.5 text-right text-xs">
            <div className="p-2 rounded-xl bg-[#F1F1FA] text-[11px] text-[#9A98B0] flex justify-between">
              <span>سعر التكلفة:</span>
              <strong className="text-[#2B2340] font-black">
                {item.costPrice} {state.settings.currency} (الكمية: {item.quantity})
              </strong>
            </div>

            {/* Selling price defaults to empty */}
            <div>
              <label className="block font-bold text-[#2B2340] mb-1">
                سعر البيع للقطعة *
              </label>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                placeholder="أدخل سعر البيع..."
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center text-[#5F2967] text-base outline-none focus:border-[#5F2967]"
              />
            </div>

            {/* Payment Type Selection: [كاش كامل] [آجل كامل] [دفع جزء] */}
            <div className="space-y-1">
              <label className="block font-bold text-[#2B2340] text-[11px]">
                طريقة الدفع *
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'cash', label: 'كاش كامل' },
                  { id: 'credit', label: 'آجل كامل' },
                  { id: 'partial', label: 'دفع جزء' },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setPaymentType(t.id as any)}
                    className={`py-2 px-1 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      paymentType === t.id
                        ? 'bg-[#5F2967] text-white border-[#5F2967] shadow-xs'
                        : 'bg-[#F1F1FA] text-[#2B2340] border-[#ECECF4]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* If partial: show input for "المدفوع الآن" */}
            {paymentType === 'partial' && (
              <div>
                <label className="block font-bold text-[#2B2340] mb-1">
                  المبلغ المدفوع الآن *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={partialPaidInput}
                  onChange={(e) => setPartialPaidInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white font-black text-center text-[#2FA36B] outline-none focus:border-[#5F2967]"
                />
                {parseFloat(salePrice) > 0 && (
                  <span className="text-[10px] text-[#E2574C] block mt-0.5 font-bold">
                    المتبقي كدين: {Math.max(0, (parseFloat(salePrice) * (item.quantity || 1)) - (parseFloat(partialPaidInput) || 0))} {state.settings.currency}
                  </span>
                )}
              </div>
            )}

            {/* Customer Selector (بند ٢) */}
            <div className="space-y-2">
              <label className="block font-bold text-[#2B2340] text-[11px]">
                العميل {paymentType !== 'cash' ? '(إجباري للأجل والجزئي) *' : '(اختياري)'}
              </label>

              {/* Segmented Control: عميل مسجل | عميل جديد */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F1FA] rounded-xl border border-[#ECECF4]">
                <button
                  type="button"
                  onClick={() => setCustomerSelectionMode('registered')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    customerSelectionMode === 'registered'
                      ? 'bg-white text-[#5F2967] shadow-xs'
                      : 'text-[#7A7585]'
                  }`}
                >
                  عميل مسجل
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerSelectionMode('new')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    customerSelectionMode === 'new'
                      ? 'bg-white text-[#5F2967] shadow-xs'
                      : 'text-[#7A7585]'
                  }`}
                >
                  عميل جديد
                </button>
              </div>

              {customerSelectionMode === 'registered' ? (
                <div className="space-y-1.5">
                  {selectedCustomerId ? (() => {
                    const cObj = customers.find((c) => c.id === selectedCustomerId);
                    if (!cObj) return null;
                    return (
                      <div className="p-2 rounded-xl bg-[#F7F2FA] border border-[#5F2967]/30 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-[#5F2967] text-xs truncate">
                              {cObj.name}
                            </span>
                            {cObj.address && (
                              <span className="text-[10px] text-[#666079] truncate max-w-[45%] shrink-0">
                                {cObj.address}
                              </span>
                            )}
                          </div>
                          {(cObj.phone || cObj.size) && (
                            <div className="text-[10px] text-[#5F2967]/80 flex items-center gap-3 mt-0.5">
                              {cObj.phone && <span>الهاتف: <strong className="font-bold">{toEnglishDigits(cObj.phone)}</strong></span>}
                              {cObj.size && <span>المقاس: <strong className="font-bold">{cObj.size}</strong></span>}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId('');
                            setCustomerSearchQuery('');
                          }}
                          className="px-2 py-1 rounded-md bg-white border border-[#ECECF4] text-[10px] font-bold text-[#5F2967] hover:bg-[#5F2967] hover:text-white transition cursor-pointer shrink-0"
                        >
                          تغيير
                        </button>
                      </div>
                    );
                  })() : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="بحث باسم أو رقم العميل..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                      />
                      <div className="max-h-36 overflow-y-auto divide-y divide-[#ECECF4] rounded-xl border border-[#ECECF4] bg-white">
                        {customers
                          .filter((c) => {
                            if (!customerSearchQuery.trim()) return true;
                            const q = customerSearchQuery.trim().toLowerCase();
                            const qDigits = toEnglishDigits(q);
                            return (
                              c.name.toLowerCase().includes(q) ||
                              (c.phone && toEnglishDigits(c.phone).includes(qDigits))
                            );
                          })
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerSearchQuery('');
                              }}
                              className="w-full px-2.5 py-1.5 text-right flex items-center justify-between gap-2 hover:bg-[#F1E8F4] transition cursor-pointer"
                            >
                              <span className="font-bold text-xs text-[#2B2340] truncate">
                                {c.name}
                              </span>
                              {c.address && (
                                <span className="text-[10px] text-[#9A98B0] truncate max-w-[45%] shrink-0">
                                  {c.address}
                                </span>
                              )}
                            </button>
                          ))}
                        {customers.filter((c) => {
                          if (!customerSearchQuery.trim()) return true;
                          const q = customerSearchQuery.trim().toLowerCase();
                          const qDigits = toEnglishDigits(q);
                          return (
                            c.name.toLowerCase().includes(q) ||
                            (c.phone && toEnglishDigits(c.phone).includes(qDigits))
                          );
                        }).length === 0 && (
                          <div className="p-2 text-center text-[10px] text-[#9A98B0]">
                            لا يوجد عميل مطابق
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-[#F7F7FA] border border-[#5F2967]/30 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] font-bold text-[#7A7585] mb-0.5">
                        الاسم *
                      </label>
                      <input
                        type="text"
                        required={paymentType !== 'cash'}
                        value={inlineCustName}
                        onChange={(e) => setInlineCustName(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#7A7585] mb-0.5">
                        العنوان
                      </label>
                      <input
                        type="text"
                        value={inlineCustAddress}
                        onChange={(e) => setInlineCustAddress(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] font-bold text-[#7A7585] mb-0.5">
                        رقم الهاتف
                      </label>
                      <input
                        type="tel"
                        value={inlineCustPhone}
                        onChange={(e) => setInlineCustPhone(toEnglishDigits(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#7A7585] mb-0.5">
                        المقاس
                      </label>
                      <input
                        type="text"
                        value={inlineCustSize}
                        onChange={(e) => setInlineCustSize(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                      />
                    </div>
                  </div>

                  {/* تنبيه تكرار الهاتف وزر استخدام العميل الموجود */}
                  {existingCustomerWithPhone && (
                    <div className="p-2 rounded-lg bg-[#FFF8E1] border border-[#FFE082] text-[11px] text-[#8D6E14] space-y-1">
                      <div className="font-bold">
                        ⚠️ هذا الرقم مسجل بالفعل للعميل: <strong>{existingCustomerWithPhone.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(existingCustomerWithPhone.id);
                          setCustomerSelectionMode('registered');
                        }}
                        className="w-full py-1 rounded bg-[#8D6E14] text-white font-bold text-[10px] hover:bg-[#70540C] cursor-pointer"
                      >
                        استخدام العميل الموجود
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-[#7A7585] mb-0.5">
                      رابط ماسنجر
                    </label>
                    <input
                      type="url"
                      value={inlineCustMessenger}
                      onChange={(e) => setInlineCustMessenger(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#7A7585] mb-0.5">
                      ملاحظات
                    </label>
                    <input
                      type="text"
                      value={inlineCustNotes}
                      onChange={(e) => setInlineCustNotes(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#2B2340] mb-1">طريقة استلام النقدية</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-[#ECECF4] bg-white text-xs font-bold outline-none focus:border-[#5F2967]"
              >
                <option value="نقدية (كاش)">نقدية (كاش)</option>
                <option value="إنستاباي">إنستاباي</option>
                <option value="فودافون كاش">فودافون كاش</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-black text-xs transition cursor-pointer shadow-xs"
        >
          تأكيد البيع
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-[#ECECF4] text-[#2B2340] font-bold text-xs cursor-pointer"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
};
