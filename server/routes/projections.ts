import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Account } from '../entities/Account';
import { RecurringTransaction } from '../entities/RecurringTransaction';
import { Transaction } from '../entities/Transaction';

const router = Router();

interface ProjectionEntry {
  date: string;
  description: string;
  amount: number;
  type: 'deposit' | 'expense' | 'adjustment';
  balance: number;
  isReconciled: boolean;
  recurringTransactionId?: number;
  transactionId?: number;
}

// Get balance projection for an account
router.get('/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { months = 12 } = req.query;

    const accountRepository = AppDataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const projection = await calculateProjection(
      accountId,
      parseInt(months as string)
    );

    res.json({
      account,
      projection,
    });
  } catch (error) {
    console.error('Error generating projection:', error);
    res.status(500).json({ error: 'Failed to generate projection' });
  }
});

async function calculateProjection(
  accountId: number,
  months: number
): Promise<ProjectionEntry[]> {
  const accountRepository = AppDataSource.getRepository(Account);
  const recurringRepository = AppDataSource.getRepository(RecurringTransaction);
  const transactionRepository = AppDataSource.getRepository(Transaction);

  const account = await accountRepository.findOne({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  // Get all recurring transactions for this account
  const recurringTransactions = await recurringRepository.find({
    where: { accountId, active: true },
  });

  // Get all reconciled transactions
  const reconciledTransactions = await transactionRepository.find({
    where: { accountId, reconciled: true },
    order: { date: 'ASC' },
  });

  // Calculate projection period
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + months);

  // Determine the start date for projection - use the account start date
  const startDate = new Date(account.startDate);

  const entries: ProjectionEntry[] = [];

  // Add all reconciled transactions
  for (const transaction of reconciledTransactions) {
    entries.push({
      date: transaction.date,
      description: transaction.description,
      amount: Number(transaction.amount),
      type: transaction.type,
      balance: 0, // Will be calculated later
      isReconciled: true,
      transactionId: transaction.id,
      recurringTransactionId: transaction.recurringTransactionId || undefined,
    });
  }

  // Generate projected entries from recurring transactions
  // Start from the account start date to catch any past unreconciled transactions
  for (const recurring of recurringTransactions) {
    const projectedEntries = generateRecurringEntries(
      recurring,
      startDate,
      endDate,
      reconciledTransactions
    );
    entries.push(...projectedEntries);
  }

  // Sort all entries by date
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance starting from the starting balance
  let balance = Number(account.startingBalance);

  for (const entry of entries) {
    if (entry.type === 'deposit') {
      balance += entry.amount;
    } else if (entry.type === 'expense') {
      balance -= entry.amount;
    } else if (entry.type === 'adjustment') {
      balance += entry.amount;
    }
    entry.balance = balance;
  }

  return entries;
}

function generateRecurringEntries(
  recurring: RecurringTransaction,
  startDate: Date,
  endDate: Date,
  reconciledTransactions: Transaction[]
): ProjectionEntry[] {
  const entries: ProjectionEntry[] = [];
  const recurringStart = new Date(recurring.startDate);
  const recurringEnd = recurring.endDate ? new Date(recurring.endDate) : null;

  // Find already reconciled instances of this recurring transaction
  const reconciledDates = new Set(
    reconciledTransactions
      .filter((t) => t.recurringTransactionId === recurring.id)
      .map((t) => t.date)
  );

  let currentDate = new Date(Math.max(recurringStart.getTime(), startDate.getTime()));

  // Adjust to first occurrence based on frequency
  currentDate = adjustToFirstOccurrence(currentDate, recurringStart, recurring.frequency);

  while (currentDate <= endDate) {
    // Check if this date exceeds the recurring transaction's end date
    if (recurringEnd && currentDate > recurringEnd) {
      break;
    }

    const dateString = formatDate(currentDate);

    // Only add if not already reconciled
    if (!reconciledDates.has(dateString)) {
      entries.push({
        date: dateString,
        description: recurring.description,
        amount: Number(recurring.amount),
        type: recurring.type,
        balance: 0, // Will be calculated later
        isReconciled: false,
        recurringTransactionId: recurring.id,
      });
    }

    // Move to next occurrence
    currentDate = getNextOccurrence(currentDate, recurring.frequency);
  }

  return entries;
}

function adjustToFirstOccurrence(
  current: Date,
  start: Date,
  frequency: string
): Date {
  const result = new Date(current);

  switch (frequency) {
    case 'daily':
      // No adjustment needed
      break;
    case 'weekly':
      // Adjust to the same day of week as start
      const startDay = start.getDay();
      const currentDay = result.getDay();
      const daysToAdd = (startDay - currentDay + 7) % 7;
      result.setDate(result.getDate() + daysToAdd);
      break;
    case 'bi-weekly':
      // Adjust to align with start date's bi-weekly schedule
      const daysDiff = Math.floor(
        (result.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remainder = daysDiff % 14;
      if (remainder < 0) {
        result.setDate(result.getDate() - remainder);
      } else if (remainder > 0) {
        result.setDate(result.getDate() + (14 - remainder));
      }
      break;
    case 'monthly':
      // Use the same day of month as start
      result.setDate(start.getDate());
      if (result < current) {
        result.setMonth(result.getMonth() + 1);
      }
      break;
    case 'yearly':
      // Use the same month and day as start
      result.setMonth(start.getMonth());
      result.setDate(start.getDate());
      if (result < current) {
        result.setFullYear(result.getFullYear() + 1);
      }
      break;
  }

  return result;
}

function getNextOccurrence(date: Date, frequency: string): Date {
  const next = new Date(date);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'bi-weekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default router;
