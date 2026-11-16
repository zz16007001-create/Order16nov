/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PocketTransaction } from '../types';

export const getSettled = (tx: Pick<PocketTransaction, 'settledAmount'>): number =>
  tx.settledAmount || 0;

export const getPocketRemaining = (
  tx: Pick<PocketTransaction, 'amount' | 'repaidAmount' | 'settledAmount'>
): number => Math.max(0, tx.amount - (tx.repaidAmount || 0) - getSettled(tx));

export const isFullySettled = (
  tx: Pick<PocketTransaction, 'type' | 'amount' | 'repaidAmount' | 'settledAmount'>
): boolean => tx.type === 'withdrawal' && getSettled(tx) > 0 && getPocketRemaining(tx) === 0;
