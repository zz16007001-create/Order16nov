/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Icon3D } from './icons3d/Icon3D';

export interface ConfirmDeleteOptions {
  title?: string;
  message: string;
  details?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDeleteContextValue {
  confirmDelete: (options: ConfirmDeleteOptions) => void;
}

const ConfirmDeleteContext = createContext<ConfirmDeleteContextValue | null>(null);

export const useConfirmDelete = (): ConfirmDeleteContextValue => {
  const ctx = useContext(ConfirmDeleteContext);
  if (!ctx) {
    throw new Error('useConfirmDelete must be used within ConfirmDeleteProvider');
  }
  return ctx;
};

export const ConfirmDeleteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmDeleteOptions | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmDelete = useCallback((opts: ConfirmDeleteOptions) => {
    setIsConfirmed(false);
    setIsSubmitting(false);
    setOptions(opts);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setOptions(null);
    setIsConfirmed(false);
  }, [isSubmitting]);

  const handleConfirm = useCallback(async () => {
    if (!options || !isConfirmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await options.onConfirm();
    } finally {
      setIsSubmitting(false);
      setOptions(null);
      setIsConfirmed(false);
    }
  }, [options, isConfirmed, isSubmitting]);

  useEffect(() => {
    if (!options) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options, handleClose]);

  return (
    <ConfirmDeleteContext.Provider value={{ confirmDelete }}>
      {children}
      {options && (
        <div
          onClick={handleClose}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#D4D0E0] space-y-3.5 text-right shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#E4E1EC]">
              <div className="flex items-center gap-2 text-[#C0394F]">
                <Icon3D name="danger" size={20} />
                <h3 className="font-extrabold text-sm text-[#1F1A2E]">
                  {options.title || 'تأكيد الحذف'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-[#666079] hover:text-[#1F1A2E] p-1 cursor-pointer bg-transparent border-0"
                aria-label="إغلاق"
              >
                <Icon3D name="close" size={16} />
              </button>
            </div>

            <p className="text-[12px] text-[#1F1A2E] font-semibold leading-relaxed whitespace-pre-line">
              {options.message}
            </p>

            {options.details && <div>{options.details}</div>}

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8E6EC]/70 border border-[#C0394F]/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="w-4 h-4 accent-[#C0394F] rounded cursor-pointer shrink-0"
              />
              <span className="text-[11px] font-bold text-[#A23B5A]">
                أؤكد أنني أريد الحذف فعلًا
              </span>
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={!isConfirmed || isSubmitting}
                onClick={handleConfirm}
                className="flex-1 h-[38px] rounded-xl bg-[#C0394F] hover:bg-[#A93245] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs cursor-pointer transition active:scale-95 shadow-xs"
              >
                {options.confirmLabel || 'حذف'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 h-[38px] rounded-xl bg-[#EDEEF2] text-[#1F1A2E] font-bold text-xs cursor-pointer hover:bg-[#E4E1EC] transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDeleteContext.Provider>
  );
};
