import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { RecurringTransaction } from '../entities/RecurringTransaction';

const router = Router();

// Get all recurring transactions (optionally filtered by account)
router.get('/', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(RecurringTransaction);
    const { accountId } = req.query;

    const where = accountId ? { accountId: parseInt(accountId as string) } : {};

    const transactions = await repository.find({
      where,
      relations: ['account'],
      order: { createdAt: 'DESC' },
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    res.status(500).json({ error: 'Failed to fetch recurring transactions' });
  }
});

// Get recurring transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(RecurringTransaction);
    const transaction = await repository.findOne({
      where: { id: parseInt(req.params.id) },
      relations: ['account'],
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching recurring transaction:', error);
    res.status(500).json({ error: 'Failed to fetch recurring transaction' });
  }
});

// Create recurring transaction
router.post('/', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(RecurringTransaction);
    const {
      accountId,
      description,
      amount,
      type,
      frequency,
      startDate,
      endDate,
      active,
    } = req.body;

    if (
      !accountId ||
      !description ||
      amount === undefined ||
      !type ||
      !frequency ||
      !startDate
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transaction = repository.create({
      accountId,
      description,
      amount,
      type,
      frequency,
      startDate,
      endDate: endDate || null,
      active: active !== undefined ? active : true,
    });

    await repository.save(transaction);
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating recurring transaction:', error);
    res.status(500).json({ error: 'Failed to create recurring transaction' });
  }
});

// Update recurring transaction
router.put('/:id', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(RecurringTransaction);
    const transaction = await repository.findOne({
      where: { id: parseInt(req.params.id) },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    const {
      description,
      amount,
      type,
      frequency,
      startDate,
      endDate,
      active,
    } = req.body;

    if (description !== undefined) transaction.description = description;
    if (amount !== undefined) transaction.amount = amount;
    if (type !== undefined) transaction.type = type;
    if (frequency !== undefined) transaction.frequency = frequency;
    if (startDate !== undefined) transaction.startDate = startDate;
    if (endDate !== undefined) transaction.endDate = endDate;
    if (active !== undefined) transaction.active = active;

    await repository.save(transaction);
    res.json(transaction);
  } catch (error) {
    console.error('Error updating recurring transaction:', error);
    res.status(500).json({ error: 'Failed to update recurring transaction' });
  }
});

// Delete recurring transaction
router.delete('/:id', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(RecurringTransaction);
    const result = await repository.delete(parseInt(req.params.id));

    if (result.affected === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting recurring transaction:', error);
    res.status(500).json({ error: 'Failed to delete recurring transaction' });
  }
});

export default router;
