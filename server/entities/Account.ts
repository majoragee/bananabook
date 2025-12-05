import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RecurringTransaction } from './RecurringTransaction';
import { Transaction } from './Transaction';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  name!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  startingBalance!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  currentBalance!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => RecurringTransaction, (transaction) => transaction.account)
  recurringTransactions!: RecurringTransaction[];

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions!: Transaction[];
}
