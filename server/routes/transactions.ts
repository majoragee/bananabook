import { Router } from 'express';
import { FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Transaction } from '../entities/Transaction';
import { Account } from '../entities/Account';
import { RecurringTransaction } from '../entities/RecurringTransaction';

const router = Router();

// Get all transactions (optionally filtered by account)
router.get('/', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(Transaction);
    const { accountId, reconciled } = req.query;

    const where: FindOptionsWhere<Transaction> = {};
    if (accountId) where.accountId = parseInt(accountId as string);
    if (reconciled !== undefined) where.reconciled = reconciled === 'true';

    const transactions = await repository.find({
      where,
      relations: ['account', 'recurringTransaction'],
      order: { date: 'DESC' },
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(Transaction);
    const transaction = await repository.findOne({
      where: { id: parseInt(req.params.id) },
      relations: ['account', 'recurringTransaction'],
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create transaction
router.post('/', async (req, res) => {
  try {
    const transactionRepository = AppDataSource.getRepository(Transaction);

    const {
      accountId,
      description,
      amount,
      type,
      date,
      reconciled,
      recurringTransactionId,
    } = req.body;

    if (
      !accountId ||
      !description ||
      amount === undefined ||
      !type ||
      !date
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transaction = transactionRepository.create({
      accountId,
      description,
      amount,
      type,
      date,
      reconciled: reconciled || false,
      reconciledDate: reconciled ? date : null,
      recurringTransactionId: recurringTransactionId || null,
    });

    await transactionRepository.save(transaction);

    // Update account balance if reconciled
    if (transaction.reconciled) {
      await updateAccountBalance(accountId);
    }

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction (including reconciliation)
router.put('/:id', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(Transaction);
    const transaction = await repository.findOne({
      where: { id: parseInt(req.params.id) },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const wasReconciled = transaction.reconciled;
    const {
      description,
      amount,
      type,
      date,
      reconciled,
      recurringTransactionId,
    } = req.body;

    if (description !== undefined) transaction.description = description;
    if (amount !== undefined) transaction.amount = amount;
    if (type !== undefined) transaction.type = type;
    if (date !== undefined) transaction.date = date;
    if (reconciled !== undefined) {
      transaction.reconciled = reconciled;
      transaction.reconciledDate = reconciled ? (date || transaction.date) : null;
    }
    if (recurringTransactionId !== undefined) {
      transaction.recurringTransactionId = recurringTransactionId;
    }

    await repository.save(transaction);

    // Update account balance if reconciliation status changed
    if (wasReconciled !== transaction.reconciled) {
      await updateAccountBalance(transaction.accountId);
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Reconcile a recurring transaction (create actual transaction)
router.post('/reconcile', async (req, res) => {
  try {
    const transactionRepository = AppDataSource.getRepository(Transaction);
    const recurringRepository = AppDataSource.getRepository(RecurringTransaction);

    const {
      recurringTransactionId,
      date,
      amount: customAmount,
      updateRecurringAmount,
    } = req.body;

    if (!recurringTransactionId || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const recurringTransaction = await recurringRepository.findOne({
      where: { id: recurringTransactionId },
    });

    if (!recurringTransaction) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    const amount = customAmount !== undefined ? customAmount : recurringTransaction.amount;

    // Create the reconciled transaction
    const transaction = transactionRepository.create({
      accountId: recurringTransaction.accountId,
      description: recurringTransaction.description,
      amount,
      type: recurringTransaction.type,
      date,
      reconciled: true,
      reconciledDate: date,
      recurringTransactionId,
    });

    await transactionRepository.save(transaction);

    // Optionally update the recurring transaction's estimated amount
    if (updateRecurringAmount && customAmount !== undefined) {
      recurringTransaction.amount = customAmount;
      await recurringRepository.save(recurringTransaction);
    }

    // Update account balance
    await updateAccountBalance(recurringTransaction.accountId);

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error reconciling transaction:', error);
    res.status(500).json({ error: 'Failed to reconcile transaction' });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(Transaction);
    const transaction = await repository.findOne({
      where: { id: parseInt(req.params.id) },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const accountId = transaction.accountId;
    const wasReconciled = transaction.reconciled;

    await repository.delete(parseInt(req.params.id));

    // Update account balance if the transaction was reconciled
    if (wasReconciled) {
      await updateAccountBalance(accountId);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Helper function to update account balance based on reconciled transactions
async function updateAccountBalance(accountId: number) {
  const accountRepository = AppDataSource.getRepository(Account);
  const transactionRepository = AppDataSource.getRepository(Transaction);

  const account = await accountRepository.findOne({
    where: { id: accountId },
  });

  if (!account) return;

  const transactions = await transactionRepository.find({
    where: { accountId, reconciled: true },
  });

  let balance = account.startingBalance;

  for (const transaction of transactions) {
    if (transaction.type === 'deposit') {
      balance += Number(transaction.amount);
    } else if (transaction.type === 'expense') {
      balance -= Number(transaction.amount);
    } else if (transaction.type === 'adjustment') {
      balance += Number(transaction.amount);
    }
  }

  account.currentBalance = balance;
  await accountRepository.save(account);
}

export default router;
