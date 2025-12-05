import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Account } from '../entities/Account';

const router = Router();

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const accountRepository = AppDataSource.getRepository(Account);
    const accounts = await accountRepository.find({
      order: { createdAt: 'DESC' },
    });
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get account by ID
router.get('/:id', async (req, res) => {
  try {
    const accountRepository = AppDataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: parseInt(req.params.id) },
      relations: ['recurringTransactions', 'transactions'],
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Create account
router.post('/', async (req, res) => {
  try {
    const accountRepository = AppDataSource.getRepository(Account);
    const { name, startingBalance, startDate } = req.body;

    if (!name || startingBalance === undefined || !startDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = accountRepository.create({
      name,
      startingBalance,
      currentBalance: startingBalance,
      startDate,
    });

    await accountRepository.save(account);
    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const accountRepository = AppDataSource.getRepository(Account);
    const account = await accountRepository.findOne({
      where: { id: parseInt(req.params.id) },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { name, startingBalance, currentBalance, startDate } = req.body;

    if (name !== undefined) account.name = name;
    if (startingBalance !== undefined) account.startingBalance = startingBalance;
    if (currentBalance !== undefined) account.currentBalance = currentBalance;
    if (startDate !== undefined) account.startDate = startDate;

    await accountRepository.save(account);
    res.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const accountRepository = AppDataSource.getRepository(Account);
    const result = await accountRepository.delete(parseInt(req.params.id));

    if (result.affected === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
