/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BagExpense, BagExpenseRoute, SalaryBudgetItem } from '../types';

export interface BagAvailabilityContext {
  expenses: BagExpense[];
  salaryBudget: SalaryBudgetItem[];
  pocketBalance: number;
  liquidity: number;
}

const getDestinationKey = (route: BagExpenseRoute, targetId?: string): string | null => {
  if (route === 'salary') {
    return targetId ? `salary:${targetId}` : null;
  }
  if (route === 'pocket_advance') {
    return 'pocket';
  }
  if (route === 'capital_advance' || route === 'capital_settlement') {
    return 'capital';
  }
  return null;
};

/**
 * Calculates remaining available balance for a bag expense destination after subtracting
 * current trip expenses routed to the same destination.
 * Returns null when the route has no balance limit (e.g. 'order', 'unclassified').
 */
export const getBagDestinationAvailable = (
  ctx: BagAvailabilityContext & {
    route: BagExpenseRoute;
    targetId?: string;
    excludeExpenseId?: string;
  }
): number | null => {
  const destKey = getDestinationKey(ctx.route, ctx.targetId);
  if (!destKey) return null;

  let baseBalance = 0;
  if (ctx.route === 'salary' && ctx.targetId) {
    const item = ctx.salaryBudget.find((b) => b.id === ctx.targetId);
    if (!item) return null;
    baseBalance = (item.budgeted || 0) - (item.spent || 0);
  } else if (ctx.route === 'pocket_advance') {
    baseBalance = ctx.pocketBalance;
  } else {
    baseBalance = ctx.liquidity;
  }

  const pendingSum = ctx.expenses.reduce((sum, exp) => {
    if (ctx.excludeExpenseId && exp.id === ctx.excludeExpenseId) return sum;
    if (getDestinationKey(exp.route, exp.targetId) === destKey) {
      return sum + (exp.amount || 0);
    }
    return sum;
  }, 0);

  return baseBalance - pendingSum;
};

export interface BagDestinationOverage {
  key: string;
  label: string;
  available: number;
  requested: number;
  excess: number;
}

/**
 * Checks all current trip expenses against their respective destination balances.
 * Returns overage entries for any destination where total trip expenses exceed available balance.
 */
export const getBagTripOverages = (ctx: BagAvailabilityContext): BagDestinationOverage[] => {
  const grouped = new Map<
    string,
    { route: BagExpenseRoute; targetId?: string; total: number; hasAdv: boolean; hasSettle: boolean }
  >();

  for (const exp of ctx.expenses) {
    const key = getDestinationKey(exp.route, exp.targetId);
    if (!key) continue;
    const existing = grouped.get(key) || {
      route: exp.route,
      targetId: exp.targetId,
      total: 0,
      hasAdv: false,
      hasSettle: false,
    };
    existing.total += exp.amount || 0;
    if (exp.route === 'capital_advance') existing.hasAdv = true;
    if (exp.route === 'capital_settlement') existing.hasSettle = true;
    grouped.set(key, existing);
  }

  const overages: BagDestinationOverage[] = [];
  for (const [key, entry] of grouped.entries()) {
    // Check base balance by excluding all expenses (passing empty expenses array)
    const available = getBagDestinationAvailable({
      ...ctx,
      expenses: [],
      route: entry.route,
      targetId: entry.targetId,
    });
    if (available === null) continue;
    const excess = entry.total - available;
    if (excess > 0.001) {
      let label = '';
      if (entry.route === 'salary' && entry.targetId) {
        const bItem = ctx.salaryBudget.find((b) => b.id === entry.targetId);
        label = `بند القبض "${bItem?.name || 'غير محدد'}"`;
      } else if (entry.route === 'pocket_advance') {
        label = 'سلفة بوكيت (رصيد بوكيت)';
      } else if (entry.hasAdv && entry.hasSettle) {
        label = 'السيولة المتاحة في رأس المال (سلفة وتسوية)';
      } else if (entry.hasSettle) {
        label = 'السيولة المتاحة في رأس المال (تسوية)';
      } else {
        label = 'السيولة المتاحة في رأس المال (سلفة)';
      }
      overages.push({
        key,
        label,
        available,
        requested: entry.total,
        excess,
      });
    }
  }

  return overages;
};

export const isBagExpenseOverLimit = (
  exp: BagExpense,
  overageKeys: Set<string>
): boolean => {
  const key = getDestinationKey(exp.route, exp.targetId);
  return key !== null && overageKeys.has(key);
};
