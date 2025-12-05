import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Account } from './entities/Account';
import { RecurringTransaction } from './entities/RecurringTransaction';
import { Transaction } from './entities/Transaction';
import path from 'path';

const dataDir = process.env.DATA_DIR || process.cwd();
const dbPath = path.join(dataDir, 'bananabook.db');

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  synchronize: true,
  logging: false,
  entities: [Account, RecurringTransaction, Transaction],
});

export const initializeDatabase = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('Database initialized');
  }
  return AppDataSource;
};
