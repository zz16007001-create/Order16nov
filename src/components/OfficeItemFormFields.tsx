/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DeliveryMode, OfficeItem } from '../types';
import { DeliveryChoice } from './DeliveryChoice';
import { Icon3D } from './icons3d/Icon3D';
import { normalizePhoneForComparison, toEnglishDigits } from '../utils/contact';

interface OfficeItemFormProps {
  editingItem?: OfficeItem | null;
  onDone: (msg: string) => void;
  onCancel?: () => void;
  /** Render inside a standalone card (OfficesPage) vs directly inside QuickEntryModal body */
  variant?: 'card' | 'modal';
}

export const OfficeItemFormFields: React.FC<OfficeItemFormProps> = ({
  editingItem,
  onDone,
  onCancel,
  variant = 'card',
}) => {
  const { state, customers, addOfficeItem, updateOfficeItem } = useApp();

  const registeredOffices =
    state.settings.registeredOffices && state.settings.registeredOffices.length > 0
      ? state.settings.registeredOffices
      : ['مكتب النزهة', 'مكتب وسط البلد', 'مكتب العتبة'];

  const resolveContact = (item: OfficeItem) => {
    let cust = item.customerId ? customers.find((c) => c.id === item.customerId) : undefined;
    if (!cust && item.customerPhone) {
      const norm = normalizePhoneForComparison(item.customerPhone);
      if (norm && norm.length >= 7) {
        cust = customers.find((c) => normalizePhoneForComparison(c.phone) === norm);
      }
    }
    if (!cust && item.customerName) {
      cust = customers.find((c) => c.name.trim().toLowerCase() === item.customerName?.trim().toLowerCase());
    }
    return {
      phone: cust?.phone || item.customerPhone,
      address: cust?.address || item.customerAddress,
      messenger: cust?.messengerLink || item.messengerLink || item.contactUrl,
      delivery: cust?.deliveryMode || item.deliveryMode,
    };
  };

  const [formOfficeName, setFormOfficeName] = useState(registeredOffices[0] || '');
  const [formItemName, setFormItemName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formGuideSellPrice, setFormGuideSellPrice] = useState('');
  const [formDeliveryFee, setFormDeliveryFee] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerAddress, setFormCustomerAddress] = useState('');
  const [formCustomerSize, setFormCustomerSize] = useState('');
  const [formMessengerLink, setFormMessengerLink] = useState('');
  const [formDelivery, setFormDelivery] = useState<DeliveryMode | ''>('');
  const [formNotes, setFormNotes] = useState('');
  const [customerFormMode, setCustomerFormMode] = useState<'new' | 'registered'>('new');
  const [selectedRegisteredCustomerId, setSelectedRegisteredCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  useEffect(() => {
    if (editingItem) {
      const contact = resolveContact(editingItem);
      setFormOfficeName(editingItem.officeName);
      setFormItemName(editingItem.itemName);
      setFormQuantity(editingItem.quantity.toString());
      setFormCostPrice(editingItem.costPrice.toString());
      setFormGuideSellPrice(editingItem.guideSellPrice !== undefined ? editingItem.guideSellPrice.toString() : '');
      setFormDeliveryFee(editingItem.deliveryFee !== undefined ? editingItem.deliveryFee.toString() : '');
      setFormCustomerName(editingItem.customerName || '');
      setFormCustomerPhone(toEnglishDigits(contact.phone || ''));
      setFormCustomerAddress(contact.address || '');
      setFormCustomerSize(editingItem.customerSize || '');
      setFormMessengerLink(contact.messenger || '');
      setFormDelivery(contact.delivery || '');
      setFormNotes(editingItem.notes || '');
      if (editingItem.customerId) {
        setCustomerFormMode('registered');
        setSelectedRegisteredCustomerId(editingItem.customerId);
      } else {
        setCustomerFormMode('new');
        setSelectedRegisteredCustomerId('');
      }
      setCustomerSearchTerm('');
    } else {
      setFormOfficeName(registeredOffices[0] || '');
      setFormItemName('');
      setFormQuantity('1');
      setFormCostPrice('');
      setFormGuideSellPrice('');
      setFormDeliveryFee('');
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormCustomerAddress('');
      setFormCustomerSize('');
      setFormMessengerLink('');
      setFormDelivery('');
      setFormNotes('');
      setCustomerFormMode('new');
      setSelectedRegisteredCustomerId('');
      setCustomerSearchTerm('');
    }
  }, [editingItem]);

  const matchingCustomers = useMemo(() => {
    if (customerFormMode !== 'registered') return [];
    const term = customerSearchTerm.trim().toLowerCase();
    const termDigits = toEnglishDigits(term);
    if (!term) return customers.slice(0, 10);
    return customers
      .filter((c) => c.name.toLowerCase().includes(term) || (c.phone && toEnglishDigits(c.phone).includes(termDigits)))
      .slice(0, 15);
  }, [customers, customerSearchTerm, customerFormMode]);

  const handleSelectRegisteredCustomer = (cust: typeof customers[0]) => {
    setSelectedRegisteredCustomerId(cust.id);
    setFormCustomerName(cust.name);
    setFormCustomerPhone(toEnglishDigits(cust.phone || ''));
    setFormCustomerAddress(cust.address || '');
    setFormCustomerSize(cust.size || '');
    setFormMessengerLink(cust.messengerLink || '');
    setFormDelivery(cust.deliveryMode || '');
    setCustomerSearchTerm('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOfficeName || !formItemName.trim() || !formCostPrice) return;

    const isReg = customerFormMode === 'registered' && selectedRegisteredCustomerId;
    const finalCustomerId = isReg ? selectedRegisteredCustomerId : undefined;

    const itemData = {
      officeName: formOfficeName,
      itemName: formItemName.trim(),
      quantity: parseInt(formQuantity) || 1,
      costPrice: parseFloat(formCostPrice) || 0,
      guideSellPrice: formGuideSellPrice.trim() ? parseFloat(formGuideSellPrice) : undefined,
      deliveryFee:
        formDelivery === 'delivery' && formDeliveryFee.trim() ? parseFloat(formDeliveryFee) : undefined,
      customerName: formCustomerName.trim() || undefined,
      customerPhone: formCustomerPhone.trim() || undefined,
      customerAddress: formCustomerAddress.trim() || undefined,
      customerSize: formCustomerSize.trim() || undefined,
      messengerLink: formMessengerLink.trim() || undefined,
      contactUrl: formMessengerLink.trim() || undefined,
      deliveryMode: formDelivery || undefined,
      notes: formNotes.trim() || undefined,
      customerId: finalCustomerId,
    };

    if (editingItem) {
      updateOfficeItem(editingItem.id, itemData);
      onDone('تم تعديل صنف المكتب بنجاح');
    } else {
      addOfficeItem(itemData);
      onDone('تم تسجيل صنف المكتب بنجاح');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={
        variant === 'card'
          ? 'p-3.5 rounded-2xl bg-white border border-[#5F2967] space-y-2.5 text-xs shadow-[0_2px_6px_rgba(43,35,64,0.10)]'
          : 'space-y-2.5 text-xs'
      }
    >
      {variant === 'card' && (
        <div className="flex items-center justify-between pb-1 border-b border-[#ECECF4]">
          <span className="font-extrabold text-[#5F2967]">
            {editingItem ? 'تعديل صنف مكتب' : 'إضافة صنف لمكتب'}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[#9A98B0] hover:text-[#2B2340]"
            >
              <Icon3D name="close" size={16} />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">المكتب / المورد *</label>
          <select
            required
            value={formOfficeName}
            onChange={(e) => setFormOfficeName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967]"
          >
            {registeredOffices.map((off) => (
              <option key={off} value={off}>
                {off}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">اسم الصنف / الموديل *</label>
          <input
            type="text"
            required
            placeholder="صنف..."
            value={formItemName}
            onChange={(e) => setFormItemName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-[#9A98B0] mb-0.5">العدد *</label>
          <input
            type="number"
            min="1"
            required
            value={formQuantity}
            onChange={(e) => setFormQuantity(e.target.value)}
            className="w-full px-2 py-1.5 text-center rounded-xl border border-[#ECECF4] bg-white font-bold"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#9A98B0] mb-0.5">سعر التكلفة للقطعة *</label>
          <input
            type="number"
            step="any"
            required
            placeholder="0"
            value={formCostPrice}
            onChange={(e) => setFormCostPrice(e.target.value)}
            className="w-full px-2 py-1.5 text-center rounded-xl border border-[#ECECF4] bg-white font-bold"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">سعر البيع المقترح (للقطعة)</label>
        <input
          type="number"
          step="any"
          placeholder="اختياري (0)"
          value={formGuideSellPrice}
          onChange={(e) => setFormGuideSellPrice(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-xl border border-[#ECECF4] bg-white font-bold outline-none focus:border-[#5F2967]"
        />
      </div>

      <div className="p-2.5 rounded-xl bg-[#F1F1FA] border border-[#ECECF4] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#2B2340] block text-[10px]">
            بيانات العميل الاختيارية:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setCustomerFormMode('new');
                setSelectedRegisteredCustomerId('');
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                customerFormMode === 'new'
                  ? 'bg-[#5F2967] text-white shadow-xs'
                  : 'bg-white text-[#666079] border border-[#ECECF4]'
              }`}
            >
              عميلة جديدة
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerFormMode('registered');
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                customerFormMode === 'registered'
                  ? 'bg-[#5F2967] text-white shadow-xs'
                  : 'bg-white text-[#666079] border border-[#ECECF4]'
              }`}
            >
              عميلة مسجلة
            </button>
          </div>
        </div>

        {customerFormMode === 'new' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                placeholder="اسم العميل"
                value={formCustomerName}
                onChange={(e) => setFormCustomerName(e.target.value)}
                className="px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs"
              />
              <input
                type="tel"
                placeholder="رقم الهاتف"
                value={formCustomerPhone}
                onChange={(e) => setFormCustomerPhone(toEnglishDigits(e.target.value))}
                className="px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                placeholder="العنوان"
                value={formCustomerAddress}
                onChange={(e) => setFormCustomerAddress(e.target.value)}
                className="px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs"
              />
              <input
                type="text"
                placeholder="المقاس"
                value={formCustomerSize}
                onChange={(e) => setFormCustomerSize(e.target.value)}
                className="px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs"
              />
            </div>
            <input
              type="text"
              placeholder="لينك الماسنجر (رابط العميل)"
              value={formMessengerLink}
              onChange={(e) => setFormMessengerLink(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs"
            />
            <DeliveryChoice value={formDelivery} onChange={setFormDelivery} />
          </div>
        )}

        {customerFormMode === 'registered' && (
          <div className="space-y-1.5">
            {selectedRegisteredCustomerId ? (
              <div className="p-2 rounded-lg bg-white border border-[#5F2967]/30 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[#5F2967] text-xs truncate">
                      {formCustomerName}
                    </span>
                    {formCustomerPhone && (
                      <span className="text-[10px] text-[#9A98B0] shrink-0">
                        • {toEnglishDigits(formCustomerPhone)}
                      </span>
                    )}
                    {formDelivery === 'delivery' && (
                      <span className="text-[9px] px-1 rounded bg-[#E3F2EA] text-[#2F7F5F] font-bold">
                        شحن
                      </span>
                    )}
                  </div>
                  {formCustomerAddress && (
                    <p className="text-[10px] text-[#666079] truncate mt-0.5">
                      {formCustomerAddress}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegisteredCustomerId('');
                    setCustomerSearchTerm('');
                  }}
                  className="px-2 py-1 rounded-md bg-[#ECECF4] text-[10px] font-bold text-[#5F2967] hover:bg-[#5F2967] hover:text-white transition cursor-pointer"
                >
                  تغيير
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="ابحث باسم العميلة أو رقم الهاتف..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs outline-none focus:border-[#5F2967]"
                  autoFocus
                />
                <div className="max-h-36 overflow-y-auto divide-y divide-[#ECECF4] rounded-lg border border-[#ECECF4] bg-white">
                  {matchingCustomers.length === 0 ? (
                    <div className="p-2 text-center text-[10px] text-[#9A98B0]">
                      لا توجد عميلة مطابقة
                    </div>
                  ) : (
                    matchingCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectRegisteredCustomer(c)}
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
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {formDelivery === 'delivery' && (
          <div>
            <label className="block text-[10px] text-[#9A98B0] mb-0.5 font-bold">قيمة التوصيل</label>
            <input
              type="number"
              step="any"
              placeholder="اختياري (مثال: 50)"
              value={formDeliveryFee}
              onChange={(e) => setFormDeliveryFee(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs font-bold"
            />
          </div>
        )}

        <input
          type="text"
          placeholder="ملاحظات الصنف..."
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          className="w-full px-2 py-1 rounded-lg border border-[#ECECF4] bg-white text-xs"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 py-2 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white font-bold text-xs cursor-pointer shadow-xs transition"
        >
          {editingItem ? 'حفظ التعديل' : 'إضافة الصنف'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-[#ECECF4] text-xs font-bold cursor-pointer"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
};
