/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../types';

export const parseOrderNumber = (code?: string): number => {
  if (!code) return -1;
  const normalized = code.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
  const match = normalized.match(/(\d+)/);
  if (!match) return -1;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? -1 : num;
};

export const getNextOrderNumber = (orders: Order[], orderCounter?: number): number => {
  let maxNum = 0;
  for (const o of orders) {
    const match = o.code.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return Math.max(maxNum + 1, orderCounter || 1);
};
