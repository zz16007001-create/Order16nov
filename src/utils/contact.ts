/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Convert Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to Western English digits (0-9).
 */
export const toEnglishDigits = (str: string = ''): string => {
  if (!str) return '';
  return str
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
};

/**
 * Normalize Egyptian/international phone number to comparable digits (English digits, stripped prefix).
 */
export const normalizePhoneForComparison = (phone?: string): string => {
  if (!phone) return '';
  let digits = toEnglishDigits(phone).replace(/\D/g, '');
  if (digits.startsWith('0020')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('20') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

/**
 * Clean and format phone number for WhatsApp
 */
export const getWhatsAppUrl = (phone?: string): string => {
  if (!phone) return '';
  const cleaned = toEnglishDigits(phone).replace(/\D/g, '');
  if (!cleaned) return '';

  // Handle Egyptian phone numbers starting with 01
  let formatted = cleaned;
  if (formatted.startsWith('01') && formatted.length === 11) {
    formatted = '2' + formatted;
  } else if (!formatted.startsWith('20') && formatted.length === 10) {
    formatted = '20' + formatted;
  }

  return `https://wa.me/${formatted}`;
};

/**
 * Handle opening WhatsApp
 */
export const openWhatsApp = (e: React.MouseEvent, phone?: string) => {
  if (!phone) return;
  const url = getWhatsAppUrl(phone);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Format Messenger URL from profile/username/link
 */
export const formatMessengerUrl = (messenger?: string): string => {
  if (!messenger) return '';
  const trimmed = messenger.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // If it's a username or id
  const cleanId = trimmed.replace(/^@/, '');
  return `https://m.me/${cleanId}`;
};

/**
 * Format phone call URL
 */
export const getTelUrl = (phone?: string): string => {
  if (!phone) return '';
  const cleaned = toEnglishDigits(phone).replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
};
