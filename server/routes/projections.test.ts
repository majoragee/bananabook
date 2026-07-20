import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataSource, initializeDatabase } from '../data-source';
import { Account } from '../entities/Account';
import { RecurringTransaction } from '../entities/RecurringTransaction';
import { Transaction } from '../entities/Transaction';
import projectionRoutes from './projections';

// The projection horizon is measured from "today", so the clock is frozen to keep
// results stable no matter when CI runs.
const TODAY = new Date(2026, 0, 15); // 2026-01-15, local time

const app = express();
app.use(express.json());
app.use('/api/projections', projectionRoutes);

/** Creates an account with no recurring items. */
async function makeAccount(startingBalance = 1000, startDate = '2026-01-01') {
  return AppDataSource.getRepository(Account).save(
    AppDataSource.getRepository(Account).create({
      name: 'Bills Account',
      startingBalance,
      currentBalance: startingBalance,
      startDate,
    })
  );
}

async function makeRecurring(
  accountId: number,
  overrides: Partial<RecurringTransaction> = {}
) {
  const repo = AppDataSource.getRepository(RecurringTransaction);
  return repo.save(
    repo.create({
      description: 'Rent',
      amount: 100,
      type: 'expense',
      frequency: 'monthly',
      startDate: '2026-01-01',
      endDate: null,
      active: true,
      accountId,
      ...overrides,
    })
  );
}

/** Fetches the projection for an account, defaulting to a 12 month horizon. */
async function project(accountId: number, months = 12) {
  const res = await request(app).get(`/api/projections/${accountId}?months=${months}`);
  expect(res.status).toBe(200);
  return res.body.projection as Array<{
    date: string;
    description: string;
    amount: number;
    balance: number;
    isReconciled: boolean;
  }>;
}

const datesFor = (
  entries: Awaited<ReturnType<typeof project>>,
  description: string
) => entries.filter((e) => e.description === description).map((e) => e.date);

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
  await initializeDatabase();
});

afterAll(async () => {
  vi.useRealTimers();
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  const dir = process.env.DATA_DIR;
  if (dir && fs.existsSync(path.join(dir, 'bananabook.db'))) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  // Order matters: transactions and recurring rows reference accounts.
  await AppDataSource.getRepository(Transaction).clear();
  await AppDataSource.getRepository(RecurringTransaction).clear();
  await AppDataSource.getRepository(Account).clear();
});

describe('GET /api/projections/:accountId', () => {
  it('404s for an account that does not exist', async () => {
    const res = await request(app).get('/api/projections/99999');
    expect(res.status).toBe(404);
  });

  it('returns an empty projection for an account with no recurring items', async () => {
    const account = await makeAccount(1500);
    expect(await project(account.id)).toEqual([]);
  });
});

describe('recurring frequencies', () => {
  it('expands a monthly expense on the same day each month', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, { startDate: '2026-01-10' });

    const dates = datesFor(await project(account.id, 3), 'Rent');

    expect(dates).toEqual(['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10']);
  });

  it('expands a weekly expense every 7 days', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, {
      description: 'Weekly',
      frequency: 'weekly',
      startDate: '2026-01-05',
    });

    const dates = datesFor(await project(account.id, 1), 'Weekly');

    expect(dates.slice(0, 4)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
    ]);
  });

  it('expands a bi-weekly deposit every 14 days', async () => {
    const account = await makeAccount(0);
    await makeRecurring(account.id, {
      description: 'Transfer from paycheck',
      type: 'deposit',
      frequency: 'bi-weekly',
      startDate: '2026-01-02',
    });

    const dates = datesFor(await project(account.id, 2), 'Transfer from paycheck');

    expect(dates.slice(0, 4)).toEqual([
      '2026-01-02',
      '2026-01-16',
      '2026-01-30',
      '2026-02-13',
    ]);
  });

  it('expands a yearly expense once per year', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, {
      description: 'Property tax',
      frequency: 'yearly',
      startDate: '2026-11-15',
    });

    const dates = datesFor(await project(account.id, 24), 'Property tax');

    expect(dates).toEqual(['2026-11-15', '2027-11-15']);
  });

  it('expands a daily expense on consecutive days', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, {
      description: 'Daily',
      frequency: 'daily',
      startDate: '2026-01-01',
    });

    const dates = datesFor(await project(account.id, 1), 'Daily');

    expect(dates.slice(0, 3)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
});

describe('horizon and end dates', () => {
  it('stops generating after the recurring item end date', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, {
      startDate: '2026-01-10',
      endDate: '2026-03-31',
    });

    const dates = datesFor(await project(account.id, 12), 'Rent');

    expect(dates).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
  });

  it('excludes items deactivated with active: false', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, { description: 'Cancelled', active: false });

    expect(await project(account.id, 6)).toEqual([]);
  });

  it('honours a longer horizon', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, { startDate: '2026-01-10' });

    const short = datesFor(await project(account.id, 3), 'Rent');
    const long = datesFor(await project(account.id, 12), 'Rent');

    expect(long.length).toBeGreaterThan(short.length);
    expect(long.slice(0, short.length)).toEqual(short);
  });
});

describe('running balance', () => {
  it('subtracts expenses and adds deposits in date order', async () => {
    const account = await makeAccount(1000);
    await makeRecurring(account.id, {
      description: 'Bill',
      amount: 200,
      type: 'expense',
      startDate: '2026-01-05',
    });
    await makeRecurring(account.id, {
      description: 'Deposit',
      amount: 500,
      type: 'deposit',
      startDate: '2026-01-10',
    });

    const entries = await project(account.id, 1);

    expect(entries[0]).toMatchObject({ date: '2026-01-05', balance: 800 });
    expect(entries[1]).toMatchObject({ date: '2026-01-10', balance: 1300 });
  });

  it('identifies the first date the balance goes negative', async () => {
    const account = await makeAccount(250);
    await makeRecurring(account.id, {
      description: 'Bill',
      amount: 100,
      startDate: '2026-01-05',
    });

    const entries = await project(account.id, 6);
    const firstNegative = entries.find((e) => e.balance < 0);

    expect(firstNegative).toMatchObject({ date: '2026-03-05', balance: -50 });
  });

  it('stays positive when deposits cover the bills', async () => {
    const account = await makeAccount(500);
    await makeRecurring(account.id, {
      description: 'Bill',
      amount: 100,
      startDate: '2026-01-05',
    });
    await makeRecurring(account.id, {
      description: 'Transfer',
      amount: 150,
      type: 'deposit',
      startDate: '2026-01-01',
    });

    const entries = await project(account.id, 12);

    expect(entries.every((e) => e.balance > 0)).toBe(true);
  });
});

describe('the reconcile loop', () => {
  it('replaces a projected item with the reconciled actual on the same date', async () => {
    const account = await makeAccount(1000);
    const recurring = await makeRecurring(account.id, {
      description: 'Electric',
      amount: 180,
      startDate: '2026-01-05',
    });

    const repo = AppDataSource.getRepository(Transaction);
    await repo.save(
      repo.create({
        accountId: account.id,
        description: 'Electric',
        amount: 203.11,
        type: 'expense',
        date: '2026-01-05',
        reconciled: true,
        reconciledDate: '2026-01-05',
        recurringTransactionId: recurring.id,
      })
    );

    const entries = await project(account.id, 2);
    const jan5 = entries.filter((e) => e.date === '2026-01-05');

    // The estimate is gone; only the actual remains, at the real amount.
    expect(jan5).toHaveLength(1);
    expect(jan5[0].isReconciled).toBe(true);
    expect(jan5[0].amount).toBeCloseTo(203.11, 2);
    expect(jan5[0].balance).toBeCloseTo(796.89, 2);
  });

  it('leaves future occurrences of the same item projected', async () => {
    const account = await makeAccount(1000);
    const recurring = await makeRecurring(account.id, {
      description: 'Electric',
      amount: 180,
      startDate: '2026-01-05',
    });

    const repo = AppDataSource.getRepository(Transaction);
    await repo.save(
      repo.create({
        accountId: account.id,
        description: 'Electric',
        amount: 203.11,
        type: 'expense',
        date: '2026-01-05',
        reconciled: true,
        reconciledDate: '2026-01-05',
        recurringTransactionId: recurring.id,
      })
    );

    const entries = await project(account.id, 3);

    expect(entries.filter((e) => e.isReconciled)).toHaveLength(1);
    expect(datesFor(entries, 'Electric')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('ignores unreconciled transactions', async () => {
    const account = await makeAccount(1000);
    const repo = AppDataSource.getRepository(Transaction);
    await repo.save(
      repo.create({
        accountId: account.id,
        description: 'Pending',
        amount: 50,
        type: 'expense',
        date: '2026-01-05',
        reconciled: false,
        reconciledDate: null,
        recurringTransactionId: null,
      })
    );

    expect(await project(account.id, 2)).toEqual([]);
  });
});

describe('date handling', () => {
  it('does not shift dates across a timezone boundary', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, {
      description: 'Midnight',
      frequency: 'monthly',
      startDate: '2026-01-01',
    });

    const dates = datesFor(await project(account.id, 3), 'Midnight');

    // Every entry must land on the 1st -- never the 31st of the month before.
    expect(dates.every((d) => d.endsWith('-01'))).toBe(true);
  });

  it('documents that a monthly item on the 31st rolls into the following month', async () => {
    const account = await makeAccount(5000);
    await makeRecurring(account.id, {
      description: 'EndOfMonth',
      frequency: 'monthly',
      startDate: '2026-01-31',
    });

    const dates = datesFor(await project(account.id, 3), 'EndOfMonth');

    // February has no 31st, so JS Date rolls the date forward into March.
    // This is existing behaviour, pinned here so a future fix is a deliberate change.
    expect(dates[0]).toBe('2026-01-31');
    expect(dates[1]).toBe('2026-03-03');
  });
});
